const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),crypto=require('node:crypto')
const {_electron}=require('playwright')
test('real DebUpdater HTTP checksum verification and denied package-manager elevation',{timeout:30000},async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'deb-updater-')),config=path.join(root,'app-update.yml'),bytes=Buffer.from('Controlled HTTP transport fixture; package-manager execution is denied')
 fs.writeFileSync(config,'updaterCacheDirName: isolated-deb-test\n')
 let corrupt=true,app;const requests=[]
 const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;requests.push(name)
  if(name.endsWith('.yml')){res.setHeader('Content-Type','text/yaml');res.end(`version: 1.0.1\nfiles:\n  - url: fixture.deb\n    sha512: ${crypto.createHash('sha512').update(bytes).digest('base64')}\n    size: ${bytes.length}\npath: fixture.deb\nsha512: ${crypto.createHash('sha512').update(bytes).digest('base64')}\nreleaseDate: '2026-11-14T00:00:00.000Z'\n`)}
  else if(name==='/fixture.deb')res.end(corrupt?Buffer.from('corrupted'):bytes)
  else{res.statusCode=404;res.end()}
 })
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 try{
  const appRoot=path.resolve(__dirname,'../..'),env={...process.env,SKELETON_E2E:'1',SKELETON_USER_DATA:root};delete env.ELECTRON_RUN_AS_NODE
  app=await _electron.launch({executablePath:require('electron'),args:[appRoot],env,timeout:15000})
  const page=await app.firstWindow();await page.waitForSelector('.home')
  const create=await app.evaluate(({app},{appRoot,root,config})=>{
   const require=process.getBuiltinModule('module').createRequire(appRoot+'/package.json')
   const {DebUpdater}=require(appRoot+'/node_modules/electron-updater'),{ElectronHttpExecutor}=require(appRoot+'/node_modules/electron-updater/out/electronHttpExecutor'),{UpdateController}=require(appRoot+'/src/main/services/updateController.cjs'),{CancellationToken}=require(appRoot+'/node_modules/builder-util-runtime')
   global.__debFixture={commands:[],quit:0,relaunch:0}
   const f=global.__debFixture,updater=new DebUpdater(null,{version:'1.0.0',name:'isolated-deb-test',isPackaged:true,whenReady:async()=>{},userDataPath:root,baseCachePath:root,appUpdateConfigPath:config,onQuit(){},quit(){f.quit++},relaunch(){f.relaunch++}})
   updater.httpExecutor=new ElectronHttpExecutor(()=>{});updater._testOnlyOptions={platform:'linux'};updater.logger={info(){},warn(){},error(){},debug(){}}
   f.updater=updater;f.controller=new UpdateController(updater,()=>new CancellationToken());return true
  },{appRoot,root,config})
  assert.equal(create,true)
  async function check(){return app.evaluate(async(_electron,url)=>global.__debFixture.controller.check({isDestroyed:()=>false,webContents:{send(){}}},url),'http://127.0.0.1:'+server.address().port)}
  assert.equal((await check()).available,true)
  assert.equal((await app.evaluate(()=>global.__debFixture.controller.download())).ok,false)
  assert.equal((await app.evaluate(()=>global.__debFixture.controller.install())).ok,false)
  corrupt=false;await check();const downloaded=await app.evaluate(()=>global.__debFixture.controller.download());assert.equal(downloaded.ok,true,JSON.stringify(downloaded))
  const result=await app.evaluate(()=>{
   const f=global.__debFixture,updater=f.updater,data=process.getBuiltinModule('fs').readFileSync(updater.installerPath).toString('base64')
   updater.hasCommand=cmd=>cmd==='dpkg';updater.runCommandWithSudoIfNeeded=args=>{f.commands.push(args);throw new Error('Controlled elevation permission denied')}
   const installed=f.controller.install();return {data,installed,error:f.controller.lastError,commands:f.commands,quit:f.quit,relaunch:f.relaunch}
  })
  assert.equal(result.data,bytes.toString('base64'));assert.equal(result.installed.ok,false);assert.match(result.error,/permission denied/)
  assert.deepEqual(result.commands.map(args=>args.slice(0,2)),[['dpkg','-i'],['apt-get','install']]);assert.equal(result.quit,0);assert.equal(result.relaunch,0)
  assert.ok(requests.includes('/latest-linux.yml'));assert.ok(requests.filter(x=>x==='/fixture.deb').length>=2)
 }finally{if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close()}await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true})}
})
