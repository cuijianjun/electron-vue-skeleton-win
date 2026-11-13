const INVOKE = ['get-resource-version','renderer-ready','IsUseSysTitle','windows-mini','window-max','window-close','window-hide','window-refresh','files-download','start-download','check-update','start-update','cancel-update','confirm-update','hot-update','start-hot-update','confirm-hot-update','get-app-path','get-system-info','get-install-version','get-version','open-messagebox','open-errorbox','open-directory','open-win','get-log-path','open-log-folder','get-log-files','file:select','file:readChunk']
const SEND = ['setStore','deleteOne','deleteAll','show-context-menu','sendRefresh','siblingConnect']
const SYNC = ['getStore','getAllStore','get-version','get-system-summary']
const EVENTS = ['closeApp','receiveRefresh','siblingConnect','send-data','w-max','update-msg','hot-update-status','deep-link-params','download-done','download-error','download-paused','download-progress']
const known = new Set([...INVOKE,...SEND,...SYNC])
function validate(channel,args) {
  if (!known.has(channel) || !Array.isArray(args)) throw new Error('Unsupported IPC operation')
  if (['setStore','getStore','deleteOne'].includes(channel)) {
    const key=args[0]
    if (typeof key!=='string'||!key||key.length>128||key.split('.').some(s=>['__proto__','prototype','constructor'].includes(s))) throw new Error('Invalid store key')
  }
  if (channel==='open-win') {
    const value=args[0]
    if (!value || typeof value.url!=='string'||!/^\/(?:iframe|updateTip)?(?:\?.*)?$/.test(value.url)) throw new Error('Invalid application route')
    if(value.opacity!==undefined&&(!Number.isFinite(value.opacity)||value.opacity<0||value.opacity>1))throw new Error('Invalid window opacity')
    if(value.resizable!==undefined&&typeof value.resizable!=='boolean')throw new Error('Invalid window option')
    for(const key of ['width','height','minWidth','minHeight']) if(value[key]!==undefined&&(!Number.isFinite(value[key])||value[key]<100||value[key]>10000)) throw new Error('Invalid window size')
  }
  if (['start-download','files-download'].includes(channel)) {
    const value=args[0];const raw=channel==='start-download'?(typeof value==='string'?value:null):value?.downloadURL
    let url;try {url=new URL(raw)} catch {throw new Error('Invalid download URL')}
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('Invalid download URL')
    if(channel==='files-download' && value.name !== undefined && (typeof value.name!=='string'||/[\\/]/.test(value.name)||value.name==='..'))throw new Error('Invalid download filename')
  }
  if (JSON.stringify(args).length>1024*1024) throw new Error('IPC payload too large')
}
module.exports={INVOKE,SEND,SYNC,EVENTS,validate}
