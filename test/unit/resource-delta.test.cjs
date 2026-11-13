const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),AdmZip=require('adm-zip')
const resources=require('../../src/main/services/resourceUpdates.cjs')
const hash=b=>crypto.createHash('sha256').update(b).digest('hex')
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'delta-resource-')),bundledDir=path.join(root,'bundled')
 fs.mkdirSync(bundledDir);const before={'index.html':Buffer.from('old'),'keep.bin':crypto.randomBytes(32000),'deleted.js':Buffer.from('delete')}
 const after={'index.html':Buffer.from('new'),'keep.bin':before['keep.bin'],'new.js':Buffer.from('added')}
 for(const [name,value] of Object.entries(before))fs.writeFileSync(path.join(bundledDir,name),value)
 const inventory=values=>Object.entries(values).sort(([a],[b])=>a<b?-1:1).map(([name,value])=>({path:name,size:value.length,sha256:hash(value)}))
 const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519'),zip=new AdmZip(),snapshot=new AdmZip()
 for(const [name,value] of Object.entries(after)){snapshot.addFile(name,value);if(!before[name]||!before[name].equals(value))zip.addFile(name,value)}
 const archive=zip.toBuffer(),full=snapshot.toBuffer()
 function sign(value){return {...value,signature:crypto.sign(null,resources.payload(value),privateKey).toString('base64')}}
 const manifest=sign({schemaVersion:2,version:'1.0.1',platform:process.platform,arch:process.arch,runtimeId:'a'.repeat(64),sha256:hash(archive),archive:'delta.zip',base:{version:'1.0.0',sha256:hash(JSON.stringify(inventory(before)))},files:inventory(after),fallback:{archive:'full.zip',sha256:hash(full)}})
 return {root,bundledDir,archive,full,manifest,sign,before,after,options:{root:path.join(root,'updates'),bundledDir,publicKey,platform:process.platform,arch:process.arch,runtimeId:'a'.repeat(64),appVersion:'1.0.0'},close(){fs.rmSync(root,{recursive:true,force:true})}}
}
test('delta applies changed files, retains unchanged bytes and removes deleted files',()=>{
 const f=fixture();try{
  const dir=resources.stage(f.manifest,f.archive,f.options)
  assert.deepEqual(fs.readdirSync(dir).sort(),['index.html','keep.bin','new.js','publisher-manifest.json'])
  for(const [name,bytes] of Object.entries(f.after))assert.deepEqual(fs.readFileSync(path.join(dir,name)),bytes)
  assert.ok(f.archive.length<f.full.length/10)
  assert.equal(fs.readFileSync(path.join(f.bundledDir,'index.html'),'utf8'),'old')
  resources.selectEntry(f.options,'bundled');resources.confirm(f.options)
  assert.equal(resources.resourceInfo(f.options).version,'1.0.1')
 }finally{f.close()}
})
test('base mismatch uses authenticated complete snapshot and a forged target inventory is rejected',()=>{
 const f=fixture();try{
  fs.writeFileSync(path.join(f.bundledDir,'keep.bin'),'wrong base')
  assert.equal(resources.selectPackage(f.manifest,f.options).kind,'snapshot')
  assert.throws(()=>resources.stage(f.manifest,f.archive,f.options),/base/)
  const dir=resources.stage(f.manifest,f.full,f.options,{snapshot:true})
  assert.deepEqual(fs.readFileSync(path.join(dir,'keep.bin')),f.after['keep.bin'])
  assert.throws(()=>resources.verifyManifest({...f.manifest,files:[]},f.options))
 }finally{f.close()}
})
test('signed incomplete payload, metadata collision and Windows aliases leave the prior version untouched',()=>{
 const f=fixture();try{
  const zip=new AdmZip();zip.addFile('new.js',Buffer.from('corrupt'));const bytes=zip.toBuffer()
  assert.throws(()=>resources.stage(f.sign({...f.manifest,sha256:hash(bytes)}),bytes,f.options),/file|hash|inventory/i)
  for(const name of ['../escape','publisher-manifest.json','NUL.txt','index.html:stream','INDEX.html']){
   const manifest=f.sign({...f.manifest,files:[...f.manifest.files,{path:name,size:1,sha256:hash('x')}]})
   assert.throws(()=>resources.stage(manifest,f.archive,f.options),/path|inventory|duplicate|reserved/i)
  }
  assert.equal(resources.resourceInfo(f.options).version,'1.0.0')
 }finally{f.close()}
})
test('a damaged staged tree cannot become the running renderer',()=>{
 const f=fixture();try{
  const dir=resources.stage(f.manifest,f.archive,f.options)
  fs.writeFileSync(path.join(dir,'keep.bin'),'tampered')
  assert.equal(resources.selectEntry(f.options,'bundled'),'bundled')
 }finally{f.close()}
})
test('damaged staged files roll back to the last confirmed tree rather than bundled HTML',()=>{
 const f=fixture();try{
  const first=resources.stage(f.manifest,f.archive,f.options),lastGood=resources.selectEntry(f.options,'bundled');resources.confirm(f.options)
  const zip=new AdmZip(),archive=zip.toBuffer(),next=f.sign({...f.manifest,version:'1.0.2',base:{version:'1.0.1',sha256:resources.treeHash(resources.inventory(first))},sha256:hash(archive)})
  const staged=resources.stage(next,archive,f.options);fs.writeFileSync(path.join(staged,'keep.bin'),'damaged')
  assert.equal(resources.selectEntry(f.options,'bundled'),lastGood)
  resources.confirm(f.options)
  assert.equal(resources.resourceInfo(f.options).version,'1.0.1')
 }finally{f.close()}
})
