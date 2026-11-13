# Vue 3 / Vite + 集中通信与打包优化

目标：在原仓库升级Vue3/Vite后，应用共享会话方案，集中主/预加载/渲染通信，优化打包，新增一次提交并推送已有GitHub分支。
项目：/Users/cjjxw/study/yz/electron-vue-skeleton-win
分支：agent/vue3-upgrade-main。原始代码及上一轮迁移提交保留；本轮提交标题 `perf: centralize IPC and optimize desktop packaging`。交付版本/推送状态以git log和origin同名分支为准，不合并main、不发布Release。

完成：src/shared/ipc.mjs统一有限transport/业务API/异步bootstrap缓存、revision确认与scope订阅；移除native同步IPC。ASAR、minify、语言裁剪、生产输入/输出指纹复用；默认快速Win3/UOS XZ2和可选紧凑Win9/UOS XZ3。没有新增依赖或改锁文件。
验收：每项目30单元+1构建CLI；真实Electron4/HMR1/test模式启动1；macOS ASAR启动/签名renderer重启回退2。Windows11 AMD64原生离线ci/build/unit/Electron/HMR、真实ASAR/热更新通过。旧1.0.0散文件→快速档1.0.1 ASAR全量更新、503/取消/确认向导/协议/CRC/存储/卸载通过1/1（108.892秒）。测试按NSIS文档复制卸载器到安装目录外+_?=等待实际actor，避免把launcher退出当卸载完成；产品检测未改。独立非实现者审查无阻塞。

单次同机样本：Win安装包46.912→34.328秒、117.04→115.34MiB，展开373.04→324.65MiB；UOS arm64 25.380→16.651秒、91.73→90.84MiB；x64 21.420→16.544秒、96.34→95.46MiB。紧凑Win106.94MiB/UOS x64 93.94MiB。详见specs/002-ipc-packaging/research.md，不套用参考项目数字。
输入：共享会话cx_6af72702baa88191a34c90f0b008f540；uosapp-1023与vueapp-0629只读未改。输出：本仓库源码/specs/002；本地release为最终默认包，可重建且不入Git。验证材料集中/tmp/electron-transport-optimization-20261113，可清理；不要删除其他会话临时目录或Codex历史。
运行：PATH=/Users/cjjxw/.nvm/versions/node/v24.22.0/bin:$PATH；npm run test:unit/build:app/test:e2e/test:dev，pack:release -- --arch对应目标。不要复制异平台node_modules。
边界：原001 UOS版本/CPU/glibc/桌面会话及T017/T022/T023须真机；Win10、代码签名和生产feed未验收。GitHub SSH授权已给，不重复询问。后续若继续：先看Git状态及本卡，按用户新范围执行，保留基线和现有改动。
