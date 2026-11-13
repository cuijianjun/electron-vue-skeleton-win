import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import resources from './resourceUpdates.cjs'
import settings from './updateConfig.cjs'
let context
export function resourceContext(){
 if(context)return context
 const pkg=JSON.parse(fs.readFileSync(path.join(app.getAppPath(),'package.json'),'utf8'))
 const configuration=settings.updateConfig(app),key=configuration.publicKey
 let metadata
 try{metadata=JSON.parse(fs.readFileSync(path.join(__dirname,'../runtime-build.json'),'utf8'))}catch{}
 const root=path.join(app.getPath('userData'),'resource-updates')
 if(!metadata || !/^[a-f0-9]{64}$/.test(metadata.lockHash) || metadata.appVersion!==pkg.version || metadata.electronVersion!==process.versions.electron) return context={root,publicKey:null,platform:process.platform,arch:process.arch,runtimeId:null,appVersion:pkg.version,error:'Runtime build metadata is missing or incompatible; rebuild the application'}
 context={root,bundledDir:path.resolve(__dirname,'../renderer'),error:configuration.resourceError,appVersion:pkg.version,publicKey:key,platform:process.platform,arch:process.arch,
  runtimeId:resources.runtimeIdentity({mainFile:__filename,preloadFile:path.join(__dirname,'../preload/index.cjs'),dependencies:pkg.dependencies,lockHash:metadata.lockHash,electronVersion:process.versions.electron,appVersion:pkg.version})}
 return context
}
