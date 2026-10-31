import json, sys, soundfile as sf, numpy as np
from kokoro_onnx import Kokoro
k = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")
L = dict(json.load(open("lines.json")))
for n in sys.argv[1:]:
    s, sr = k.create(L[n], voice="af_heart", speed=1.05, lang="en-us")
    s = np.concatenate([np.zeros(int(sr * 0.15)), s, np.zeros(int(sr * 0.35))]); sf.write(f"vo/{n}.wav", s, sr); print(n, round(len(s) / sr, 2))
