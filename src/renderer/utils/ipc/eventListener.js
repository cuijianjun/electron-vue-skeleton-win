/**
 * ============================================================
 * 事件监听 (eventListener.js)
 * ============================================================
 * 主进程侧的事件监听，被 windowManager.js 调用：
 *   - listenContextMenu  监听网页右键，弹出自定义菜单
 *   - mainWinListener    主窗口生命周期事件（dom-ready / 最大化 / 关闭）
 * ============================================================
 */

const { app, ipcRenderer } = require('electron')
import { openDevTools, UseStartupChart } from '../../../main/config/const'

// 路由右键黑名单（这些路由下不弹自定义右键菜单）
const contextmenuBlacklistByRouter = ['/mindMap', '/draw', '/luckySheet']
// 元素右键黑名单（这些 DOM id 内不弹菜单）
const contextmenuBlacklistByDom = ['tags-view-container']

/**
 * 判断 currentDom 是否在 parentDom 内部（含自身）
 * @param {Element} currentDom 目标元素
 * @param {Element} parentDom  父元素
 * @returns {boolean}
 */
function isIncludeDom(currentDom, parentDom) {
	if (!parentDom) return false
	let node = currentDom
	while (node) {
		if (node === parentDom) return true
		node = node.parentNode
	}
	return false
}

// 监听右键
export function listenContextMenu() {
	window.addEventListener('contextmenu', (e) => {
		e.preventDefault()
		// 判断路由黑名单
		const routeName = location.href.split('#')[1].split('?')[0]
		if (!contextmenuBlacklistByRouter.includes(routeName)) {
			// 判断元素黑名单
			contextmenuBlacklistByDom.forEach((item) => {
				let parentDom = document.getElementById(item)
				if (!isIncludeDom(e.target, parentDom)) {
					ipcRenderer.send('show-context-menu')
				}
			})
		}
	})
}

// 主进程监听事件
export function mainWinListener(mainWindow, loadWindow) {
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

	mainWindow.webContents.on('did-finish-load', () => {
		// 可在此注入 CSS 等
	})

	mainWindow.on('maximize', () => {
		mainWindow.webContents.send('w-max', true)
	})
	mainWindow.on('unmaximize', () => {
		mainWindow.webContents.send('w-max', false)
	})
	mainWindow.on('close', (e) => {
		e.sender.send('closeApp', 'clearStorage')
	})
	mainWindow.on('closed', () => {
		mainWindow = null
		app.quit()
	})
}
