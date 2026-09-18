"""blender --background --factory-startup --python scripts/manga/build_blender.py
Reads prepared metric data, creates editable scene, exports merged web GLB.
No third-party Python modules required inside Blender.
"""
import bpy, json, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
data=json.loads((ROOT/'public/models/manga/manga.json').read_text(encoding='utf8'))
if bpy.app.version[:3]!=(5,2,2): raise RuntimeError(f'Requested Blender 5.2.2, found {bpy.app.version_string}')
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):
    if c.name!='Collection': bpy.data.collections.remove(c)
scene=bpy.context.scene
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
collections={}
for name in ['Terreno','Edificios','Vias','Costa','Agua','Vegetacion','Iluminacion','Auxiliares']:
    c=bpy.data.collections.new(name);scene.collection.children.link(c);collections[name]=c
def material(name,color,roughness=.8,metallic=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bsdf=m.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(*color,1);bsdf.inputs['Roughness'].default_value=roughness;bsdf.inputs['Metallic'].default_value=metallic
    return m
mats={
    'terrain':material('Suelo mineral',(.36,.43,.39)),
    'road':material('Asfalto',(.12,.17,.19)),
    'park':material('Espacios verdes OSM',(.18,.32,.21)),
    'sea':material('Agua costera',(.025,.22,.29),.22,.3),
    'flood':material('Agua superficial exploratoria',(.02,.46,.65),.18,.2),
}
buildmats=[material('Fachada '+str(i),c) for i,c in enumerate([(.78,.77,.70),(.63,.69,.70),(.79,.70,.56),(.62,.65,.60)])]
def mesh(name,verts,faces,collection,mat):
    m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update()
    ob=bpy.data.objects.new(name,m);collections[collection].objects.link(ob);ob.data.materials.append(mat);return ob
def from_triangles(name,ts,collection,mat):
    verts=[p for t in ts for p in t];faces=[(i,i+1,i+2) for i in range(0,len(verts),3)]
    return mesh(name,verts,faces,collection,mat)
terrain=from_triangles('Manga_Terreno_SRTM',data['terrain'],'Terreno',mats['terrain'])
terrain['source']=data['metadata']['dem'];terrain['vertical_datum']='EGM96';terrain['not_surveyed']=True
from_triangles('Manga_Vias_OSM',[t for r in data['roads'] for t in r['triangles']],'Vias',mats['road'])
from_triangles('Manga_Parques_OSM',data['parks'],'Vegetacion',mats['park'])
from_triangles('Manga_Franja_Costera_20m',data['sea'],'Costa',mats['sea'])
for index,b in enumerate(data['buildings']):
    verts=[];faces=[];top=b['base']+b['height']
    for ring in b['rings']:
        for a,c in zip(ring,ring[1:]):
            k=len(verts);verts.extend([(a[0],a[1],b['base']),(c[0],c[1],b['base']),(c[0],c[1],top),(a[0],a[1],top)]);faces.append((k,k+1,k+2,k+3))
    for t in b['roofTriangles']:
        k=len(verts);verts.extend([(x,y,top) for x,y in t]);faces.append((k,k+1,k+2))
    ob=mesh(b['id'],verts,faces,'Edificios',buildmats[index%len(buildmats)])
    ob['osm_id']=b['id'];ob['name_osm']=b['name'];ob['height_m']=b['height'];ob['height_method']=b['heightMethod'];ob['source']='OpenStreetMap contributors · ODbL 1.0'

# Web export merges copies by material. Editable Blender building objects remain separate.
export_objects=[]
for key in ['Terreno','Vias','Vegetacion','Costa']:
    export_objects.extend(collections[key].objects)
for mat in buildmats:
    copies=[]
    for ob in list(collections['Edificios'].objects):
        if ob.data.materials[0]==mat:
            cp=ob.copy();cp.data=ob.data.copy();collections['Auxiliares'].objects.link(cp);copies.append(cp)
    if not copies: continue
    bpy.ops.object.select_all(action='DESELECT')
    for cp in copies: cp.select_set(True)
    bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join()
    combined=bpy.context.object;combined.name='Manga_Edificios_'+mat.name;combined['selection']='Lookup original OSM footprint in manga.json';export_objects.append(combined)
bpy.ops.object.select_all(action='DESELECT')
for ob in export_objects: ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/manga/manga.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True)
for ob in list(collections['Auxiliares'].objects): bpy.data.objects.remove(ob,do_unlink=True)

# Hydrological demo snapshots are produced by the same TypeScript solver as the web.
demo_path=ROOT/'data/manga/water-demo.json'
if demo_path.exists():
    demo=json.loads(demo_path.read_text(encoding='utf8'))
    ts=data['terrain'];verts=[(x,y,z+.02) for t in ts for x,y,z in t]
    ob=mesh('Agua_DEMO_lluvia_120mm_h',verts,[(i,i+1,i+2) for i in range(0,len(verts),3)],'Agua',mats['flood'])
    ob.shape_key_add(name='Base')
    for k,snapshot in enumerate(demo['snapshots']):
        key=ob.shape_key_add(name=f'Agua_{snapshot["seconds"]/3600:.1f}h');n=0
        for ci,c in enumerate(data['grid']['cells']):
            for t in c['triangles']:
                for x,y,z in t:
                    key.data[n].co.z=z+snapshot['depth'][ci]+.02;n+=1
        key.value=0;key.keyframe_insert('value',frame=max(1,k*60))
        key.value=1;key.keyframe_insert('value',frame=(k+1)*60)
        key.value=0;key.keyframe_insert('value',frame=(k+2)*60)
    ob['note']='Demo con profundidad media por celda sobre relieve. No Mantaflow. Reproducir frames 1–240; modelo no calibrado.'
    # Hide dry sheet initially; web water is generated per wet cell with its own shader.
    ob.hide_render=True;ob.keyframe_insert('hide_render',frame=1);ob.hide_render=False;ob.keyframe_insert('hide_render',frame=2)
    scene.frame_end=240
controls=bpy.data.objects.new('CONTROLES_LEER_PROPIEDADES',None);collections['Auxiliares'].objects.link(controls)
controls['lluvia_mm_h']=120.0;controls['duracion_h']=4.0;controls['infiltracion_mm_h']=2.0;controls['drenaje_mm_h']=3.0
controls['recalcular']='Editar escenario en scripts/manga/validate.cjs; ejecutar node y volver a generar Blender. Propiedades informativas, no cambian solver automáticamente.'
controls['marea']='No se suma MSL a EGM96 sin transformación vertical. Escenario de marea es hipotético.'
controls['rain_demo']='Gotas animadas decorativas; volumen independiente.'
# Deterministic visual rain inside the boundary sampled from existing cells.
rainverts=[];rainfaces=[]
for i in range(0,len(data['grid']['cells']),5):
    c=data['grid']['cells'][i];x,y=c['x'],c['y'];z=35+(i*31%170);n=len(rainverts)
    rainverts.extend([(x,y,z),(x+.35,y,z),(x+3,y,z+10)]);rainfaces.append((n,n+1,n+2))
rain=mesh('Lluvia_visual_NO_volumen',rainverts,rainfaces,'Agua',mats['flood'])
rain.location.z=0;rain.keyframe_insert('location',frame=1);rain.location.z=-180;rain.keyframe_insert('location',frame=60)
if rain.animation_data and rain.animation_data.action:
    for layer in rain.animation_data.action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    for kp in fc.keyframe_points: kp.interpolation='LINEAR'
                    fc.modifiers.new('CYCLES')
sun_data=bpy.data.lights.new('Sol','SUN');sun_data.energy=3;sun_data.angle=.15
sun=bpy.data.objects.new('Sol',sun_data);collections['Iluminacion'].objects.link(sun);sun.rotation_euler=(math.radians(30),math.radians(-25),math.radians(-25))
scene.world.color=(.23,.3,.36)
cam_data=bpy.data.cameras.new('Camara_Manga');cam=bpy.data.objects.new('Camara_Manga',cam_data);collections['Iluminacion'].objects.link(cam)
cam.location=(1800,-2200,2200);direction=Vector((0,0,0))-cam.location;cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=3200;cam.data.clip_end=10000;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.resolution_x=1440;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene['metadata']=json.dumps(data['metadata'],ensure_ascii=False)
text=bpy.data.texts.new('LEEME_STORMPRINT');text.write('Manga, Cartagena. 1 unidad = 1 metro. X este, Y norte, Z EGM96.\nAlturas OSM etiquetadas, derivadas o estimadas en cada edificio.\nEl agua es exploratoria: SRTM no representa drenajes ni bordillos.\nVer docs/manga/README.md. Web: X este, Y altura, Z sur; GLB hace esa conversión.\nGotas decorativas independientes del balance de agua.\n')
scene.frame_set(1)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_distance=3000;area.spaces.active.clip_end=10000
out=ROOT/'models/manga/MANGA_STORMPRINT_FINAL.blend';out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out))
scene.render.filepath=str(ROOT/'models/manga/preview.png')
if '--render-preview' in __import__('sys').argv: bpy.ops.render.render(write_still=True)
print('STORMPRINT_MODEL_COMPLETE',bpy.app.version_string,len(data['buildings']),len(data['grid']['cells']))
