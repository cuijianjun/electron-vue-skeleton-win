import { contextBridge, ipcRenderer } from 'electron'
import ipc from '../shared/ipc.mjs'
contextBridge.exposeInMainWorld('electronAPI',ipc.createPreload(ipcRenderer,process.platform,process.arch))
