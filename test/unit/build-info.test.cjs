const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),os=require('node:os')
const {writeBuildInfo,isFresh}=require('../../scripts/build-info.cjs')
test('reuse rejects changed inputs, mode, missing or modified outputs',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'build-info-'))
 try{
  for(const dir of ['src','config','env','scripts','dist/electron/main','dist/electron/preload','dist/electron/renderer'])fs.mkdirSync(path.join(root,dir),{recursive:true})
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version:'1',devDependencies:{electron:'44'}}))
  for(const file of ['package-lock.json','electron.vite.config.mjs','scripts/build-info.cjs','src/main.js','env/production.env','dist/electron/main/index.cjs','dist/electron/preload/index.cjs','dist/electron/renderer/index.html'])fs.writeFileSync(path.join(root,file),'original')
  writeBuildInfo(root,'production');assert.equal(isFresh(root,'production'),true)
  const stamp=path.join(root,'dist/electron/runtime-build.json'),saved=JSON.parse(fs.readFileSync(stamp,'utf8'))
  for(const key of ['schemaVersion','lockHash','electronVersion','appVersion']){
   fs.writeFileSync(stamp,JSON.stringify({...saved,[key]:'corrupted'}))
   assert.equal(isFresh(root,'production'),false,key)
  }
  fs.writeFileSync(stamp,JSON.stringify(saved))
  assert.equal(isFresh(root,'test'),false)
  fs.writeFileSync(path.join(root,'.env.production'),'RENDERER_VITE_UPDATE_ENABLED=true')
  assert.equal(isFresh(root,'production'),false);fs.unlinkSync(path.join(root,'.env.production'))
  const old=process.env.RENDERER_VITE_UPDATE_ENABLED
  try{process.env.RENDERER_VITE_UPDATE_ENABLED='changed';assert.equal(isFresh(root,'production'),false)}finally{if(old===undefined)delete process.env.RENDERER_VITE_UPDATE_ENABLED;else process.env.RENDERER_VITE_UPDATE_ENABLED=old}
  const oldNodeEnv=process.env.NODE_ENV
  try{process.env.NODE_ENV='production';assert.equal(isFresh(root,'production'),true)}finally{if(oldNodeEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldNodeEnv}
  const source=path.join(root,'src/main.js');fs.writeFileSync(source,'changed');assert.equal(isFresh(root,'production'),false)
  fs.writeFileSync(source,'original');assert.equal(isFresh(root,'production'),true)
  const output=path.join(root,'dist/electron/preload/index.cjs');fs.appendFileSync(output,'tampered');assert.equal(isFresh(root,'production'),false)
  writeBuildInfo(root,'production');fs.unlinkSync(output);assert.equal(isFresh(root,'production'),false)
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})
