# VMS Test — Windows test path

This path intentionally does **not** use the SharpAI Aegis desktop download and does not pull the prebuilt `shareai/yolov7_person_detector` image.

The detector container is built locally from:

`src/yolov7_person_detector/src/Dockerfile`

## Windows test

1. Install and start Docker Desktop from Docker's official distribution.
2. Run `INSTALL.cmd`.
3. Launch **VMS Test**.
4. Select **Build detector locally from source**.
5. Select **Start detector**.

The first local build downloads ordinary OS/Python build dependencies from their upstream package repositories, but the application code and model already come from this repository.
