import json,numpy as np,hashlib
from scipy.spatial import cKDTree
from pyproj import Transformer
from pathlib import Path
root=Path(__file__).resolve().parents[2];out=root/'public/models/manga/v6.1';out.mkdir(parents=True,exist_ok=True)
d=json.load(open(root/'public/models/manga/manga.json',encoding='utf-8'));rows=json.load(open(root/'docs/manga/v6.1/source-inspection.json'));a=json.load(open(root/'docs/manga/v6.1/alignment.json'))
s=np.array([[(r['lo'][i]+r['hi'][i])/2 for i in range(2)] for r in rows if r['hi'][2]-r['lo'][2]>3 and r['hi'][0]-r['lo'][0]>3]);t=np.array([[(min(p[i] for p in b['rings'][0])+max(p[i] for p in b['rings'][0]))/2 for i in range(2)] for b in d['buildings']]);dist,ix=cKDTree(s).query((t-a['offset'])/a['scale']);ok=dist<2;matrix=np.linalg.lstsq(np.c_[s[ix[ok]],np.ones(ok.sum())],t[ok],rcond=None)[0];res=np.linalg.norm(np.c_[s[ix[ok]],np.ones(ok.sum())]@matrix-t[ok],axis=1)
project=Transformer.from_crs('EPSG:4326',d['metadata']['crs'],always_xy=True)
e=json.load(open(root/'docs/manga/v6.1/cemetery-osm.json'))['elements'][0];cem=[project.transform(p['lon'],p['lat']) for p in e['geometry']]
landmarks=[dict(name='Cementerio Santa Cruz de Manga',position=[*np.mean(cem[:-1],axis=0),0],source=f"https://www.openstreetmap.org/way/{e['id']}")]
for b in d['buildings']:
 if any(n in b['name'].lower() for n in ['casa rom','iglesia santa','club de pesca']):
  pts=np.array(b['rings'][0]);landmarks.append(dict(name=b['name'],position=[*pts.mean(0),0],source='https://www.openstreetmap.org/way/'+b['id'].split('-')[2]))
payload=dict(matrix=matrix.tolist(),boundary=d['boundary'],roads=d['roads'],cemetery=cem,landmarks=landmarks,alignment=dict(matches=int(ok.sum()),medianErrorM=float(np.median(res)),p95ErrorM=float(np.percentile(res,95))),sourceSha256=hashlib.sha256(Path('public/models/manga/v6.1/source.glb').read_bytes()).hexdigest())
(root/'docs/manga/v6.1/build-input.json').write_text(json.dumps(payload));print(payload['alignment']);print(landmarks)
