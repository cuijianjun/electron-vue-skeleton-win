const {test}=require('node:test'),assert=require('node:assert/strict')
const {ResourceUpdateController}=require('../../src/main/services/resourceUpdateController.cjs')
const resources=require('../../src/main/services/resourceUpdates.cjs')
const {fixture}=require('./resource-fixture.cjs')
const window={isDestroyed:()=>false,webContents:{send(){}}}
test('resource download owns its manifest; recheck cannot replace an in-flight candidate',async()=>{
 const f=fixture();try{
  const good=f.make();let requests=0,resolve,downloads=0
  const controller=new ResourceUpdateController({options:f.options,readManifest:async()=>{requests++;return {manifest:good.manifest,archiveURL:'http://localhost/renderer.zip'}},readArchive:()=>{downloads++;return new Promise(r=>{resolve=r})}})
  assert.equal((await controller.check(window)).status,'update-available')
  const pending=controller.download(window)
  assert.equal((await controller.check(window)).status,'busy');assert.equal(requests,1)
  resolve(good.archive);assert.equal((await pending).status,'finished')
  assert.equal((await controller.check(window)).status,'finished');assert.equal(downloads,1)
  resources.selectEntry(f.options,'/bundled/index.html');resources.confirm(f.options)
  assert.equal((await controller.check(window)).status,'update-not-available')
  const old=f.make('index.html','older','1.0.0')
  controller.readManifest=async()=>({manifest:old.manifest,archiveURL:'http://localhost/old.zip'})
  assert.match((await controller.check(window)).message,/older/)
 }finally{f.close()}
})
test('an older asynchronous check cannot overwrite the latest candidate',async()=>{
 const f=fixture();try{
  const a=f.make(),b=f.make('index.html','newer','1.0.2'),resolvers=[]
  const controller=new ResourceUpdateController({options:f.options,readManifest:()=>new Promise(r=>resolvers.push(r)),readArchive:async()=>b.archive})
  const first=controller.check(window),second=controller.check(window)
  resolvers[1]({manifest:b.manifest,archiveURL:'http://localhost/b.zip'});await second
  resolvers[0]({manifest:a.manifest,archiveURL:'http://localhost/a.zip'})
  assert.equal((await first).status,'superseded')
  assert.equal((await controller.download(window)).status,'finished')
  assert.equal(resources.resourceInfo(f.options).pendingVersion,'1.0.2')
 }finally{f.close()}
})
test('resource installation requires a verified stage and cancellation cannot stage a late response',async()=>{
 const f=fixture();try{
  const good=f.make();let resolve,restarts=0
  const controller=new ResourceUpdateController({options:f.options,readManifest:async()=>({manifest:good.manifest,archiveURL:'http://localhost/a.zip'}),readArchive:()=>new Promise(r=>{resolve=r}),restart:()=>{restarts++}})
  assert.equal(controller.install().ok,false)
  await controller.check(window);const pending=controller.download(window)
  assert.equal(controller.cancel(window).ok,true)
  assert.equal((await controller.check(window)).status,'busy')
  resolve(good.archive);assert.equal((await pending).status,'cancelled')
  assert.equal(resources.resourceInfo(f.options).pendingVersion,null)
  controller.readArchive=async()=>good.archive
  await controller.check(window);await controller.download(window)
  assert.equal(controller.install().ok,true);assert.equal(restarts,1)
 }finally{f.close()}
})
