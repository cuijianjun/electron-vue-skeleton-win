/**
 * ============================================================
 * 国产化系统与芯片架构检测工具 (systemDetect.js)
 * ============================================================
 * 支持检测：
 *   - 操作系统：Windows、macOS、统信 UOS、麒麟、其他 Linux
 *   - CPU 架构：x64、arm64、mips64el（龙芯）
 *   - 具体芯片：鲲鹏、飞腾、海光、兆芯、龙芯等
 *
 * 这个文件同时被主进程（installVersion.js、ipcMain.js）和
 * 渲染进程（systemInfo.js）使用，是「国产化系统检测」机制的核心。
 * ============================================================
 */

import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

// 操作系统类型
const OS_TYPE = {
	WINDOWS: 'windows',
	MACOS: 'macos',
	UOS: 'uos',           // 统信 UOS
	KYLIN: 'kylin',       // 麒麟
	LINUX: 'linux',       // 其他 Linux
	UNKNOWN: 'unknown'
}

// CPU 架构类型
const CPU_ARCH = {
	X64: 'x64',           // Intel/AMD x86_64，海光、兆芯
	ARM64: 'arm64',       // ARM64，鲲鹏、飞腾
	MIPS64EL: 'mips64el', // 龙芯 LoongArch
	LOONGARCH64: 'loongarch64', // 新版龙芯架构
	UNKNOWN: 'unknown'
}

// CPU 品牌
const CPU_VENDOR = {
	INTEL: 'intel',
	AMD: 'amd',
	HYGON: 'hygon',       // 海光
	ZHAOXIN: 'zhaoxin',   // 兆芯
	KUNPENG: 'kunpeng',   // 鲲鹏（华为）
	PHYTIUM: 'phytium',   // 飞腾
	LOONGSON: 'loongson', // 龙芯
	UNKNOWN: 'unknown'
}

// 缓存检测结果
let cachedSystemInfo = null

/**
 * 获取系统完整信息
 * @returns {Object} 系统信息对象
 */
function getSystemInfo() {
	if (cachedSystemInfo) {
		return cachedSystemInfo
	}

	const info = {
		platform: process.platform,
		arch: process.arch,
		hostname: os.hostname(),

		osType: detectOsType(),
		osVersion: getOsVersion(),
		osDisplayName: getOsDisplayName(),

		cpuArch: detectCpuArch(),
		cpuVendor: detectCpuVendor(),
		cpuModel: getCpuModel(),
		cpuCores: os.cpus().length,

		totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024), // GB
		freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024),   // GB

		platformId: '',
		isDomestic: false,
		domesticInfo: null
	}

	info.platformId = generatePlatformId(info)
	info.isDomestic = isDomesticEnvironment(info)
	if (info.isDomestic) {
		info.domesticInfo = getDomesticInfo(info)
	}

	cachedSystemInfo = info
	return info
}

/**
 * 检测操作系统类型
 * @returns {string} OS_TYPE
 */
function detectOsType() {
	const platform = process.platform

	if (platform === 'win32') return OS_TYPE.WINDOWS
	if (platform === 'darwin') return OS_TYPE.MACOS

	if (platform === 'linux') {
		if (isUosDistribution()) return OS_TYPE.UOS
		if (isKyunlinDistribution()) return OS_TYPE.KYLIN
		return OS_TYPE.LINUX
	}

	return OS_TYPE.UNKNOWN
}

/**
 * 检测是否为统信 UOS 系统（仅 Linux 上执行）
 * @returns {boolean}
 */
function isUosDistribution() {
	if (process.platform !== 'linux') return false

	try {
		if (fs.existsSync('/etc/uos-release')) return true
		if (fs.existsSync('/etc/deepin-version')) return true

		if (fs.existsSync('/etc/os-release')) {
			const content = fs.readFileSync('/etc/os-release', 'utf8').toLowerCase()
			if (content.includes('uos') || content.includes('uniontech') || content.includes('deepin')) {
				return true
			}
		}
		return false
	} catch (error) {
		console.error('[systemDetect] Error detecting UOS distribution:', error.message)
		return false
	}
}

/**
 * 检测是否为麒麟系统（仅 Linux 上执行）
 * @returns {boolean}
 */
function isKyunlinDistribution() {
	if (process.platform !== 'linux') return false

	try {
		if (fs.existsSync('/etc/kylin-release')) return true

		if (fs.existsSync('/etc/os-release')) {
			const content = fs.readFileSync('/etc/os-release', 'utf8').toLowerCase()
			if (content.includes('kylin')) return true
		}
		return false
	} catch (error) {
		console.error('[systemDetect] Error detecting Kylin distribution:', error.message)
		return false
	}
}

/**
 * 检测 CPU 架构类型
 * @returns {string} CPU_ARCH
 */
function detectCpuArch() {
	const arch = process.arch

	switch (arch) {
		case 'x64':
			return CPU_ARCH.X64
		case 'arm64':
			return CPU_ARCH.ARM64
		case 'mips64el':
			return CPU_ARCH.MIPS64EL
		case 'loongarch64':
			return CPU_ARCH.LOONGARCH64
		default:
			return arch || CPU_ARCH.UNKNOWN
	}
}

/**
 * 检测 CPU 品牌
 * @returns {string} CPU_VENDOR
 */
function detectCpuVendor() {
	const arch = detectCpuArch()
	const model = getCpuModel().toLowerCase()

	// 龙芯
	if (arch === CPU_ARCH.MIPS64EL || arch === CPU_ARCH.LOONGARCH64 || model.includes('loongson')) {
		return CPU_VENDOR.LOONGSON
	}

	// ARM 架构：检测鲲鹏还是飞腾
	if (arch === CPU_ARCH.ARM64) {
		if (model.includes('kunpeng') || model.includes('huawei')) return CPU_VENDOR.KUNPENG
		if (model.includes('phytium') || model.includes('ft-') || model.includes('飞腾')) return CPU_VENDOR.PHYTIUM
		return detectArmVendor()
	}

	// x64 架构：检测海光、兆芯、Intel、AMD
	if (arch === CPU_ARCH.X64) {
		if (model.includes('hygon') || model.includes('海光')) return CPU_VENDOR.HYGON
		if (model.includes('zhaoxin') || model.includes('kx-') || model.includes('兆芯')) return CPU_VENDOR.ZHAOXIN
		if (model.includes('amd')) return CPU_VENDOR.AMD
		if (model.includes('intel')) return CPU_VENDOR.INTEL
		return detectX64Vendor()
	}

	return CPU_VENDOR.UNKNOWN
}

/**
 * ARM 架构 CPU 品牌检测（鲲鹏/飞腾，仅 Linux）
 * @returns {string}
 */
function detectArmVendor() {
	if (process.platform !== 'linux') return CPU_VENDOR.UNKNOWN

	try {
		if (fs.existsSync('/proc/cpuinfo')) {
			const cpuinfo = fs.readFileSync('/proc/cpuinfo', 'utf8').toLowerCase()
			if (cpuinfo.includes('kunpeng') || cpuinfo.includes('hx_kunpeng')) return CPU_VENDOR.KUNPENG
			if (cpuinfo.includes('phytium') || cpuinfo.includes('ft-')) return CPU_VENDOR.PHYTIUM
			if (cpuinfo.includes('hisi') || cpuinfo.includes('hi1610')) return CPU_VENDOR.KUNPENG
		}
	} catch (error) {
		console.error('[systemDetect] Error detecting ARM vendor:', error.message)
	}

	return CPU_VENDOR.UNKNOWN
}

/**
 * x64 架构 CPU 品牌检测（海光/兆芯，仅 Linux）
 * @returns {string}
 */
function detectX64Vendor() {
	if (process.platform !== 'linux') return CPU_VENDOR.UNKNOWN

	try {
		if (fs.existsSync('/proc/cpuinfo')) {
			const cpuinfo = fs.readFileSync('/proc/cpuinfo', 'utf8').toLowerCase()
			if (cpuinfo.includes('hygon') || cpuinfo.includes('dhyana')) return CPU_VENDOR.HYGON
			if (cpuinfo.includes('zhaoxin') || cpuinfo.includes('kx-') || cpuinfo.includes('centaur')) return CPU_VENDOR.ZHAOXIN
		}
	} catch (error) {
		console.error('[systemDetect] Error detecting x64 vendor:', error.message)
	}

	return CPU_VENDOR.UNKNOWN
}

/**
 * 获取 CPU 型号字符串
 * @returns {string}
 */
function getCpuModel() {
	try {
		const cpus = os.cpus()
		if (cpus && cpus.length > 0 && cpus[0].model) {
			return cpus[0].model
		}
	} catch (error) {
		console.error('[systemDetect] Error getting CPU model:', error.message)
	}
	return 'Unknown'
}

/**
 * 获取操作系统版本
 * @returns {string}
 */
function getOsVersion() {
	try {
		if (process.platform === 'linux' && fs.existsSync('/etc/os-release')) {
			const content = fs.readFileSync('/etc/os-release', 'utf8')
			const versionMatch = content.match(/VERSION_ID="?([^"\n]+)"?/i)
			if (versionMatch) return versionMatch[1]
		}
		return os.release()
	} catch (error) {
		console.error('[systemDetect] Error getting OS version:', error.message)
		return os.release()
	}
}

/**
 * 获取操作系统显示名称
 * @returns {string}
 */
function getOsDisplayName() {
	const osType = detectOsType()
	const arch = detectCpuArch()
	const vendor = detectCpuVendor()

	switch (osType) {
		case OS_TYPE.WINDOWS:
			return 'Windows'
		case OS_TYPE.MACOS:
			return 'macOS'
		case OS_TYPE.UOS:
			return `统信UOS (${getVendorDisplayName(vendor)} ${arch})`
		case OS_TYPE.KYLIN:
			return `银河麒麟 (${getVendorDisplayName(vendor)} ${arch})`
		case OS_TYPE.LINUX:
			return `Linux (${getVendorDisplayName(vendor)} ${arch})`
		default:
			return 'Unknown'
	}
}

/**
 * 获取 CPU 品牌显示名称
 * @param {string} vendor
 * @returns {string}
 */
function getVendorDisplayName(vendor) {
	const names = {
		[CPU_VENDOR.INTEL]: 'Intel',
		[CPU_VENDOR.AMD]: 'AMD',
		[CPU_VENDOR.HYGON]: '海光',
		[CPU_VENDOR.ZHAOXIN]: '兆芯',
		[CPU_VENDOR.KUNPENG]: '鲲鹏',
		[CPU_VENDOR.PHYTIUM]: '飞腾',
		[CPU_VENDOR.LOONGSON]: '龙芯',
		[CPU_VENDOR.UNKNOWN]: '未知'
	}
	return names[vendor] || vendor
}

/**
 * 生成平台标识（用于下载对应版本）
 * @param {Object} info
 * @returns {string}
 */
function generatePlatformId(info) {
	const { osType, cpuArch, cpuVendor } = info

	if (osType === OS_TYPE.WINDOWS) return `win-${cpuArch}`
	if (osType === OS_TYPE.MACOS) return `mac-${cpuArch}`

	if (osType === OS_TYPE.UOS) {
		if (cpuArch === CPU_ARCH.ARM64) {
			if (cpuVendor === CPU_VENDOR.KUNPENG) return 'uos-arm64-kunpeng'
			if (cpuVendor === CPU_VENDOR.PHYTIUM) return 'uos-arm64-phytium'
			return 'uos-arm64'
		}
		if (cpuArch === CPU_ARCH.X64) {
			if (cpuVendor === CPU_VENDOR.HYGON) return 'uos-x64-hygon'
			if (cpuVendor === CPU_VENDOR.ZHAOXIN) return 'uos-x64-zhaoxin'
			return 'uos-x64'
		}
		if (cpuArch === CPU_ARCH.MIPS64EL || cpuArch === CPU_ARCH.LOONGARCH64) return 'uos-mips64el'
		return 'uos'
	}

	if (osType === OS_TYPE.KYLIN) {
		if (cpuArch === CPU_ARCH.ARM64) {
			if (cpuVendor === CPU_VENDOR.KUNPENG) return 'kylin-arm64-kunpeng'
			if (cpuVendor === CPU_VENDOR.PHYTIUM) return 'kylin-arm64-phytium'
			return 'kylin-arm64'
		}
		if (cpuArch === CPU_ARCH.X64) return 'kylin-x64'
		if (cpuArch === CPU_ARCH.MIPS64EL || cpuArch === CPU_ARCH.LOONGARCH64) return 'kylin-mips64el'
		return 'kylin'
	}

	if (osType === OS_TYPE.LINUX) return `linux-${cpuArch}`

	return 'unknown'
}

/**
 * 判断是否为国产化环境
 * @param {Object} info
 * @returns {boolean}
 */
function isDomesticEnvironment(info) {
	const { osType, cpuVendor } = info

	if (osType === OS_TYPE.UOS || osType === OS_TYPE.KYLIN) return true

	const domesticVendors = [
		CPU_VENDOR.HYGON,
		CPU_VENDOR.ZHAOXIN,
		CPU_VENDOR.KUNPENG,
		CPU_VENDOR.PHYTIUM,
		CPU_VENDOR.LOONGSON
	]

	return domesticVendors.includes(cpuVendor)
}

/**
 * 获取国产化环境详细信息
 * @param {Object} info
 * @returns {Object|null}
 */
function getDomesticInfo(info) {
	const { osType, cpuArch, cpuVendor, osVersion } = info

	return {
		osName: osType === OS_TYPE.UOS ? '统信UOS' :
			osType === OS_TYPE.KYLIN ? '银河麒麟' : 'Linux',
		cpuName: getVendorDisplayName(cpuVendor),
		cpuArch: cpuArch,
		description: `${osType === OS_TYPE.UOS ? '统信UOS' : '银河麒麟'} + ${getVendorDisplayName(cpuVendor)} (${cpuArch})`,
		needsSpecialHandling: cpuArch === CPU_ARCH.MIPS64EL || cpuArch === CPU_ARCH.LOONGARCH64
	}
}

/**
 * 获取 SELinux 状态（仅 Linux）
 * @returns {string}
 */
function getSelinuxStatus() {
	if (process.platform !== 'linux') return 'N/A'

	try {
		const result = execSync('getenforce 2>/dev/null || echo "UNKNOWN"', {
			encoding: 'utf8',
			timeout: 5000
		})
		return result.trim()
	} catch (error) {
		console.error('[systemDetect] Error getting SELinux status:', error.message)
		return 'UNKNOWN'
	}
}

/**
 * 初始化验证函数
 * @returns {Object} 验证结果
 */
function validateSystemDetect() {
	const result = {
		success: true,
		platform: process.platform,
		arch: process.arch,
		errors: []
	}

	try {
		const info = getSystemInfo()
		if (!info.osType) result.errors.push('osType is empty')
		if (!info.cpuArch) result.errors.push('cpuArch is empty')
		if (!info.platformId) result.errors.push('platformId is empty')

		console.log('[systemDetect] Validation result:', {
			osType: info.osType,
			osDisplayName: info.osDisplayName,
			cpuArch: info.cpuArch,
			cpuVendor: info.cpuVendor,
			platformId: info.platformId,
			isDomestic: info.isDomestic
		})

		if (result.errors.length > 0) result.success = false
	} catch (error) {
		result.success = false
		result.errors.push(error.message)
		console.error('[systemDetect] Validation failed:', error)
	}

	return result
}

/**
 * 获取系统信息摘要字符串
 * @returns {string}
 */
function getSystemSummary() {
	const info = getSystemInfo()
	const lines = [
		`操作系统: ${info.osDisplayName}`,
		`系统类型: ${info.osType}`,
		`系统版本: ${info.osVersion}`,
		`CPU架构: ${info.cpuArch}`,
		`CPU品牌: ${info.cpuModel}`,
		`CPU核心: ${info.cpuCores}核`,
		`内存: ${info.totalMemory}GB`,
		`平台标识: ${info.platformId}`,
		`国产化: ${info.isDomestic ? '是' : '否'}`
	]

	if (info.isDomestic && info.domesticInfo) {
		lines.push(`详细: ${info.domesticInfo.description}`)
	}

	return lines.join('\n')
}

export {
	OS_TYPE,
	CPU_ARCH,
	CPU_VENDOR,

	getSystemInfo,
	getSystemSummary,
	validateSystemDetect,

	detectOsType,
	detectCpuArch,
	detectCpuVendor,
	isUosDistribution,
	isKyunlinDistribution,
	isDomesticEnvironment,

	getOsVersion,
	getOsDisplayName,
	getCpuModel,
	getSelinuxStatus,
	generatePlatformId
}
