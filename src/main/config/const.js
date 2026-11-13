/**
 * ============================================================
 * 主进程通用常量
 * ============================================================
 * 这些常量贯穿整个主进程，修改后会全局生效。
 * 学习建议：逐个字段看注释，理解每个开关的作用。
 */

// 【首屏优化开关】是否启用启动屏（splash screen）
// true  = 先弹出一个轻量 loading 窗口，主窗口加载完成后自动销毁
// false = 直接创建主窗口，不做启动屏过渡
// 这就是「提高首屏加载」机制的核心开关。
export const UseStartupChart = process.env.SKELETON_E2E !== '1'

// 是否使用系统原生标题栏
// false = 使用自定义无边框窗口（frame:false），由前端自绘标题栏
// true  = 使用操作系统自带的标题栏
export const IsUseSysTitle = false

// 内置静态资源服务器端口（server/index.js 使用的端口）
// 用于主进程启动一个本地 HTTP 服务，承载静态资源
export const BuiltInServerPort = 25565

// 热更新包内描述文件的前缀名
// 热更新服务器上会有一个 <configName>.json 的描述文件，
// 里面记录了最新版本号、下载地址、sha256 校验值
export const hotPublishConfigName = 'update-config'

// 开发时是否默认打开 DevTools
export const openDevTools = false

// 是否禁用 F12（生产环境生效，配合 DisableButton.js）
export const DisableF12 = false
