from flask import Flask, Response, request, jsonify, render_template_string
import cv2, threading, time, os, sys, webbrowser
from YOLOv7 import YOLOv7

def resource_path(relative):
    base = getattr(sys, "_MEIPASS", os.path.abspath(os.path.dirname(__file__)))
    return os.path.join(base, relative)

app = Flask(__name__)
model = YOLOv7(resource_path("models/yolov7-tiny_480x640.onnx"), conf_thres=0.55, iou_thres=0.5)
lock = threading.Lock()
camera_url = None
latest_jpeg = None
latest_count = 0
worker = None
stop_flag = False

PAGE = r"""
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>VMS Test</title>
<style>
body{font-family:Arial;background:#111;color:#eee;margin:0;padding:24px}
.wrap{max-width:1100px;margin:auto}
.card{background:#1b1b1b;padding:18px;border-radius:12px;margin-bottom:16px}
input{width:75%;padding:10px;background:#0e0e0e;color:#fff;border:1px solid #444;border-radius:6px}
button{padding:10px 14px;margin-left:6px}
img{max-width:100%;border-radius:10px;background:#000}
.small{color:#aaa;font-size:13px}
.stat{font-size:22px;font-weight:bold}
</style>
</head>
<body><div class="wrap">
<h1>VMS Test</h1>
<div class="card">
<form method="post" action="/camera">
<input name="url" placeholder="rtsp://user:pass@camera/..." required>
<button type="submit">Connect</button>
</form>
<p class="small">Live processing only. This test runtime does not record or persist camera video.</p>
</div>
<div class="card"><div class="stat">People detected: <span id="count">0</span></div></div>
<div class="card"><img src="/video"></div>
<script>
setInterval(async()=>{try{let r=await fetch('/status');let j=await r.json();document.getElementById('count').innerText=j.people;}catch(e){}},1000)
</script>
</div></body></html>
"""

def camera_loop(url):
    global latest_jpeg, latest_count, stop_flag
    cap = cv2.VideoCapture(url)
    if not cap.isOpened():
        return
    frame_index = 0
    while not stop_flag:
        ok, frame = cap.read()
        if not ok:
            time.sleep(0.2)
            continue
        frame_index += 1
        if frame_index % 3 == 0:
            try:
                boxes, scores, class_ids = model(frame)
                crops, pboxes, pscores, pclasses = model.crop_class(frame, boxes, scores, class_ids, "person", 40)
                latest_count = len(crops)
                if pboxes:
                    frame = model.draw_detections_with_predefined_colors(
                        frame, pboxes, pscores, pclasses, [(0,0,255)] * len(pboxes)
                    )
            except Exception:
                pass
        ok2, jpg = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 82])
        if ok2:
            with lock:
                latest_jpeg = jpg.tobytes()
    cap.release()

@app.get("/")
def index():
    return render_template_string(PAGE)

@app.post("/camera")
def camera():
    global camera_url, worker, stop_flag
    url = request.form.get("url","").strip()
    stop_flag = True
    if worker and worker.is_alive():
        worker.join(timeout=1)
    stop_flag = False
    camera_url = url
    worker = threading.Thread(target=camera_loop, args=(url,), daemon=True)
    worker.start()
    return ('<meta http-equiv="refresh" content="0;url=/">', 200)

@app.get("/video")
def video():
    def gen():
        while True:
            with lock:
                frame = latest_jpeg
            if frame:
                yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
            time.sleep(0.05)
    return Response(gen(), mimetype="multipart/x-mixed-replace; boundary=frame")

@app.get("/status")
def status():
    return jsonify({"people": latest_count, "connected": bool(camera_url)})

@app.get("/health")
def health():
    return jsonify({"ok": True})

if __name__ == "__main__":
    if os.environ.get("VMS_TEST_NO_BROWSER") != "1":
        threading.Timer(1.5, lambda: webbrowser.open("http://127.0.0.1:8765")).start()
    app.run(host="127.0.0.1", port=8765, threaded=True, use_reloader=False)
