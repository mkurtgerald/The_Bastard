# Original SharpAI interface: generated-fixture evaluation

This launcher runs the existing `src/camera/src/camera.js` and its full multi-monitor `web` interface. The original import, applications, assets, and license notices remain in the repository. This does not use or replace the interface with `runtime/app.py`.

## Windows evaluation package

Run **TheBastard-OriginalUI-Evaluation-Setup.exe** to install for your Windows user, then use the desktop or Start menu shortcut. No administrator access is required. The installer is unsigned; no signing identity is configured. Do not bypass a Windows security warning. The optional portable ZIP uses **START-EVALUATION.cmd** after extraction. Choose a disposable local login name and password in the terminal. Do not reuse a real password. Open the displayed address, normally `http://127.0.0.1:8787`, and sign in. The package contains Node, FFmpeg, ffprobe, SQLite and application dependencies. It does not install services, edit PATH, change security settings, or require Docker, WSL, a cloud account, or another vendor's executable.

This is an unsigned evaluation installer with an optional portable package, not a production release. The repository's older top-level INSTALL.cmd is a different Docker workflow; do not use it for this evaluation.

Two small synthetic moving/color-bar sources are generated locally. Open both monitors, view recordings through the original Videos List, close/reopen a monitor, and restart the launcher to check persistence. No real camera or existing/private media is used. Camera creation/editing, external probes, plugin connections, account administration and destructive recording operations are disabled in this mode. The original screens remain available to inspect. This restriction is deliberate while dependency exposure is assessed.

There is no fixed session time limit. The generated profile has a 512 MiB ceiling; reaching it stops the service without deleting recordings. No retention daemon or automatic recording deletion is enabled. Profiles containing other sources are rejected. Data stays separately in `%LOCALAPPDATA%\TheBastardEvaluation`. Deleting the package does not delete that profile. Use an explicit fresh BASTARD_EVAL_DATA directory for independent tests. Do not point it at an existing camera installation.

Close the console or press Ctrl+C to stop. The graceful shutdown path stops only owned children. Native-evaluation children are non-detached and hidden. Abrupt console-close/forced-termination behavior still needs Windows acceptance; do not assume that graceful IPC tests cover it. No process is killed by executable name. No firewall opening is required; all application listening is on 127.0.0.1. Do not expose or reverse-proxy this legacy service to a network.

## Source development and validation

Use Node 24 and FFmpeg/ffprobe. From `native-evaluation`, run `npm ci`, `npm test`, then `npm run smoke`. Run `npm start -- --demo` interactively for the disposable profile setup. BASTARD_FFMPEG and BASTARD_FFPROBE may select explicit binaries; they do not change system PATH. The smoke test generates its own credentials in memory, generated fixtures in a temporary directory, and deletes only that test directory after stopping.

`npm test` runs explicit unit tests. `npm run smoke` checks original HTML, authenticated default Socket.IO polling and WebSocket upgrade, two HLS feeds and media segments, recorded H.264 files served with HTTP Range, restart persistence, and both owned-process cleanup and survival of an unrelated FFmpeg sentinel. Paths include spaces and non-ASCII characters.

`npm run test:browser` is repository browser acceptance coverage. It exercises original login, both live panels, recording playback, Close/reopen and editor cancel. It must run on an allowed test host; its presence is not evidence it passed. Browser traces and videos are disabled to avoid recording credentials. Screenshots are produced only after sign-in and show synthetic imagery.

`npm run package:windows` must run on Windows x64 after tests. The exact-branch/manual GitHub workflow **Qualify Original UI Windows Evaluation** builds a per-user Inno Setup installer, installs into an isolated runner directory, checks the installed shortcut entry point, then runs the installed executable's smoke test and browser tests, and uploads artifacts only on success. Until that exact revision passes on Windows, Windows support is unverified. This workflow does not replace existing product installers.

## Safety and scope

This inherited application has legacy dependencies and legacy MD5-format local password storage. It has not had a complete security review. A narrow Socket.IO 2.5.1/client 2.5.0 update supplies the matching browser client at runtime while leaving the imported asset intact. Other dependency advisories and unsupported feature paths remain under review. Loopback guards, disabled privileged features, generated-only fixtures and disposable credentials reduce scope; they do not make this a production camera service.

Object detection, recognition, alerts, cloud uploads, external camera onboarding, retention, PTZ, ONVIF, LDAP, production security and commercial licensing are not accepted by this evaluation. Do not supply private credentials or use it for operational cameras.

## Licensing

All source notices are retained. Root MIT wording does not override nested camera LICENSE/COPYING terms (CC BY-NC-SA 4.0) or the conflicting GPL declaration in the upstream package metadata. Node, FFmpeg, ffprobe and npm dependencies carry separate notices. The package includes the camera notices and dependency source/license files. BUNDLED-BINARY-SOURCES.json records exact executable versions, hashes and source/build references; licenses/ includes actual media-binary license statements, full GPLv3 texts, build configurations and the Node distribution license. See licenses/BINARY-SOURCES.md for remaining source-correspondence limits. No commercial clearance or relicensing is claimed. Distribution and full corresponding-source obligations require a separate license review before any release.
