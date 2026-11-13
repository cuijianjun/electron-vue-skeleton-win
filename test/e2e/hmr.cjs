const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),os=require('node:os')
const {spawn,spawnSync}=require('node:child_process')
const {chromium}=require('playwright')
test('npm dev starts Electron and Vue template HMR keeps the renderer alive',{timeout:60000},async()=>{
 const root=path.resolve(__dirname,'../..'),userData=await fsp.mkdtemp(path.join(os.tmpdir(),'vue3-hmr-'))
 const file=path.join(root,'src/renderer/views/Home.vue'),original=fs.readFileSync(file,'utf8')
 const changed=original.replace('骨架 Demo','HMR verified Demo')
 assert.notEqual(changed,original)
 const pkg=require('../../node_modules/electron-vite/package.json')
 const bin=typeof pkg.bin==='string'?pkg.bin:pkg.bin['electron-vite']
 const env={...process.env,SKELETON_E2E:'1',SKELETON_DEV_DEBUG:'1',SKELETON_USER_DATA:userData};for(const name of ['ELECTRON_RUN_AS_NODE','APP_UPDATE_URL','APP_DOWNLOAD_URL','RESOURCE_UPDATE_URL','RESOURCE_UPDATE_PUBLIC_KEY','RESOURCE_UPDATE_PUBLIC_KEY_FILE'])delete env[name]
 const child=spawn(process.execPath,[path.join(root,'node_modules/electron-vite',bin),'dev'],{cwd:root,env,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']})
 let browser,output=''
 const endpoint=new Promise((resolve,reject)=>{
  const read=data=>{output=(output+data.toString()).slice(-15000);const match=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match)resolve(match[1])}
  child.stdout.on('data',read);child.stderr.on('data',read)
  child.once('exit',code=>reject(new Error('dev exited '+code+'\n'+output)))
  child.once('error',reject)
 })
 try{
  browser=await chromium.connectOverCDP(await endpoint,{timeout:20000})
  let page=browser.contexts()[0].pages().find(p=>p.url().includes('localhost'))
  if(!page)page=await browser.contexts()[0].waitForEvent('page')
  await page.waitForSelector('.home',{timeout:20000})
  await page.evaluate(()=>window.__hmrProof='same-renderer')
  fs.writeFileSync(file,changed)
  await page.getByRole('heading',{name:'Electron + Vue 3 + Vite HMR verified Demo',exact:true}).waitFor({timeout:15000})
  assert.equal(await page.evaluate(()=>window.__hmrProof),'same-renderer')
 }finally{
  if(fs.readFileSync(file,'utf8')===changed)fs.writeFileSync(file,original)
  await browser?.close().catch(()=>{})
  if(process.platform==='win32')spawnSync('taskkill',['/pid',String(child.pid),'/t','/f'])
  else {try{process.kill(-child.pid,'SIGTERM')}catch{}}
  await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);setTimeout(resolve,5000).unref()})
  if(child.exitCode===null&&process.platform!=='win32'){try{process.kill(-child.pid,'SIGKILL')}catch{}}
  await fsp.rm(userData,{recursive:true,force:true,maxRetries:10,retryDelay:200})
 }
})
