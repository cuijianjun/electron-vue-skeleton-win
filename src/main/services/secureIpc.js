import { ipcMain } from 'electron'
import policy from './ipcPolicy.cjs'
import contract from '../../shared/ipc-contract.cjs'
import { allowedEntries } from '../config/StaticPath'
export const secureIpcMain = {
  handle(channel,listener) {
    ipcMain.handle(channel,(event,...args)=>{
      policy.assertSender(event,allowedEntries())
      contract.validate(channel,args)
      return listener(event,...args)
    })
  },
  on(channel,listener) {
    ipcMain.on(channel,(event,...args)=>{
      try {
        policy.assertSender(event,allowedEntries())
        contract.validate(channel,args)
        listener(event,...args)
      } catch (error) {
        if(contract.SYNC.includes(channel))event.returnValue=null
        console.warn('Rejected IPC operation:',channel,error.message)
      }
    })
  }
}
