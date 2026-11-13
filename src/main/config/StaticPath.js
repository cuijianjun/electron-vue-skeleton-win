import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { app } from 'electron'
import resources from '../services/resourceUpdates.cjs'
import { resourceContext } from '../services/resourceContext'
global.__static=app.isPackaged?path.join(process.resourcesPath,'static'):path.join(app.getAppPath(),'static')
export const bundledEntry=path.resolve(__dirname,'../renderer/index.html')
const developmentURL=!app.isPackaged && process.env.NODE_ENV==='development'?process.env.ELECTRON_RENDERER_URL:null
let entry=developmentURL?bundledEntry:resources.selectEntry(resourceContext(),bundledEntry)
export let winURL=developmentURL||pathToFileURL(entry).href
export function allowedEntries(){return [winURL]}
export function watchRendererStartup(win){
 if(developmentURL)return
 const timer=setTimeout(()=>{
   if(!win.isDestroyed()&&resources.readState(resourceContext())?.status==='booting'){
     entry=resources.selectEntry(resourceContext(),bundledEntry)
     winURL=pathToFileURL(entry).href
     win.loadURL(winURL)
   }
 },12000)
 timer.unref()
 win.once('closed',()=>clearTimeout(timer))
}
export const loadingURL=pathToFileURL(path.join(global.__static,'loader.html')).href
export const libPath=path.join(app.isPackaged?path.dirname(process.execPath):app.getAppPath(),process.env.SKELETON_DLL_FOLDER||'')
