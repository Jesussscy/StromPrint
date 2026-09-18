"""Fail if generated urban meshes escape Manga; check scale, coverage and GLB."""
import json, struct, hashlib
import numpy as np
from shapely import contains_xy
from pathlib import Path
from shapely.geometry import Polygon
ROOT=Path(__file__).resolve().parents[2]
data=json.loads((ROOT/'public/models/manga/manga.json').read_text(encoding='utf8'))
boundary=Polygon(data['boundary'])
area=0
for tri in data['terrain']:
    p=Polygon([(v[0],v[1]) for v in tri]);area+=p.area
    assert boundary.buffer(.02).covers(p),'terrain outside Manga'
for b in data['buildings']:
    p=Polygon(b['rings'][0],b['rings'][1:]);assert boundary.buffer(.02).covers(p),'building outside Manga'
    roof=sum(Polygon(t).area for t in b['roofTriangles'])
    assert abs(roof-p.area)<.1,'missing roof'
for r in data['roads']:
    for t in r['triangles']:assert boundary.buffer(.02).covers(Polygon([(v[0],v[1]) for v in t])),'road outside Manga'
assert area/boundary.area>.9999
delivery=(ROOT/'public/models/manga/manga.glb').read_bytes()
header_size=struct.unpack_from('<I',delivery,12)[0]
delivery_header=json.loads(delivery[20:20+header_size])
compressed='KHR_draco_mesh_compression' in delivery_header.get('extensionsRequired',[])
if compressed:
    decode=json.loads((ROOT/'docs/manga/decode-validation.json').read_text(encoding='utf8'))
    glb=(ROOT/'models/manga/manga-decoded-check.glb').read_bytes()
    assert decode['sourceSha256']==hashlib.sha256(delivery).hexdigest(),'decoded audit is stale'
    assert decode['decodedSha256']==hashlib.sha256(glb).hexdigest(),'decoded audit changed'
else:glb=delivery
magic,version,length=struct.unpack_from('<III',glb)
assert magic==0x46546c67 and version==2 and length==len(glb)
n,kind=struct.unpack_from('<II',glb,12);gltf=json.loads(glb[20:20+n])
assert len(gltf['meshes'])<=32,'material draw-call budget exceeded'
# Blender's decode/re-export splits vertices at restored normals/UV seams.
# This audit copy is not downloaded by the browser.
# Checkpoint07 adds open galleries, pitched roofs and 3D facade frames. The
# browser transfer cap is 24 MiB; decoded audit/working data may use 192 MiB.
# Triangle/draw-call caps remain 2M / 32. Browser FPS is measured separately.
assert len(glb)<=192*1024*1024,'uncompressed geometry budget exceeded'
if compressed:assert len(delivery)<=24*1024*1024,'compressed transfer budget exceeded'
binary_start=20+n+8
binary=memoryview(glb)[binary_start:]
def accessor(index):
    a=gltf['accessors'][index];v=gltf['bufferViews'][a['bufferView']]
    dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]
    components={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
    stride=v.get('byteStride',np.dtype(dtype).itemsize*components)
    array=np.ndarray((a['count'],components),dtype=dtype,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(stride,np.dtype(dtype).itemsize))
    assert np.isfinite(array).all(),'nonfinite exported attribute'
    return array
def matrix(node):
    if 'matrix' in node:return np.array(node['matrix']).reshape(4,4).T
    x,y,z,w=node.get('rotation',[0,0,0,1])
    rotation=np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],[2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],[2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]])
    m=np.eye(4);m[:3,:3]=rotation@np.diag(node.get('scale',[1,1,1]));m[:3,3]=node.get('translation',[0,0,0]);return m
worlds={}
def walk(index,parent):
    node=gltf['nodes'][index];worlds[index]=parent@matrix(node)
    for child in node.get('children',[]):walk(child,worlds[index])
for index in gltf['scenes'][gltf.get('scene',0)]['nodes']:walk(index,np.eye(4))
total_triangles=0;export_checks=[]
for index,world in worlds.items():
    node=gltf['nodes'][index]
    if 'mesh' not in node:continue
    mesh=gltf['meshes'][node['mesh']];name=node.get('name',mesh.get('name',''))
    for primitive in mesh['primitives']:
        assert primitive.get('mode',4)==4,'export must contain triangles'
        pos=accessor(primitive['attributes']['POSITION'])
        world_pos=pos@world[:3,:3].T+world[:3,3]
        # glTF/Three: X east, Y up, Z south; GIS polygon X east, Y north.
        allowed=boundary.buffer(.025)
        if name.startswith('Manga_Costa'):
            from shapely.ops import unary_union
            allowed=unary_union([Polygon([(v[0],v[1]) for v in t]) for t in data['sea']]).buffer(.025)
        valid=contains_xy(allowed,world_pos[:,0],-world_pos[:,2])
        assert valid.all(),f'{name}: {(~valid).sum()} exported vertices outside geographic mask'
        indices=accessor(primitive['indices']).ravel() if 'indices' in primitive else np.arange(len(pos))
        assert len(indices)%3==0 and (not len(indices) or indices.max()<len(pos)),'invalid triangle indices'
        total_triangles+=len(indices)//3
        for attribute in ('NORMAL','TEXCOORD_0'):
            if attribute in primitive['attributes']:assert len(accessor(primitive['attributes'][attribute]))==len(pos)
        export_checks.append({'mesh':name,'vertices':len(pos),'triangles':len(indices)//3,'geographicMask':'coast band' if name.startswith('Manga_Costa') else 'Manga'})
assert total_triangles<=2_000_000,'triangle budget exceeded'
sha=hashlib.sha256((ROOT/'public/models/manga/manga.json').read_bytes()).hexdigest()
visual=ROOT/'data/manga/visual-geometry.json'
if visual.exists():assert json.loads(visual.read_text(encoding='utf8'))['sourceSha256']==sha,'visual/GIS snapshot mismatch'
report={'areaM2':boundary.area,'terrainCoverageRatio':area/boundary.area,'buildings':len(data['buildings']),'roads':len(data['roads']),'glbBytes':len(delivery),'decodedBytes':len(glb),'dracoDecodedByBlender':compressed,'glbMeshes':len(gltf['meshes']),'exportedTriangles':total_triangles,'geometrySha256':sha,'exportedMeshes':export_checks,'checks':'Source GIS triangles inside boundary, roof coverage, GLB v2; actual exported world-space vertices within Manga / source coastal band (2.5 cm tolerance), finite attributes, valid indices, 32 meshes / 24 MiB transfer / 192 MiB decoded / 2M triangle budget.'}
(ROOT/'docs/manga/geometry-validation.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report,indent=2))
