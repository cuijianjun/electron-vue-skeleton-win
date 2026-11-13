const listeners=new Map()
function api(){if(!window.electronAPI)throw new Error('Desktop bridge unavailable');return window.electronAPI}
function operation(group,channel,args){
  const fn=api()[group]?.[channel]
  if(typeof fn!=='function')throw new Error('Unsupported desktop operation: '+channel)
  return fn(...args)
}
export const ipcRenderer={
  invoke:(channel,...args)=>operation('calls',channel,args),
  send(channel,...args){
    if(api().writes[channel])return operation('writes',channel,args)
    return operation('calls',channel,args)
  },
  sendSync:(channel,...args)=>operation('reads',channel,args),
  subscribe(channel,callback){
    if(!api().events[channel])throw new Error('Unsupported desktop event: '+channel)
    let group=listeners.get(channel)
    group?.get(callback)?.()
    const stop=api().events[channel]((...args)=>callback(null,...args))
    if(!group){group=new Map();listeners.set(channel,group)}
    group.set(callback,stop)
    return ()=>{stop();if(group.get(callback)===stop)group.delete(callback);if(!group.size && listeners.get(channel)===group)listeners.delete(channel)}
  },
  on(channel,callback){return this.subscribe(channel,callback)},
  removeListener(channel,callback){const group=listeners.get(channel);group?.get(callback)?.();group?.delete(callback);if(!group?.size)listeners.delete(channel)},
  removeAllListeners(channel){const group=listeners.get(channel);group?.forEach(stop=>stop());listeners.delete(channel)},
  listenerCount(channel){return listeners.get(channel)?.size||0}
}
export default ipcRenderer
