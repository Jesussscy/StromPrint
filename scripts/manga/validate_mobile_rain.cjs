const fs = require('fs'), path = require('path'), ts = require('typescript'), assert = require('assert/strict');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, file);
const { SurfaceWater } = require('../../app/lib/manga/solver.ts');
const { apiScenario } = require('../../app/lib/manga/adapter.ts');
const { waterSurface,cellWaterLevel,surfaceVolume } = require('../../app/lib/manga/waterSurface.ts');
const { zoneCells,summarizeZones } = require('../../app/lib/manga/zones.ts');
const grid = { dx: 40, cells: [{ x: 0, y: 0, z: 0, area: 2, built: 1, coastal: false, ij: [0, 0], triangles: [[[0, 0, 0], [2, 0, 2], [0, 2, 0]]] }], edges: [] };
const source = { retrieved_at: '2026-09-17T12:00:00-05:00', step_seconds: 3600,
  hours: [0, 12, 36].map((rain, hour) => ({ hour, rain_mm_h: rain })) };
const scenario = { ...apiScenario(source).scenario, infiltrationMmH: 0, drainageMmH: 0 };
const engine = new SurfaceWater(grid, scenario);
assert.equal(engine.advanceTo(3600).storedM3, 0, 'dry first hour');
assert.ok(Math.abs(engine.advanceTo(7200).depth[0] - .012) < 1e-10, '12 mm second hour');
const result = engine.advanceTo(10800);
assert.ok(Math.abs(result.depth[0] - .048) < 1e-10, '48 mm cumulative after third hour');
assert.throws(() => engine.advanceTo(10810), /No hay lluvia/, 'do not repeat the last API hour');
for (const hours of [[{ hour: 0, rain_mm_h: null }], [{ hour: 0, rain_mm_h: -1 }], [{ hour: 0, rain_mm_h: 301 }], [{ hour: 0, rain_mm_h: 0 }, { hour: 2, rain_mm_h: 4 }]]) {
  assert.equal(apiScenario({ ...source, hours }).scenario, null, 'reject unavailable/invalid/gapped data');
}
assert.equal(apiScenario({ ...source, step_seconds: 1800 }).scenario, null);
const surface = waterSurface(grid, { ...result, depth: [1] });
const level=cellWaterLevel(grid.cells[0],1);
assert.ok(Math.abs(surfaceVolume(grid.cells[0],level)-2)<1e-6,'visible water retains stored volume');
assert.equal(surface.positions.length, 18, 'partially wet triangle becomes a quad');
for (let i = 0; i < surface.positions.length; i += 3) {
  assert.equal(surface.positions[i + 1], level+.008, 'horizontal cell water plane');
  assert.ok(surface.positions[i] <= level+1e-6, 'shoreline clipped at terrain crossing');
}
assert.ok(surface.depths.some(d => d === 0), 'zero depth at shoreline');
assert.equal(waterSurface(grid, { ...result, depth: [0] }).positions.length, 0);
assert.equal(waterSurface(grid, { ...result, depth: [NaN] }).positions.length, 0);
assert.equal(waterSurface(grid, null).positions.length, 0);
// Exercise the actual worker's optional-grid protocol and rewind, not a copy.
let response;
global.self = { postMessage: value => { response = value; } };
require('../../app/lib/manga/water.worker.ts');
self.onmessage({ data: { id: 1, grid, scenario, seconds: 7200 } });
assert.ok(response.result, response.error);
self.onmessage({ data: { id: 2, scenario, seconds: 10800 } });
assert.deepEqual(response.result.depth, result.depth, 'cached terrain preserves forward integration');
assert.ok(Math.abs(surfaceVolume(grid.cells[0],response.result.levels[0])-result.storedM3)<1e-6);
self.onmessage({ data: { id: 3, scenario, seconds: 3600 } });
assert.equal(response.result.storedM3, 0, 'rewind deterministically resets simulation');
self.onmessage({ data: { id: 4, scenario, seconds: 10810 } });
assert.match(response.error, /No hay lluvia/);
const district={grid:{...grid,cells:[grid.cells[0],{...grid.cells[0],x:100,area:8}]},boundary:[[-20,-20],[140,-20],[140,20],[-20,20]]};
const zones=[{id:1,coordenadas:[10.41145,-75.5357],radio_influencia:20},{id:2,coordenadas:[10.41145,-75.5357+100/109501.7],radio_influencia:20},{id:3,coordenadas:[0,0],radio_influencia:20}];
const summary=summarizeZones(district,zoneCells(district,zones),{...result,depth:[.01,.15]});
assert.equal(summary.get(1).meanCm,1);assert.equal(summary.get(2).meanCm,15);
assert.equal(summary.has(3),false,'no invented depths outside coverage');
console.log('PASS: hourly API forcing, missing data, forecast horizon, horizontal shorelines, cached worker and rewind.');
