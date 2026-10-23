/**
 * ============================================================
 * 渲染进程系统信息工具 (systemInfo.js)
 * ============================================================
 * 通过 IPC 与主进程通信获取系统信息（国产化检测结果）。
 * 注意：此文件是「渲染进程侧」的封装，真正的检测逻辑在
 * systemDetect.js（主进程 + 渲染进程共用）。
 * ============================================================
 */

// 操作系统类型（与主进程保持一致）
export const OS_TYPE = {
	WINDOWS: 'windows',
	MACOS: 'macos',
	UOS: 'uos',           // 统信 UOS
	KYLIN: 'kylin',       // 麒麟
	LINUX: 'linux',       // 其他 Linux
	UNKNOWN: 'unknown'
}

// CPU 架构类型
export const CPU_ARCH = {
	X64: 'x64',
	ARM64: 'arm64',
	MIPS64EL: 'mips64el',
	LOONGARCH64: 'loongarch64',
	UNKNOWN: 'unknown'
}

// CPU 品牌
export const CPU_VENDOR = {
	INTEL: 'intel',
	AMD: 'amd',
	HYGON: 'hygon',
	ZHAOXIN: 'zhaoxin',
	KUNPENG: 'kunpeng',
	PHYTIUM: 'phytium',
	LOONGSON: 'loongson',
	UNKNOWN: 'unknown'
}

// 平台标识
export const PLATFORM = {
	WINDOWS: 'windows',
	UOS: 'uos',
	KYLIN: 'kylin',
	LINUX: 'linux',
	MACOS: 'macos',
	UNSUPPORTED: 'unsupported'
}

// 缓存系统信息
let cachedSystemInfo = null

/**
 * 获取系统信息（异步）
 * @returns {Promise<Object>}
 */
export async function getSystemInfo() {
	if (cachedSystemInfo) return cachedSystemInfo

	try {
		const { ipcRenderer } = require('electron')
		const info = await ipcRenderer.invoke('get-system-info')

		if (info) {
			cachedSystemInfo = info
			return info
		}
	} catch (error) {
		console.error('[renderer] Failed to get system info:', error)
	}

	return {
		platform: process.platform,
		arch: process.arch,
		osType: OS_TYPE.UNKNOWN,
		cpuArch: CPU_ARCH.UNKNOWN,
		cpuVendor: CPU_VENDOR.UNKNOWN,
		platformId: 'unknown',
		isDomestic: false,
		domesticInfo: null
	}
}

/**
 * 获取系统信息摘要（同步）
 * @returns {string}
 */
export function getSystemSummary() {
	try {
		const { ipcRenderer } = require('electron')
		return ipcRenderer.sendSync('get-system-summary')
	} catch (error) {
		console.error('[renderer] Failed to get system summary:', error)
		return 'Unknown System'
	}
}

export async function isWindows() {
	const info = await getSystemInfo()
	return info.osType === OS_TYPE.WINDOWS
}
export async function isMacOS() {
	const info = await getSystemInfo()
	return info.osType === OS_TYPE.MACOS
}
export async function isUOS() {
	const info = await getSystemInfo()
	return info.osType === OS_TYPE.UOS
}
export async function isKyunlin() {
	const info = await getSystemInfo()
	return info.osType === OS_TYPE.KYLIN
}
export async function isLinux() {
	const info = await getSystemInfo()
	return [OS_TYPE.LINUX, OS_TYPE.UOS, OS_TYPE.KYLIN].includes(info.osType)
}
export async function isDomesticEnvironment() {
	const info = await getSystemInfo()
	return info.isDomestic === true
}
export async function isARM64() {
	const info = await getSystemInfo()
	return info.cpuArch === CPU_ARCH.ARM64
}
export async function isLoongson() {
	const info = await getSystemInfo()
	return [CPU_ARCH.MIPS64EL, CPU_ARCH.LOONGARCH64].includes(info.cpuArch)
}
export async function isKunpeng() {
	const info = await getSystemInfo()
	return info.cpuVendor === CPU_VENDOR.KUNPENG
}
export async function isPhytium() {
	const info = await getSystemInfo()
	return info.cpuVendor === CPU_VENDOR.PHYTIUM
}
export async function isHygon() {
	const info = await getSystemInfo()
	return info.cpuVendor === CPU_VENDOR.HYGON
}
export async function isZhaoxin() {
	const info = await getSystemInfo()
	return info.cpuVendor === CPU_VENDOR.ZHAOXIN
}

/**
 * 获取下载文件后缀
 * @returns {Promise<string>}
 */
export async function getDownloadExtension() {
	const info = await getSystemInfo()

	switch (info.osType) {
		case OS_TYPE.WINDOWS:
			return 'exe'
		case OS_TYPE.MACOS:
			return 'dmg'
		case OS_TYPE.UOS:
		case OS_TYPE.KYLIN:
		case OS_TYPE.LINUX:
			return 'deb'
		default:
			return 'deb'
	}
}

/**
 * 清除缓存
 */
export function clearCache() {
	cachedSystemInfo = null
}

export default {
	OS_TYPE,
	CPU_ARCH,
	CPU_VENDOR,
	PLATFORM,
	getSystemInfo,
	getSystemSummary,
	isWindows,
	isMacOS,
	isUOS,
	isKyunlin,
	isLinux,
	isDomesticEnvironment,
	isARM64,
	isLoongson,
	isKunpeng,
	isPhytium,
	isHygon,
	isZhaoxin,
	getDownloadExtension,
	clearCache
}
