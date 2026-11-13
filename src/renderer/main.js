import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import ipcRenderer from './utils/ipc/bridge'
import { listenEventContextMenu, clearLocalStorage } from './utils/ipc'
import './assets/styles/index.css'
const app=createApp(App)
app.config.globalProperties.$ipcRenderer=ipcRenderer
app.use(router).use(store).mount('#app')
const stopContext=listenEventContextMenu()
const stopClose=clearLocalStorage()
window.addEventListener('beforeunload',()=>{stopContext();stopClose()},{once:true})

router.isReady().then(() => ipcRenderer.invoke('renderer-ready')).catch(error => console.error('Renderer startup acknowledgement failed', error))
