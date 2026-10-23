/**
 * ============================================================
 * 窗口管理器 (windowManager)
 * ============================================================
 * 负责创建三类窗口：
 *   1. createMainWindow()   —— 主窗口（业务主界面）
 *   2. loadingWindow()      —— 启动屏（首屏优化机制）
 *   3. loadingOtherWindow() —— 子窗口加载屏
 *
 * 同时承载「文件分片读取」的 IPC（file:select / file:readChunk），
 * 用于断点续传上传大文件。
 *
 * 学习建议：先看 initWindow() 了解入口，再看 createMainWindow() 的
 * webPreferences 配置（contextIsolation/nodeIntegration/webviewTag）。
 * ============================================================
 */

import { BrowserWindow, app, Menu, Tray, nativeImage, ipcMain, dialog } from 'electron'
import { platform } from 'os'
import menuconfig, { trayMenu } from '../config/menu'
import { openDevTools, IsUseSysTitle, UseStartupChart } from '../config/const'
import setIpc from './ipcMain'
import { winURL, loadingURL } from '../config/StaticPath'
import { toCreateContextMenu, toListenMainWin, toRefreshPage, toInitStore } from '../../renderer/utils/ipc'
const { join } = require('path')
const path = require('path')
const fs = require('fs')
const fsAsync = require('fs/promises')

// 三类窗口的引用
var loadWindow = null          // 启动屏
var mainWindow = null          // 主窗口
var loadingOthersWindow = null // 子窗口加载屏

// 注册所有 IPC 通道（见 services/ipcMain.js）
setIpc.Mainfunc(IsUseSysTitle)

// 关闭 Electron 的安全警告（本项目用 nodeIntegration，属预期行为）
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

// 托盘图标
var appTray = null
var trayIcon = null

/**
 * 创建主窗口
 * 关键点：
 *   - contextIsolation:false + nodeIntegration:true 让渲染进程能直接用 require('electron')
 *   - webviewTag:true 允许使用 <webview> 标签内嵌页面（iframe 机制）
 *   - preload 注入断点续传所需能力
 */
function createMainWindow() {
	mainWindow = new BrowserWindow({
		height: 900,
		useContentSize: true,
		width: process.env.NODE_ENV === 'development' ? 1700 : 1400,
		minWidth: 1366,
		minHeight: 800,
		show: true,
		// IsUseSysTitle=false 时使用无边框窗口（前端自绘标题栏）
		frame: IsUseSysTitle,
		titleBarStyle: platform().includes('win32') ? 'default' : 'hidden',
		backgroundColor: '#FFF',
		icon: join(__static, 'icons/icon.png'), // 任务栏图标
		opacity: 1,
		webPreferences: {
			// 关闭上下文隔离：让 preload 与页面共享 window 对象，
			// 渲染进程可直接使用 node 能力（本项目约定）
			contextIsolation: false,
			nodeIntegration: true,
			webSecurity: false,
			// 允许 <webview> 标签（iframe 内嵌机制需要）
			webviewTag: true,
			// preload 脚本：向渲染进程暴露断点续传等能力
			preload: join(__dirname, 'preload.js'),
			// 开发模式才允许 devTools
			devTools: process.env.NODE_ENV === 'development' || openDevTools,
			scrollBounce: process.platform === 'darwin'
		}
	})

	// 开发环境追加「开发者设置」菜单
	if (process.env.NODE_ENV === 'development' || openDevTools) {
		menuconfig.push({
			label: '开发者设置',
			submenu: [{
				label: '切换到开发者模式',
				accelerator: 'CmdOrCtrl+I',
				role: 'toggledevtools'
			}]
		})
	}

	// 载入应用菜单
	const menu = Menu.buildFromTemplate(menuconfig)
	Menu.setApplicationMenu(menu)

	// 加载主窗口内容（开发走 dev-server，生产走 file://）
	mainWindow.loadURL(winURL)

	// 右侧托盘
	app.whenReady().then(() => {
		trayMenu.push({
			label: '退出应用',
			role: 'close',
			click: function () {
				app.quit()
			}
		})
		let icon = nativeImage.createFromPath(join(__static, 'icons/icon.png'))
		appTray = new Tray(icon)
		const contextMenu = Menu.buildFromTemplate(trayMenu)
		appTray.setContextMenu(contextMenu)
		appTray.on('click', function () {
			mainWindow.show()
		})
	})

	// 右键菜单 / 主窗口事件 / 兄弟窗口刷新 / electron-store 初始化
	toCreateContextMenu(mainWindow)
	toListenMainWin(mainWindow, loadWindow)
	toRefreshPage(mainWindow)
	toInitStore()

	// 主窗口 dom-ready 后：显示窗口 + 销毁启动屏
	mainWindow.webContents.once('dom-ready', () => {
		mainWindow.show()
		if (process.env.NODE_ENV === 'development' || openDevTools) {
			mainWindow.webContents.openDevTools(openDevTools)
		}
		// 首屏优化：主窗口就绪后销毁启动屏
		if (UseStartupChart && loadWindow && !loadWindow.isDestroyed()) {
			loadWindow.destroy()
		}
	})
	return mainWindow
}

/* ============================================================
 * 文件分片读取（断点续传上传）
 * ============================================================ */

/**
 * 选择文件（打开文件选择对话框，返回文件元信息）
 * 注意：这里只返回文件路径/大小/名称，不返回文件本体
 */
ipcMain.handle('file:select', async () => {
	const res = await dialog.showOpenDialog(mainWindow, {
		properties: ['openFile', 'multiSelections']
	})
	if (res.canceled) {
		return { success: false }
	}
	const resultArr = []
	const filePaths = res.filePaths
	filePaths.forEach(item => {
		resultArr.push({
			filePath: item,
			fileSize: fs.statSync(item).size,
			fileName: path.basename(item)
		})
	})
	return {
		success: true,
		resultArr
	}
})

/**
 * 读取文件指定区间的二进制数据（断点续传的核心）
 * @param {string} filePath 文件路径
 * @param {number} start    起始字节
 * @param {number} end      结束字节
 * @returns {ArrayBuffer}   该区间的二进制数据
 */
ipcMain.handle('file:readChunk', async (_, filePath, start, end) => {
	const fd = await fsAsync.open(filePath, 'r')
	const leadLen = end - start + 1
	const buf = Buffer.alloc(leadLen)
	await fd.read(buf, 0, leadLen, start)
	await fd.close()
	// 把 Buffer 转成 ArrayBuffer 返回给渲染进程
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length)
})

/**
 * 启动屏窗口（首屏优化机制）
 * 先显示一个轻量的 loading 页面，2 秒后再创建真正的主窗口，
 * 避免主窗口白屏/加载慢的观感。
 */
function loadingWindow() {
	loadWindow = new BrowserWindow({
		width: 400,
		height: 600,
		frame: false,
		backgroundColor: '#222',
		skipTaskbar: true,
		transparent: true,
		resizable: false,
		webPreferences: { experimentalFeatures: true }
	})

	loadWindow.loadURL(loadingURL)
	loadWindow.show()

	// 2 秒后创建主窗口
	setTimeout(() => {
		loadWindow = createMainWindow()
	}, 2000)

	loadWindow.on('closed', () => {
		loadWindow = null
	})
	return loadWindow
}

/**
 * 子窗口加载屏
 * 打开子窗口时先显示 loading 屏，子窗口 dom-ready 后再销毁
 */
export function loadingOtherWindow() {
	loadingOthersWindow = new BrowserWindow({
		width: 400,
		height: 600,
		frame: false,
		backgroundColor: '#222',
		skipTaskbar: true,
		transparent: true,
		resizable: false,
		webPreferences: { experimentalFeatures: true }
	})

	loadingOthersWindow.loadURL(loadingURL)
	loadingOthersWindow.show()

	loadingOthersWindow.on('closed', () => {
		loadingOthersWindow = null
	})
	return loadingOthersWindow
}

/**
 * 初始化窗口入口
 * UseStartupChart=true 时先走启动屏，否则直接创建主窗口
 */
function initWindow() {
	if (UseStartupChart) {
		return loadingWindow()
	} else {
		return createMainWindow()
	}
}

export default initWindow
