/* Validate the exported binary, not only the pre-export Blender counters. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const dir = path.join(root, 'public/models/manga/contract');
const bytes = fs.readFileSync(path.join(dir, 'manga-contract.glb'));
assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
assert.equal(bytes.readUInt32LE(4), 2);
assert.equal(bytes.readUInt32LE(8), bytes.length);
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
const binary = bytes.subarray(28 + jsonLength);
const metadata = JSON.parse(fs.readFileSync(path.join(dir, 'metadata.json')));
assert.equal(gltf.images.length, 1, 'Single atlas');
assert.ok(gltf.buffers.every(b => !b.uri));
assert.ok(gltf.images.every(b => b.bufferView !== undefined && !b.uri));
const image = gltf.bufferViews[gltf.images[0].bufferView];
const png = binary.subarray(image.byteOffset, image.byteOffset + image.byteLength);
assert.equal(png.readUInt32BE(16), 2048);
assert.equal(png.readUInt32BE(20), 2048);

function accessor(index) {
  const a = gltf.accessors[index], view = gltf.bufferViews[a.bufferView];
  const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const width = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType];
  assert.ok(size && width);
  const read = { 5126: 'readFloatLE', 5125: 'readUInt32LE', 5123: 'readUInt16LE', 5121: 'readUInt8' }[a.componentType];
  return Array.from({ length: a.count }, (_, i) => Array.from({ length: size }, (_, c) =>
    binary[read]((view.byteOffset || 0) + (a.byteOffset || 0) + i * (view.byteStride || size * width) + c * width)));
}
const nodes = Object.fromEntries(gltf.nodes.map(n => [n.name, n]));
for (const name of ['Manga_Terrain_Base', 'WaterLevel_Animated', 'Landmarks_LOD2', 'Buildings_LOD1',
  'Fortin_Pastelillo', 'Club_Nautico_Marina', 'Puentes_Group', 'Puente_Roman', 'Puente_Las_Palmas', 'Puente_Jimenez', 'Puente_Bazurto']) assert.ok(nodes[name], name);
for (const node of gltf.nodes) {
  assert.ok(!node.matrix && !node.rotation && !node.scale && !node.translation, 'Applied transforms');
}
assert.ok(nodes.Landmarks_LOD2.children.includes(gltf.nodes.indexOf(nodes.Puentes_Group)));
assert.equal(nodes.Puentes_Group.children.length, 4);
let triangles = 0, terrainArea = 0;
for (const [name, node] of Object.entries(nodes)) {
  if (node.mesh === undefined) continue;
  const primitives = gltf.meshes[node.mesh].primitives;
  if (name === 'Buildings_LOD1') assert.equal(primitives.length, 1);
  for (const primitive of primitives) {
    assert.equal(primitive.mode ?? 4, 4);
    const positions = accessor(primitive.attributes.POSITION);
    const normals = accessor(primitive.attributes.NORMAL);
    const uv = accessor(primitive.attributes.TEXCOORD_0);
    const indices = accessor(primitive.indices).flat();
    assert.equal(indices.length % 3, 0);
    triangles += indices.length / 3;
    assert.ok(positions.flat().every(Number.isFinite));
    assert.ok(uv.flat().every(n => n >= 0 && n <= 1));
    assert.ok(normals.every(n => Math.abs(Math.hypot(...n) - 1) < 1e-4));
    if (name === 'WaterLevel_Animated') {
      assert.ok(positions.every(p => p[1] === 0));
      assert.ok(normals.every(n => n[1] > .99));
      const material = gltf.materials[primitive.material];
      assert.equal(material.alphaMode, 'BLEND');
      assert.ok(material.normalTexture);
    }
    if (name === 'Manga_Terrain_Base') {
      for (let i = 0; i < indices.length; i += 3) {
        const [a, b, c] = indices.slice(i, i + 3).map(j => positions[j]);
        const signedArea = ((b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]))/2;
        assert.ok(signedArea > 0, 'Terrain winding +Y');
        terrainArea += signedArea;
      }
      assert.ok(positions.every(p => p[1] >= 0 && p[1] <= 2.2));
    }
  }
}
assert.ok(triangles <= 80000);
assert.ok(Math.abs(terrainArea - metadata.areaM2) / metadata.areaM2 < .0001);
assert.equal(metadata.sourceSHA256, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'public/models/manga/manga.json'))).digest('hex'));
const report = { checkpoint: '14C', status: 'PASS', triangles, bytes: bytes.length, terrainAreaM2: terrainArea,
  atlas: '2048x2048, one embedded PNG', appliedTransforms: true, yUp: true,
  sha256: crypto.createHash('sha256').update(bytes).digest('hex'), certified: false };
fs.writeFileSync(path.join(root, 'docs/manga/contract-validation.json'), JSON.stringify(report, null, 2));
console.log(report);
