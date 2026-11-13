const {sendEvent}=require('../../shared/ipc.mjs')
const semver=require('semver'),resources=require('./resourceUpdates.cjs')
class ResourceUpdateController {
 constructor({options,readManifest,readArchive,restart}){this.options=options;this.readManifest=readManifest;this.readArchive=readArchive;this.restart=restart;this.sequence=0;this.busy=false;this.candidate=null}
 notify(window,status,extra={}){const result={status,...extra};if(window&&!window.isDestroyed())sendEvent(window.webContents,'hot-update-status',result);return result}
 async check(window){
  if(this.busy||this.installing)return {status:'busy',message:'Resource download is running'}
  const sequence=++this.sequence;this.abort?.abort();const abort=new AbortController();this.abort=abort
  try{
   if(!this.options.runtimeId)throw new Error(this.options.error||'Runtime build identity is unavailable')
   if(!this.options.publicKey)throw new Error('Resource publisher public key is not configured')
   const result=await this.readManifest(abort.signal)
   if(sequence!==this.sequence)return {status:'superseded'}
   resources.verifyManifest(result.manifest,this.options)
   const manifest=JSON.parse(JSON.stringify(result.manifest)),info=resources.resourceInfo(this.options)
   this.candidate=null
   if(info.status==='booting')throw new Error('Wait for renderer startup confirmation')
   if(info.pendingVersion){
    if(semver.lt(manifest.version,info.pendingVersion))throw new Error('Resource version is older than the staged renderer')
    if(semver.eq(manifest.version,info.pendingVersion)){
     if(resources.packageIdentity(manifest)!==info.pendingHash)throw new Error('A different package is already staged at this version')
     return this.notify(window,'finished',{version:manifest.version,message:'Resource update is already staged'})
    }
   }
   if(semver.lt(manifest.version,info.version))throw new Error('Resource version is older than the installed renderer')
   if(semver.eq(manifest.version,info.version)){
    if(info.hash&&info.hash!==resources.packageIdentity(manifest))throw new Error('A different package exists at this version')
    return this.notify(window,'update-not-available',{version:info.version})
   }
   const selected=resources.selectPackage(manifest,this.options)
   const archiveURL=manifest.schemaVersion===2?new URL(selected.archive,result.manifestURL||result.archiveURL).href:result.archiveURL
   this.candidate={manifest,archiveURL,snapshot:selected.kind==='snapshot',kind:selected.kind}
   return this.notify(window,'update-available',{version:manifest.version,kind:selected.kind})
  }catch(error){if(sequence!==this.sequence)return {status:'superseded'};this.candidate=null;return this.notify(window,'failed',{message:error.message})}
  finally{if(this.abort===abort)this.abort=null}
 }
 async download(window){
  if(this.busy||this.installing)return {status:'busy',message:'Resource download is already running'}
  const candidate=this.candidate;if(!candidate)return this.notify(window,'failed',{message:'Check a trusted resource update first'})
  this.busy=true;this.candidate=null;const sequence=++this.sequence,abort=new AbortController();this.abort=abort
  try{
   this.notify(window,'downloading',{kind:candidate.kind})
   const archive=await this.readArchive(candidate.archiveURL,abort.signal,progress=>{if(sequence===this.sequence)this.notify(window,'downloading',{percent:progress})})
   if(sequence!==this.sequence)return {status:'cancelled'}
   this.notify(window,'moving')
   resources.stage(candidate.manifest,Buffer.from(archive),this.options,{snapshot:candidate.snapshot})
   return this.notify(window,'finished',{version:candidate.manifest.version})
  }catch(error){return sequence!==this.sequence?{status:'cancelled'}:this.notify(window,'failed',{message:error.message})}
  finally{this.busy=false;if(this.abort===abort)this.abort=null}
 }
 cancel(window){
  try{if(this.installing)throw new Error('Resource restart already requested');resources.discard(this.options);++this.sequence;this.abort?.abort();this.candidate=null;this.notify(window,'cancelled',{message:'Resource update cancelled'});return {ok:true}}catch(error){return {ok:false,error:error.message}}
 }
 install(){
  const info=resources.resourceInfo(this.options)
  if(this.busy||this.installing||!info.pendingVersion||info.status!=='staged')return {ok:false,error:'Download and verify a resource update first'}
  try{this.installing=true;this.restart();return {ok:true}}catch(error){this.installing=false;return {ok:false,error:error.message}}
 }
}
module.exports={ResourceUpdateController}
