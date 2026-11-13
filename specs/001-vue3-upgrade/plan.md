# Implementation Plan: Windows Vue3 + Vite
**Feature**: 001-vue3-upgrade | **Date**: 2026-11-13 | **Spec**: spec.md
## Summary
Migrate the existing skeleton in place; process bridge first, then Vue/Vite, then updater/platform delivery. No business rewrite. User authorized sequential execution with incremental tests on 2026-11-13.
## Technical Context
**Language/Version**: JavaScript; build Node24.22.0/npm11.19.1; CJS main/preload.
**Primary Dependencies**: GitHub alex8088/quick-start Vue JS template at c41f96894340180f52de185d4b4c1e9bd1f66fb8; Electron44.7.2, electron-vite6.0.0, Vite8.3.8, Vue3.5.45, builder26.18.0.
**Storage**: existing electron-store8 user data; no new database.
**Testing**: node:test unit + Playwright real Electron + HMR and signed update fixtures.
**Target Platform**: Windows10/11 x64 and confirmed UOS x64/arm64 rows; UOS edition/architecture still unconfirmed.
**Project Type**: desktop-app.
**Performance Goals**: working HMR, complete startup and feature parity; no invented latency targets.
**Constraints**: local changes/tests and one user-authorized migration commit per repository; preserve the existing baseline/history, no push or live publish.
**Scale/Scope**: two independent existing skeletons, five Vue SFCs each.
JavaScript; electron-vite/Vite + @vitejs/plugin-vue, Vue3, Router4, Vuex4, electron-builder/updater. Keep electron-store8 CJS until a required change proves necessary. Pin exact compatible versions and a package-lock. Node host currently v24.22.0; project runner pin must be executable. Native Node tests for pure contracts/filesystem logic, Playwright Electron integration for real runtime. Tests are explicitly part of this spec.
## Constitution Check
Scope, process isolation, deterministic tests and platform evidence are mandatory. One local migration commit per repository was subsequently authorized by the user; no release/push. Unknown UOS/Windows machines block only final target rows. Initial gate passes with these recorded external prerequisites; final gate requires actual evidence.
## Project Structure
Existing src/main, src/preload, src/renderer and platform installer sources remain. Necessary additions: electron.vite.config.mjs, src/renderer/index.html, src/shared bridge contract, scripts/ build/resource helpers and test/unit + test/e2e. Generated dist/electron/{main,preload,renderer}; renderer node imports must be removed before Vite startup.
Docs: spec.md, research.md, plan.md, data-model.md, contracts/desktop.md, quickstart.md, tasks.md; continuation: _codex/sessions/vue3-upgrade.md.
## Interfaces and ownership
Main owns filesystem/store/window/updater; preload bundles a single CJS bridge using Electron only; renderer adapter preserves existing local event call shape without exposing Electron events. Main never imports renderer utilities. Named subscriptions return unsubscribe functions; remount cleanup is required.
Renderer file:// uses hash history and relative assets; production window URL uses packaged or validated active resource directory, development uses ELECTRON_RENDERER_URL.
Hot updates can update renderer/static resources of the exact compatible runtime; no overwrite of Electron/main/preload/node_modules. Full update handles runtime/dependency changes. Target platform/arch comes from selected artifact metadata, never host inference.
## Validation and dependencies
T001–T003 tooling/tests → T004–T006 bridge separation → T007–T012 Vue/Vite → T013–T016 desktop/updates → T017–T023 platform → T024–T026 integrated closure. T017's target investigation can proceed independently of UI work; unavailable target info does not stop ready local tasks.
For each batch: regression first where a defect is reproduced, minimal fix, affected checks. Real Electron smoke proves host runtime; cross-build output alone never proves UOS/Windows support.
Review focus: destructive build cleanup; CJS/sandbox preload imports; file URL chunks; IPC sender/payload spoofing; unsigned/corrupt/incompatible resource rollback; UOS privilege cancellation and NSIS behavior.
## Complexity Tracking
No monorepo, shared runtime package, orchestration framework, TypeScript or Pinia. Two independent repos use matched source changes with platform-owned packaging differences. Main agent is sole writer; independent agent reviews complete changes.
