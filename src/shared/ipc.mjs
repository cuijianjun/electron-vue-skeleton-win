const INVOKE = ['get-update-status','cancel-hot-update','desktop-bootstrap','getStore','getAllStore','get-system-summary','settings:snapshot','get-resource-version','renderer-ready','IsUseSysTitle','windows-mini','window-max','window-close','window-hide','window-refresh','files-download','start-download','check-update','start-update','cancel-update','confirm-update','hot-update','start-hot-update','confirm-hot-update','get-app-path','get-system-info','get-install-version','get-version','open-messagebox','open-errorbox','open-directory','open-win','get-log-path','open-log-folder','get-log-files','file:select','file:readChunk']
const SEND = ['setStore','deleteOne','deleteAll','show-context-menu','sendRefresh','siblingConnect']
const SYNC = ['getStore','getAllStore','get-version','get-system-summary']
const EVENTS = ['settings-changed','closeApp','receiveRefresh','siblingConnect','send-data','w-max','update-msg','hot-update-status','deep-link-params','download-done','download-error','download-paused','download-progress']
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

// This is the only module that touches the native request/event transport.
// Process adapters supply Electron objects; the protocol itself also runs in unit tests.
const REQUEST='desktop:request', EVENT='desktop:event'
const mains=new WeakMap()
let targetPolicy=()=>true
function sendEvent(target,operation,...args){
  if(!EVENTS.includes(operation))throw new Error('Unsupported desktop event')
  if(!target || target.isDestroyed?.() || !targetPolicy(target))return false
  target.send(EVENT,{operation,args})
  return true
}
function createMain(native,{assertSender,canSend}){
  if(mains.has(native))return mains.get(native)
  targetPolicy=canSend
  const handlers=new Map()
  const bus={
    handle(operation,listener){
      if(!INVOKE.includes(operation)&&!SEND.includes(operation))throw new Error('Unsupported IPC operation')
      handlers.set(operation,listener)
    },
    on(operation,listener){this.handle(operation,listener)},
    async dispatch(event,operation,args=[]){
      assertSender(event);validate(operation,args)
      const handler=handlers.get(operation)
      if(!handler)throw new Error('IPC operation unavailable: '+operation)
      return handler(event,...args)
    },
    send:sendEvent
  }
  native.handle(REQUEST,(event,envelope)=>{
    if(!envelope||typeof envelope.operation!=='string')throw new Error('Invalid IPC envelope')
    return bus.dispatch(event,envelope.operation,envelope.args)
  })
  mains.set(native,bus)
  return bus
}
function copy(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value))}
function readKey(values,key){return key.split('.').reduce((value,part)=>value?.[part],values)}
function edit(values,operation,args){
  if(operation==='deleteAll')return {}
  const parts=args[0].split('.'),last=parts.pop()
  let parent=values
  for(const part of parts){
    if(!parent[part]||typeof parent[part]!=='object')parent[part]={}
    parent=parent[part]
  }
  if(operation==='deleteOne')delete parent[last]
  else parent[last]=copy(args[1])
  return values
}
function createPreload(native,platform='',arch=''){
  const listeners=new Map(),early=new Map(),pending=[]
  let initialization,initialized=false,snapshot={revision:-1,values:{}},version,systemSummary,clientId,sequence=0
  const request=(operation,args)=>{validate(operation,args);return native.invoke(REQUEST,{operation,args})}
  function accept(next){
    if(next&&Number.isSafeInteger(next.revision)&&next.revision>=snapshot.revision&&next.values&&typeof next.values==='object')snapshot=copy(next)
    if(next?.ack&&next.ack.senderId===clientId&&Number.isSafeInteger(next.ack.sequence))acknowledge(next.ack.sequence)
  }
  function acknowledge(seq){for(let i=pending.length-1;i>=0;i--)if(pending[i].sequence<=seq)pending.splice(i,1)}
  function remove(item){const index=pending.indexOf(item);if(index>=0)pending.splice(index,1)}
  function values(){return pending.reduce((result,item)=>edit(result,item.operation,item.args),copy(snapshot.values))}
  native.on(EVENT,(_event,envelope)=>{
    if(!envelope||!EVENTS.includes(envelope.operation)||!Array.isArray(envelope.args))return
    const {operation,args}=envelope
    if(operation==='settings-changed')accept(args[0])
    const callbacks=listeners.get(operation)
    if(!callbacks?.size&&['send-data','deep-link-params'].includes(operation)){
      const queue=early.get(operation)||[];queue.push(args);early.set(operation,queue.slice(-32))
    }
    for(const callback of [...(callbacks||[])]){
      try{callback(...args)}catch(error){console.error('Desktop event listener failed',operation,error)}
    }
  })
  function subscribe(operation,callback){
    if(typeof callback!=='function')throw new TypeError('Expected callback')
    let group=listeners.get(operation)
    if(!group){group=new Set();listeners.set(operation,group)}
    group.add(callback)
    const queued=early.get(operation);early.delete(operation)
    if(queued)queueMicrotask(()=>{if(group.has(callback))for(const args of queued)callback(...args)})
    return ()=>{group.delete(callback);if(!group.size&&listeners.get(operation)===group)listeners.delete(operation)}
  }
  function mutate(operation,args){
    validate(operation,args)
    if(!initialized)throw new Error('Desktop cache is not ready; await desktop.ready()')
    const item={operation,args:copy(args),sequence:++sequence};pending.push(item)
    const wireArgs=operation==='setStore'?[args[0],args[1],item.sequence]:operation==='deleteOne'?[args[0],item.sequence]:[item.sequence]
    try{
      return Promise.resolve(request(operation,wireArgs)).then(result=>{accept(result);acknowledge(item.sequence);return copy(result)}).finally(()=>remove(item))
    }catch(error){remove(item);throw error}
  }
  const reads={
    getStore:key=>{validate('getStore',[key]);return copy(readKey(values(),key)??'')},
    getAllStore:()=>values(),
    'get-version':()=>version,
    'get-system-summary':()=>systemSummary
  }
  return {
    platform,arch,
    ready(){
      return initialization ||= request('desktop-bootstrap',[]).then(data=>{
        clientId=data.clientId;accept(data.settings);version=data.version;systemSummary=data.systemSummary;initialized=true
        return true
      })
    },
    calls:Object.fromEntries(INVOKE.map(operation=>[operation,(...args)=>request(operation,args)])),
    // Legacy writes are acknowledged asynchronous requests too; reads only access memory.
    writes:Object.fromEntries(SEND.map(operation=>[operation,(...args)=>['setStore','deleteOne','deleteAll'].includes(operation)?mutate(operation,args):request(operation,args)])),
    reads:Object.fromEntries(SYNC.map(operation=>[operation,(...args)=>{
      if(!initialized)throw new Error('Desktop cache is not ready; await desktop.ready()')
      validate(operation,args);return reads[operation](...args)
    }])),
    events:Object.fromEntries(EVENTS.map(operation=>[operation,callback=>subscribe(operation,callback)]))
  }
}
function createClient(bridge){
  const all=new Set()
  function scope(){
    const owned=new Set()
    let disposed=false
    function subscribe(operation,callback,legacy=false){
      if(disposed)throw new Error('Desktop scope is disposed')
      if(!bridge.events[operation])throw new Error('Unsupported desktop event: '+operation)
      for(const item of owned)if(item.operation===operation&&item.callback===callback)item.stop()
      const item={operation,callback,stop:null}
      const unsubscribe=bridge.events[operation]((...args)=>legacy?callback(null,...args):callback(...args))
      item.stop=()=>{unsubscribe();owned.delete(item);all.delete(item)}
      owned.add(item);all.add(item)
      return item.stop
    }
    const invoke=(operation,...args)=>{
      const fn=bridge.calls[operation]||bridge.writes[operation]
      if(!fn)throw new Error('Unsupported desktop operation: '+operation)
      return fn(...args)
    }
    const ipcRenderer={
      invoke,send:invoke,
      sendSync(operation,...args){
        if(!bridge.reads[operation])throw new Error('Unsupported cached operation: '+operation)
        return bridge.reads[operation](...args)
      },
      subscribe:(operation,callback)=>subscribe(operation,callback,true),
      on:(operation,callback)=>subscribe(operation,callback,true),
      removeListener(operation,callback){for(const item of owned)if(item.operation===operation&&item.callback===callback)item.stop()},
      removeAllListeners(operation){for(const item of owned)if(item.operation===operation)item.stop()},
      listenerCount(operation){return [...all].filter(item=>item.operation===operation).length}
    }
    const method=operation=>(...args)=>invoke(operation,...args)
    const desktop={
      ready:()=>bridge.ready(),scope:()=>scope().desktop,
      dispose(){disposed=true;for(const item of [...owned])item.stop()},
      events:{on:(operation,callback)=>subscribe(operation,callback)},
      app:{version:method('get-version'),rendererVersion:method('get-resource-version'),installedVersion:method('get-install-version'),ready:method('renderer-ready'),path:method('get-app-path')},
      system:{info:method('get-system-info'),summary:method('get-system-summary')},
      window:{open:method('open-win'),minimize:method('windows-mini'),maximize:method('window-max'),close:method('window-close'),hide:method('window-hide'),reload:method('window-refresh'),usesSystemTitle:method('IsUseSysTitle'),refreshSiblings:method('sendRefresh'),messageSiblings:method('siblingConnect'),contextMenu:method('show-context-menu')},
      settings:{get:method('getStore'),all:method('getAllStore'),set:method('setStore'),delete:method('deleteOne'),clear:method('deleteAll')},
      update:{status:method('get-update-status'),check:method('check-update'),download:method('start-update'),cancel:method('cancel-update'),install:method('confirm-update')},
      resources:{cancel:method('cancel-hot-update'),check:method('hot-update'),download:method('start-hot-update'),install:method('confirm-hot-update')},
      download:{start:method('files-download'),simple:method('start-download')},
      files:{select:method('file:select'),readChunk:method('file:readChunk'),directory:method('open-directory')},
      dialog:{message:method('open-messagebox'),error:method('open-errorbox')},
      logs:{path:method('get-log-path'),open:method('open-log-folder'),files:method('get-log-files')}
    }
    return {desktop,ipcRenderer}
  }
  return scope()
}
const protocol={INVOKE,SEND,SYNC,EVENTS,validate,REQUEST,EVENT,sendEvent,createMain,createPreload,createClient}
export {INVOKE,SEND,SYNC,EVENTS,validate,REQUEST,EVENT,sendEvent,createMain,createPreload,createClient}
export default protocol
