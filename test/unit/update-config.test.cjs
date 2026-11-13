const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto')
test('packaged update configuration works without process environment and explicit overrides win',()=>{
 const {readUpdateConfig}=require('../../src/main/services/updateConfig.cjs')
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'update-config-')),file=path.join(dir,'updates.json')
 try{
  const key=crypto.generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'})
  fs.writeFileSync(file,JSON.stringify({fullURL:'https://updates.example/full/',resourceURL:'https://updates.example/renderer/manifest.json',publicKey:key,autoCheck:true,intervalHours:6}))
  const config=readUpdateConfig(file,{})
  assert.equal(config.fullURL,'https://updates.example/full/');assert.equal(config.resourceURL,'https://updates.example/renderer/manifest.json');assert.equal(config.publicKey,key);assert.equal(config.intervalHours,6)
  assert.equal(readUpdateConfig(file,{APP_UPDATE_URL:''}).fullURL,'')
  assert.equal(readUpdateConfig(file,{RESOURCE_UPDATE_PUBLIC_KEY_FILE:path.join(dir,'missing.pem')}).publicKey,null)
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
test('malformed configuration disables update sources without preventing application startup',()=>{
 const {readUpdateConfig}=require('../../src/main/services/updateConfig.cjs'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'invalid-update-config-')),file=path.join(dir,'updates.json')
 try{
  for(const value of [null,[],{fullURL:42},{resourceURL:{}},{publicKey:17},{autoCheck:'true'},{intervalHours:0}]){
   fs.writeFileSync(file,JSON.stringify(value));let config
   assert.doesNotThrow(()=>{config=readUpdateConfig(file,{})});assert.equal(config.fullURL,'');assert.equal(config.resourceURL,'');assert.ok(config.error)
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
