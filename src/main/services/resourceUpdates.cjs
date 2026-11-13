const semver=require('semver')
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
const AdmZip=require('adm-zip'),zlib=require('node:zlib')
const fields=['schemaVersion','version','platform','arch','runtimeId','sha256','archive']
const maxSize=100*1024*1024,maxFiles=5000
const hash=value=>crypto.createHash('sha256').update(value).digest('hex')
function payload(m){return Buffer.from(JSON.stringify(Object.fromEntries([...fields,...(m.schemaVersion===2?['base','files','fallback']:[])].map(k=>[k,m[k]]))))}
function runtimeIdentity(input){
 const dependencies=Object.fromEntries(Object.entries(input.dependencies||{}).sort(([a],[b])=>a<b?-1:a>b?1:0))
 return crypto.createHash('sha256').update(fs.readFileSync(input.mainFile)).update(fs.readFileSync(input.preloadFile)).update(JSON.stringify([dependencies,input.lockHash||'',input.electronVersion,input.appVersion])).digest('hex')
}
function safePath(name){
 if(typeof name!=='string'||!name||name.includes('\\')||name.startsWith('/')||name.length>512||name.toLowerCase()==='publisher-manifest.json'||name.split('/').some(p=>!p||p==='.'||p==='..'||/[\x00-\x1f:<>"|?*]/.test(p)||/[. ]$/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))throw new Error('Unsafe or reserved resource path')
 return name
}
function validateFiles(files){
 if(!Array.isArray(files)||!files.length||files.length>maxFiles)throw new Error('Invalid resource inventory')
 let total=0;const seen=new Set()
 for(const f of files){
  const name=safePath(f.path).toLowerCase()
  if(seen.has(name))throw new Error('Duplicate resource inventory path')
  seen.add(name)
  if(!Number.isSafeInteger(f.size)||f.size<0||!(/^[a-f0-9]{64}$/).test(f.sha256))throw new Error('Invalid resource inventory file')
  total+=f.size
 }
 if(total>maxSize||!files.some(f=>f.path==='index.html'))throw new Error('Invalid resource inventory size or entry')
}
function inventory(dir){
 const files=[];let total=0
 function walk(folder,prefix=''){
  for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
   const name=prefix+entry.name
   if(name==='publisher-manifest.json')continue
   safePath(name)
   if(entry.isSymbolicLink())throw new Error('Resource symlink is forbidden')
   const file=path.join(folder,entry.name)
   if(entry.isDirectory())walk(file,name+'/')
   else{
    if(!entry.isFile())throw new Error('Invalid resource file')
    const size=fs.statSync(file).size;total+=size
    if(total>maxSize||files.length>=maxFiles)throw new Error('Resource inventory too large')
    files.push({path:name,size,sha256:hash(fs.readFileSync(file))})
   }
  }
 }
 walk(dir);files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);validateFiles(files);return files
}
function treeHash(files){return hash(JSON.stringify(files))}
function packageIdentity(m){return m.schemaVersion===2?treeHash(m.files):m.sha256}
function verifyManifest(m,o){
 if(!o.runtimeId)throw new Error(o.error||'Runtime build metadata is unavailable')
 if(!m||![1,2].includes(m.schemaVersion))throw new Error('Legacy or unsupported resource format; use a full installer')
 if(m.runtimeId!==o.runtimeId||m.platform!==o.platform||m.arch!==o.arch)throw new Error('Incompatible resource runtime/platform/architecture')
 if(!o.publicKey)throw new Error('Resource publisher public key is not configured')
 const validArchive=a=>a&&/^[\w.-]+\.zip$/.test(a.archive)&&/^[a-f0-9]{64}$/.test(a.sha256)
 if(!semver.valid(m.version)||!validArchive(m))throw new Error('Invalid resource manifest')
 if(m.schemaVersion===2){
  if(!semver.valid(m.base?.version)||!(/^[a-f0-9]{64}$/).test(m.base?.sha256)||!validArchive(m.fallback))throw new Error('Invalid delta base or fallback')
  validateFiles(m.files)
  if(m.files.some((f,i)=>i>0&&m.files[i-1].path>=f.path))throw new Error('Resource inventory must be sorted')
 }
 const key=o.publicKey.type==='public'?o.publicKey:crypto.createPublicKey(o.publicKey)
 if(key.asymmetricKeyType!=='ed25519'||typeof m.signature!=='string'||!crypto.verify(null,payload(m),key,Buffer.from(m.signature,'base64')))throw new Error('Invalid resource publisher signature')
}
function readState(o){try{return JSON.parse(fs.readFileSync(path.join(o.root,'state.json'),'utf8'))}catch{return null}}
function writeState(o,state){
 fs.mkdirSync(o.root,{recursive:true});const file=path.join(o.root,'state.json')
 fs.writeFileSync(file+'.tmp',JSON.stringify(state));fs.renameSync(file+'.tmp',file)
}
function entryFor(o,id){
 if(typeof id!=='string'||!(/^[a-f0-9]{64}$/).test(id))return null
 const dir=path.join(o.root,'versions',id),file=path.join(dir,'index.html')
 try{
  const m=JSON.parse(fs.readFileSync(path.join(dir,'publisher-manifest.json'),'utf8'));verifyManifest(m,o)
  if(m.schemaVersion===2&&treeHash(inventory(dir))!==treeHash(m.files))return null
  return fs.existsSync(file)?file:null
 }catch{return null}
}
function resourceInfo(o){
 const fallback={version:semver.valid(o.appVersion)||'0.0.0',pendingVersion:null,pendingHash:null,runningVersion:semver.valid(o.appVersion)||'0.0.0',status:'bundled',hash:null}
 const state=readState(o)
 if(!o.runtimeId||state?.runtimeId!==o.runtimeId)return fallback
 function manifest(id){try{const file=entryFor(o,id);return file?JSON.parse(fs.readFileSync(path.join(path.dirname(file),'publisher-manifest.json'),'utf8')):null}catch{return null}}
 const active=manifest(state.active),previous=manifest(state.previous),current=state.status==='ready'?active:previous
 const version=current?.version||fallback.version
 return {version,runningVersion:state.status==='booting'?(active?.version||version):version,pendingVersion:state.status==='ready'?null:active?.version||null,pendingHash:state.status==='ready'?null:active?packageIdentity(active):null,status:state.status,hash:current?packageIdentity(current):null}
}
function baseDirectory(o){
 const state=readState(o)
 const id=state?.runtimeId===o.runtimeId?(state.status==='ready'?state.active:state.previous):null
 const entry=entryFor(o,id)
 return entry?path.dirname(entry):o.bundledDir
}
function selectPackage(m,o){
 verifyManifest(m,o)
 if(m.schemaVersion===1)return {kind:'snapshot',archive:m.archive,sha256:m.sha256}
 try{if(resourceInfo(o).version===m.base.version&&treeHash(inventory(baseDirectory(o)))===m.base.sha256)return {kind:'delta',archive:m.archive,sha256:m.sha256}}catch{}
 return {kind:'snapshot',...m.fallback}
}
function stage(m,archive,o,{snapshot=false}={}){
 verifyManifest(m,o)
 const info=resourceInfo(o)
 if(info.status==='booting')throw new Error('Wait for renderer startup confirmation')
 if(semver.lte(m.version,info.pendingVersion||info.version))throw new Error('Resource version must be newer than the installed or staged renderer')
 const chosen=m.schemaVersion===2&&snapshot?m.fallback:m
 if(!Buffer.isBuffer(archive)||archive.length>50*1024*1024||hash(archive)!==chosen.sha256)throw new Error('Resource archive hash/size mismatch')
 if(m.schemaVersion===2&&!snapshot&&selectPackage(m,o).kind!=='delta')throw new Error('Resource delta base mismatch; use the complete snapshot')
 const zip=new AdmZip(archive),entries=zip.getEntries(),names=new Set();let total=0
 if(entries.length>maxFiles)throw new Error('Resource archive has too many files')
 for(const entry of entries){
  const name=safePath(entry.entryName.replace(/\/$/,''))
  if(names.has(name.toLowerCase())||((entry.header.attr>>>16)&0o170000)===0o120000)throw new Error('Unsafe ZIP duplicate path or symlink')
  names.add(name.toLowerCase());total+=entry.header.size
  if(total>maxSize)throw new Error('Resource archive too large')
  if(m.schemaVersion===2&&!entry.isDirectory&&!m.files.some(f=>f.path===name))throw new Error('ZIP file is outside the target inventory')
 }
 if(m.schemaVersion===1&&!entries.some(e=>e.entryName==='index.html'&&!e.isDirectory))throw new Error('Missing renderer entry')
 fs.mkdirSync(path.join(o.root,'versions'),{recursive:true});const temp=fs.mkdtempSync(path.join(o.root,'stage-'))
 try{
  let actual=0
  for(const entry of entries){
   const dest=path.join(temp,entry.entryName)
   if(entry.isDirectory)fs.mkdirSync(dest,{recursive:true})
   else{
    if(entry.header.encrypted||![0,8].includes(entry.header.method))throw new Error('Unsupported resource ZIP encoding')
    let data
    try{const compressed=entry.getCompressedData();data=entry.header.method===0?compressed:zlib.inflateRawSync(compressed,{maxOutputLength:Math.min(entry.header.size+1,maxSize-actual+1)})}catch{throw new Error('Resource ZIP decoded size exceeds its declared size')}
    if(data.length!==entry.header.size||zlib.crc32(data)!==(entry.header.crc>>>0))throw new Error('Resource ZIP decoded size or CRC mismatch')
    actual+=data.length;if(actual>maxSize)throw new Error('Resource archive too large')
    fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data)
   }
  }
  if(m.schemaVersion===2){
   if(!snapshot){const base=baseDirectory(o);for(const f of m.files)if(!fs.existsSync(path.join(temp,f.path))){const dest=path.join(temp,f.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(base,f.path),dest)}}
   if(treeHash(inventory(temp))!==treeHash(m.files))throw new Error('Resource target file hash/inventory mismatch')
  }
  fs.writeFileSync(path.join(temp,'publisher-manifest.json'),JSON.stringify(m))
  const id=hash(Buffer.concat([payload(m),Buffer.from(m.signature)])),target=path.join(o.root,'versions',id)
  // Revalidate an existing target instead of trusting a half-written or modified directory.
  if(fs.existsSync(target))fs.rmSync(target,{recursive:true,force:true})
  fs.renameSync(temp,target)
  const old=readState(o)
  writeState(o,{runtimeId:o.runtimeId,active:id,previous:old?.runtimeId===o.runtimeId?(old.status==='ready'?old.active:old.previous):null,status:'staged',version:m.version})
  return target
 }catch(error){fs.rmSync(temp,{recursive:true,force:true});throw error}
}
function discard(o){
 const s=readState(o)
 if(s?.runtimeId===o.runtimeId&&s.status==='booting')throw new Error('Renderer startup is being verified')
 if(s?.runtimeId===o.runtimeId&&s.status==='staged')writeState(o,{runtimeId:o.runtimeId,active:s.previous,previous:null,status:'ready'})
}
function selectEntry(o,bundled){
 if(!o.runtimeId)return bundled
 const s=readState(o);if(!s||s.runtimeId!==o.runtimeId)return bundled
 let entry=entryFor(o,s.active)
 if(s.status==='booting'||!entry){
  s.active=entryFor(o,s.previous)?s.previous:null;s.previous=null;s.status='ready';writeState(o,s)
  entry=entryFor(o,s.active)
 }else if(s.status==='staged'){s.status='booting';writeState(o,s)}
 return entry||bundled
}
function confirm(o){const s=readState(o);if(s?.runtimeId===o.runtimeId&&s.status==='booting'&&entryFor(o,s.active)){s.status='ready';writeState(o,s)}}
module.exports={payload,runtimeIdentity,verifyManifest,readState,stage,selectEntry,confirm,resourceInfo,inventory,treeHash,packageIdentity,selectPackage,discard}
