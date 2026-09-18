"""Visual landscape draped on immutable terrain. No surveyed microtopography."""
import hashlib
import json
from pathlib import Path
from shapely import constrained_delaunay_triangles
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[2]
raw = (ROOT/'public/models/manga/manga.json').read_bytes()
data = json.loads(raw)
detail = json.loads((ROOT/'data/manga/visual-geometry.json').read_text())
boundary = Polygon(data['boundary'])
buildings = unary_union([Polygon(b['rings'][0], b['rings'][1:]) for b in data['buildings']])
roads = unary_union([Polygon([(v[0], v[1]) for v in t]) for t in detail['roads']])
sidewalks = unary_union([Polygon([(v[0], v[1]) for v in t]) for t in detail['sidewalks']])
parks = unary_union([Polygon([(v[0], v[1]) for v in t]) for t in data['parks']])
# Garden islands around existing inferred tree locations; no lawns on port yards.
gardens = unary_union([Point(*t['position'][:2]).buffer(3.8, quad_segs=5) for t in detail['trees']])
allowed = boundary.buffer(-.12).difference(buildings.buffer(.18)).difference(roads.buffer(.25)).difference(sidewalks)
lawn = parks.union(gardens).intersection(allowed)
soil = lawn.buffer(.45).difference(lawn).intersection(allowed)
terrain = [Polygon([(v[0], v[1]) for v in t]) for t in data['terrain']]
index = STRtree(terrain)

def parts(g):
    if g.geom_type == 'Polygon':
        yield g
    else:
        for child in getattr(g, 'geoms', []):
            yield from parts(child)

def z_at(x, y, t):
    (ax, ay, az), (bx, by, bz), (cx, cy, cz) = t
    den = (by-cy)*(ax-cx)+(cx-bx)*(ay-cy)
    a = ((by-cy)*(x-cx)+(cx-bx)*(y-cy))/den
    b = ((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/den
    return a*az+b*bz+(1-a-b)*cz

def drape(shape, lift):
    out = []
    for i in index.query(shape):
        for p in parts(shape.intersection(terrain[int(i)])):
            for triangle in constrained_delaunay_triangles(p).geoms:
                if triangle.area < .005:
                    continue
                out.append([[round(x,4), round(y,4), round(z_at(x,y,data['terrain'][int(i)])+lift,4)]
                            for x,y in list(triangle.exterior.coords)[:3]])
    return out

# A sparse set of lamp positions on the existing inferred sidewalk; locally
# checked clear of footprints and roads. Position/spacing are not a survey.
lamps=[]
for p in parts(sidewalks):
    if p.area < 15:
        continue
    q=p.representative_point()
    if any(q.distance(Point(*v[:2])) < 55 for v in lamps):
        continue
    if not boundary.buffer(-2).contains(q) or buildings.distance(q)<1:
        continue
    for i in index.query(q):
        if terrain[int(i)].covers(q):
            lamps.append([q.x,q.y,z_at(q.x,q.y,data['terrain'][int(i)])+.15])
            break
    if len(lamps)>=100:
        break

result={'sourceSha256':hashlib.sha256(raw).hexdigest(), 'grass':drape(lawn,.028),
        'soil':drape(soil,.027), 'lamps':lamps, 'trees':detail['trees'],
        'note':'Grass/garden edging and street lights are inferred visual detail. Terrain elevations and hydrology unchanged.'}
assert lawn.difference(boundary).area < .001
assert lawn.intersection(buildings).area < .001
assert lawn.intersection(roads).area < .001
(ROOT/'data/manga/environment08.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf8')
report={'sourceSha256':result['sourceSha256'],'grassAreaM2':lawn.area,'grassTriangles':len(result['grass']),
        'soilTriangles':len(result['soil']),'lamps':len(lamps),'outsideM2':lawn.difference(boundary).area,
        'buildingOverlapM2':lawn.intersection(buildings).area,'roadOverlapM2':lawn.intersection(roads).area,
        'terrainLiftM':.028,'note':result['note']}
(ROOT/'docs/manga/environment08-validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
