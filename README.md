# ISO Screw Studio

A single-page configurator for ISO metric machine screws, M1.6–M12. Pick a head, drive, size, pitch and length; the dimensioned drawing and the 3D model update live, and you can download the screw as STEP + STL.

Made by [@underdogbuilder](https://www.instagram.com/underdogbuilder/).

## Coverage

| Head | Hex socket | Torx | Phillips / Pozidriv | Slot |
|---|---|---|---|---|
| Socket cap | ISO 4762 | ISO 14579 | | |
| Button | ISO 7380-1 | | | |
| Pan | | ISO 14583 | ISO 7045 | ISO 1580 |
| Cheese | | ISO 14580 | | ISO 1207 |
| Countersunk socket | ISO 10642 | | | |
| Countersunk flat | | ISO 14581 | ISO 7046-1 | ISO 2009 |
| Hex head | ISO 4017 | | | |

Pitches follow ISO 261 (coarse and fine), lengths ISO 888. Fine pitch maps to ISO 12474 (socket cap) and ISO 8676 (hex head).

## How it works

`src/kernel.js` is a dependency-free geometry kernel: it builds each screw as a watertight polar mesh (head meridian per ray, recess as a star-shaped cut, optional ISO 68-1 helical thread), then writes binary STL and an AP214 faceted B-rep STEP, zipped in the browser. `index.html` is the built page (kernel inlined, three.js r128 from cdnjs for the 3D view).

## Tests

```
node tests/manifold.test.js        # builds all 1,040 standard combinations, checks closed + oriented
node tests/step-structure.test.js  # checks STEP entity references
```
