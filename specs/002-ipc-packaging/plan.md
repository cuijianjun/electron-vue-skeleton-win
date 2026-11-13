# 实施计划

1. 在 src/shared/ipc.mjs 集中有限操作和原生 transport 工厂；薄 preload/main/renderer 适配器；业务 API 和 scope。
2. 异步 bootstrap、配置版本广播与待确认写保护；迁移页面与全部主进程推送。
3. 保留 electron-vite；ASAR、语言/无用调试文件裁剪；现有 scripts/build.cjs 复用构建指纹区分 compile / dir / release。
4. 增量单元验证，再集成/打包/平台回归及独立审查；记录实测，提交推送。

范围：仅当前 skeleton 项目；参考仓库只读；Node24.22.0/npm11.19.1，保留依赖锁、平台图标/钩子、原有安全与 renderer-only 更新。
