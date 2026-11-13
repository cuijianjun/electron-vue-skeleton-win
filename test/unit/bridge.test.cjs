const { test } = require('node:test')
const assert = require('node:assert/strict')
const { validate, INVOKE, SYNC } = require('../../src/shared/ipc-contract.cjs')
const { assertSender } = require('../../src/main/services/ipcPolicy.cjs')

test('version supports both invoke and the existing synchronous read', () => {
  assert.ok(INVOKE.includes('get-version'))
  assert.ok(SYNC.includes('get-version'))
})
test('bridge rejects unknown channels and prototype store keys', () => {
  assert.throws(() => validate('unrestricted-shell', []))
  assert.throws(() => validate('setStore', ['__proto__.x', 'bad']))
  assert.throws(() => validate('getStore', ['constructor.prototype']))
  assert.doesNotThrow(() => validate('setStore', ['test-key', false]))
  assert.doesNotThrow(() => validate('setStore', ['test-key', 0]))
})
test('child routes and download schemes are bounded', () => {
  assert.throws(() => validate('open-win', [{ url: 'https://evil.example' }]))
  assert.throws(() => validate('start-download', [{ url: 'file:///etc/passwd' }]))
})
test('only exact application entries and top frames own privileged IPC', () => {
  const entries = ['file:///app/renderer/index.html', 'http://localhost:9080']
  const event = url => ({ senderFrame: { url, parent: null } })
  assert.doesNotThrow(() => assertSender(event('file:///app/renderer/index.html#/'), entries))
  assert.doesNotThrow(() => assertSender(event('http://localhost:9080/'), entries))
  assert.throws(() => assertSender(event('file:///app/renderer/evil.html'), entries))
  assert.throws(() => assertSender(event('https://evil.example'), entries))
  assert.throws(() => assertSender({ senderFrame: { url: entries[0], parent: {} } }, entries))
  assert.throws(() => assertSender({}, entries))
})

test('download contracts match the existing two distinct handlers',()=>{
 assert.doesNotThrow(()=>validate('files-download',[{downloadURL:'https://example.com/a',name:'a.txt'}]))
 assert.doesNotThrow(()=>validate('start-download',['https://example.com/a']))
 assert.throws(()=>validate('start-download',[{url:'https://example.com/a'}]))
 assert.throws(()=>validate('files-download',[{downloadURL:'https://example.com/a',name:'../x'}]))
})
