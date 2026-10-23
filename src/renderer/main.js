import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'

import './assets/styles/index.css'

// ============================================================
// 渲染进程 ↔ 主进程 通信桥梁
// ============================================================
// 真实项目采用 contextIsolation:false + nodeIntegration:true 的沙箱方案，
// 渲染进程可以直接 require('electron') 拿到 ipcRenderer。
// 这里把 ipcRenderer 挂到 Vue.prototype 上，所有组件里都能用 this.$ipcRenderer 调用。
// 例如：this.$ipcRenderer.send('window-close')、this.$ipcRenderer.invoke('get-version')
// ============================================================
import { ipcRenderer } from 'electron'

Vue.config.productionTip = false

Vue.prototype.$ipcRenderer = ipcRenderer

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')
