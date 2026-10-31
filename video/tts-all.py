import json, soundfile as sf, numpy as np
from kokoro_onnx import Kokoro
k = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")
tot = 0
for n, text in json.load(open("lines.json")):
    s, sr = k.create(text, voice="af_heart", speed=1.05, lang="en-us")
    s = np.concatenate([np.zeros(int(sr * 0.15)), s, np.zeros(int(sr * 0.35))])
    sf.write(f"vo/{n}.wav", s, sr); d = len(s) / sr; tot += d
    print(n, round(d, 2))
print("total", round(tot, 1))
