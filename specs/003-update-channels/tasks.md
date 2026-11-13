# Tasks

- [x] T001 审计两条旧链路并复现差异包/就绪门禁缺口。
- [x] T002 实现签名差异文件、基线校验、完整snapshot回退及路径/内容安全。
- [x] T003 配置随包、状态恢复、下载取消、安装门禁与通道互斥。
- [x] T004 CLI与真实Electron、DEB provider及Windows实装闭环。
- [x] T005 独立审查、修复、最终文档和包身份检查。

T006 交付事务：本批作为新增commit推送agent/vue3-upgrade-main；实际回执以git log/远端hash为准。原001 UOS T017/T022/T023保持目标机边界。

## 2026-11-14 验证回执

- 两项目各40单元、6项端到端、1项Vite HMR通过；production产物已恢复，所有编译字节与各自安装包ASAR一致。
- E2E包含原有桌面行为、签名snapshot CLI、差异CLI、真实Electron三次IPC触发relaunch（差异生效/坏启动回退/基线不匹配snapshot回退）、HTTP取消与通道互斥、稍后安装UI和真实DebUpdater下载器。
- DebUpdater测试使用原生ElectronHttpExecutor请求真实本地HTTP，损坏sha512被拒绝；仅package-manager命令执行边界注入权限拒绝，确认不退出、不重启、不伪报成功。这不是实际UOS安装证据。
- Windows11 AMD64：新代码A1.0.0→B1.0.1完整NSIS安装、实际更新源503/取消/下载/确认向导、协议、CRC、用户数据保留、完整目录/注册/快捷方式卸载通过1/1（64.878秒）。源来自安装目录resources/updates.json，子进程没有APP_UPDATE_URL，重复检查保留downloaded且阻止资源通道抢占。
- 同一Windows原生环境、实际ASAR exe：差异/损坏传输/HTTP取消/通道互斥/实际三次重启/坏启动回退/完整snapshot回退通过1/1（22.984秒）。源码fixture与实际应用的main/preload/锁摘要一致。
- UOS x64/ARM64 DEB生成；两个resources/package-type均为deb，随包updates.json与源码一致，所有dist字节/元数据与ASAR一致；未执行未知目标UOS的安装/提权/升级验收。
- 独立非实现者审查修复：损坏stage回退last-good、全量重复检查保持就绪、非法JSON配置不阻断启动；额外收紧ZIP解压输出限制。反例先红后绿，复核无阻塞。

原始验证日志集中开发机/tmp/electron-updates-20261114。源码/配置/规格保留，release为可重建默认包，临时签名夹具与原生验证副本清理；生产更新URL和公钥尚未提供，本轮不宣称已部署线上源，也不发布GitHub Release。
