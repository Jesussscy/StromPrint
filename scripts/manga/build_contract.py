"""Blender --background --factory-startup --python-exit-code 1 --python THIS_FILE.
Produces an independent GLB contract, one atlas, strict scene graph, <=80k triangles.
"""
import json
import math
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/models/manga/contract'
data = json.loads((ROOT / 'models/manga/contract-input.json').read_text(encoding='utf8'))
meta = data['metadata']
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
atlas = bpy.data.images.load(str(OUT / 'atlas.png'))
atlas.pack()


def material(name, water=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Roughness'].default_value = .24 if water else .85
    p.inputs['Metallic'].default_value = 0
    tex = m.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = atlas
    if water:
        p.inputs['Base Color'].default_value = (.035, .24, .3, 1)
        p.inputs['Alpha'].default_value = .58
        m.surface_render_method = 'DITHERED'
        normal = m.node_tree.nodes.new('ShaderNodeNormalMap')
        normal.inputs['Strength'].default_value = .45
        m.node_tree.links.new(tex.outputs['Color'], normal.inputs['Color'])
        m.node_tree.links.new(normal.outputs['Normal'], p.inputs['Normal'])
    else:
        m.node_tree.links.new(tex.outputs['Color'], p.inputs['Base Color'])
    return m


land_mat = material('Atlas_Land')
water_mat = material('Water_PBR', True)


def group(name, parent=None):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.parent = parent
    return obj


def mesh(name, verts, faces, kind='solid', parent=None):
    geo = bpy.data.meshes.new(name)
    geo.from_pydata(verts, [], faces)
    geo.update()
    obj = bpy.data.objects.new(name, geo)
    scene.collection.objects.link(obj)
    obj.parent = parent
    geo.materials.append(water_mat if kind == 'water' else land_mat)
    uv = geo.uv_layers.new(name='AtlasUV')
    x0, y0, x1, y1 = meta['bounds']
    wx0, wy0, wx1, wy1 = meta['waterBounds']
    for loop in geo.loops:
        x, y, _ = geo.vertices[loop.vertex_index].co
        if kind == 'terrain':
            value = ((4+(x-x0)/(x1-x0)*1784)/2048, (5+(y-y0)/(y1-y0)*2038)/2048)
        elif kind == 'water':
            value = ((1793+(x-wx0)/(wx1-wx0)*253)/2048, (2+(y-wy0)/(wy1-wy0)*252)/2048)
        else:
            value = (.9375, .8125 if kind == 'landmark' else .9375)
        uv.data[loop.index].uv = value
    return obj


def triangle_mesh(name, triangles, kind):
    # Weld to keep smooth geographic topology without relying on rounded positions.
    verts, faces, lookup = [], [], {}
    for tri in triangles:
        face = []
        for p in tri:
            key = tuple(p)
            if key not in lookup:
                lookup[key] = len(verts)
                verts.append(key)
            face.append(lookup[key])
        a, b, c = [verts[i] for i in face]
        if (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]) < 0:
            face.reverse()
        faces.append(face)
    return mesh(name, verts, faces, kind)


terrain = triangle_mesh('Manga_Terrain_Base', data['terrain'], 'terrain')
terrain['elevationProvenance'] = meta['terrainMethod']
terrain['certified'] = False
verts, faces = [], []
for b in data['buildings']:
    bottom, top = b['base'], b['base'] + b['height']
    for tri in b['roof']:
        a, c, d = tri
        if (c[0]-a[0])*(d[1]-a[1])-(c[1]-a[1])*(d[0]-a[0]) < 0:
            tri = list(reversed(tri))
        for z, reverse in [(top, False), (bottom, True)]:
            start = len(verts)
            verts.extend([(p[0], p[1], z) for p in tri])
            faces.append(tuple(start+i for i in ([2, 1, 0] if reverse else [0, 1, 2])))
    for ring_index, ring in enumerate(b['rings']):
        area = sum(a[0]*c[1]-c[0]*a[1] for a, c in zip(ring, ring[1:]))
        if (area > 0) != (ring_index == 0):
            ring = list(reversed(ring))
        for a, c in zip(ring, ring[1:]):
            start = len(verts)
            verts.extend([(a[0], a[1], bottom), (c[0], c[1], bottom),
                          (c[0], c[1], top), (a[0], a[1], top)])
            faces.append(tuple(start+i for i in range(4)))
buildings = mesh('Buildings_LOD1', verts, faces)
buildings['heightProvenance'] = 'OSM levels or estimated; see original manga.json by building ID'
x0, y0, x1, y1 = meta['waterBounds']
water = mesh('WaterLevel_Animated', [(x0,y0,0),(x1,y0,0),(x1,y1,0),(x0,y1,0)], [(0,1,2,3)], 'water')
water['externalControl'] = 'Three.js position.y = H(t), metres hypothetical MSL'
landmarks = group('Landmarks_LOD2')
bridges = group('Puentes_Group', landmarks)


def boxes(name, parts, parent):
    vs, fs = [], []
    for x, y, z, sx, sy, sz in parts:
        start = len(vs)
        vs.extend([(x+dx*sx/2, y+dy*sy/2, z+dz*sz/2)
                   for dx,dy,dz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
                                    (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]])
        fs.extend([tuple(start+i for i in f) for f in [(3,2,1,0),(4,5,6,7),(0,1,5,4),
                                                                    (1,2,6,5),(2,3,7,6),(3,0,4,7)]])
    return mesh(name, vs, fs, 'landmark', parent)


for item in meta['landmarks']:
    name = item['name']
    x, y, z = item['position']
    if name.startswith('Puente_'):
        parts = [(x,y,z-.25,12,60,.5), (x-5.8,y,z+.5,.3,60,1), (x+5.8,y,z+.5,.3,60,1)]
        parent = bridges
    elif name == 'Fortin_Pastelillo':
        parts = [(x,y,z+.4,48,35,.8), (x-23,y,z+2,2,35,4),
                 (x+23,y,z+2,2,35,4), (x,y-16.5,z+2,48,2,4), (x,y+16.5,z+2,48,2,4)]
        parent = landmarks
    elif name == 'Club_Nautico_Marina':
        parts = [(x,y,z-.2,70,4,.4)] + [(x+i*14,y-15,z-.2,3,30,.4) for i in range(-2,3)]
        parent = landmarks
    else:
        parts = [(x,y,z+5,80,45,10)]
        parent = landmarks
    obj = boxes(name, parts, parent)
    obj['provenance'] = item['provenance']
    obj['representation'] = 'Schematic proxy, not surveyed LOD2'
    obj['anchorENH'] = item['position']

for obj in scene.objects:
    if obj.type == 'MESH':
        obj.data.calc_loop_triangles()
triangles = sum(len(o.data.loop_triangles) for o in scene.objects if o.type == 'MESH')
if triangles > 80000:
    raise RuntimeError(f'Triangle budget exceeded: {triangles}; no silent decimation allowed')
scene['georeference'] = json.dumps(meta)
bpy.ops.export_scene.gltf(filepath=str(OUT/'manga-contract.glb'), export_format='GLB',
                         export_yup=True, export_extras=True, export_animations=False)

# Camera and lights only in editable source/preview, never in exported scene.
bpy.ops.object.light_add(type='SUN', location=(0,0,1500))
bpy.context.object.data.energy = 2
bpy.context.object.rotation_euler = (.4,-.3,-.4)
bpy.ops.object.camera_add(location=(2400,-3000,2800))
camera = bpy.context.object
camera.rotation_euler = (Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 3900
camera.data.clip_end = 10000
scene.camera = camera
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.render.resolution_x = 1200
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.world.color = (.45,.45,.45)
scene.render.filepath = str(ROOT/'models/manga/contract-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models/manga/MANGA_CONTRACT.blend'))
bpy.ops.render.render(write_still=True)
(ROOT/'docs/manga/contract-build.json').write_text(json.dumps(dict(
    checkpoint='14B', triangles=triangles, blender=bpy.app.version_string,
    glbBytes=(OUT/'manga-contract.glb').stat().st_size, certified=False), indent=2))
print('CONTRACT_COMPLETE', triangles)
