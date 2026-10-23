/**
 * ============================================================
 * 全量文件下载 (download.js)
 * ============================================================
 * 使用 webContents.downloadURL 触发下载，带：
 *   - 同名文件自动重命名（xxx(1).ext, xxx(2).ext ...）
 *   - 下载进度回调（download-progress）
 *   - 下载完成 / 失败回调（download-done / download-error）
 *
 * 与 downloadFile.js 的区别：本文件支持自定义保存路径、同名处理、更完整的事件。
 * ============================================================
 */

/* eslint-disable no-case-declarations */
import { app, dialog } from 'electron'
import path from 'path'
import os from 'os'
const fs = require('fs')

// 版本以 package.json 为基准
const version = require('../../../package.json').version
// 默认下载地址（全量安装包）
const baseUrl = 'http://127.0.0.1:25565/'
var Sysarch = null
var defaultDownloadUrL = null

// 识别操作系统位数
os.arch().includes('64') ? (Sysarch = 'win64') : (Sysarch = 'win32')

// 识别操作系统，拼出对应的安装包下载地址
if (os.platform().includes('win32')) {
	defaultDownloadUrL = baseUrl + `electron_${version}_${Sysarch}.exe?${new Date().getTime()}`
} else if (os.platform().includes('linux')) {
	defaultDownloadUrL = baseUrl + `electron_${version}_${Sysarch}?${new Date().getTime()}`
} else {
	defaultDownloadUrL = baseUrl + `electron_${version}_mac.dmg?${new Date().getTime()}`
}

export default {
	/**
	 * 触发下载
	 * @param {BrowserWindow} mainWindow 主窗口
	 * @param {Object} args { downloadURL, path, name }
	 */
	download(mainWindow, args) {
		mainWindow.webContents.downloadURL(args.downloadURL || defaultDownloadUrL)
		mainWindow.webContents.session.once('will-download', (event, item, webContents) => {
			// 下载目录（默认系统下载目录）
			const filePath = path.join(
				args.path || app.getPath('downloads'),
				args.name || item.getFilename()
			)
			// 同名自动处理
			let uniquePath = filePath
			let counter = 1
			if (fs.existsSync(filePath)) {
				while (fs.existsSync(uniquePath)) {
					uniquePath = path.join(
						path.dirname(filePath),
						`${path.basename(filePath, path.extname(filePath))}(${counter})${path.extname(filePath)}`
					)
					counter++
				}
			}
			// 保存路径
			item.setSavePath(uniquePath)
			// 下载进度
			item.on('updated', (event, state) => {
				switch (state) {
					case 'progressing':
						mainWindow.webContents.send(
							'download-progress',
							((item.getReceivedBytes() / item.getTotalBytes()) * 100).toFixed(0)
						)
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
						const basename = path.basename(filePath)
						const data = { basename }
						mainWindow.webContents.send('download-done', data)
						item = null
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
