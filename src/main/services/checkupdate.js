import { autoUpdater } from 'electron-updater'
import { CancellationToken } from 'builder-util-runtime'
import controller from './updateController.cjs'
export default class Update {
 constructor(){this.controller=new controller.UpdateController(autoUpdater,()=>new CancellationToken())}
 checkUpdate(window){return this.controller.check(window,process.env.APP_UPDATE_URL||'')}
 handleDownload(){return this.controller.download()}
 cancel(){return this.controller.cancel()}
 quitInstall(){return this.controller.install()}
}
