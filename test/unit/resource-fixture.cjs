const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),AdmZip=require('adm-zip')
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'resource-update-test-'))
 const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519')
 const runtimeId='a'.repeat(64)
 function make(entry='index.html',content='new renderer',version='1.0.1'){
  const zip=new AdmZip();zip.addFile(entry,Buffer.from(content));const archive=zip.toBuffer()
  return sign(archive,version)
 }
 function sign(archive,version='1.0.1'){
  const manifest={schemaVersion:1,version,platform:process.platform,arch:process.arch,runtimeId,sha256:crypto.createHash('sha256').update(archive).digest('hex'),archive:'renderer.zip'}
  manifest.signature=crypto.sign(null,Buffer.from(JSON.stringify(manifest)),privateKey).toString('base64')
  return {archive,manifest}
 }
 return {root,make,sign,options:{root,runtimeId,appVersion:'1.0.0',platform:process.platform,arch:process.arch,publicKey},close(){fs.rmSync(root,{recursive:true,force:true})}}
}
module.exports={fixture}
