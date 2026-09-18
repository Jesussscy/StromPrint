"""Recover cached OSM identity/appearance tags without changing the GIS model.

Uses only Python's standard library. No network, geometry processing or guessed
facades. Run after prepare.py; --check verifies the committed/generated output.
"""
import argparse
import hashlib
import json
import math
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data/manga/raw/osm-features.json"
MODEL = ROOT / "public/models/manga/manga.json"
OUTPUT = ROOT / "public/models/manga/visual-metadata.json"
OVERRIDES = ROOT / "data/manga/visual-overrides.json"
ID_PATTERN = re.compile(r"^osm-(way|relation|node)-(\d+)-(\d+)$")
PLACEHOLDER_NAMES = {
    "por favor agrega una etiqueta con el nombre.",
    "por favor agrega una etiqueta con el nombre",
    "edificio osm",
    "unnamed",
    "sin nombre",
}
ADDRESS_KEYS = {
    "addr:street": "street",
    "addr:housenumber": "houseNumber",
    "addr:housename": "houseName",
    "addr:city": "city",
    "addr:postcode": "postcode",
    "addr:full": "full",
}


def positive_number(value):
    try:
        number = float(value)
    except (ValueError, TypeError):
        return None
    return number if math.isfinite(number) and number > 0 else None


def prepare(raw_bytes, model_bytes, override_bytes):
    raw = json.loads(raw_bytes)
    model = json.loads(model_bytes)
    overrides = json.loads(override_bytes)
    if overrides.get("schemaVersion") != 1:
        raise ValueError("Unsupported visual override schema")
    pending_overrides = dict(overrides["buildings"])
    sources = {}
    for element in raw["elements"]:
        key = (element["type"], element["id"])
        if key in sources:
            raise ValueError(f"Duplicate OSM source: {key}")
        sources[key] = element

    buildings = {}
    counts = Counter()
    tag_coverage = Counter()
    issues = []
    for building in model["buildings"]:
        building_id = building["id"]
        if building_id in buildings:
            raise ValueError(f"Duplicate prepared building: {building_id}")
        match = ID_PATTERN.fullmatch(building_id)
        if not match:
            raise ValueError(f"Unsupported building ID: {building_id}")
        osm_type, osm_id, _part = match.groups()
        source = sources.get((osm_type, int(osm_id)))
        if source is None or "building" not in source.get("tags", {}):
            raise ValueError(f"Missing source building: {building_id}")

        # Preserve raw tags as evidence; never treat their text as instructions.
        tags = source["tags"]
        if any(not isinstance(value, str) for value in tags.values()):
            raise ValueError(f"Non-string OSM tag: {building_id}")
        tag_coverage.update(tags.keys())
        raw_name = tags.get("name", "").strip()
        name = raw_name if raw_name.casefold() not in PLACEHOLDER_NAMES else ""
        if raw_name and not name:
            issues.append({"id": building_id, "field": "name", "reason": "placeholder-name"})
        address = {
            key: tags[tag].strip()
            for tag, key in ADDRESS_KEYS.items()
            if tags.get(tag, "").strip()
        }
        # Keep number and street separately: OSM numbers can contain a full address.
        # Do not construct, normalize or geocode an address that the source lacks.
        roof = {
            key.removeprefix("roof:"): value
            for key, value in tags.items()
            if key.startswith("roof:")
        }
        levels = positive_number(tags.get("building:levels"))
        method = building.get("heightMethod", "")
        height_confidence = (
            "osm-height" if method.startswith("etiquetada OSM")
            else "osm-levels" if method.startswith("derivada:")
            else "estimated"
        )
        building_type = tags["building"]
        entry = {
            "osmId": int(osm_id),
            "sourceUrl": f"https://www.openstreetmap.org/{osm_type}/{osm_id}",
            "name": name or None,
            "address": address,
            "buildingType": building_type,
            "structureRole": "canopy" if building_type == "roof" else "building",
            "levels": levels,
            "roof": roof,
            "material": tags.get("building:material") or None,
            "colour": tags.get("building:colour") or None,
            "tags": tags,
            "confidence": {
                "footprint": "osm",
                "height": height_confidence,
                "facade": "unverified",
            },
        }
        override = pending_overrides.pop(building_id, None)
        if override:
            if override["expectedName"] != tags.get("name"):
                raise ValueError(f"Override identity no longer matches: {building_id}")
            expected_website = override.get("expectedWebsiteContains")
            if expected_website and expected_website not in tags.get("website", ""):
                raise ValueError(f"Override website no longer matches: {building_id}")
            visual_height = positive_number(override.get("heightM"))
            visual_levels = positive_number(override.get("levels"))
            per_level = positive_number(override.get("metresPerLevel"))
            if not all((visual_height, visual_levels, per_level)):
                raise ValueError(f"Invalid visual override dimensions: {building_id}")
            if not math.isclose(visual_height, visual_levels * per_level):
                raise ValueError(f"Visual override formula mismatch: {building_id}")
            if override["confidence"].get("measured") is not False:
                raise ValueError(f"Level-derived height must remain unmeasured: {building_id}")
            if override.get("levelsKind") not in {"total-documented", "minimum-documented"}:
                raise ValueError(f"Missing documented level interpretation: {building_id}")
            if not override.get("sourceUrl", "").startswith("https://"):
                raise ValueError(f"Missing visual evidence URL: {building_id}")
            entry.update({
                "visualHeightM": visual_height,
                "visualHeightMethod": override["heightMethod"],
                "visualHeightSourceUrl": override["sourceUrl"],
                "visualLevels": visual_levels,
                "visualLevelsKind": override["levelsKind"],
                "visualHeightMeasured": False,
            })
            entry["confidence"]["visualHeight"] = "primary-source-levels-estimated"
            counts["visualHeightOverrides"] += 1
        buildings[building_id] = entry
        counts["total"] += 1
        counts["named"] += bool(name)
        counts["rawNames"] += bool(raw_name)
        counts["withStreet"] += "street" in address
        counts["withHouseNumber"] += "houseNumber" in address
        counts["withLevels"] += levels is not None
        counts["withRoofTags"] += bool(roof)
        counts["withMaterial"] += entry["material"] is not None
        counts["withColour"] += entry["colour"] is not None
        counts["canopies"] += entry["structureRole"] == "canopy"
        counts["verifiedFacades"] += 0
        counts["estimatedHeights"] += height_confidence == "estimated"

    if pending_overrides:
        raise ValueError(f"Overrides target absent buildings: {sorted(pending_overrides)}")

    return {
        "schemaVersion": 1,
        "metadata": {
            "source": "Cached OpenStreetMap elements joined to existing clipped model IDs",
            "sourceTimestamp": raw.get("osm3s", {}).get("timestamp_osm_base"),
            "sourceSha256": hashlib.sha256(raw_bytes).hexdigest(),
            "modelSha256": hashlib.sha256(model_bytes).hexdigest(),
            "visualOverridesSha256": hashlib.sha256(override_bytes).hexdigest(),
            "attribution": "© OpenStreetMap contributors · ODbL 1.0",
            "licenseUrl": "https://www.openstreetmap.org/copyright",
            "facadeStatus": "No measured or photo-verified facades in the cached dataset",
            "counts": dict(counts),
            "tagCoverage": dict(sorted(tag_coverage.items())),
            "issues": issues,
        },
        "buildings": buildings,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Check output without writing")
    args = parser.parse_args()
    raw_bytes, model_bytes = RAW.read_bytes(), MODEL.read_bytes()
    override_bytes = OVERRIDES.read_bytes()
    prepared = prepare(raw_bytes, model_bytes, override_bytes)
    encoded = (json.dumps(prepared, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf8")
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_bytes() != encoded:
            raise SystemExit("FAIL: visual-metadata.json is missing or stale; run this script")
    else:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_bytes(encoded)
    if RAW.read_bytes() != raw_bytes or MODEL.read_bytes() != model_bytes or OVERRIDES.read_bytes() != override_bytes:
        raise RuntimeError("GIS inputs changed during generation; repeat against a stable snapshot")
    print(json.dumps({
        "status": "PASS",
        "mode": "check" if args.check else "generate",
        "path": str(OUTPUT.relative_to(ROOT)),
        "bytes": len(encoded),
        "sha256": hashlib.sha256(encoded).hexdigest(),
        "modelSha256": prepared["metadata"]["modelSha256"],
        "counts": prepared["metadata"]["counts"],
        "issues": prepared["metadata"]["issues"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
