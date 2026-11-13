const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),os=require('node:os')
const asar=require('@electron/asar'),{_electron}=require('playwright')
test('ASAR packaged application starts and retains compiled bytes and runtime dependencies',{timeout:45000},async()=>{
 const executable=process.env.SKELETON_PACKAGED_EXECUTABLE
 assert.ok(executable,'Set SKELETON_PACKAGED_EXECUTABLE to a locally built application')
 const resources=process.platform==='darwin'?path.resolve(path.dirname(executable),'../Resources'):path.join(path.dirname(executable),'resources')
 const archive=path.join(resources,'app.asar'),names=asar.listPackage(archive).map(name=>name.replaceAll('\\','/'))
 assert.equal(fs.existsSync(path.join(resources,'app')),false)
 assert.ok(!names.some(n=>/package-lock\.json$|\.map$|\.d\.ts$/.test(n)))
 assert.ok(!names.some(n=>/node_modules\/(?:vite|vue|electron-vite|playwright)\//.test(n)))
 for(const file of ['main/index.cjs','preload/index.cjs','renderer/index.html']){
  assert.deepEqual(asar.extractFile(archive,path.join('dist','electron',file)),fs.readFileSync(path.resolve(__dirname,'../../dist/electron',file)),file)
 }
 assert.ok(fs.existsSync(path.join(resources,'static/loader.html')))
 const metadata=JSON.parse(asar.extractFile(archive,path.join('dist','electron','runtime-build.json')))
 const sourceMetadata=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../dist/electron/runtime-build.json')))
 for(const key of ['lockHash','electronVersion','appVersion'])assert.equal(metadata[key],sourceMetadata[key],key)
 const pkg=JSON.parse(asar.extractFile(archive,'package.json'))
 assert.deepEqual(pkg.dependencies,require('../../package.json').dependencies)
 const userData=await fsp.mkdtemp(path.join(os.tmpdir(),'packaged-electron-'))
 const env={...process.env,SKELETON_E2E:'1',SKELETON_USER_DATA:userData,ELECTRON_RENDERER_URL:'http://127.0.0.1:1/untrusted'}
 for(const name of ['ELECTRON_RUN_AS_NODE','APP_UPDATE_URL','APP_DOWNLOAD_URL','RESOURCE_UPDATE_URL','RESOURCE_UPDATE_PUBLIC_KEY','RESOURCE_UPDATE_PUBLIC_KEY_FILE'])delete env[name]
 for(const key of ['APP_UPDATE_URL','RESOURCE_UPDATE_URL','RESOURCE_UPDATE_PUBLIC_KEY'])env[key]=''
 const app=await _electron.launch({executablePath:executable,args:[],env,timeout:15000})
 try{
  const page=await app.firstWindow();await page.waitForSelector('.home',{timeout:20000})
  assert.equal(await app.evaluate(({app})=>app.isPackaged),true)
  assert.equal(await app.evaluate(({app})=>app.getPath('userData')),userData)
  assert.ok(page.url().startsWith('file:'))
  assert.equal(await page.evaluate(()=>window.electronAPI.calls['get-version']()),'1.0.0')
  const result=await page.evaluate(()=>window.electronAPI.calls['hot-update']())
  assert.equal(result.status,'failed');assert.match(result.message,/public key/)
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close();await fsp.rm(userData,{recursive:true,force:true})}
})
