# NoteCraft

**[Try the live demo →](https://doulaiz.github.io/notecraft/)**

NoteCraft is a single-page sheet music composer that runs entirely in the browser — no build step, no backend, no dependencies. Sketch a melody on an interactive staff, hear it played back instantly, and export it as a standard MIDI file.

This project was vibe-coded with [Claude](https://claude.com) (via Claude Code).

## Features

- **Interactive staff** — a 5-line staff rendered in SVG with a treble or bass clef, time signature, and key signature, all editable by tapping/clicking them.
- **Note placement** — double-tap or double-click anywhere on the staff to drop a note, snapped to the nearest line or space.
- **Note editing**
  - Single tap/click cycles a note's duration: quarter → half → whole → eighth → quarter rest → half rest → delete.
  - Drag a note up or down to change its pitch diatonically.
  - Long-press (hold ~1 second without moving) and then drag up/down to nudge the note a half-step instead, adding a sharp or flat directly on that note.
- **Key signature** — a dedicated clickable zone between the time signature and the notes lets you pick any major key (0–7 sharps or flats); the correct pitches are applied automatically during playback and export.
- **Measure barlines** — drawn automatically according to the current time signature, to make longer compositions easier to read.
- **Playback** — a synthesized Web Audio engine (Synth Lead, Piano, or Sine Wave) plays the composition in sequence, highlighting each note as it sounds. A single Play/Pause button plus a Stop button control playback, with a tempo slider from 40–240 BPM.
- **MIDI export** — download the current composition as a standard `.mid` file.
- **Composition library** — save named compositions to the browser's `localStorage`, then browse, load, or delete them later from the "My Sheets" panel.
- **Responsive & touch-friendly** — a hamburger drawer holds all the settings, every control meets a 44×44px minimum touch target, and the same interactions work with mouse or touch without double-firing.

## Files

- `index.html` — page structure and markup.
- `notecraft.css` — all styling.
- `notecraft.js` — all application logic (staff rendering, note editing, audio playback, MIDI export, local storage).

## Running it

No build tools or installation required — just open `index.html` in a browser. If your browser restricts local scripts loaded via `file://`, serve the folder with any static file server instead, e.g.:

```bash
npx serve .
```

## How it works, briefly

- Pitches are computed from a generated natural-note scale, with the clef determining which note sits on the bottom staff line. Sharps/flats are applied on top of that, either from the key signature or from an accidental placed directly on a note.
- Notes are laid out left-to-right in a fixed sequence (not literally proportional to duration), with barlines inserted wherever the cumulative beat count crosses a measure boundary for the current time signature.
- Playback and MIDI export both derive each note's final pitch and duration from the same shared state, so what you hear matches what you download.
