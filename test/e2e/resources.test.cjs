const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),http=require('node:http')
const {_electron}=require('playwright'),AdmZip=require('adm-zip')
const {runtimeIdentity,payload}=require('../../src/main/services/resourceUpdates.cjs')
test('signed renderer update survives restart and broken first startup recovers the last good entry',{timeout:60000},async()=>{
 const root=await fsp.mkdtemp(path.join(os.tmpdir(),'resource-electron-'))
 const appRoot=path.resolve(__dirname,'../..'),pkg=require('../../package.json')
 const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519')
 const keyFile=path.join(root,'publisher.pem');fs.writeFileSync(keyFile,publicKey.export({type:'spki',format:'pem'}))
 const runtimeId=runtimeIdentity({mainFile:path.join(appRoot,'dist/electron/main/index.cjs'),preloadFile:path.join(appRoot,'dist/electron/preload/index.cjs'),dependencies:pkg.dependencies,lockHash:crypto.createHash('sha256').update(fs.readFileSync(path.join(appRoot,'package-lock.json'))).digest('hex'),electronVersion:pkg.devDependencies.electron,appVersion:pkg.version})
 let response,app
 function prepare(broken=false){
  const zip=new AdmZip();zip.addLocalFolder(path.join(appRoot,'dist/electron/renderer'))
  const html=broken?'<body id="broken">broken renderer</body>':fs.readFileSync(path.join(appRoot,'dist/electron/renderer/index.html'),'utf8').replace('<body>','<body data-resource-test="active">')
  zip.addFile('index.html',Buffer.from(html))
  const archive=zip.toBuffer()
  const manifest={schemaVersion:1,version:broken?'1.0.2':'1.0.1',platform:process.platform,arch:process.arch,runtimeId,sha256:crypto.createHash('sha256').update(archive).digest('hex'),archive:'renderer.zip'}
  manifest.signature=crypto.sign(null,payload(manifest),privateKey).toString('base64');response={manifest,archive}
 }
 const server=http.createServer((req,res)=>{if(req.url==='/manifest.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(response.manifest))}else if(req.url==='/renderer.zip')res.end(response.archive);else{res.statusCode=404;res.end()}})
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 const env={...process.env,NODE_ENV:'production',SKELETON_E2E:'1',SKELETON_USER_DATA:root,RESOURCE_UPDATE_PUBLIC_KEY_FILE:keyFile,RESOURCE_UPDATE_URL:'http://127.0.0.1:'+server.address().port+'/manifest.json'};delete env.ELECTRON_RUN_AS_NODE
 async function launch(){app=await _electron.launch({executablePath:process.env.SKELETON_PACKAGED_EXECUTABLE||require('electron'),args:process.env.SKELETON_PACKAGED_EXECUTABLE?[]:[appRoot],cwd:appRoot,env,timeout:15000});return app.firstWindow()}
 async function close(){if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close();app=null}}
 async function update(page){
  await page.evaluate(()=>window.electronAPI.calls['hot-update']())
  const result=await page.evaluate(()=>window.electronAPI.calls['start-hot-update']())
  assert.equal(result.status,'finished',JSON.stringify(result))
 }
 try{
  prepare();let page=await launch();await page.waitForSelector('.home')
  assert.equal(await app.evaluate(({app})=>app.getPath('userData')),root)
  await page.evaluate(()=>window.electronAPI.writes.setStore('survives-update',false))
  const saved=response.archive;response.archive=Buffer.from('corrupted transport')
  await page.evaluate(()=>window.electronAPI.calls['hot-update']())
  assert.equal((await page.evaluate(()=>window.electronAPI.calls['start-hot-update']())).status,'failed')
  response.archive=saved
  await update(page);await close()
  page=await launch();await page.waitForSelector('body[data-resource-test="active"] .home')
  await page.waitForFunction(()=>Boolean(window.electronAPI))
  assert.equal(await page.evaluate(()=>window.electronAPI.reads.getStore('survives-update')),false)
  for(let i=0;i<100;i++){if(JSON.parse(fs.readFileSync(path.join(root,'resource-updates/state.json'),'utf8')).status==='ready')break;await new Promise(r=>setTimeout(r,20))}
  assert.equal(await page.evaluate(()=>window.electronAPI.calls['get-resource-version']()),'1.0.1')
  assert.equal((await page.evaluate(()=>window.electronAPI.calls['hot-update']())).status,'update-not-available')
  prepare(true);await update(page);await close()
  page=await launch();await page.waitForSelector('#broken')
  await page.waitForSelector('body[data-resource-test="active"] .home',{timeout:20000})
  const state=JSON.parse(fs.readFileSync(path.join(root,'resource-updates/state.json'),'utf8'))
  assert.equal(state.status,'ready')
  assert.equal(await page.evaluate(()=>window.electronAPI.reads.getStore('survives-update')),false)
 }finally{await close();await new Promise(r=>server.close(r));await fsp.rm(root,{recursive:true,force:true})}
})
