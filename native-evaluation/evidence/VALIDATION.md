# Evaluation evidence

Source baseline: `1ca803a6ee01eb0f1884b591101438e304ca46c9` plus the reviewed evaluation branch diff.
Local validation date: 2026-09-30, Linux x64, Node 24.19.0.

- Thirteen unit tests passed. See linux-unit-tests.txt.
- Original HTML served; default authenticated Socket.IO polling upgraded to WebSocket.
- Two locally generated fixtures delivered independent HLS feeds.
- Served MP4 recordings downloaded and decoded to distinct SHA-256 image hashes.
- Stopping/restarting fixture 1 left fixture 2 live.
- Restart preserved prior recording rows and resumed media.
- Captured owned FFmpeg PIDs exited; an unrelated FFmpeg sentinel survived.
- Case variants and percent-encoded delete/fix/status routes rejected.
- Smoke ran with system FFmpeg 7.1.5; the corresponding pinned Linux FFmpeg package also passed an earlier smoke before the final HTTP policy/test additions.
- Existing invalid fixture profiles are rejected before regeneration; imported accounts/integrations and linked runtime paths are rejected.
- The disabled PAM/pixel-change motion addon is absent from the evaluation dependencies; the generated-only runtime still passes all smoke checks.
- Syntax, original dashboard template parsing, workflow YAML and diff-whitespace checks passed.
- Actual media-binary license/version extraction was checked on the pinned Linux executables. Windows packaging performs the same checks against its bundled binaries and fails closed on unexpected licenses.

Not run locally: Windows installer compilation/execution, installed shortcuts, Windows process-close behavior, Chromium UI acceptance, and visual screenshot review. Cloud-browser loopback access was denied; no alternate browser route was used. The Windows workflow is an acceptance gate, not a statement that these checks have already passed.

Dependency evidence is included before and after the narrow socket update. Post-update production-filtered audit reports 36 advisories (8 critical, 9 high, 13 moderate, 6 low). This is not a production safety or commercial-license clearance. Original licensing conflicts and legacy authentication remain unresolved. Only generated fixtures and disposable local credentials are permitted in this evaluation.
