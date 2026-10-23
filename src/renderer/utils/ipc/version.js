/**
 * ============================================================
 * 渲染进程版本获取工具 (version.js)
 * ============================================================
 * 通过 IPC 与主进程通信获取安装包版本信息。
 * 主进程侧对应 utils/installVersion.js 的 getInstalledPackageVersion。
 * ============================================================
 */

// 缓存版本信息
let cachedVersion = null
let cachedVersionDetail = null

/**
 * 获取版本号（同步方式）
 * @returns {string} 版本号，如 "1.0.1"
 */
export function getVersion() {
	if (cachedVersion) return cachedVersion

	try {
		const { ipcRenderer } = require('electron')
		const version = ipcRenderer.sendSync('get-version')
		cachedVersion = version
		return version
	} catch (error) {
		console.error('[version] Failed to get version:', error)
		return '0.0.0'
	}
}

/**
 * 获取详细版本信息（异步方式）
 * @returns {Promise<Object>} 版本详细信息
 */
export async function getVersionDetail() {
	if (cachedVersionDetail) return cachedVersionDetail

	try {
		const { ipcRenderer } = require('electron')
		const result = await ipcRenderer.invoke('get-install-version')
		cachedVersionDetail = result
		return result
	} catch (error) {
		console.error('[version] Failed to get version detail:', error)
		return {
			version: '0.0.0',
			source: 'error',
			error: error.message,
			isInstalled: false
		}
	}
}

/**
 * 获取完整安装包版本信息（含系统信息）
 * @returns {Promise<Object>}
 */
export async function getFullVersionInfo() {
	try {
		const { ipcRenderer } = require('electron')

		const [systemInfo, versionInfo] = await Promise.all([
			ipcRenderer.invoke('get-system-info'),
			ipcRenderer.invoke('get-install-version')
		])

		return {
			version: versionInfo.version,
			source: versionInfo.source,
			isInstalled: versionInfo.isInstalled,
			system: {
				osType: systemInfo?.osType,
				osDisplayName: systemInfo?.osDisplayName,
				cpuArch: systemInfo?.cpuArch,
				cpuVendor: systemInfo?.cpuVendor,
				platformId: systemInfo?.platformId,
				isDomestic: systemInfo?.isDomestic
			},
			versionPath: versionInfo.path,
			systemInfo
		}
	} catch (error) {
		console.error('[version] Failed to get full version info:', error)
		return {
			version: '0.0.0',
			error: error.message
		}
	}
}

/**
 * 检查是否为安装包环境（而非开发环境）
 * @returns {Promise<boolean>}
 */
export async function isInstalledPackage() {
	const detail = await getVersionDetail()
	return detail.isInstalled === true
}

/**
 * 获取版本显示字符串
 * @returns {Promise<string>}
 */
export async function getVersionDisplayString() {
	const detail = await getVersionDetail()
	const systemInfo = detail.systemInfo

	if (!detail.isInstalled) {
		return `${detail.version} (开发模式)`
	}

	if (systemInfo?.isDomestic) {
		return `${detail.version} (${systemInfo.osDisplayName})`
	}

	return detail.version
}

/**
 * 获取版本号用于更新检查
 * @param {string} defaultVersion 默认版本号
 * @returns {Promise<string>}
 */
export async function getVersionForUpdate(defaultVersion = '0.0.0') {
	try {
		const detail = await getVersionDetail()
		if (detail.version && detail.version !== '0.0.0') {
			return detail.version
		}
		return defaultVersion
	} catch (error) {
		return defaultVersion
	}
}

/**
 * 清除缓存
 */
export function clearVersionCache() {
	cachedVersion = null
	cachedVersionDetail = null
}

export default {
	getVersion,
	getVersionDetail,
	getFullVersionInfo,
	isInstalledPackage,
	getVersionDisplayString,
	getVersionForUpdate,
	clearVersionCache
}
