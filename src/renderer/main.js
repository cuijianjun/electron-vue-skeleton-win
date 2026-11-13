import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import ipcRenderer, { desktop } from './utils/ipc/bridge'
import { listenEventContextMenu, clearLocalStorage } from './utils/ipc'
import './assets/styles/index.css'
async function start(){
  await desktop.ready()
  const app=createApp(App)
  app.config.globalProperties.$desktop=desktop
  app.config.globalProperties.$ipcRenderer=ipcRenderer
  app.use(router).use(store).mount('#app')
  const stopContext=listenEventContextMenu(),stopClose=clearLocalStorage()
  window.addEventListener('beforeunload',()=>{stopContext();stopClose();desktop.dispose()},{once:true})
  await router.isReady()
  await desktop.app.ready()
}
start().catch(error=>{
  console.error('Renderer startup failed',error)
  document.querySelector('#app').textContent='应用初始化失败，请重启应用。'
})
