const {sendEvent}=require('../../shared/ipc.mjs')
class UpdateController {
 constructor(updater,tokenFactory){
   this.updater=updater;this.tokenFactory=tokenFactory;this.owner=null;this.state='idle';this.generation=0
   updater.autoDownload=false;updater.autoInstallOnAppQuit=false
   // Completion/readiness comes from our owned Promise, never uncorrelated late events.
   updater.on('error',error=>{if(this.state==='installing')this.fail(error)})
   updater.on('download-progress',info=>{if(this.state==='downloading')this.message(3,info)})
 }
 message(state,msg=''){if(this.owner&&!this.owner.isDestroyed())sendEvent(this.owner.webContents,'update-msg',{state,msg})}
 fail(error){this.lastError=error.message;this.state='failed';this.message(-1,error.message);return {ok:false,error:error.message}}
 busy(){return ['checking','downloading','cancelling','installing'].includes(this.state)}
 async check(window,source){
   if(this.state==='downloaded'){this.owner=window;return {ok:true,available:true,downloaded:true,info:this.updateInfo||{}}}
   if(this.busy())return {ok:false,error:'Update already running or cancelling'}
   this.owner=window
   const generation=++this.generation
   try{
     if(!source)throw new Error('Full update source is not configured')
     const url=new URL(source)
     if(url.username||url.password||(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))))throw new Error('Full update source must use HTTPS')
     this.updater.setFeedURL({provider:'generic',url:url.href})
     this.state='checking';this.message(0)
     const result=await this.updater.checkForUpdates()
     if(generation!==this.generation)return {ok:false,error:'Update cancelled'}
     if(!result)throw new Error('Full updates require a packaged application')
     this.updateInfo=result.updateInfo||{}
     this.state=result.isUpdateAvailable?'available':'idle'
     this.message(result.isUpdateAvailable?1:2,result.updateInfo||'')
     return {ok:true,available:Boolean(result.isUpdateAvailable),info:result.updateInfo||{}}
   }catch(error){return generation===this.generation?this.fail(error):{ok:false,error:'Update cancelled'}}
   finally{if(this.state==='cancelling'&&generation!==this.generation)this.state='idle'}
 }
 async download(){
   if(this.state!=='available')return {ok:false,error:'No verified full update available'}
   const generation=++this.generation,token=this.tokenFactory()
   this.token=token;this.state='downloading'
   try{
     await this.updater.downloadUpdate(token)
     if(generation!==this.generation)return {ok:false,error:'Update cancelled'}
     this.state='downloaded';this.message(4);return {ok:true}
   }catch(error){return generation===this.generation?this.fail(error):{ok:false,error:'Update cancelled'}}
   finally{if(this.token===token)this.token=null;if(this.state==='cancelling'&&generation!==this.generation)this.state='idle'}
 }
 cancel(){
   if(this.state==='installing')return {ok:false,error:'Installer already requested'}
   ++this.generation
   const running=['checking','downloading','cancelling'].includes(this.state)
   this.state=running?'cancelling':'idle'
   this.token?.cancel()
   this.message(-1,'Update cancelled')
   return {ok:true}
 }
 install(){
   if(this.state!=='downloaded')return {ok:false,error:'Download a full update first'}
   try{this.state='installing';this.updater.quitAndInstall();return this.state==='failed'?{ok:false,error:this.lastError}:{ok:true}}catch(error){return this.fail(error)}
 }
}
module.exports={UpdateController}
