"""Rebuild the user's GLB geometry, repair invalid attributes and batch by tile.
Run with Blender --background --python-exit-code 1 --python scripts/manga/build_v61.py.
The source is preserved in public/models/manga/v6.1/source.glb.
"""
import bpy, json, struct, math, random
import numpy as np
from pathlib import Path
from collections import defaultdict, Counter
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/models/manga/v6.1'
cfg = json.loads((ROOT/'docs/manga/v6.1/build-input.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
rng = random.Random(61)
groups = defaultdict(lambda: [[], []])
palette = {'cream':(.78,.71,.57), 'ivory':(.88,.85,.74), 'peach':(.72,.47,.35),
 'mint':(.42,.63,.55), 'blue':(.38,.53,.62), 'roof':(.48,.22,.13),
 'glass':(.075,.18,.22), 'trim':(.94,.90,.79), 'ground':(.40,.48,.33),
 'road':(.29,.32,.32), 'walk':(.62,.59,.49), 'stone':(.72,.73,.68),
 'white':(.91,.89,.81), 'iron':(.09,.13,.13), 'leaf':(.14,.32,.15),
 'trunk':(.25,.17,.10), 'water':(.075,.31,.36)}
mats={}
for name,col in palette.items():
 m=bpy.data.materials.new(name);m.diffuse_color=(*col,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*col,1)
 p.inputs['Roughness'].default_value=.32 if name in ['glass','water'] else .83
 mats[name]=m

def add(cat,mat,vs,fs):
 if not vs:return
 center=np.mean(vs,axis=0);key=(cat,mat,math.floor(center[0]/300),math.floor(center[1]/300))
 v,f=groups[key];offset=len(v);v.extend([tuple(p) for p in vs]);f.extend([tuple(offset+i for i in face) for face in fs])

def box(cat,mat,c,sz,angle=0):
 x,y,z=c;w,d,h=sz;co,si=math.cos(angle),math.sin(angle)
 vs=[(x+u*co-v*si,y+u*si+v*co,z+t) for t in [-h/2,h/2] for u,v in [(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)]]
 add(cat,mat,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])

def surface(cat,mat,points,z):
 pts=[Vector((p[0],p[1],z)) for p in points];tris=tessellate_polygon([pts]);vs=[tuple(pts[p]) if isinstance(p,int) else tuple(p) for t in tris for p in t]
 add(cat,mat,vs,[(i,i+1,i+2) for i in range(0,len(vs),3)])

def inside(x,y,poly):
 result=False
 for a,b in zip(poly,poly[1:]+poly[:1]):
  if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:result=not result
 return result

def line(cat,mat,a,b,width,height,z):
 dx,dy=b[0]-a[0],b[1]-a[1];box(cat,mat,((a[0]+b[0])/2,(a[1]+b[1])/2,z+height/2),(math.hypot(dx,dy),width,height),math.atan2(dy,dx))

surface('Terrain','ground',cfg['boundary'],0)
box('Sea','water',(0,0,-1.2),(22000,22000,.4))
for road in cfg['roads']:
 for tri in road['triangles']:add('Roads','road',[(p[0],p[1],.045) for p in tri],[(0,1,2)])

f=open(OUT/'source.glb','rb');f.read(12);n,_=struct.unpack('<II',f.read(8));g=json.loads(f.read(n));n,_=struct.unpack('<II',f.read(8));blob=f.read(n)
def acc(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];size={'VEC3':3,'VEC2':2,'SCALAR':1,'VEC4':4}[a['type']]
 return np.ndarray((a['count'],size),dtype=dt,buffer=blob,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',np.dtype(dt).itemsize*size),np.dtype(dt).itemsize)).copy()
matrix=np.array(cfg['matrix']);counts=Counter();buildings=[]
for idx,node in enumerate(g['nodes']):
 if 'mesh' not in node:continue
 p=g['meshes'][node['mesh']]['primitives'][0]
 if '_INSTANCESTART' in p['attributes']:counts['unsupportedLinePrimitivesExcluded']+=1;continue
 v=acc(p['attributes']['POSITION']);m=np.array(node.get('matrix',np.eye(4).flatten())).reshape(4,4).T
 v=(np.c_[v,np.ones(len(v))]@m.T)[:,:3];v=v[:,[0,2,1]]*np.array([1,-1,1]);v[:,:2]=np.c_[v[:,:2],np.ones(len(v))]@matrix
 lo=v.min(0);hi=v.max(0);c=(lo+hi)/2;h=hi[2]-lo[2]
 if h<2 or max(hi[:2]-lo[:2])<3:counts['sourcePlaceholdersExcluded']+=1;continue
 if not inside(c[0],c[1],cfg['boundary']):counts['outsideDistrictExcluded']+=1;continue
 if inside(c[0],c[1],cfg['cemetery']):counts['cemeteryVolumesReplaced']+=1;continue
 faces=acc(p['indices']).reshape(-1,3) if 'indices' in p else np.arange(len(v)).reshape(-1,3)
 width,depth=hi[:2]-lo[:2];area=width*depth
 typ=('small-house' if area<180 else 'medium-house' if area<420 else 'large-house') if h<=11 else ('small-building' if h<20 else 'tower')
 if typ=='large-house' and area>650:typ='small-building'
 if h<=11:
  newh={'small-house':4.2,'medium-house':6.8,'large-house':9.4,'small-building':13.2}[typ];v[:,2]=(v[:,2]-lo[2])*newh/h;lo[2]=0;hi[2]=newh;h=newh;c[2]=newh/2
 counts[typ]+=1;cat='Buildings';mat=['ivory','cream','peach','mint','blue'][idx%5]
 add(cat,mat,v.tolist(),faces.tolist());buildings.append(dict(sourceNode=idx,kind=typ,center=c.tolist(),bounds=[lo.tolist(),hi.tolist()]))
 # Recover actual footprint edges from vertical triangles; decoration follows
 # those edges, never a bounding rectangle that would overhang the street.
 edges=set()
 for face in faces:
  pts=v[face];bottom=[q for q in pts if abs(q[2]-lo[2])<.05]
  if len(bottom)==2 and any(q[2]>lo[2]+1 for q in pts):
   a,b=bottom;key=tuple(sorted((tuple(np.round(a[:2],3)),tuple(np.round(b[:2],3)))))
   edges.add(key)
 for a,b in edges:
  length=math.dist(a,b)
  if length<2:continue
  angle=math.atan2(b[1]-a[1],b[0]-a[0]);mid=((a[0]+b[0])/2,(a[1]+b[1])/2)
  line('Details','trim',a,b,.22,.26,hi[2]-.2)
  if typ.endswith('house'):line('Details','roof',a,b,.48,.3,hi[2]+.05)
  floors=max(1,min(12,round(h/3.3)))
  n=max(1,min(8,int(length/5)))
  for floor in range(floors):
   z=lo[2]+(floor+.52)*h/floors
   for k in range(n):
    t=(k+.5)/n;x=a[0]+(b[0]-a[0])*t;y=a[1]+(b[1]-a[1])*t
    w=min(1.5,length/n*.58)/2;dx=math.cos(angle)*w;dy=math.sin(angle)*w;nx=-math.sin(angle)*.075;ny=math.cos(angle)*.075
    if nx*(x-c[0])+ny*(y-c[1])<0:nx=-nx;ny=-ny
    add('Details','glass',[(x-dx+nx,y-dy+ny,z-.7),(x+dx+nx,y+dy+ny,z-.7),(x+dx+nx,y+dy+ny,z+.7),(x-dx+nx,y-dy+ny,z+.7)],[(0,1,2,3)])
    if typ in ['large-house','small-building','tower'] and floor>0 and k%3==0:
     box('Details','trim',(x,y,z-.88),(min(2,length/n*.7),.72,.14),angle)
  if typ.endswith('house') and length>5:
   box('Details','iron',(mid[0],mid[1],lo[2]+1.1),(1.1,.15,2.2),angle)
 # Recessed roof pavilion differentiates larger villas without widening footprint.
 if typ=='large-house' and min(width,depth)>15:
  box('Details','roof',(c[0],c[1],hi[2]+.3),(min(width*.3,8),min(depth*.3,8),.5))

# Cemetery follows the surveyed-in-OSM perimeter; details are interpretations.
poly=cfg['cemetery'];surface('Cemetery','walk',poly,.11)
# Calle 29 is the north edge; entry sits at its midpoint and opens southward.
segments=list(zip(poly,poly[1:]));a,b=max(segments,key=lambda e:(e[0][1]+e[1][1])/2)
entry=((a[0]+b[0])/2,(a[1]+b[1])/2);angle=math.atan2(b[1]-a[1],b[0]-a[0]);co,si=math.cos(angle),math.sin(angle)
def cp(x,y,z):return (entry[0]+x*co-y*si,entry[1]+x*si+y*co,z)
# Select local interior direction from actual polygon.
direction=1 if inside(*cp(0,8,0)[:2],poly) else -1
def cb(mat,x,y,z,w,d,h):box('Cemetery',mat,cp(x,y*direction,z),(w,d,h),angle)
for u,v in segments:
 if (u,v)==(a,b):
  length=math.dist(u,v);ux=(v[0]-u[0])/length;uy=(v[1]-u[1])/length
  line('Cemetery','white',u,(entry[0]-ux*10,entry[1]-uy*10),.55,2.4,.1)
  line('Cemetery','white',(entry[0]+ux*10,entry[1]+uy*10),v,.55,2.4,.1)
 else:line('Cemetery','white',u,v,.55,2.4,.1)
# Three open arches, with voussoirs and piers; actual holes, no painted arches.
for x in [-9,-3,3,9]:cb('white',x,0,2.5,1.1,2.4,5)
for x in [-6,0,6]:
 for k in range(16):
  t0=k*math.pi/16;t1=(k+1)*math.pi/16;vs=[]
  for y in [-1.2,1.2]:
   for r,t in [(2.45,t0),(3,t0),(3,t1),(2.45,t1)]:vs.append(cp(x+r*math.cos(t),y,3.2+r*math.sin(t)))
  add('Cemetery','white',vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2)])
cb('trim',0,0,6.35,20,2.7,.5);cb('white',0,0,8.1,8,2.1,3.2)
cb('iron',0,-1.08,8.05,3,.08,2.1);cb('trim',0,0,9.9,8.8,2.8,.45)
for x in [-3.3,3.3]:cb('trim',x,-1.2,8.2,.5,.35,3)
for x in [-9,-3,3,9]:cb('trim',x,0,.35,1.4,2.8,.5)
cb('iron',0,0,10.8,.22,.22,1.5);cb('iron',0,0,11,.95,.22,.18)
for x in [-6,6]:
 for k in range(9):cb('iron',x-2+k*.5,-.15,1.5,.075,.08,3)

occupied=[]
for y in range(10,160,6):
 for x in range(-100,101,5):
  if abs(x)<4 or y%30==10:continue
  footprint=[cp(x+dx,y*direction+dy*direction,0) for dx,dy in [(-2,-2),(2,-2),(2,2),(-2,2)]]
  if not all(inside(q[0],q[1],poly) for q in footprint):continue
  maus=(x//5+y//6)%11==0;counts['mausoleums' if maus else 'tombs']+=1
  cb('stone',x,y,.35,2.8,3.8,.45);cb('white',x,y,.9,2.3,3.3,.8)
  if maus:
   cb('white',x,y,2.05,2.5,3.5,2.4);cb('trim',x,y,3.4,2.9,3.8,.32)
   cb('iron',x,y-1.77,1.9,1.05,.08,1.65)
   for dx in [-1,1]:cb('trim',x+dx,y-1.85,2.1,.2,.2,2.1)
  else:
   cb('trim',x,y+1.35,1.45,1.7,.25,1.1)
   cb('stone',x,y+1.20,1.55,.75,.06,.5)
  z=4 if maus else 2.3;cb('white',x,y+1.2,z,.16,.18,1.05);cb('white',x,y+1.2,z+.12,.7,.18,.15)
  occupied.append(cp(x,y*direction,0))

def tree(x,y,height=7):
 box('Vegetation','trunk',(x,y,height*.32),(.4,.4,height*.64))
 # Low-poly broad tropical crown, baked into shared tile meshes.
 vs=[(x,y,height+1.7),(x,y,height-2.4)]+[(x+2.7*math.cos(k*math.tau/8),y+2.7*math.sin(k*math.tau/8),height-.5) for k in range(8)]
 add('Vegetation','leaf',vs,[(0,2+k,2+(k+1)%8) for k in range(8)]+[(1,2+(k+1)%8,2+k) for k in range(8)])
for x in [-6,6]:
 for y in [14,44,74,104]:
  q=cp(x,y*direction,0)
  if inside(*q[:2],poly):tree(*q[:2],6)
# Trees along roads, excluding buildings and cemetery. Spatial buckets keep build cheap.
buckets=defaultdict(list)
for b in buildings:
 lo,hi=b['bounds']
 for tx in range(math.floor(lo[0]/50),math.floor(hi[0]/50)+1):
  for ty in range(math.floor(lo[1]/50),math.floor(hi[1]/50)+1):buckets[(tx,ty)].append((lo,hi))
for _ in range(2100):
 road=rng.choice(cfg['roads'])
 if not road['triangles']:continue
 tri=rng.choice(road['triangles']);x,y=tri[0][:2];x+=rng.choice([-1,1])*7;y+=rng.choice([-1,1])*7
 if not inside(x,y,cfg['boundary']) or inside(x,y,poly):continue
 if any(lo[0]-3<x<hi[0]+3 and lo[1]-3<y<hi[1]+3 for lo,hi in buckets[(math.floor(x/50),math.floor(y/50))]):continue
 tree(x,y,rng.uniform(5,9));counts['trees']+=1

for (cat,mat,tx,ty),(vs,fs) in groups.items():
 mesh=bpy.data.meshes.new(f'{cat}_{mat}_{tx}_{ty}');mesh.from_pydata(vs,[],fs);mesh.update()
 ob=bpy.data.objects.new(mesh.name,mesh);bpy.context.collection.objects.link(ob);ob.data.materials.append(mats[mat]);ob['category']=cat
 # Consistent outward normals after source repair and procedural assembly.
 import bmesh
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free()
bpy.ops.export_scene.gltf(filepath=str(OUT/'manga-v6.1.glb'),export_format='GLB',export_extras=True,export_yup=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
report=dict(version='6.1',counts=dict(counts),sourceSha256=cfg['sourceSha256'],alignment=cfg['alignment'],landmarks=cfg['landmarks'],entry=list(entry),entryApproach=list(cp(0,-32*direction,22)),cemeteryPolygon=poly,meshes=len(groups),triangles=sum(sum(len(f)-2 for f in fs) for vs,fs in groups.values()),bytes=(OUT/'manga-v6.1.glb').stat().st_size,notes='Render conceptual. Huellas del adjunto; terreno plano, alturas y fachadas interpretadas. No es topografía hidráulica.')
(OUT/'metadata.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('REPORT',json.dumps(report['counts']),report['triangles'],report['meshes'])
# Deterministic visual QA: aerial and cemetery close-up.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.world=bpy.data.worlds.new('Day');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.78,.86,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
bpy.ops.object.light_add(type='SUN',location=(0,0,1000));bpy.context.object.rotation_euler=(.4,-.5,-.4);bpy.context.object.data.energy=2.2;bpy.context.object.data.angle=.12
bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera
scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
def render(name,pos,target,ortho):
 camera.location=pos;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=ortho;camera.data.clip_end=15000
 scene.render.filepath=str(ROOT/'docs/manga/v6.1'/name);bpy.ops.render.render(write_still=True)
render('aerial.png',(1700,-2200,2300),(0,80,0),2600)
center=np.mean(poly[:-1],axis=0);render('cemetery.png',(center[0]+105,center[1]+150,135),(*center,0),210)
render('entrance.png',cp(0,-32*direction,22),cp(0,0,4.5),48)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models/manga/MANGA_V6.1.blend'))
