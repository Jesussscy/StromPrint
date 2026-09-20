"""Prepare the explicit low-poly contract; never modifies the hydraulic GIS dataset.
Requires pyproj, shapely and Pillow. Run from any working directory.
"""
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw
from pyproj import Transformer
from shapely.geometry import shape, box, Point
from shapely.ops import transform
from contract_landmarks import prepare_landmarks

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/models/manga/contract'
OUT.mkdir(parents=True, exist_ok=True)
source = ROOT / 'public/models/manga/manga.json'
data = json.loads(source.read_text(encoding='utf8'))
project = Transformer.from_crs(4326, 32618, always_xy=True)
origin = project.transform(-75.5325, 10.4130)
reproject = Transformer.from_crs(data['metadata']['crs'], 32618, always_xy=True)


def xy(lon, lat):
    e, n = project.transform(lon, lat)
    return [e - origin[0], n - origin[1]]


def old_xy(p):
    e, n = reproject.transform(p[0], p[1])
    return [e - origin[0], n - origin[1]]


anchors = [(xy(-75.5260, 10.4130), .4),
           (xy(-75.5290, 10.4145), .6), (xy(-75.5340, 10.4150), 1.8)]


def height(p):
    # Hypothetical interpolation, NOT a resampled or datum-corrected SRTM DEM.
    weights = [1 / max(1e-8, math.dist(p, a) ** 2) for a, _ in anchors]
    return sum(w * a[1] for w, a in zip(weights, anchors)) / sum(weights)


def vertex(p):
    q = old_xy(p)
    return [*q, height(q)]


boundary_geo = shape(json.loads((ROOT / 'data/manga/boundary.geojson').read_text())['geometry'])
boundary = transform(lambda x, y, z=None: xy(x, y), boundary_geo)
bounds = list(boundary.bounds)
requested = transform(lambda x, y, z=None: xy(x, y), box(-75.544, 10.4035, -75.521, 10.4225))
water_bounds = [min(bounds[0], requested.bounds[0])-100, min(bounds[1], requested.bounds[1])-100,
                max(bounds[2], requested.bounds[2])+100, max(bounds[3], requested.bounds[3])+100]
terrain = [[vertex(p) for p in tri] for tri in data['terrain']]
buildings = []
for b in data['buildings']:
    rings = [[old_xy(p) for p in ring] for ring in b['rings']]
    buildings.append(dict(id=b['id'], rings=rings, height=b['height'], heightMethod=b['heightMethod'],
                          base=max(height(p) for ring in rings for p in ring),
                          roof=[[old_xy(p) for p in tri] for tri in b['roofTriangles']]))

# Left 1792 columns: geographically baked roads. Right strip: material swatches
# and a normal-map patch. One embedded image, different UV regions per material.
atlas = Image.new('RGB', (2048, 2048), (126, 148, 111))
draw = ImageDraw.Draw(atlas)


def pixel(p):
    return (4+(p[0]-bounds[0])/(bounds[2]-bounds[0])*1784,
            2043-(p[1]-bounds[1])/(bounds[3]-bounds[1])*2038)


for road in data['roads']:
    for tri in road['triangles']:
        draw.polygon([pixel(old_xy(p)) for p in tri], fill=(105, 108, 108))
draw.rectangle((1792, 0, 2047, 2047), fill=(201, 184, 157))
draw.rectangle((1792, 256, 2047, 511), fill=(161, 128, 90))
for j in range(256):
    for i in range(256):
        nx = .18 * math.cos(i / 256 * math.tau * 12)
        ny = .14 * math.cos(j / 256 * math.tau * 9 + i / 256 * math.tau * 4)
        nz = math.sqrt(1 - nx * nx - ny * ny)
        atlas.putpixel((1792+i, 1792+j), tuple(round((v*.5+.5)*255) for v in (nx, ny, nz)))
atlas.save(OUT / 'atlas.png')

specs = [
    ('Puente_Roman', 10.4182, -75.5414, 2.5),
    ('Puente_Las_Palmas', 10.4198, -75.5375, 2.2),
    ('Puente_Jimenez', 10.4190, -75.5330, 2.0),
    ('Puente_Bazurto', 10.4105, -75.5235, 1.5),
    ('Fortin_Pastelillo', 10.4178, -75.5435, 1.8),
    ('Club_Nautico_Marina', 10.4110, -75.5380, 1.2),
    ('Puerto_SPRC', 10.4060, -75.5310, 2.1),
]
metadata = dict(crs='EPSG:32618', originLonLat=[-75.5325, 10.4130], originUTM=list(origin),
                units='metres', blenderAxes='E,N,H', gltfAxes='E,H,-N',
                verticalDatum='Hypothetical MSL from user; not surveyed or linked to EGM96',
                sourceSHA256=hashlib.sha256(source.read_bytes()).hexdigest(),
                boundarySource=data['metadata']['boundarySource'], license='© OpenStreetMap contributors, ODbL 1.0',
                areaM2=boundary.area, requestedAreaM2=1350000,
                areaOutsideRequestedBboxM2=boundary.difference(requested).area,
                bounds=bounds, waterBounds=water_bounds,
                terrainMethod='Inverse-distance interpolation of three user anchors; hypothetical',
                certified=False, hydraulicSolverCompatible=False,
                landmarks=[dict(name=name, lon=lon, lat=lat, position=[*xy(lon, lat), h],
                                distanceToBoundaryM=boundary.boundary.distance(Point(xy(lon, lat))),
                                insideBoundary=boundary.covers(Point(xy(lon, lat))),
                                provenance='User specification; position, elevation and dimensions unverified')
                           for name, lat, lon, h in specs])
landmark_geometry = prepare_landmarks(metadata, xy, boundary)
all_landmark_points = [p for pieces in landmark_geometry.values() for piece in pieces for ring in piece['rings'] for p in ring]
metadata['waterBounds'] = [min(water_bounds[0], min(p[0] for p in all_landmark_points)-50),
                           min(water_bounds[1], min(p[1] for p in all_landmark_points)-50),
                           max(water_bounds[2], max(p[0] for p in all_landmark_points)+50),
                           max(water_bounds[3], max(p[1] for p in all_landmark_points)+50)]
inverse = Transformer.from_crs(32618, 4326, always_xy=True)
for item in metadata['landmarks']:
    e, n, _ = item['position']
    lon, lat = inverse.transform(e + origin[0], n + origin[1])
    item['lon'], item['lat'] = lon, lat
    assert math.dist(xy(lon, lat), [e, n]) < 1e-6
assert math.dist(xy(-75.5325, 10.4130), [0, 0]) < 1e-8
(OUT / 'metadata.json').write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding='utf8')
prepared = ROOT / 'models/manga/contract-input.json'
prepared.write_text(json.dumps(dict(metadata=metadata, terrain=terrain, buildings=buildings,
                                    landmarkGeometry=landmark_geometry)), encoding='utf8')
print(json.dumps(dict(checkpoint='15A', buildings=len(buildings), terrainTriangles=len(terrain),
                      areaM2=boundary.area, outsideBboxM2=metadata['areaOutsideRequestedBboxM2'])))
