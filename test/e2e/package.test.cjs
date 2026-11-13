const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto')
const {spawnSync}=require('node:child_process'),AdmZip=require('adm-zip')
test('built runtime has portable lock identity and resource CLI emits only signed renderer files',()=>{
 const root=path.resolve(__dirname,'../..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'resource-package-'))
 try{
  const metadata=JSON.parse(fs.readFileSync(path.join(root,'dist/electron/runtime-build.json'),'utf8'))
  assert.equal(metadata.lockHash,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'package-lock.json'))).digest('hex'))
  const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519')
  const key=path.join(temp,'signer.pem');fs.writeFileSync(key,privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600})
  const out=path.join(temp,'output')
  const result=spawnSync(process.execPath,['scripts/pack-resources.cjs','--platform','linux','--arch','arm64','--version','1.0.1','--signing-key',key,'--out',out],{cwd:root,encoding:'utf8'})
  assert.equal(result.status,0,result.stderr)
  const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'))
  const signature=manifest.signature;delete manifest.signature
  assert.ok(crypto.verify(null,Buffer.from(JSON.stringify(manifest)),publicKey,Buffer.from(signature,'base64')))
  assert.equal(manifest.platform,'linux');assert.equal(manifest.arch,'arm64')
  const archive=fs.readFileSync(path.join(out,manifest.archive))
  assert.equal(crypto.createHash('sha256').update(archive).digest('hex'),manifest.sha256)
  const names=new AdmZip(archive).getEntries().map(e=>e.entryName)
  assert.ok(names.includes('index.html'))
  assert.ok(names.every(n=>n==='index.html'||n.startsWith('assets/')))
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
})

test('resource CLI creates a smaller authenticated delta and a complete fallback',()=>{
 const resources=require('../../src/main/services/resourceUpdates.cjs'),root=path.resolve(__dirname,'../..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'resource-delta-cli-'))
 try{
  const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519'),key=path.join(temp,'key.pem'),base=path.join(temp,'base'),out=path.join(temp,'out')
  fs.writeFileSync(key,privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600})
  fs.cpSync(path.join(root,'dist/electron/renderer'),base,{recursive:true});fs.writeFileSync(path.join(base,'index.html'),'old renderer');fs.writeFileSync(path.join(base,'obsolete.js'),'delete me')
  const result=spawnSync(process.execPath,['scripts/pack-resources.cjs','--platform','linux','--arch','x64','--version','1.0.1','--signing-key',key,'--base-dir',base,'--base-version','1.0.0','--out',out],{cwd:root,encoding:'utf8'})
  assert.equal(result.status,0,result.stderr)
  const m=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'))),archive=fs.readFileSync(path.join(out,m.archive)),full=fs.readFileSync(path.join(out,m.fallback.archive))
  assert.equal(m.schemaVersion,2);assert.ok(archive.length<full.length/10)
  const options={root:path.join(temp,'client'),bundledDir:base,appVersion:'1.0.0',platform:'linux',arch:'x64',runtimeId:m.runtimeId,publicKey}
  resources.verifyManifest(m,options);const target=resources.stage(m,archive,options)
  assert.ok(!fs.existsSync(path.join(target,'obsolete.js')))
  assert.deepEqual(resources.inventory(target),resources.inventory(path.join(root,'dist/electron/renderer')))
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
})
