const path=require('node:path'),fs=require('node:fs')
function canonicalDirectory(value){
 let current=path.resolve(value);const suffix=[]
 for(;;){
   try{fs.lstatSync(current);break}catch(error){if(error.code!=='ENOENT')throw error}
   const parent=path.dirname(current);if(parent===current)throw new Error('Invalid directory')
   suffix.unshift(path.basename(current));current=parent
 }
 const existing=fs.realpathSync(current)
 if(!fs.statSync(existing).isDirectory())throw new Error('Invalid directory')
 return path.join(existing,...suffix)
}
function downloadPath(base,requested,selected,filename){
 base=canonicalDirectory(base)
 const directory=requested?canonicalDirectory(path.resolve(base,requested)):base
 const granted=new Set([...selected].map(canonicalDirectory))
 const relative=path.relative(base,directory)
 if((relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative))&&!granted.has(directory))throw new Error('Select the download directory first')
 if(typeof filename!=='string'||!filename||filename==='.'||filename==='..'||/[\\/<>:"|?*\x00-\x1f]/.test(filename))throw new Error('Invalid download filename')
 return path.join(directory,filename)
}
function uniquePath(filename){
 let target=filename
 for(let i=1;;i++){
   try{fs.lstatSync(target)}catch(error){if(error.code==='ENOENT')return target;throw error}
   if(i>10000)throw new Error('Too many duplicate downloads')
   target=path.join(path.dirname(filename),path.basename(filename,path.extname(filename))+'('+i+')'+path.extname(filename))
 }
}
module.exports={downloadPath,canonicalDirectory,uniquePath}
