import json,numpy as np
from scipy.spatial import cKDTree
from scipy.optimize import differential_evolution,least_squares
r=json.load(open('docs/manga/v6.1/source-inspection.json'));s=np.array([[(x['lo'][i]+x['hi'][i])/2 for i in range(2)] for x in r if x['hi'][2]-x['lo'][2]>3 and x['hi'][0]-x['lo'][0]>3]);d=json.load(open('public/models/manga/manga.json'));t=np.array([[(min(p[i] for p in b['rings'][0])+max(p[i] for p in b['rings'][0]))/2 for i in range(2)] for b in d['buildings']]);tree=cKDTree(s)
def loss(v):
 dist,_=tree.query((t-v[1:])/v[0]);return np.mean(np.minimum(dist,15)**2)
f=differential_evolution(loss,[(1.6,2.5),(-500,500),(-500,500)],tol=1e-9,seed=1);print(f.x,f.fun)
v=f.x;dist,ix=tree.query((t-v[1:])/v[0]);valid=dist<2
print('matched',valid.sum(),'median',np.median(dist));print('fit',np.linalg.lstsq(np.c_[s[ix[valid]],np.ones(valid.sum())],t[valid],rcond=None)[0]);json.dump({'scale':v[0],'offset':v[1:].tolist(),'matched':int(valid.sum()),'medianSourceError':float(np.median(dist))},open('docs/manga/v6.1/alignment.json','w'),indent=2)
