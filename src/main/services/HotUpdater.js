/**
 * ============================================================
 * 热更新 (HotUpdater.js)
 * ============================================================
 * 热更新 = 只更新应用的 dist 资源（前端代码），不重新安装。
 * 相比全量更新更轻量、更快，适合高频发版。
 *
 * 完整链路：
 *   1. 请求 <configName>.json 描述文件，拿到最新 version / 下载名 / sha256
 *   2. 用 semver 的 gt() 比较版本，判断是否需要更新
 *   3. 清空 update 目录 → 流式下载 zip → 用 createHmac 做 sha256 校验
 *   4. extract-zip 解压 → 移除旧的 dist/package.json → 复制新文件覆盖
 *   5. 通知渲染进程重启（confirm-hot-update → app.relaunch）
 *
 * 状态机（status 字段）：init → update-available → downloading
 *                       → moving → finished / failed
 * ============================================================
 */

import { emptyDir, createWriteStream, readFile, copy, remove } from 'fs-extra'
import { join, resolve } from 'path'
import { promisify } from 'util'
import { pipeline } from 'stream'
import { app, ipcMain } from 'electron'
import { gt } from 'semver'
import { createHmac } from 'crypto'
import extract from 'extract-zip'
import { version } from '../../../package.json'
import { hotPublishConfig } from '../config/hotPublish'
import axios from 'axios'
const Store = require('electron-store')
const store = new Store()

const streamPipeline = promisify(pipeline)
const appPath = app.getAppPath()
// 热更新文件存放目录（app 同级 ../update）
const updatePath = resolve(appPath, '..', '..', 'update')
const request = axios.create()

/**
 * 计算文件的 HMAC 哈希值（用于完整性校验）
 * @param {Buffer} data 文件数据
 * @param {string} type 算法类型，默认 sha256
 * @param {string} key  密钥
 * @returns {string} 十六进制哈希字符串
 */
function hash(data, type = 'sha256', key = 'Sky') {
	const hmac = createHmac(type, key)
	hmac.update(data)
	return hmac.digest('hex')
}

/**
 * 流式下载文件（避免大文件一次性读入内存）
 * @param {string} url      下载地址
 * @param {string} filePath 保存路径
 */
async function download(url, filePath) {
	const res = await request({ url, responseType: 'stream' })
	await streamPipeline(res.data, createWriteStream(filePath))
}

// 热更新状态（会推送给渲染进程）
const updateInfo = {
	status: 'init',
	message: ''
}

/**
 * 执行热更新检查与下载
 * @param {BrowserWindow} windows 主窗口（用于回传状态）
 */
export const updater = async (windows) => {
	try {
		const nowIpStr = store.get('nowIpStr') || ''
		let nowIpUrl = 'http://127.0.0.1:8888/packageUpload'
		if (nowIpStr) {
			const tempPort = nowIpStr === '20.224.44.205' ? '9999' : '8888'
			nowIpUrl = 'http://' + nowIpStr + ':' + tempPort + '/packageUpload'
		}

		// 1. 拉取描述文件（带时间戳防缓存）
		const configUrl = `${nowIpUrl}/${hotPublishConfig.configName}.json?time=${new Date().getTime()}`
		console.log('url=======', configUrl)
		const res = await request({ url: configUrl })

		// 2. 版本比较：服务器版本 > 本地版本才更新
		if (gt(res.data.version, version)) {
			updateInfo.status = 'update-available'
			if (windows) windows.webContents.send('hot-update-status', updateInfo)

			// 注册下载逻辑（渲染进程触发 start-hot-update 时执行）
			ipcMain.handle('start-hot-update', async () => {
				await emptyDir(updatePath)
				const filePath = join(updatePath, res.data.name)

				updateInfo.status = 'downloading'
				if (windows) windows.webContents.send('hot-update-status', updateInfo)

				// 3. 下载 zip 包
				await download(`${nowIpUrl}/${res.data.name}`, filePath)

				// 4. sha256 完整性校验
				const buffer = await readFile(filePath)
				const sha256 = hash(buffer)
				if (sha256 !== res.data.hash) throw new Error('sha256 error')

				// 5. 解压到临时目录
				const appPathTemp = join(updatePath, 'temp')
				await extract(filePath, { dir: appPathTemp })

				updateInfo.status = 'moving'
				if (windows) windows.webContents.send('hot-update-status', updateInfo)

				// 6. 移除旧资源，复制新资源覆盖
				await remove(join(`${appPath}`, 'dist'))
				await remove(join(`${appPath}`, 'package.json'))
				await copy(appPathTemp, appPath)

				updateInfo.status = 'finished'
				if (windows) windows.webContents.send('hot-update-status', updateInfo)
			})
		}
	} catch (error) {
		updateInfo.status = 'failed'
		updateInfo.message = error
		if (windows) windows.webContents.send('hot-update-status', updateInfo)
	}
}

// 获取当前热更新状态
export const getUpdateInfo = () => updateInfo
