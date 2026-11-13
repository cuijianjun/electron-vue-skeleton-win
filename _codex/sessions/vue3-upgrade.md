# 本机更新服务接入 — 2026-11-14
目标：本机统一server支持两项目全量/增量，生成key/config并测试后3repo提交GitHub。
Client /Users/cjjxw/study/yz/electron-vue-skeleton-win，agent/vue3-upgrade-main；入场win285f73f/uosea2f978 clean，原代码基线保留。
Server /Users/cjjxw/study/yz/electron-update-server，agent/update-server-main；空基线9e0b700。已创建GitHub私有cuijianjun/electron-update-server，实际交付回执以git log/远端ref为准；Chrome原生UI创建，SSH推送。
本批client：config/updates.json真实本机URL+本项目独立Ed25519公钥；updateConfig.expandUpdateURL校验并展开arch/platform/runtimeId；full/hot调用接入；server/index无--dir可转发同级统一服务，旧夹具保留；tests显式禁用日常源。无依赖/锁变化。
真实server已LaunchAgent运行127.0.0.1:25565，healthz可用；Win x64、Linux x64/arm64完整和签名renderer1.0.0基线已发布，全部3组实际HTTP full Range/签名ZIP hash已过。版本同当前显示无更新正常。
密钥/配置~/.config/electron-update-server，keys目录700/private600；private不进Git。包、renderer基线与日志~/.local/share/electron-update-server；profile~/Library/LaunchAgents/com.cjjxw.electron-update-server.plist。迁移先恢复keys；不能静默更换已部署client trust。
验证：client各41unit+6e2e通过，HMR/finalbuild已通过，恢复production后所有ASAR字节/公钥/服务runtime一致；server12test+2实际client packer→publish→HTTP→原ResourceController stage/fallback通过。真实GenericDifferentialDownloader大批Range无fallback；坏签名/同版冲突/并发/链接/中断流/隐藏存储目录通过。服务已修正Express absolute sendFile在.local误403（relative basename+显式root）。独立review2个symlink阻塞关闭，新trust guard/403 delta最后复核无阻塞。
本批未重新执行目标Windows/UOS原生安装；上批003的Windows证据是历史，不冒充本批目标认证。UOS系统/CPU/glibc/session仍待001 T017/T022/T023。127.0.0.1仅同机，非公网部署。
输出：源码README、本地release默认包、server specs/001；临时日志与归档/tmp/electron-update-service-20261114，测试归档可清理；永久keys/data不能删。不要动其他任务/参考仓库/Codex历史。
交付：3repo各新增commit+SSH push核对ref；续接时先查实际Git状态再按用户新范围继续。Node24.22.0/npm11.19.1绝对PATH子进程，不改globalNode。VM维持suspended/pause-on。
