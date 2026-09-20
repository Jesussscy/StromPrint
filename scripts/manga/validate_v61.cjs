// Decode the shipped asset, not the intermediate Blender geometry.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const folder = path.join(root, 'public/models/manga/v6.1');
async function main() {
  const file = fs.readFileSync(path.join(folder, 'manga-v6.1.glb'));
  const metadata = JSON.parse(fs.readFileSync(path.join(folder, 'metadata.json'), 'utf8'));
  assert.equal(file.readUInt32LE(0), 0x46546c67);
  assert.equal(file.readUInt32LE(8), file.length);
  const jsonLength = file.readUInt32LE(12);
  const gltf = JSON.parse(file.subarray(20, 20 + jsonLength).toString());
  const binary = file.subarray(28 + jsonLength);
  const draco = await require('../../public/models/manga/draco/draco_decoder.js')({});
  let triangles = 0, vertices = 0;
  for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
    const extension = primitive.extensions.KHR_draco_mesh_compression;
    const view = gltf.bufferViews[extension.bufferView];
    const bytes = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    const buffer = new draco.DecoderBuffer();buffer.Init(new Int8Array(bytes), bytes.length);
    const decoder = new draco.Decoder(), decoded = new draco.Mesh();
    const status = decoder.DecodeBufferToMesh(buffer, decoded);
    assert(status.ok(), `Draco decode failed: ${mesh.name}`);
    const attribute = decoder.GetAttributeByUniqueId(decoded, extension.attributes.POSITION);
    const positions = new draco.DracoFloat32Array();
    decoder.GetAttributeFloatForAllPoints(decoded, attribute, positions);
    for (let i = 0; i < positions.size(); i++) assert(Number.isFinite(positions.GetValue(i)));
    const face = new draco.DracoInt32Array();
    for (let i = 0; i < decoded.num_faces(); i++) {
      decoder.GetFaceFromMesh(decoded, i, face);
      for (let k = 0; k < 3; k++) assert(face.GetValue(k) >= 0 && face.GetValue(k) < decoded.num_points());
    }
    triangles += decoded.num_faces();vertices += decoded.num_points();
    [positions, face, decoded, decoder, buffer].forEach(value => draco.destroy(value));
  }
  assert.equal(triangles, metadata.triangles);
  assert.equal(gltf.meshes.length, metadata.meshes);
  assert(file.length < 5_000_000, 'Download budget exceeded');
  assert(triangles < 650_000, 'Geometry budget exceeded');
  assert(metadata.alignment.matches > 1500 && metadata.alignment.p95ErrorM < .1);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(folder, 'source.glb'))).digest('hex');
  assert.equal(hash, metadata.sourceSha256);
  for (const kind of ['small-house', 'medium-house', 'large-house', 'small-building', 'tower', 'tombs', 'mausoleums']) assert(metadata.counts[kind] > 0);
  assert.equal(metadata.landmarks.length, 4);
  assert(gltf.nodes.some(node => node.extras?.category === 'Cemetery'));
  const report = { pass: true, triangles, vertices, meshes: gltf.meshes.length, bytes: file.length, sourceSha256: hash, checks: ['Every Draco primitive decoded', 'Finite coordinates and valid indices', 'Export totals match report', 'Five architectural types and cemetery', 'Source hash preserved', 'Alignment residual and asset budgets'] };
  fs.writeFileSync(path.join(root, 'docs/manga/v6.1/validation.json'), JSON.stringify(report, null, 2));
  console.log(report);
}
main().catch(error => { console.error(error);process.exitCode = 1; });
