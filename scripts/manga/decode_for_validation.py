"""Decode the delivered GLB through Blender and export an audit copy.

This verifies that the installed consumer can really decode the local Draco
asset. The primary delivery stays compressed; the audit copy stays outside public.
"""
import hashlib
import json
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[2]
source=ROOT/'public/models/manga/manga.glb'
target=ROOT/'models/manga/manga-decoded-check.glb'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',export_extras=True,export_draco_mesh_compression_enable=False)
report={'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'decodedSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'decodedFile':str(target),'objects':len(bpy.context.scene.objects),'blender':bpy.app.version_string}
(ROOT/'docs/manga/decode-validation.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report,indent=2))
