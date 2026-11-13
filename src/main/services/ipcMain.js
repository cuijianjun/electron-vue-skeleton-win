import { grantDirectory } from './downloadSession'
import resources from './resourceUpdates.cjs'
import { resourceContext } from './resourceContext'
import { secureIpcMain as ipcMain } from './secureIpc'
// Business handlers register with the shared transport; native IPC lives in shared/ipc.mjs.
import { dialog, BrowserWindow, app, shell } from 'electron'
import { winURL } from '../config/StaticPath'
import downloadFile from './downloadFile'
import download from './download'
import Update from './checkupdate'
import { loadingOtherWindow } from './windowManager'
import { openDevTools } from '../config/const'
import { updater } from './HotUpdater'
import fs from 'fs'
import { getLogPath } from '../config/logger'
import { getSystemInfo, getSystemSummary } from '../utils/systemDetect.js'
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
        ipcMain.handle('get-resource-version', () => resources.resourceInfo(resourceContext()).runningVersion)
        ipcMain.handle('renderer-ready', event => { const owner=BrowserWindow.fromWebContents(event.sender); if(!owner || owner.getParentWindow())return false; resources.confirm(resourceContext()); return true })

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

			} else {
				BrowserWindow.fromWebContents(event.sender)?.hide()
				BrowserWindow.fromWebContents(event.sender)?.close()
			}
		})
		ipcMain.handle('window-hide', (event) => {
			BrowserWindow.fromWebContents(event.sender)?.hide()

		})
		ipcMain.handle('window-refresh', (event) => {
			BrowserWindow.fromWebContents(event.sender)?.reload()
		})

		// ============ 文件下载 ============
		// 全量下载（带同名处理/进度/完成事件）
		ipcMain.handle('files-download', (event, args) => {
			return download.download(BrowserWindow.fromWebContents(event.sender), args)
		})
		// 简单下载（默认保存到下载目录）
		ipcMain.handle('start-download', (event, args) => {
			return downloadFile.download(BrowserWindow.fromWebContents(event.sender), args)
		})

		// ============ 全量更新 ============
		ipcMain.handle('check-update', (event) => {
			return allUpdater.checkUpdate(BrowserWindow.fromWebContents(event.sender))
		})
		ipcMain.handle('cancel-update', () => allUpdater.cancel())
        ipcMain.handle('start-update', () => {
			return allUpdater.handleDownload()
		})
		ipcMain.handle('confirm-update', () => {
			return allUpdater.quitInstall()
		})

		// ============ 热更新 ============
		ipcMain.handle('hot-update', (event) => {
			return updater(BrowserWindow.fromWebContents(event.sender))
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
		ipcMain.handle('get-system-summary', () => getSystemSummary())
		// 获取安装包版本（异步）
		ipcMain.handle('get-install-version', async () => {
			try {
				const result = getInstalledPackageVersion()
				console.log('[IPC] Install version:', result)
				return { ...result, rendererVersion: resources.resourceInfo(resourceContext()).runningVersion }
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
		ipcMain.handle('get-version', () => getVersion())
        ipcMain.handle('desktop-bootstrap', async event => {
            const [version, systemSummary, settings] = await Promise.all([
                ipcMain.dispatch(event,'get-version'), ipcMain.dispatch(event,'get-system-summary'), ipcMain.dispatch(event,'settings:snapshot')
            ])
            return {version,systemSummary,settings,clientId:event.sender.id}
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
		ipcMain.handle('open-directory', async (event) => {
			try {
				const res = await dialog.showOpenDialog({
					properties: ['openDirectory']
				})
				if (res.canceled) {
					return false
				}
				grantDirectory(event.sender, res.filePaths[0])
                return res.filePaths[0]
			} catch (error) {
				return false
			}
		})

		// ============ 子窗口 (open-win) ============
		// 用于打开独立子窗口（配合 loadingOtherWindow 启动屏）
        const children = new Map()
        ipcMain.handle('open-win', async (event, options) => {
            const existing = children.get(options.url)
            if (existing && !existing.isDestroyed()) { existing.show(); existing.focus(); return { id: existing.id } }
            const child = new BrowserWindow({
                width: options.width || 842, height: options.height || 595,
                minWidth: options.minWidth || 842, minHeight: options.minHeight,
                useContentSize: true, autoHideMenuBar: true, opacity: options.opacity ?? 1,
                show: false, frame: IsUseSysTitle, resizable: options.resizable ?? false,
                parent: BrowserWindow.fromWebContents(event.sender),
                webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true,
                    preload: path.join(__dirname, '../preload/index.cjs') }
            })
            children.set(options.url, child)
            child.on('closed', () => children.delete(options.url))
            child.on('maximize', () => ipcMain.send(child.webContents,'w-max', true))
            child.on('unmaximize', () => ipcMain.send(child.webContents,'w-max', false))
            const target = new URL(winURL); target.hash = options.url
            const splash=loadingOtherWindow()
            try { await child.loadURL(target.href) } finally { if(!splash.isDestroyed())splash.destroy() }
            child.show()
            if (options.sendData !== undefined) ipcMain.send(child.webContents,'send-data', options.sendData)
            return { id: child.id }
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
