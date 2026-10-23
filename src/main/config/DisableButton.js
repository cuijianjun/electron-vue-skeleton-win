/**
 * ============================================================
 * 禁用 F12 (DisableButton.js)
 * ============================================================
 * 生产环境下（且 DisableF12=true）注册 F12 全局快捷键，
 * 拦截用户打开开发者控制台。
 * ============================================================
 */

import { globalShortcut } from 'electron'
import { DisableF12 } from './const'

export default {
	Disablef12() {
		if (process.env.NODE_ENV === 'production' && DisableF12) {
			globalShortcut.register('f12', () => {
				console.log('用户试图启动控制台')
			})
		}
	}
}
