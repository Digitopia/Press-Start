# Press Start

Press Start is a browser-based rhythm game built with [p5.js](https://p5js.org/) and the Web Audio API. Read the incoming rhythm, hit the matching coloured lane on time, and survive ten increasingly demanding levels.

The game can be played with a computer keyboard or a [MIDI Fighter Spectra](https://www.midifighter.com/), including automatic pad colour and LED feedback.

## How to play

Notes move through the active score one bar at a time. Press the key or MIDI pad for the corresponding lane as each note reaches the playhead. Accurate hits build your combo and restore health; missed, mistimed, or incorrect inputs cost health. Lose all three lives and the run ends.

Each level introduces more rhythmic and visual complexity: additional lanes, denser patterns, shorter timing windows, lane changes within a rhythm, and less advance information.

### Keyboard controls

| Key | Action |
| --- | --- |
| Any key | Start the game from the title screen |
| `1` | Blue lane |
| `2` | Green lane |
| `3` | Yellow lane |
| `4` | Red lane |
| `R` | Restart the game |
| `↑` | Go to the previous level |
| `↓` | Go to the next level |

The lanes are arranged from blue to red, top to bottom.

### MIDI Fighter Spectra

Connect the controller before opening the game and grant MIDI access when the browser asks. Press Start automatically detects devices whose name contains `midi fighter`.

The default mapping uses Bank 1:

| Lane | MIDI notes |
| --- | --- |
| Blue | 48–51 |
| Green | 44–47 |
| Yellow | 40–43 |
| Red | 36–39 |

Keyboard play remains available when Web MIDI is unsupported or no controller is connected.

## Run locally

No build step or package installation is required. Clone the repository and serve its root directory with any static HTTP server:

```bash
git clone https://github.com/Digitopia/Press-Start.git
cd Press-Start
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in a browser. Use a desktop browser for MIDI play and keep the window in landscape orientation.

> [!NOTE]
> Open the project through an HTTP server rather than directly from the filesystem. Browser security rules can otherwise prevent assets such as the custom font from loading correctly.

## Deploy

Press Start is a static site. Publish the repository root as-is to GitHub Pages, Netlify, Cloudflare Pages, or another static hosting service. There is no build command, and `index.html` is the entry point.

For MIDI support in production, serve the site over HTTPS and allow the browser's MIDI permission prompt.

## Configuration

The game is intentionally configured in plain JavaScript:

- `js-files/main-config.js` contains the shared screen, typography, timing, scoring, health, audio, lane, and MIDI settings.
- `js-files/level-config.js` defines the rhythm, tempo, density, lanes, timing windows, and visibility rules for all ten levels.
- `js-files/player-audio.js` defines sounds triggered by player actions.
- `js-files/music-transport.js` controls the generative backing music and metronome.

When adding or reordering scripts, preserve the order in `index.html`: the files use shared browser globals, so dependencies must load before the game entry point.

## Project structure

```text
.
├── assets/
│   └── fonts/              # Press Start 2P typeface
├── js-files/
│   ├── main-config.js      # Shared game and MIDI configuration
│   ├── level-config.js     # Level definitions
│   ├── level-generator.js  # Procedural rhythm generation
│   ├── core-audio.js       # Web Audio primitives and shared reverb
│   ├── player-audio.js     # Player feedback sounds
│   ├── music-transport.js  # Music scheduler and layers
│   ├── game-state.js       # Game state and level transitions
│   ├── game-loop.js        # Timing, hit detection, and scoring
│   ├── renderer.js         # Canvas interface and effects
│   └── input.js            # Keyboard and MIDI input
├── index.html              # Application entry point
├── sketch.js               # p5 setup and draw loop
├── style.css               # Page and canvas styles
├── p5.js                   # Vendored p5.js runtime
└── p5.sound.min.js         # Vendored p5.sound library
```

## Built with

- [p5.js](https://p5js.org/)
- [p5.sound](https://p5js.org/reference/p5.sound/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API)
- [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P)
