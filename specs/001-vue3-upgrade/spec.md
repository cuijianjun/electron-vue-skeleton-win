# Feature Specification: Windows Electron + Vue 3 + Vite
**Feature**: 001-vue3-upgrade | **Created**: 2026-11-13 | **Status**: implemented; Windows11 local acceptance verified
**Input**: Upgrade this existing project to Vue3; replace webpack with Vite; create spec-kit tasks then execute sequentially with incremental tests.
## User Scenarios & Testing
### User Story 1 — Vue3/Vite development and production startup (Priority: P1)
Developer can clean-install, run HMR, build all three processes and open production file URLs.
Acceptance: home, iframe and update routes plus unknown route redirect render; lazy chunks, CSS, splash and environment mode are correct; main/preload/renderer files coexist.
### User Story 2 — Existing desktop mechanisms survive migration (Priority: P1)
User can control windows, persist data, inspect versions, open deep links/iframe, and use full/resource updates.
Acceptance: narrow preload functions replace renderer Node imports; hostile frame/IPC/URLs are rejected; repeated mounts do not leak listeners. get-version invoke/handle works. Resource failure preserves the last working application and data.
### User Story 3 — Windows installation and updates (Priority: P1)
Produce Windows NSIS x64 installers, preserve protocol/install directory behavior, evaluate existing ia32 compatibility explicitly.
Acceptance: target package starts without dev server; platform/arch/version metadata matches; upgrade A→B retains data and cancel/failure remains recoverable.
### Edge Cases
Spaces/non-ASCII paths; missing icons; dev/test/production configuration; file:// navigation; repeated update checks; corrupted ZIP/path traversal; unsupported architectures; iframe origin/source spoofing; missing package privileges.
## Requirements
- **FR-001** Native Vue3 with Router4 hash routing and Vuex4; migrate all five SFCs and lifecycle cleanup.
- **FR-002** Replace webpack build/dev with electron-vite, Vue plugin and renderer HTML; remove obsolete webpack-only dependencies and scripts after parity is demonstrated.
- **FR-003** Main/preload CJS compatibility, independently safe output cleanup, static/loader/assets/env mapping and original dist/electron packaging contract.
- **FR-004** Renderer has no Node/Electron/store/main-module dependency; isolated sandboxed preload and finite allowlisted operations/events; validate sender and input in main.
- **FR-005** Preserve seven mechanisms and supporting file/download/system/log functions; correct known get-version IPC mismatch; unsubscribe on teardown.
- **FR-006** Resource packages contain compatible resources only, identify platform/arch/runtime compatibility and verify integrity/path safety; staged activation and rollback preserve previous startup. Electron/dependency/main/preload changes require full update.
- **FR-007** NSIS packaging for Windows10/11 x64; preserve installer.nsh/protocol/install-directory behavior; ia32 script cannot silently disappear or claim support on Electron44+.
- **FR-008** Frozen Node/npm/dependency lock, deterministic local unit/Electron integration tests, documented offline preparation; no live production endpoints in tests.
- **FR-009** Separate host, package and target-machine evidence. No unchecked platform acceptance may be marked complete.
## Key Entities
DesktopBridge, RuntimeMatrixRow, ResourceManifest, UpdateState; see data-model.md and contracts/desktop.md.
## Success Criteria
SC-001 Clean npm ci, incremental unit checks and Vite build pass using the pinned runner.
SC-002 Real Electron host smoke passes production route navigation, IPC/store and process isolation.
SC-003 Existing desktop mechanisms pass success/failure fixtures and resource rollback tests.
SC-004 Installer/build rows and real Windows machine rows all have explicit results; unsupported/unavailable rows remain blocked.
## Assumptions
Keep JavaScript, Vuex and CommonJS store compatibility. No new business UI or live release. Windows x64 is the proposed default; Win32 is an explicitly gated legacy path.
