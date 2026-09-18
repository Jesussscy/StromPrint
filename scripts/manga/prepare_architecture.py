"""Deterministic presentation profiles, clipped to immutable OSM footprints."""
import hashlib
import json
import math
from collections import Counter
from pathlib import Path
from shapely import constrained_delaunay_triangles
from shapely.geometry import Polygon

ROOT=Path(__file__).resolve().parents[2]

def polygons(g):
    if g.geom_type=='Polygon': return [g]
    return [p for child in getattr(g,'geoms',[]) for p in polygons(child)]

def main():
    source=ROOT/'public/models/manga/manga.json'
    raw=source.read_bytes(); data=json.loads(raw)
    meta=json.loads((ROOT/'public/models/manga/visual-metadata.json').read_text(encoding='utf8'))['buildings']
    details=json.loads((ROOT/'data/manga/visual-geometry.json').read_text(encoding='utf8'))
    result={}; public={}; counts=Counter(); boundary=Polygon(data['boundary'])
    labels={'caribbean':'Vivienda caribeña aproximada','shutters':'Vivienda con persianas aproximada','loggia':'Vivienda con galería aproximada','modern':'Fachada contemporánea aproximada','warehouse':'Cubierta industrial aproximada','institution':'Edificio de uso institucional/comercial aproximado','canopy':'Cubierta abierta OSM','roman':'Casa Román · interpretación parcial de referencia histórica'}
    for b in data['buildings']:
        p=Polygon(b['rings'][0],b['rings'][1:]); m=meta[b['id']]
        seed=int(hashlib.sha256(b['id'].encode()).hexdigest()[:8],16)
        tags=m.get('tags',{}); kind=m.get('buildingType'); h=m.get('visualHeightM') or b['height']
        profile=('canopy' if kind in ('roof','tank') else 'warehouse' if kind in ('warehouse','industrial','hangar') else 'institution' if kind in ('school','church','university','hospital','commercial','retail') or tags.get('amenity') else 'modern' if h>=9 else ['caribbean','shutters','loggia','modern'][seed%4])
        if p.area>900 and profile in ('caribbean','shutters','loggia'):profile='institution'
        if b['id']=='osm-way-109811287-0':profile='roman';h=6.4
        ring=b['rings'][0]; front=details['entrances'].get(b['id'],0)
        a,c=ring[front:front+2]; length=math.dist(a,c)
        ux,uy=(c[0]-a[0])/length,(c[1]-a[1])/length
        area=sum(q[0]*r[1]-r[0]*q[1] for q,r in zip(ring,ring[1:]))
        inward=(-uy,ux) if area>0 else (uy,-ux)
        depth=2.2 if profile=='roman' else 1.05 if profile=='loggia' else .0
        if depth:
            patch=Polygon([(a[0]+ux*.12,a[1]+uy*.12),(c[0]-ux*.12,c[1]-uy*.12),(c[0]-ux*.12+inward[0]*depth,c[1]-uy*.12+inward[1]*depth),(a[0]+ux*.12+inward[0]*depth,a[1]+uy*.12+inward[1]*depth)])
            if not p.buffer(.001).covers(patch):depth=0
        # Hip roof from four planar faces of the minimum rectangle, clipped to
        # the footprint. Ridge vertices survive triangulation; no invented lots.
        rect=list(p.minimum_rotated_rectangle.exterior.coords)[:4]
        if math.dist(rect[0],rect[1])<math.dist(rect[1],rect[2]):rect=rect[1:]+rect[:1]
        origin=rect[0]; w=math.dist(rect[0],rect[1]); d=math.dist(rect[1],rect[2])
        ru=((rect[1][0]-origin[0])/w,(rect[1][1]-origin[1])/w)
        rv=((rect[3][0]-origin[0])/d,(rect[3][1]-origin[1])/d)
        rise=min(1.65,h*.24,d*.22) if profile in ('caribbean','shutters','warehouse','roman') and d>3 else 0
        eave=b['base']+h-rise
        ridge=min(d/2,w/2)
        roof=[]
        def world(x,y):return origin[0]+ru[0]*x+rv[0]*y,origin[1]+ru[1]*x+rv[1]*y
        if rise:
            planes=[[(0,0),(w,0),(w-ridge,d/2),(ridge,d/2)],[(w,0),(w,d),(w-ridge,d/2)],[(w,d),(0,d),(ridge,d/2),(w-ridge,d/2)],[(0,d),(0,0),(ridge,d/2)]]
            for face in planes:
                facepoly=Polygon([world(x,y) for x,y in face])
                for part in polygons(p.intersection(facepoly)):
                    for tri in constrained_delaunay_triangles(part).geoms:
                        vertices=[]
                        for x,y in list(tri.exterior.coords)[:3]:
                            rx=(x-origin[0])*ru[0]+(y-origin[1])*ru[1];ry=(x-origin[0])*rv[0]+(y-origin[1])*rv[1]
                            z=eave+rise*max(0,min(rx,w-rx,ry,d-ry)/max(ridge,.01))
                            vertices.append([x,y,z])
                        roof.append(vertices)
        else:roof=[[[x,y,eave] for x,y in tri] for tri in b['roofTriangles']]
        assert abs(sum(Polygon([(v[0],v[1]) for v in t]).area for t in roof)-p.area)<.05
        result[b['id']]={'profile':profile,'seed':seed,'height':h,'eave':eave,'front':front,'recess':depth,'roof':roof,'area':p.area,'boundaryClearance':p.distance(boundary.boundary)}
        info={'architectureProfile':labels[profile],'architectureConfidence':'aproximado','architectureNote':'Tipología de presentación; vanos, cubierta y acabados no levantados por inmueble.'}
        if profile=='roman':
            info.update(architectureConfidence='referencia histórica parcial',architectureSourceUrl='https://commons.wikimedia.org/wiki/File:CasaRoman.jpg',architectureNote='Arcos, columnas, pórtico y coronación interpretados de foto 2004. Distribución completa, proporciones, altura y estado actual aproximados.',visualHeightM=h,visualHeightMethod='aproximada: proporción visual de referencia histórica; 6,4 m no medidos')
        public[b['id']]=info;counts[profile]+=1
    report={'schemaVersion':1,'sourceSha256':hashlib.sha256(raw).hexdigest(),'counts':dict(counts),'buildings':result}
    (ROOT/'data/manga/architecture.json').write_text(json.dumps(report,separators=(',',':')),encoding='utf8')
    street=min(details['cameraCandidates'],key=lambda c:(c['position'][0]+130)**2+(c['position'][1]-150)**2)
    (ROOT/'public/models/manga/architecture-metadata.json').write_text(json.dumps({'schemaVersion':1,'sourceSha256':report['sourceSha256'],'buildings':public,'streetCamera':street},ensure_ascii=False,separators=(',',':')),encoding='utf8')
    print(json.dumps({'counts':dict(counts),'buildings':len(result),'sourceSha256':report['sourceSha256']},indent=2))

if __name__=='__main__':main()
