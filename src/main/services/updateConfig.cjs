const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
function readUpdateConfig(file,env=process.env){
 let config={},error=null
 try{
  config=JSON.parse(fs.readFileSync(file,'utf8'))
  if(!config||typeof config!=='object'||Array.isArray(config)||['fullURL','resourceURL','publicKey'].some(k=>Object.hasOwn(config,k)&&typeof config[k]!=='string')||(Object.hasOwn(config,'autoCheck')&&typeof config.autoCheck!=='boolean')||(Object.hasOwn(config,'intervalHours')&&(!Number.isFinite(config.intervalHours)||config.intervalHours<1||config.intervalHours>168)))throw new Error('Invalid fields')
 }catch(e){config={};if(e.code!=='ENOENT')error='Update configuration is invalid'}
 const pick=(name,fallback)=>Object.hasOwn(env,name)?env[name]:fallback
 let publicKey=pick('RESOURCE_UPDATE_PUBLIC_KEY',config.publicKey||null),resourceError=error
 try{
  if(env.RESOURCE_UPDATE_PUBLIC_KEY_FILE)publicKey=fs.readFileSync(env.RESOURCE_UPDATE_PUBLIC_KEY_FILE,'utf8')
  if(publicKey){if(publicKey.includes('PRIVATE KEY')||crypto.createPublicKey(publicKey).asymmetricKeyType!=='ed25519')throw new Error();}
 }catch{publicKey=null;resourceError='Resource publisher public key is unavailable or invalid'}
 return {fullURL:pick('APP_UPDATE_URL',config.fullURL||''),resourceURL:pick('RESOURCE_UPDATE_URL',config.resourceURL||''),publicKey,autoCheck:config.autoCheck===true,intervalHours:Number.isFinite(config.intervalHours)&&config.intervalHours>=1&&config.intervalHours<=168?config.intervalHours:12,error,resourceError}
}
function updateConfig(app){return readUpdateConfig(app.isPackaged?path.join(process.resourcesPath,'updates.json'):path.join(app.getAppPath(),'config/updates.json'))}
module.exports={readUpdateConfig,updateConfig}
