"""Run in Blender with --disable-autoexec; only inspect data, never text scripts."""
import bpy, json, hashlib
from pathlib import Path

root = Path(__file__).resolve().parents[2]
out = root / 'docs/manga/rain-checkpoints/reference.json'
def value(v):
    if isinstance(v, (str, bool, int, float)): return v
    try: return list(v)
    except TypeError: return str(v)
report = {'sha256': hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),
          'source': Path(bpy.data.filepath).name, 'groups': {}, 'materials': {}}
for group in bpy.data.node_groups:
    report['groups'][group.name] = {
        'inputs': {s.name: value(s.default_value) for s in group.interface.items_tree if hasattr(s, 'default_value')},
        'nodes': [{'type': n.bl_idname, 'inputs': {s.name: value(s.default_value) for s in n.inputs if hasattr(s, 'default_value') and not s.is_linked}} for n in group.nodes]}
for mat in bpy.data.materials:
    if mat.node_tree:
        report['materials'][mat.name] = [{'type': n.bl_idname, 'inputs': {s.name: value(s.default_value) for s in n.inputs if hasattr(s, 'default_value') and not s.is_linked}} for n in mat.node_tree.nodes]
out.write_text(json.dumps(report, indent=2), encoding='utf-8')
print('Saved', out)
