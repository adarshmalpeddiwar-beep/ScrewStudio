import json, math, re, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS, DUR = 1080, 1920, 30, 40.0
S = json.load(open('/root/promo/scene.json'))
FD = '/usr/share/fonts/opentype/inter/'
def font(name, size): return ImageFont.truetype(FD + name, size)
F_BIG = font('InterDisplay-Bold.otf', 104)
F_H2 = font('InterDisplay-Bold.otf', 78)
F_MED = font('InterDisplay-SemiBold.otf', 44)
F_SUB = font('InterDisplay-Medium.otf', 38)
F_SM = font('InterDisplay-Medium.otf', 30)
F_CHIP = font('InterDisplay-SemiBold.otf', 30)
F_MONO = font('Inter-Medium.otf', 15)

def ease(x): x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)
def eout(x): x = max(0.0, min(1.0, x)); return 1 - (1 - x) ** 3
def win(t, a, b, fi=0.35, fo=0.35):
    if t < a or t > b: return 0.0
    return min(ease((t - a) / fi) if fi > 0 else 1, ease((b - t) / fo) if fo > 0 else 1)

# ---------- background ----------
yy, xx = np.mgrid[0:H, 0:W]
rad = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H * 0.46) / H) ** 2 * 0.6)
bgv = np.clip(26 - rad * 52, 0, 26)
BG = np.dstack([bgv, bgv, bgv * 1.04]).astype(np.uint8)
BG_IMG = Image.fromarray(BG, 'RGB')

# ---------- mesh renderer ----------
def prep(m):
    P = np.array(m['pos'], dtype=np.float64).reshape(-1, 3); T = np.array(m['idx'], dtype=np.int64).reshape(-1, 3)
    a, b, c = P[T[:, 0]], P[T[:, 1]], P[T[:, 2]]
    n = np.cross(b - a, c - a); n /= (np.linalg.norm(n, axis=1)[:, None] + 1e-12)
    return {'P': P, 'T': T, 'N': n, 'm': m}
for k in ('hero', 'helix', 'dl'): S[k] = prep(S[k])
for k in ('sizes', 'heads', 'drives'): S[k] = [prep(x) for x in S[k]]

L1 = np.array([-0.55, 0.75, -0.45]); L1 /= np.linalg.norm(L1)
L2 = np.array([0.7, -0.2, -0.3]); L2 /= np.linalg.norm(L2)
V = np.array([0, 0, -1.0]); H1 = L1 + V; H1 /= np.linalg.norm(H1)
TINT = np.array([0.80, 0.83, 0.87])

def render_mesh(M, yaw, elev, center_z, px_per_mm, box=1000, ss=2, alpha=1.0, accent=None):
    P, T, N = M['P'], M['T'], M['N']
    cy, sy = math.cos(yaw), math.sin(yaw)
    Rz = np.array([[cy, -sy, 0], [sy, cy, 0], [0, 0, 1]])
    ce, se = math.cos(elev), math.sin(elev)
    # view basis rows: right, up, forward
    B = np.array([[1, 0, 0], [0, se, ce], [0, ce, -se]])
    Q = (P - [0, 0, center_z]) @ Rz.T @ B.T
    Nn = N @ Rz.T @ B.T
    D = 9.0 * box / px_per_mm  # camera distance in mm (mild perspective)
    depth = Q[:, 2] + D
    f = px_per_mm * D * ss
    sx = box * ss / 2 + Q[:, 0] * f / depth
    syv = box * ss / 2 - Q[:, 1] * f / depth
    tri = T
    pv = Q[tri].mean(axis=1) + [0, 0, D]
    vis = (Nn * pv).sum(1) < 0
    tri = tri[vis]; nn = Nn[vis]; dz = pv[vis][:, 2]
    order = np.argsort(-dz); tri = tri[order]; nn = nn[order]
    # shading
    dif = np.clip(nn @ L1, 0, 1); dif2 = np.clip(nn @ L2, 0, 1)
    spec = np.clip(nn @ H1, 0, 1) ** 46
    R = V - 2 * (nn @ V)[:, None] * nn  # reflection
    up = R[:, 1]
    env = 0.10 + 0.85 * np.exp(-((up - 0.55) / 0.22) ** 2) + 0.35 * np.exp(-((up + 0.35) / 0.18) ** 2)
    rim = (1 - np.abs(nn[:, 2])) ** 3
    lum = 0.06 + 0.30 * dif + 0.12 * dif2 + 0.48 * env + 0.25 * rim
    col = np.clip(lum[:, None] * TINT + spec[:, None] * 0.9, 0, 1)
    if accent is not None: col = np.clip(col * 0.55 + np.array(accent) * 0.45 * (0.5 + lum[:, None] * 0.6), 0, 1)
    col = (col * 255).astype(np.uint8)
    img = Image.new('RGBA', (box * ss, box * ss), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    X = sx[tri]; Y = syv[tri]
    for i in range(len(tri)):
        c = tuple(col[i]) + (255,)
        d.polygon([(X[i, 0], Y[i, 0]), (X[i, 1], Y[i, 1]), (X[i, 2], Y[i, 2])], fill=c, outline=c)
    img = img.resize((box, box), Image.LANCZOS)
    if alpha < 1:
        a = img.getchannel('A').point(lambda v: int(v * alpha)); img.putalpha(a)
    return img

def paste_center(frame, img, cx, cy):
    frame.alpha_composite(img, (int(cx - img.width / 2), int(cy - img.height / 2)))

def shadow(frame, cx, cy, w, a):
    sh = Image.new('L', (int(w * 1.6), 90), 0); ImageDraw.Draw(sh).ellipse((w * 0.3, 30, w * 1.3, 60), fill=int(120 * a))
    sh = sh.filter(ImageFilter.GaussianBlur(14)); blk = Image.new('RGBA', sh.size, (0, 0, 0, 255)); blk.putalpha(sh)
    frame.alpha_composite(blk, (int(cx - sh.width / 2), int(cy - 45)))

# ---------- text ----------
def text(frame, s, fnt, cy, a, color=(245, 245, 247), dy=0, cx=W / 2, anchor='mm'):
    if a <= 0: return
    lay = Image.new('RGBA', frame.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    d.text((cx, cy + (1 - a) * 26 + dy), s, font=fnt, fill=color + (int(255 * a),), anchor=anchor)
    frame.alpha_composite(lay)

def chip(frame, s, cx, cy, active, a, fnt=F_CHIP):
    if a <= 0: return
    lay = Image.new('RGBA', frame.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    w = d.textlength(s, font=fnt) + 40; h = 58
    box = (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
    if active: d.rounded_rectangle(box, radius=16, fill=(10, 132, 255, int(255 * a)))
    else: d.rounded_rectangle(box, radius=16, outline=(84, 84, 88, int(255 * a)), width=2)
    d.text((cx, cy), s, font=fnt, fill=(255, 255, 255, int(255 * a)) if active else (174, 174, 178, int(255 * a)), anchor='mm')
    frame.alpha_composite(lay)
    return w

def chip_row(frame, labels, cy, active, a, gap=14):
    d = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
    ws = [d.textlength(s, font=F_CHIP) + 40 for s in labels]; tot = sum(ws) + gap * (len(ws) - 1); x = W / 2 - tot / 2
    for i, s in enumerate(labels):
        chip(frame, s, x + ws[i] / 2, cy, i == active, a); x += ws[i] + gap

# ---------- svg drawing ----------
def parse_svg(svg):
    out = []
    A = lambda t, k: (re.search(k + r'="([^"]*)"', t) or [None, None])[1]
    for m in re.finditer(r'<(line|polyline|polygon|circle|rect|text|path)([^>]*)>(?:([^<]*)</text>)?', svg):
        tag, at, tx = m.groups(); out.append((tag, at, tx, A))
    return out
SVGA, SVGB = parse_svg(S['svgA']), parse_svg(S['svgB'])
def hexc(c, default=(245, 245, 247)):
    if not c or not c.startswith('#'): return default
    return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))
def draw_svg(frame, items, ox, oy, sc, prog, a):
    if a <= 0: return
    lay = Image.new('RGBA', frame.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    n = len(items); lim = int(n * prog)
    X = lambda v: ox + float(v) * sc; Y = lambda v: oy + float(v) * sc
    for i, (tag, at, tx, A) in enumerate(items[:lim]):
        al = int(255 * a)
        col = hexc(A(at, 'stroke')) + (al,); lw = max(1, round(float(A(at, 'stroke-width') or 1) * sc * 0.9))
        if 'dasharray' in at: col = col[:3] + (int(al * 0.6),)
        fill = A(at, 'fill')
        if tag == 'line':
            d.line([(X(A(at, 'x1')), Y(A(at, 'y1'))), (X(A(at, 'x2')), Y(A(at, 'y2')))], fill=col, width=lw)
        elif tag in ('polyline', 'polygon'):
            pts = [(X(p.split(',')[0]), Y(p.split(',')[1])) for p in A(at, 'points').split()]
            if tag == 'polygon':
                if fill and fill.startswith('#'): d.polygon(pts, fill=hexc(fill) + (al,))
                if A(at, 'stroke'): d.line(pts + [pts[0]], fill=col, width=lw, joint='curve')
            else: d.line(pts, fill=col, width=lw, joint='curve')
        elif tag == 'circle':
            cx, cy, r = X(A(at, 'cx')), Y(A(at, 'cy')), float(A(at, 'r')) * sc
            f2 = hexc(fill) + (al,) if fill and fill.startswith('#') else None
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=f2, outline=col if A(at, 'stroke') else None, width=lw)
        elif tag == 'rect' and A(at, 'x'):
            box = (X(A(at, 'x')), Y(A(at, 'y')), X(float(A(at, 'x')) + float(A(at, 'width'))), Y(float(A(at, 'y')) + float(A(at, 'height'))))
            d.rectangle(box, fill=hexc(fill) + (al,) if fill and fill.startswith('#') else None, outline=col, width=lw)
        elif tag == 'text' and tx:
            fs = max(8, int(float(A(at, 'font-size') or 14) * sc * 0.92)); fn = font('Inter-Medium.otf', fs)
            c = hexc(A(at, 'fill')) + (al,); anc = 'ms' if A(at, 'text-anchor') == 'middle' else 'ls'
            r = re.search(r'rotate\((-?[\d.]+)', at)
            if r:
                tl = Image.new('RGBA', (int(fs * len(tx) * 0.8) + 20, fs + 12), (0, 0, 0, 0)); ImageDraw.Draw(tl).text((tl.width / 2, fs + 4), tx, font=fn, fill=c, anchor='ms')
                tl = tl.rotate(90, expand=True); lay.alpha_composite(tl, (int(X(A(at, 'x')) - tl.width + 6), int(Y(A(at, 'y')) - tl.height / 2)))
            else: d.text((X(A(at, 'x')), Y(A(at, 'y'))), tx, font=fn, fill=c, anchor=anc)
    frame.alpha_composite(lay)

# ---------- logo ----------
def logo(frame, cx, cy, size, a):
    if a <= 0: return
    lay = Image.new('RGBA', frame.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay); s = size / 24
    P = lambda x, y: (cx + (x - 12) * s, cy + (y - 12) * s); c = (245, 245, 247, int(255 * a)); w = max(2, int(1.8 * s))
    d.line([P(8, 2.5), P(16, 2.5), P(20, 9.5), P(16, 16.5), P(8, 16.5), P(4, 9.5), P(8, 2.5)], fill=c, width=w, joint='curve')
    r = 2.6 * s; ccx, ccy = P(12, 9.5); d.ellipse((ccx - r, ccy - r, ccx + r, ccy + r), outline=c, width=w)
    d.line([P(10, 16.5), P(10, 21.5)], fill=c, width=w); d.line([P(14, 16.5), P(14, 21.5)], fill=c, width=w)
    frame.alpha_composite(lay)

# ---------- scenes ----------
def mesh_center(M): m = M['m']; return (m['zTop'] - m['L']) / 2
def frame_at(t):
    fr = BG_IMG.copy().convert('RGBA')
    # S1 0-4: title
    if t < 4.2:
        a1 = win(t, 0.25, 4.0, 0.6, 0.45); a2 = win(t, 1.3, 4.0, 0.6, 0.45)
        text(fr, 'Every screw.', F_BIG, H / 2 - 70, a1)
        text(fr, 'To the standard.', F_BIG, H / 2 + 60, a2, color=(161, 161, 166))
    # S2 4-10.2: sizes to scale
    if 3.9 <= t < 10.3:
        a = win(t, 4.0, 10.2, 0.5, 0.4); lt = t - 4.0
        idx = min(6, int(lt / 0.86)); M = S['sizes'][idx]
        pop = eout((lt - idx * 0.86) / 0.3)
        ppm = 21.5
        img = render_mesh(M, yaw=-0.7 + lt * 0.55, elev=0.30, center_z=-9, px_per_mm=ppm * (0.95 + 0.05 * pop), box=1000)
        img.putalpha(img.getchannel('A').point(lambda v: int(v * a)))
        paste_center(fr, img, W / 2, 900)
        text(fr, 'ISO Screw Studio', F_SUB, 300, win(t, 4.1, 10.2, 0.5, 0.4), color=(10, 132, 255))
        text(fr, 'Any metric screw.', F_H2, 395, win(t, 4.2, 10.2, 0.5, 0.4))
        text(fr, 'Shown to scale.', F_H2, 480, win(t, 4.4, 10.2, 0.5, 0.4), color=(161, 161, 166))
        chip_row(fr, ['M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M12'], 1440, idx, win(t, 4.5, 10.2, 0.5, 0.4))
        text(fr, S['sizes'][idx]['m']['name'], F_SM, 1530, win(t, 4.6, 10.2, 0.5, 0.4), color=(161, 161, 166))
    # S3 10-17: heads
    if 10.0 <= t < 17.2:
        a = win(t, 10.1, 17.1, 0.4, 0.4); lt = t - 10.1
        idx = min(6, int(lt / 1.0)); M = S['heads'][idx]; pop = eout((lt - idx) / 0.28)
        img = render_mesh(M, yaw=0.4 + lt * 0.5, elev=0.42, center_z=mesh_center(M) + 3, px_per_mm=40 * (0.92 + 0.08 * pop), box=1000)
        img.putalpha(img.getchannel('A').point(lambda v: int(v * a * (0.4 + 0.6 * pop))))
        paste_center(fr, img, W / 2, 920)
        text(fr, 'Seven head types.', F_H2, 380, a)
        text(fr, 'Every one from its ISO table.', F_SUB, 470, a, color=(161, 161, 166))
        names = ['Socket cap', 'Button', 'Pan', 'Cheese', 'Countersunk socket', 'Countersunk flat', 'Hex head']
        text(fr, names[idx], F_MED, 1480, a * pop)
        text(fr, M['m']['std'], F_SM, 1545, a * pop, color=(10, 132, 255))
    # S4 17-22.2: drives
    if 17.0 <= t < 22.3:
        a = win(t, 17.1, 22.2, 0.4, 0.4); lt = t - 17.1
        idx = min(4, int(lt / 1.0)); M = S['drives'][idx]; pop = eout((lt - idx) / 0.28)
        img = render_mesh(M, yaw=lt * 0.35, elev=1.05, center_z=M['m']['zTop'] - 2, px_per_mm=44 * (0.92 + 0.08 * pop), box=1000)
        img.putalpha(img.getchannel('A').point(lambda v: int(v * a * (0.4 + 0.6 * pop))))
        paste_center(fr, img, W / 2, 910)
        text(fr, 'Every standard drive.', F_H2, 380, a)
        text(fr, 'Hex, Torx, Phillips, Pozidriv, slot.', F_SUB, 470, a, color=(161, 161, 166))
        text(fr, M['m']['drive'], F_MED, 1480, a * pop)
        text(fr, M['m']['std'], F_SM, 1545, a * pop, color=(10, 132, 255))
    # S5 22-27.2: helix
    if 22.0 <= t < 27.3:
        a = win(t, 22.1, 27.2, 0.45, 0.4); lt = t - 22.1
        M = S['helix']
        k5 = ease(lt / 5.0); img = render_mesh(M, yaw=lt * 0.6, elev=0.2, center_z=mesh_center(M) - 6 * k5, px_per_mm=24 + 16 * k5, box=1080)
        img.putalpha(img.getchannel('A').point(lambda v: int(v * a)))
        paste_center(fr, img, W / 2, 1080)
        text(fr, 'Real threads.', F_BIG, 360, a)
        text(fr, 'ISO 68-1 profile, modelled in full.', F_SUB, 465, a, color=(161, 161, 166))
    # S6 27-32.6: drawing
    if 27.0 <= t < 32.7:
        a = win(t, 27.1, 32.6, 0.4, 0.4); lt = t - 27.1
        text(fr, 'A drawing that', F_H2, 380, a)
        text(fr, 'redraws itself.', F_H2, 465, a, color=(161, 161, 166))
        sc = 1000 / 940; ox = 40; oy = 640
        lay = Image.new('RGBA', fr.size, (0, 0, 0, 0)); ImageDraw.Draw(lay).rounded_rectangle((30, oy - 10, W - 30, oy + 640 * sc + 10), radius=28, fill=(28, 28, 30, int(255 * a))); fr.alpha_composite(lay)
        swap = 3.1
        if lt < swap: draw_svg(fr, SVGA, ox, oy, sc, min(1, lt / 2.0), a)
        else:
            k = ease((lt - swap) / 0.35); draw_svg(fr, SVGA, ox, oy, sc, 1, a * (1 - k)); draw_svg(fr, SVGB, ox, oy, sc, 1, a * k)
        lab = 'Length 20 mm' if lt < swap else 'Length 30 mm'
        chip_row(fr, ['16', '20', '25', '30', '35'], 1470, 1 if lt < swap else 3, a)
        text(fr, lab, F_SM, 1560, a, color=(161, 161, 166))
    # S7 32.5-36.2: download
    if 32.5 <= t < 36.3:
        a = win(t, 32.6, 36.2, 0.4, 0.4); lt = t - 32.6
        M = S['dl']
        img = render_mesh(M, yaw=-0.5 + lt * 0.7, elev=0.32, center_z=mesh_center(M), px_per_mm=34, box=900)
        img.putalpha(img.getchannel('A').point(lambda v: int(v * a)))
        paste_center(fr, img, W / 2, 930)
        text(fr, 'Download it.', F_BIG, 360, a)
        text(fr, 'STEP and STL, straight into your CAD.', F_SUB, 465, a, color=(161, 161, 166))
        for i, (lbl, x) in enumerate([('.STEP', W / 2 - 130), ('.STL', W / 2 + 130)]):
            ka = a * eout((lt - 0.5 - i * 0.25) / 0.5)
            chip(fr, lbl, x, 1470 + (1 - ka) * 30, i == 0, ka, F_MED)
        text(fr, 'SolidWorks · Fusion · Onshape · FreeCAD', F_SM, 1575, a * eout((lt - 1.0) / 0.5), color=(161, 161, 166))
    # S8 36-40: end card
    if t >= 36.0:
        a = win(t, 36.1, 40.2, 0.6, 0.6)
        logo(fr, W / 2, 780, 150, a)
        text(fr, 'ISO Screw Studio', F_H2, 960, a)
        text(fr, '13 ISO standards · M1.6 to M12 · live CAD', F_SM, 1045, a, color=(161, 161, 166))
        text(fr, 'Made by @underdogbuilder', F_MED, 1240, win(t, 36.6, 40.2, 0.6, 0.6), color=(10, 132, 255))
    return fr.convert('RGB')

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'stills':
        for t in [2.5, 6.0, 12.4, 19.5, 25.0, 29.5, 31.8, 34.5, 38.5]:
            frame_at(t).resize((360, 640)).save(f'/root/promo/still_{t:04.1f}.png')
        sys.exit()
    out = sys.argv[1] if len(sys.argv) > 1 else '/root/promo/screw-studio-promo.mp4'
    ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                           '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], stdin=subprocess.PIPE)
    n = int(DUR * FPS)
    for i in range(n):
        ff.stdin.write(frame_at(i / FPS).tobytes())
        if i % 150 == 0: print('frame', i, '/', n, flush=True)
    ff.stdin.close(); ff.wait(); print('done', out)
