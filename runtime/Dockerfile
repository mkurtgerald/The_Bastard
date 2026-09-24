FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libgl1 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY runtime/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/yolov7_person_detector/src/YOLOv7 ./YOLOv7
COPY src/yolov7_person_detector/src/models ./models
COPY runtime/app.py .

EXPOSE 8765
CMD ["python","app.py"]
