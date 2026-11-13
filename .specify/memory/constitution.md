# electron-vue-skeleton-win Constitution
<!-- Sync impact: template → 1.0.0; first project principles; no existing principle removed. -->
## Core Principles
### I. Preserve the existing skeleton
Vue3/Vite migration retains IPC, window controls, full update, resource update, deep links, iframe and persistence. Preserve originals through Git history; no unrelated business features, TypeScript or Pinia conversion.
### II. Isolate process capabilities
Renderer is browser code. Main owns filesystem/store/system privileges. Sandboxed preload exposes finite named capabilities, never Electron objects or unrestricted IPC.
### III. Reproducible tools
Pin executable build Node, package manager and dependency lock. Use electron-vite for main/preload/renderer; no webpack fallback. CJS runtime and existing store compatibility remain explicit.
### IV. Verify incrementally
Each meaningful batch has behavioral and negative checks. Source implementation, host verification, target packaging and target machine acceptance are distinct states.
### V. Preserve authorization and evidence
Local implementation and tests authorized on 2026-11-13. The user subsequently authorized one local migration commit in each existing repository, preserving the pre-migration commit. No push, release or production provider mutation. Unknown target machines stay unknown, never accepted by a macOS build.
## Platform Constraints
Windows10/11 x64 is the proposed primary row. Existing ia32 command requires explicit compatibility handling; current Electron44+ has no official ia32 binaries.
## Development Workflow
One source writer per repository. Reuse upstream spec-kit scripts. Main implementation and an independent reviewer inspect the integrated diff. Fix blocking findings before completion.
## Governance
Amend with dated rationale and spec/task synchronization. User instructions outrank this document. Version 1.0.0; adopted/updated 2026-11-13.
