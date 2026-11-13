# Desktop/build contract
## Process boundary
Expose fixed per-operation functions in window.electronAPI; renderer adapter maps only predefined channels. Include window controls; versions/system info; store CRUD; dialogs/logs/downloads; full/resource update; deep links/refresh/sibling events. Preserve successful existing return values and correct get-version to invoke/handle.
Only the owning top-level application frame may call privileged main handlers. Check exact dev origin or permitted packaged/active resource entry; reject remote frames, unexpected schemes/origins and invalid arguments. Child windows get the same sandbox/isolation/preload. iframe messages must match expected source+origin+schema.
Event subscription passes data only and returns unsubscribe; repeated Vue unmount/remount leaves no growth.
## Build
npm run dev uses electron-vite. npm run build:app compiles all processes with production semantics; build:test compiles test environment without a dev URL. Existing platform build entry points still produce correct artifacts, or explicitly reject unsupported target architecture before downloading/building.
Main CJS entry and preload.cjs remain compatible with package type. Renderer uses relative assets/hash history. Output directories coexist; clean never removes source hooks/icons. static/loader and packaged resources resolve in dev/production/resource restart.
## Update
pack:resources receives platform/arch/runtime explicitly, creates renderer-only archive/manifest. Before activation verify compatibility, SHA256, entry existence and path safety. Activation stages in userData, rolls back on failure; main/preload/runtime/dependency updates use full installer.
NSIS full update retains installer.nsh/protocol/user-data behavior. Win32 support is explicit and checked before build.

## Resource format and trust (T015)
Only schemaVersion=1 renderer-only packages are accepted. Legacy full-resource ZIP/manifests are explicitly rejected with a full-installer instruction. Ed25519 signature authenticates the publisher, SHA256 verifies bytes; no configured trusted public key/source means updates are disabled. Runtime identity hashes main, preload, locked dependencies, Electron and application version. State staged→booting→ready requires a Vue/router-ready IPC acknowledgement; missing acknowledgement rolls back after 12 seconds or next launch. Keep the last confirmed entry; staging multiple candidates cannot make an unconfirmed candidate the rollback target.

## Integrated review corrections
Runtime identity reads generated dist/electron/runtime-build.json (lock hash) rather than a lockfile excluded by builder. Missing/incompatible identity disables resource updates without preventing bundled startup. Full-update readiness belongs to the current Promise; cancelling stays gated until settlement and late events cannot authorize install. Resource downloads capture an immutable candidate, newer checks use a generation guard, installed/staged semver prevents replay/downgrade. Download directories use canonical real paths; filename collisions include dangling links. Only the main window can acknowledge a new renderer boot. Production ignores the development-server URL.
