const http=require('node:http')
const {test}=require('node:test')
const assert=require('node:assert/strict')
const path=require('node:path')
const fs=require('node:fs/promises')
const os=require('node:os')
const {_electron}=require('playwright')
test('production Electron: Vue routes, narrow IPC, persistence and isolated windows', {timeout:60000}, async()=>{
  const userData=await fs.mkdtemp(path.join(os.tmpdir(),'vue3-electron-'))
  const env={...process.env,NODE_ENV:'production',NODE_OPTIONS:'',SKELETON_E2E:'1',SKELETON_USER_DATA:userData,ELECTRON_RENDERER_URL:'http://127.0.0.1:1/untrusted'}
  for(const name of ['ELECTRON_RUN_AS_NODE','APP_UPDATE_URL','APP_DOWNLOAD_URL','RESOURCE_UPDATE_URL','RESOURCE_UPDATE_PUBLIC_KEY','RESOURCE_UPDATE_PUBLIC_KEY_FILE'])delete env[name]
 for(const key of ['APP_UPDATE_URL','RESOURCE_UPDATE_URL','RESOURCE_UPDATE_PUBLIC_KEY'])env[key]=''
  const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve(__dirname,'../..')],env,timeout:20000})
  let fixtureServer
  try{
    const page=await app.firstWindow()
    const errors=[];page.on('pageerror',e=>errors.push(e.message))
    await page.waitForSelector('#app .home',{timeout:20000})
    assert.equal(await page.evaluate(()=>typeof require),'undefined')
    assert.equal(await page.evaluate(()=>typeof process),'undefined')
    assert.equal(await page.evaluate(()=>window.electronAPI.calls['get-version']()),'1.0.0')
    for(const value of [false,0,'中文 value']){
      await page.evaluate(value=>window.electronAPI.writes.setStore('e2e-test',value),value)
      assert.deepEqual(await page.evaluate(()=>window.electronAPI.reads.getStore('e2e-test')),value)
    }
    const navigate=route=>page.evaluate(async route=>{
      const app=document.querySelector('#app').__vue_app__
      await app.config.globalProperties.$router.push(route)
    },route)
    for(let i=0;i<3;i++){await navigate('/updateTip');await navigate('/iframe');await navigate('/');await page.waitForSelector('.home')}
    await navigate('/missing');await page.waitForSelector('.home')
    const counts=await page.evaluate(()=>{
      const ipc=document.querySelector('#app').__vue_app__.config.globalProperties.$ipcRenderer
      return ['update-msg','hot-update-status','deep-link-params'].map(c=>ipc.listenerCount(c))
    })
    assert.deepEqual(counts,[1,1,1])
    assert.equal(await page.evaluate(()=>window.onbeforeunload),null)
    await page.evaluate(()=>{
      const ipc=document.querySelector('#app').__vue_app__.config.globalProperties.$ipcRenderer
      window.__eventHits=0
      const callback=()=>window.__eventHits++
      const oldStop=ipc.subscribe('w-max',callback)
      ipc.subscribe('w-max',callback)
      oldStop()
    })
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('desktop:event',{operation:'w-max',args:[true]}))
    await page.waitForFunction(()=>window.__eventHits===1)
    await page.evaluate(()=>document.querySelector('#app').__vue_app__.config.globalProperties.$ipcRenderer.removeAllListeners('w-max'))
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('desktop:event',{operation:'w-max',args:[false]}))
    assert.equal(await page.evaluate(()=>window.__eventHits),1)
    await page.evaluate(()=>{window.__maxStates=[];window.__stopMax=window.electronAPI.events['w-max'](value=>window.__maxStates.push(value))})
    for(let i=0;i<2;i++){
      const result=await page.evaluate(()=>window.electronAPI.calls['window-max']())
      await page.waitForFunction(value=>window.__maxStates.at(-1)===value,result.status,{timeout:5000})
    }
    await page.evaluate(()=>window.__stopMax())
    const mainId=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].id)
    const childPromise=app.waitForEvent('window',{predicate:async page=>{try{await page.waitForURL(url=>url.hash==='#/updateTip',{timeout:5000});return true}catch{return false}}})
    await page.evaluate(()=>window.electronAPI.calls['open-win']({url:'/updateTip'}))
    const child=await childPromise
    await child.waitForFunction(()=>Boolean(window.electronAPI))
    await child.evaluate(()=>window.electronAPI.ready())
    await page.evaluate(()=>window.electronAPI.writes.setStore('cross-window',false))
    await child.waitForFunction(()=>window.electronAPI.reads.getStore('cross-window')===false)
    await child.evaluate(()=>window.electronAPI.writes.setStore('cross-window',0))
    await page.waitForFunction(()=>window.electronAPI.reads.getStore('cross-window')===0)
    // A scope's cleanup cannot remove a different component's listeners.
    await page.evaluate(()=>{
      const desktop=document.querySelector('#app').__vue_app__.config.globalProperties.$desktop
      const a=desktop.scope(),b=desktop.scope();window.__scopeHits=[]
      a.events.on('w-max',()=>window.__scopeHits.push('a'))
      b.events.on('w-max',()=>window.__scopeHits.push('b'))
      a.dispose();window.__stopScope=()=>b.dispose()
    })
    await app.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id).webContents.send('desktop:event',{operation:'w-max',args:[true]}),mainId)
    await page.waitForFunction(()=>window.__scopeHits.join(',')==='b')
    await page.evaluate(()=>window.__stopScope())

    assert.equal(await child.evaluate(()=>window.electronAPI.calls['get-version']()),'1.0.0')
    assert.equal(await child.evaluate(()=>window.electronAPI.calls['renderer-ready']()),false)
    await app.evaluate(({BrowserWindow},mainId)=>{
      for(const win of BrowserWindow.getAllWindows())if(win.id!==mainId)win.destroy()
    },mainId)
    const intruderPromise=app.waitForEvent('window',{predicate:async page=>{try{await page.waitForURL(url=>url.protocol==='data:',{timeout:5000});return true}catch{return false}}})
    await app.evaluate(async ({BrowserWindow},preload)=>{
      const win=new BrowserWindow({show:false,webPreferences:{preload,nodeIntegration:false,contextIsolation:true,sandbox:true}})
      await win.loadURL('data:text/html,<body>untrusted</body>')
    },path.resolve(__dirname,'../../dist/electron/preload/index.cjs'))
    const intruder=await intruderPromise
    const rejection=await intruder.evaluate(async()=>{try{await window.electronAPI.calls['get-version']();return 'accepted'}catch(e){return e.message}})
    assert.match(rejection,/Untrusted IPC sender/)
    await app.evaluate(({BrowserWindow})=>{for(const win of BrowserWindow.getAllWindows())if(win.webContents.getURL().startsWith('data:'))win.destroy()})
    fixtureServer=http.createServer((req,res)=>{
      if(req.url==='/frame'){res.setHeader('Content-Type','text/html');res.end('<body>frame fixture<script>parent.postMessage({type:"fixture-event"},"*")</script></body>')}
      else {res.setHeader('Content-Disposition','attachment; filename="sample.txt"');res.end('fixture bytes')}
    })
    await new Promise(r=>fixtureServer.listen(0,'127.0.0.1',r))
    const fixtureURL='http://127.0.0.1:'+fixtureServer.address().port
    await page.evaluate(()=>{window.__frameMessages=[];window.__stopFrame=window.electronAPI.events.siblingConnect(value=>window.__frameMessages.push(value))})
    await navigate('/iframe?src='+encodeURIComponent(fixtureURL+'/frame'))
    await page.waitForFunction(()=>window.__frameMessages.includes('fixture-event'))
    assert.equal(await page.frameLocator('iframe').locator('body').evaluate(()=>typeof window.electronAPI),'undefined')
    await page.evaluate(()=>window.postMessage({type:'spoofed'},'*'))
    assert.equal(await page.evaluate(()=>window.__frameMessages.includes('spoofed')),false)
    await page.evaluate(()=>window.__stopFrame())
    await navigate('/');await page.waitForSelector('.home')
    const file=path.join(userData,'file fixture.txt');await fs.writeFile(file,'fixture bytes')
    await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},file)
    const files=await page.evaluate(()=>window.electronAPI.calls['file:select']())
    assert.equal(files.success,true)
    assert.deepEqual(await page.evaluate(async file=>Array.from(new Uint8Array(await window.electronAPI.calls['file:readChunk'](file,0,6))),file),Array.from(Buffer.from('fixture')))
    assert.match(await page.evaluate(async file=>{try{await window.electronAPI.calls['file:readChunk'](file+'-unselected',0,1);return 'accepted'}catch(e){return e.message}},file),/unselected file/)
    await app.evaluate(({dialog},directory)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]})},userData)
    await page.evaluate(()=>window.electronAPI.calls['open-directory']())
    await page.evaluate(()=>{window.__downloadDone=null;window.__stopDownload=window.electronAPI.events['download-done'](value=>window.__downloadDone=value)})
    await page.evaluate(({url,directory})=>window.electronAPI.calls['files-download']({downloadURL:url,path:directory,name:'中文 sample.txt'}),{url:fixtureURL+'/file',directory:userData})
    await page.waitForFunction(()=>Boolean(window.__downloadDone))
    assert.equal(await fs.readFile(path.join(userData,'中文 sample.txt'),'utf8'),'fixture bytes')
    await page.evaluate(()=>window.__stopDownload())
    await app.evaluate(({app})=>app.emit('second-instance',{},['test','myapp://openapp?id=fixture']))
    await page.waitForFunction(()=>document.querySelector('.home').textContent.includes('fixture'))
    const noProvider=await page.evaluate(()=>window.electronAPI.calls['check-update']())
    assert.equal(noProvider.ok,false)
    await new Promise(r=>fixtureServer.close(r));fixtureServer=null
    const prefs=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().map(w=>w.webContents.getLastWebPreferences()))
    for(const p of prefs){assert.equal(p.nodeIntegration,false);assert.equal(p.contextIsolation,true);assert.equal(p.sandbox,true)}
    assert.deepEqual(errors,[])
  }finally{if(fixtureServer)await new Promise(r=>fixtureServer.close(r));await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close();await fs.rm(userData,{recursive:true,force:true})}
})
