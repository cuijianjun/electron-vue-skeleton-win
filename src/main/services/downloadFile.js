/**
 * ============================================================
 * 简单文件下载 (downloadFile.js)
 * ============================================================
 * 简化版下载：默认保存到系统下载目录，返回文件路径。
 * 相比 download.js，本文件更轻量，适合普通文件下载场景。
 * ============================================================
 */

/* eslint-disable no-case-declarations */
import { app, dialog } from 'electron'
import path from 'path'
import os from 'os'

// 版本以 package.json 为基准
const version = require('../../../package.json').version
// 默认下载地址
const baseUrl = 'http://127.0.0.1:25565/'
var Sysarch = null
var defaultDownloadUrL = null

// 识别操作系统位数
os.arch().includes('64') ? Sysarch = 'win64' : Sysarch = 'win32'

// 识别操作系统
if (os.platform().includes('win32')) {
	defaultDownloadUrL = baseUrl + `electron_${version}_${Sysarch}.exe?${new Date().getTime()}`
} else if (os.platform().includes('linux')) {
	defaultDownloadUrL = baseUrl + `electron_${version}_${Sysarch}?${new Date().getTime()}`
} else {
	defaultDownloadUrL = baseUrl + `electron_${version}_mac.dmg?${new Date().getTime()}`
}

export default {
	/**
	 * 触发简单下载
	 * @param {BrowserWindow} mainWindow 主窗口
	 * @param {string} downloadUrL 下载地址（可空，空则用默认）
	 */
	download(mainWindow, downloadUrL) {
		mainWindow.webContents.downloadURL(downloadUrL || defaultDownloadUrL)
		mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
			// 将文件保存在系统的下载目录
			const filePath = path.join(app.getPath('downloads'), item.getFilename())
			// 自动保存
			item.setSavePath(filePath)
			// 下载进度
			item.on('updated', (event, state) => {
				switch (state) {
					case 'progressing':
						mainWindow.webContents.send('download-progress', (item.getReceivedBytes() / item.getTotalBytes() * 100).toFixed(0))
						break
					case 'interrupted ':
						mainWindow.webContents.send('download-paused', true)
						break
					default:
						break
				}
			})
			// 下载完成或失败
			item.once('done', (event, state) => {
				switch (state) {
					case 'completed':
						const data = { filePath }
						mainWindow.webContents.send('download-done', data)
						break
					case 'interrupted':
						mainWindow.webContents.send('download-error', true)
						dialog.showErrorBox('下载出错', '由于网络或其他未知原因导致下载出错.')
						break
					default:
						break
				}
			})
		})
	}
}
