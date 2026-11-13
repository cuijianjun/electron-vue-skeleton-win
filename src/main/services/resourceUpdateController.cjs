const {sendEvent}=require('../../shared/ipc.mjs')
const semver=require('semver')
const resources=require('./resourceUpdates.cjs')
class ResourceUpdateController {
 constructor({options,readManifest,readArchive}){this.options=options;this.readManifest=readManifest;this.readArchive=readArchive;this.sequence=0;this.busy=false;this.candidate=null}
 notify(window,status,extra={}){
   const result={status,...extra}
   if(window&&!window.isDestroyed())sendEvent(window.webContents,'hot-update-status',result)
   return result
 }
 async check(window){
   if(this.busy)return {status:'busy',message:'Resource download is running'}
   const sequence=++this.sequence
   try{
     if(!this.options.runtimeId)throw new Error(this.options.error||'Runtime build identity is unavailable')
     if(!this.options.publicKey)throw new Error('Resource publisher public key is not configured')
     const result=await this.readManifest()
     if(sequence!==this.sequence)return {status:'superseded'}
     resources.verifyManifest(result.manifest,this.options)
     const manifest=Object.freeze({...result.manifest}),info=resources.resourceInfo(this.options)
     this.candidate=null
     if(info.pendingVersion){
       if(semver.lt(manifest.version,info.pendingVersion))throw new Error('Resource version is older than the staged renderer')
       if(semver.eq(manifest.version,info.pendingVersion)){
         if(manifest.sha256!==info.pendingHash)throw new Error('A different package is already staged at this version')
         return this.notify(window,'finished',{version:manifest.version,message:'Resource update is already staged'})
       }
     }
     if(semver.lt(manifest.version,info.version))throw new Error('Resource version is older than the installed renderer')
     if(semver.eq(manifest.version,info.version))return this.notify(window,'update-not-available',{version:info.version})
     this.candidate=Object.freeze({manifest,archiveURL:result.archiveURL})
     return this.notify(window,'update-available',{version:manifest.version})
   }catch(error){
     if(sequence!==this.sequence)return {status:'superseded'}
     this.candidate=null;return this.notify(window,'failed',{message:error.message})
   }
 }
 async download(window){
   if(this.busy)return {status:'busy',message:'Resource download is already running'}
   const candidate=this.candidate
   if(!candidate)return this.notify(window,'failed',{message:'Check a trusted resource update first'})
   this.busy=true;this.candidate=null;++this.sequence
   try{
     this.notify(window,'downloading')
     const archive=await this.readArchive(candidate.archiveURL)
     this.notify(window,'moving')
     resources.stage(candidate.manifest,Buffer.from(archive),this.options)
     return this.notify(window,'finished',{version:candidate.manifest.version})
   }catch(error){return this.notify(window,'failed',{message:error.message})}
   finally{this.busy=false}
 }
}
module.exports={ResourceUpdateController}
