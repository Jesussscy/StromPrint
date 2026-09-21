"""Blender BVH collision atlas of the actual v6.1 model, not the old DEM.
blender -b --factory-startup --python scripts/manga/bake_rain_surfaces.py
RGBA float32: height (Y-up web), normal X, normal Z, surface (0 none,1 ground,2 roof).
"""
import bpy, json, hashlib, time, gzip
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

root = Path(__file__).resolve().parents[2]
source = root/'public/models/manga/v6.1/manga-v6.1.glb'
out = root/'public/models/manga/weather'
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
vertices, polygons, classes = [], [], []
for ob in bpy.context.scene.objects:
    category=ob.get('category','')
    if ob.type!='MESH' or category not in ('Terrain','Roads','Buildings','Details'): continue
    mesh=ob.data; mesh.calc_loop_triangles(); offset=len(vertices)
    vertices.extend([ob.matrix_world @ v.co for v in mesh.vertices])
    for tri in mesh.loop_triangles:
        polygons.append(tuple(offset+i for i in tri.vertices))
        classes.append(2 if category in ('Buildings','Details') else 1)
bvh=BVHTree.FromPolygons(vertices,polygons,all_triangles=True)
data=json.loads((root/'public/models/manga/manga.json').read_text(encoding='utf-8'))
boundary=data['boundary']; xs=[p[0] for p in boundary]; ys=[p[1] for p in boundary]
size=1024
minx,maxx,minz,maxz=min(xs),max(xs),-max(ys),-min(ys)
atlas=np.zeros((size,size,4),dtype='<f4')
t=time.time()
for row in range(size):
    z=minz+(row+.5)/size*(maxz-minz)
    for col in range(size):
        x=minx+(col+.5)/size*(maxx-minx)
        hit,normal,index,distance=bvh.ray_cast(Vector((x,-z,400)),Vector((0,0,-1)),450)
        if hit is not None:
            atlas[row,col]=(hit.z,normal.x,-normal.y,classes[index])
(out/'surfaces.bin.gz').write_bytes(gzip.compress(atlas.tobytes(),compresslevel=9))
meta=dict(size=size,bounds=[minx,minz,maxx-minx,maxz-minz],format='RGBA float32 little endian',
          sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
          groundPixels=int(np.sum(atlas[:,:,3]==1)),roofPixels=int(np.sum(atlas[:,:,3]==2)),
          maxHeight=float(atlas[:,:,0].max()),seconds=round(time.time()-t,2))
(out/'surfaces.json').write_text(json.dumps(meta,indent=2))
print('COLLISION_ATLAS',json.dumps(meta))
