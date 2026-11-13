# Development and acceptance — 2026-11-13

Use Node24.22.0/npm11.19.1 (.nvmrc/packageManager). The shell's default Node24.19 is not the selected runner. Run the two development/HMR tests sequentially because both preserve the original port9080.

```sh
npm ci
npm run test:unit
npm run build:app
npm run test:e2e
npm run test:dev
npm run build:app
```

| Scope | Executed result |
|---|---|
| Each repository, macOS24.6 x64 host | 22 unit tests, 4 real Electron44 E2E tests and 1 HMR test passed. Controlled providers and isolated temporary userData; no production calls. |
| Final lock URL normalization | 506 resolved URLs per lock now use npm registry; versions/integrity unchanged. Resource packaging/runtime identity/restart/rollback tests rerun: 2/2 each. Other unchanged behavior checks above are reused. |
| Final UOS desktop association config | desktopName=myapp.desktop + linux.syncDesktopName=true; final real Electron E2E 4/4 passed again. |
| Actual packaged application, macOS host | Final Windows-root macOS test package started without source lockfile or Vite server; packaged/source runtime identity matched, untrusted dev URL ignored: 1/1. This is host package evidence, not UOS certification. |
| Windows x64 cross build | npm run build:win64 passed; release/myapp Setup 1.0.0.exe plus latest.yml/blockmap. PE x86-64, CJS main/preload, renderer and static resources present. |
| UOS ARM64 cross build | npm run build:linux:arm64 passed; release/electron-vue-skeleton_1.0.0_arm64.deb. ELF AArch64, package architecture, original hooks, desktop/protocol, source entries/build identity/static/icon verified. |
| UOS x64 cross build | npm run build:linux:x64 passed; release/electron-vue-skeleton_1.0.0_amd64.deb. ELF x86-64, package architecture, runtime entry/preload/renderer/build identity and desktop protocol inspection passed. |
| Independent review | Packaged lock dependency, cancellation race, resource candidate ownership, directory symlink, replay/downgrade and UI reminder/mode findings fixed and rechecked. Final lock/desktop config review found no new blocker. |
| Windows11 x64 VM | NT10.0.26200 x64; portable Node24.22/npm11.19.1, offline npm ci (464 packages), native production build, 22 unit +4 real Electron E2E +1 HMR passed. Installed NSIS fixture also passed: actual generic-provider error/cancel/download/confirm, owned native installation wizard, CRC-verified 1.0.0→1.0.1, protocol, store/data retention and normal uninstall/no registration or shortcut residue (1/1,127.56s). |
| Real UOS / Windows10 | Not provided. UOS edition/version, CPU, glibc, display session and package privileges remain unknown. |

The four Electron cases cover desktop routes/lifecycle/IPC/child/iframe/file/download/store/deep-link parsing, signed renderer packaging, restart/failed-boot recovery and update-dialog transport choice. The dialog test injects a controlled bridge and controller units inject an updater. Native installer proof comes from the separate explicit Windows test, which uses the real installed app, actual electron-updater transport and NSIS wizard; no production endpoint is used.

Full updates use APP_UPDATE_URL; resource updates require RESOURCE_UPDATE_PUBLIC_KEY_FILE and RESOURCE_UPDATE_URL. Local fixtures may use loopback HTTP; remote providers require HTTPS. No real provider/certificate was supplied. Signing, publication and production-provider acceptance remain outside current local authorization. All package commands use --publish never.

Offline preparation must include the matching npm tarball cache, Electron ZIP and builder toolsets for the build host and target. Never copy node_modules across OS/CPU. Electron44 official SHA256 verified before manually populating local cache after its default downloader timed out. Archive downloads used a mirror only after verification against the official release SHASUMS256.txt; checksum verification was not disabled. npm lock URLs remain official.

For true UOS collect /etc/os-release, uname -m, getconf GNU_LIBC_VERSION and XDG_SESSION_TYPE. Verify ordinary-user installation, window/desktop association, protocol, persistent data, signed renderer restart/rollback, actual DEB A→B update, privilege cancellation/failure and uninstall. A cross-built deb cannot replace these checks. Windows10 needs its own target row; Windows ia32 is explicitly rejected by Electron44's build command.

Retain source/lock/spec-kit/specs/README/session and release installers plus metadata. node_modules, dist/electron and unpacked release directories are regenerable. Temporary workspaces and release/.validation-* transfers are removed after validation; formal installers/update metadata and source are retained. Preserve build/shell and Git history.

Native Windows setup: Parallels shared-folder copying preserved ReadOnly on the temporary Home.vue and old generated runtime-build.json. Clean only the copied generated output and normalize that temporary source attribute before dev tests, or copy a clean checkout without generated directories/attributes. No product fallback was added for this setup error. HMR cleanup retries transient Windows database locks after stopping its own process tree.

## Final verification and artifact identity
Both projects: npm run build:test + real Electron desktop smoke passed (1/1 each), then npm run build:app restored production. All12 compiled files in each final unpacked target match its current production build (Windows, UOS ARM64, UOS amd64). Final macOS packaged smoke1/1 passed with no source lockfile, matching runtime identity and ignored untrusted dev URL. Windows legacy ia32 command explicitly fails before building.

| Formal artifact | SHA256 |
|---|---|
| Windows release/myapp Setup 1.0.0.exe | 25ea4acc35bdebd9720fb204779507a4379bf60cdf6ecd47f9134239429d1d9b |
| UOS release/electron-vue-skeleton_1.0.0_arm64.deb | bc73117f457ee05ef2d3a41e993898eeac463c26d455501bf340848378c5042f |
| UOS release/electron-vue-skeleton_1.0.0_amd64.deb | b8221eec48c6e7f6821292ac45cd1cc07d29f3a59efc320c5cd674449510037d |

The NSIS assisted directory page appends APP_FILENAME when absent. The fixture directory “installed myapp” follows that actual GUI contract; an arbitrary silent /D path without the app name can be nested again by a later GUI upgrade. Windows verification used the current-user install scope and isolated profiles/cache. Production certificates/feed and Windows10 machine coverage were not supplied; real UOS acceptance remains blocked as above.
