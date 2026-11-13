const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
const output='dist/electron',metadata=output+'/runtime-build.json'
function files(root,relative){
 const full=path.join(root,relative)
 if(!fs.existsSync(full))return []
 if(fs.statSync(full).isFile())return [relative]
 return fs.readdirSync(full).sort().flatMap(name=>files(root,relative+'/'+name))
}
function digest(root,names){
 const hash=crypto.createHash('sha256')
 for(const name of names.sort())hash.update(name+'\0').update(fs.readFileSync(path.join(root,name))).update('\0')
 return hash.digest('hex')
}
function inputHash(root,mode){
 const names=['src','config','env','electron.vite.config.mjs','scripts/build-info.cjs','package.json','package-lock.json','.nvmrc','.npmrc','.env','.env.local',`.env.${mode}`,`.env.${mode}.local`].flatMap(name=>files(root,name))
 // electron-vite forces NODE_ENV for build; ambient NODE_ENV is not an input.
 const buildEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>key.startsWith('RENDERER_VITE_')).sort(([a],[b])=>a.localeCompare(b)))
 return crypto.createHash('sha256').update(JSON.stringify([mode,process.version,process.platform,process.arch,buildEnv])).update(digest(root,names)).digest('hex')
}
function outputHash(root){return digest(root,files(root,output).filter(name=>name!==metadata))}
function writeBuildInfo(root,mode){
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'))
 const info={schemaVersion:1,lockHash:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'package-lock.json'))).digest('hex'),electronVersion:pkg.devDependencies.electron,appVersion:pkg.version,mode,inputHash:inputHash(root,mode),outputHash:outputHash(root)}
 fs.writeFileSync(path.join(root,metadata),JSON.stringify(info))
}
function isFresh(root,mode='production'){
 try{
  const info=JSON.parse(fs.readFileSync(path.join(root,metadata),'utf8'))
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'))
  if(info.schemaVersion!==1||info.appVersion!==pkg.version||info.electronVersion!==pkg.devDependencies.electron||info.lockHash!==crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'package-lock.json'))).digest('hex'))return false
  return ['main/index.cjs','preload/index.cjs','renderer/index.html'].every(name=>fs.existsSync(path.join(root,output,name)))&&info.mode===mode&&info.inputHash===inputHash(root,mode)&&info.outputHash===outputHash(root)
 }catch{return false}
}
module.exports={writeBuildInfo,isFresh}
