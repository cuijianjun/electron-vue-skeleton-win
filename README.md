# Electron + Vue 3 + Vite（Windows）

在原骨架中升级，保留 IPC、窗口、全量更新、界面资源更新、深链、iframe 和本地存储示例。

技术基准是 [alex8088/quick-start 的 Vue JavaScript 模板](https://github.com/alex8088/quick-start/tree/c41f96894340180f52de185d4b4c1e9bd1f66fb8/packages/create-electron/template/vue)，已核对其 package、Vite 配置、main/preload 和 builder 源码。采用 electron-vite，不混用另一路 vite-plugin-electron。

| 组件 | 锁定版本 |
|---|---|
| 构建 Node / npm | 24.22.0 / 11.19.1 |
| Electron | 44.7.2 |
| electron-vite / Vite | 6.0.0 / 8.3.8 |
| Vue / compiler-sfc | 3.5.45 |
| Router / Vuex | 4.6.4 / 4.1.0 |
| electron-builder / updater | 26.18.0 / 6.8.11 |
| electron-store | 8.0.1 |

Router/Vuex 是现有项目的迁移保留项，上游模板没有自带。保留 JavaScript、Options API 和 CJS 主进程；固定操作的 sandbox preload、既有安装/更新流程属于本项目适配。构建 Node 与 Electron 内嵌 Node 分开管理。

## 安装与运行

使用 Node24.22.0（见 .nvmrc），再执行：

```sh
npm ci
npm run dev
```

postinstall 按上游执行 install-electron 和 electron-builder install-app-deps。第一次需要下载对应系统/架构的 Electron。

```sh
npm run build:app
npm run start
npm run build:test
```

build:app 编译生产应用；start 预览生产文件；build:test 使用 test 环境，仍以生产文件方式加载。

## 目录与构建边界

- src/main：窗口、存储、文件、系统、日志与更新能力。
- src/preload：单个 CJS preload，暴露有限函数，不暴露原生 Electron 事件。
- src/renderer：Vue 3 页面、Router 4 hash 路由、Vuex 4；不直接 require Node/Electron。
- src/shared：桥接操作清单与参数约束。
- electron.vite.config.mjs：main/preload/renderer 三段构建。
- dist/electron/{main,preload,renderer}：互不覆盖的输出。
- dist/electron/runtime-build.json：构建生成的 lock 摘要及运行时版本；安装包不依赖携带 package-lock.json。
- scripts：平台构建、renderer 资源签名打包、仅清理生成目录的命令。
- test：单元、真实 Electron、HMR 与打包后启动测试。
- specs/001-vue3-upgrade：规格、上游依据、计划、26 项任务及验收边界。
- _codex/sessions/vue3-upgrade.md：续接状态。

原 webpack/Babel 流程已替换。旧版本可由 Git 基线恢复查看；不需要并行维护两套构建。

## Windows 打包

默认目标 Windows10/11 x64，输出 NSIS 安装包：

```sh
npm run build:win64
```

安装器保留安装目录选择和 myapp:// 协议；NSIS 界面会补齐应用名子目录，受控 /D 测试目录也需保留 myapp；卸载不主动删除应用数据。旧 build:win32 入口会明确报错：所选 Electron44 已没有官方 ia32 二进制，不会静默改成 x64。

目标 Windows 上需要实际执行安装、协议唤起、升级与卸载验收。macOS 上的公共代码测试不算 Windows 验收。

所有构建固定 --publish never。release/ 包含安装包及必要的更新元数据，正式发布、生产源和签名配置由后续发布流程处理。

## 环境与 IPC

env/.env、env/test.env、env/production.env 分别映射 development/test/production。只有明确需要的 API_HOST 会映射到 renderer 的 RENDERER_VITE_API_HOST；其他公开参数使用 RENDERER_VITE_ 前缀。不要把整份 process.env 注入页面。config/index.js 保留开发端口与 DllFolder 配置。

主进程校验调用者必须是当前应用顶层页面；子窗口使用同样的隔离设置。iframe 消息同时检查 source 和 origin。文件分片只能读取该窗口选择过的文件；下载目录限制为 Downloads 或用户选择的目录，并检查真实路径/链接。

renderer 的桥接适配保留现有 invoke/send/sendSync/on 调用形态，实际经有限 preload 函数转发。订阅支持清理，重复注册同一回调不叠加。生产构建忽略开发服务器 URL。

## 两种更新

- 全量更新：Electron、main、preload、依赖或安装包变更。通过 APP_UPDATE_URL 配置 generic 元数据目录；未配置时不连接默认生产服务器。Windows 使用 NSIS；UOS 使用所选 updater 的 DEB/包管理器路径，授权及失败恢复仍须实机验收。
- 界面资源更新：只包含 renderer 文件。schemaVersion=1、Ed25519 签名、SHA256、平台/架构及完整运行时指纹必须匹配。相同/更旧版本不重复安装。暂存后需要主窗口 Vue 启动确认；失败在 12 秒后或下次启动回退。
- get-version 表示应用版本；get-resource-version 表示当前界面版本；get-install-version 同时提供 rendererVersion。
- 私钥保存在项目和客户端之外。客户端配置 RESOURCE_UPDATE_PUBLIC_KEY_FILE 与 RESOURCE_UPDATE_URL；默认没有信任配置时禁用资源更新。旧的全量资源 ZIP/清单会被拒绝，需要先发全量安装包。

先 build:app，再用外部 Ed25519 发布私钥生成资源包：

```sh
npm run pack:resources -- --platform win32 --arch x64 --version 1.0.1 --signing-key /secure/publisher-private.pem
npm run update:serve -- --dir release/resources/win32-x64 --port 25565
```

signing-key 是发布机上的实际路径。开发辅助服务只监听 127.0.0.1。客户端清单地址例如 http://127.0.0.1:25565/manifest.json；远程更新源使用 HTTPS。资源包目标必须与客户端一致，构建身份过期时打包命令会要求重新 build:app。

## 增量验证

```sh
npm run test:unit
npm run build:app
npm run test:e2e
npm run test:dev
```

test:e2e 使用隔离 userData 和本地签名/HTTP 夹具，覆盖路由、真实桥接、子窗口、iframe、文件、下载、存储和资源重启/回退。test:dev 临时修改并还原一处模板，检查 HMR 不重载 renderer；运行后打包前重新 build:app。

test:packaged 通过 SKELETON_PACKAGED_EXECUTABLE 指向实际打出的应用，检查没有源码 lockfile 也可启动及运行时身份。测试不会调用真实生产更新源。

Windows 上的显式安装回归使用受控的 1.0.0 / 1.0.1 NSIS 包；请在没有现有 myapp 安装、协议或同名快捷方式的测试账号/虚拟机中运行。测试先检查归属，再使用临时安装目录、userData 和 updater 缓存：

```powershell
$env:SKELETON_INSTALLER_A = 'C:\fixtures\myapp Setup 1.0.0.exe'
$env:SKELETON_INSTALLER_B = 'C:\fixtures\myapp Setup 1.0.1.exe'
npm run test:windows
```

该命令覆盖实际更新源错误、取消、下载、已注册协议、NSIS A→B 存储保留和卸载清理。测试也会通过 confirm-update 启动并推进真实安装向导；它不会随普通 test:e2e 自动运行。

保留原有 build/icons/icon.png。builder26 的 macOS 跨打包存在 [默认安装/卸载图标差异导致卸载 CRC 错误的上游缺陷](https://github.com/electron-userland/electron-builder/issues/10258)；当前原图标会同时用于安装器/卸载器，原生测试会校验卸载器 CRC。生成 B 验证包时也必须保留相同构建资源。

## 离线准备与验收

npm 的 --offline 只控制 npm 缓存，不会自动准备 Electron 和 builder 的二进制缓存。在匹配系统/CPU 的联网准备机上完成 npm ci、Electron 下载和对应目标构建，收集 npm/Electron/builder 缓存，随后在禁网环境验证 npm ci --offline、构建和启动。不要跨系统/CPU复制 node_modules。存在原生依赖时还要匹配 Electron ABI 与目标工具链。

UOS 环境采集可使用 cat /etc/os-release、uname -m、getconf GNU_LIBC_VERSION 和 XDG_SESSION_TYPE。目标机还需记录 Windows 版本与架构。

当前执行证据、外部缺项和任务状态见 [quickstart](specs/001-vue3-upgrade/quickstart.md) 与 [tasks](specs/001-vue3-upgrade/tasks.md)。

## 文件保留

源码、锁文件、.specify、.agents、specs 和续接状态应保留。node_modules、dist/electron、release 是可重建内容。build:clean 只清理 dist/electron，保留原 build/ 中的安装脚本与其他历史文件。
