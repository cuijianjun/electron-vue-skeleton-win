/**
 * ============================================================
 * IPC 功能函数 (ipcFun.js)
 * ============================================================
 * 渲染进程侧通过 require('electron') 直接拿 ipcRenderer/ipcMain，
 * 与主进程交互。涵盖：
 *   - onCloseApp       关闭窗口清空缓存
 *   - createContextMenu 右键菜单
 *   - refreshPage      关闭子窗口刷新页面（兄弟窗口传值）
 *   - initStore        electron-store 本地持久化（增删改查）
 *
 * 注意：这些函数会被主进程的 windowManager.js 调用
 * （通过 renderer/utils/ipc/index.js 的 re-export）。
 * ============================================================
 */

const { ipcRenderer, ipcMain, Menu, BrowserWindow } = require('electron')
const Store = require('electron-store')
const store = new Store()

// 清除所有定时器
function clearAllTimer() {
	let endTimer = setTimeout(() => {}, 100)
	for (let index = 0; index < endTimer; index++) {
		clearInterval(index)
		clearTimeout(index)
	}
}

// 关闭窗口清空缓存
export function onCloseApp() {
	ipcRenderer.on('closeApp', (e, type) => {
		if (type === 'clearStorage') {
			// 所有缓存
			const localStorageItems = Object.keys(localStorage)
			// 白名单（不清除的 key）
			const whiteList = ['tomorrowTipStartTime']
			// 需要清除的缓存
			const removeItems = localStorageItems.filter((i) => !whiteList.includes(i))
			removeItems.forEach((item) => {
				localStorage.removeItem(item)
			})
		}
		// 清除所有定时器
		clearAllTimer()
	})
}

// 右键菜单
export function createContextMenu(mainWindow) {
	// 监听渲染进程发出的 show-context-menu
	ipcMain.on('show-context-menu', (event) => {
		const contextTemp = [
			{
				label: '重新加载',
				accelerator: 'F5',
				role: 'reload'
			},
			{
				label: '清除缓存并刷新',
				click() {
					event.sender.send('closeApp', 'clearStorage')
					mainWindow.reload()
				}
			},
			{
				label: '退出',
				accelerator: 'CmdOrCtrl+F4',
				role: 'close'
			}
		]
		// 开发环境追加 devtools 菜单
		if (process.env.NODE_ENV === 'development') {
			contextTemp.push(
				{ type: 'separator' },
				{
					label: '检查',
					accelerator: 'CmdOrCtrl+I',
					role: 'toggledevtools'
				}
			)
		}
		const menu = Menu.buildFromTemplate(contextTemp)
		menu.popup({ window: BrowserWindow.fromWebContents(event.sender) })
	})
}

// 关闭子窗口刷新页面（兄弟窗口传值）
export function refreshPage(mainWindow) {
	ipcMain.on('sendRefresh', (e, arg) => {
		if (!mainWindow.isDestroyed()) {
			mainWindow.webContents.send('receiveRefresh', arg)
		}
	})

	// 兄弟窗口传值
	ipcMain.on('siblingConnect', (e, arg) => {
		if (!mainWindow.isDestroyed()) {
			mainWindow.webContents.send('siblingConnect', arg)
		}
	})
}

// electron-store 本地持久化（增删改查）
export function initStore() {
	ipcMain.on('setStore', (_, key, value) => {
		store.set(key, value)
	})

	ipcMain.on('getStore', (_, key) => {
		let value = store.get(key)
		_.returnValue = value || ''
	})

	ipcMain.on('getAllStore', (_, key) => {
		_.returnValue = store.store || {}
	})

	ipcMain.on('deleteOne', (_, key) => {
		store.delete(key)
	})

	ipcMain.on('deleteAll', (_) => {
		store.clear()
	})
}
