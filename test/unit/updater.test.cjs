const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events')
const {UpdateController}=require('../../src/main/services/updateController.cjs')
function fixture(){
 const updater=new EventEmitter();let checks=0,installs=0,token
 updater.setFeedURL=()=>{}
 updater.checkForUpdates=async()=>{checks++;updater.emit('update-available',{version:'1.0.1'});return {isUpdateAvailable:true,updateInfo:{version:'1.0.1'}}}
 updater.downloadUpdate=async value=>{token=value;updater.emit('update-downloaded')}
 updater.quitAndInstall=()=>{installs++}
 const messages=[]
 const controller=new UpdateController(updater,()=>({cancelled:false,cancel(){this.cancelled=true}}))
 return {controller,updater,messages,window:{isDestroyed:()=>false,webContents:{send:(_channel,m)=>messages.push(m)}},get checks(){return checks},get installs(){return installs},get token(){return token}}
}
test('unconfigured and insecure update sources do not invoke a provider',async()=>{
 const f=fixture();assert.equal((await f.controller.check(f.window,'')).ok,false)
 assert.equal((await f.controller.check(f.window,'http://untrusted.example/feed')).ok,false)
 assert.equal(f.checks,0);assert.equal(f.messages.at(-1).state,-1)
})
test('full update lifecycle, cancellation and install readiness are explicit',async()=>{
 const f=fixture();assert.equal(f.controller.install().ok,false)
 await f.controller.check(f.window,'http://127.0.0.1:8888/feed')
 assert.equal(f.messages.at(-1).state,1)
 await f.controller.download();assert.equal(f.messages.at(-1).state,4)
 assert.equal(f.controller.install().ok,true);assert.equal(f.installs,1)
 f.controller.cancel();assert.equal(f.controller.install().ok,false)
})
test('in-flight cancellation blocks overlap and late completion cannot enable install',async()=>{
 const f=fixture();let reject
 f.updater.downloadUpdate=()=>new Promise((_resolve,fail)=>{reject=fail})
 await f.controller.check(f.window,'https://updates.example.invalid')
 const pending=f.controller.download();f.controller.cancel()
 assert.equal((await f.controller.check(f.window,'https://updates.example.invalid')).ok,false)
 f.updater.emit('update-downloaded')
 assert.equal(f.controller.install().ok,false)
 reject(new Error('cancelled'))
 await pending
 await f.controller.check(f.window,'https://updates.example.invalid')
 f.updater.emit('error',new Error('late cancellation error'))
 f.updater.emit('update-downloaded')
 assert.equal(f.controller.state,'available')
 assert.equal(f.controller.install().ok,false)
})
test('provider failures and destroyed-window events are handled without uncaught errors',async()=>{
 const f=fixture();f.updater.checkForUpdates=async()=>{throw new Error('offline')}
 assert.equal((await f.controller.check(f.window,'https://updates.example.invalid')).ok,false)
 assert.match(f.messages.at(-1).msg,/offline/)
 f.window.isDestroyed=()=>true
 assert.doesNotThrow(()=>f.updater.emit('error',new Error('permission denied')))
})
test('installer permission failure is visible and never reported as completed',async()=>{
 const f=fixture()
 await f.controller.check(f.window,'https://updates.example.invalid')
 await f.controller.download()
 f.updater.quitAndInstall=()=>f.updater.emit('error',new Error('permission denied'))
 assert.equal(f.controller.install().ok,false)
 assert.equal(f.controller.state,'failed')
 assert.match(f.messages.at(-1).msg,/permission denied/)
})
