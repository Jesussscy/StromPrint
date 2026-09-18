"""Use same-origin PNG URLs for portable browser texture loading.

Some browser ImageBitmap loaders cannot fetch embedded blob: image URLs under
the existing CSP. Externalizing preserves those exact image bytes and keeps
all assets local without weakening the page's policy.
"""
import hashlib
import json
import struct
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
path=ROOT/'public/models/manga/manga.glb'
raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0]
gltf=json.loads(raw[20:20+length]);tail=raw[20+length:]
assert struct.unpack_from('<I',tail,4)[0]==0x004e4942
binary=tail[8:];images=[]
for im in gltf.get('images',[]):
    if 'bufferView' not in im:continue
    view=gltf['bufferViews'][im['bufferView']]
    content=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
    assert im.get('mimeType')=='image/png' and content.startswith(b'\x89PNG'), 'Expected exact PNG material'
    digest=hashlib.sha256(content).hexdigest()
    name='packed-'+digest[:16]+'.png'
    (path.parent/'textures'/name).write_bytes(content)
    im.pop('bufferView');im.pop('mimeType',None);im['uri']='textures/'+name
    images.append({'uri':im['uri'],'bytes':len(content),'sha256':digest})
header=json.dumps(gltf,separators=(',',':'),ensure_ascii=False).encode('utf8')
header+=b' '*((-len(header))%4)
new=struct.pack('<III',0x46546c67,2,12+8+len(header)+len(tail))+struct.pack('<II',len(header),0x4e4f534a)+header+tail
path.write_bytes(new)
report_path=ROOT/'docs/manga/compression-validation.json'
report=json.loads(report_path.read_text(encoding='utf8'))
report['compressedBytes']=len(new);report['compressedSha256']=hashlib.sha256(new).hexdigest()
report['ratio']=round(len(new)/report['uncompressedBytes'],4)
report['externalTextures']=images
report['textureLoading']='Exact exported PNG bytes via same-origin relative URLs; existing CSP unchanged'
report_path.write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps({'textures':len(images),'bytes':sum(i['bytes'] for i in images),'glbBytes':len(new)}))
