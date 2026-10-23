/**
 * ============================================================
 * 安装包版本获取工具 (installVersion.js)
 * ============================================================
 * 支持场景：
 *   1. Windows 安装后：从安装目录读取 package.json
 *   2. 统信 UOS / 麒麟安装后：从 /opt/<app> 目录读取 package.json
 *   3. 开发环境：从项目根目录读取
 *   4. 热更新后：优先读取热更新元数据
 *
 * 版本来源优先级（从高到低）：
 *   1. 热更新元数据 (.hot-update-meta.json)
 *   2. 应用安装目录的 package.json
 *   3. Electron app.getVersion()
 *   4. 默认版本 0.0.0
 *
 * 这是「国产化系统检测 + 版本识别」机制的核心，配合 systemDetect.js 使用。
 * ============================================================
 */

import fs from 'fs'
import { join, resolve } from 'path'
import { app } from 'electron'
import { getSystemInfo, OS_TYPE } from '../../renderer/utils/ipc/systemDetect'

const FALLBACK_VERSION = '0.0.0'
const HOT_UPDATE_META_FILENAME = '.hot-update-meta.json'

/**
 * 获取安装包版本（安装后调用）
 * 根据系统类型自动选择正确的路径策略
 * @returns {Object} 版本信息对象 { version, source, path, isInstalled, systemInfo }
 */
export function getInstalledPackageVersion() {
	const systemInfo = getSystemInfo()
	const isInstalled = checkIsInstalledPackage(systemInfo)

	console.log('[install-version] Getting installed package version', {
		osType: systemInfo.osType,
		platformId: systemInfo.platformId,
		isInstalled
	})

	// 1. 首先尝试热更新元数据（优先级最高）
	const hotUpdateVersion = getHotUpdateVersion(systemInfo)
	if (hotUpdateVersion) {
		return {
			version: hotUpdateVersion,
			source: 'hot-update-meta',
			path: getHotUpdateMetaPath(systemInfo),
			isInstalled,
			systemInfo
		}
	}

	// 2. 根据系统类型获取安装目录版本
	const installVersion = getInstallDirectoryVersion(systemInfo)
	if (installVersion) {
		return {
			version: installVersion.version,
			source: installVersion.source,
			path: installVersion.path,
			isInstalled,
			systemInfo
		}
	}

	// 3. 尝试 Electron app.getVersion()
	const appVersion = getElectronAppVersion()
	if (appVersion && appVersion !== FALLBACK_VERSION) {
		return {
			version: appVersion,
			source: 'electron-app',
			path: 'app.getVersion()',
			isInstalled,
			systemInfo
		}
	}

	// 4. 默认版本
	return {
		version: FALLBACK_VERSION,
		source: 'fallback',
		path: null,
		isInstalled,
		systemInfo
	}
}

/**
 * 检测当前是否在安装包环境中（而非开发环境）
 * @param {Object} systemInfo
 * @returns {boolean}
 */
function checkIsInstalledPackage(systemInfo) {
	try {
		const appPath = app.getAppPath()

		// Windows：检查是否在 Program Files 或用户 AppData 目录
		if (systemInfo.osType === OS_TYPE.WINDOWS) {
			const isProgramFiles = appPath.includes('Program Files') ||
				appPath.includes('Program Files (x86)')
			const isAppData = appPath.includes('AppData')
			return isProgramFiles || isAppData
		}

		// Linux / 统信 UOS / 麒麟：检查是否在 /opt 目录
		if (systemInfo.osType === OS_TYPE.UOS ||
			systemInfo.osType === OS_TYPE.KYLIN ||
			systemInfo.osType === OS_TYPE.LINUX) {
			return appPath.startsWith('/opt/')
		}

		// macOS：检查是否在 Applications 目录
		if (systemInfo.osType === OS_TYPE.MACOS) {
			return appPath.startsWith('/Applications/')
		}

		// 开发环境特征：路径含 node_modules 或 dist/electron 等
		if (appPath.includes('node_modules') ||
			appPath.includes('.electron-vue') ||
			appPath.includes('dist/electron')) {
			return false
		}

		return true
	} catch (error) {
		console.warn('[install-version] Error checking install status:', error.message)
		return false
	}
}

/**
 * 获取热更新版本
 * @param {Object} systemInfo
 * @returns {string|null}
 */
function getHotUpdateVersion(systemInfo) {
	try {
		const metaPath = getHotUpdateMetaPath(systemInfo)
		if (!metaPath || !fs.existsSync(metaPath)) {
			return null
		}

		const metaRaw = fs.readFileSync(metaPath, 'utf-8')
		const meta = JSON.parse(metaRaw)

		if (meta && meta.version && meta.version !== FALLBACK_VERSION) {
			return meta.version
		}
	} catch (error) {
		console.warn('[install-version] Error reading hot-update metadata:', error.message)
	}
	return null
}

/**
 * 获取热更新元数据文件路径
 * @param {Object} systemInfo
 * @returns {string|null}
 */
function getHotUpdateMetaPath(systemInfo) {
	try {
		const appPath = app.getAppPath()

		// Windows: resources/app/.hot-update-meta.json
		if (systemInfo.osType === OS_TYPE.WINDOWS) {
			const resourcesDir = appPath.includes('.asar')
				? resolve(appPath, '..')
				: resolve(appPath, '..', '..')
			return join(resourcesDir, 'app', HOT_UPDATE_META_FILENAME)
		}

		// Linux / macOS: resources/app/.hot-update-meta.json
		const resourcesDir = resolve(appPath, '..')
		return join(resourcesDir, 'app', HOT_UPDATE_META_FILENAME)
	} catch (error) {
		console.warn('[install-version] Error resolving hot-update meta path:', error.message)
	}
	return null
}

/**
 * 根据系统类型获取安装目录版本
 * @param {Object} systemInfo
 * @returns {Object|null}
 */
function getInstallDirectoryVersion(systemInfo) {
	switch (systemInfo.osType) {
		case OS_TYPE.WINDOWS:
			return getWindowsInstallVersion()
		case OS_TYPE.UOS:
		case OS_TYPE.KYLIN:
		case OS_TYPE.LINUX:
			return getLinuxInstallVersion()
		case OS_TYPE.MACOS:
			return getMacOSInstallVersion()
		default:
			return getGenericInstallVersion()
	}
}

/**
 * 获取 Windows 安装版本
 * 路径示例：
 *   - C:\Program Files\<app>\resources\app.asar
 *   - C:\Users\<name>\AppData\Local\<app>\app-1.0.1\resources\app.asar
 */
function getWindowsInstallVersion() {
	try {
		const appPath = app.getAppPath()

		// 策略1: resources/app/package.json（热更新后的情况）
		const resourcesDir = appPath.includes('.asar')
			? resolve(appPath, '..')
			: resolve(appPath, '..', '..')

		const hotUpdatePackagePath = join(resourcesDir, 'app', 'package.json')
		if (fs.existsSync(hotUpdatePackagePath)) {
			const version = readVersionFromPackageJson(hotUpdatePackagePath)
			if (version) {
				return { version, source: 'windows-hot-update', path: hotUpdatePackagePath }
			}
		}

		// 策略2: app.asar 内的 package.json
		if (appPath.includes('.asar')) {
			try {
				const asarPackagePath = join(appPath, 'package.json')
				const version = readVersionFromPackageJson(asarPackagePath)
				if (version) {
					return { version, source: 'windows-asar', path: appPath }
				}
			} catch (asarError) {
				console.debug('[install-version] ASAR read failed:', asarError.message)
			}
		}

		// 策略3: 安装目录的 package.json
		const installDir = resolve(appPath, '..', '..')
		const installPackagePath = join(installDir, 'package.json')
		if (fs.existsSync(installPackagePath)) {
			const version = readVersionFromPackageJson(installPackagePath)
			if (version) {
				return { version, source: 'windows-install-dir', path: installPackagePath }
			}
		}
	} catch (error) {
		console.warn('[install-version] Error getting Windows install version:', error.message)
	}
	return null
}

/**
 * 获取 Linux / 统信 UOS / 麒麟安装版本
 * 路径示例：
 *   - /opt/<app>/resources/app.asar
 *   - /opt/<app>/resources/app/
 */
function getLinuxInstallVersion() {
	try {
		const appPath = app.getAppPath()

		// 策略1: 热更新目录 /opt/<app>/resources/app/package.json
		const hotUpdatePath = join(appPath, '..', 'app', 'package.json')
		if (fs.existsSync(hotUpdatePath)) {
			const version = readVersionFromPackageJson(hotUpdatePath)
			if (version) {
				return { version, source: 'linux-hot-update', path: hotUpdatePath }
			}
		}

		// 策略2: app.asar 内
		if (appPath.includes('.asar')) {
			try {
				const asarPackagePath = join(appPath, 'package.json')
				const version = readVersionFromPackageJson(asarPackagePath)
				if (version) {
					return { version, source: 'linux-asar', path: appPath }
				}
			} catch (asarError) {
				console.debug('[install-version] ASAR read failed:', asarError.message)
			}
		}

		// 策略3: 安装目录的 package.json（开发模式或未打包）
		const installPackagePath = join(appPath, 'package.json')
		if (fs.existsSync(installPackagePath)) {
			const version = readVersionFromPackageJson(installPackagePath)
			if (version) {
				return { version, source: 'linux-app-dir', path: installPackagePath }
			}
		}
	} catch (error) {
		console.warn('[install-version] Error getting Linux install version:', error.message)
	}
	return null
}

/**
 * 获取 macOS 安装版本
 * 路径示例：/Applications/<app>.app/Contents/Resources/app.asar
 */
function getMacOSInstallVersion() {
	try {
		const appPath = app.getAppPath()

		// 策略1: 热更新目录
		const hotUpdatePath = join(appPath, '..', 'app', 'package.json')
		if (fs.existsSync(hotUpdatePath)) {
			const version = readVersionFromPackageJson(hotUpdatePath)
			if (version) {
				return { version, source: 'macos-hot-update', path: hotUpdatePath }
			}
		}

		// 策略2: app.asar 内
		if (appPath.includes('.asar')) {
			const asarPackagePath = join(appPath, 'package.json')
			const version = readVersionFromPackageJson(asarPackagePath)
			if (version) {
				return { version, source: 'macos-asar', path: appPath }
			}
		}
	} catch (error) {
		console.warn('[install-version] Error getting macOS install version:', error.message)
	}
	return null
}

/**
 * 通用安装版本获取（备用）
 */
function getGenericInstallVersion() {
	try {
		const appPath = app.getAppPath()
		const packagePath = join(appPath, 'package.json')

		if (fs.existsSync(packagePath)) {
			const version = readVersionFromPackageJson(packagePath)
			if (version) {
				return { version, source: 'generic', path: packagePath }
			}
		}
	} catch (error) {
		console.warn('[install-version] Error getting generic install version:', error.message)
	}
	return null
}

/**
 * 从 package.json 读取版本号
 * @param {string} packageJsonPath
 * @returns {string|null}
 */
function readVersionFromPackageJson(packageJsonPath) {
	try {
		// 清除 require 缓存，确保读取最新版本
		if (require.cache[packageJsonPath]) {
			delete require.cache[packageJsonPath]
		}

		const packageData = require(packageJsonPath)
		if (packageData && packageData.version && packageData.version !== FALLBACK_VERSION) {
			return packageData.version
		}
	} catch (error) {
		console.debug('[install-version] Failed to read package.json:', packageJsonPath, error.message)
	}
	return null
}

/**
 * 获取 Electron App 版本
 * @returns {string|null}
 */
function getElectronAppVersion() {
	try {
		const version = app.getVersion()
		if (version && version !== FALLBACK_VERSION) {
			return version
		}
	} catch (error) {
		console.warn('[install-version] Error getting Electron app version:', error.message)
	}
	return null
}

/**
 * 获取版本字符串（简化调用）
 * @returns {string}
 */
export function getVersion() {
	const result = getInstalledPackageVersion()
	return result.version
}

/**
 * 获取详细版本信息
 * @returns {Object}
 */
export function getVersionDetail() {
	return getInstalledPackageVersion()
}

/**
 * 检查是否需要更新（版本号比较）
 * @param {string} currentVersion 当前版本
 * @param {string} targetVersion 目标版本
 * @returns {boolean}
 */
export function needUpdate(currentVersion, targetVersion) {
	try {
		const currentParts = currentVersion.split('.').map(Number)
		const targetParts = targetVersion.split('.').map(Number)

		const maxLength = Math.max(currentParts.length, targetParts.length)

		for (let i = 0; i < maxLength; i++) {
			const current = currentParts[i] || 0
			const target = targetParts[i] || 0

			if (target > current) return true
			if (target < current) return false
		}

		return false
	} catch (error) {
		console.warn('[install-version] Error comparing versions:', error.message)
		return false
	}
}

export default {
	getInstalledPackageVersion,
	getVersion,
	getVersionDetail,
	needUpdate
}
