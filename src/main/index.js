import './bootstrap'
'use strict'

/**
 * ============================================================
 * 应用主进程入口 (main process entry)
 * ============================================================
 * 这个文件是 Electron 应用的「大脑」，负责：
 *   1. 单实例锁 —— 保证同一时间只有一个应用实例在运行
 *   2. 创建主窗口（通过 windowManager）
 *   3. 深链协议 (myapp://) 的注册与参数解析
 *   4. 第二实例唤起时的窗口聚焦与参数传递
 *
 * 学习建议：从下往上读，先看 app.requestSingleInstanceLock()，
 * 再看 onAppReady()，最后看 handleDeepLink()。
 * ============================================================
 */

import { app, BrowserWindow, session } from 'electron'
import initWindow from './services/windowManager'
import DisableButton from './config/DisableButton'
import logger from './config/logger'

const { URL } = require('url')
const path = require('path')

// 深链协议名：注册后，浏览器/命令行里输入 myapp://openapp?xxx=yyy 就能唤起本应用
const PROTOCOL = 'myapp'

// 存储解析出来的深链参数（供 onAppReady 阶段发送给渲染进程）
let deepLinkParams = null

/**
 * 处理深链 URL
 * 例：myapp://openapp?token=abc123&redirect=/home
 *   - protocol  = 'myapp:'
 *   - hostname  = 'openapp'
 *   - 查询参数  = { token: 'abc123', redirect: '/home' }
 *
 * @param {string} url 完整的深链 URL
 * @returns {boolean} 是否成功处理
 */
function handleDeepLink (url) {
  try {
    logger.info(`收到深度链接: ${url}`)

    // Windows 下命令行传参可能被转义，需要先解码
    let decodedUrl = url
    if (process.platform === 'win32') {
      try {
        decodedUrl = decodeURIComponent(url)
        logger.info(`Windows 系统解码后的 URL: ${decodedUrl}`)
      } catch (decodeError) {
        logger.warn('URL 解码失败，使用原始 URL:', decodeError)
      }
    }

    const urlObj = new URL(decodedUrl)

    // 只处理「myapp://openapp」这个入口，其它 host 忽略
    if (urlObj.protocol === 'myapp:' && urlObj.hostname === 'openapp') {
      // 把 ?a=1&b=2 解析成对象 { a: '1', b: '2' }
      const params = {}
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value
      })

      logger.info(`解析深度链接参数:`, params)
      deepLinkParams = params

      // 如果应用已经启动，直接发送参数到渲染进程
      const allWindows = BrowserWindow.getAllWindows()
      if (allWindows.length > 0) {
        const mainWindow = allWindows[0]

        // 确保窗口可见并聚焦
        if (mainWindow.isMinimized()) {
          mainWindow.restore()
        }
        mainWindow.show()
        mainWindow.focus()

        // 页面还在加载就等加载完再发，否则立即发
        if (mainWindow.webContents.isLoading()) {
          mainWindow.webContents.once('did-finish-load', () => {
            logger.info('渲染进程加载完成，发送深度链接参数:', params)
            mainWindow.webContents.send('deep-link-params', params)
          })
        } else {
          logger.info('立即发送深度链接参数到渲染进程:', params)
          mainWindow.webContents.send('deep-link-params', params)
        }

        // Windows 下额外处理：让窗口短暂置顶，确保弹到最前面
        if (process.platform === 'win32') {
          mainWindow.setAlwaysOnTop(true)
          setTimeout(() => {
            mainWindow.setAlwaysOnTop(false)
          }, 1000)
        }
      } else {
        logger.info('应用尚未启动，参数将在应用启动后发送')
      }

      return true
    }
  } catch (error) {
    logger.error('处理深度链接失败:', error)
  }
  return false
}

/**
 * 应用就绪后的初始化
 * 顺序：创建主窗口 → 发送深链参数 → 加载 Vue DevTools
 */
async function onAppReady () {
  logger.info('应用启动开始')

  // 创建主窗口（windowManager 内部会处理启动屏 + IPC 注册）
  const win = initWindow()

  // 禁用 F12（生产环境 + DisableF12=true 时生效，拦截开发者控制台）
  DisableButton.Disablef12()

  // 如果有深链参数，等主窗口创建完成后发送给渲染进程
  if (deepLinkParams) {
    const sendParamsToMainWindow = () => {
      const allWindows = BrowserWindow.getAllWindows()
      const mainWindow = allWindows.find(w => !w.isDestroyed())

      if (mainWindow) {
        const sendParams = () => {
          logger.info('发送深度链接参数到渲染进程:', deepLinkParams)
          mainWindow.webContents.send('deep-link-params', deepLinkParams)

          // 二次发送 + 清空，确保消息被可靠接收
          setTimeout(() => {
            mainWindow.webContents.send('deep-link-params', deepLinkParams)
            deepLinkParams = null
          }, 1000)
        }

        if (mainWindow.webContents.isLoading()) {
          mainWindow.webContents.once('did-finish-load', () => {
            // 等 Vue 应用完全初始化后再发
            setTimeout(sendParams, 2000)
          })
        } else {
          setTimeout(sendParams, 1000)
        }
      } else {
        // 主窗口还没建好，延迟重试
        setTimeout(sendParamsToMainWindow, 500)
      }
    }

    setTimeout(sendParamsToMainWindow, 2500)
  } else {
    logger.info('没有深度链接参数需要发送')
  }

  // 开发环境加载 Vue DevTools（可选，无该目录时自动跳过）
  if (process.env.NODE_ENV === 'development' && process.env.SKELETON_E2E !== '1') {
    const vueDevToolsPath = path.resolve('devtools/vue-devtools/6.5.0_0')
    try {
      await session.defaultSession.loadExtension(vueDevToolsPath)
    } catch (e) {
      logger.warn('Vue DevTools 未安装，跳过:', e.message)
    }
  }

  logger.info('应用启动完成')
}

// ============================================================
// 单实例锁：防止程序多开
// ============================================================
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  // 已有实例在运行，直接退出当前实例
  logger.info('应用已在运行，退出当前实例')
  app.quit()
} else {
  // 第二个实例启动时触发：把深链参数解析出来，并聚焦已有主窗口
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    logger.info('检测到第二个实例启动:', commandLine)

    // 从命令行参数里找深链
    const deepLinkArg = commandLine.find(arg => arg.startsWith('myapp://'))
    if (deepLinkArg) {
      handleDeepLink(deepLinkArg)
    }

    // 聚焦主窗口
    const allWindows = BrowserWindow.getAllWindows()
    if (allWindows.length > 0) {
      const mainWindow = allWindows[0]
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.show()
      mainWindow.focus()

      // Windows 下置顶处理
      if (process.platform === 'win32') {
        mainWindow.setAlwaysOnTop(true)
        mainWindow.moveTop()
        setTimeout(() => {
          mainWindow.setAlwaysOnTop(false)
        }, 1000)
      }
    } else {
      logger.warn('未找到主窗口')
    }
  })
}

// 就绪后初始化
app.isReady() ? onAppReady() : app.on('ready', onAppReady)

// 解决 9.x 跨域异常问题（Chromium 安全策略）


// 所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  app.quit()
})

// ============================================================
// 注册自定义协议 myapp://
// ============================================================
if (process.defaultApp) {
  // 开发环境：处理命令行参数 + 注册协议（便于本地测试）
  if (process.argv.length >= 2) {
    const deepLinkArg = process.argv.find(arg => arg.startsWith('myapp://'))
    if (deepLinkArg) {
      handleDeepLink(deepLinkArg)
    }
    if (process.env.SKELETON_E2E !== '1') app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])])
    logger.info('开发环境：注册 myapp 协议用于测试')
  }
} else {
  // 生产环境：直接注册协议（打包后由安装器写注册表 / desktop 文件）
  if (process.env.SKELETON_E2E !== '1') app.setAsDefaultProtocolClient(PROTOCOL)
  logger.info('生产环境：注册 myapp 协议')
}

// ============================================================
// 启动时解析命令行参数（含深链和 userToken）
// ============================================================
if (process.argv.length >= 2) {
  const deepLinkArg = process.argv.find(arg => arg.startsWith('myapp://'))
  if (deepLinkArg) {
    handleDeepLink(deepLinkArg)
  }

  // 支持 --userToken=xxx 和 userToken=xxx 两种格式
  const userTokenArg = process.argv.find(arg => arg.startsWith('--userToken=') || arg.startsWith('userToken='))
  if (userTokenArg) {
    const userToken = userTokenArg.split('=')[1]
    deepLinkParams = { userToken }
  }
}

// macOS 激活事件（点击 Dock 图标且无窗口时重建窗口）
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    onAppReady()
  }
})
