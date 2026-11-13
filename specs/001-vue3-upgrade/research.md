# Research and decisions — 2026-11-13
## Observed baseline
Repository /Users/cjjxw/study/yz/electron-vue-skeleton-win, main@fa1c9716b49d48d6fd597fb6101443ed0af76c7c, initially clean; Vue2.7, Router3, Vuex3, Electron21, webpack5, builder22; no lockfile or Node pin. Five Vue SFCs.
Known gaps: renderer imports Electron/Node/store and main config; get-version invoke has only an on handler; Vue2 destroy hooks; missing configured packaging icons. UOS has install/remove shell hooks, default ARM64. Claims in old README are not test evidence.
## Decision
User explicitly selected Vite. Use electron-vite + Vue3 + Router4 + Vuex4, JavaScript and CJS main/preload. Do not keep webpack or introduce TypeScript/Pinia. Adopt finite contextBridge functions because electron-vite renderer does not support Node integration.
Main/preload/renderer live below dist/electron in separate directories, update package.main/window/static/resource paths together. Single build clean is limited to generated dist, never build/shell. Move resource pack command out of .electron-vue and preserve pack:resources CLI.
Build mode maps env/.env, env/test.env and env/production.env; expose only necessary renderer values, never the whole process.env. Existing TERGET_ENV entry points remain compatible.
## Alternatives considered
Keeping webpack5 would be smaller but was rejected by the user's Vite instruction. Raw Vite+custom Electron runner adds lifecycle work; electron-vite already coordinates three processes. A fresh template rewrite would lose existing updater/platform behavior.
## Runtime decision gate
Select exact supported Electron/builder/updater and Node patches from registry/official engines during T001/T002; verify actual UOS libc/arch before final target support. Build Node differs from bundled Electron Node.
Electron44+ dropped Windows ia32; keep an explicit actionable unsupported-architecture result unless a viable legacy line is separately selected. A current supported runtime is required for the primary x64 path.
Modern electron-updater includes DEB, while legacy ^5.3.0 cannot be assumed to provide it. Verify the selected DebUpdater on UOS with package metadata/privileges; never substitute a Windows NSIS flow.
## Official sources
- electron-vite setup/Node requirements: https://electron-vite.org/guide/
- Node renderer boundary/CJS: https://electron-vite.org/guide/troubleshooting
- Build/outputs: https://electron-vite.org/guide/build
- Static assets: https://electron-vite.org/guide/assets
- Scoped environment variables: https://electron-vite.org/guide/env-and-mode
- Dependencies/preload bundling: https://electron-vite.org/guide/dependency-handling
- Vue3 changes: https://v3-migration.vuejs.org/breaking-changes/
- Router4: https://router.vuejs.org/guide/migration/
- Vuex4: https://vuex.vuejs.org/guide/migrating-to-4-0-from-3-x.html
- Electron security: https://www.electronjs.org/docs/latest/tutorial/security
- Electron version/platform changes: https://www.electronjs.org/docs/latest/breaking-changes
- Package/update constraints: https://www.electron.build/v26/docs/features/multi-platform-build/ and https://www.electron.build/v26/docs/features/auto-update/
## External unknowns
Real Windows10/11 runners and any true ia32 requirement.
Signing certificates/production update provider are not supplied or authorized. Local controlled fixtures remain allowed.

## Initial development candidate (registry verified 2026-11-13; superseded below)
Node24.22.0/npm11.19.1; electron-vite6.0.0, Vite8.3.8, Vue3.5.45/compiler3.5.45, Router4.6.4, Vuex4.1.0, Electron45.3.1, builder26.18.0, updater6.8.11. electron-vite official website still shows v5; actual npm package is v6. Tool/runtime selection does not confirm unknown UOS compatibility. Shell default was Node24.19; execution must explicitly prepend the pinned Node bin.

## GitHub source baseline selected by user instruction
Authoritative starter: alex8088/quick-start, commit c41f96894340180f52de185d4b4c1e9bd1f66fb8, packages/create-electron/template/vue. Source package/config/main/preload/builder read directly through GitHub on 2026-11-13.
https://github.com/alex8088/quick-start/tree/c41f96894340180f52de185d4b4c1e9bd1f66fb8/packages/create-electron/template/vue
Selected Electron44.7.2 + electron-vite6 + Vite8 + Vue3 + builder26; patch releases inside upstream major ranges are locked. This supersedes the initial development Electron45 candidate, so runtime verification is rerun. Upstream JavaScript and three-process structure are adopted, including install-electron postinstall.
Alternative electron-vite/electron-vite-vue was inspected: it uses vite-plugin-electron/multi-env + TypeScript/type:module, a distinct implementation; do not mix the two build systems.
Adaptations: preserve existing src/renderer layout, dist/electron output, CJS store/runtime and Router4/Vuex4. The upstream starter does not supply Router/Vuex; these are this project's migration requirements. Use finite sandboxed preload functions instead of the starter's generic toolkit bridge because this skeleton embeds external iframe content. NSIS/deb profiles and authenticated resource rollback remain project adaptations, not claimed upstream UOS certification.

## Executed platform evidence
Final Electron44.7.2: Windows x64 NSIS, Linux ARM64 and x64 deb builds executed. These are package candidates, not UOS certification. Windows11 Parallels reports x64 NT10.0.26200; native tests are being isolated under guest Temp. No Windows10 or UOS machine was supplied. The user explicitly deferred UOS edition/CPU confirmation. See quickstart.md for final actual outcomes and remaining target gates.
Lock resolved URLs were normalized to the official npm registry without changing versions/integrity. npm/Electron caches can be prepared per target for offline installation; host node_modules must never be copied between OS/CPU.

## Observed NSIS fixture defect and upstream explanation
A temporary B1.0.1 fixture initially omitted the original build/icons/icon.png. Its uninstaller CRC differed from the stored CRC and exited2 before normal uninstall; A→B/store and updater transport had succeeded, but that fixture was not accepted. GitHub electron-builder issue10258/PR10262 explains builder26's macOS reader omitting a differing uninstaller icon patch, including the no-icon default. The formal Windows repo preserves its original icon, which builder uses for both MUI_ICON/MUI_UNICON. The B fixture is rebuilt with the same original asset, and the Windows installer test now explicitly checks each installed uninstaller CRC before treating its lifecycle as valid. No integrity bypass is used for accepted fixtures or source builds. A one-time /NCRC invocation removed only the known corrupt temporary B installation after independent hash/CRC diagnosis; it is not acceptance evidence.
https://github.com/electron-userland/electron-builder/issues/10258
https://github.com/electron-userland/electron-builder/pull/10262
