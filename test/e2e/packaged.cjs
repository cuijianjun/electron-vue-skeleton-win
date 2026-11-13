const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),os=require('node:os')
const {_electron}=require('playwright')
test('packaged application starts without source lockfile and retains its runtime identity',{timeout:45000},async()=>{
 const executable=process.env.SKELETON_PACKAGED_EXECUTABLE
 assert.ok(executable,'Set SKELETON_PACKAGED_EXECUTABLE to a locally built application')
 const resources=process.platform==='darwin'?path.resolve(path.dirname(executable),'../Resources'):path.join(path.dirname(executable),'resources')
 const appRoot=path.join(resources,'app')
 assert.equal(fs.existsSync(path.join(appRoot,'package-lock.json')),false)
 for(const file of ['main/index.cjs','preload/index.cjs','renderer/index.html','runtime-build.json'])assert.ok(fs.existsSync(path.join(appRoot,'dist/electron',file)),file)
 assert.ok(fs.existsSync(path.join(resources,'static/loader.html')))
 const identity=require('../../src/main/services/resourceUpdates.cjs').runtimeIdentity
 const metadata=JSON.parse(fs.readFileSync(path.join(appRoot,'dist/electron/runtime-build.json'),'utf8'))
 const packaged=JSON.parse(fs.readFileSync(path.join(appRoot,'package.json'),'utf8'))
 const source=require('../../package.json'),sourceRoot=path.resolve(__dirname,'../..')
 function digest(folder,dependencies){return identity({mainFile:path.join(folder,'dist/electron/main/index.cjs'),preloadFile:path.join(folder,'dist/electron/preload/index.cjs'),dependencies,lockHash:metadata.lockHash,electronVersion:metadata.electronVersion,appVersion:metadata.appVersion})}
 assert.equal(digest(appRoot,packaged.dependencies),digest(sourceRoot,source.dependencies))
 const userData=await fsp.mkdtemp(path.join(os.tmpdir(),'packaged-electron-'))
 const env={...process.env,SKELETON_E2E:'1',SKELETON_USER_DATA:userData,ELECTRON_RENDERER_URL:'http://127.0.0.1:1/untrusted'}
 for(const name of ['ELECTRON_RUN_AS_NODE','APP_UPDATE_URL','APP_DOWNLOAD_URL','RESOURCE_UPDATE_URL','RESOURCE_UPDATE_PUBLIC_KEY','RESOURCE_UPDATE_PUBLIC_KEY_FILE'])delete env[name]
 const app=await _electron.launch({executablePath:executable,args:[],env,timeout:15000})
 try{
  const page=await app.firstWindow();await page.waitForSelector('.home',{timeout:20000})
  assert.equal(await app.evaluate(({app})=>app.isPackaged),true)
  assert.ok(page.url().startsWith('file:'))
  assert.equal(await page.evaluate(()=>window.electronAPI.calls['get-version']()),'1.0.0')
  const result=await page.evaluate(()=>window.electronAPI.calls['hot-update']())
  assert.equal(result.status,'failed');assert.match(result.message,/public key/)
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close();await fsp.rm(userData,{recursive:true,force:true})}
})
