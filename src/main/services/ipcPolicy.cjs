function assertSender(event,entries) {
  const frame=event.senderFrame
  if(!frame||frame.parent!==null)throw new Error('Untrusted IPC frame')
  const actual=new URL(frame.url);actual.hash=''
  const accepted=entries.some(entry=>{
    const wanted=new URL(entry);wanted.hash=''
    if(wanted.protocol==='file:')return actual.href===wanted.href
    return ['http:','https:'].includes(wanted.protocol)&&actual.origin===wanted.origin
  })
  if(!accepted)throw new Error('Untrusted IPC sender')
}
module.exports={assertSender}
