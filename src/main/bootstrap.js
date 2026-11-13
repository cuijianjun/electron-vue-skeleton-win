import { app } from 'electron'
import fs from 'node:fs'
if (process.env.SKELETON_E2E === '1' && process.env.SKELETON_USER_DATA) {
  fs.mkdirSync(process.env.SKELETON_USER_DATA, {recursive:true})
  app.setPath('userData',process.env.SKELETON_USER_DATA)
}

if(process.env.SKELETON_E2E === '1' && process.env.SKELETON_DEV_DEBUG === '1') app.commandLine.appendSwitch('remote-debugging-port','0')
