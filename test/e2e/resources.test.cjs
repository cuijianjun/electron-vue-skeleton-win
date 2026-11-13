const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),http=require('node:http')
const {_electron,chromium}=require('playwright'),AdmZip=require('adm-zip')
const {runtimeIdentity,payload,inventory,treeHash}=require('../../src/main/services/resourceUpdates.cjs')
test('signed renderer update survives restart and broken first startup recovers the last good entry',{timeout:120000},async()=>{
 const root=await fsp.mkdtemp(path.join(os.tmpdir(),'resource-electron-'))
 const appRoot=path.resolve(__dirname,'../..'),pkg=require('../../package.json')
 const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519')
 const keyFile=path.join(root,'publisher.pem');fs.writeFileSync(keyFile,publicKey.export({type:'spki',format:'pem'}))
 const runtimeId=runtimeIdentity({mainFile:path.join(appRoot,'dist/electron/main/index.cjs'),preloadFile:path.join(appRoot,'dist/electron/preload/index.cjs'),dependencies:pkg.dependencies,lockHash:crypto.createHash('sha256').update(fs.readFileSync(path.join(appRoot,'package-lock.json'))).digest('hex'),electronVersion:pkg.devDependencies.electron,appVersion:pkg.version})
 let response,app,cdp,cdpPID,snapshotRequests=0,deltaRequests=0,slow=false,downloadStarted
 const debugServer=http.createServer();await new Promise(r=>debugServer.listen(0,'127.0.0.1',r));const debugPort=debugServer.address().port;await new Promise(r=>debugServer.close(r))
 function prepare(broken=false,fallback=false){
  const version=fallback?'1.0.3':broken?'1.0.2':'1.0.1',target=path.join(root,'publish-'+version)
  fs.cpSync(path.join(appRoot,'dist/electron/renderer'),target,{recursive:true})
  const html=broken?'<body id="broken">broken renderer</body>':fs.readFileSync(path.join(target,'index.html'),'utf8').replace('<body>','<body data-resource-test="active">')
  fs.writeFileSync(path.join(target,'index.html'),html)
  const stateFile=path.join(root,'resource-updates/state.json'),state=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile)):null
  const base=state?.status==='ready'&&state.active?path.join(root,'resource-updates/versions',state.active):path.join(appRoot,'dist/electron/renderer')
  const before=inventory(base),files=inventory(target),old=new Map(before.map(f=>[f.path,f.sha256])),zip=new AdmZip(),snapshot=new AdmZip()
  for(const f of files){const bytes=fs.readFileSync(path.join(target,f.path));snapshot.addFile(f.path,bytes);if(old.get(f.path)!==f.sha256)zip.addFile(f.path,bytes)}
  const archive=zip.toBuffer(),full=snapshot.toBuffer(),hash=b=>crypto.createHash('sha256').update(b).digest('hex')
  const manifest={schemaVersion:2,version,platform:process.platform,arch:process.arch,runtimeId,sha256:hash(archive),archive:'delta.zip',base:{version:fallback?'0.0.0':state?.version||'1.0.0',sha256:treeHash(before)},files,fallback:{archive:'snapshot.zip',sha256:hash(full)}}
  manifest.signature=crypto.sign(null,payload(manifest),privateKey).toString('base64');response={manifest,archive,full}
 }
 const server=http.createServer((req,res)=>{if(req.url==='/manifest.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(response.manifest))}else if(req.url==='/delta.zip'){deltaRequests++;if(slow){res.setHeader('Content-Length',response.archive.length);res.write(response.archive.subarray(0,8));downloadStarted?.();const timer=setTimeout(()=>res.end(response.archive.subarray(8)),2000);res.on('close',()=>clearTimeout(timer))}else res.end(response.archive)}else if(req.url==='/snapshot.zip'){snapshotRequests++;res.end(response.full)}else{res.statusCode=404;res.end()}})
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 const env={...process.env,NODE_ENV:'production',SKELETON_E2E:'1',SKELETON_USER_DATA:root,RESOURCE_UPDATE_PUBLIC_KEY_FILE:keyFile,RESOURCE_UPDATE_URL:'http://127.0.0.1:'+server.address().port+'/manifest.json'};delete env.ELECTRON_RUN_AS_NODE
 async function launch(){app=await _electron.launch({executablePath:process.env.SKELETON_PACKAGED_EXECUTABLE||require('electron'),args:[...(process.env.SKELETON_PACKAGED_EXECUTABLE?[]:[appRoot]),'--remote-debugging-port='+debugPort],cwd:appRoot,env,timeout:15000});return app.firstWindow()}
 async function close(){if(cdp){await cdp.close().catch(()=>{});cdp=null;if(cdpPID){try{process.kill(cdpPID)}catch{};cdpPID=null}await new Promise(r=>setTimeout(r,500))}if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close();app=null}}
 async function restart(page){
  const old=app,closed=old?old.waitForEvent('close',{timeout:20000}):new Promise(resolve=>cdp.once('disconnected',resolve))
  const result=await page.evaluate(()=>window.electronAPI.calls['confirm-hot-update']()).catch(error=>{if(!/closed/i.test(error.message))throw error})
  if(result)assert.equal(result.ok,true,JSON.stringify(result))
  await closed;app=null;cdp=null;cdpPID=null
  const deadline=Date.now()+20000
  while(!cdp&&Date.now()<deadline){try{cdp=await chromium.connectOverCDP('http://127.0.0.1:'+debugPort,{timeout:1000})}catch{await new Promise(r=>setTimeout(r,200))}}
  assert.ok(cdp,'The actual relaunched Electron must expose its test debug endpoint')
  const session=await cdp.newBrowserCDPSession(),info=await session.send('SystemInfo.getProcessInfo');cdpPID=info.processInfo.find(p=>p.type==='browser')?.id
  assert.ok(cdpPID,'Track only the owned relaunched process for cleanup')
  const context=cdp.contexts()[0]
  for(let i=0;i<100;i++){const page=context.pages().find(p=>p.url().startsWith('file:')&&!p.url().endsWith('loader.html'));if(page)return page;await new Promise(r=>setTimeout(r,100))}
  throw new Error('Relaunched renderer not found')
 }
 async function update(page){
  await page.evaluate(()=>window.electronAPI.calls['hot-update']())
  const result=await page.evaluate(()=>window.electronAPI.calls['start-hot-update']())
  assert.equal(result.status,'finished',JSON.stringify(result))
 }
 try{
  prepare();let page=await launch();await page.waitForSelector('.home')
  assert.equal(await app.evaluate(({app})=>app.getPath('userData')),root)
  await page.evaluate(()=>window.electronAPI.writes.setStore('survives-update',false))
  assert.equal((await page.evaluate(()=>window.electronAPI.calls['confirm-hot-update']())).ok,false)
  const saved=response.archive;response.archive=Buffer.from('corrupted transport')
  await page.evaluate(()=>window.electronAPI.calls['hot-update']())
  assert.equal((await page.evaluate(()=>window.electronAPI.calls['start-hot-update']())).status,'failed')
  response.archive=saved
  slow=true;await page.evaluate(()=>window.electronAPI.calls['hot-update']())
  const started=new Promise(resolve=>downloadStarted=resolve),pending=page.evaluate(()=>window.electronAPI.calls['start-hot-update']())
  await started
  assert.match((await page.evaluate(()=>window.electronAPI.calls['check-update']())).error,/resource update first/)
  assert.equal((await page.evaluate(()=>window.electronAPI.calls['cancel-hot-update']())).ok,true)
  assert.equal((await pending).status,'cancelled');slow=false
  assert.equal((await page.evaluate(()=>window.electronAPI.calls['get-update-status']())).resource.pendingVersion,null)
  assert.ok(response.archive.length<response.full.length/10)
  await update(page);assert.match((await page.evaluate(()=>window.electronAPI.calls['check-update']())).error,/resource update first/);page=await restart(page);assert.ok(deltaRequests>=2);assert.equal(snapshotRequests,0)
  await page.waitForSelector('body[data-resource-test="active"] .home')
  await page.waitForFunction(()=>Boolean(window.electronAPI))
  assert.equal(await page.evaluate(()=>window.electronAPI.reads.getStore('survives-update')),false)
  for(let i=0;i<100;i++){if(JSON.parse(fs.readFileSync(path.join(root,'resource-updates/state.json'),'utf8')).status==='ready')break;await new Promise(r=>setTimeout(r,20))}
  assert.equal(await page.evaluate(()=>window.electronAPI.calls['get-resource-version']()),'1.0.1')
  assert.equal((await page.evaluate(()=>window.electronAPI.calls['hot-update']())).status,'update-not-available')
  prepare(true);await update(page);page=await restart(page);
  await page.waitForSelector('#broken')
  await page.waitForSelector('body[data-resource-test="active"] .home',{timeout:20000})
  const state=JSON.parse(fs.readFileSync(path.join(root,'resource-updates/state.json'),'utf8'))
  assert.equal(state.status,'ready')
  assert.equal(await page.evaluate(()=>window.electronAPI.reads.getStore('survives-update')),false)
  prepare(false,true);await update(page);assert.equal(snapshotRequests,1);page=await restart(page)
  await page.waitForSelector('body[data-resource-test="active"] .home')
  await page.waitForFunction(async()=>await window.electronAPI.calls['get-resource-version']()==='1.0.3')
  assert.equal(await page.evaluate(()=>window.electronAPI.reads.getStore('survives-update')),false)
 }finally{await close();await new Promise(r=>server.close(r));await fsp.rm(root,{recursive:true,force:true})}
})
