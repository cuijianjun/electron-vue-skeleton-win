/**
 * ============================================================
 * IPC 工具统一出口 (index.js)
 * ============================================================
 * 汇总 re-export，供主进程（windowManager.js）和渲染进程统一引用。
 * ============================================================
 */

import { listenContextMenu, mainWinListener } from './eventListener'
import { onCloseApp, createContextMenu, refreshPage, initStore } from './ipcFun'

// 关闭应用清缓存
export function clearLocalStorage() {
	onCloseApp()
}

// 监听右键菜单
export function listenEventContextMenu() {
	listenContextMenu()
}

// 创建右键菜单（主进程调用）
export function toCreateContextMenu(mainWindow) {
	createContextMenu(mainWindow)
}

// 主进程事件监听（主进程调用）
export function toListenMainWin(mainWindow, loadWindow) {
	mainWinListener(mainWindow, loadWindow)
}

// 关闭子窗口刷新页面（主进程调用）
export function toRefreshPage(mainWindow) {
	refreshPage(mainWindow)
}

// 初始化 electron-store（主进程调用）
export function toInitStore() {
	initStore()
}
