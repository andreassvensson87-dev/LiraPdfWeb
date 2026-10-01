import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/update-ui.js', import.meta.url),'utf8').replace('export function','function');
test('update waits for save, never reloads automatically, and supports blocked activation retry',async()=>{
  const events={}, sent=[]; let reloads=0, finish;
  const button={classList:{add(){}},hidden:true,disabled:false},status={};
  const registration={waiting:{postMessage:m=>sent.push(m)},addEventListener(){},update:async()=>{}};
  const ctx={navigator:{serviceWorker:{addEventListener:(n,f)=>events[n]=f}},window:{addEventListener(){}},document:{addEventListener(){},hidden:false},location:{reload:()=>reloads++},setInterval(){}};
  vm.createContext(ctx); vm.runInContext(source,ctx);
  ctx.watchAppUpdate(registration,button,status,()=>new Promise(resolve=>finish=resolve));
  assert.equal(button.hidden,false);
  events.controllerchange(); assert.equal(reloads,0);
  const pending=button.onclick(); assert.equal(sent.length,0);assert.equal(button.disabled,true);
  finish();await pending;assert.equal(sent.length,1);
  events.message({data:{type:'UPDATE_BLOCKED'}});assert.equal(button.disabled,false);
  events.controllerchange();assert.equal(reloads,0);
  const retry=button.onclick();finish();await retry;events.controllerchange();assert.equal(reloads,1);
});
test('failed persistence prevents activation',async()=>{
  const button={classList:{add(){}},disabled:false},status={};let sent=false;
  const ctx={navigator:{serviceWorker:{addEventListener(){}}},window:{addEventListener(){}},document:{addEventListener(){}},location:{reload(){}},setInterval(){}};
  vm.createContext(ctx);vm.runInContext(source,ctx);
  ctx.watchAppUpdate({waiting:{postMessage:()=>sent=true},addEventListener(){}},button,status,async()=>{throw Error('disk full');});
  await button.onclick();assert.equal(sent,false);assert.equal(button.disabled,false);assert.match(status.textContent,/Spara/);
});
