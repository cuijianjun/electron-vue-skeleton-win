/**
 * ============================================================
 * 菜单配置 (menu.js)
 * ============================================================
 * 定义应用顶部菜单栏和托盘右键菜单。
 * 学习建议：看 menu 数组（顶部菜单）和 trayMenu（托盘菜单）。
 * ============================================================
 */

const { dialog } = require('electron')
const os = require('os')
const version = require('../../../package.json').version

// 顶部应用菜单
const menu = [
	{
		label: '设置',
		submenu: [{
			label: '快速重启',
			accelerator: 'F5',
			role: 'reload'
		}, {
			label: '退出',
			accelerator: 'CmdOrCtrl+F4',
			role: 'close'
		}]
	},
	{
		label: '编辑',
		submenu: [{
			label: '撤销',
			accelerator: 'CmdOrCtrl+Z',
			role: 'undo'
		}, {
			label: '重做',
			accelerator: 'Shift+CmdOrCtrl+Z',
			role: 'redo'
		}, {
			label: '剪切',
			accelerator: 'CmdOrCtrl+X',
			role: 'cut'
		}, {
			label: '复制',
			accelerator: 'CmdOrCtrl+C',
			role: 'copy'
		}, {
			label: '粘贴',
			accelerator: 'CmdOrCtrl+V',
			role: 'paste'
		}]
	},
	{
		label: '帮助',
		submenu: [{
			label: '关于',
			role: 'about',
			click: function () {
				info()
			}
		}]
	}]

// 托盘右键菜单
export const trayMenu = [
	{
		label: '帮助',
		submenu: [{
			label: '关于',
			role: 'about',
			click: function () {
				info()
			}
		}]
	}]

// 关于对话框
function info() {
	dialog.showMessageBox({
		title: '关于',
		type: 'info',
		message: 'electron-Vue框架',
		detail: `版本信息：${version}\n引擎版本：${process.versions.v8}\n当前系统：${os.type()} ${os.arch()} ${os.release()}`,
		noLink: true,
		buttons: ['确定']
	})
}

export default menu
