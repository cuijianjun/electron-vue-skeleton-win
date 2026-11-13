import ipcRenderer from './bridge'
export function onCloseApp(){
  return ipcRenderer.on('closeApp',(_event,type)=>{
    if(type==='clearStorage') for(const key of Object.keys(localStorage))if(key!=='tomorrowTipStartTime')localStorage.removeItem(key)
  })
}
