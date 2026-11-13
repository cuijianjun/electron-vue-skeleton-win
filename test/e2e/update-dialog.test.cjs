const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os')
const {_electron}=require('playwright')
test('update route shows full/resource choices and routes confirmation to the matching transport',{timeout:45000},async()=>{
 const userData=await fs.mkdtemp(path.join(os.tmpdir(),'update-dialog-'))
 const env={...process.env,SKELETON_E2E:'1',SKELETON_USER_DATA:userData}
 for(const name of ['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','APP_UPDATE_URL','APP_DOWNLOAD_URL','RESOURCE_UPDATE_URL','RESOURCE_UPDATE_PUBLIC_KEY','RESOURCE_UPDATE_PUBLIC_KEY_FILE'])delete env[name]
 const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve(__dirname,'../..')],env,timeout:15000})
 try{
  const page=await app.firstWindow();await page.waitForSelector('.home')
  await page.evaluate(()=>{window.__realDialogBridge=document.querySelector('#app').__vue_app__.config.globalProperties.$ipcRenderer})
  for(const full of [true,false]){
   await page.evaluate(async full=>{
    localStorage.removeItem('tomorrowTipStartTime')
    const vue=document.querySelector('#app').__vue_app__,callbacks={},calls=[]
    window.__dialogCalls=calls
    vue.config.globalProperties.$ipcRenderer={
      subscribe(channel,callback){callbacks[channel]=callback;return ()=>delete callbacks[channel]},
      async invoke(channel){
       calls.push(channel)
       if(channel==='get-resource-version')return '1.0.0'
       if(channel==='check-update'){callbacks['update-msg']?.(null,{state:full?1:2,msg:{version:'1.0.1'}});return {ok:true,available:full,info:{version:'1.0.1'}}}
       if(channel==='hot-update'){callbacks['hot-update-status']?.(null,{status:'update-available',version:'1.0.1'});return {status:'update-available',version:'1.0.1'}}
       return {ok:true}
      }
    }
    await vue.config.globalProperties.$router.push('/updateTip')
   },full)
   await page.waitForFunction(()=>Boolean(document.querySelector('#app').__vue_app__.config.globalProperties.$router.currentRoute.value.matched.at(-1).instances.default?.getUpdateInfo))
   await page.evaluate(()=>document.querySelector('#app').__vue_app__.config.globalProperties.$router.currentRoute.value.matched.at(-1).instances.default.getUpdateInfo())
   await page.locator('.loopDialog').waitFor({state:'visible',timeout:3000})
   await page.getByRole('button',{name:'立即下载',exact:true}).click()
   const calls=await page.evaluate(()=>window.__dialogCalls)
   assert.ok(calls.includes(full?'start-update':'start-hot-update'),JSON.stringify(calls))
   assert.ok(!calls.includes(full?'start-hot-update':'start-update'))
   if(full)assert.ok(!calls.includes('hot-update'),'full update must take priority')
   await page.getByRole('button',{name:'明天提醒我'}).click()
   await page.locator('.loopDialog').waitFor({state:'hidden'})
   assert.ok(await page.evaluate(()=>Number(localStorage.getItem('tomorrowTipStartTime')))>0)
   await page.evaluate(async()=>{const vue=document.querySelector('#app').__vue_app__;vue.config.globalProperties.$ipcRenderer=window.__realDialogBridge;await vue.config.globalProperties.$router.push('/')})
   await page.waitForSelector('.home')
  }
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close();await fs.rm(userData,{recursive:true,force:true})}
})
