/**
 * ============================================================
 * IPC 注册中心 (ipcMain.js)
 * ============================================================
 * 这里是「主进程 ↔ 渲染进程信息交互」机制的核心。
 *
 * 通信方向说明：
 *   1. 渲染进程 → 主进程
 *      - ipcRenderer.send      发送异步消息  → ipcMain.on 接收
 *      - ipcRenderer.sendSync  发送同步消息  → ipcMain.on 内用 event.returnValue 响应
 *      - ipcRenderer.invoke    发送 Promise  → ipcMain.handle 接收（可 await）
 *   2. 主进程 → 渲染进程
 *      - webContents.send 发送消息 → ipcRenderer.on 监听
 *
 * 本文件用 ipcMain.handle 注册了大量通道，涵盖：
 *   - 窗口控制（最小化/最大化/关闭/隐藏/刷新）
 *   - 文件下载（全量/增量）
 *   - 全量更新 / 热更新
 *   - 系统信息 / 版本号
 *   - 对话框 / 子窗口 / 日志
 * ============================================================
 */

import { ipcMain, dialog, BrowserWindow, app, shell } from 'electron'
import { winURL } from '../config/StaticPath'
import downloadFile from './downloadFile'
import download from './download'
import Update from './checkupdate'
import { loadingOtherWindow } from './windowManager'
import { openDevTools } from '../config/const'
import { updater } from './HotUpdater'
import fs from 'fs'
import { getLogPath } from '../config/logger'
import { getSystemInfo, getSystemSummary } from '../../renderer/utils/ipc/systemDetect'
import { getInstalledPackageVersion, getVersion } from '../utils/installVersion'
import path from 'path'

// 白名单路由：这些路由的窗口关闭时直接 close，其它则 hide（隐藏而非销毁）
const whiteList = ['/iframe']

export default {
	/**
	 * 主入口：注册所有 IPC 通道
	 * @param {boolean} IsUseSysTitle 是否使用系统标题栏
	 */
	Mainfunc(IsUseSysTitle) {
		// 全量更新实例
		const allUpdater = new Update()

		// ============ 窗口控制 ============
		ipcMain.handle('IsUseSysTitle', async () => {
			return IsUseSysTitle
		})
		ipcMain.handle('windows-mini', (event) => {
			BrowserWindow.fromWebContents(event.sender)?.minimize()
		})
		ipcMain.handle('window-max', async (event) => {
			if (BrowserWindow.fromWebContents(event.sender)?.isMaximized()) {
				BrowserWindow.fromWebContents(event.sender)?.unmaximize()
				return { status: false }
			} else {
				BrowserWindow.fromWebContents(event.sender)?.maximize()
				return { status: true }
			}
		})
		ipcMain.handle('window-close', (event) => {
			const currentWindowURL = event.sender.getURL()
			const pathname = currentWindowURL.split('?')[0].split('#')[1]
			console.log(pathname, 'pathname')
			if (!whiteList.includes(pathname)) {
				BrowserWindow.fromWebContents(event.sender)?.hide()
				event.preventDefault()
			} else {
				BrowserWindow.fromWebContents(event.sender)?.hide()
				BrowserWindow.fromWebContents(event.sender)?.close()
			}
		})
		ipcMain.handle('window-hide', (event) => {
			BrowserWindow.fromWebContents(event.sender)?.hide()
			event.preventDefault()
		})
		ipcMain.handle('window-refresh', (event) => {
			BrowserWindow.fromWebContents(event.sender)?.reload()
		})

		// ============ 文件下载 ============
		// 全量下载（带同名处理/进度/完成事件）
		ipcMain.handle('files-download', (event, args) => {
			download.download(BrowserWindow.fromWebContents(event.sender), args)
		})
		// 简单下载（默认保存到下载目录）
		ipcMain.handle('start-download', (event, args) => {
			downloadFile.download(BrowserWindow.fromWebContents(event.sender), args)
		})

		// ============ 全量更新 ============
		ipcMain.handle('check-update', (event) => {
			allUpdater.checkUpdate(BrowserWindow.fromWebContents(event.sender))
		})
		ipcMain.handle('start-update', () => {
			allUpdater.handleDownload()
		})
		ipcMain.handle('confirm-update', () => {
			allUpdater.quitInstall()
		})

		// ============ 热更新 ============
		ipcMain.handle('hot-update', (event) => {
			updater(BrowserWindow.fromWebContents(event.sender))
		})
		ipcMain.handle('confirm-hot-update', () => {
			app.relaunch()
			app.exit(0)
		})

		// ============ 应用路径 / 系统信息 / 版本 ============
		ipcMain.handle('get-app-path', () => {
			try {
				return app.getAppPath()
			} catch (error) {
				return ''
			}
		})
		// 获取系统信息（异步，含国产化系统/CPU 检测）
		ipcMain.handle('get-system-info', async () => {
			try {
				const info = getSystemInfo()
				console.log('[IPC] System info:', {
					osType: info.osType,
					osDisplayName: info.osDisplayName,
					cpuArch: info.cpuArch,
					cpuVendor: info.cpuVendor,
					platformId: info.platformId,
					isDomestic: info.isDomestic
				})
				return info
			} catch (error) {
				console.error('[IPC] Failed to get system info', error)
				return null
			}
		})
		// 获取系统信息摘要（同步）
		ipcMain.on('get-system-summary', (event) => {
			try {
				event.returnValue = getSystemSummary()
			} catch (error) {
				console.error('[IPC] Failed to get system summary', error)
				event.returnValue = 'Unknown System'
			}
		})
		// 获取安装包版本（异步）
		ipcMain.handle('get-install-version', async () => {
			try {
				const result = getInstalledPackageVersion()
				console.log('[IPC] Install version:', result)
				return result
			} catch (error) {
				console.error('[IPC] Failed to get install version', error)
				return {
					version: '0.0.0',
					source: 'error',
					error: error.message
				}
			}
		})
		// 获取版本字符串（同步）
		ipcMain.on('get-version', (event) => {
			try {
				event.returnValue = getVersion()
			} catch (error) {
				console.error('[IPC] Failed to get version', error)
				event.returnValue = '0.0.0'
			}
		})

		// ============ 对话框 ============
		ipcMain.handle('open-messagebox', async (event, arg) => {
			const res = await dialog.showMessageBox(
				BrowserWindow.fromWebContents(event.sender),
				{
					type: arg.type || 'info',
					title: arg.title || '',
					buttons: arg.buttons || [],
					message: arg.message || '',
					noLink: arg.noLink || true
				}
			)
			return res
		})
		ipcMain.handle('open-errorbox', (event, arg) => {
			dialog.showErrorBox(arg.title, arg.message)
		})

		// 打开目录选择对话框
		ipcMain.handle('open-directory', async () => {
			try {
				const res = await dialog.showOpenDialog({
					properties: ['openDirectory']
				})
				if (res.canceled) {
					return false
				}
				return res.filePaths[0]
			} catch (error) {
				return false
			}
		})

		// ============ 子窗口 (open-win) ============
		// 用于打开独立子窗口（配合 loadingOtherWindow 启动屏）
		let childWin = null
		let cidArray = []
		ipcMain.handle('open-win', (event, arg) => {
			let cidJson = { id: null, url: '' }
			const windowOptions = arg
			// 去重：同 URL 已打开则聚焦，否则新建
			let data = cidArray.filter((currentValue) => {
				if (currentValue.url === arg.url) {
					return currentValue
				}
			})
			if (data.length > 0) {
				let currentWindow = BrowserWindow.fromId(data[0].id)
				currentWindow.focus()
			} else {
				let parentID = event.sender.id
				childWin = new BrowserWindow({
					width: windowOptions?.width || 842,
					height: windowOptions?.height || 595,
					useContentSize: true,
					autoHideMenuBar: true,
					resizable: windowOptions?.resizable ?? false,
					minWidth: windowOptions?.minWidth || 842,
					minHeight: windowOptions?.minHeight,
					show: windowOptions?.show ?? false,
					opacity: windowOptions?.opacity || 1.0,
					parent: parentID,
					frame: IsUseSysTitle,
					webPreferences: {
						nodeIntegration: true,
						webSecurity: false,
						webviewTag: arg?.webview ?? false,
						devTools: true,
						scrollBounce: process.platform === 'darwin',
						contextIsolation: false
					}
				})
				childWin.loadURL(winURL + `#${arg.url}`)
				cidJson.id = childWin?.id
				cidJson.url = arg.url
				cidArray.push(cidJson)
				// 显示子窗口加载屏
				var loadingOthersWindow = loadingOtherWindow()
				childWin.webContents.once('dom-ready', () => {
					childWin.show()
					if (process.env.NODE_ENV === 'development' || openDevTools) {
						childWin.webContents.openDevTools(false)
					}
					loadingOthersWindow.destroy()
					childWin.webContents.send('send-data', arg.sendData)
				})
			}

			childWin.on('close', () => {
				console.log('child-closed')
				childWin.removeAllListeners()
				childWin = null
				cidArray = cidArray.filter(item => item.id !== cidJson.id)
			})
			childWin.on('maximize', () => {
				if (cidJson.id != null) {
					BrowserWindow.fromId(cidJson.id).webContents.send('w-max', true)
				}
			})
			childWin.on('unmaximize', () => {
				if (cidJson.id != null) {
					BrowserWindow.fromId(cidJson.id).webContents.send('w-max', false)
				}
			})
		})

		// ============ 日志 ============
		ipcMain.handle('get-log-path', async () => {
			try {
				const logPath = getLogPath()
				return { success: true, path: logPath }
			} catch (error) {
				return { success: false, error: error.message }
			}
		})
		ipcMain.handle('open-log-folder', async () => {
			try {
				const logPath = getLogPath()
				if (!fs.existsSync(logPath)) {
					fs.mkdirSync(logPath, { recursive: true })
				}
				await shell.openPath(logPath)
				return { success: true }
			} catch (error) {
				return { success: false, error: error.message }
			}
		})
		ipcMain.handle('get-log-files', async () => {
			try {
				const logPath = getLogPath()
				if (!fs.existsSync(logPath)) {
					return { success: true, files: [] }
				}
				const files = fs.readdirSync(logPath)
					.filter(file => file.endsWith('.log'))
					.map(file => {
						const filePath = path.join(logPath, file)
						const stats = fs.statSync(filePath)
						return {
							name: file,
							size: stats.size,
							modified: stats.mtime,
							path: filePath
						}
					})
					.sort((a, b) => b.modified - a.modified)
				return { success: true, files }
			} catch (error) {
				return { success: false, error: error.message }
			}
		})
	}
}
