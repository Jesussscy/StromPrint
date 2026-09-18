"""Decode every delivered MP4 frame locally; do not infer success from existence."""
import hashlib
import json
from pathlib import Path

import cv2

ROOT = Path(__file__).resolve().parents[2]
directory = ROOT / 'models/manga/checkpoint07'
video = directory / 'Manga_Recorrido_15s.mp4'
report = json.loads((directory / 'report_encode_all_0001_0360.json').read_text())
assert report['status'] == 'complete', 'Encoding did not finish'
capture = cv2.VideoCapture(str(video))
assert capture.isOpened(), 'Cannot open delivered MP4'
fps = capture.get(cv2.CAP_PROP_FPS)
assert abs(fps - 24) < .01, fps
count = 0
samples = []
while True:
    ok, frame = capture.read()
    if not ok:
        break
    count += 1
    assert frame.shape[:2] == (720, 1280), frame.shape
    if count in (1, 120, 121, 240, 241, 360):
        deviation = float(frame.std())
        assert deviation > 5, 'Blank sample frame'
        samples.append({'frame': count, 'pixelStdDev': round(deviation, 3)})
capture.release()
assert count == 360, f'Incomplete decoded video: {count}/360'
result = {'status': 'PASS', 'file': str(video), 'decodedFrames': count,
          'fps': fps, 'durationSeconds': count / fps, 'resolution': [1280, 720],
          'bytes': video.stat().st_size, 'sha256': hashlib.sha256(video.read_bytes()).hexdigest(),
          'samples': samples, 'note': 'Technical integrity only; not certification of architectural realism.'}
(ROOT / 'docs/manga/video-validation.json').write_text(json.dumps(result, indent=2), encoding='utf8')
print(json.dumps(result, indent=2))
