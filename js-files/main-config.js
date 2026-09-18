// Espaço de desenho fixo, escalado para a janela em sketch.js.
const SCREEN_SIZE = { width: 960, height: 540 };

// ============================================================
// TAMANHOS DE TEXTO
//
// Todos os textSize() do jogo, no espaço de desenho acima.
// ============================================================

const FONT_SIZES = {
  // partituras
  scoreLabel: 11,   // "ACTIVE" / "PREVIEW" por cima de cada partitura
  beatNumber: 9,    // número do tempo na grelha de subdivisões

  // HUD do jogo (topo e rodapé)
  hudLabel: 7,      // legendas das barras do HUD (LEVEL / HEALTH)
  headerTitle: 22,  // "PRESS START" no topo
  judgement: 24,    // PERFECT / GOOD / OK / MISS
  footer: 10,       // "SCORE ... COMBO ..." no rodapé

  // overlays de transição (countdown, próximo nível, vida perdida)
  countdownNumber: 72,    // número grande da contagem
  overlayLevelLabel: 56,  // "LEVEL X" / "LIFE LOST"
  overlayHud: 26,         // linha de info do próximo nível (BPM, LIVES)
  overlaySubHud: 16,      // linha de info da vida perdida

  // game over
  gameOverTitle: 70,  // "GAME OVER"
  gameOverHud: 14,    // linha de info do game over

  // standby
  standbyTitle: 60,   // título do ecrã de espera
  standbyPrompt: 16,  // "PRESS ANY BUTTON TO START"

  // rotate (ecrã na vertical)
  rotateTitle: 28     // "ROTATE SCREEN"
};

// ============================================================
// CONFIGURAÇÃO PARTITURAS
// margens para configuração com getScoreAreas() - renderer,js
// ============================================================

const SCORE_LAYOUT = {
  marginX: 50,
  top: 175,
  bottom: 435,
  gap: 50
};

// ============================================================
// JANELAS DE ACERTO
//
// Fração do menor intervalo rítmico do nível, limitada a maxMs.
// OK < 0.5 para as janelas de notas seguidas não se sobreporem.
// ============================================================

const DEFAULT_HIT_WINDOW_RULES = {
  perfect: { ratio: 0.22, maxMs: 55 },
  good: { ratio: 0.40, maxMs: 100 },
  ok: { ratio: 0.48, maxMs: 160 }
};

function getShortestRhythmIntervalSteps(allowedRhythms, subdivisionsPerBeat) {
  let shortest = subdivisionsPerBeat;

  for (const rhythm of allowedRhythms) {
    const ordered = [...rhythm].sort((a, b) => a - b);

    for (let index = 1; index < ordered.length; index++) {
      shortest = Math.min(shortest, ordered[index] - ordered[index - 1]);
    }
  }

  // Também na fronteira entre dois beats.
  for (const currentRhythm of allowedRhythms) {
    const currentLast = Math.max(...currentRhythm);

    for (const nextRhythm of allowedRhythms) {
      const nextFirst = Math.min(...nextRhythm);
      const distance = subdivisionsPerBeat - currentLast + nextFirst;
      shortest = Math.min(shortest, distance);
    }
  }

  return shortest;
}

function createHitWindows({
  bpm,
  subdivisionsPerBeat,
  allowedRhythms,
  rules = DEFAULT_HIT_WINDOW_RULES
}) {
  const beatDurationMs = 60000 / bpm;
  const shortestIntervalSteps = getShortestRhythmIntervalSteps(
    allowedRhythms,
    subdivisionsPerBeat
  );
  const shortestIntervalMs =
    beatDurationMs * shortestIntervalSteps / subdivisionsPerBeat;

  return {
    perfect: Math.round(
      Math.min(rules.perfect.maxMs, shortestIntervalMs * rules.perfect.ratio)
    ),
    good: Math.round(
      Math.min(rules.good.maxMs, shortestIntervalMs * rules.good.ratio)
    ),
    ok: Math.round(
      Math.min(rules.ok.maxMs, shortestIntervalMs * rules.ok.ratio)
    )
  };
}

// ============================================================
// METRÓNOMO
//
// Ajuda a aprender o tempo; desce de volume a cada nível até
// ficar mudo em silentFromLevel.
// ============================================================

const METRONOME = {
  // Tempo 1 mais alto e agudo, marca o início do compasso.
  downbeat: { frequency: 520, durationMs: 35, volume: 0.14 },
  offbeat: { frequency: 440, durationMs: 30, volume: 0.08 },

  // 1 = sempre mudo; acima do nº de níveis = nunca desaparece.
  silentFromLevel: 10
};

// ============================================================
// MÚSICA
//
// Notas em MIDI. A última progressão vale do nível 5 em diante.
// ============================================================

const MUSIC = {
  masterVolume: 0.3,
  scheduleAheadSeconds: 0.12,

  // Envio para a reverb partilhada (sem o metrónomo).
  reverbSend: 0.04,

  chordBank: {
    cm: {
      name: "Cm",
      root: 36,
      fifth: 43,
      notes: [60, 63, 67],
      repeatedNotes: [60, 62, 63, 67, 70] // C, D, Eb, G, Bb
    },
    fm: {
      name: "Fm",
      root: 29,
      fifth: 36,
      notes: [60, 65, 68],
      repeatedNotes: [60, 63, 65, 67, 68] // C, Eb, F, G, Ab
    },
    ab: {
      name: "Ab",
      root: 32,
      fifth: 39,
      notes: [60, 63, 68],
      repeatedNotes: [60, 63, 67, 68, 70] // C, Eb, G, Ab, Bb
    },
    g: {
      name: "G",
      root: 31,
      fifth: 38,
      notes: [59, 62, 67],
      repeatedNotes: [59, 62, 65, 67, 69] // B, D, F, G, A
    }
  },

  progressionsByLevel: [
    ["cm"],
    ["cm"],
    ["cm", "cm", "fm", "fm"],
    ["cm", "cm", "fm", "g"],
    ["cm", "ab", "fm", "g"]
  ],

  bass: {
    downbeatDurationBeats: 0.8,
    eighthNoteDurationBeats: 0.38,
    volume: 0.18,
    oscillator: "triangle"
  },

  blockChords: {
    durationRatio: 0.92,
    volume: 0.035,
    oscillator: "triangle"
  },

  repeatedNotes: [
    {
      everyBeats: 0.25,
      changeEveryBeats: [2, 4],
      durationBeats: 0.18,
      octaveOffset: 0,
      volumeRange: [0.018, 0.032],
      oscillator: "sine"
    },
    {
      everyBeats: 0.25,
      changeEveryBeats: [1, 2],
      durationBeats: 0.18,
      octaveOffset: 12,
      volumeRange: [0.008, 0.020],
      oscillator: "triangle"
    }
  ],

  melody: {
    firstNoteBeat: [0, 1],
    gapBeats: [1, 2],
    durationBeats: 1.1,
    octaveOffset: 24,
    volume: 0.036,
    partials: [
      { ratio: 1, volume: 1 },
      { ratio: 2.01, volume: 0.32 },
      { ratio: 3.98, volume: 0.12 }
    ]
  }
};

// ============================================================
// PONTUAÇÃO
//
// O combo multiplica os pontos, com tecto (senão os níveis
// densos passavam-se num compasso).
// ============================================================

const SCORING = {
  maxComboMultiplier: 8,

  // Compassos PERFECT para passar de nível.
  barsToClearLevel: 3
};

// ============================================================
// VIDA / HEALTH
//
// A 0 perde-se uma vida. Enche no início de cada nível.
// ============================================================

const HEALTH = {
  max: 100,
  lives: 3,

  // Cura por acerto.
  heal: {
    OK: 0,
    GOOD: 1,
    PERFECT: 2
  },

  // Combo mínimo para curar.
  comboHealThreshold: 3
};

// ============================================================
// FALHAS
//
//   label    texto do feedback
//   timer    duração do feedback em ms
//   damage   health perdida
// Sons em PLAYER_AUDIO.failures, pela mesma chave.
// ============================================================

const FAILURES = {
  // nota que passou sem ser tocada
  miss: {
    label: "MISS",
    timer: 500,
    damage: 10,
  },

  // tempo certo, fila errada
  wrong: {
    label: "WRONG ROW",
    timer: 550,
    damage: 8,
  },

  // bateu sem nota por perto (o castigo é perder o combo)
  stray: {
    label: "MISS",
    timer: 400,
    damage: 2,
  }
};

// ============================================================
// VIDA PERDIDA — ZOOM
//
// Sobe rápido ao pico e volta ao normal. O countdown espera
// que acabe.
// ============================================================

const LIFE_LOST_ZOOM = {
  attackSeconds: 0.2,    // até ao pico
  durationSeconds: 0.75, // total
  peakScale: 1.6
};

// ============================================================
// PRÓXIMO NÍVEL — TRANSIÇÃO
//
// Corta para preto antes de gerar o compasso do nível novo.
// ============================================================

const NEXT_LEVEL_TRANSITION = {
  cutSeconds: 0.4,     // até ficar preto
  durationSeconds: 1   // total
};

// ============================================================
// SCREEN WIPE — CORTE ENTRE ECRÃS
//
// Preto que sobe a opaco e volta a zero, escondendo a troca
// (saída do standby e do game over).
// ============================================================

const SCREEN_WIPE = {
  // Em frames (~60fps): não precisa do relógio de áudio.
  cutFrames: 24,
  durationFrames: 48
};

// ============================================================
// GAME OVER — SAÍDA
// ============================================================

const GAME_OVER_EXIT = {
  displayFrames: 360 // 6s a 60fps
};

// ============================================================
// QUATRO FILAS / INSTRUMENTOS
//
// Ordem das filas no MIDI Fighter e no ecrã (cima para baixo).
// Sons em PLAYER_AUDIO.lanes.
// ============================================================

const LANE_ORDER = ["blue", "green", "yellow", "red"];

const LANES = {
  blue: { color: [24, 207, 255] },
  green: { color: [0, 255, 120] },
  yellow: { color: [255, 220, 40] },
  red: { color: [217, 44, 255] }
};

// ============================================================
// CONFIGURAÇÃO MIDI
//
// Mapeamento standard do Bank 1 do MIDI Fighter Spectra,
// da fila superior para a inferior.
// ============================================================

const MIDI_ROW_NOTES = {
  blue: [48, 49, 50, 51],
  green: [44, 45, 46, 47],
  yellow: [40, 41, 42, 43],
  red: [36, 37, 38, 39]
};

// O Spectra escolhe a cor através da velocity. Estes valores
// aproximam as cores do jogo; podem ser afinados por firmware.
const MIDI_LED_COLOR_VELOCITIES = {
  blue: 87,
  green: 63,
  yellow: 39,
  red: 111
};

const MIDI_SPECTRA = {
  deviceName: "midi fighter",

  // Canais humanos; sendMIDINote() converte para 0–15.
  colorChannel: 3,
  animationChannel: 4,

  // No canal de animação: brightness 0 e brightness 15.
  ledOffVelocity: 18,
  ledOnVelocity: 33
};

const MIDI = { access: null, input: null, output: null };

// ============================================================
// NÍVEIS — SEMENTES DE REGRAS
//
// Cada nível é um conjunto de regras (ver level-config.js);
// as notas são geradas de novo a cada compasso.
// ============================================================

const LANE_CHANGE_MODES = ["none", "split", "free"];

function createLevelRules({
  bpm,
  beatsPerBar,
  subdivisionsPerBeat = 4,

  // Parâmetros descritos em level-config.js.
  laneCount = 1,
  allowedRhythms,
  density,
  minNotesPerBar = 1,

  // Mantém a densidade por tempo com um tempo a menos.
  introMinNotesPerBar = Math.floor(
    minNotesPerBar * (beatsPerBar - 1) / beatsPerBar
  ),

  avoidConsecutiveRepeat = false,
  laneChangesWithinCell = "none",

  hitWindowRules = DEFAULT_HIT_WINDOW_RULES,

  // VISIBILIDADE: tiram informação, não notas.
  showSubdivisionGrid = true,
  showScorePath = true,
  showPreviewPath = showScorePath,
  showScoreTrail = !showScorePath,
  trailFadeBeats = 4,

  // Só faz sentido com as linhas desligadas.
  visibleBeatsAhead = null,

  revealFadeBeats = 0.25
}) {
  const rhythms =
    allowedRhythms ?? [[...Array(subdivisionsPerBeat).keys()]];

  // Falha no arranque se o modo tiver uma gralha.
  if (!LANE_CHANGE_MODES.includes(laneChangesWithinCell)) {
    throw new Error(
      `Unknown laneChangesWithinCell: "${laneChangesWithinCell}". ` +
      `Use one of: ${LANE_CHANGE_MODES.join(", ")}.`
    );
  }

  return {
    bpm,
    beatsPerBar,
    subdivisionsPerBeat,
    laneCount,
    allowedRhythms: rhythms,
    density,
    avoidConsecutiveRepeat,
    laneChangesWithinCell,
    minNotesPerBar,
    introMinNotesPerBar,
    showSubdivisionGrid,
    showScorePath,
    showPreviewPath,
    showScoreTrail,
    trailFadeBeats,
    visibleBeatsAhead,
    revealFadeBeats,
    hitWindows: createHitWindows({
      bpm,
      subdivisionsPerBeat,
      allowedRhythms: rhythms,
      rules: hitWindowRules
    }),
    crossingDurationMs: (60000 / bpm) * beatsPerBar
  };
}
