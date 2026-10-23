/**
 * 全局构建/开发配置
 * 该文件被 .electron-vue 下的 webpack 配置与 dev-runner 引用
 */
module.exports = {
  build: {
    // 生产环境是否清除 console
    cleanConsole: false,
    // 热更新包内的配置文件名（热更新服务器上同名目录下的 version.json 会被读取）
    hotPublishConfigName: 'update-config'
  },
  dev: {
    // 是否过滤 Electron 的控制台垃圾日志
    removeElectronJunk: true,
    // dev-runner 日志是否使用中文
    chineseLog: false,
    // 渲染进程 dev-server 起始端口（被占用会自动顺延）
    port: 9080
  },
  // DLL 目录（留空表示不使用）
  DllFolder: '',
  // 是否启用 JSX 支持
  UseJsx: true
}
