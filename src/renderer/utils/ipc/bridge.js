import protocol from '../../../shared/ipc.mjs'
const client=protocol.createClient(window.electronAPI)
export const desktop=client.desktop
// Compatibility only: sendSync reads the initialized memory cache, never native IPC.
export const ipcRenderer=client.ipcRenderer
export default ipcRenderer
