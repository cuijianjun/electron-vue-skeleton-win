# 实施计划

沿用现有Vue3/Vite/共享IPC、controllers、pack-resources和本地更新服务，不新增依赖或另一套更新框架。
1. 以真实文件与签名夹具复现schema2/安装门禁缺口；扩展resourceUpdates与既有controller。
2. 增加随包公开配置，IPC状态/取消及主进程互斥；界面恢复下载就绪状态。
3. 扩展既有pack:resources为可选--base-dir/--base-version；先上传内容寻址归档，清单最后切换。
4. 单元与真实Electron执行差异、取消、三次实际relaunch、首次启动回退、snapshot回退；真实DebUpdater使用原生ElectronHttpExecutor验证下载hash和提权拒绝，命令边界隔离。
5. 生成Windows新实现A1.0.0/B1.0.1，原生安装/升级/协议/数据/卸载；生成x64/arm64 DEB并检查package-type，UOS真机继续待外部条件。
6. 独立审查、更新原续接卡和README，每仓库一个新增commit推送原分支；不改写基线、不发布Release或生产源。

验证临时材料集中/tmp/electron-updates-20261114，完成后清理重建夹具，保留紧凑日志。使用Node24.22.0/npm11.19.1；跨OS不复制node_modules。
