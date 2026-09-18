"""Rebuild the frozen Manga GIS model and add documented presentation detail.

Run prepare_visual_geometry.py and prepare_visual_metadata.py first, then:
blender --background --factory-startup --python scripts/manga/build_realistic.py
The editable checkpoint 04 is kept separately. No physics or GIS input is edited.
"""
import hashlib
import json
import math
import random
import runpy
import sys
import time
from collections import defaultdict
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
START = time.perf_counter()
if bpy.app.version[:3] != (5, 2, 2):
    raise RuntimeError(f'Expected installed Blender 5.2.2; found {bpy.app.version_string}')
data_path = ROOT/'public/models/manga/manga.json'
data = json.loads(data_path.read_text(encoding='utf8'))
details = json.loads((ROOT/'data/manga/visual-geometry.json').read_text(encoding='utf8'))
if details['sourceSha256'] != hashlib.sha256(data_path.read_bytes()).hexdigest():
    raise RuntimeError('Visual detail and frozen GIS snapshot do not match')
metadata_path = ROOT/'public/models/manga/visual-metadata.json'
metadata = json.loads(metadata_path.read_text(encoding='utf8')).get('buildings', {}) if metadata_path.exists() else {}

# The original builder is deliberately kept reproducible; begin with a clean base.
original_argv = sys.argv[:]
sys.argv = [arg for arg in sys.argv if arg != '--render-preview']
runpy.run_path(str(ROOT/'scripts/manga/build_blender.py'), run_name='__main__')
sys.argv = original_argv
scene = bpy.context.scene
collections = {name:bpy.data.collections[name] for name in ['Terreno','Edificios','Vias','Costa','Agua','Vegetacion','Iluminacion','Auxiliares']}
textures = ROOT/'public/models/manga/textures'
textures.mkdir(exist_ok=True)


def texture(name, color, kind='plaster'):
    """Small locally generated seamless material maps, packed into the .blend."""
    n = 256
    rng = np.random.default_rng(int(hashlib.sha256(name.encode()).hexdigest()[:8],16))
    y,x = np.mgrid[0:n,0:n]
    grain = rng.normal(0,.02,(n,n))
    variation = np.zeros((n,n))
    # Aperiodic-looking seamless octave fields avoid the former checker pattern.
    for frequency,amplitude in [(1,.022),(3,.014),(7,.008)]:
        variation += amplitude*np.sin(x*math.tau/n*frequency+rng.random()*6.28)*np.cos(y*math.tau/n*(frequency+1)+rng.random()*6.28)
    if kind=='asphalt':
        grain = rng.normal(0,.065,(n,n))
    elif kind=='tile':
        variation += .16*np.sin(x*math.tau/32)
        variation -= .12*((y%48)<2)
    elif kind=='metal':
        variation += .11*np.sin(x*math.tau/16)
    values=np.ones((n,n,4),dtype=np.float32)
    # Input palette is linear; image sRGB values converted for portable glTF maps.
    for channel,base in enumerate(color):
        linear=np.clip(base*(1+grain+variation),0,1)
        values[:,:,channel]=np.where(linear<=.0031308,linear*12.92,1.055*np.power(linear,1/2.4)-.055)
    im=bpy.data.images.new(name,width=n,height=n,alpha=True)
    im.pixels.foreach_set(values.ravel())
    im.filepath_raw=str(textures/(name+'.png'));im.file_format='PNG';im.save();im.pack()
    return im


def material(name,color,roughness=.75,metallic=0,kind=None):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bsdf=m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(*color,1)
    bsdf.inputs['Roughness'].default_value=roughness
    bsdf.inputs['Metallic'].default_value=metallic
    if kind:
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=texture(name,color,kind)
        m.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
        # Cycles microstructure complements the same portable base-color texture.
        bump=m.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12
        bump.inputs['Distance'].default_value=.015
        m.node_tree.links.new(tex.outputs['Color'],bump.inputs['Height'])
        m.node_tree.links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])
    return m


facades=[material('Cal_'+str(i),c,kind='plaster') for i,c in enumerate([
    (.72,.69,.60),(.80,.77,.68),(.66,.58,.44),(.59,.64,.61),(.57,.35,.25),(.73,.62,.46)])]
roofs=[material('Cubierta_'+str(i),c,kind='concrete') for i,c in enumerate([
    (.40,.39,.35),(.64,.60,.51),(.40,.20,.115),(.56,.59,.57)])]
glass=material('Vidrio_costero',(.08,.18,.20),.22,.28)
frames=material('Carpinteria_marfil',(.74,.70,.59),.56)
dark=material('Carpinteria_oscura',(.16,.11,.075),.62)
concrete=material('Anden_inferido',(.46,.43,.36),.87,kind='concrete')
paint=material('Senalizacion_esquematica',(.74,.70,.53),.9)
asphalt=material('Asfalto_mineral',(.07,.08,.075),.9,kind='asphalt')
terrain_mat=material('Suelo_costero',(.38,.365,.295),.92,kind='concrete')
bark=material('Tronco_palmera',(.21,.145,.085),.92)
leaves=[material('Follaje_'+str(i),c,.84) for i,c in enumerate([(.11,.20,.045),(.14,.265,.065),(.075,.155,.045)])]
park_mat=material('Cobertura_vegetal',(.19,.23,.095),.95)
sea_mat=material('Agua_Caribe',(.025,.24,.29),.17,.22)
bsdf=sea_mat.node_tree.nodes.get('Principled BSDF')
noise=sea_mat.node_tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=2.8
bump=sea_mat.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.2;bump.inputs['Distance'].default_value=.055
texcoord=sea_mat.node_tree.nodes.new('ShaderNodeTexCoord')
sea_mat.node_tree.links.new(texcoord.outputs['Object'],noise.inputs['Vector'])
sea_mat.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height'])
sea_mat.node_tree.links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])


def unwrap(ob,scale=4):
    if ob.type!='MESH': return
    uv=ob.data.uv_layers.active or ob.data.uv_layers.new(name='MetricUV')
    for poly in ob.data.polygons:
        normal=poly.normal
        axis=max(range(3),key=lambda i:abs(normal[i]))
        coords=((0,1),(0,2),(1,2))[2-axis] if axis!=1 else (0,2)
        # z faces: x/y, y faces: x/z, x faces: y/z.
        coords={0:(1,2),1:(0,2),2:(0,1)}[axis]
        for li in poly.loop_indices:
            v=ob.data.vertices[ob.data.loops[li].vertex_index].co
            uv.data[li].uv=(v[coords[0]]/scale,v[coords[1]]/scale)


def mesh(name,verts,faces,col,mats,indices=None):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new(name,me);collections[col].objects.link(ob)
    for mat in mats:me.materials.append(mat)
    if indices is not None:
        for p,idx in zip(me.polygons,indices):p.material_index=idx
    unwrap(ob)
    return ob


def triangle_mesh(name,triangles,col,mat):
    vs=[v for t in triangles for v in t]
    return mesh(name,vs,[(i,i+1,i+2) for i in range(0,len(vs),3)],col,[mat])


for name,mat in [('Manga_Terreno_SRTM',terrain_mat),('Manga_Vias_OSM',asphalt),('Manga_Parques_OSM',park_mat),('Manga_Franja_Costera_20m',sea_mat)]:
    ob=bpy.data.objects[name];ob.data.materials.clear();ob.data.materials.append(mat);unwrap(ob)

if details.get('roads'):
    bpy.data.objects.remove(bpy.data.objects['Manga_Vias_OSM'],do_unlink=True)
    triangle_mesh('Manga_Vias_OSM',details['roads'],'Vias',asphalt)

triangle_mesh('Manga_Andenes_inferidos',details['sidewalks'],'Vias',concrete)
triangle_mesh('Manga_Marcas_esquematicas',details['markings'],'Vias',paint)
detail_counts={'windows':0,'doors':0,'parapetSegments':0,'trees':len(details['trees']),'heightOverrides':0}


def inside(x,y,ring):
    c=False
    for a,b in zip(ring,ring[1:]):
        if ((a[1]>y)!=(b[1]>y)) and x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:c=not c
    return c


for number,b in enumerate(data['buildings']):
    ob=bpy.data.objects[b['id']]
    seed=int(hashlib.sha256(b['id'].encode()).hexdigest()[:8],16)
    rng=random.Random(seed)
    meta=metadata.get(b['id'],{})
    visual_height=meta.get('visualHeightM') or b['height']
    if not isinstance(visual_height,(float,int)) or not 0<visual_height<180:visual_height=b['height']
    if visual_height!=b['height']:
        for v in ob.data.vertices:
            if v.co.z>b['base']+.01:v.co.z=b['base']+(v.co.z-b['base'])*visual_height/b['height']
        detail_counts['heightOverrides']+=1
    top=b['base']+visual_height
    ob['visual_height_m']=visual_height
    ob['visual_height_method']=meta.get('visualHeightMethod') or b['heightMethod']
    ob['facade_status']='Generic procedural presentation; no verified facade photograph'
    ob['source_url']=meta.get('sourceUrl','https://www.openstreetmap.org/way/'+b['id'].split('-')[2])
    ob['address']=meta.get('address') or ''
    ob['name_osm']=meta.get('name') or b['name']
    facade=facades[seed%len(facades)];roof=roofs[(seed//13)%len(roofs)]
    ob.data.materials.clear();ob.data.materials.append(facade);ob.data.materials.append(roof)
    for p in ob.data.polygons:p.material_index=1 if abs(p.normal.z)>.5 else 0
    unwrap(ob)
    # Generic accents remain separately editable and explicitly tagged per building.
    vs=[];fs=[];mi=[]
    def quad(points,mat):
        offset=len(vs);vs.extend(points);fs.append(tuple(range(offset,offset+4)));mi.append(mat)
    def wall_rect(a,u,out,start,end,z0,z1,offset,mat):
        def point(t,z):return(a[0]+u[0]*t+out[0]*offset,a[1]+u[1]*t+out[1]*offset,z)
        quad([point(start,z0),point(end,z0),point(end,z1),point(start,z1)],mat)
    role=meta.get('structureRole')
    if role=='canopy' or meta.get('buildingType') in ('roof','tank'):
        # OSM canopy: keep top slab and place supports, not fictitious room windows.
        if meta.get('buildingType')=='roof':
            for v in ob.data.vertices:
                if v.co.z < top-.5:v.co.z=top-.28
            ring=b['rings'][0]
            for a in ring[:-1][::max(1,len(ring)//5)]:
                cx=sum(p[0] for p in ring[:-1])/(len(ring)-1);cy=sum(p[1] for p in ring[:-1])/(len(ring)-1)
                px=a[0]+(cx-a[0])*.08;py=a[1]+(cy-a[1])*.08
                w=.16
                quad([(px-w,py-w,b['base']),(px+w,py-w,b['base']),(px+w,py-w,top-.28),(px-w,py-w,top-.28)],1)
                quad([(px-w,py-w,b['base']),(px-w,py+w,b['base']),(px-w,py+w,top-.28),(px-w,py-w,top-.28)],1)
    else:
        for ring_index,ring in enumerate(b['rings']):
            area=sum(a[0]*c[1]-c[0]*a[1] for a,c in zip(ring,ring[1:]))
            for edge_index,(a,c) in enumerate(zip(ring,ring[1:])):
                ground_ring=details.get('foundations',{}).get(b['id'],[])
                if ground_ring:
                    ga,gc=ground_ring[ring_index][edge_index:edge_index+2]
                    if min(ga[2],gc[2])<b['base']-.02:
                        quad([ga,gc,(c[0],c[1],b['base']+.01),(a[0],a[1],b['base']+.01)],3)
                length=math.dist(a,c)
                if length<2.2:continue
                u=((c[0]-a[0])/length,(c[1]-a[1])/length)
                out=(u[1],-u[0]) if area>0 else (-u[1],u[0])
                # Keep added surface offsets within the original 2 cm GIS tolerance.
                if not inside((a[0]+c[0])/2+out[0]*.015,(a[1]+c[1])/2+out[1]*.015,data['boundary']):continue
                wall_rect(a,u,out,.12,length-.12,top-.30,top-.09,.015,1)
                detail_counts['parapetSegments']+=1
                floors=max(1,min(40,int(visual_height/3)))
                bays=max(1,min(18,int(length/3.6)))
                for floor in range(floors):
                    z0=b['base']+floor*visual_height/floors+1.0
                    z1=min(z0+1.35,top-.55)
                    if z1<=z0:continue
                    for bay in range(bays):
                        if ring_index==0 and edge_index==details.get('entrances',{}).get(b['id']) and floor==0 and bay==bays//2:continue
                        center=(bay+.5)*length/bays;half=min(.66,length/bays*.25)
                        l,r=center-half,center+half
                        wall_rect(a,u,out,l-.10,r+.10,z0-.10,z1+.10,.016,1)
                        wall_rect(a,u,out,l,r,z0,z1,.019,0)
                        wall_rect(a,u,out,center-.028,center+.028,z0,z1,.020,1)
                        detail_counts['windows']+=1
                    # A restrained horizontal relief below each storey.
                    if floor>0:wall_rect(a,u,out,.16,length-.16,z0-.94,z0-.83,.018,1)
                if ring_index==0 and edge_index==details.get('entrances',{}).get(b['id']) and length>4:
                    center=(bays//2+.5)*length/bays
                    wall_rect(a,u,out,center-.6,center+.6,b['base']+.03,b['base']+2.3,.016,1)
                    wall_rect(a,u,out,center-.48,center+.48,b['base']+.05,b['base']+2.15,.020,2)
                    detail_counts['doors']+=1
    if vs:
        acc=mesh('Detalle_'+b['id'],vs,fs,'Edificios',[glass,frames,dark,concrete],mi)
        acc['osm_id']=b['id'];acc['facade_status']=ob['facade_status'];acc['detail_inferred']=True


# Replace the early generic facades with the checkpoint07 architectural profiles.
architecture=runpy.run_path(str(ROOT/'scripts/manga/architecture_blender.py'))
architecture['build'](globals())

# Tropical vegetation is instanced in Blender, restricted to mapped park interiors.
def palm_template():
    vs=[];fs=[];mi=[]
    sides=7
    for i in range(sides):
        a=i*math.tau/sides;vs.append((math.cos(a)*.19,math.sin(a)*.19,0))
    for i in range(sides):
        a=i*math.tau/sides;vs.append((.3+math.cos(a)*.11,math.sin(a)*.11,6.8))
    for i in range(sides):fs.append((i,(i+1)%sides,(i+1)%sides+sides,i+sides));mi.append(0)
    for leaf in range(10):
        angle=leaf*math.tau/10
        for segment in range(5):
            t0,t1=segment/5,(segment+1)/5
            def p(t,side):
                length=3.5*t;width=math.sin(t*math.pi)*.52
                return(.3+math.cos(angle)*length-math.sin(angle)*width*side,math.sin(angle)*length+math.cos(angle)*width*side,6.8+1.1*math.sin(t*math.pi)-1.5*t*t)
            k=len(vs);vs.extend([p(t0,-1),p(t1,-1),p(t1,1),p(t0,1)]);fs.append((k,k+1,k+2,k+3));mi.append(1+leaf%3)
    return mesh('Palma_prototipo',vs,fs,'Vegetacion',[bark,*leaves],mi)


def canopy_template():
    vs=[];fs=[];mi=[]
    for z,r in [(0,.24),(5.2,.11)]:
        for j in range(7):a=j*math.tau/7;vs.append((math.cos(a)*r,math.sin(a)*r,z))
    for j in range(7):fs.append((j,(j+1)%7,(j+1)%7+7,j+7));mi.append(0)
    rng=random.Random(221)
    for cluster in range(5):
        ang=cluster*math.tau/5;cx=math.cos(ang)*1.35;cy=math.sin(ang)*1.35
        center_z=5.3+rng.random()*1.3
        k=len(vs)
        for lat in range(5):
            theta=math.pi*lat/4
            for lon in range(8):
                phi=lon*math.tau/8
                vs.append((cx+math.sin(theta)*math.cos(phi)*2.05,cy+math.sin(theta)*math.sin(phi)*2.05,center_z+math.cos(theta)*2.05))
        for lat in range(4):
            for lon in range(8):
                fs.append((k+lat*8+lon,k+lat*8+(lon+1)%8,k+(lat+1)*8+(lon+1)%8,k+(lat+1)*8+lon));mi.append(1+cluster%3)
    ob=mesh('Arbol_prototipo',vs,fs,'Vegetacion',[bark,*leaves],mi)
    for p in ob.data.polygons:p.use_smooth=True
    return ob


templates={'palm':palm_template(),'canopy':canopy_template()}
for i,t in enumerate(details['trees']):
    ob=bpy.data.objects.new('Manga_Vegetacion_'+str(i),templates[t['kind']].data)
    collections['Vegetacion'].objects.link(ob);ob.location=t['position'];ob.rotation_euler.z=t['rotation']
    scale=t['height']/8;ob.scale=(scale,scale,scale)
    ob['placement']=t.get('placement','inferred within OSM park, no tree survey');ob['species']='generic tropical'
for ob in templates.values():bpy.data.objects.remove(ob,do_unlink=True)

# All editorial building geometry remains linked to its original footprint in web.
# Merge per semantic group/material, keeping the editable per-building scene intact.
export_parts=defaultdict(list)
for col in ['Terreno','Vias','Costa','Vegetacion','Edificios']:
    for ob in list(collections[col].objects):
        if ob.type!='MESH':continue
        semantic='Manga_Edificios' if col=='Edificios' else ('Manga_Vegetacion' if col=='Vegetacion' and ob.name!='Manga_Parques_OSM' else 'Manga_'+col)
        mat_faces=defaultdict(list)
        for p in ob.data.polygons:mat_faces[p.material_index].append(p)
        for material_index,polys in mat_faces.items():
            material_slot=ob.data.materials[material_index]
            group=export_parts[(semantic,material_slot.name)]
            group.append((ob,polys))
exports=[]
for (semantic,matname),group in export_parts.items():
    vs=[];fs=[]
    for original,polys in group:
        matrix=original.matrix_world.copy()
        # Ensure newly assigned object transforms are evaluated before packing.
        if original.name.startswith('Manga_Vegetacion'):
            from mathutils import Matrix
            matrix=Matrix.Translation(original.location)@original.rotation_euler.to_matrix().to_4x4()@Matrix.Diagonal((*original.scale,1))
        for p in polys:
            k=len(vs);vs.extend([matrix@original.data.vertices[v].co for v in p.vertices]);fs.append(tuple(range(k,k+len(p.vertices))))
    exp=mesh(semantic+'_'+matname,vs,fs,'Auxiliares',[bpy.data.materials[matname]])
    exp['selection']='Original OSM footprint in manga.json; inferred facade accents'
    exports.append(exp)
bpy.ops.object.select_all(action='DESELECT')
for ob in exports:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/manga/manga.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_texcoords=True,export_normals=True)
web_meshes=len(exports)
for ob in exports:bpy.data.objects.remove(ob,do_unlink=True)

# Cameras are based on actual OSM road centers. All camera positions are local meters.
def camera(name,position,target,lens=42):
    old=bpy.data.objects.get(name)
    if old:bpy.data.objects.remove(old,do_unlink=True)
    ca=bpy.data.cameras.new(name);ca.lens=lens;ca.clip_start=.1;ca.clip_end=12000
    ob=bpy.data.objects.new(name,ca);collections['Iluminacion'].objects.link(ob)
    ob.location=position;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
    return ob


general=camera('Aerea_General_Manga',(2450,-2850,2800),(0,-40,0),39)
coast=camera('Costa_Manga',(-970,-1030,290),(-200,-230,10),39)
candidates=details['cameraCandidates']
urban_choice=min(candidates,key=lambda c:(c['position'][0]+130)**2+(c['position'][1]-150)**2)
p=urban_choice['position'];q=urban_choice['target']
urban=camera('Urbana_Manga',(p[0],p[1],p[2]+2.7),(q[0],q[1],q[2]+3.2),29)
urban['road_osm']=urban_choice['name']
rain=camera('Lluvia_Manga',(p[0]-35,p[1]-50,p[2]+38),(p[0]+25,p[1]+25,p[2]+3),38)
flood=camera('Inundacion_Exploratoria',(250,-760,580),(0,-60,2),42)
roman_building=next(b for b in data['buildings'] if b['id']=='osm-way-109811287-0')
ra,rb=roman_building['rings'][0][:2];rl=math.dist(ra,rb)
rc=((ra[0]+rb[0])/2,(ra[1]+rb[1])/2)
rn=(-(rb[1]-ra[1])/rl,(rb[0]-ra[0])/rl)
if inside(rc[0]+rn[0],rc[1]+rn[1],roman_building['rings'][0]):rn=(-rn[0],-rn[1])
camera('Casa_Roman_Referencia',(rc[0]+rn[0]*37,rc[1]+rn[1]*37,roman_building['base']+5.5),(rc[0],rc[1],roman_building['base']+3),42)
tour=camera('Recorrido_Manga',general.location,(0,0,0),43)
scene.render.fps=24;scene.frame_start=1;scene.frame_end=360
# Short cinematic shots connected with smooth moves; cuts avoid collisions through houses.
shots=[(1,(1550,-1820,1700),(0,0,0),43),(120,(1100,-1320,1100),(-70,-20,3),43),
       (121,(p[0],p[1],p[2]+3.2),(q[0],q[1],q[2]+3.8),29),
       (240,(p[0]+(q[0]-p[0])*.35,p[1]+(q[1]-p[1])*.35,p[2]+4.0),(q[0],q[1],q[2]+4.2),29),
       (241,(-1050,-970,330),(-200,-230,10),39),(360,(-860,-820,230),(-130,-150,10),39)]
for frame,position,target,lens in shots:
    tour.location=position;tour.rotation_euler=(Vector(target)-tour.location).to_track_quat('-Z','Y').to_euler();tour.data.lens=lens
    tour.keyframe_insert('location',frame=frame);tour.keyframe_insert('rotation_euler',frame=frame);tour.data.keyframe_insert('lens',frame=frame)
for animated in [tour,tour.data]:
    if animated.animation_data and animated.animation_data.action:
        for layer in animated.animation_data.action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for fc in bag.fcurves:
                        for key in fc.keyframe_points:key.interpolation='LINEAR'
scene.timeline_markers.clear()
for name,frame in [('MANGA · AÉREA',1),('MANGA · CALLE OSM',121),('MANGA · COSTA',241)]:scene.timeline_markers.new(name,frame=frame)
scene.world.use_nodes=True
nodes=scene.world.node_tree.nodes;nodes.clear()
output=nodes.new('ShaderNodeOutputWorld');background=nodes.new('ShaderNodeBackground')
sky=nodes.new('ShaderNodeTexSky');sky.sky_type='MULTIPLE_SCATTERING';sky.sun_elevation=math.radians(18);sky.sun_rotation=math.radians(135)
sky.air_density=1.05;sky.aerosol_density=1.4;sky.ozone_density=1.1;sky.sun_disc=False
background.inputs['Strength'].default_value=.065
scene.world.node_tree.links.new(sky.outputs['Color'],background.inputs['Color']);scene.world.node_tree.links.new(background.outputs['Background'],output.inputs['Surface'])
sun=bpy.data.objects['Sol'];sun.data.energy=3.0;sun.data.angle=math.radians(3);sun.data.color=(1.0,.83,.62)
sun.rotation_euler=(math.radians(62),math.radians(-15),math.radians(-40))
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
scene.view_settings.exposure=-.35
scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=True
scene.render.resolution_x=1600;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.camera=general;scene.frame_set(1)
# Suppress dry cells in the animated hydrology sheet using its original terrain
# height as a vertex attribute. This only changes visibility, never solver volume.
for water in collections['Agua'].objects:
    if water.name.startswith('Agua_DEMO'):
        ground=water.data.attributes.new('ground_level','FLOAT','POINT')
        for vertex,item in zip(water.data.vertices,ground.data):item.value=vertex.co.z
        mat=water.data.materials[0].copy();mat.name='Agua_exploratoria_solo_celdas_humedas'
        water.data.materials[0]=mat
        nodes=mat.node_tree.nodes;links=mat.node_tree.links
        geom=nodes.new('ShaderNodeNewGeometry');xyz=nodes.new('ShaderNodeSeparateXYZ')
        attribute=nodes.new('ShaderNodeAttribute');attribute.attribute_name='ground_level'
        subtract=nodes.new('ShaderNodeMath');subtract.operation='SUBTRACT'
        dry=nodes.new('ShaderNodeMath');dry.operation='LESS_THAN';dry.inputs[1].default_value=.003
        clear=nodes.new('ShaderNodeBsdfTransparent');mix=nodes.new('ShaderNodeMixShader')
        links.new(geom.outputs['Position'],xyz.inputs[0]);links.new(xyz.outputs['Z'],subtract.inputs[0]);links.new(attribute.outputs['Fac'],subtract.inputs[1]);links.new(subtract.outputs[0],dry.inputs[0])
        links.new(dry.outputs[0],mix.inputs[0]);links.new(nodes.get('Principled BSDF').outputs[0],mix.inputs[1]);links.new(clear.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],nodes.get('Material Output').inputs['Surface'])
for ob in collections['Agua'].objects:ob.hide_render=True
scene['visual_detail_notice']='Facades, roof finishes, sidewalks and tree placements are generic inferred visual detail, not surveyed replica. See visual-metadata.json and docs/manga/visual-sources.md.'
scene['gis_sha256']=details['sourceSha256']
scene['visual_detail_stats']=json.dumps(detail_counts)
scene['urban_camera_road']=urban_choice['name']
scene['render_local_only']=True
readme=bpy.data.texts.get('LEEME_STORMPRINT')
readme.write('\n\nVISUAL CHECKPOINT 05: packed portable PBR textures, editable facade accents, park tree instances. Source GIS unchanged. Height overrides are derived estimates with primary sources, not measured heights. Cameras include aerial, OSM street, coast, rain, flood and 15-second tour. Render using scripts/manga/render_local.py. All rendered on local computer.\n')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models/manga/MANGA_STORMPRINT_FINAL.blend'))
report={'blender':bpy.app.version_string,'seconds':round(time.perf_counter()-START,2),'gisSha256':details['sourceSha256'],'editableObjects':len(scene.objects),'webMeshes':web_meshes,'glbBytes':(ROOT/'public/models/manga/manga.glb').stat().st_size,'detail':detail_counts,'urbanCameraRoad':urban_choice['name'],'cameras':[general.name,coast.name,urban.name,rain.name,flood.name,tour.name],'textures':'Locally generated, packed, 256px metric material maps; no remote rendering or imagery','limitations':scene['visual_detail_notice']}
(ROOT/'docs/manga/realistic-build.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf8')
print('MANGA_REALISTIC_BUILD',json.dumps(report,ensure_ascii=False))
