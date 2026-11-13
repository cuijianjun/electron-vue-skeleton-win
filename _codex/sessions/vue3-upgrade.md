# README 发布/更新/上线指南 — 2026-11-14
目标：两client打包发布、全量/增量和server部署步骤写README后提交GitHub；此轮仅docs，不实际上线。
Client /Users/cjjxw/study/yz/electron-vue-skeleton-win，agent/vue3-upgrade-main，入场979c217 clean；server /Users/cjjxw/study/yz/electron-update-server@09a4704。各repo仅README与既有active card变动，无源码/依赖/版本/配置/密钥改动。
README已完成：固定runtime，正式URL替换、公钥保留，版本/架构/隔离输出，全量包及renderer基线，schema2差异/snapshot，CLI本机发布与server远程上传链接，验收/恢复/备份。
本批验证：3份README的shell/JSON/代码围栏/本地链接/diff-check通过；URL脚本在隔离config验证HTTPS/拒绝HTTP/保留公钥和占位符，server配置迁移及compose插值通过，npm version在scratch同步package+lock通过。server12test+动态client contract2新执行通过；README Nginx模板在临时可信测试CA/TLS代理下，三目标metadata/HEAD/single+multiRange/资源签名与ZIP hash通过；21005字节Range头500片段保序通过。临时Nginx已停止，日常服务未变。Docker只验证compose，未build/run image；未部署公网或执行新目标机安装。
复核修复：固定1.0.0 E2E/packaged限制明确，升版本后改用动态联调+实际目标机验收；新基线按project/platform-arch/runtime/version隔离并保存manifest，原1.0.0旧布局不搬动。公网切换保留原trust，旧localhost客户端需首次新安装/手改公开配置；两发布事务独立。
本机实际deployment：LaunchAgent com.cjjxw.electron-update-server，127.0.0.1:25565；config/keys ~/.config/electron-update-server(原独立Ed25519、私钥禁止Git)，永久包/log/旧基线 ~/.local/share/electron-update-server。三目标1.0.0已发布，同版本无更新正常，不能删除这些data/key或把占位域名写入本地config。
历史client41unit/6e2e/HMR1及3包HTTP验收仍为上批证据；UOS001 T017/T022/T023目标版本/CPU/glibc/session验收未闭。临时新验证/tmp/electron-update-readme-20261114可清理；原VM/其他任务/Codex历史不动。
独立只读review完成，无剩余阻塞；两项文档问题均修复，并采纳专用shell失败即停建议。交付各repo一个docs commit+SSH push既有分支，server main可快进同步；实际hash/远端结果查git log/status/ls-remote。不重写历史；Node24.22.0/npm11.19.1子进程PATH，不改global。
