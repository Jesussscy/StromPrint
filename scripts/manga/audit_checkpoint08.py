"""Run first inside Blender to decode positions; then Python to check masks."""
from pathlib import Path
import json
import hashlib
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
asset=ROOT/'public/models/manga/checkpoint08/district.glb'
dump=ROOT/'models/manga/checkpoint08/decoded-positions.npz'
try:
    import bpy
except ImportError:
    bpy=None
if bpy:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(asset))
    arrays={}
    for ob in bpy.context.scene.objects:
        if ob.type!='MESH':continue
        a=np.empty(len(ob.data.vertices)*3,dtype=np.float32);ob.data.vertices.foreach_get('co',a)
        a=a.reshape(-1,3);matrix=np.array(ob.matrix_world);a=a@matrix[:3,:3].T+matrix[:3,3]
        arrays[ob.name]=a
    np.savez_compressed(dump,**arrays)
else:
    from shapely.geometry import Polygon
    from shapely.ops import unary_union
    from shapely import contains_xy
    data=json.loads((ROOT/'public/models/manga/manga.json').read_text())
    env=json.loads((ROOT/'data/manga/environment08.json').read_text())
    boundary=Polygon(data['boundary']).buffer(.025)
    coast=unary_union([Polygon([(v[0],v[1]) for v in t]) for t in data['sea']]).union(boundary).buffer(.025)
    positions=np.load(dump);count=0
    for name,a in positions.items():
        assert np.isfinite(a).all(),name
        if name.startswith('Tree_'):continue
        allowed=coast if name.startswith('LOD_ground') else boundary
        assert contains_xy(allowed,a[:,0],a[:,1]).all(),f'{name}: outside geographic mask'
        count+=len(a)
    for t in env['trees']:
        a=positions['Tree_'+t['kind']]*t['height']/8
        angle=t['rotation'];c,s=np.cos(angle),np.sin(angle)
        xy=a[:,:2]@np.array([[c,s],[-s,c]])+t['position'][:2]
        assert contains_xy(boundary,xy[:,0],xy[:,1]).all(),'tree instance outside Manga'
    result={'status':'PASS','decodedVertices':count,'sha256':hashlib.sha256(asset.read_bytes()).hexdigest(),
        'assetBytes':asset.stat().st_size,'treeInstances':len(env['trees']),
        'maskToleranceM':.025,'sourceSha256':hashlib.sha256((ROOT/'public/models/manga/manga.json').read_bytes()).hexdigest()}
    assert result['sourceSha256']==env['sourceSha256']
    (ROOT/'docs/manga/checkpoint08-geometry-validation.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result,indent=2))
