# 全量/增量更新交付 — 2026-11-14

目标：两个已有Vue3/Vite骨架的全量+真实renderer差异更新闭环，验证后各新增一次commit推送已有GitHub分支。
项目：/Users/cjjxw/study/yz/electron-vue-skeleton-win；branch agent/vue3-upgrade-main。前次win8cdd58a/uos599f18d及原代码基线保留；本批标题 `feat: complete full and incremental update channels`。最终提交/推送回执以git log、origin同名分支hash为准；不合并main、不发布Release。

实现：full保留NSIS/DEB updater；schema2签名绑定实际base/tree hash、完整目标文件清单、差异ZIP和snapshot回退，v1兼容。变更文件下载/删除目标文件/内容校验、Abort取消与迟到防护、暂存重启门禁、坏启动/坏stage回退last-good、全量与资源通道互斥。配置config/updates.json随extraResources到resources/updates.json；支持原环境覆盖，更新状态供UI恢复就绪安装。公钥配置修改后重启。
验证：两项目各40单元+6 e2e+HMR1。E2E真实IPC三次relaunch、差异/坏启动rollback/snapshot fallback、HTTP取消/互斥、CLI2与DEB原生Electron下载hash/权限拒绝。Windows11 AMD64真实全量A1.0.0→B1.0.1（64.878s）+实际ASAR资源差异三重启（22.984s）通过；全量源直接从安装目录文件读取，无APP_UPDATE_URL。UOS双架构DEB的marker=deb/配置/全部编译字节校验通过。独立review三个blocking与解压限制均修复复核，无遗留代码阻塞。无新依赖，锁未变。

输出：源码、README、specs/003-update-channels（详细验收），本地release为最终默认包可重建、不进Git。日志/tmp/electron-updates-20261114可清理；测试私钥、native中转和重建夹具完成后清理。Windows VM恢复suspended/pause-idle on（以当前实况为准）。历史/tmp/electron-transport-optimization-20261113与其他任务不要删除。
运行：PATH=/Users/cjjxw/.nvm/versions/node/v24.22.0/bin:$PATH；npm run test:unit/build:app/test:e2e/test:dev；pack:resources --base-dir/--base-version；更新配置在README。全局Node不改，跨OS不复制node_modules。
边界：生产URL/公钥未提供，默认空源禁用；本地HTTP通过不等于已部署线上源。UOS版本/CPU/glibc/session用户明确延后，001 T017/T022/T023保留待真机；Deb权限命令被隔离，不能称UOS实装。旧客户端先全量升级支持schema2再切差异源。继续时先看Git状态与本卡，已授权commit/SSH push不重复问；不得覆盖其他仓库/参考项目/用户改动。
