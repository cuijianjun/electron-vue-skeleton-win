import { BrowserWindow } from 'electron'
import { secureIpcMain as ipcMain } from './secureIpc'
import axios from 'axios'
import service from './resourceUpdateController.cjs'
import { resourceContext } from './resourceContext'
let controller
function feedURL(){
 const raw=process.env.RESOURCE_UPDATE_URL
 if(!raw)throw new Error('Resource update source is not configured')
 const url=new URL(raw)
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)))throw new Error('Resource update source must use HTTPS')
 if(url.username||url.password)throw new Error('Credentials in update URL are not supported')
 return url
}
function getController(){
 if(!controller)controller=new service.ResourceUpdateController({
   options:resourceContext(),
   async readManifest(){
     const feed=feedURL(),result=await axios.get(feed.href,{timeout:15000,maxContentLength:16384,maxRedirects:0})
     const archive=new URL(result.data.archive,feed)
     if(archive.origin!==feed.origin)throw new Error('Resource archive origin mismatch')
     return {manifest:result.data,archiveURL:archive.href}
   },
   async readArchive(url){return (await axios.get(url,{responseType:'arraybuffer',timeout:30000,maxContentLength:50*1024*1024,maxRedirects:0})).data}
 })
 return controller
}
export const updater=window=>getController().check(window)
ipcMain.handle('start-hot-update',event=>getController().download(BrowserWindow.fromWebContents(event.sender)))
export const getUpdateInfo=()=>({busy:Boolean(controller?.busy),available:Boolean(controller?.candidate)})
