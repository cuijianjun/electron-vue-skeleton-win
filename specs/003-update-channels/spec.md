# 全量与增量更新闭环

用户要求：两个现有项目的全量、增量更新均可使用，测试后提交GitHub。
全量更新使用已锁定electron-updater，Windows NSIS、Linux DEB，覆盖检查、下载校验、取消、安装失败、真实Windows升级和数据保留。
增量更新仅替换renderer：schema2带签名base版本/实际树hash、完整target文件清单、差异ZIP与完整snapshot回退；只传变化文件，废弃文件按target清单删除。main/preload/Electron/依赖变更必须走全量安装。保留schema1客户端输入兼容。
两条链路在主进程互斥，下载完成和暂存就绪持续占用直至安装/取消；取消不得被迟到响应恢复。重启入口只接受已验证暂存，真实新进程挂载Vue后确认，坏启动自动回退。
安装包携带resources/updates.json（源码config/updates.json）；支持原环境覆盖，但不依赖终端环境才能配置。默认空源不发外部请求；生产源/公钥未提供时不得声称线上发布完成。
UOS具体系统、架构和提权交互仍需目标机验收；真实DebUpdater HTTP/校验/拒绝安装证据与UOS实装分开。
