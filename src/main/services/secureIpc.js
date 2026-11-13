import { ipcMain } from 'electron'
import policy from './ipcPolicy.cjs'
import ipc from '../../shared/ipc.mjs'
import { allowedEntries } from '../config/StaticPath'
export const secureIpcMain=ipc.createMain(ipcMain,{
  assertSender:event=>policy.assertSender(event,allowedEntries()),
  canSend:target=>{
    try{policy.assertSender({senderFrame:target.mainFrame},allowedEntries());return true}catch{return false}
  }
})
