from flask import Flask, Response, request, jsonify, render_template_string
import cv2, threading, time, os, sys, webbrowser
from YOLOv7 import YOLOv7

def resource_path(relative):
    base = getattr(sys, "_MEIPASS", os.path.abspath(os.path.dirname(__file__)))
    return os.path.join(base, relative)

app = Flask(__name__)
model = YOLOv7(resource_path("models/yolov7-tiny_480x640.onnx"), conf_thres=0.55, iou_thres=0.5)

lock = threading.Lock()
latest_jpeg = None
latest_count = 0
latest_fps = 0.0
source_label = "No source"
connection_state = "idle"
connection_error = ""
worker = None
stop_flag = False

PAGE = r"""
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>VMS Test</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root{--bg:#0b0d10;--panel:#151922;--panel2:#0f131a;--line:#2a313d;--text:#f3f5f7;--muted:#8e98a8;--accent:#d9dde4;--ok:#55c27a;--warn:#e0a84c;--bad:#e16a6a}
*{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,Segoe UI,Arial,sans-serif}
.shell{display:grid;grid-template-columns:250px 1fr;min-height:100vh}
.sidebar{background:#10141b;border-right:1px solid var(--line);padding:18px}
.brand{font-size:20px;font-weight:700;margin-bottom:22px}
.nav{display:grid;gap:8px}.nav div{padding:10px 12px;border-radius:8px;color:var(--muted)}.nav .active{background:#1a202a;color:white}
.camera-card{margin-top:24px;padding:12px;background:var(--panel2);border:1px solid var(--line);border-radius:10px}
.camera-name{font-weight:600}.small{font-size:12px;color:var(--muted);margin-top:4px}
.main{padding:18px 20px 30px}.topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.title{font-size:22px;font-weight:650}.status-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:7px;background:#666}
.grid{display:grid;grid-template-columns:1fr 320px;gap:16px}
.viewer{background:#000;border:1px solid var(--line);border-radius:12px;overflow:hidden;min-height:540px;display:flex;align-items:center;justify-content:center}
.viewer img{width:100%;height:auto;display:block;min-height:420px;object-fit:contain;background:#000}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:16px}
.panel h3{margin:0 0 12px;font-size:15px}.metric{font-size:34px;font-weight:700}.muted{color:var(--muted)}
input{width:100%;padding:11px 12px;background:#0c1016;color:#fff;border:1px solid var(--line);border-radius:8px;margin-bottom:8px}
button{width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--line);background:#202733;color:#fff;cursor:pointer;margin-top:6px}
button.primary{background:#f0f2f5;color:#0a0c0f;border-color:#f0f2f5;font-weight:700}
button:hover{filter:brightness(1.08)}
.err{color:var(--bad);font-size:12px;white-space:pre-wrap}.ok{color:var(--ok)}.warn{color:var(--warn)}
.kv{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #242a33;font-size:13px}
@media(max-width:900px){.shell{grid-template-columns:1fr}.sidebar{display:none}.grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="shell">
  <aside class="sidebar">
    <div class="brand">VMS Test</div>
    <div class="nav">
      <div class="active">Live View</div>
      <div>Events</div>
      <div>Analytics</div>
      <div>System</div>
    </div>
    <div class="camera-card">
      <div class="camera-name" id="sideSource">No source</div>
      <div class="small" id="sideState">Idle</div>
    </div>
  </aside>

  <main class="main">
    <div class="topbar">
      <div class="title">Live View</div>
      <div class="muted"><span class="status-dot" id="dot"></span><span id="stateText">Idle</span></div>
    </div>

    <div class="grid">
      <section>
        <div class="viewer">
          <img id="video" src="/video" alt="Live video">
        </div>
      </section>

      <aside>
        <div class="panel">
          <h3>Source</h3>
          <form method="post" action="/camera">
            <input name="url" placeholder="rtsp://user:pass@camera/..." />
            <button class="primary" type="submit">Connect Camera</button>
          </form>
          <form method="post" action="/demo">
            <button type="submit">Run Built-in Demo</button>
          </form>
          <div class="small">Live processing only. No recording or video persistence in this test build.</div>
          <div class="err" id="error"></div>
        </div>

        <div class="panel">
          <h3>Analytics</h3>
          <div class="metric" id="count">0</div>
          <div class="muted">People detected</div>
        </div>

        <div class="panel">
          <h3>Stream Health</h3>
          <div class="kv"><span>Source</span><span id="src">—</span></div>
          <div class="kv"><span>Status</span><span id="stat">Idle</span></div>
          <div class="kv"><span>FPS</span><span id="fps">0</span></div>
        </div>
      </aside>
    </div>
  </main>
</div>

<script>
async function refresh(){
  try{
    const r=await fetch('/status',{cache:'no-store'});
    const j=await r.json();
    document.getElementById('count').innerText=j.people;
    document.getElementById('src').innerText=j.source;
    document.getElementById('stat').innerText=j.state;
    document.getElementById('fps').innerText=j.fps.toFixed(1);
    document.getElementById('error').innerText=j.error || '';
    document.getElementById('stateText').innerText=j.state;
    document.getElementById('sideSource').innerText=j.source;
    document.getElementById('sideState').innerText=j.state;
    const dot=document.getElementById('dot');
    dot.style.background = j.state==='connected' ? '#55c27a' : (j.state==='connecting' ? '#e0a84c' : '#e16a6a');
  }catch(e){}
}
setInterval(refresh,800); refresh();
</script>
</body></html>
"""

def set_status(state=None, error=None, source=None):
    global connection_state, connection_error, source_label
    with lock:
        if state is not None: connection_state = state
        if error is not None: connection_error = error
        if source is not None: source_label = source

def process_capture(cap, label, loop_demo=False):
    global latest_jpeg, latest_count, latest_fps, stop_flag
    set_status("connecting", "", label)
    if not cap.isOpened():
        set_status("error", "Could not open source. Verify the URL in VLC and confirm firewall/network access.", label)
        return
    set_status("connected", "", label)
    frame_index=0
    ticks=0
    t0=time.time()
    while not stop_flag:
        ok, frame = cap.read()
        if not ok:
            if loop_demo:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            set_status("error", "Stream opened but stopped delivering frames.", label)
            break
        frame_index += 1
        ticks += 1
        now=time.time()
        if now-t0 >= 1.0:
            latest_fps=ticks/(now-t0); ticks=0; t0=now
        if frame_index % 3 == 0:
            try:
                boxes, scores, class_ids = model(frame)
                crops, pboxes, pscores, pclasses = model.crop_class(frame, boxes, scores, class_ids, "person", 40)
                latest_count = len(crops)
                if len(pboxes):
                    frame = model.draw_detections_with_predefined_colors(
                        frame, pboxes, pscores, pclasses, [(0,0,255)] * len(pboxes)
                    )
            except Exception as e:
                set_status("connected", "Analytics warning: "+str(e), label)
        ok2, jpg = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 82])
        if ok2:
            with lock:
                latest_jpeg = jpg.tobytes()
    cap.release()

def stop_current():
    global stop_flag, worker
    stop_flag=True
    if worker and worker.is_alive():
        worker.join(timeout=2)
    stop_flag=False

@app.get("/")
def index():
    return render_template_string(PAGE)

@app.post("/camera")
def camera():
    global worker
    url = request.form.get("url","").strip()
    if not url:
        set_status("error","Enter an RTSP/HTTP video URL first.","No source")
        return ('<meta http-equiv="refresh" content="0;url=/">',200)
    stop_current()
    set_status("connecting","",url)
    cap=cv2.VideoCapture(url, cv2.CAP_FFMPEG)
    worker=threading.Thread(target=process_capture,args=(cap,url,False),daemon=True)
    worker.start()
    return ('<meta http-equiv="refresh" content="0;url=/">',200)

@app.post("/demo")
def demo():
    global worker
    stop_current()
    path=resource_path("demo/aegis-benchmark-demo.mp4")
    cap=cv2.VideoCapture(path)
    worker=threading.Thread(target=process_capture,args=(cap,"Built-in demo",True),daemon=True)
    worker.start()
    return ('<meta http-equiv="refresh" content="0;url=/">',200)

@app.get("/video")
def video():
    def gen():
        while True:
            with lock:
                frame=latest_jpeg
            if frame:
                yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"+frame+b"\r\n"
            else:
                time.sleep(0.1)
            time.sleep(0.03)
    return Response(gen(),mimetype="multipart/x-mixed-replace; boundary=frame")

@app.get("/status")
def status():
    with lock:
        return jsonify({
            "people":latest_count,
            "fps":latest_fps,
            "source":source_label,
            "state":connection_state,
            "error":connection_error
        })

@app.get("/health")
def health():
    return jsonify({"ok":True})

if __name__=="__main__":
    if os.environ.get("VMS_TEST_NO_BROWSER")!="1":
        threading.Timer(1.2,lambda:webbrowser.open("http://127.0.0.1:8765")).start()
    app.run(host="127.0.0.1",port=8765,threaded=True,use_reloader=False)
