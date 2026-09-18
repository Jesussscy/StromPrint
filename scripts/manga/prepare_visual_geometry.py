"""Build deterministic, clipped VISUAL detail. Never modifies the hydrological grid.

Sidewalk widths, markings, tree species/positions and facade detail are inferred
presentation, not surveyed infrastructure. Inputs are the frozen GIS snapshot.
"""
import hashlib
import json
import math
import random
from pathlib import Path

from pyproj import CRS, Transformer
from shapely import constrained_delaunay_triangles
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[2]


def parts(geometry):
    if geometry.geom_type == 'Polygon':
        return [geometry]
    return [p for g in getattr(geometry, 'geoms', []) for p in parts(g)]


def main():
    source = ROOT / 'public/models/manga/manga.json'
    data = json.loads(source.read_text(encoding='utf8'))
    boundary = Polygon(data['boundary'])
    footprints = unary_union([Polygon(b['rings'][0], b['rings'][1:]) for b in data['buildings']])
    cells = data['grid']['cells']
    # Match the existing piecewise-linear terrain, not a new elevation source.
    terrain = [(Polygon([(v[0], v[1]) for v in t]), t) for t in data['terrain']]
    from shapely.strtree import STRtree
    terrain_index = STRtree([p for p, _ in terrain])

    def height(x, y):
        p = Point(x, y)
        for idx in terrain_index.query(p):
            poly, t = terrain[int(idx)]
            if poly.buffer(.002).covers(p):
                (ax, ay, az), (bx, by, bz), (cx, cy, cz) = t
                den = (by-cy)*(ax-cx)+(cx-bx)*(ay-cy)
                if abs(den) < 1e-10:
                    continue
                a = ((by-cy)*(x-cx)+(cx-bx)*(y-cy))/den
                b = ((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/den
                return a*az+b*bz+(1-a-b)*cz
        return min(cells, key=lambda c: (c['x']-x)**2+(c['y']-y)**2)['z']

    def triangles(g, offset):
        result = []
        # Split at every existing terrain triangle so long roads/paint cannot
        # bridge over the sampled ground and appear to float in street cameras.
        for index in terrain_index.query(g):
            clipped=g.intersection(terrain[int(index)][0])
            for p in parts(clipped):
                for t in constrained_delaunay_triangles(p).geoms:
                    result.append([[round(x, 4), round(y, 4), round(height(x,y)+offset, 4)] for x,y in list(t.exterior.coords)[:3]])
        return result

    project = Transformer.from_crs(4326, CRS.from_user_input(data['metadata']['crs']), always_xy=True).transform
    raw = json.loads((ROOT/'data/manga/raw/osm-features.json').read_text(encoding='utf8'))['elements']
    road_buffers, sidewalk_buffers, markings = [], [], []
    road_paths = []
    widths = {'primary':12,'secondary':10,'tertiary':9,'residential':7,'service':4,'footway':2,'path':1.5}
    for element in raw:
        tags = element.get('tags', {})
        if 'highway' not in tags or len(element.get('geometry', [])) < 2:
            continue
        points = [project(p['lon'],p['lat']) for p in element['geometry']]
        line = LineString(points)
        width = widths.get(tags['highway'],5)
        clipped = line.intersection(boundary)
        if clipped.is_empty:
            continue
        road_buffers.append(line.buffer(width/2, cap_style=2, join_style=2))
        if tags['highway'] in ('primary','secondary','tertiary','residential'):
            sidewalk_buffers.append(line.buffer(width/2+1.25, cap_style=2, join_style=2))
            if line.length > 80:
                # Camera candidates use cartographic centerlines, not fabricated roads.
                for distance in [line.length*.35, line.length*.55]:
                    p, q = line.interpolate(distance), line.interpolate(min(distance+40,line.length))
                    if boundary.buffer(-70).contains(p) and p.distance(q)>15:
                        road_paths.append({'name':tags.get('name',tags['highway']), 'position':[p.x,p.y,height(p.x,p.y)], 'target':[q.x,q.y,height(q.x,q.y)]})
        if tags['highway'] in ('primary','secondary','tertiary'):
            for distance in range(8, int(line.length)-6, 12):
                a, b = line.interpolate(distance), line.interpolate(distance+4)
                if a.distance(b)>2:
                    markings.append(LineString([a,b]).buffer(.065, cap_style=2))

    roads = unary_union(road_buffers).intersection(boundary)
    sidewalks = unary_union(sidewalk_buffers).intersection(boundary).difference(roads).difference(footprints)
    paint = unary_union(markings).intersection(roads).difference(footprints)
    parks = unary_union([Polygon([(v[0],v[1]) for v in t]) for t in data['parks']])
    plantable = parks.buffer(-4).difference(footprints.buffer(4)).difference(roads.buffer(3)).intersection(boundary.buffer(-5))
    trees = []
    rng = random.Random(240916)
    if not plantable.is_empty:
        x0,y0,x1,y1 = plantable.bounds
        for ix in range(math.ceil((x1-x0)/11)):
            for iy in range(math.ceil((y1-y0)/11)):
                x,y = x0+ix*11+rng.uniform(-2,2),y0+iy*11+rng.uniform(-2,2)
                if plantable.contains(Point(x,y)):
                    trees.append({'position':[round(x,3),round(y,3),round(height(x,y),3)], 'height':round(rng.uniform(6.0,10.0),3), 'kind':'palm' if rng.random()<.55 else 'canopy', 'rotation':rng.random()*math.tau})
    # Approximate street-garden canopy in free setbacks, not inside buildings,
    # road carriageways or the port's wide paved yards. No tree survey implied.
    garden_strip=roads.buffer(18).difference(roads.buffer(4)).difference(footprints.buffer(4.5)).intersection(footprints.buffer(16)).intersection(boundary.buffer(-6)).difference(parks)
    garden_count=0
    if not garden_strip.is_empty:
        x0,y0,x1,y1=garden_strip.bounds
        for ix in range(math.ceil((x1-x0)/17)):
            for iy in range(math.ceil((y1-y0)/17)):
                x,y=x0+ix*17+rng.uniform(-3,3),y0+iy*17+rng.uniform(-3,3)
                if garden_count<550 and garden_strip.contains(Point(x,y)):
                    trees.append({'position':[round(x,3),round(y,3),round(height(x,y),3)],'height':round(rng.uniform(5.0,7.4),3),'kind':'palm' if rng.random()<.16 else 'canopy','rotation':rng.random()*math.tau,'placement':'inferred street setback, unverified'})
                    garden_count+=1
    foundations={};entrances={}
    for b in data['buildings']:
        foundations[b['id']]=[[[x,y,round(height(x,y)-.025,4)] for x,y in ring] for ring in b['rings']]
        exterior=b['rings'][0]
        candidates=[(Point((a[0]+c[0])/2,(a[1]+c[1])/2).distance(roads),i) for i,(a,c) in enumerate(zip(exterior,exterior[1:])) if math.dist(a,c)>4]
        if candidates:entrances[b['id']]=min(candidates)[1]
    result = {'schemaVersion':1, 'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(), 'note':'Only visual inferred detail: sidewalks 1.25 m, schematic markings, tropical trees inside mapped parks and clear street setbacks. No survey or drainage data.', 'roads':triangles(roads,.018),'sidewalks':triangles(sidewalks,.15), 'markings':triangles(paint,.021), 'trees':trees, 'cameraCandidates':road_paths,'foundations':foundations,'entrances':entrances}
    out = ROOT/'data/manga/visual-geometry.json'
    out.write_text(json.dumps(result,separators=(',',':'),ensure_ascii=False),encoding='utf8')
    report = {'sourceSha256':result['sourceSha256'], 'sidewalkTriangles':len(result['sidewalks']), 'markingTriangles':len(result['markings']), 'trees':len(trees), 'cameraCandidates':len(road_paths), 'outsideBoundaryAreaM2':sidewalks.difference(boundary).area+paint.difference(boundary).area, 'treeClearanceM':4, 'note':result['note']}
    assert report['outsideBoundaryAreaM2']<.001
    (ROOT/'docs/manga/visual-geometry-validation.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    print(json.dumps(report,indent=2))


if __name__=='__main__':
    main()
