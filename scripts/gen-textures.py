"""Procedural, seamlessly tileable textures (FFT-filtered noise wraps by construction)."""
import numpy as np
from PIL import Image
rng = np.random.default_rng(26)

def fnoise(n, lo, hi, aniso=(1.0, 1.0)):
    """Band-limited periodic noise in [0,1]. lo/hi are cycles across the tile; aniso stretches frequency response per axis."""
    w = rng.standard_normal((n, n))
    F = np.fft.fft2(w)
    fy = np.fft.fftfreq(n)[:, None] * n
    fx = np.fft.fftfreq(n)[None, :] * n
    r = np.sqrt((fx * aniso[0]) ** 2 + (fy * aniso[1]) ** 2)
    filt = np.exp(-((r - (lo + hi) / 2) / ((hi - lo) / 2 + 1e-6)) ** 2) if hi > lo else np.exp(-(r / max(lo, 1e-6)) ** 2)
    a = np.real(np.fft.ifft2(F * filt))
    a = (a - a.min()) / (a.max() - a.min() + 1e-9)
    return a

def save(arr, path, q=82, mode="RGB"):
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), mode)
    if path.endswith(".webp"): img.save(path, quality=q, method=6)
    else: img.save(path, optimize=True)

N = 512
# --- cardboard: warm brown, coarse blotches + fine fibres + corrugation streaks
coarse = fnoise(N, 0, 6); mid = fnoise(N, 10, 40); fine = fnoise(N, 60, 200)
streak = fnoise(N, 2, 30, aniso=(0.12, 1.0))  # long horizontal-ish fibres
base = 0.42 * coarse + 0.22 * mid + 0.16 * fine + 0.20 * streak
rgb = np.stack([base * 92 + 120, base * 78 + 84, base * 56 + 48], -1)
save(rgb, "public/tex/cardboard.webp", 84)

# --- aged paper: cream, very soft blotches + fibres + faint foxing spots
coarse = fnoise(N, 0, 4); fine = fnoise(N, 80, 220); fibre = fnoise(N, 20, 120, aniso=(1.0, 0.25))
spots = (fnoise(N, 30, 60) > 0.86).astype(float) * fnoise(N, 0, 8)
base = 0.5 * coarse + 0.18 * fine + 0.22 * fibre
rgb = np.stack([base * 34 + 208 - spots * 22, base * 36 + 192 - spots * 30, base * 40 + 158 - spots * 42], -1)
save(rgb, "public/tex/paper.webp", 84)

# --- dark walnut table: long grain along x
grain = fnoise(N, 4, 60, aniso=(0.06, 1.0)); knots = fnoise(N, 0, 5); fine = fnoise(N, 90, 240, aniso=(0.1, 1.0))
base = 0.55 * grain + 0.25 * knots + 0.20 * fine
rgb = np.stack([base * 30 + 22, base * 22 + 16, base * 15 + 11], -1)
save(rgb, "public/tex/table.webp", 80)

# --- film grain: neutral mid-grey noise, used with soft-light/overlay at low opacity
g = rng.standard_normal((256, 256)) * 0.5 + fnoise(256, 90, 128) * 0.6
g = (g - g.min()) / (g.max() - g.min())
rgba = np.stack([g * 255, g * 255, g * 255, np.full_like(g, 255)], -1)
save(rgba, "public/tex/grain.png", mode="RGBA")
print("textures written")
