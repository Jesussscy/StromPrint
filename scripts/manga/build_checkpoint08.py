"""Extend checkpoint07, export spatial LODs and shared tree prototypes locally."""
import bpy
import json
import math
import hashlib
from collections import defaultdict
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
data=json.loads((ROOT/'public/models/manga/manga.json').read_text())
cfg=json.loads((ROOT/'data/manga/architecture.json').read_text())['buildings']
env=json.loads((ROOT/'data/manga/environment08.json').read_text())
assert env['sourceSha256']==hashlib.sha256((ROOT/'public/models/manga/manga.json').read_bytes()).hexdigest()
scene=bpy.context.scene
out=ROOT/'public/models/manga/checkpoint08'
out.mkdir(exist_ok=True)

def mat(name,color,rough=.85):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough
    return m

grass=mat('Pasto_costero',(.17,.255,.075));soil=mat('Tierra_jardin',(.25,.16,.075))
for material,scale in [(grass,7),(soil,12)]:
    nodes=material.node_tree.nodes;links=material.node_tree.links;p=nodes.get('Principled BSDF')
    coord=nodes.new('ShaderNodeTexCoord');noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=scale
    ramp=nodes.new('ShaderNodeValToRGB');base=material.diffuse_color
    ramp.color_ramp.elements[0].color=tuple(c*.58 for c in base[:3])+(1,)
    ramp.color_ramp.elements[1].color=tuple(min(1,c*1.35) for c in base[:3])+(1,)
    links.new(coord.outputs['Generated'],noise.inputs['Vector']);links.new(noise.outputs['Fac'],ramp.inputs[0]);links.new(ramp.outputs[0],p.inputs['Base Color'])
trim=mat('Piedra_borde',(.43,.40,.31));metal=mat('Metal_urbano',(.09,.115,.12),.55)
lampmat=mat('Luminaria',(.9,.75,.4),.4)
lampmat.node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value=(1,.65,.25,1)
lampmat.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=1.5
collection=bpy.data.collections.new('Entorno08');scene.collection.children.link(collection)

def mesh(name,vs,fs,materials,mi=None,colors=None,col=collection):
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update()
    ob=bpy.data.objects.new(name,me);col.objects.link(ob)
    for m in materials:me.materials.append(m)
    if mi:
        for p,i in zip(me.polygons,mi):p.material_index=i
    if colors:
        attr=me.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
        for p,c in zip(me.polygons,colors):
            for li in p.loop_indices:attr.data[li].color=(*c[:3],1)
    return ob

for kind,m in [('grass',grass),('soil',soil)]:
    ts=env[kind];mesh('Entorno_'+kind,[v for t in ts for v in t],[(i,i+1,i+2) for i in range(0,len(ts)*3,3)],[m])
# Local Blender lights remain linked instances. The web uses instancing too.
def cube_parts(vs,fs,mi,center,size,index):
    k=len(vs);x,y,z=center;a,b,c=[s/2 for s in size]
    vs.extend([(x+dx,y+dy,z+dz) for dz in (-c,c) for dy in (-b,b) for dx in (-a,a)])
    fs.extend([tuple(k+i for i in ids) for ids in [(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)] ]);mi.extend([index]*6)
vs=[];fs=[];mi=[]
cube_parts(vs,fs,mi,(0,0,2.5),(.12,.12,5),0)
cube_parts(vs,fs,mi,(.45,0,5),(1,.12,.12),0)
cube_parts(vs,fs,mi,(.8,0,4.92),(.65,.3,.08),1)
proto=mesh('Poste_prototipo',vs,fs,[metal,lampmat],mi)
for i,pos in enumerate(env['lamps']):
    ob=bpy.data.objects.new(f'Poste_inferido_{i}',proto.data);collection.objects.link(ob);ob.location=pos
    ob['provenance']='inferred sidewalk lamp, not surveyed'
bpy.data.objects.remove(proto,do_unlink=True)

# Add awnings at suitable real building fronts, staying within mapped envelopes.
# They are visual variants, never a claim about a particular house's facade.
details=json.loads((ROOT/'data/manga/visual-geometry.json').read_text())
awnings=0
for b in data['buildings']:
    c=cfg[b['id']]
    if c['profile'] not in ('caribbean','shutters','loggia') or c['boundaryClearance']<2:continue
    if c['seed']%3:continue
    ring=b['rings'][0];a,d=ring[c['front']:c['front']+2];length=math.dist(a,d)
    if length<5:continue
    u=Vector(((d[0]-a[0])/length,(d[1]-a[1])/length,0));area=sum(p[0]*q[1]-q[0]*p[1] for p,q in zip(ring,ring[1:]))
    n=Vector((-u.y,u.x,0))*(1 if area>0 else -1)
    center=Vector((a[0],a[1],b['base']+2.6))+u*(length*.5)
    vs=[];fs=[];colors=[]
    for j in range(8):
        x0=-1.35+j*.3375;x1=x0+.3375;k=len(vs)
        vs.extend([center+u*x+n*y+Vector((0,0,z)) for x,y,z in [(x0,.03,-.23),(x1,.03,-.23),(x1,.85,0),(x0,.85,0)]])
        fs.append((k,k+1,k+2,k+3));colors.append((.65,.50,.30) if j%2 else (.2,.29,.25))
    ob=mesh('Toldo_'+b['id'],vs,fs,[trim],colors=colors);ob['building_id']=b['id'];awnings+=1

# Neutral daylight makes relief/materials readable. Separate evening/night shots.
sun=bpy.data.objects.get('Sol');sun.data.energy=2.6;sun.data.color=(1,.94,.82)
sun.rotation_euler=(math.radians(36),math.radians(-12),math.radians(-35));sun.data.angle=math.radians(5)
world=scene.world.node_tree
for node in world.nodes:
    if node.type=='BACKGROUND':node.inputs['Strength'].default_value=.18
    if node.type=='TEX_SKY':node.sun_elevation=math.radians(48)
scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.1
def camera(name,pos,target,lens=35):
    ca=bpy.data.cameras.new(name);ca.lens=lens
    ob=bpy.data.objects.new(name,ca);scene.collection.objects.link(ob);ob.location=pos
    ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
    return ob
tree=min(env['trees'],key=lambda t:sum(v*v for v in t['position'][:2]));x,y,z=tree['position']
camera('Jardin_Manga',(x+22,y-28,z+12),(x,y,z+2),34)
for name in ('Atardecer_Manga','Noche_Manga'):
    original=bpy.data.objects['Urbana_Manga'];ob=original.copy();ob.data=original.data.copy();ob.name=name;scene.collection.objects.link(ob)
scene['checkpoint08_note']=env['note']
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models/manga/MANGA_CHECKPOINT08.blend'))

# Export static geometry in 240 m cells. Each cell has base, close details and
# a closed coarse envelope. Trees are exported once as shared prototypes.
vertexmat=mat('Vertex_surface',(1,1,1));p=vertexmat.node_tree.nodes.get('Principled BSDF')
attr=vertexmat.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='Color';vertexmat.node_tree.links.new(attr.outputs['Color'],p.inputs['Base Color'])
buckets=defaultdict(lambda:[[],[],[]]);tile=240
def add(key,points,color):
    vs,fs,cs=buckets[key];k=len(vs);vs.extend(points);fs.append(tuple(range(k,k+len(points))));cs.append(color)
def tile_of(points):
    return (math.floor(sum(v[0] for v in points)/len(points)/tile),math.floor(sum(v[1] for v in points)/len(points)/tile))
def color_of(material):
    return tuple(material.diffuse_color[:3])
building_index={b['id']:b for b in data['buildings']}
for colname in ['Terreno','Vias','Costa','Edificios','Entorno08']:
    col=bpy.data.collections[colname]
    for ob in list(col.objects):
        if ob.type!='MESH' or ob.name.startswith('Poste_'):continue
        b=building_index.get(ob.name) or building_index.get(ob.get('building_id',''))
        building_tile=tile_of([(x,y,0) for x,y in b['rings'][0]]) if b else None
        for face in ob.data.polygons:
            points=[ob.matrix_world@ob.data.vertices[v].co for v in face.vertices]
            material=ob.data.materials[face.material_index];name=material.name
            if b:
                lod='detail' if any(s in name for s in ('Carpinteria','Madera_persiana','Piedra_borde')) else 'base'
                tx,ty=building_tile;key=(lod,tx,ty)
            else:
                tx,ty=tile_of(points)
                kind='grass' if ob.name=='Entorno_grass' else 'soil' if ob.name=='Entorno_soil' else 'ground'
                key=(kind,tx,ty)
            color=color_of(material)
            if ob.name.startswith('Toldo_') and ob.data.color_attributes:
                color=tuple(ob.data.color_attributes.active_color.data[face.loop_start].color[:3])
            # Correct winding of ground facets exported from arbitrary GIS rings.
            if not b and face.normal.z < 0:points.reverse()
            add(key,points,color)
for b in data['buildings']:
    c=cfg[b['id']];tx,ty=tile_of([(x,y,0) for x,y in b['rings'][0]]);key=('far',tx,ty)
    ob=bpy.data.objects.get(b['id']);color=color_of(ob.data.materials[c['seed']%min(6,len(ob.data.materials))]) if ob and ob.data.materials else (.6,.58,.5)
    for ring in b['rings']:
        for a,d in zip(ring,ring[1:]):
            add(key,[(a[0],a[1],b['base']),(d[0],d[1],b['base']),(d[0],d[1],c['eave']),(a[0],a[1],c['eave'])],color)
    for t in c['roof']:add(key,t,(.33,.21,.13) if c['profile'] in ('caribbean','shutters','roman') else (.5,.48,.43))
exports=[];stats=defaultdict(int)
for (lod,tx,ty),(vs,fs,cs) in buckets.items():
    ob=mesh(f'LOD_{lod}_{tx}_{ty}',vs,fs,[vertexmat],colors=cs)
    ob['lod']=lod;ob['tile_x']=tx;ob['tile_y']=ty;ob['tile_size']=tile
    stats[lod]+=sum(len(f)-2 for f in fs);exports.append(ob)
# Shared tree geometry, one prototype per species, transforms supplied separately.
tree_meshes={}
for t,ob in zip(env['trees'],[o for o in bpy.data.collections['Vegetacion'].objects if o.name.startswith('Manga_Vegetacion_')]):
    tree_meshes.setdefault(t['kind'],ob.data)
for kind,me in tree_meshes.items():
    vs=[tuple(v.co) for v in me.vertices];fs=[tuple(p.vertices) for p in me.polygons];colors=[color_of(me.materials[p.material_index]) for p in me.polygons]
    ob=mesh('Tree_'+kind,vs,fs,[vertexmat],colors=colors);exports.append(ob)
bpy.ops.object.select_all(action='DESELECT')
for ob in exports:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'district.glb'),export_format='GLB',use_selection=True,
    export_extras=True,export_normals=True,export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,export_draco_position_quantization=18,
    export_draco_normal_quantization=12,export_draco_color_quantization=8)
(out/'instances.json').write_text(json.dumps({'trees':env['trees'],'lamps':env['lamps'],'note':env['note']},separators=(',',':')))
report={'tiles':len(set((k[1],k[2]) for k in buckets)), 'meshes':len(exports),'trianglesByLevel':dict(stats),
    'bytes':(out/'district.glb').stat().st_size,'awnings':awnings,'grassTriangles':len(env['grass']),
    'treeInstances':len(env['trees']),'lampInstances':len(env['lamps']),'sourceSha256':env['sourceSha256'],
    'note':'Vertex color surfaces avoid texture roundtrip artifacts; fine detail only in nearby tiles. Original .blend retains editable geometry and materials.'}
(ROOT/'docs/manga/checkpoint08-build.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2),flush=True)
