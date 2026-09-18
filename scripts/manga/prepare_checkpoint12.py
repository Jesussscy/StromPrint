"""Audit frozen boundaries and prepare clipped landscape, without changing DEM."""
import hashlib
import json
import math
import random
from pathlib import Path
from pyproj import CRS, Transformer
from shapely import constrained_delaunay_triangles
from shapely.geometry import Point, Polygon, shape
from shapely.ops import unary_union, transform, nearest_points
from shapely.strtree import STRtree

ROOT=Path(__file__).resolve().parents[2]
raw=(ROOT/'public/models/manga/manga.json').read_bytes()
data=json.loads(raw)
old=json.loads((ROOT/'data/manga/environment08.json').read_text())
details=json.loads((ROOT/'data/manga/visual-geometry.json').read_text())
architecture=json.loads((ROOT/'data/manga/architecture.json').read_text())['buildings']
boundary=Polygon(data['boundary'])
assert boundary.is_valid
footprints=unary_union([Polygon(b['rings'][0],b['rings'][1:]) for b in data['buildings']])
poly=lambda ts:unary_union([Polygon([(v[0],v[1]) for v in t]) for t in ts])
roads=poly(details['roads']);sidewalks=poly(details['sidewalks'])
parks=poly(data['parks']);old_lawn=poly(old['grass'])
allowed=boundary.buffer(-.2).difference(footprints.buffer(.3)).difference(roads.buffer(.4)).difference(sidewalks)
# Selected residential setbacks, not a claim that unmapped private gardens exist.
beds=[]
for b in data['buildings']:
    c=architecture[b['id']]
    if c['profile'] not in ('caribbean','shutters','loggia') or c['seed']%3:continue
    p=Polygon(b['rings'][0],b['rings'][1:])
    beds.append(p.buffer(3.2,join_style=2).difference(p.buffer(.6,join_style=2)))
new_beds=unary_union(beds).intersection(allowed)
lawn=old_lawn.union(new_beds).union(parks).intersection(allowed)
soil=lawn.buffer(.3).difference(lawn).intersection(allowed)
terrain=[Polygon([(v[0],v[1]) for v in t]) for t in data['terrain']]
index=STRtree(terrain)
def parts(g):
    if g.geom_type=='Polygon':yield g
    else:
        for c in getattr(g,'geoms',[]):yield from parts(c)
def z_at(x,y,t):
    (ax,ay,az),(bx,by,bz),(cx,cy,cz)=t
    den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy)
    a=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/den
    b=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/den
    return a*az+b*bz+(1-a-b)*cz
def height(p):
    for i in index.query(p.buffer(.002)):
        if terrain[int(i)].buffer(.002).covers(p):return z_at(p.x,p.y,data['terrain'][int(i)])
    i=int(index.nearest(p));q=nearest_points(terrain[i],p)[0]
    if q.distance(p)>2:raise ValueError('No nearby terrain at sample')
    return z_at(q.x,q.y,data['terrain'][i]) # Display line only at tiny excluded edge slivers.
def drape(g,lift):
    ts=[]
    for piece in parts(g):
        for i in index.query(piece):
            for p in parts(piece.intersection(terrain[int(i)])):
                for t in constrained_delaunay_triangles(p).geoms:
                    if t.area>.006:ts.append([[round(x,4),round(y,4),round(z_at(x,y,data['terrain'][int(i)])+lift,4)] for x,y in list(t.exterior.coords)[:3]])
    return ts
project=Transformer.from_crs(4326,CRS.from_user_input(data['metadata']['crs']),always_xy=True).transform
mapped=[]
for e in json.loads((ROOT/'data/manga/raw/osm-features.json').read_text())['elements']:
    if e.get('tags',{}).get('leisure')!='park' or len(e.get('geometry',[]))<4:continue
    p=Polygon([project(q['lon'],q['lat']) for q in e['geometry']]).buffer(0).intersection(boundary)
    if p.area<10:continue
    q=p.representative_point()
    mapped.append({'osmId':e['id'],'name':e['tags'].get('name','Parque OSM'),'areaM2':round(p.area,2),'position':[q.x,q.y,height(q)],'source':f'https://www.openstreetmap.org/way/{e["id"]}'})
# Denser park canopy and small shrubs, clear of buildings/roads at full radius.
rng=random.Random(120926);trees=list(old['trees']);shrubs=[]
plantable=parks.intersection(allowed).buffer(-3.2)
x0,y0,x1,y1=boundary.bounds
for x in range(math.floor(x0),math.ceil(x1),9):
    for y in range(math.floor(y0),math.ceil(y1),9):
        p=Point(x+rng.uniform(-2,2),y+rng.uniform(-2,2))
        if plantable.contains(p) and all(p.distance(Point(*t['position'][:2]))>7 for t in trees):
            trees.append({'position':[p.x,p.y,height(p)],'height':rng.uniform(5.5,8.2),'kind':'canopy','rotation':rng.random()*math.tau})
shrub_space=lawn.buffer(-.8)
for p in parts(new_beds):
    if p.area<12:continue
    for distance in range(0,int(p.exterior.length),5):
        q=p.exterior.interpolate(distance)
        if shrub_space.covers(q):shrubs.append([q.x,q.y,height(q)+.19,rng.uniform(.65,1.15)])
# Draw an explicit coverage line following the frozen polygon and terrain.
perimeter=[]
ring=list(boundary.exterior.coords)
for a,b in zip(ring,ring[1:]):
    for i in range(max(1,math.ceil(math.dist(a,b)/10))):
        t=i/max(1,math.ceil(math.dist(a,b)/10));p=Point(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t)
        perimeter.append([p.x,p.y,height(p)+.25])
perimeter.append(perimeter[0])
comparison=transform(project,shape(json.loads((ROOT/'data/manga/raw/arcgis-boundary.geojson').read_text())['features'][0]['geometry']))
osm=json.loads((ROOT/'data/manga/raw/osm-boundary.json').read_text())['elements'];nodes={e['id']:(e['lon'],e['lat']) for e in osm if e['type']=='node'}
source=transform(project,Polygon([nodes[n] for n in next(e for e in osm if e['type']=='way')['nodes']]))
report={'sourceSha256':hashlib.sha256(raw).hexdigest(),'boundaryAreaM2':boundary.area,'boundarySourceDeviationM':boundary.hausdorff_distance(source),'comparisonIoU':boundary.intersection(comparison).area/boundary.union(comparison).area,'comparisonDifferenceM2':boundary.symmetric_difference(comparison).area,'oldGrassM2':old_lawn.area,'grassM2':lawn.area,'outsideM2':lawn.difference(boundary).area,'roadOverlapM2':lawn.intersection(roads).area,'buildingOverlapM2':lawn.intersection(footprints).area,'parkCount':len(mapped),'treesBefore':len(old['trees']),'treesAfter':len(trees),'shrubs':len(shrubs),'note':'OSM extent retained; ArcGIS differs, not silently substituted. Garden placement/species inferred, DEM unchanged.'}
assert report['boundarySourceDeviationM']<.01
assert max(report['outsideM2'],report['roadOverlapM2'],report['buildingOverlapM2'])<.001
out=ROOT/'public/models/manga/checkpoint12';out.mkdir(exist_ok=True)
print(json.dumps(report,indent=2),flush=True)
(ROOT/'data/manga/environment12.json').write_text(json.dumps({'grass':drape(lawn,.19),'soil':drape(soil,.185),'shrubs':shrubs,'trees':trees,'lamps':old['lamps'],'parks':mapped,'perimeter':perimeter,'sourceSha256':report['sourceSha256']},separators=(',',':')))
(out/'instances.json').write_text(json.dumps({'trees':trees,'lamps':old['lamps'],'shrubs':shrubs,'parks':mapped,'perimeter':perimeter},separators=(',',':')))
(ROOT/'docs/manga/checkpoint12-geography.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
