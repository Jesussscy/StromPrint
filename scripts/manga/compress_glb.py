"""Local Draco export, with an uncompressed audit asset and bundled decoder.

blender --background --factory-startup --python scripts/manga/compress_glb.py
Run after build_realistic.py. Retains submillimeter position quantization and
uses only the installed Blender exporter and the project's Three.js decoder.
"""
import hashlib
import json
import shutil
import sys
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[2]
target=ROOT/'public/models/manga/manga.glb'
audit=ROOT/'models/manga/manga-uncompressed.glb'
raw=target.read_bytes()
header_length=int.from_bytes(raw[12:16],'little')
header=json.loads(raw[20:20+header_length])
if 'KHR_draco_mesh_compression' in header.get('extensionsRequired',[]):
    if '--from-audit' not in sys.argv:raise RuntimeError('Already compressed; rebuild or explicitly use --from-audit.')
    raw=audit.read_bytes()
else:shutil.copy2(target,audit)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(audit))
lod=[]
for obj in list(bpy.context.scene.objects):
    if obj.type!='MESH' or not any(key in obj.name for key in ('Carpinteria','Madera_persiana')):continue
    bpy.context.view_layer.objects.active=obj
    before=sum(len(p.vertices)-2 for p in obj.data.polygons)
    modifier=obj.modifiers.new('Detalle_web_simplificado','DECIMATE');modifier.ratio=.50
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    after=sum(len(p.vertices)-2 for p in obj.data.polygons)
    lod.append({'mesh':obj.name,'before':before,'after':after})
bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',export_extras=True,
    export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,
    export_draco_position_quantization=20,export_draco_normal_quantization=10,
    export_draco_texcoord_quantization=16)
decoder=ROOT/'public/models/manga/draco'
decoder.mkdir(exist_ok=True)
for name in ('draco_decoder.js','draco_wasm_wrapper.js','draco_decoder.wasm'):
    shutil.copy2(ROOT/'node_modules/three/examples/jsm/libs/draco/gltf'/name,decoder/name)
shutil.copy2(ROOT/'node_modules/three/LICENSE',decoder/'THREE-LICENSE.txt')
report={'uncompressedBytes':len(raw),'compressedBytes':target.stat().st_size,
        'ratio':round(target.stat().st_size/len(raw),4),'positionQuantizationBits':20,'webDetailSimplification':lod,
        'uncompressedSha256':hashlib.sha256(raw).hexdigest(),'compressedSha256':hashlib.sha256(target.read_bytes()).hexdigest(),
        'decoder':'Bundled locally from installed Three.js, no CDN requests','blender':bpy.app.version_string}
(ROOT/'docs/manga/compression-validation.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report,indent=2))
