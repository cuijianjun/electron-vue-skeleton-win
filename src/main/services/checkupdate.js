/**
 * ============================================================
 * 全量更新 (checkupdate.js)
 * ============================================================
 * 基于 electron-updater 的 autoUpdater 实现「全量更新」。
 * 全量更新 = 下载整个安装包替换当前版本（对应 electron-builder 打的 exe/deb）。
 *
 * 状态机（state 字段）：
 *   -1 检查更新失败
 *    0 正在检查更新
 *    1 检测到新版本，准备下载
 *    2 未检测到新版本
 *    3 下载中
 *    4 下载完成
 *
 * 学习建议：看 Update 类的 constructor（事件监听）→ checkUpdate（触发检查）
 *          → Message（回传渲染进程）。
 * ============================================================
 */

import { autoUpdater } from 'electron-updater'
const Store = require('electron-store')
const path = require('path')
const store = new Store()

// 默认更新服务器地址（生产环境通过 electron-store 的 nowIpStr 动态切换）
let nowIpUrl = 'http://127.0.0.1:8888/packageUpload'

/**
 * 全量更新类
 * 通过 autoUpdater 的事件监听，把更新进度实时推送给渲染进程
 */
class Update {
	mainWindow

	constructor() {
		// 更新配置文件路径：开发/生产环境不同
		if (process.env.NODE_ENV === 'development') {
			autoUpdater.updateConfigPath = path.join(__dirname, 'default-app-update.yml')
		} else {
			autoUpdater.updateConfigPath = path.join(__dirname, '../../../app-update.yml')
		}
		autoUpdater.setFeedURL(nowIpUrl)
		// 不自动下载，等待用户点击「开始更新」再下载
		autoUpdater.autoDownload = false

		// 更新出错
		autoUpdater.on('error', (err) => {
			console.log('更新出现错误', err.message)
			if (err.message.includes('sha512 checksum mismatch')) {
				this.Message(this.mainWindow, -1, 'sha512校验失败')
			} else {
				this.Message(this.mainWindow, -1, '错误信息请看主进程控制台')
			}
		})

		// 开始检查更新
		autoUpdater.on('checking-for-update', () => {
			console.log('开始检查更新')
			this.Message(this.mainWindow, 0)
		})

		// 发现可更新数据
		autoUpdater.on('update-available', (arg) => {
			console.log('有更新')
			this.Message(this.mainWindow, 1, arg)
		})

		// 没有可更新数据
		autoUpdater.on('update-not-available', () => {
			console.log('没有更新')
			this.Message(this.mainWindow, 2)
		})

		// 下载进度监听
		autoUpdater.on('download-progress', (progressObj) => {
			this.Message(this.mainWindow, 3, progressObj)
		})

		// 下载完成
		autoUpdater.on('update-downloaded', () => {
			console.log('done')
			this.Message(this.mainWindow, 4)
		})
	}

	/**
	 * 向渲染进程发送更新消息
	 * @param {BrowserWindow} mainWindow 主窗口
	 * @param {number} type  状态码（见文件头状态机说明）
	 * @param {any} data     附加数据
	 */
	Message(mainWindow, type, data) {
		console.log('发送消息')
		const senddata = {
			state: type,
			msg: data || ''
		}
		mainWindow.webContents.send('update-msg', senddata)
	}

	/**
	 * 执行自动更新检查
	 * @param {BrowserWindow} mainWindow 主窗口
	 */
	checkUpdate(mainWindow) {
		console.log('开始检查')
		this.mainWindow = mainWindow
		// 从 electron-store 读取动态配置的服务器 IP，实现多服务器切换
		const nowIpStr = store.get('nowIpStr') || ''
		if (nowIpStr) {
			const tempPort = nowIpStr === '20.224.44.205' ? '9999' : '8888'
			nowIpUrl = 'http://' + nowIpStr + ':' + tempPort + '/packageUpload'
		}
		autoUpdater.setFeedURL(nowIpUrl)
		autoUpdater.checkForUpdates().catch(err => {
			console.log('网络连接问题', err)
		})
	}

	// 手动下载更新
	handleDownload() {
		autoUpdater.downloadUpdate()
	}

	// 退出并安装
	quitInstall() {
		autoUpdater.quitAndInstall()
	}
}

export default Update
