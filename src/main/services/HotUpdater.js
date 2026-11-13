import { app } from 'electron'
import axios from 'axios'
import service from './resourceUpdateController.cjs'
import { resourceContext } from './resourceContext'
import settings from './updateConfig.cjs'
let controller
function feedURL(){
 const raw=settings.updateConfig(app).resourceURL
 if(!raw)throw new Error('Resource update source is not configured')
 const url=new URL(raw)
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)))throw new Error('Resource update source must use HTTPS')
 if(url.username||url.password)throw new Error('Credentials in update URL are not supported')
 return url
}
function getController(){
 if(!controller)controller=new service.ResourceUpdateController({
  options:resourceContext(),
  restart(){setImmediate(()=>{app.relaunch();app.exit(0)})},
  async readManifest(signal){
   const feed=feedURL(),result=await axios.get(feed.href,{signal,timeout:15000,maxContentLength:2*1024*1024,maxRedirects:0})
   const archive=new URL(result.data.archive,feed)
   if(archive.origin!==feed.origin)throw new Error('Resource archive origin mismatch')
   return {manifest:result.data,archiveURL:archive.href,manifestURL:feed.href}
  },
  async readArchive(url,signal,progress){return (await axios.get(url,{signal,responseType:'arraybuffer',timeout:30000,maxContentLength:50*1024*1024,maxRedirects:0,onDownloadProgress:info=>{if(info.total)progress(Math.round(info.loaded/info.total*100))}})).data}
 })
 return controller
}
export const updater=window=>getController().check(window)
export const downloadResources=window=>getController().download(window)
export const cancelResources=window=>getController().cancel(window)
export const installResources=()=>getController().install()
export const getUpdateInfo=()=>({busy:Boolean(controller?.busy||controller?.installing),available:Boolean(controller?.candidate)})
