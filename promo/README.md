# Promo reel

40-second 1080×1920 reel rendered from the real kernel geometry.

```
node dump.js            # exports meshes + drawings to scene.json
python3 render.py       # renders screw-studio-promo.mp4 (needs Pillow, numpy, ffmpeg, Inter font)
python3 music.py        # synthesises soundtrack.wav (original, no samples)
ffmpeg -i screw-studio-promo.mp4 -i soundtrack.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest screw-studio-promo-music.mp4
```
