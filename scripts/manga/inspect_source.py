import json,struct,numpy as np
from pathlib import Path
from PIL import Image,ImageDraw
f=open('public/models/manga/v6.1/source.glb','rb');f.read(12);n,t=struct.unpack('<II',f.read(8));j=json.loads(f.read(n));n,t=struct.unpack('<II',f.read(8));blob=f.read(n)
def acc(i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];size={'VEC3':3,'VEC2':2,'SCALAR':1,'VEC4':4}[a['type']];return np.frombuffer(blob,dtype=dt,count=a['count']*size,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,size)
rows=[]
for idx,node in enumerate(j['nodes']):
 if 'mesh' not in node:continue
 p=j['meshes'][node['mesh']]['primitives'][0];v=acc(p['attributes']['POSITION']);m=np.array(node.get('matrix',np.eye(4).flatten())).reshape(4,4).T;v=(np.c_[v,np.ones(len(v))]@m.T)[:,:3];v=v[:,[0,2,1]]*np.array([1,-1,1]);rows.append(dict(id=idx,lo=v.min(0).tolist(),hi=v.max(0).tolist(),verts=len(v)))
Path('docs/manga/v6.1/source-inspection.json').write_text(json.dumps(rows))
print('bounds',np.min([r['lo'] for r in rows],0),np.max([r['hi'] for r in rows],0));print('height samples',rows[:3]);print('large',sorted(rows,key=lambda r:(r['hi'][0]-r['lo'][0])*(r['hi'][1]-r['lo'][1]),reverse=True)[:4])
im=Image.new('RGB',(1400,1100),'#152d37');d=ImageDraw.Draw(im)
for r in sorted(rows,key=lambda r:r['hi'][2]):
 x,y,z=r['lo'];X,Y,Z=r['hi'];d.rectangle((int(x+700),int(600-Y),int(X+700),int(600-y)),fill=('#8b9972' if Z-z<1 else '#eee2c6'))
im.save('docs/manga/v6.1/source-top.png')
