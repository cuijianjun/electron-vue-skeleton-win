/**
 * ============================================================
 * preload 脚本（预加载脚本）
 * ============================================================
 *
 * 【本项目采用的沙箱方案：关闭上下文隔离】
 * 本项目（参照真实项目）在主窗口 webPreferences 里设置了：
 *   contextIsolation: false   —— 关闭上下文隔离
 *   nodeIntegration: true     —— 渲染进程可直接使用 Node 能力
 *
 * 因此渲染进程可以直接 `require('electron')` 拿到 ipcRenderer，
 * 不需要通过 contextBridge 做白名单桥接。所以这个 preload 文件
 * 只做兼容标记，保持无副作用。
 *
 * 【两种沙箱方案对比（供学习）】
 * 方案 A：contextIsolation: false + nodeIntegration: true（本项目采用）
 *   - 优点：开发简单，渲染进程直接 require，无桥接成本
 *   - 缺点：安全边界弱，页面若被 XSS 注入可触及 Node/主进程
 *   - 适用：内部工具、可信内容、快速迭代的桌面应用
 *
 * 方案 B：contextIsolation: true + contextBridge 白名单（更安全）
 *   - 优点：严格隔离，只暴露白名单函数，防 XSS 提权
 *   - 缺点：每个通道都要显式登记，开发繁琐
 *   - 适用：加载不可信外部内容的场景
 *
 * 若你想切换到方案 B，只需：
 *   1. 把 windowManager.js 里 contextIsolation 改为 true
 *   2. 在本文件用 contextBridge.exposeInMainWorld 暴露白名单 API
 *   3. 渲染进程改用 window.electronAPI 调用
 * ============================================================
 */

// 兼容标记：老版本窗口配置可能需要这个主 preload，
// 保持文件无副作用即可。
window.__MAIN_PRELOAD_COMPAT__ = true
