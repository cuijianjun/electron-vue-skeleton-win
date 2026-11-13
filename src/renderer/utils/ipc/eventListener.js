import {desktop} from './bridge'
export function listenContextMenu(){
  const handler=event=>{
    if(['/mindMap','/draw','/luckySheet'].includes(location.hash.slice(1).split('?')[0]))return
    if(document.getElementById('tags-view-container')?.contains(event.target))return
    event.preventDefault();desktop.window.contextMenu()
  }
  window.addEventListener('contextmenu',handler)
  return ()=>window.removeEventListener('contextmenu',handler)
}
