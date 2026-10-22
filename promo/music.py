# Original soundtrack + SFX for the ISO Screw Studio promo, synthesised from scratch (no samples).
import numpy as np, wave
SR = 48000; DUR = 40.0; N = int(SR * DUR)
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)
t_all = np.arange(N) / SR
BPM = 120; BEAT = 60 / BPM; T0 = 0.1

def note(m): return 440.0 * 2 ** ((m - 69) / 12)
def add(sig, start, pan=0.0, gain=1.0):
    i = int(start * SR)
    if i < 0: sig = sig[-i:]; i = 0
    j = min(N, i + len(sig))
    if j <= i: return
    s = sig[:j - i] * gain
    L[i:j] += s * np.sqrt(0.5 * (1 - pan)); R[i:j] += s * np.sqrt(0.5 * (1 + pan))
def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); acc = 0.0
    for i in range(len(x)): acc = (1 - a) * x[i] + a * acc; y[i] = acc
    return y
def lp_fast(x, fc):  # 2x one-pole via cumulative trick on chunks (vectorised approximation)
    from numpy.fft import rfft, irfft, rfftfreq
    X = rfft(x); f = rfftfreq(len(x), 1 / SR); X *= 1 / np.sqrt(1 + (f / fc) ** 4); return irfft(X, len(x))
def hp_fast(x, fc):
    from numpy.fft import rfft, irfft, rfftfreq
    X = rfft(x); f = rfftfreq(len(x), 1 / SR); X *= 1 / np.sqrt(1 + (fc / np.maximum(f, 1)) ** 4); return irfft(X, len(x))
def env_adsr(n, a, d, s, r):
    e = np.ones(n) * s; A = int(a * SR); D = int(d * SR); Rr = int(r * SR)
    e[:A] = np.linspace(0, 1, A); e[A:A + D] = np.linspace(1, s, D)[:max(0, min(D, n - A))]
    if Rr: e[-Rr:] *= np.linspace(1, 0, Rr)
    return e

# ---------- chords: Am9 – Fmaj7 – Cmaj9 – G6 (each 4 s) ----------
CH = [[57, 60, 64, 67, 71], [53, 57, 60, 64, 69], [48, 55, 59, 62, 64], [55, 59, 62, 64, 67]]
ROOT = [45, 41, 48, 43]
def chord_at(t): return int(((t - T0) // 4) % 4)

# pad: detuned saws, soft lowpass, long envelope
for k in range(10):
    st = T0 + k * 4 - 0.15; length = 4.6
    n = int(length * SR); tt = np.arange(n) / SR; sig = np.zeros(n)
    for m in CH[k % 4]:
        for det, ph in ((-0.07, 0.0), (0.06, 0.3), (0.0, 0.7)):
            f = note(m) * 2 ** (det / 12)
            sig += 2 * ((tt * f + ph) % 1) - 1
    sig = lp_fast(sig, 1400 if k else 900) * env_adsr(n, 0.9, 0.5, 0.85, 1.2) * 0.035
    add(sig, st, pan=-0.15); add(sig * 0.9, st + 0.012, pan=0.15)

# shimmer bells in intro + end
def bell(m, start, g=0.2, dec=2.2, pan=0.0):
    n = int(3.5 * SR); tt = np.arange(n) / SR; f = note(m)
    s = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * f * 2.76 * tt) * np.exp(-tt * 3)) * np.exp(-tt / dec * 2.3)
    s *= np.minimum(1, tt / 0.004); add(s, start, pan, g)
for i, m in enumerate([76, 79, 83, 84, 88]): bell(m, 0.25 + i * 0.32, 0.07, pan=(-0.5 + i * 0.25))

# kick + sub bass + hats from 4 s, breakdown 27–32.5, build 32.5–36
def in_groove(t): return 4.0 <= t < 27.0 or 32.5 <= t < 36.0
kick_times = [T0 + i * BEAT for i in range(int(DUR / BEAT)) if in_groove(T0 + i * BEAT)]
kn = int(0.45 * SR); kt = np.arange(kn) / SR
kick = np.sin(2 * np.pi * (45 * kt + 90 * (1 - np.exp(-kt * 28)) / 28)) * np.exp(-kt * 7.5)
kick += 0.3 * np.sin(2 * np.pi * 1800 * kt) * np.exp(-kt * 160)
duck = np.ones(N)
for kt0 in kick_times:
    add(kick, kt0, 0, 0.55)
    i = int(kt0 * SR); j = min(N, i + int(0.32 * SR)); duck[i:j] = np.minimum(duck[i:j], 1 - 0.55 * np.exp(-np.arange(j - i) / SR * 9))
# bass: eighth-note pulses on root
for i in range(int(DUR / (BEAT / 2))):
    st = T0 + i * BEAT / 2
    if not in_groove(st): continue
    n = int(BEAT / 2 * 0.9 * SR); tt = np.arange(n) / SR; f = note(ROOT[chord_at(st)] - 12)
    s = (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * 2 * f * tt)) * env_adsr(n, 0.005, 0.08, 0.6, 0.05)
    add(s, st, 0, 0.16)
# hats on off-beats + 16th ghosts from 10 s
hn = int(0.06 * SR); noise = rng.standard_normal(hn)
hat = hp_fast(noise, 7000) * np.exp(-np.arange(hn) / SR * 70)
for i in range(int(DUR / (BEAT / 4))):
    st = T0 + i * BEAT / 4
    if not (in_groove(st) or 27.0 <= st < 32.5): continue
    pos = i % 4
    if pos == 2: add(hat, st, 0.25, 0.22)
    elif st >= 10 and pos in (1, 3): add(hat, st, -0.25, 0.07)
# arp: plucked chord tones in 8ths, 10–27 s and 32.5–36
for i in range(int(DUR / (BEAT / 2))):
    st = T0 + i * BEAT / 2
    if not (10.0 <= st < 27.0 or 27.0 <= st < 36.0): continue
    tones = CH[chord_at(st)]; m = tones[[0, 2, 4, 3, 1, 3, 4, 2][i % 8]] + 12
    n = int(0.5 * SR); tt = np.arange(n) / SR; f = note(m)
    s = (np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt * 12)) * np.exp(-tt * 7) * np.minimum(1, tt / 0.003)
    add(s, st, pan=0.45 * np.sin(i * 0.9), gain=0.06 if st < 27 else 0.085)

# apply sidechain duck to music bus so far
L *= duck; R *= duck

# ---------- SFX ----------
def whoosh(start, length=0.7, g=0.18, up=True):
    n = int(length * SR); tt = np.arange(n) / SR; x = rng.standard_normal(n)
    out = np.zeros(n); seg = int(0.02 * SR)
    for a in range(0, n, seg):  # time-varying bandpass by chunked FFT filter
        p = a / n; fc = (500 + 5500 * p) if up else (6000 - 5200 * p)
        b = min(n, a + seg * 2)
        out[a:b] += lp_fast(hp_fast(x[a:b], fc * 0.5), fc * 1.6) * np.hanning(b - a)
    out *= np.sin(np.pi * np.clip(tt / length, 0, 1)) ** 1.5
    pan = np.linspace(-0.6, 0.6, n)
    i = int(start * SR); j = min(N, i + n)
    L[i:j] += out[:j - i] * g * np.sqrt(0.5 * (1 - pan[:j - i])); R[i:j] += out[:j - i] * g * np.sqrt(0.5 * (1 + pan[:j - i]))
def tick(start, g=0.16, f=2400):
    n = int(0.05 * SR); tt = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 140) + 0.5 * np.sin(2 * np.pi * f * 1.5 * tt) * np.exp(-tt * 220)
    add(s, start, 0.1, g)
def blip(start, m=84, g=0.14):
    n = int(0.25 * SR); tt = np.arange(n) / SR; f = note(m)
    s = np.sin(2 * np.pi * f * tt * (1 + 0.04 * np.exp(-tt * 30))) * np.exp(-tt * 14) * np.minimum(1, tt / 0.002)
    add(s, start, 0, g)
for ts in (3.75, 9.8, 16.8, 21.8, 26.8, 32.3): whoosh(ts, 0.75, 0.2)
for k in range(7): tick(4.0 + k * 0.86 + 0.02, 0.15)           # size chips
for k in range(7): blip(10.1 + k * 1.0, 81 + [0, 2, 4, 5, 7, 9, 11][k], 0.10)  # head swaps
for k in range(5): blip(17.1 + k * 1.0, 88 - k, 0.10); tick(17.12 + k, 0.08, 3200)  # drives
# drawing: pen scratches while lines appear, then a click on the length change
for k in range(26): tick(27.15 + k * 0.08 + rng.uniform(0, 0.03), 0.035, 3800 + rng.uniform(-600, 600))
tick(30.2, 0.2, 2200); blip(30.25, 88, 0.12)
tick(33.1, 0.16, 2000); tick(33.35, 0.16, 2600)  # STEP / STL chips
# riser into end card
n = int(1.9 * SR); tt = np.arange(n) / SR
rise = (hp_fast(rng.standard_normal(n), 2000) * 0.5 + np.sin(2 * np.pi * (200 * tt + 300 * tt ** 2))) * (tt / 1.9) ** 2.2
add(rise, 34.15, 0, 0.11)
# impact + end chord
n = int(4 * SR); tt = np.arange(n) / SR
boom = np.sin(2 * np.pi * (38 * tt + 60 * (1 - np.exp(-tt * 9)) / 9)) * np.exp(-tt * 1.8) + 0.4 * hp_fast(rng.standard_normal(n), 300) * np.exp(-tt * 14)
add(boom, 36.05, 0, 0.5)
for i, m in enumerate([57, 64, 69, 72, 76, 79]): bell(m, 36.1 + i * 0.03, 0.06, dec=3.2, pan=-0.5 + i * 0.2)
for i, m in enumerate([81, 84, 88]): bell(m, 37.4 + i * 0.45, 0.05, dec=2.5, pan=0.4 - i * 0.4)

# ---------- reverb (FFT convolution with decaying noise IR) ----------
def reverb(x, sec=2.4, wet=0.22, seed=1):
    r = np.random.default_rng(seed); n = int(sec * SR); ir = r.standard_normal(n) * np.exp(-np.arange(n) / SR * 3.0)
    ir = lp_fast(ir, 6000); ir /= np.sqrt((ir ** 2).sum())
    m = len(x) + n; F = 1 << (m - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, F) * np.fft.rfft(ir, F), F)[:len(x)]
    return x * (1 - wet) + y * wet * 1.6
L = reverb(L, seed=1); R = reverb(R, seed=2)

# master: fade in/out, soft limit, normalise
fade = np.ones(N); fade[:int(0.05 * SR)] = np.linspace(0, 1, int(0.05 * SR)); fo = int(1.6 * SR); fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
L *= fade; R *= fade
pk = max(np.abs(L).max(), np.abs(R).max()); L /= pk; R /= pk
L = np.tanh(L * 1.3) / np.tanh(1.3) * 0.89; R = np.tanh(R * 1.3) / np.tanh(1.3) * 0.89
pcm = (np.stack([L, R], 1) * 32767).astype('<i2')
with wave.open('/root/promo/soundtrack.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', pcm.shape)
