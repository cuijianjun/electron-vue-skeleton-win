const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto')
const AdmZip=require('adm-zip')
const {stage,selectEntry,confirm,runtimeIdentity}=require('../../src/main/services/resourceUpdates.cjs')
const {fixture}=require('./resource-fixture.cjs')

test('authenticated resource stage changes no runtime files; first failed boot rolls back',()=>{
 const f=fixture();try{
  const {manifest,archive}=f.make();stage(manifest,archive,f.options)
  const entry=selectEntry(f.options,'/bundled/index.html')
  assert.equal(fs.readFileSync(entry,'utf8'),'new renderer')
  assert.equal(selectEntry(f.options,'/bundled/index.html'),'/bundled/index.html')
 }finally{f.close()}
})
test('confirmed resource boots remain active and a later failed update preserves them',()=>{
 const f=fixture();try{
  const first=f.make();stage(first.manifest,first.archive,f.options)
  const active=selectEntry(f.options,'/bundled/index.html');confirm(f.options)
  assert.equal(selectEntry(f.options,'/bundled/index.html'),active)
  const bad=f.make('not-index.html','missing entry','1.0.2')
  assert.throws(()=>stage(bad.manifest,bad.archive,f.options),/entry/)
  assert.equal(selectEntry(f.options,'/bundled/index.html'),active)
 }finally{f.close()}
})
test('legacy format, forged signature, wrong runtime and corrupted bytes fail closed',()=>{
 const f=fixture();try{
  const {manifest,archive}=f.make()
  assert.throws(()=>stage({...manifest,schemaVersion:0},archive,f.options))
  assert.throws(()=>stage({...manifest,version:'9.0.0'},archive,f.options),/signature/)
  assert.throws(()=>stage(manifest,archive,{...f.options,runtimeId:'b'.repeat(64)}),/runtime/)
  assert.throws(()=>stage(manifest,Buffer.from('corrupted'),f.options),/hash/)
  assert.throws(()=>stage(manifest,archive,{...f.options,publicKey:null}),/key/)
 }finally{f.close()}
})
test('even signed ZIP path traversal is rejected before extraction',()=>{
 const f=fixture();try{
  let {archive}=f.make('aa/escape')
  for(let i=archive.indexOf('aa/escape');i>=0;i=archive.indexOf('aa/escape',i+9))archive.write('../escape',i)
  const signed=f.sign(archive)
  assert.throws(()=>stage(signed.manifest,signed.archive,f.options),/path/)
 }finally{f.close()}
})
test('runtime identity binds main, preload, dependencies and Electron',()=>{
 const f=fixture();try{
  const main=path.join(f.root,'main');const preload=path.join(f.root,'preload')
  fs.writeFileSync(main,'main');fs.writeFileSync(preload,'preload')
  const input={mainFile:main,preloadFile:preload,dependencies:{a:'1'},electronVersion:'44.7.2',appVersion:'1.0.0'}
  const value=runtimeIdentity(input)
  assert.notEqual(runtimeIdentity({...input,electronVersion:'44.7.3'}),value)
  assert.notEqual(runtimeIdentity({...input,dependencies:{a:'2'}}),value)
  fs.writeFileSync(preload,'changed');assert.notEqual(runtimeIdentity(input),value)
 }finally{f.close()}
})

test('failed atomic activation leaves the previously confirmed resource usable',()=>{
 const f=fixture();const rename=fs.renameSync;try{
  let value=f.make();stage(value.manifest,value.archive,f.options)
  const active=selectEntry(f.options,'/bundled/index.html');confirm(f.options)
  value=f.make('index.html','new candidate','1.0.2')
  fs.renameSync=(from,to)=>{if(to===path.join(f.root,'state.json'))throw new Error('activation denied');return rename(from,to)}
  assert.throws(()=>stage(value.manifest,value.archive,f.options),/activation denied/)
  fs.renameSync=rename
  assert.equal(selectEntry(f.options,'/bundled/index.html'),active)
 }finally{fs.renameSync=rename;f.close()}
})

test('same and older signed resource versions cannot replace a confirmed renderer',()=>{
 const f=fixture();try{
  const good=f.make();stage(good.manifest,good.archive,f.options)
  selectEntry(f.options,'/bundled/index.html');confirm(f.options)
  assert.throws(()=>stage(good.manifest,good.archive,f.options),/newer/)
  const old=f.make('index.html','old signed payload','1.0.0')
  assert.throws(()=>stage(old.manifest,old.archive,f.options),/newer/)
 }finally{f.close()}
})
