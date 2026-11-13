<template>
  <div class="home">
    <h1>Electron + Vue 3 + Vite 骨架 Demo</h1>
    <p class="sub">本页逐项演示骨架七大机制，代码即文档（对照 README 第七节「代码地图」学习）</p>

    <!-- ① 主进程↔渲染进程信息交互（IPC） -->
    <section class="card">
      <h2>① 主进程 ↔ 渲染进程信息交互（IPC）</h2>
      <p>应用：{{ version || '获取中...' }} / 界面：{{ rendererVersion || version }}　环境：{{ env }}</p>
      <p v-if="systemInfo">系统：{{ systemInfo.osDisplayName || systemInfo.osType }} / {{ systemInfo.cpuArch }} / 国产化：{{ systemInfo.isDomestic ? '是' : '否' }}</p>
      <button @click="getInfo">获取版本 / 系统信息</button>
      <p class="tip">IPC 通道：get-version（同步 sendSync）、get-system-info（异步 invoke）</p>
    </section>

    <!-- ② 窗口控制（IPC send/invoke） -->
    <section class="card">
      <h2>② 窗口控制（IPC invoke 示例）</h2>
      <button @click="invoke('windows-mini')">最小化</button>
      <button @click="invoke('window-max')">最大化/还原</button>
      <button @click="invoke('window-hide')">隐藏</button>
      <button @click="invoke('window-refresh')">刷新</button>
      <p class="tip">通道：windows-mini / window-max / window-hide / window-refresh（见 ipcMain.js）</p>
    </section>

    <!-- ③ 全量更新 -->
    <section class="card">
      <h2>③ 全量更新（electron-updater）</h2>
      <p class="status">{{ fullUpdateStatus }}</p>
      <progress v-if="fullProgress > 0" :value="fullProgress" max="100"></progress>
      <button @click="invoke('check-update')">检查全量更新</button>
      <button v-if="canDownload" @click="invoke('start-update')">下载更新</button>
      <button v-if="canInstall" @click="invoke('confirm-update')">退出并安装</button>
      <p class="tip">通道：check-update → 主进程推 update-msg（state：0 检查中 / 1 有更新 / 2 无更新 / 3 下载中 / 4 完成）</p>
    </section>

    <!-- ④ 热更新（增量资源） -->
    <section class="card">
      <h2>④ 热更新（增量资源 HotUpdater）</h2>
      <p class="status">{{ hotUpdateStatus }}</p>
      <button @click="invoke('hot-update')">检查热更新</button>
      <button v-if="canHotDownload" @click="invoke('start-hot-update')">下载热更新包</button>
      <button v-if="hotDone" @click="invoke('confirm-hot-update')">重启生效</button>
      <p class="tip">通道：hot-update → 主进程推 hot-update-status（update-available/downloading/moving/finished）</p>
    </section>

    <!-- ⑤ 深链唤起 -->
    <section class="card">
      <h2>⑤ 深链唤起（myapp:// 短链）</h2>
      <p>浏览器地址栏输入 <code>myapp://openapp?token=abc123</code> 回车，观察这里收到的参数：</p>
      <pre v-if="deepLink" class="result">{{ deepLink }}</pre>
      <p v-else class="status">（尚未收到深链参数）</p>
      <p class="tip">主进程 index.js 解析 myapp:// 后通过 webContents.send('deep-link-params', ...) 推送到此</p>
    </section>

    <!-- ⑥ iframe 内嵌 -->
    <section class="card">
      <h2>⑥ iframe 内嵌网页（webviewTag）</h2>
      <input v-model="iframeUrl" placeholder="输入要嵌入的 https 地址" class="url-input" />
      <div>
        <button @click="goIframe">跳转到 iframe 视图</button>
      </div>
      <p class="tip">
        走 /iframe 路由（views/iframe/index.vue），通过 query 传 src；主进程 webPreferences 已开 webviewTag:true
      </p>
    </section>

    <!-- ⑦ 本地持久化（electron-store） -->
    <section class="card">
      <h2>⑦ 本地持久化（electron-store）</h2>
      <input v-model="storeKey" placeholder="key" class="kv-input" />
      <input v-model="storeValue" placeholder="value" class="kv-input" />
      <button @click="setStore">写入</button>
      <button @click="getStore">读取</button>
      <button @click="deleteStore">删除</button>
      <p class="status">读取结果：{{ storeResult }}</p>
      <p class="tip">通道：setStore / getStore / deleteOne（sendSync 同步，见 ipcFun.js 的 initStore）</p>
    </section>
  </div>
</template>

<script>
export default {
  name: 'Home',
  data() {
    return {
      env: import.meta.env.MODE,
      version: '',
      rendererVersion: '',
      systemInfo: null,
      // 全量更新
      fullUpdateStatus: '未检查',
      fullProgress: 0,
      canDownload: false,
      canInstall: false,
      // 热更新
      hotUpdateStatus: '未检查',
      canHotDownload: false,
      hotDone: false,
      // 深链
      deepLink: '',
      // iframe
      iframeUrl: 'https://example.com',
      // store
      storeKey: '',
      storeValue: '',
      storeResult: ''
    }
  },
  methods: {
    subscribe(channel, callback) {
      this._ipcStops ||= new Map()
      this._ipcStops.get(channel)?.()
      const stop = this.$ipcRenderer.subscribe(channel, callback)
      this._ipcStops.set(channel, stop)
      return stop
    },
    // 异步 IPC（invoke → ipcMain.handle）
    invoke(channel, ...args) {
      return this.$ipcRenderer.invoke(channel, ...args)
    },
    // 同步 IPC（sendSync → ipcMain.on + returnValue）
    sendSync(channel, ...args) {
      return this.$ipcRenderer.sendSync(channel, ...args)
    },

    // ① 获取版本与系统信息
    async getInfo() {
      this.version = this.sendSync('get-version')
      this.systemInfo = await this.invoke('get-system-info')
      this.rendererVersion = await this.invoke('get-resource-version')
    },

    // ⑦ electron-store 增删查
    setStore() {
      this.$ipcRenderer.send('setStore', this.storeKey, this.storeValue)
      this.storeResult = `已写入 ${this.storeKey} = ${this.storeValue}`
    },
    getStore() {
      const v = this.sendSync('getStore', this.storeKey)
      this.storeResult = v === '' ? '（空值）' : `${this.storeKey} = ${v}`
    },
    deleteStore() {
      this.$ipcRenderer.send('deleteOne', this.storeKey)
      this.storeResult = `已删除 ${this.storeKey}`
    },

    // ⑥ 跳转 iframe 视图
    goIframe() {
      this.$router.push({ path: '/iframe', query: { src: this.iframeUrl } })
    }
  },
  mounted() {
    this.getInfo()

    // ============ ③ 全量更新事件（主进程 → 渲染进程） ============
    this.subscribe('update-msg', (e, info) => {
      // info = { state, msg }，state 见 checkupdate.js 状态机
      switch (info.state) {
        case 0:
          this.canDownload = false
          this.canInstall = false
          this.fullUpdateStatus = '正在检查更新...'
          break
        case 1:
          this.fullUpdateStatus = `发现新版本 ${info.msg?.version || ''}`
          this.canDownload = true
          break
        case 2:
          this.canDownload = false
          this.canInstall = false
          this.fullUpdateStatus = '已是最新版本'
          break
        case 3:
          this.fullProgress = Math.round((info.msg?.percent || 0))
          this.fullUpdateStatus = `下载中 ${this.fullProgress}%`
          break
        case 4:
          this.fullUpdateStatus = '下载完成，可安装'
          this.canInstall = true
          break
        case -1:
          this.canDownload = false
          this.canInstall = false
          this.fullUpdateStatus = `出错：${info.msg}`
          break
      }
    })

    // ============ ④ 热更新事件 ============
    this.subscribe('hot-update-status', (e, info) => {
      switch (info.status) {
        case 'update-not-available':
          this.hotUpdateStatus = '界面已是最新版本'
          this.canHotDownload = false
          break
        case 'update-available':
          this.hotUpdateStatus = '发现热更新'
          this.hotDone = false
          this.canHotDownload = true
          break
        case 'downloading':
          this.hotUpdateStatus = '正在下载...'
          break
        case 'moving':
          this.hotUpdateStatus = '正在解压替换...'
          break
        case 'finished':
          this.hotUpdateStatus = '热更新完成，重启后生效'
          this.canHotDownload = false
          this.hotDone = true
          break
        case 'failed':
          this.hotUpdateStatus = `失败：${info.message}`
          this.canHotDownload = false
          break
      }
    })

    // ============ ⑤ 深链参数事件 ============
    this.subscribe('deep-link-params', (e, params) => {
      this.deepLink = JSON.stringify(params, null, 2)
    })
  },
  beforeUnmount() {
    this._ipcStops?.forEach(stop => stop())
    this._ipcStops?.clear()
    // 清理监听，防止内存泄漏（每次进入页面都注册，销毁时必须移除）



  }
}
</script>

<style scoped>
.home {
  max-width: 860px;
  margin: 0 auto;
  padding: 24px;
  font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #303133;
}

.sub { color: #909399; margin-top: -8px; }

.card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 16px;
}

.card h2 { font-size: 16px; margin: 0 0 10px; }

button {
  padding: 6px 16px;
  margin-right: 8px;
  border: none;
  border-radius: 4px;
  background: #4080ff;
  color: #fff;
  cursor: pointer;
}

.status { color: #606266; font-size: 13px; }
.result {
  display: inline-block;
  background: #f4f4f5;
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 12px;
  word-break: break-all;
}
pre.result { display: block; max-height: 200px; overflow: auto; }
.tip { font-size: 12px; color: #909399; }
.url-input {
  width: 70%;
  padding: 6px 10px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  margin-bottom: 8px;
}
.kv-input {
  width: 160px;
  padding: 6px 10px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  margin: 0 8px 8px 0;
}
progress { width: 100%; margin: 6px 0; }
code { background: #f4f4f5; padding: 1px 5px; border-radius: 3px; }
</style>
