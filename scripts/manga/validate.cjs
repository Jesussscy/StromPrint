// Use the application's TypeScript solver unchanged in Node for regression/Blender snapshots.
const fs=require('fs'),path=require('path'),ts=require('typescript'),assert=require('assert');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {SurfaceWater}=require('../../app/lib/manga/solver.ts');
const scenario={rainMmH:120,durationH:4,infiltrationMmH:2,drainageMmH:3,seaHeadM:null};
function grid(zs,dx=40){return {dx,cells:zs.map((z,i)=>({x:i*dx,y:0,z,area:dx*dx,built:0,coastal:false,triangles:[],ij:[i,0]})),edges:zs.slice(1).map((_,i)=>[i,i+1,1])};}
function balanced(r){assert(Math.abs(r.balanceM3)<Math.max(1e-6,r.rainM3*1e-9));assert(r.depth.every(x=>Number.isFinite(x)&&x>=0));}
const slope=new SurfaceWater(grid([2,1,0]),{...scenario,infiltrationMmH:0,drainageMmH:0});const r=slope.advanceTo(3600);balanced(r);assert(r.depth[2]>r.depth[0],'downhill accumulation');
const dry=new SurfaceWater(grid([0,0]),{...scenario,rainMmH:0});assert.equal(dry.advanceTo(3600).storedM3,0);
const lake=new SurfaceWater(grid([0,0,0]),{...scenario,infiltrationMmH:0,drainageMmH:0});const flat=lake.advanceTo(3600);assert(flat.depth.every(d=>Math.abs(d-.12)<1e-10));balanced(flat);
const split=new SurfaceWater(grid([2,1,0]),{...scenario,infiltrationMmH:0,drainageMmH:0});split.advanceTo(1700);assert.deepEqual(split.advanceTo(3600),r,'seek/play path deterministic');
for(const dx of [20,40,80]) {const q=new SurfaceWater(grid([0,0,0],dx),{...scenario,infiltrationMmH:0,drainageMmH:0}).advanceTo(3600);assert(Math.abs(q.depth[0]-.12)<1e-10);balanced(q);}
const drainage=new SurfaceWater(grid([0]),{...scenario,durationH:.5,drainageMmH:20});const wet=drainage.advanceTo(1800);assert(drainage.advanceTo(7200).storedM3<wet.storedM3);
const coast=grid([0,0,0]);coast.cells[0].coastal=true;const tide=new SurfaceWater(coast,{...scenario,rainMmH:0,seaHeadM:2});const tr=tide.advanceTo(3600);assert(tr.depth[0]>0);balanced(tr);
assert.throws(()=>new SurfaceWater(grid([0]),{...scenario,rainMmH:301}));
const real=JSON.parse(fs.readFileSync(path.join(__dirname,'../../public/models/manga/manga.json'),'utf8'));
const start=performance.now(),engine=new SurfaceWater(real.grid,scenario);const snapshots=[3600,7200,10800,14400].map(t=>{const r=engine.advanceTo(t);balanced(r);return r;});
const extreme=new SurfaceWater(real.grid,{...scenario,rainMmH:300,durationH:24,infiltrationMmH:0,drainageMmH:0,seaHeadM:5}).advanceTo(86400);balanced(extreme);
fs.writeFileSync(path.join(__dirname,'../../data/manga/water-demo.json'),JSON.stringify({scenario,snapshots}));
const report={date:new Date().toISOString(),checks:['dry','mass balance','nonnegative','downhill','lake symmetry','seek determinism','flat resolution 20/40/80m','drainage recession','coastal connection','range rejection','Manga extreme 24h'],computeMs:performance.now()-start,cells:real.grid.cells.length,normal:snapshots.at(-1),extreme};
delete report.normal.depth;delete report.normal.flux;delete report.extreme.depth;delete report.extreme.flux;
fs.writeFileSync(path.join(__dirname,'../../docs/manga/solver-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
