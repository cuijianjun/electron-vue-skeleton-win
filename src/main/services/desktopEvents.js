import { app, Menu, BrowserWindow } from 'electron'
import Store from 'electron-store'
import { secureIpcMain as ipcMain } from './secureIpc'
const store=new Store()
let registered=false
export function initializeDesktopEvents(mainWindow){
  mainWindow.on('maximize',()=>mainWindow.webContents.send('w-max',true))
  mainWindow.on('unmaximize',()=>mainWindow.webContents.send('w-max',false))
  mainWindow.on('close',()=>{if(!mainWindow.webContents.isDestroyed())mainWindow.webContents.send('closeApp','clearStorage')})
  if(registered)return
  registered=true
  ipcMain.on('show-context-menu',event=>{
    Menu.buildFromTemplate([{label:'重新加载',role:'reload'},{label:'清除缓存并刷新',click(){event.sender.send('closeApp','clearStorage');event.sender.reload()}},{label:'退出',click(){app.quit()}}]).popup({window:BrowserWindow.fromWebContents(event.sender)})
  })
  for(const channel of ['sendRefresh','siblingConnect'])ipcMain.on(channel,(_event,value)=>{
    if(!mainWindow.isDestroyed())mainWindow.webContents.send(channel==='sendRefresh'?'receiveRefresh':channel,value)
  })
  ipcMain.on('setStore',(_event,key,value)=>store.set(key,value))
  ipcMain.on('getStore',(event,key)=>{event.returnValue=store.get(key)??''})
  ipcMain.on('getAllStore',event=>{event.returnValue=store.store})
  ipcMain.on('deleteOne',(_event,key)=>store.delete(key))
  ipcMain.on('deleteAll',()=>store.clear())
}
