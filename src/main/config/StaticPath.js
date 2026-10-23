// 这里定义了静态文件路径的位置
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { DllFolder } from '@config/index'

/**
 * 生产环境下设置 `__static` 全局变量指向静态资源目录
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 * 注意：这个全局变量只在单个 js 模块中生效，并不是整个主进程共享
 */
if (process.env.NODE_ENV !== 'development') {
  global.__static = path.join(__dirname, '/static').replace(/\\/g, '\\\\')
  process.env.libPath = path.join(__dirname, '..', '..', '..', '..', `${DllFolder}`).replace(/\\/g, '\\\\')
}

/**
 * 【热更新加载优先级】
 * 生产环境默认加载 asar 包内的 index.html；但如果 userData/hot-update/
 * 下存在热更新资源，则优先加载热更新版本 —— 这就是热更新生效的开关。
 * （开发环境始终走 dev-server，不受影响）
 */
function resolveProdURL() {
  try {
    const hotEntry = path.join(app.getPath('userData'), 'hot-update', 'index.html')
    if (fs.existsSync(hotEntry)) {
      return `file://${hotEntry}`
    }
  } catch (e) {
    // app ready 前 getPath 不可用等异常时，回退默认路径
  }
  return `file://${__dirname}/index.html`
}

// 主窗口加载地址：开发环境走 dev-server，生产环境走本地文件（热更优先）
export const winURL = process.env.NODE_ENV === 'development'
  ? `http://localhost:${process.env.PORT}`
  : resolveProdURL()

// 加载中页面（splash 启动屏，见 services/windowManager.js 的 loadingWindow）
export const loadingURL = process.env.NODE_ENV === 'development'
  ? `http://localhost:${process.env.PORT}/static/loader.html`
  : `file://${__static}/loader.html`

export const libPath = process.env.libPath
