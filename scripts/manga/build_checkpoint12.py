"""Supplemental Blender landscape model; preserves checkpoint08 geometry."""
import bpy, json, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
env=json.loads((ROOT/'data/manga/environment12.json').read_text())
out=ROOT/'public/models/manga/checkpoint12';out.mkdir(exist_ok=True)
scene=bpy.context.scene
col=bpy.data.collections.new('Paisajismo12_aproximado');scene.collection.children.link(col)
def mat(name,c):
    m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=.87
    return m
grass=mat('Cesped12',(.12,.24,.07));soil=mat('Tierra12',(.20,.125,.055));bark=mat('Tronco12',(.18,.10,.045))
leaves=[mat('Copa12_'+str(i),c) for i,c in enumerate([(.10,.23,.055),(.16,.29,.07),(.07,.18,.04)])]
exports=[]
for kind,m in [('grass',grass),('soil',soil)]:
    ts=env[kind];me=bpy.data.meshes.new(kind);me.from_pydata([v for t in ts for v in t],[],[(i,i+1,i+2) for i in range(0,len(ts)*3,3)]);me.update()
    ob=bpy.data.objects.new('Landscape12_'+kind,me);col.objects.link(ob);me.materials.append(m);exports.append(ob)
    old=bpy.data.objects.get('Entorno_'+kind)
    if old:old.hide_render=True
# Multi-lobed crown with an actual branching trunk instead of a single dome.
pieces=[]
def sphere(location,scale,m):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=location)
    o=bpy.context.object;o.scale=scale;o.data.materials.append(m);pieces.append(o)
def branch(a,b,r):
    d=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cone_add(vertices=7,radius1=r,radius2=r*.45,depth=d.length,location=(Vector(a)+Vector(b))*.5)
    o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(bark);pieces.append(o)
branch((0,0,0),(0,0,4.7),.18)
for i in range(5):
    a=i*math.tau/5;center=(math.cos(a)*1.25,math.sin(a)*1.25,5.4+(i%2)*.6)
    branch((0,0,3.1),center,.085);sphere(center,(1.55,1.35,1.7),leaves[i%3])
sphere((0,0,6.8),(1.7,1.5,1.2),leaves[1])
bpy.ops.object.select_all(action='DESELECT')
for o in pieces:o.select_set(True)
bpy.context.view_layer.objects.active=pieces[0];bpy.ops.object.join();tree=bpy.context.object;tree.name='Tree_canopy12'
scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR');bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
exports.append(tree)
# A shared shrub prototype is instanced in the web, not duplicated geometry.
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1)
shrub=bpy.context.object;shrub.name='Shrub12';shrub.scale=(.7,.65,.55);shrub.data.materials.append(leaves[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);exports.append(shrub)
# Export only the supplemental objects; prototype trees stay at the origin in GLB.
bpy.ops.object.select_all(action='DESELECT')
for o in exports:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'landscape.glb'),export_format='GLB',use_selection=True,export_extras=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
# Local editable scene and preview have real tree instances, not prototype clutter.
tree.hide_render=True;shrub.hide_render=True
for i,t in enumerate(env['trees']):
    if t['kind']!='canopy':continue
    old=bpy.data.objects.get('Manga_Vegetacion_'+str(i))
    if old:old.hide_render=True
    o=bpy.data.objects.new('Copa12_inferida_'+str(i),tree.data);col.objects.link(o);o.location=t['position'];o.scale=(t['height']/8,)*3;o.rotation_euler.z=t['rotation']
for i,p in enumerate(env['shrubs']):
    o=bpy.data.objects.new('Arbusto12_inferido_'+str(i),shrub.data);col.objects.link(o);o.location=(p[0],p[1],p[2]+p[3]*.5);o.scale=(p[3],)*3
scene['checkpoint12']='OSM parks; extra gardens and vegetation inferred, no DEM changes.'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models/manga/MANGA_CHECKPOINT12.blend'))
print('CHECKPOINT12', (out/'landscape.glb').stat().st_size, 'bytes',flush=True)
