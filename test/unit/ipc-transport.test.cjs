const {test}=require('node:test'),assert=require('node:assert/strict')
const {EventEmitter}=require('node:events')
const ipc=require('../../src/shared/ipc.mjs')
function fixture(){
 const native=new EventEmitter(),handlers=new Map(),sent=[]
 native.handle=(name,fn)=>{assert.ok(!handlers.has(name));handlers.set(name,fn)}
 const main=ipc.createMain(native,{assertSender:event=>{if(!event.trusted)throw Error('Untrusted IPC sender')},canSend:target=>target.trusted})
 const renderer=new EventEmitter()
 renderer.invoke=(name,envelope)=>handlers.get(name)({trusted:true},envelope)
 const target={trusted:true,send:(...args)=>{sent.push(args);renderer.emit(args[0],{},args[1])}}
 return {native,handlers,main,renderer,target,sent}
}
test('one transport validates direction/sender and registration is idempotent',async()=>{
 const f=fixture();assert.equal(ipc.createMain(f.native,{assertSender:()=>{},canSend:()=>false}),f.main)
 f.main.handle('get-version',()=> '1');f.main.handle('get-version',()=> '2')
 assert.equal(f.handlers.size,1)
 assert.equal(await f.renderer.invoke(ipc.REQUEST,{operation:'get-version',args:[]}), '2')
 await assert.rejects(async()=>f.handlers.get(ipc.REQUEST)({trusted:false},{operation:'get-version',args:[]}),/Untrusted/)
 await assert.rejects(async()=>f.renderer.invoke(ipc.REQUEST,{operation:'w-max',args:[]}),/Unsupported/)
 await assert.rejects(async()=>f.renderer.invoke(ipc.REQUEST,{operation:'getStore',args:['__proto__.x']}),/store key/)
 assert.equal(f.main.send({trusted:false},'w-max',true),false)
})
test('bootstrap is async; cached legacy reads never invoke native sendSync',async()=>{
 const f=fixture();f.main.handle('desktop-bootstrap',()=>({version:'1',systemSummary:'test',settings:{revision:1,values:{flag:false,count:0}}}))
 f.renderer.sendSync=()=>assert.fail('native synchronous IPC is forbidden')
 const bridge=ipc.createPreload(f.renderer)
 assert.throws(()=>bridge.reads.getStore('flag'),/not ready/)
 await bridge.ready()
 assert.equal(bridge.reads.getStore('flag'),false);assert.equal(bridge.reads.getStore('count'),0)
 assert.equal(bridge.reads['get-version'](),'1')
})
test('late snapshots cannot clobber optimistic writes and failed writes roll back',async()=>{
 const f=fixture();const pending=[]
 f.main.handle('desktop-bootstrap',()=>({settings:{revision:1,values:{key:'initial'}},version:'1'}))
 f.main.handle('setStore',(_e,...args)=>new Promise((resolve,reject)=>pending.push({args,resolve,reject})))
 const b=ipc.createPreload(f.renderer);await b.ready()
 const a=b.writes.setStore('key','a'),c=b.writes.setStore('key','b')
 f.main.send(f.target,'settings-changed',{revision:2,values:{key:'a'}})
 assert.equal(b.reads.getStore('key'),'b')
 pending[0].resolve({revision:2,values:{key:'a'}});await a
 assert.equal(b.reads.getStore('key'),'b')
 pending[1].resolve({revision:3,values:{key:'b'}});await c
 f.main.send(f.target,'settings-changed',{revision:1,values:{key:'stale'}})
 assert.equal(b.reads.getStore('key'),'b')
 const rejected=b.writes.setStore('key','failed');pending[2].reject(Error('disk full'))
 await assert.rejects(rejected,/disk full/);assert.equal(b.reads.getStore('key'),'b')
})
test('scopes only dispose their subscriptions, early payloads are delivered once',async()=>{
 const f=fixture();f.main.handle('desktop-bootstrap',()=>({settings:{revision:0,values:{}}}))
 const bridge=ipc.createPreload(f.renderer),client=ipc.createClient(bridge)
 await bridge.ready();f.main.send(f.target,'send-data',{id:1})
 const a=client.desktop.scope(),b=client.desktop.scope(),hits=[]
 a.events.on('send-data',v=>hits.push(v.id));await Promise.resolve();assert.deepEqual(hits,[1])
 a.events.on('w-max',v=>hits.push('a'+v));b.events.on('w-max',v=>hits.push('b'+v))
 a.dispose();f.main.send(f.target,'w-max',true)
 assert.deepEqual(hits,[1,'btrue']);assert.equal(client.ipcRenderer.listenerCount('w-max'),1)
 b.dispose();assert.equal(client.ipcRenderer.listenerCount('w-max'),0)
})

test('an old disposer called twice cannot remove a replacement subscription',async()=>{
 const f=fixture();const bridge=ipc.createPreload(f.renderer),client=ipc.createClient(bridge)
 let hits=0;const callback=()=>hits++
 const old=client.ipcRenderer.subscribe('w-max',callback)
 client.ipcRenderer.subscribe('w-max',callback);old()
 f.main.send(f.target,'w-max',true);assert.equal(hits,1)
})

test('newer write acknowledgement retires earlier pending overlays, including different keys',async()=>{
 const f=fixture(),pending=[]
 f.main.handle('desktop-bootstrap',()=>({clientId:7,settings:{revision:0,values:{}}}))
 f.main.handle('setStore',(_e,...args)=>new Promise((resolve,reject)=>pending.push({args,resolve,reject})))
 const b=ipc.createPreload(f.renderer);await b.ready()
 const a=b.writes.setStore('x','a'),other=b.writes.setStore('other',false),c=b.writes.setStore('x','b')
 pending[2].resolve({revision:3,values:{x:'b',other:false}});await c
 assert.equal(b.reads.getStore('x'),'b');assert.equal(b.reads.getStore('other'),false)
 pending[0].resolve({revision:1,values:{x:'a'}});await a
 pending[1].resolve({revision:2,values:{x:'a',other:false}});await other
 assert.equal(b.reads.getStore('x'),'b')
 const late=b.writes.setStore('x','late')
 const sequence=pending[3].args[2]
 f.main.send(f.target,'settings-changed',{revision:4,values:{x:'late'},ack:{senderId:7,sequence}})
 f.main.send(f.target,'settings-changed',{revision:5,values:{x:'other-window'},ack:{senderId:8,sequence:1}})
 assert.equal(b.reads.getStore('x'),'other-window')
 pending[3].resolve({revision:4,values:{x:'late'}});await late
 assert.equal(b.reads.getStore('x'),'other-window')
})

test('early and live events preserve structured-clone types and cyclic payloads',async()=>{
 const f=fixture(),b=ipc.createPreload(f.renderer),payload={bytes:new Uint8Array([1,2]),when:new Date(0)};payload.self=payload
 f.main.send(f.target,'send-data',payload)
 const received=[];b.events['send-data'](value=>received.push(value));await Promise.resolve()
 f.main.send(f.target,'send-data',payload)
 for(const value of received){assert.ok(value.bytes instanceof Uint8Array);assert.deepEqual([...value.bytes],[1,2]);assert.ok(value.when instanceof Date);assert.equal(value.self,value)}
 assert.equal(received.length,2)
})
