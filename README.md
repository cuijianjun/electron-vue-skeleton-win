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

所有构建固定 `--publish never`，只生成文件，不自动上传 GitHub 或更新服务。实际发布使用本文后面的统一服务 CLI。

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

## 两种更新的选择

| 改动 | 发布方式 | 版本规则 |
|---|---|---|
| Electron、main、preload、依赖/锁文件或安装配置 | 全量安装包（Windows NSIS / UOS DEB） | 增加 package.json 的应用版本，并同步锁文件 |
| 只修改 renderer，运行时指纹保持不变 | Ed25519 签名的 renderer 差异 ZIP + 完整快照 | 仅增加资源版本，保持应用版本和依赖锁不变 |

Windows 全量安装包下载也可使用 NSIS blockmap 差分；它与 renderer 增量是两条独立链路。UOS 全量下载 DEB，renderer 增量支持 x64/ARM64。界面更新不包含主进程或 Electron，不能代替全量升级。

具体命令见下文“打包、发布与更新操作手册”；两种通道互斥，已下载就绪时先安装或取消，再操作另一通道。

## 增量验证

```sh
npm run test:unit
npm run build:app
npm run test:e2e
npm run test:dev
```

上面的 `test:e2e` 夹具固定以应用1.0.0及资源1.0.1/1.0.2/1.0.3验证，须在当前应用仍为1.0.0时运行；`test:packaged` 也断言应用1.0.0，不能作为任意新版本的直接验收命令。变更应用版本后，运行单元测试及服务端动态版本的 `test:clients`，并完成实际新旧安装包的目标平台验收；不为迎合夹具降回应用版本。test:e2e 使用隔离 userData 和本地签名/HTTP 夹具，覆盖路由、真实桥接、子窗口、iframe、文件、下载、存储和资源重启/回退。test:dev 临时修改并还原一处模板，检查 HMR 不重载 renderer；运行后打包前重新 build:app。

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

## 打包、发布与更新操作手册

### 1. 准备发布环境

本文 `sh` 命令用于当前 macOS/Linux 发布机，默认两个客户端与服务端同级；Windows 本机也可运行 npm 打包命令，变量和路径按 PowerShell 改写。构建固定 Node24.22.0 / npm11.19.1：

```sh
cd /path/to/yz/electron-vue-skeleton-win
nvm install
nvm use
node --version
npm --version
npm ci
```

全量安装器仍需目标系统验收。首次在同级服务端执行 `npm ci`；本机已有配置、密钥和常驻服务可直接复用，不重复初始化。新环境先按[服务端 README](https://github.com/cuijianjun/electron-update-server/blob/agent/update-server-main/README.md)恢复已有密钥，再初始化。当前本机服务入口为 `http://127.0.0.1:25565/healthz`。

发布前在专用 Bash/zsh 会话设置以下变量，在本项目根目录按顺序执行后续步骤；`set -e` 使失败时停止当前会话，避免检查失败仍继续发布。新开终端需重新设置：

```sh
set -e
PROJECT=electron-vue-skeleton-win
PLATFORM=win32
ARCH=x64
SERVER="$(cd ../electron-update-server && pwd)"
SERVER_CONFIG="$HOME/.config/electron-update-server/config.json"
SIGNING_KEY="$HOME/.config/electron-update-server/keys/$PROJECT-private.pem"
BASE_ROOT="$HOME/.local/share/electron-update-server/baselines/$PROJECT/$PLATFORM-$ARCH"
test -r "$SERVER_CONFIG" && test -r "$SIGNING_KEY"
```

此仓库仅发布 Windows x64；不把 arm64/ia32 当作已支持的 Windows 目标。

### 2. 上线前设置更新地址

`config/updates.json` 被复制为安装目录的 `resources/updates.json`。当前提交的是本机测试地址和本项目独立公钥。正式上线只修改地址，保留公钥：

```sh
UPDATE_ORIGIN=https://updates.example.com node - <<'NODE'
const fs = require('node:fs')
const file = 'config/updates.json'
const config = JSON.parse(fs.readFileSync(file, 'utf8'))
const origin = new URL(process.env.UPDATE_ORIGIN)
if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) throw new Error('Use an HTTPS origin without a path or credentials')
const prefix = origin.origin + '/v1/electron-vue-skeleton-win/win32/{arch}/latest/'
config.fullURL = prefix + 'full/'
config.resourceURL = prefix + 'resources/{runtimeId}/manifest.json'
fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n')
NODE
```

`updates.example.com` 是占位域名，等实际服务器地址和可信 TLS 证书就绪后替换。域名或 IP 的远程源都必须使用 HTTPS；资源请求不跟随重定向，填写最终 URL。`{arch}` / `{runtimeId}` 保留原样，由主进程展开。修改后重新构建安装包；`package.json.build.publish.url` 仅供 builder 生成元数据，实际检查源来自 `updates.json`，发布器会重写包的相对路径。

| 配置字段 | 含义 |
|---|---|
| fullURL | 平台/架构对应的全量元数据目录，结尾保留 `/` |
| resourceURL | 当前 runtimeId 的 manifest.json 完整模板 |
| publicKey | 当前项目 Ed25519 公钥 PEM；保留初始化所得内容 |
| autoCheck | 进入更新页面时自动检查；当前 true |
| intervalHours | 更新页面打开期间检查间隔，1–168 小时；当前 12 |

环境变量 `APP_UPDATE_URL`、`RESOURCE_UPDATE_URL`、`RESOURCE_UPDATE_PUBLIC_KEY` 覆盖文件；`RESOURCE_UPDATE_PUBLIC_KEY_FILE` 优先读取外部公钥文件。排查时先确认启动环境没有旧覆盖。空地址禁用相应通道。

已安装且仍指向 `127.0.0.1` 的测试客户端不会自动发现新服务器：首次切换需安装包含正式地址的新全量包，或在有权限时修改其 `resources/updates.json` 并重启。另一台机器上的 127.0.0.1 指向它自己。

### 3. 打全量包，并保存同版本 renderer 基线

以下以应用 `1.0.0 → 1.0.1` 为例；实际选择高于已发布应用版本的新版本。首次升级前，先在当前1.0.0源码执行上文固定版本E2E；通过后再更改版本。版本增加后的发布验收采用单元测试、服务端动态版本联调和目标机安装验证。只发 renderer 增量时跳到步骤 5，不执行 npm version。

```sh
npm version 1.0.1 --no-git-tag-version --ignore-scripts
npm run test:unit
npm run build:app
APP_VERSION=$(node -p "require('./package.json').version")
FULL_DIR="release/full/$PLATFORM-$ARCH/$APP_VERSION"
npm run build:win64 -- --output "$FULL_DIR"
```

输出为 NSIS 安装器。Windows 本机运行相同 npm 命令；跨打包后的安装、升级和卸载仍须在 Windows 验收。

仅上传 Windows x64 的 EXE、EXE.blockmap、latest.yml；不上传 unpacked 应用目录、debug 配置或私钥。Windows 保留新旧版本的 blockmap 才能进行安装包差分下载。常规快速档保持 ASAR 和差分能力；更小安装包可用 `npm run build:compact -- --platform "$PLATFORM" --arch "$ARCH" --output "$FULL_DIR"`，在首次发布前选择一个档位，已经发布的同版本不能用另一档覆盖。

为这个完整应用登记 renderer 初始版本（同版本客户端不会提示更新），同时保存下一次差异计算所需的完整目录：

```sh
RESOURCE_DIR="release/resources/$PLATFORM-$ARCH/$APP_VERSION"
npm run pack:resources -- --platform "$PLATFORM" --arch "$ARCH" --version "$APP_VERSION" --signing-key "$SIGNING_KEY" --out "$RESOURCE_DIR"
RUNTIME_ID=$(node -p "require('./$RESOURCE_DIR/manifest.json').runtimeId")
BASE_DIR="$BASE_ROOT/$RUNTIME_ID/$APP_VERSION/renderer"
test ! -e "$BASE_DIR" && mkdir -p "$(dirname "$BASE_DIR")" && cp -R dist/electron/renderer "$BASE_DIR"
cp "$RESOURCE_DIR/manifest.json" "$(dirname "$BASE_DIR")/manifest.json"
```

复制必须成功；存在同名基线时先核对，不能覆盖。保存的是此次实际打包的完整 renderer，不是差异 ZIP 解压目录。本文新基线按平台/架构隔离，避免UOS两架构runtimeId相同导致目录冲突。当前本机已有1.0.0的旧布局基线仍在 `$HOME/.local/share/electron-update-server/baselines/$PROJECT/<runtimeId>/1.0.0/renderer`；若从1.0.0发增量，核对内容确属该目标后，可将 `BASE_DIR` 显式设为该旧目录，或复制到本文新布局，保留原目录不移动。对应manifest可从服务端该目标的 `resources/<runtimeId>/versions/1.0.0/manifest.json` 恢复。`runtimeId` 包含应用版本、main/preload 字节、Electron、依赖与锁文件摘要，不同运行时不能混用。

### 4. 发布全量包和初始资源清单

同级两客户端都须有新鲜production构建，发布前从服务端运行动态版本联调。本机发布器验证所有包后，最后原子切换当前指针；不手工编辑 latest*.yml 或签名 manifest：

```sh
(cd "$SERVER" && npm run test:clients)
node "$SERVER/src/cli.cjs" publish-full --config "$SERVER_CONFIG" --project "$PROJECT" --platform "$PLATFORM" --arch "$ARCH" --dir "$FULL_DIR"
node "$SERVER/src/cli.cjs" publish-resources --config "$SERVER_CONFIG" --project "$PROJECT" --platform "$PLATFORM" --arch "$ARCH" --dir "$RESOURCE_DIR"
```

两条发布命令各自原子化，跨通道并非一个事务。正式服务器上须先把发布文件复制到该服务器的 incoming 目录，再以服务器的 `--config` / `--dir` 执行 CLI；本机命令不会自动上传。完整上传与部署步骤见[服务端 README](https://github.com/cuijianjun/electron-update-server/blob/agent/update-server-main/README.md)。HTTP 接口只读。

随后从旧应用检查 → 下载 → 确认安装 → 重启，核对应用版本、数据保留、协议及授权取消。Windows 走 NSIS；UOS 走 DebUpdater 和包管理器提权。全量版本与已安装相同则显示无更新。

### 5. 发布 renderer 增量

示例假定应用仍为 `1.0.1`、该 runtimeId 的已发布 renderer 基线为 `1.0.1`，要发资源 `1.0.2`。不要修改应用版本、main、preload、依赖或锁文件；只修改 renderer 后执行：

```sh
BASE_VERSION=1.0.1
RESOURCE_VERSION=1.0.2
# 使用步骤3登记的真实manifest；release已清理时改为归档的绝对路径。
BASE_MANIFEST="release/resources/$PLATFORM-$ARCH/$BASE_VERSION/manifest.json"
RUNTIME_ID=$(node -p "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')).runtimeId" "$BASE_MANIFEST")
BASE_DIR="$BASE_ROOT/$RUNTIME_ID/$BASE_VERSION/renderer"
test -f "$BASE_DIR/index.html"
npm run test:unit
npm run build:app
RESOURCE_DIR="release/resources/$PLATFORM-$ARCH/$RESOURCE_VERSION"
npm run pack:resources -- --platform "$PLATFORM" --arch "$ARCH" --version "$RESOURCE_VERSION" --signing-key "$SIGNING_KEY" --base-dir "$BASE_DIR" --base-version "$BASE_VERSION" --out "$RESOURCE_DIR"
# 不同则停止，重新按全量发布流程处理。
test "$RUNTIME_ID" = "$(node -p "require('./$RESOURCE_DIR/manifest.json').runtimeId")"
(cd "$SERVER" && npm run test:clients)
NEXT_BASE="$BASE_ROOT/$RUNTIME_ID/$RESOURCE_VERSION/renderer"
test ! -e "$NEXT_BASE" && mkdir -p "$(dirname "$NEXT_BASE")" && cp -R dist/electron/renderer "$NEXT_BASE"
cp "$RESOURCE_DIR/manifest.json" "$(dirname "$NEXT_BASE")/manifest.json"
node "$SERVER/src/cli.cjs" publish-resources --config "$SERVER_CONFIG" --project "$PROJECT" --platform "$PLATFORM" --arch "$ARCH" --dir "$RESOURCE_DIR"
```

上面 `test:clients` 完成动态版本的packer→HTTP→实际客户端控制器回归；同级两个客户端都需要新鲜production构建。每条检查失败都应停止，不继续执行发布。下次把 BASE_VERSION 改为刚发布的资源版本，并选择更高 RESOURCE_VERSION。基线与manifest按 `$BASE_ROOT/<runtimeId>/<资源版本>/` 配对保留，先备份再清理构建输出；新发布机还需恢复这两项和原签名私钥。只换 URL 不需要重新生成密钥。

有 base 参数输出 schema2：差异 ZIP + 完整目标文件清单 + 签名约束的完整快照，文件删除由目标清单表达。客户端只有版本与实际基线哈希均匹配时才下载差异；跳版本或基线不同会下载同一 manifest 的完整快照。未传 base 参数输出 schema1 完整 renderer ZIP。旧协议客户端先发全量升级。单个 ZIP 上限 50MiB，展开后总量上限 100MiB / 5000文件。

资源更新流程：检查 → 下载/取消 → 签名及哈希校验 → 暂存 → 确认重启 → Vue 启动确认。首次启动失败会在12秒超时或下次启动回退上一正常 renderer；资源存于 userData，不修改 app.asar。`get-version` 是应用版本，`get-resource-version` 是资源版本。

### 6. 发布验收、恢复与保留

- 先安装旧版，再测新版全量更新；同一应用 runtimeId 下测试资源差异、跳版本快照、取消下载和重启生效。目标 Windows/UOS 需各自真机或 VM 验收。
- 服务器 latest*.yml / manifest.json 返回 `Cache-Control: no-store`；版本化安装包和 ZIP 允许长期缓存。健康检查成功还需验证实际元数据、归档和 Range，命令见服务端 README。
- 同版本不同内容、旧版本提升、签名不符和并发发布会拒绝。已发布版本保持不可变；服务端回滚采用发布更高版本的修复包，不能手改签名清单或用低版本覆盖。renderer 启动自动回退不等于全量安装器自动回滚。
- 长期备份每项目私钥、公钥、公开配置、服务端数据、历史 blockmap、完整 renderer 基线和发布 manifest。Ed25519 仅签资源清单；Windows Authenticode 证书需另外配置，不能拿资源私钥代替。
- `release/` / `dist/electron/` 可在发布产物与基线备份后重建。不要删除仍被旧客户端引用的归档、基线或生产数据；常驻测试服务与生产环境分别保留数据。

当前本机服务已发布 Windows x64、UOS x64/ARM64 的 1.0.0 全量包及资源基线。本地自动化证据见 [003更新任务](specs/003-update-channels/tasks.md) 与[服务端验收](https://github.com/cuijianjun/electron-update-server/blob/agent/update-server-main/specs/001-local-update-service/tasks.md)。本机联调通过不表示公网已经上线；UOS 版本、CPU、glibc、桌面会话与安装提权验收仍待目标环境。
