import { contextBridge, ipcRenderer } from 'electron'
import contract from '../shared/ipc-contract.cjs'
const calls=Object.fromEntries(contract.INVOKE.map(channel=>[channel,(...args)=>ipcRenderer.invoke(channel,...args)]))
const writes=Object.fromEntries(contract.SEND.map(channel=>[channel,(...args)=>ipcRenderer.send(channel,...args)]))
const reads=Object.fromEntries(contract.SYNC.map(channel=>[channel,(...args)=>ipcRenderer.sendSync(channel,...args)]))
const events=Object.fromEntries(contract.EVENTS.map(channel=>[channel,callback=>{
  if(typeof callback!=='function')throw new TypeError('Expected callback')
  const listener=(_event,...args)=>callback(...args)
  ipcRenderer.on(channel,listener)
  return ()=>ipcRenderer.removeListener(channel,listener)
}]))
contextBridge.exposeInMainWorld('electronAPI',{calls,writes,reads,events,platform:process.platform,arch:process.arch})
