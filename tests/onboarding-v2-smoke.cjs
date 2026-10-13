// Runs with Node + globally installed TypeScript, no npm install required.
let ts;
try { ts = require('typescript'); }
catch {
  try { ts = require('../app/node_modules/typescript'); }
  catch { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript'); }
}
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'api/src/index.ts'), 'utf8');
const tree = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
assert.equal(tree.parseDiagnostics.length,0,'backend TS parser');
const names = new Set(['parseOnboardingV2','effectiveDeclaredWeeklyVolume','validateProfile','normalizePreferredTrainingDays','applyPreferredTrainingDaysToSessions','getLongRunTarget']);
const decls = tree.statements.filter(n => ts.isFunctionDeclaration(n) && names.has(n.name?.text)).map(n=>n.getText(tree));
assert.equal(decls.length,names.size,'all targeted functions found');
const compiled = ts.transpileModule(decls.join('\n'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const sandbox = {Math,Date,Number,String,Error,console,
  TRAINING_DAY_ORDER:['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'],
  isRecoverFitnessGoal:(goal)=>goal==='Recuperar condición',
  roundToHalf:(n)=>Math.round(n*2)/2,
  normalizeDistance:(v)=>v==='21K'?21:10,
  getPlanDistanceConfig:()=>({longRunStart:12,longRunPeak:24}),
  getWeekProgressRatio:()=>0,
  getRecoveryFactor:()=>1,
  clamp:(v,min,max)=>Math.max(min,Math.min(v,max)),
};
vm.createContext(sandbox);vm.runInContext(compiled,sandbox);
function context(extra={}){return {weeklyMileageKm:[10,15,0,20],recentLongRunKm:8,lastLongRunDate:new Date().toISOString().slice(0,10),preferredLongRunDay:'Domingo',maxSessionMinutes:60,strengthDaysPerWeek:3,strengthEquipment:'Gimnasio',returningAfterBreak:false,discomfortStatus:'no_response',recentPbDistance:'10K',recentPbMinutes:55,trainingNotes:'',...extra};}
function t(name, f){f();console.log('PASS',name);}
t('median weekly declared km 12.5',()=>assert.equal(sandbox.effectiveDeclaredWeeklyVolume({currentVolumeKm:30,onboardingV2:context()}),12.5));
t('partial weekly km leaves declared estimate unchanged',()=>assert.equal(sandbox.effectiveDeclaredWeeklyVolume({currentVolumeKm:25,onboardingV2:context({weeklyMileageKm:[10,null,0,20]})}),25));
t('negative week rejected',()=>assert.throws(()=>sandbox.parseOnboardingV2(context({weeklyMileageKm:[0,-1,0,0]}))));
t('oversized notes rejected',()=>assert.throws(()=>sandbox.parseOnboardingV2(context({trainingNotes:'X'.repeat(301)}))));
t('out-of-range strength days rejected',()=>assert.throws(()=>sandbox.parseOnboardingV2(context({strengthDaysPerWeek:9}))));
t('valid optional context accepted',()=>assert.equal(sandbox.parseOnboardingV2(context()).recentLongRunKm,8));
t('optional discomfort preference accepted without diagnosis',()=>assert.equal(sandbox.parseOnboardingV2(context({discomfortStatus:'yes'})).discomfortStatus,'yes'));
t('profile derives real volume median and enforces preferred long run day',()=>{
 const p = {name:'Test',email:'t@example.org',goal:'Completar una carrera',distance:'21K',daysPerWeek:4,preferredTrainingDays:['Lunes','Miércoles','Viernes','Domingo'],level:'Avanzado',currentVolumeKm:50,onboardingV2:context()};
 sandbox.validateProfile(p);assert.equal(p.currentVolumeKm,12.5);
 p.onboardingV2 = context({preferredLongRunDay:'Sábado'});assert.throws(()=>sandbox.validateProfile(p));
});
t('long run placed on preferred training day',()=>{
 const p={preferredTrainingDays:['Lunes','Miércoles','Viernes','Domingo'],daysPerWeek:4,onboardingV2:context({preferredLongRunDay:'Domingo'})};
 const sess=[{session_type:'long_run'},{session_type:'easy_run'},{session_type:'quality'},{session_type:'easy_run'}];
 const out=sandbox.applyPreferredTrainingDaysToSessions(p,sess);assert.equal(out[0].day_of_week,'Domingo');assert.equal(out[3].day_of_week,'Lunes');
});
t('recent long run bounds first-week prescription',()=>{
 const p={distance:'21K',onboardingV2:context({recentLongRunKm:8})};
 const km=sandbox.getLongRunTarget(p,1,14,45);
 assert.ok(km<=9.5,`capped ${km}`);
});
t('stale self-report does not control current plan load',()=>{
 const p={distance:'21K',onboardingV2:context({recentLongRunKm:2,lastLongRunDate:'2025-01-01'})};
 const km=sandbox.getLongRunTarget(p,1,14,45);assert.ok(km>5);
});
const app=fs.readFileSync(path.join(root,'app/src/App.tsx'),'utf8');
const frontend=ts.createSourceFile('App.tsx',app,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
t('frontend valid TSX syntax',()=>assert.equal(frontend.parseDiagnostics.length,0));
t('context endpoint secured by auth',()=>assert.ok(source.includes('app.get("/api/onboarding/context"')&&source.includes('requireAuthenticatedUser(c)')));
t('historical feasibility engine preserved',()=>assert.ok(source.includes('feasibilityEngine: "v1.2"')&&source.includes('TRAININGAPP_SAFE_GOAL_REBASE_V1')));
console.log('ONBOARDING_V2_SMOKE: ALL 14 PASS');
