const semver=require('semver')
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
const AdmZip=require('adm-zip')
const fields=['schemaVersion','version','platform','arch','runtimeId','sha256','archive']
function payload(m){return Buffer.from(JSON.stringify(Object.fromEntries(fields.map(k=>[k,m[k]]))))}
function runtimeIdentity(input){
 const dependencies=Object.fromEntries(Object.entries(input.dependencies||{}).sort(([a],[b])=>a<b?-1:a>b?1:0))
 return crypto.createHash('sha256').update(fs.readFileSync(input.mainFile)).update(fs.readFileSync(input.preloadFile)).update(JSON.stringify([dependencies,input.lockHash||'',input.electronVersion,input.appVersion])).digest('hex')
}
function verifyManifest(m,o){
 if(!o.runtimeId)throw new Error(o.error||'Runtime build metadata is unavailable')
 if(!m||m.schemaVersion!==1)throw new Error('Legacy or unsupported resource format; use a full installer')
 if(m.runtimeId!==o.runtimeId||m.platform!==o.platform||m.arch!==o.arch)throw new Error('Incompatible resource runtime/platform/architecture')
 if(!o.publicKey)throw new Error('Resource publisher public key is not configured')
 if(!semver.valid(m.version)||!(/^[a-f0-9]{64}$/).test(m.sha256)||typeof m.archive!=='string'||!(/^[\w.-]+\.zip$/).test(m.archive))throw new Error('Invalid resource manifest')
 const key=o.publicKey.type==='public'?o.publicKey:crypto.createPublicKey(o.publicKey)
 if(key.asymmetricKeyType!=='ed25519'||typeof m.signature!=='string'||!crypto.verify(null,payload(m),key,Buffer.from(m.signature,'base64')))throw new Error('Invalid resource publisher signature')
}
function readState(o){try{return JSON.parse(fs.readFileSync(path.join(o.root,'state.json'),'utf8'))}catch{return null}}
function writeState(o,state){
 fs.mkdirSync(o.root,{recursive:true})
 const file=path.join(o.root,'state.json')
 fs.writeFileSync(file+'.tmp',JSON.stringify(state))
 fs.renameSync(file+'.tmp',file)
}
function stage(m,archive,o){
 verifyManifest(m,o)
 const info=resourceInfo(o)
 if(semver.lte(m.version,info.pendingVersion||info.version))throw new Error('Resource version must be newer than the installed or staged renderer')
 if(!Buffer.isBuffer(archive)||archive.length>50*1024*1024||crypto.createHash('sha256').update(archive).digest('hex')!==m.sha256)throw new Error('Resource archive hash/size mismatch')
 const zip=new AdmZip(archive);let total=0
 const entries=zip.getEntries()
 for(const entry of entries){
   const name=entry.entryName.replace(/\\/g,'/')
   if(!name||name.startsWith('/')||/^[A-Za-z]:/.test(name)||name.split('/').includes('..')||name.includes('\0')||((entry.header.attr>>>16)&0o170000)===0o120000)throw new Error('Unsafe ZIP path or symlink')
   total+=entry.header.size
   if(total>100*1024*1024)throw new Error('Resource archive too large')
 }
 if(!entries.some(e=>e.entryName==='index.html'&&!e.isDirectory))throw new Error('Missing renderer entry')
 fs.mkdirSync(path.join(o.root,'versions'),{recursive:true})
 const temp=fs.mkdtempSync(path.join(o.root,'stage-'))
 try {
   for(const entry of entries){
     const dest=path.join(temp,entry.entryName.replace(/\\/g,'/'))
     if(entry.isDirectory)fs.mkdirSync(dest,{recursive:true})
     else{fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,entry.getData())}
   }
   fs.writeFileSync(path.join(temp,'publisher-manifest.json'),JSON.stringify(m))
   const id=crypto.createHash('sha256').update(payload(m)).update(m.signature).digest('hex')
   const target=path.join(o.root,'versions',id)
   if(fs.existsSync(target))fs.rmSync(temp,{recursive:true,force:true})
   else fs.renameSync(temp,target)
   const old=readState(o)
   writeState(o,{runtimeId:o.runtimeId,active:id,previous:old?.runtimeId===o.runtimeId?(old.status==='ready'?old.active:old.previous):null,status:'staged',version:m.version})
   return target
 }catch(error){fs.rmSync(temp,{recursive:true,force:true});throw error}
}
function entryFor(o,id){
 if(typeof id!=='string'||!(/^[a-f0-9]{64}$/).test(id))return null
 const dir=path.join(o.root,'versions',id),file=path.join(dir,'index.html')
 try{verifyManifest(JSON.parse(fs.readFileSync(path.join(dir,'publisher-manifest.json'),'utf8')),o);return fs.existsSync(file)?file:null}catch{return null}
}
function resourceInfo(o){
 const fallback={version:semver.valid(o.appVersion)||'0.0.0',pendingVersion:null,pendingHash:null,runningVersion:semver.valid(o.appVersion)||'0.0.0',status:'bundled'}
 const state=readState(o)
 if(!o.runtimeId||state?.runtimeId!==o.runtimeId)return fallback
 function manifest(id){try{const file=entryFor(o,id);return file?JSON.parse(fs.readFileSync(path.join(path.dirname(file),'publisher-manifest.json'),'utf8')):null}catch{return null}}
 const active=manifest(state.active),previous=manifest(state.previous)
 const version=(state.status==='ready'?active:previous)?.version||fallback.version
 return {version,runningVersion:state.status==='booting'?(active?.version||version):version,pendingVersion:state.status==='ready'?null:active?.version||null,pendingHash:state.status==='ready'?null:active?.sha256||null,status:state.status}
}
function selectEntry(o,bundled){
 if(!o.runtimeId)return bundled
 const s=readState(o)
 if(!s||s.runtimeId!==o.runtimeId)return bundled
 if(s.status==='booting'){
   s.active=s.previous;s.previous=null;s.status='ready';writeState(o,s)
 }else if(s.status==='staged'){s.status='booting';writeState(o,s)}
 return entryFor(o,s.active)||bundled
}
function confirm(o){const s=readState(o);if(s?.runtimeId===o.runtimeId&&s.status==='booting'){s.status='ready';writeState(o,s)}}
module.exports={payload,runtimeIdentity,verifyManifest,readState,stage,selectEntry,confirm,resourceInfo}
