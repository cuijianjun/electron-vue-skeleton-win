import { secureIpcMain as desktopIpc } from './secureIpc'
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import policy from './downloadPolicy.cjs'
const directories=new Map(),pending=new Map()
export function grantDirectory(contents,directory){
 if(!directories.has(contents.id)){directories.set(contents.id,new Set());contents.once('destroyed',()=>directories.delete(contents.id))}
 directories.get(contents.id).add(policy.canonicalDirectory(directory))
}
export function startDownload(window,options){
 const url=new URL(options.url||process.env.APP_DOWNLOAD_URL||'')
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('Use an explicit HTTP(S) download URL')
 if(options.directory)policy.downloadPath(app.getPath('downloads'),options.directory,directories.get(window.webContents.id)||new Set(),'probe')
 if(pending.has(window.id))throw new Error('A download request is already starting')
 const contents=window.webContents,session=contents.session
 const send=(channel,value)=>{if(!window.isDestroyed())desktopIpc.send(contents,channel,value)}
 let timer
 const cleanup=()=>{session.removeListener('will-download',listener);window.removeListener('closed',cleanup);clearTimeout(timer);pending.delete(window.id)}
 const listener=(event,item,owner)=>{
   if(owner?.id!==contents.id)return
   cleanup()
   try {
     let target=policy.downloadPath(app.getPath('downloads'),options.directory,directories.get(contents.id)||new Set(),options.filename||item.getFilename())
     fs.mkdirSync(path.dirname(target),{recursive:true})
     target=policy.uniquePath(target)
     item.setSavePath(target)
     item.on('updated',(_event,state)=>{if(state==='interrupted')send('download-paused',true);else send('download-progress',item.getTotalBytes()>0?Math.round(item.getReceivedBytes()/item.getTotalBytes()*100):0)})
     item.once('done',(_event,state)=>{if(state==='completed')send('download-done',{filePath:target,basename:path.basename(target)});else send('download-error',state)})
   }catch(error){item.cancel();send('download-error',error.message)}
 }
 pending.set(window.id,true);session.on('will-download',listener);window.once('closed',cleanup)
 timer=setTimeout(()=>{cleanup();send('download-error','Download response timed out')},60000);timer.unref()
 try{contents.downloadURL(url.href)}catch(error){cleanup();throw error}
 return {started:true}
}
