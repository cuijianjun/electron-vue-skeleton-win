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

`src/shared/ipc.mjs` 是统一通信入口：集中操作白名单、参数约束、原生 `desktop:request` / `desktop:event` 和三进程适配工厂。main/preload 的其他文件不直接收发原生消息。请求使用 invoke/handle；事件发给所属窗口，广播配置时仍验证目标页面。

Vue 挂载前 `await desktop.ready()` 异步加载版本、系统摘要和配置快照。业务页面使用 `$desktop.window/settings/update/resources/files`，不再发送底层通道。配置变更带单调版本和本窗口写确认，跨窗口缓存同步；旧快照与逆序确认不会覆盖新值。深链与子窗口的早到数据最多排队32条，首次订阅消费，保留原生结构化克隆类型。

```js
import { desktop } from './utils/ipc/bridge'
const scope = desktop.scope()
const stop = scope.events.on('download-progress', percent => console.log(percent))
await desktop.settings.set('enabled', false)
const value = await desktop.settings.get('enabled')
// 组件卸载时 scope.dispose()；也可单独 stop()。
```

每个 scope 只拥有自己的订阅；清理不会影响其他组件。旧 `$ipcRenderer.invoke/send/sendSync/on` 仅作兼容；`sendSync` 现在只读初始化后的内存，无原生同步 IPC，启动前调用会明确报错。旧 send 返回 Promise，应 await 写入确认并处理失败。生产构建忽略开发服务器 URL。

## 两种更新

- 全量更新：Electron、main、preload、依赖或安装包变更。通过 APP_UPDATE_URL 配置 generic 元数据目录；未配置时不连接默认生产服务器。Windows 使用 NSIS；UOS 使用所选 updater 的 DEB/包管理器路径，授权及失败恢复仍须实机验收。
- 界面资源更新：只包含 renderer 文件。schemaVersion=1/2、Ed25519 签名、SHA256、平台/架构及完整运行时指纹必须匹配。相同/更旧版本不重复安装。暂存后需要主窗口 Vue 启动确认；失败在 12 秒后或下次启动回退。
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

## 更快的打包与更小的安装内容

```sh
npm run build:app              # 始终编译生产 main / preload / renderer
npm run build:dir              # 自动校验并复用编译产物，生成可运行目录
npm run pack:dir               # 仅打目录；缺失/过期/被修改的产物直接拒绝
npm run pack:release           # 仅生成安装包；同样强制校验
npm run build:compact          # 紧凑档：Windows级别9 / UOS XZ级别3，耗时更长
```

可追加 `-- --platform win32|linux --arch x64|arm64`；UOS 的 arm64 示例是 `npm run pack:release -- --arch arm64`。现有平台 build 命令会自动编译缺失/过期产物；`--rebuild` 强制重建。测试模式产物不能冒充生产包。`--output` 可指定隔离输出目录；固定 `--publish never`。

复用依据是源码、配置、依赖锁、Node/主机架构、构建模式、Vite四层根环境文件和 `RENDERER_VITE_*` 构建变量的摘要，以及全部生成文件的摘要。不会将变量原文写入元数据。修改后重新编译；没有额外缓存服务。electron-vite 会设置 NODE_ENV，因此不把终端的原始 NODE_ENV 当作输入。

Windows默认使用上游支持的 `ELECTRON_BUILDER_COMPRESSION_LEVEL=3`，紧凑档为9；显式设置该变量可覆盖默认值。NSIS差分打包会将载荷压缩改为normal，因此单设全局 `compression: store` 并不能选择快速的载荷压缩。两档都保留NSIS差分更新、安装器完整性检查和同样的应用内容。UOS继续使用原有XZ格式，默认级别2、紧凑档级别3，保持已有包管理器格式和安装钩子。

启用 ASAR、生产代码压缩，排除 source map 与类型声明；运行依赖仍外置供 Electron 加载，保留许可证。仅保留 `en-US / zh-CN / zh-TW` 的 Electron 原生语言资源，需要其他语言时修改 `build.electronLanguages`。ASAR 本身是归档格式，不是压缩算法。static 仅在 resources/static 保留一份，界面热更新仍写入 userData，不修改 app.asar。Windows 图标、NSIS 目录规则及 UOS 安装钩子保持有效。

本轮任务、实测和验收范围见 [specs/002-ipc-packaging/research.md](specs/002-ipc-packaging/research.md)。

## 全量与增量更新配置

源码 `config/updates.json` 会复制为安装目录的 `resources/updates.json`，主进程读取这份公开配置；安装后可直接修改，修改后重启应用生效，无需从终端设置环境变量。配置项：

| 字段 | 用途 |
|---|---|
| fullURL | 完整安装包更新目录，提供平台对应的 latest*.yml 和安装包 |
| resourceURL | 增量 renderer 的 manifest.json 地址 |
| publicKey | Ed25519 发布公钥 PEM 文本；私钥始终保存在客户端/仓库之外 |
| autoCheck | 进入更新页面时是否自动检查，只有已配置更新源才启动 |
| intervalHours | 更新页面保持打开期间的检查间隔，1至168小时，默认12 |

`APP_UPDATE_URL`、`RESOURCE_UPDATE_URL`、`RESOURCE_UPDATE_PUBLIC_KEY` 和 `RESOURCE_UPDATE_PUBLIC_KEY_FILE` 可显式覆盖。远程源使用HTTPS，本地夹具仅允许loopback HTTP；空源默认禁用。界面从主进程读取状态，重新打开页面仍能安装已下载包。两个通道互斥，就绪后也须先安装或取消才能使用另一通道。

全量发布流程：更新 package.json/锁文件中的应用版本，使用原平台构建命令生成新包。将 Windows EXE与blockmap，或对应架构DEB上传，再最后更新生成的latest.yml / latest-linux.yml / latest-linux-arm64.yml。每个平台/架构分别使用正确的源目录。Windows安装器走NSIS；Linux由DebUpdater选择DEB并调用包管理器/提权。失败或拒绝授权会回到可重试状态，不伪报安装完成。

增量发布时保留上一版完整renderer目录，修改界面后重新 `npm run build:app`，再运行：

```sh
npm run pack:resources -- --platform win32 --arch x64 --version 1.0.1 --signing-key /secure/publisher-private.pem --base-dir /archive/1.0.0/renderer --base-version 1.0.0
```

platform取win32或linux，arch取x64或arm64，与目标客户端一致。客户端应用版本、main、preload、依赖锁与Electron必须保持兼容；运行时变化走全量更新。`--base-dir` 必须是先前真实发布的renderer目录，`--base-version` 是其renderer版本；不能用修改后的目录冒充基线。

带base参数产生schema2：差异ZIP只含新增/修改文件，完整目标清单表达删除；先验证实际基线，再合成独立目录并校验全部目标文件。基线不匹配时只下载同一签名清单约束的完整renderer快照。未传base参数仍生成schema1完整renderer包，兼容既有客户端。旧客户端应先全量升级到支持schema2的应用，再切换差异清单。两个归档都采用内容寻址文件名，先上传ZIP，最后切换manifest.json，保留仍被客户端引用的历史归档。

检查→下载→校验暂存→确认重启→新进程Vue启动确认构成完整资源链路；首次启动失败或待更新文件损坏回退上个正常版本。下载支持取消，取消后的迟到响应不能激活；已就绪可稍后安装，重复检查不会丢失全量安装器。私钥不进入安装包。

本轮实现与验证范围见 [specs/003-update-channels](specs/003-update-channels/tasks.md)。UOS具体机器的安装、提权、升级体验仍以原001真机验收为准；本地HTTP夹具通过不表示生产更新源已经部署。
