import { app, Menu, BrowserWindow } from 'electron'
import Store from 'electron-store'
import { secureIpcMain as ipc } from './secureIpc'
const store=new Store()
let revision=0
export function settingsSnapshot(){return {revision,values:store.store}}
function changed(event,sequence){
  ++revision
  const snapshot={...settingsSnapshot(),ack:{senderId:event.sender.id,sequence}}
  for(const window of BrowserWindow.getAllWindows())ipc.send(window.webContents,'settings-changed',snapshot)
  return snapshot
}
export function initializeDesktopEvents(mainWindow){
  mainWindow.on('maximize',()=>ipc.send(mainWindow.webContents,'w-max',true))
  mainWindow.on('unmaximize',()=>ipc.send(mainWindow.webContents,'w-max',false))
  mainWindow.on('close',()=>ipc.send(mainWindow.webContents,'closeApp','clearStorage'))
  ipc.handle('show-context-menu',event=>{
    Menu.buildFromTemplate([{label:'重新加载',role:'reload'},{label:'清除缓存并刷新',click(){ipc.send(event.sender,'closeApp','clearStorage');event.sender.reload()}},{label:'退出',click(){app.quit()}}]).popup({window:BrowserWindow.fromWebContents(event.sender)})
  })
  for(const channel of ['sendRefresh','siblingConnect'])ipc.handle(channel,(_event,value)=>{
    if(!mainWindow.isDestroyed())ipc.send(mainWindow.webContents,channel==='sendRefresh'?'receiveRefresh':channel,value)
  })
  ipc.handle('settings:snapshot',settingsSnapshot)
  ipc.handle('setStore',(event,key,value,sequence)=>{store.set(key,value);return changed(event,sequence)})
  ipc.handle('getStore',(_event,key)=>store.get(key)??'')
  ipc.handle('getAllStore',()=>store.store)
  ipc.handle('deleteOne',(event,key,sequence)=>{store.delete(key);return changed(event,sequence)})
  ipc.handle('deleteAll',(event,sequence)=>{store.clear();return changed(event,sequence)})
}
