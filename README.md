# Electron + Vue2 桌面应用骨架（Windows 版）—— 完整使用文档

> 本文档面向**新手**，从零开始带你完成 Windows 环境下本骨架的环境搭建、开发、打包、更新与常见问题排查。
>
> 本骨架基于 **Electron + Vue2 + Vuex + Vue-Router + axios** 技术栈，底层模板源自 `electron-vue-template`，已内置完整的「七大机制」的**全部链路代码**（可运行 Demo），**不含任何业务代码**，拿到即可直接开发。
>
> 本文档与代码一一对应：你看到的每一个文件路径、每一个 IPC 通道名、每一处配置，都能在骨架源码里直接找到。**建议边看文档边对照 `src/` 目录下的源码学习。**

---

## 目录

1. [骨架是什么](#一骨架是什么)
2. [技术栈总览](#二技术栈总览)
3. [环境要求](#三环境要求)
4. [目录结构说明](#四目录结构说明)
5. [环境搭建（Windows）](#五环境搭建windows)
6. [开发与启动](#六开发与启动)
7. [七大机制完整链路代码地图（重点）](#七七大机制完整链路代码地图重点章节)
8. [打包发布（Windows）](#八打包发布windows)
9. [更新机制：全量更新与增量更新](#九更新机制全量更新与增量更新)
10. [配置项说明](#十配置项说明)
11. [常见问题排查](#十一常见问题排查)
12. [附录：脚本速查表 / 原生模块注意事项](#十二附录)

---

## 一、骨架是什么

这是一个**开箱即用的 Electron 桌面应用脚手架**，你可以把它理解为「官方 `vue init` 模板的增强实战版」。它已经帮你做好了以下事情：

- **双进程结构**：主进程（窗口/系统能力）与渲染进程（Vue 界面）分离，目录清晰
- **开发热重载**：`npm run dev` 一条命令同时启动 webpack-dev-server 和 Electron
- **完整的打包链路**：一键产出 NSIS 安装包（.exe）
- **完整的更新链路**：全量更新（electron-updater）+ 增量热更新（自研 HotUpdater）
- **多环境配置**：开发 / 测试 / 生产三套环境变量隔离
- **七大机制 Demo**：IPC 通信、窗口控制、全量更新、热更新、深链唤起、iframe 内嵌、本地持久化，全部在示例页 `Home.vue` 中可点可跑

> 简单说：你只需要关注 Vue 界面和业务逻辑的开发，打包、更新、主进程通信这些「脏活累活」骨架已经封装好了。

---

## 二、技术栈总览

| 类别 | 技术 | 版本（package.json） |
|------|------|----------------------|
| 桌面框架 | Electron | ^21.4.4 |
| 前端框架 | Vue | ^2.7.14 |
| 状态管理 | Vuex | ^3.6.0 |
| 路由 | Vue-Router | ^3.6.5 |
| HTTP 请求 | axios | ^1.4.0 |
| 打包工具 | electron-builder | ^22.0.0 |
| 构建工具 | webpack | ^5.88.2 |
| 编译加速 | esbuild-loader | ^3.2.0 |
| 日志 | electron-log | ^5.4.0 |
| 自动更新 | electron-updater | ^5.3.0 |
| 本地持久化 | electron-store | 8.0.1（精确版本） |
| 文件操作 | fs-extra | ^11.1.0 |
| 解压 | extract-zip | ^2.0.1 |
| 版本比较 | semver | ^7.5.4 |
| 解压（全量） | adm-zip | ^0.5.10 |

> UI 组件库（Element-UI / Ant Design Vue 等）**骨架未内置**，按你的项目需要自行 `npm install` 后在 `src/renderer/main.js` 中注册即可。
>
> ⚠️ `electron-store` 固定为 **8.0.1**（最后一个 CommonJS 版本），不要升级到 8.1.0+（会引入 ESM 兼容问题）。骨架里它在主进程用 `require('electron-store')` 方式加载。

---

## 三、环境要求

| 项 | 要求 | 说明 |
|----|------|------|
| Node.js | **≥ 16**（推荐 16.x） | 老版本 Node 会报语法错误 |
| 包管理器 | npm 或 yarn | 推荐 yarn（下载 Electron 更稳定） |
| 操作系统 | Windows 10 / 11 | — |
| 磁盘空间 | ≥ 5 GB | node_modules 较大 |

> ⚠️ **强烈建议不要直接使用 `cnpm` 安装依赖**，会有各种诡异的 bug。请通过配置镜像源的方式加速 npm/yarn（见 5.2 节）。

---

## 四、目录结构说明

```
electron-vue-skeleton-win/
├── package.json              # 项目核心配置（脚本 + 打包配置 + 依赖）
├── config/
│   └── index.js              # 项目级配置（端口、热更新配置名、JSX 开关等）
├── env/
│   ├── .env                  # 开发环境变量（dev 时加载）
│   ├── production.env        # 生产环境变量（build:prod 时加载）
│   └── test.env              # 测试环境变量（build:test 时加载）
├── .env.development          # 前端开发环境变量（页面标题、API 前缀等）
├── installer.nsh             # NSIS 自定义脚本：注册 myapp:// 协议唤起
├── src/
│   ├── index.ejs             # HTML 模板（webpack 打包时以此为模板生成 index.html）
│   ├── main/                 # Electron 主进程（Node 环境）
│   │   ├── index.js          # 主进程入口：单实例锁 / 深链解析 / 创建窗口 / 禁 F12
│   │   ├── config/
│   │   │   ├── const.js          # 常量（UseStartupChart/IsUseSysTitle/端口/热更配置名等）
│   │   │   ├── StaticPath.js     # 静态资源路径与窗口加载地址（含热更优先加载逻辑）
│   │   │   ├── hotPublish.js     # 热更新发布配置（configName）
│   │   │   ├── menu.js           # 顶部菜单 + 托盘菜单 + 关于对话框
│   │   │   ├── DisableButton.js  # 生产环境禁用 F12（globalShortcut）
│   │   │   └── logger.js         # electron-log 日志配置（app.log/error.log）
│   │   ├── services/         # 核心服务
│   │   │   ├── windowManager.js  # 窗口管理（主窗口/启动屏/子窗口 + 分片读取 IPC）
│   │   │   ├── preload.js        # 预加载脚本（contextIsolation:false 方案，仅做兼容标记）
│   │   │   ├── ipcMain.js        # IPC 事件集中注册中心（主进程侧）
│   │   │   ├── checkupdate.js    # 全量更新检查（electron-updater）
│   │   │   ├── HotUpdater.js     # 增量热更新（检查→下载→校验→解压→覆盖 完整实现）
│   │   │   ├── download.js       # 全量文件下载（同名重命名 + 进度/完成事件）
│   │   │   └── downloadFile.js   # 简单文件下载（默认保存到下载目录）
│   │   └── utils/
│   │       └── installVersion.js # 安装包版本获取（四层优先级 + 国产化路径策略）
│   └── renderer/             # 渲染进程（Vue 界面，前端主要工作区）
│       ├── main.js           # Vue 入口（挂载 $ipcRenderer 到 Vue.prototype）
│       ├── App.vue           # 根组件
│       ├── router/index.js   # 路由（/、/iframe、/updateTip）
│       ├── store/index.js    # Vuex（业务模块放 store/modules 下）
│       ├── views/
│       │   ├── Home.vue          # 示例页（七大机制完整 Demo）
│       │   ├── iframe/index.vue  # iframe 内嵌视图
│       │   └── updateTip/index.vue # 更新提示弹窗（全量+热更新状态展示）
│       ├── components/
│       │   └── iFrame/index.vue  # iframe 内嵌组件（高度自适应 + loading）
│       ├── assets/styles/    # 全局样式
│       ├── utils/
│       │   ├── request.js        # axios 封装（拦截器已预留）
│       │   └── ipc/              # IPC 工具集（主进程与渲染进程共用）
│       │       ├── index.js          # re-export 统一出口
│       │       ├── ipcFun.js         # 右键菜单/兄弟窗口传值/electron-store 增删改查
│       │       ├── eventListener.js  # 主进程侧事件监听（右键菜单/窗口生命周期）
│       │       ├── systemDetect.js   # 国产化系统与 CPU 检测（主+渲染共用）
│       │       ├── systemInfo.js     # 渲染进程侧系统信息封装
│       │       └── version.js        # 渲染进程侧版本获取封装
├── .electron-vue/            # 构建系统核心（一般不需要改动）
│   ├── dev-runner.js         # 开发启动脚本（npm run dev 入口）
│   ├── build.js              # 生产构建脚本（npm run build 入口）
│   ├── hot-updater.js        # 热更新资源打包（npm run pack:resources）
│   ├── webpack.main.config.js    # 主进程 webpack 配置
│   ├── webpack.renderer.config.js# 渲染进程 webpack 配置
│   └── utils.js              # env 文件加载 / css loader 拼装
├── server/
│   └── index.js              # 本地更新模拟服务器（npm run update:serve，端口 25565）
├── static/                   # 静态资源（打包时作为 extraResources 原样拷贝）
│   └── loader.html           # 加载中页面（splash 启动屏）
├── lib/                      # 放置需要直接以 file 协议加载的 HTML
├── build/                    # 打包产物输出目录（.gitignore 已忽略产物）
│   └── icons/icon.png        # 应用图标（512x512 占位图，请替换为正式图标）
└── dist/                     # 编译产物（npm run build/dev 时自动生成）
```

**两个关键概念（新手必读）：**

- **主进程（Main Process）**：运行在 Node.js 环境，负责创建窗口、读写文件、系统交互、更新等「底层」能力，对应 `src/main/`。
- **渲染进程（Renderer Process）**：就是 Vue 写的界面，跑在浏览器内核里，对应 `src/renderer/`。

两者之间通过 **IPC（进程间通信）** 交互。本骨架采用 `contextIsolation:false + nodeIntegration:true` 方案（详见第七节机制①），渲染进程直接 `require('electron')` 拿到 `ipcRenderer`，并在 `main.js` 里挂到 `Vue.prototype.$ipcRenderer` 上，组件里用 `this.$ipcRenderer.invoke(...)` / `this.$ipcRenderer.send(...)` / `this.$ipcRenderer.sendSync(...)` 调用。

---

## 五、环境搭建（Windows）

### 5.1 安装 Node.js

1. 到 [Node.js 官网](https://nodejs.org/) 下载 LTS 版本（≥16）的 Windows 安装包（`.msi`）。
2. 双击安装，一路默认下一步即可。
3. 验证安装：

```bash
node -v   # 应输出 v16.x.x 或更高
npm -v
```

### 5.2 配置 npm 镜像源（加速下载）

Electron 及其打包依赖需要从国外下载，国内环境务必配置镜像，否则会非常慢或直接失败。

方式一：命令行直接设置

```bash
npm config set registry https://registry.npmmirror.com
```

方式二：编辑 npm 配置文件

```bash
npm config edit
```

在打开的配置文件中添加以下内容（若已有 registry 则替换）：

```
registry=https://registry.npmmirror.com
electron_mirror=https://cdn.npmmirror.com/binaries/electron/
electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/
```

> 这三行分别加速「npm 包」「Electron 二进制」「electron-builder 打包依赖」的下载。

### 5.3 安装依赖

```bash
# 方式一：npm（已配置镜像）
npm install

# 方式二：yarn
yarn install
```

> ⚠️ 不要用 `cnpm install`，会产生 `node_modules` 软链接错乱等诡异问题。
>
> 内网/离线环境：直接从有网机器拷贝整个 `node_modules` 到项目根目录解压使用即可。
>
> `npm install` 结束后会自动执行 `postinstall`（`electron-builder install-app-deps`），用于重建原生模块，看到它执行是正常现象。

---

## 六、开发与启动

```bash
npm run dev
# 或
yarn dev
```

启动后，dev-server 默认监听 **9080 端口**（端口被占用时会自动向后顺延，如 9081、9082），同时自动拉起 Electron 窗口。

- 开发模式下支持**热重载**：修改 Vue 代码后界面自动刷新。
- 修改主进程代码（`src/main/`）后 dev-runner 会**自动重启 Electron**。
- 可通过 `config/index.js` 中的 `dev.port` 修改默认端口。
- `config/index.js` 中的 `dev.removeElectronJunk: true` 表示屏蔽 Electron 的无用控制台输出；`dev.chineseLog` 控制日志是否使用中文。

启动成功你会看到示例页 **Home.vue**，它逐项演示七大机制（详见第七节）：

1. ① 主进程↔渲染进程信息交互（IPC）—— 获取版本 / 系统信息
2. ② 窗口控制 —— 最小化 / 最大化 / 隐藏 / 刷新
3. ③ 全量更新 —— 检查 / 下载 / 安装
4. ④ 热更新 —— 检查 / 下载 / 重启生效
5. ⑤ 深链唤起 —— 接收 `myapp://` 参数
6. ⑥ iframe 内嵌 —— 跳转 /iframe 视图
7. ⑦ 本地持久化 —— electron-store 增删改查

---

## 七、七大机制完整链路代码地图（重点章节）

> 这是本骨架最核心的一章。骨架从真实项目剥离了**七大机制的完整链路代码**，每个机制都能在 Demo 页（`Home.vue`）点按验证。下面用「机制说明 + 完整链路代码文件 + 关键代码」三部分，带你把每一条链路从头到尾走一遍。
>
> **学习方法**：先看「链路」知道有哪些文件、谁调用谁，再对照「关键代码」打开对应文件阅读注释。所有文件都有中文注释，专为新手准备。

### 机制①：主进程 ↔ 渲染进程信息交互（IPC）

**是什么**：Electron 应用分主进程（Node 环境）和渲染进程（Vue 页面），两者之间靠 IPC 通信。渲染进程想「拿版本号、控制系统、触发更新」，都得通过 IPC 请主进程代办。

**沙箱方案（本骨架采用）**：`contextIsolation: false + nodeIntegration: true`。即关闭上下文隔离、开启 Node 集成，让渲染进程可以直接 `require('electron')` 拿到 `ipcRenderer`，无需 contextBridge 白名单桥接。

**完整链路**：

```
渲染进程组件 (Home.vue)
   └─ this.$ipcRenderer.invoke('xxx') / send('xxx') / sendSync('xxx')
        │  ← 挂载点：src/renderer/main.js 的 Vue.prototype.$ipcRenderer = ipcRenderer
        ▼
主进程 ipcMain.js 的 Mainfunc() 里注册的对应 handler
   └─ ipcMain.handle('xxx')  / ipcMain.on('xxx')
        │
        ▼
处理完成 → 通过 event.returnValue（同步）/ return（异步）/ webContents.send（推送）
        │
        ▼
渲染进程 this.$ipcRenderer.on('xxx') 接收
```

**涉及文件**：

| 文件 | 角色 |
|------|------|
| `src/renderer/main.js` | 把 `ipcRenderer` 挂到 `Vue.prototype.$ipcRenderer` |
| `src/main/services/ipcMain.js` | 主进程侧所有 IPC 通道的注册中心（`Mainfunc()`） |
| `src/main/services/windowManager.js` | 额外注册 `file:select` / `file:readChunk`（断点续传分片读取） |
| `src/renderer/utils/ipc/ipcFun.js` | 主进程侧右键菜单/兄弟窗口传值/electron-store 的 IPC |
| `src/renderer/utils/ipc/index.js` | re-export 统一出口，被 windowManager.js 引用 |
| `src/renderer/views/Home.vue` | 渲染进程侧调用示例 |

**三种通信模式**：

| 模式 | 渲染进程 | 主进程 | 适用场景 |
|------|---------|--------|---------|
| 请求/响应 | `invoke(channel, data)` → Promise | `ipcMain.handle(channel, fn)` | 取数据（版本号、系统信息） |
| 单向发送 | `send(channel, data)` | `ipcMain.on(channel, fn)` | 触发动作（写 store、窗口控制） |
| 同步取值 | `sendSync(channel, data)` | `ipcMain.on(channel, (e)=>{e.returnValue=...})` | 同步拿返回值（版本号、store 读） |
| 主进程推送 | `on(channel, cb)` 注册监听 | `win.webContents.send(channel, data)` | 进度上报、深链参数下发 |

> ⚠️ 安全提示：`contextIsolation:false + nodeIntegration:true` 开发最省事，但安全边界弱，**只适合加载可信内容**（内部工具、企业应用）。若你的应用要加载不可信外部网页，请切换到 `contextIsolation:true + contextBridge` 白名单方案（`preload.js` 头部有完整对比说明）。

**常用通道速查**（完整列表见 `ipcMain.js`）：

| 通道 | 模式 | 作用 |
|------|------|------|
| `get-version` | sendSync | 获取版本号（同步） |
| `get-system-info` | invoke | 获取系统信息（异步，含国产化检测） |
| `get-system-summary` | sendSync | 获取系统信息摘要 |
| `get-install-version` | invoke | 获取安装包版本详情 |
| `get-app-path` | invoke | 获取应用路径 |
| `windows-mini` / `window-max` / `window-hide` / `window-refresh` | invoke | 窗口控制 |
| `window-close` | invoke | 关闭窗口（白名单 `/iframe` 直接 close，其余 hide） |
| `check-update` / `start-update` / `confirm-update` | invoke | 全量更新三步 |
| `hot-update` / `start-hot-update` / `confirm-hot-update` | invoke | 热更新三步 |
| `files-download` / `start-download` | invoke | 全量/简单文件下载 |
| `open-messagebox` / `open-errorbox` / `open-directory` | invoke | 对话框 |
| `open-win` | invoke | 打开子窗口 |
| `get-log-path` / `open-log-folder` / `get-log-files` | invoke | 日志 |
| `file:select` / `file:readChunk` | invoke | 断点续传分片读取（windowManager.js 注册） |
| `setStore` / `getStore` / `deleteOne` / `deleteAll` / `getAllStore` | send/sendSync | electron-store 持久化（ipcFun.js 注册） |

### 机制②：窗口控制

**是什么**：无边框窗口（`IsUseSysTitle:false`）下，最小化/最大化/关闭/隐藏/刷新这些操作都通过 IPC 交给主进程执行。

**完整链路**：

```
Home.vue 按钮点击 → this.$ipcRenderer.invoke('windows-mini')
   → ipcMain.js: ipcMain.handle('windows-mini', e => BrowserWindow.fromWebContents(e.sender)?.minimize())
```

**涉及文件**：`src/renderer/views/Home.vue`（触发）→ `src/main/services/ipcMain.js`（处理，第 51-84 行）。

**关键代码**（ipcMain.js 摘录）：

```js
ipcMain.handle('windows-mini', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize()
})
ipcMain.handle('window-close', (event) => {
  const currentWindowURL = event.sender.getURL()
  const pathname = currentWindowURL.split('?')[0].split('#')[1]
  if (!whiteList.includes(pathname)) {   // whiteList = ['/iframe']
    BrowserWindow.fromWebContents(event.sender)?.hide()
    event.preventDefault()
  } else {
    BrowserWindow.fromWebContents(event.sender)?.hide()
    BrowserWindow.fromWebContents(event.sender)?.close()
  }
})
```

> 注意 `window-close` 的白名单逻辑：`/iframe` 路由的窗口关闭时真正 `close`，其余窗口只 `hide`（隐藏不销毁），这是为「关闭主窗口实际是隐藏到托盘」这类体验服务的。

### 机制③：全量更新（electron-updater）

**是什么**：下载完整安装包替换整个应用，适合大版本发布。基于 `electron-updater` 的 `autoUpdater`，带 6 状态机（-1/0/1/2/3/4）。

**完整链路**：

```
Home.vue 点击「检查全量更新」
   → this.$ipcRenderer.invoke('check-update')
   → ipcMain.js: allUpdater.checkUpdate(win)
   → checkupdate.js: autoUpdater.setFeedURL(nowIpUrl) + checkForUpdates()
        ├─ 'checking-for-update'   → Message(win, 0)   state=0 检查中
        ├─ 'update-available'      → Message(win, 1)   state=1 有更新
        ├─ 'update-not-available'  → Message(win, 2)   state=2 无更新
        ├─ 'download-progress'     → Message(win, 3)   state=3 下载中
        ├─ 'update-downloaded'     → Message(win, 4)   state=4 完成
        └─ 'error'                 → Message(win, -1)  state=-1 出错
   → webContents.send('update-msg', {state, msg})
   → Home.vue 监听 'update-msg'，按 state 更新 UI
下载：Home.vue invoke('start-update') → checkupdate.js handleDownload() → downloadUpdate()
安装：Home.vue invoke('confirm-update') → checkupdate.js quitInstall() → quitAndInstall()
```

**涉及文件**：`src/renderer/views/Home.vue`（触发+监听）→ `src/main/services/ipcMain.js`（转发）→ `src/main/services/checkupdate.js`（Update 类，核心实现）。

**关键代码**（checkupdate.js 状态机摘录）：

```js
autoUpdater.on('update-available', (arg) => {
  this.Message(this.mainWindow, 1, arg)   // 有更新
})
// ...
Message(mainWindow, type, data) {
  const senddata = { state: type, msg: data || '' }
  mainWindow.webContents.send('update-msg', senddata)
}
```

> 更新服务器地址通过 `electron-store` 的 `nowIpStr` 动态切换（`checkUpdate` 内读取），默认 `http://127.0.0.1:8888/packageUpload`。生产环境才生效。

### 机制④：增量热更新（HotUpdater）

**是什么**：只更新前端的 `dist` 资源（不重装应用），省流量、快，适合高频小改动。自研实现，链路完整：**版本比对 → 流式下载 → sha256 校验 → 解压 → 覆盖 → 重启**。

**完整链路**：

```
Home.vue 点击「检查热更新」→ invoke('hot-update')
   → ipcMain.js: updater(win)
   → HotUpdater.js:
        1. 读取 electron-store 的 nowIpStr 拼服务器地址
        2. 请求 <configName>.json 描述文件（带时间戳防缓存）
        3. semver gt(服务器版本, 本地版本) 判断是否需更新
        4. 需更新 → 推送 'hot-update-status' status=update-available
           + 注册 ipcMain.handle('start-hot-update') 下载逻辑
Home.vue 点击「下载热更新包」→ invoke('start-hot-update')
   → emptyDir(updatePath) → 流式下载 zip
   → createHmac('sha256','Sky') 校验 hash
   → extract-zip 解压 → remove 旧 dist/package.json → copy 覆盖
   → 推送 status: downloading → moving → finished
Home.vue 点击「重启生效」→ invoke('confirm-hot-update')
   → ipcMain.js: app.relaunch() + app.exit(0)
```

**涉及文件**：`src/renderer/views/Home.vue` → `src/main/services/ipcMain.js` → `src/main/services/HotUpdater.js` → `src/main/config/hotPublish.js`（`configName`）→ `src/main/config/StaticPath.js`（`resolveProdURL` 热更优先加载）。

**关键代码**（HotUpdater.js 摘录）：

```js
// 版本比较：服务器版本 > 本地版本才更新
if (gt(res.data.version, version)) {
  updateInfo.status = 'update-available'
  // ...
  ipcMain.handle('start-hot-update', async () => {
    await emptyDir(updatePath)
    const filePath = join(updatePath, res.data.name)
    updateInfo.status = 'downloading'
    await download(`${nowIpUrl}/${res.data.name}`, filePath)
    // sha256 完整性校验（key='Sky'）
    const buffer = await readFile(filePath)
    const sha256 = hash(buffer)
    if (sha256 !== res.data.hash) throw new Error('sha256 error')
    // 解压 + 覆盖
    await extract(filePath, { dir: join(updatePath, 'temp') })
    await remove(join(appPath, 'dist'))
    await copy(join(updatePath, 'temp'), appPath)
    updateInfo.status = 'finished'
  })
}
```

**热更新生效原理**（StaticPath.js 的 `resolveProdURL`）：

```js
function resolveProdURL() {
  const hotEntry = path.join(app.getPath('userData'), 'hot-update', 'index.html')
  if (fs.existsSync(hotEntry)) return `file://${hotEntry}`  // 热更优先
  return `file://${__dirname}/index.html`
}
```

> 状态机：`init → update-available → downloading → moving → finished / failed`。服务器目录约定：`<publishUrl>/<configName>.json`（版本描述）+ `<publishUrl>/<name>`（zip 包）。

### 机制⑤：深链唤起应用（myapp:// 短链）

**是什么**：浏览器/命令行输入 `myapp://openapp?token=abc123`，操作系统唤起应用并把参数传进去。常用于邮件一键唤起、扫码登录回跳、外部分享落地页。

**完整链路**：

```
用户点击 myapp://openapp?token=abc123
   ├─ 应用未运行（冷启动）→ 进程启动，URL 在 process.argv
   │     → index.js 底部遍历 argv 找到 myapp:// 开头参数 → handleDeepLink()
   └─ 应用已运行（热启动）→ 单实例锁触发 'second-instance' 事件
         → index.js 从 commandLine 找深链 → handleDeepLink()
   ↓
handleDeepLink(url):
   1. Windows 下先 decodeURIComponent 解码
   2. new URL() 解析 protocol='myapp:' hostname='openapp'
   3. 把 ?a=1&b=2 解析成 params 对象
   4. 窗口已加载 → webContents.send('deep-link-params', params)
      窗口未加载 → 等 did-finish-load 再发
   5. Windows 下额外 setAlwaysOnTop 置顶确保窗口弹到最前
   ↓
Home.vue 监听 'deep-link-params' → 展示收到的参数
```

**涉及文件**：`src/main/index.js`（`handleDeepLink` + 单实例锁 + 协议注册，全链路核心）→ `src/renderer/views/Home.vue`（监听 `deep-link-params`）→ `installer.nsh`（Windows 安装时写注册表 `HKCR\myapp`）。

**关键代码**（index.js 摘录）：

```js
const PROTOCOL = 'myapp'

function handleDeepLink (url) {
  let decodedUrl = url
  if (process.platform === 'win32') {
    decodedUrl = decodeURIComponent(url)   // Windows 命令行传参需解码
  }
  const urlObj = new URL(decodedUrl)
  if (urlObj.protocol === 'myapp:' && urlObj.hostname === 'openapp') {
    const params = {}
    urlObj.searchParams.forEach((value, key) => { params[key] = value })
    deepLinkParams = params
    // ...聚焦窗口 + webContents.send('deep-link-params', params)
    return true
  }
  return false
}

// 单实例锁
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine) => {
    const deepLinkArg = commandLine.find(arg => arg.startsWith('myapp://'))
    if (deepLinkArg) handleDeepLink(deepLinkArg)
    // ...聚焦主窗口
  })
}

// 协议注册（开发环境 + 生产环境双路径）
if (process.defaultApp) {
  app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])])
} else {
  app.setAsDefaultProtocolClient(PROTOCOL)
}
```

> 注意：`second-instance` 依赖**单实例锁**（`requestSingleInstanceLock`），删掉它，深链热启动就会变成「又开了一个应用」。

### 机制⑥：iframe 内嵌网页

**是什么**：在应用内用 iframe 嵌入第三方网页（在线文档、外部系统等）。本骨架通过 `webviewTag:true` + 独立 `/iframe` 路由实现，并支持 postMessage 兄弟窗口传值。

**完整链路**：

```
Home.vue 输入地址 → 点击「跳转到 iframe 视图」
   → this.$router.push({ path: '/iframe', query: { src: url } })
   → 路由 views/iframe/index.vue 的 created 读 this.$route.query.src
   → 渲染 components/iFrame/index.vue 的 <iframe :src="src">
        （依赖 windowManager.js 里 webPreferences.webviewTag:true）
   → iframe 子页面 postMessage → views/iframe/index.vue 的 handleMessage
        → this.$ipcRenderer.send('siblingConnect', data) 兄弟窗口传值
        → 若 data.type === 'finishTask' → invoke('window-close') 关闭
```

**涉及文件**：`src/renderer/views/Home.vue`（入口）→ `src/renderer/router/index.js`（`/iframe` 路由）→ `src/renderer/views/iframe/index.vue`（视图 + postMessage 处理）→ `src/renderer/components/iFrame/index.vue`（iframe 组件 + 高度自适应）→ `src/main/services/windowManager.js`（`webviewTag:true` 开关）→ `src/main/services/ipcMain.js`（`window-close` 白名单）→ `src/renderer/utils/ipc/ipcFun.js`（`siblingConnect` 兄弟窗口传值）。

**关键代码**（windowManager.js 的 webPreferences）：

```js
webPreferences: {
  contextIsolation: false,
  nodeIntegration: true,
  webSecurity: false,
  webviewTag: true,   // 允许 <webview>/iframe 内嵌
  preload: join(__dirname, 'preload.js'),
  devTools: process.env.NODE_ENV === 'development' || openDevTools,
  scrollBounce: process.platform === 'darwin'
}
```

**兄弟窗口传值**（ipcFun.js 的 `refreshPage`）：

```js
ipcMain.on('siblingConnect', (e, arg) => {
  if (!mainWindow.isDestroyed()) {
    mainWindow.webContents.send('siblingConnect', arg)  // 转发给主窗口
  }
})
```

> 若目标站点有 `X-Frame-Options: DENY` / CSP 防嵌入头，iframe 会被浏览器拒绝渲染。这类第三方站点建议用系统浏览器打开，或自行在主进程用 `session.webRequest.onHeadersReceived` 剥离响应头（骨架未内置，需按需加）。

### 机制⑦：本地持久化（electron-store）

**是什么**：类似 localStorage，但由主进程管理、重启不丢，适合存用户配置、token、服务器 IP 等。本骨架已内置 `electron-store@8.0.1`。

**完整链路**：

```
Home.vue 输入 key/value → 点击「写入」
   → this.$ipcRenderer.send('setStore', key, value)
   → ipcFun.js initStore() 里 ipcMain.on('setStore', (_,k,v)=>store.set(k,v))
读取：Home.vue sendSync('getStore', key)
   → ipcMain.on('getStore', (_,k)=>{ _.returnValue = store.get(k) })
```

**涉及文件**：`src/renderer/views/Home.vue`（触发）→ `src/renderer/utils/ipc/ipcFun.js`（`initStore` 注册通道）→ `src/renderer/utils/ipc/index.js`（`toInitStore`）→ `src/main/services/windowManager.js`（`toInitStore()` 调用）。

**关键代码**（ipcFun.js 摘录）：

```js
const Store = require('electron-store')
const store = new Store()

export function initStore() {
  ipcMain.on('setStore', (_, key, value) => { store.set(key, value) })
  ipcMain.on('getStore', (_, key) => {
    let value = store.get(key)
    _.returnValue = value || ''
  })
  ipcMain.on('getAllStore', (_, key) => { _.returnValue = store.store || {} })
  ipcMain.on('deleteOne', (_, key) => { store.delete(key) })
  ipcMain.on('deleteAll', (_) => { store.clear() })
}
```

> `initStore()` 在主进程 `windowManager.js` 的 `createMainWindow()` 里被 `toInitStore()` 调用一次，之后所有渲染进程都能用这 5 个通道读写本地数据。

### 补充机制：国产化系统检测 + 版本识别

这是 UOS 版骨架的重点，Windows 版同样内置（可检测当前系统，为后续多平台发布预留）。

**链路**：`src/renderer/utils/ipc/systemDetect.js`（检测核心，主+渲染共用）→ 主进程 `ipcMain.js` 的 `get-system-info` / `get-system-summary` 通道 → 渲染进程 `systemInfo.js` 封装 → `Home.vue` 展示。版本识别走 `src/main/utils/installVersion.js`（四层优先级：热更新元数据 → 安装目录 package.json → app.getVersion() → 0.0.0）。

---

## 八、打包发布（Windows）

### 8.1 打包命令

```bash
npm run build
```

该命令执行两步（见 `package.json` 的 `build` 脚本）：

1. `node .electron-vue/build.js` —— 用 webpack 编译主进程 + 渲染进程代码到 `dist/electron/`
2. `electron-builder` —— 生成 Windows 安装包

打包产物输出到 **`build/`** 目录，默认生成：

- `myapp Setup x.x.x.exe` —— NSIS 安装包
- `latest.yml` —— 更新描述文件（自动更新用）
- `*.blockmap` —— 差分更新描述文件

### 8.2 不同架构/环境的打包命令

| 命令 | 说明 |
|------|------|
| `npm run build` / `build:prod` | 生产环境包（加载 `env/production.env`） |
| `npm run build:test` | 测试环境包（加载 `env/test.env`） |
| `npm run build:win32` | 打包 32 位 Windows（ia32） |
| `npm run build:win64` | 打包 64 位 Windows（x64） |
| `npm run build:dir` | 只生成未打包目录（不生成安装包，调试用） |
| `npm run build:clean` | 只清理编译产物，不打包 |

### 8.3 Windows 打包配置说明（package.json → build）

```jsonc
"win": {
  "icon": "build/icons/icon.ico",   // 应用图标（.ico 格式，可用 npm run build-icon 生成）
  "target": "nsis"                   // 安装包格式：NSIS
},
"nsis": {
  "oneClick": false,                          // 是否一键安装（false = 向导式安装）
  "allowToChangeInstallationDirectory": true, // 允许用户修改安装目录
  "include": "installer.nsh"                  // 自定义 NSIS 脚本（注册 myapp:// 协议）
}
```

更多 NSIS 常用可选配置（按需添加）：

```jsonc
"nsis": {
  "allowElevation": true,            // 允许请求管理员权限
  "installerIcon": "build/icons/icon.ico",
  "uninstallerIcon": "build/icons/icon.ico",
  "createDesktopShortcut": true,     // 创建桌面快捷方式
  "createStartMenuShortcut": true,   // 创建开始菜单快捷方式
  "deleteAppDataOnUninstall": true,  // 卸载时删除 AppData 数据
  "runAfterFinish": true             // 安装完成后自动运行
}
```

### 8.4 自定义协议唤起（myapp://）

`installer.nsh` 在安装时向注册表写入 `myapp://` URL 协议，卸载时删除。网页中执行 `location.href = 'myapp://xxx'` 即可唤起应用并携带参数。

> 修改协议名：把 `installer.nsh` 中所有 `myapp` 替换为你的协议名，同时改 `src/main/index.js` 顶部的 `PROTOCOL` 常量和 `handleDeepLink` 里的判断。

---

## 九、更新机制：全量更新与增量更新

骨架内置两种更新方式（详见第七节机制③④的完整链路）。

### 9.1 全量更新（electron-updater）

适用场景：改动较大，需要重新发布完整安装包。

步骤：

1. 修改 `package.json` 的 `version`，然后打包：

```bash
npm run build
```

2. 进入 `build/` 目录，把 **`.exe` 安装包** 和 **`latest.yml`**（及 `.blockmap`）一起压缩成 **zip**（注意：文件要直接在 zip 根目录，不能套子文件夹），上传到更新服务器。
3. 更新服务器地址在 `package.json` 的 `build.publish[0].url` 配置（骨架默认为占位地址，请改为你的实际地址；也可通过 electron-store 的 `nowIpStr` 动态切换，见 checkupdate.js）。
4. 客户端启动时自动检查（`src/main/services/checkupdate.js`，仅生产环境生效），并向渲染进程推送 `update-msg` 事件（state：-1 出错 / 0 检查中 / 1 有更新 / 2 无更新 / 3 下载中 / 4 完成）。

渲染进程监听示例（完整见 Home.vue）：

```js
this.$ipcRenderer.on('update-msg', (e, info) => {
  switch (info.state) {
    case 1: console.log('发现新版本', info.msg?.version); break
    case 3: console.log('下载中', info.msg?.percent); break
    case 4: console.log('下载完成，可安装'); break
  }
})
```

### 9.2 增量热更新（HotUpdater）

适用场景：只改了界面/静态资源，希望用户只下载变化的部分（省流量、快）。

步骤：

1. 打包 + 生成增量资源：

```bash
npm run build
npm run pack:resources
```

`pack:resources` 执行 `.electron-vue/hot-updater.js`，把变更资源打包到 `build/update/`。

2. 把 `build/update/` 里的内容（json 描述文件 + zip 包）上传到更新服务器。

> ⚠️ **重要**：后端拿到 zip 后解压上传，但 **zip 包本身不解压**。服务器目录约定见 `HotUpdater.js`：`<publishUrl>/<configName>.json`（版本描述，含 version/name/hash）+ `<publishUrl>/<name>`（zip 包）。

实现要点（对应代码可直接读 `src/main/services/HotUpdater.js`）：

- **版本比对**：`semver` 的 `gt(服务器版本, 本地版本)`；
- **下载**：`axios` 流式下载（`responseType: 'stream'` + `pipeline`）；
- **校验**：`createHmac('sha256', 'Sky')` 计算 hash，与描述文件 hash 比对；
- **解压覆盖**：`extract-zip` 解压 → `fs-extra` 移除旧 `dist`/`package.json` → `copy` 覆盖；
- **生效**：`StaticPath.js` 的 `resolveProdURL()` 启动时优先加载热更目录 `index.html`，重启后自动用新版本；
- **页面联动**：Demo 页 Home.vue 第④卡片演示「检查 → 下载 → 重启」全流程。

### 9.3 本地更新服务器（调试用）

```bash
npm run update:serve
```

启动一个本地静态服务器（`server/index.js`），监听 **25565 端口**，把 `server/client/` 目录作为更新包存放处。调试时把服务器地址临时改成 `http://127.0.0.1:25565` 即可在本地验证完整更新流程。

---

## 十、配置项说明

### 10.1 环境变量（env 文件夹）

骨架通过 `env/` 下的 `.env` 文件注入环境变量，内容由 webpack DefinePlugin 挂载到 **`process.env.userConfig`**（主进程和渲染进程同名，两边都能访问）。

| 文件 | 何时加载 | 用途 |
|------|----------|------|
| `env/.env` | `npm run dev` | 开发环境 |
| `env/production.env` | `npm run build` / `build:prod` | 生产环境 |
| `env/test.env` | `npm run build:test` | 测试环境 |
| `.env.development` | 前端开发辅助（页面标题等 `VUE_APP_*` 变量） | 开发环境 |

变量示例（骨架默认值均为占位地址，请改成你的实际地址）：

```
API_HOST = 'http://127.0.0.1:8081'    # 后端 API 地址
NODE_ENV = 'production'                # 环境标识
STREAM_URL = 'http://127.0.0.1:8081'   # SSE 流式地址
```

> 区分环境的机制：打包脚本通过 `cross-env TERGET_ENV=xxx` 指定环境，`.electron-vue/utils.js` 据此加载 `env/<环境>.env`。

### 10.2 config/index.js（项目级配置）

```js
module.exports = {
  build: {
    cleanConsole: false,                    // 生产环境是否清除 console
    hotPublishConfigName: 'update-config'  // 热更新配置名（与服务器目录对应）
  },
  dev: {
    removeElectronJunk: true,   // 屏蔽 Electron 无用输出
    chineseLog: false,          // dev-runner 日志是否中文
    port: 9080                  // 开发起始端口
  },
  DllFolder: '',
  UseJsx: true                  // 是否启用 JSX
}
```

### 10.3 主进程常量（src/main/config/const.js）

| 常量 | 默认值 | 说明 |
|------|--------|------|
| `UseStartupChart` | `true` | 是否启用启动屏（首屏优化开关） |
| `IsUseSysTitle` | `false` | 是否用系统标题栏（false=无边框自绘） |
| `BuiltInServerPort` | `25565` | 内置静态服务器端口 |
| `hotPublishConfigName` | `'update-config'` | 热更新描述文件前缀名 |
| `openDevTools` | `false` | 开发时是否默认开 DevTools |
| `DisableF12` | `false` | 是否禁用 F12（配合 DisableButton.js） |

### 10.4 package.json 关键 build 字段

| 字段 | 骨架默认值 | 说明 |
|------|-----------|------|
| `asar` | `false` | 不打进 asar 归档（方便热更新/调试） |
| `productName` | `myapp` | 应用名（安装目录/快捷方式名，请改） |
| `appId` | `com.example.myapp` | 应用唯一标识（请改） |
| `executableName` | `myapp` | 可执行文件名 |
| `directories.output` | `build` | 打包产物输出目录 |
| `extraResources` | `static/ → static/` | static 目录原样拷贝进安装包 |
| `publish[0].url` | 占位地址 | 更新服务器地址（必须改成你的） |

> **接手第一件事**：全局把 `myapp` / `com.example.myapp` 替换成你的产品名和 appId，替换 `build/icons/icon.png` 为你的图标（≥512x512），然后执行 `npm run build-icon` 生成 ico/icns。

---

## 十一、常见问题排查

### Q1：`npm install` 下载 Electron 失败 / 很慢

**原因**：Electron 二进制默认从 GitHub 下载，国内无法直连。

**解决**：配置镜像（见 5.2 节），确保包含 `electron_mirror` 和 `electron_builder_binaries_mirror`，然后删除 `node_modules` 重新安装。

### Q2：打包时提示缺少 winCodeSign / nsis 等依赖

**原因**：electron-builder 的打包二进制下载失败。

**解决**：确认已配置 `electron_builder_binaries_mirror`。若仍失败，从有网机器拷贝 `~/.cache/electron-builder`（Windows 为 `%LOCALAPPDATA%/electron-builder/Cache`）到本机对应位置。

### Q3：`npm run build` 报权限错误（EACCES）

**解决**：对项目目录提升权限后重试（管理员命令行）：

```bash
icacls "electron-vue-skeleton-win" /grant Everyone:F /T
```

### Q4：修改代码后界面不更新

- 确认 `npm run dev` 正在运行（开发模式才有热重载）。
- 主进程代码改动 dev-runner 会自动重启；若没生效，Ctrl+C 后重新 `npm run dev`。
- 打包后的应用需走热更新/全量更新流程才会变。

### Q5：页面提示 `require is not defined` / 拿不到 `$ipcRenderer`

说明页面没在 Electron 里跑（比如你直接用浏览器访问了 9080 端口），或 `contextIsolation` 被改成了 `true` 但没配套改桥接。请用自动拉起的 Electron 窗口查看，并确认 `windowManager.js` 里 `contextIsolation: false`、`nodeIntegration: true`。

### Q6：端口 9080 被占用

骨架内置端口检测（portfinder），9080 被占用会自动顺延（9081、9082…），一般无需处理。也可在 `config/index.js` 的 `dev.port` 手动指定。

### Q7：图标不生效 / 打包报图标缺失

确认 `build/icons/icon.png` 存在且 ≥512x512，执行 `npm run build-icon` 生成 `icon.ico`，再重新打包。

### Q8：主进程 require 的模块打包后找不到

主进程用到的第三方模块必须放在 `package.json` 的 **`dependencies`**（不是 devDependencies）——webpack 主进程配置把 dependencies 设为 externals，运行时从 node_modules 加载。骨架已内置的 dependencies：`adm-zip`、`axios`、`electron-log`、`electron-store`、`electron-updater`、`extract-zip`、`fs-extra`、`semver`。

### Q9：electron-store 报 ESM 相关错误

确认 `package.json` 里 `electron-store` 是精确版本 `8.0.1`（不是 `^8.1.0` 等）。8.1.0 起是 ESM 包，`require()` 会报错。

---

## 十二、附录

### 12.1 项目脚本速查表

| 命令 | 作用 |
|------|------|
| `npm run dev` | 启动开发环境（热重载） |
| `npm run build` / `build:prod` | 生产环境打包 |
| `npm run build:test` | 测试环境打包 |
| `npm run build:win32` | 打包 Windows 32 位 |
| `npm run build:win64` | 打包 Windows 64 位 |
| `npm run build:dir` | 只打包目录（不生成安装包，调试） |
| `npm run build:clean` | 清理编译产物 |
| `npm run pack:resources` | 打包热更新增量资源 |
| `npm run update:serve` | 启动本地更新模拟服务器（25565 端口） |
| `npm run build-icon` | 由 icon.png 生成各平台图标 |

### 12.2 原生模块（如 iohook）注意事项

若引入 C++ 原生模块（如 `iohook` 全局键鼠监听），需要注意：

- 原生模块针对特定 Electron 版本和平台编译，**切换 Electron 版本后必须 rebuild**：

```bash
npm install -D electron-rebuild
npx electron-rebuild
```

- 骨架的 `postinstall`（`electron-builder install-app-deps`）已会在安装依赖后自动重建一次。
- 相关模块记得放 `dependencies`（见 Q8）。

---

*本骨架配套统信 UOS / deepin（ARM64）版本见同目录下 `electron-vue-skeleton-uos`，其 README 包含 UOS 离线环境搭建、国产化系统检测与 deb 打包的完整流程。*
