"""Source-backed planimetry; vertical dimensions remain explicit assumptions."""
import hashlib
import json
from pathlib import Path
from shapely import constrained_delaunay_triangles
from shapely.geometry import LineString, Polygon, Point
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[2]
BRIDGES = {'Puente_Roman': [404213692], 'Puente_Las_Palmas': [173053758],
           'Puente_Jimenez': [90955541], 'Puente_Bazurto': [25355014, 49555739]}


def solids(geometry, bottom, top):
    """Serialize closed extrusions, retaining concavities and courtyard holes."""
    result = []
    parts = [geometry] if geometry.geom_type == 'Polygon' else list(geometry.geoms)
    for part in parts:
        if part.is_empty or part.area < .001:
            continue
        p = orient(part, sign=1)
        result.append(dict(rings=[list(p.exterior.coords)]+[list(r.coords) for r in p.interiors],
                           roof=[list(orient(t, sign=1).exterior.coords)[:3]
                                 for t in constrained_delaunay_triangles(p).geoms],
                           base=bottom, height=top-bottom))
    return result


def prepare_landmarks(metadata, xy, boundary):
    paths = [ROOT/'data/manga/raw/osm-features.json', ROOT/'data/manga/raw/osm-contract-landmarks.json']
    sources = [json.loads(p.read_text(encoding='utf8')) for p in paths]
    ways = {e['id']: e for source in sources for e in source['elements'] if e['type'] == 'way'}
    nodes = {e['id']: e for source in sources for e in source['elements'] if e['type'] == 'node'}
    geometry = {}
    for item in metadata['landmarks']:
        name, h = item['name'], item['position'][2]
        item['requested'] = {k: item[k] for k in ['position', 'lon', 'lat', 'provenance']}
        item['verticalProvenance'] = 'User elevation, hypothetical MSL; not surveyed'
        item['planimetryProvenance'] = 'OpenStreetMap, community mapping; not cadastral survey'
        pieces, ids, centerlines = [], [], []
        if name in BRIDGES:
            ids = BRIDGES[name]
            lines = []
            for osm_id in ids:
                e = ways[osm_id]
                assert e['tags'].get('bridge') == 'yes'
                points = [xy(p['lon'], p['lat']) for p in e['geometry']]
                line = LineString(points)
                width = int(e['tags'].get('lanes', 2))*3.25+2
                deck = line.buffer(width/2, cap_style=2, join_style=2)
                pieces.extend(solids(deck, h-.45, h))
                # Rails follow both sides; endpoints remain open for traffic.
                for side in [-1, 1]:
                    rail = line.offset_curve(side*(width/2-.2), join_style=2).buffer(.15, cap_style=2)
                    pieces.extend(solids(rail, h, h+1))
                lines.append(line)
                centerlines.append(dict(osmId=osm_id, points=points, lengthM=line.length, widthM=width,
                                        endpointDistanceToLandM=[boundary.distance(Point(p)) for p in (points[0], points[-1])]))
            center = unary_union(lines).centroid
            item['dimensionsProvenance'] = 'Length/orientation from OSM; width = lanes × 3.25 + 2 m; slab 0.45 m; rails 1 m assumed'
            item['identityEvidence'] = ('OSM bridge:name/alt_name' if name in ['Puente_Jimenez','Puente_Bazurto']
                                        else 'OSM street and geographic topology matched to Cartagena Film Commission access inventory')
        elif name == 'Fortin_Pastelillo':
            ids = [54977866]
            footprint = Polygon([xy(p['lon'], p['lat']) for p in ways[ids[0]]['geometry']])
            assert footprint.is_valid
            pieces.extend(solids(footprint, h-.6, h))
            parapet = footprint.difference(footprint.buffer(-1.2, join_style=2))
            pieces.extend(solids(parapet, h, h+1.4))
            center = footprint.centroid
            item['dimensionsProvenance'] = 'OSM historic=fort footprint; terrace thickness 0.6 m, parapet width 1.2 m and height 1.4 m assumed; no measured facades'
        elif name == 'Club_Nautico_Marina':
            marina = nodes[4246811137]
            center = Point(xy(marina['lon'], marina['lat']))
            # Only the mapped nearby pier is included; the enormous marina area
            # is a water/anchorage polygon and must never become a solid platform.
            ids = [109814461]
            line = LineString([xy(p['lon'], p['lat']) for p in ways[ids[0]]['geometry']])
            assert line.distance(center) < 40
            pieces.extend(solids(line.buffer(1.25, cap_style=2), h-.35, h))
            item['additionalSources'] = ['https://www.openstreetmap.org/node/4246811137']
            item['dimensionsProvenance'] = 'Marina anchor from OSM node; nearby pier centerline only, association inferred by proximity; width 2.5 m and thickness 0.35 m assumed. Full marina incomplete.'
        else:
            ids = list(range(166292802, 166292808))
            lines = [LineString([xy(p['lon'], p['lat']) for p in ways[i]['geometry']]) for i in ids]
            for line in lines:
                pieces.extend(solids(line.buffer(1, cap_style=2, join_style=2), h-.4, h))
            center = unary_union(lines).centroid
            item['dimensionsProvenance'] = 'Six mapped port pier/quay lines; visualization strips 2 m wide, not berth surfaces or complete port buildings'
        position = [center.x, center.y, h]
        item['position'] = position
        item['horizontalCorrectionM'] = Point(item['requested']['position'][:2]).distance(center)
        item['distanceToBoundaryM'] = boundary.boundary.distance(center)
        item['insideBoundary'] = boundary.covers(center)
        item['provenance'] = 'OSM horizontal geometry; user hypothetical vertical elevation; incomplete architecture'
        item['sourceUrls'] = [f'https://www.openstreetmap.org/way/{i}' for i in ids]
        item['osmWayIds'] = ids
        item['centerlines'] = centerlines
        geometry[name] = pieces
    metadata['landmarkSources'] = [dict(path=str(p.relative_to(ROOT)), sha256=hashlib.sha256(p.read_bytes()).hexdigest(),
                                       osmTimestamp=s.get('osm3s', {}).get('timestamp_osm_base')) for p, s in zip(paths, sources)]
    return geometry
