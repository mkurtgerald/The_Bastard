# The Bastard — Windows Baseline Test Pack

This package is a test wrapper around the imported baseline.

## Install

1. Install and start Docker Desktop.
2. Extract this ZIP.
3. Double-click `INSTALL.cmd`.
4. Launch **The Bastard Console** from the desktop shortcut.

The installer copies the package to:

`%LOCALAPPDATA%\TheBastard`

## Test modes

The console currently exposes:
- Person detector
- Person ReID stack
- Docker/system health
- Detector UI
- Home Assistant UI
- Start/stop controls

No camera is configured automatically. Camera credentials are not requested or persisted by the installer.

## Notes

This is a baseline test package, not a final commercial installer. The imported donor stack still pulls some legacy container images at runtime. Model and third-party licensing/provenance must be cleared before commercial distribution.
