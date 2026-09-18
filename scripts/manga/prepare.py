"""OSM -> clipped metric meshes and SRTM grid. No invented urban geometry.
Run with Python 3.13, requests, shapely, pyproj, numpy. Cached sources are immutable.
"""
import json, math, time, hashlib
from pathlib import Path
import numpy as np
from pyproj import Transformer, CRS
from shapely.geometry import Polygon, LineString, Point, shape, mapping, box
from shapely.ops import transform, triangulate, unary_union
from shapely import constrained_delaunay_triangles
from shapely.geometry.polygon import orient
from fetch_sources import fetch, RAW, ROOT

OUT=ROOT/'public/models/manga'
ORIGIN=(-75.5357,10.41145)
CRS_LOCAL=CRS.from_proj4(f'+proj=aeqd +lat_0={ORIGIN[1]} +lon_0={ORIGIN[0]} +datum=WGS84 +units=m')
forward=Transformer.from_crs(4326,CRS_LOCAL,always_xy=True).transform
inverse=Transformer.from_crs(CRS_LOCAL,4326,always_xy=True).transform
def polygons(g):
    if g.geom_type=='Polygon': return [g]
    return [p for x in getattr(g,'geoms',[]) for p in polygons(x)]
def triangles(g):
    # Constrained triangulation preserves narrow concavities and holes at the exact mask.
    return [orient(t,sign=1) for p in polygons(g) for t in constrained_delaunay_triangles(p).geoms]

def main():
    source=json.loads((RAW/'osm-boundary.json').read_text(encoding='utf8'))
    nodes={n['id']:(n['lon'],n['lat']) for n in source['elements'] if n['type']=='node'}
    way=next(e for e in source['elements'] if e['type']=='way')
    boundary_geo=Polygon([nodes[n] for n in way['nodes']])
    boundary=transform(forward,boundary_geo)
    comparison=transform(forward,shape(json.loads((RAW/'arcgis-boundary.geojson').read_text(encoding='utf8'))['features'][0]['geometry']))
    (ROOT/'data/manga/boundary.geojson').write_text(json.dumps({'type':'Feature','properties':{'source':'OSM way/1385212852','license':'ODbL 1.0'},'geometry':mapping(boundary_geo)}),encoding='utf8')
    dx=40
    x0,y0,x1,y1=boundary.bounds
    x0,y0=math.floor(x0/dx)*dx,math.floor(y0/dx)*dx
    nx,ny=math.ceil((x1-x0)/dx),math.ceil((y1-y0)/dx)
    coords=[(x0+i*dx,y0+j*dx) for j in range(ny+1) for i in range(nx+1)]
    elevation=[]
    for start in range(0,len(coords),100):
        chunk=coords[start:start+100]
        locs=[inverse(x,y) for x,y in chunk]
        params={'locations':'|'.join(f'{lat:.7f},{lon:.7f}' for lon,lat in locs),'interpolation':'bilinear'}
        name=f'srtm-{start:05}.json'
        if not (RAW/name).exists(): time.sleep(1.05)
        data=fetch(name,'https://api.opentopodata.org/v1/srtm30m',params)
        if data.get('status')!='OK': raise RuntimeError(data)
        heights=[r['elevation'] for r in data['results']]
        if any(h is None for h in heights): raise ValueError('Missing DEM: cannot fabricate terrain')
        elevation.extend(heights)
    zgrid=np.array(elevation).reshape((ny+1,nx+1))
    def height(x,y):
        fi,fj=(x-x0)/dx,(y-y0)/dx
        i,j=min(nx-1,max(0,int(fi))),min(ny-1,max(0,int(fj)))
        a,b=fi-i,fj-j
        return float(zgrid[j,i]*(1-a)*(1-b)+zgrid[j,i+1]*a*(1-b)+zgrid[j+1,i]*(1-a)*b+zgrid[j+1,i+1]*a*b)
    features=json.loads((RAW/'osm-features.json').read_text(encoding='utf8'))['elements']
    buildings=[]; roads=[]; parks=[]; coastline=[]
    for e in features:
        points=[forward(p['lon'],p['lat']) for p in e.get('geometry',[])]
        if len(points)<2: continue
        tags=e.get('tags',{})
        if 'building' in tags and len(points)>3:
            poly=Polygon(points).buffer(0).intersection(boundary)
            if poly.is_empty: continue
            try:
                h=float(tags.get('height','').replace(' m','')); method='etiquetada OSM (sin medición verificada)'
            except ValueError:
                try: h=float(tags['building:levels'])*3; method='derivada: pisos OSM × 3 m'
                except (ValueError,KeyError): h=6; method='estimada: 6 m, sin altura OSM'
            if not math.isfinite(h) or h<=0: h=6; method='estimada: etiqueta inválida'
            for part,p in enumerate(polygons(poly)):
                if p.area<2: continue
                rings=[list(p.exterior.coords)]+[list(r.coords) for r in p.interiors]
                # Flat foundation rests at highest sampled footprint point, never below terrain.
                base=max(height(x,y) for ring in rings for x,y in ring)
                buildings.append({'id':f'osm-way-{e["id"]}-{part}','name':tags.get('name',tags.get('addr:street','Edificio OSM')),'height':h,'heightMethod':method,'base':base,'rings':rings,'roofTriangles':[list(t.exterior.coords)[:3] for t in triangles(p)]})
        elif 'highway' in tags:
            width={'primary':12,'secondary':10,'tertiary':9,'residential':7,'service':4,'footway':2,'path':1.5}.get(tags['highway'],5)
            poly=LineString(points).buffer(width/2,cap_style=2,join_style=2).intersection(boundary)
            roads.append({'id':f'osm-way-{e["id"]}','name':tags.get('name',tags['highway']),'widthMethod':'ancho estimado por clase OSM','triangles':[[[x,y,height(x,y)+.12] for x,y in list(t.exterior.coords)[:3]] for t in triangles(poly)]})
        elif tags.get('natural')=='coastline':
            clipped=LineString(points).intersection(boundary.buffer(20))
            coastline.append(clipped)
        elif tags.get('leisure')=='park' or tags.get('landuse')=='grass':
            if len(points)>3:
                poly=Polygon(points).buffer(0).intersection(boundary)
                parks.extend([[[x,y,height(x,y)+.16] for x,y in list(t.exterior.coords)[:3]] for t in triangles(poly)])
    footprint=unary_union([Polygon(b['rings'][0],b['rings'][1:]) for b in buildings])
    coast=unary_union(coastline)
    cells=[]; ids={}; terrain=[]
    for j in range(ny):
        for i in range(nx):
            p=box(x0+i*dx,y0+j*dx,x0+(i+1)*dx,y0+(j+1)*dx).intersection(boundary)
            if p.area<1: continue
            c=p.centroid; idx=len(cells); ids[(i,j)]=idx
            ts=[[[round(x,3),round(y,3),round(height(x,y),3)] for x,y in list(t.exterior.coords)[:3]] for t in triangles(p)]
            terrain.extend(ts)
            cells.append({'x':round(c.x,3),'y':round(c.y,3),'z':round(height(c.x,c.y),3),'area':p.area,'built':footprint.intersection(p).area/p.area,'coastal':not coast.is_empty and coast.distance(p)<dx*.6,'triangles':ts,'ij':[i,j]})
    edges=[]
    for (i,j),a in ids.items():
        for ij in [(i+1,j),(i,j+1)]:
            if ij not in ids: continue
            b=ids[ij]
            line=LineString([(x0+(i+1)*dx,y0+j*dx),(x0+(i+1)*dx,y0+(j+1)*dx)]) if ij[0]!=i else LineString([(x0+i*dx,y0+(j+1)*dx),(x0+(i+1)*dx,y0+(j+1)*dx)])
            width=line.intersection(boundary).length
            if width>0: edges.append([a,b,width/dx])
    # Minimum water condition band only alongside mapped coast; no city outside mask.
    band=coast.buffer(20).difference(boundary) if not coast.is_empty else Polygon()
    water=[[[x,y,-.15] for x,y in list(t.exterior.coords)[:3]] for t in triangles(band)]
    def rounded(o):
        if isinstance(o,float): return round(o,4)
        if isinstance(o,list): return [rounded(x) for x in o]
        if isinstance(o,dict): return {k:rounded(v) for k,v in o.items()}
        if isinstance(o,tuple): return [rounded(x) for x in o]
        return o
    meta={'name':'Manga · Cartagena de Indias','origin':list(ORIGIN),'crs':CRS_LOCAL.to_proj4(),'units':'metres','blenderAxes':'X este, Y norte, Z altura','webAxes':'X este, Y altura, Z sur','verticalDatum':'SRTM EGM96; NO alineado a marea MSL','dem':'SRTM v3 30 m (superficie radar, febrero 2000), muestreo bilineal 40 m','cellSize':dx,'areaM2':boundary.area,'boundarySource':'https://www.openstreetmap.org/way/1385212852','comparisonIoU':boundary.intersection(comparison).area/boundary.union(comparison).area,'downloadDate':'2026-09-17','buildings':len(buildings),'roads':len(roads),'cells':len(cells),'heightRange':[min(c['z'] for c in cells),max(c['z'] for c in cells)],'sources':['© OpenStreetMap contributors · ODbL 1.0','NASA/USGS SRTM v3 via Open Topo Data'],'mode':'Exploratorio: no calibrado, no resuelve bordillos ni drenajes reales'}
    data=rounded({'metadata':meta,'boundary':list(boundary.exterior.coords),'terrain':terrain,'buildings':buildings,'roads':roads,'parks':parks,'sea':water,'grid':{'dx':dx,'cells':cells,'edges':edges}})
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'manga.json').write_text(json.dumps(data,separators=(',',':'),ensure_ascii=False),encoding='utf8')
    (ROOT/'data/manga/metadata.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False),encoding='utf8')
    print(json.dumps(meta,ensure_ascii=False,indent=2))
    print('SHA256',hashlib.sha256((OUT/'manga.json').read_bytes()).hexdigest())

if __name__=='__main__': main()
