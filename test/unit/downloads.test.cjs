const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path')
const {downloadPath,uniquePath}=require('../../src/main/services/downloadPolicy.cjs')
const fs=require('node:fs'),os=require('node:os')
test('download targets stay inside Downloads or a user-selected directory',()=>{
 const base=path.resolve('tmp Downloads'),selected=path.resolve('picked 中文')
 assert.equal(downloadPath(base,null,new Set(),'中文 file.txt'),path.join(base,'中文 file.txt'))
 assert.equal(downloadPath(base,selected,new Set([selected]),'file.txt'),path.join(selected,'file.txt'))
 assert.throws(()=>downloadPath(base,'../escape',new Set(),'a.txt'))
 assert.throws(()=>downloadPath(base,selected,new Set(),'a.txt'))
 assert.throws(()=>downloadPath(base,null,new Set(),'../a.txt'))
})
test('a dangling filename symlink is treated as occupied rather than overwritten',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'download-name-'))
 try{
  const filename=path.join(root,'file.txt')
  fs.symlinkSync(path.join(root,'nonexistent-target'),filename,process.platform==='win32'?'junction':'file')
  assert.equal(uniquePath(filename),path.join(root,'file(1).txt'))
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})
test('a Downloads symlink cannot bypass directory consent',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'download-policy-'))
 try{
  const base=path.join(root,'Downloads'),outside=path.join(root,'outside')
  fs.mkdirSync(base);fs.mkdirSync(outside)
  fs.symlinkSync(outside,path.join(base,'link'),process.platform==='win32'?'junction':'dir')
  assert.throws(()=>downloadPath(base,'link',new Set(),'a.txt'),/Select/)
  assert.throws(()=>downloadPath(base,'link/new-folder',new Set(),'a.txt'),/Select/)
  assert.equal(downloadPath(base,'link',new Set([outside]),'a.txt'),path.join(fs.realpathSync(outside),'a.txt'))
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})
