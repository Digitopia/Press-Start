const SCREEN_SIZE = { width: 960, height: 540 };

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
// Cada janela ocupa uma fração do menor intervalo rítmico que
// o nível consegue gerar. maxMs mantém os níveis mais lentos
// dentro da tolerância original.
//
// OK fica abaixo de metade do intervalo mínimo, impedindo que
// as janelas de duas notas consecutivas se sobreponham.
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

  // Também é possível haver notas muito próximas na fronteira
  // entre dois beats, mesmo que cada célula isolada seja espaçada.
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
// MÚSICA
//
// Os números são notas MIDI e são convertidos em frequência
// apenas na camada de áudio. As progressões contêm chaves do
// banco de acordes; o último esquema aplica-se ao nível 5 e aos
// níveis seguintes.
// ============================================================

const MUSIC = {
  masterVolume: 0.18,
  scheduleAheadSeconds: 0.12,

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
// O combo multiplica os pontos, com tecto. Sem tecto o ganho
// cresce com o QUADRADO das notas seguidas e os níveis densos
// passam-se num compasso.
//
// O tecto é invisível: GAME.combo continua a contar sem limite
// e é esse número que aparece no ecrã.
//
// O alvo de cada nível não é uma escada de números: é sempre o
// mesmo número de COMPASSOS, traduzido nas notas que ESTE
// nível põe em cada compasso (ver getLevelTargetScore).
// ============================================================

const SCORING = {
  maxComboMultiplier: 8,

  // Compassos de jogo PERFEITO para passar de nível. Na
  // prática são sempre mais, porque cada GOOD ou OK rende
  // menos e qualquer falha deita o combo abaixo.
  barsToClearLevel: 3
};

// ============================================================
// VIDA / HEALTH
//
// A barra de health desce a cada falha e sobe a cada acerto.
// Quando chega a zero perde-se UMA vida e a barra volta a
// encher. Sem vidas -> game over.
//
// A health volta ao máximo no início de cada nível.
// Estes valores são iguais em todos os níveis.
// ============================================================

const HEALTH = {
  // tamanho da barra
  max: 100,

  // vidas iniciais
  lives: 3,

  // Cura de cada acerto.
  // OK vale 0: acertar tarde ou cedo mantém a barra,
  // não a recupera.
  heal: {
    OK: 0,
    GOOD: 1,
    PERFECT: 2
  },

  // Só se cura a partir deste combo.
  // Abaixo disto acertar não recupera nada.
  comboHealThreshold: 3
};

// ============================================================
// FALHAS
//
// Cada tipo de falha define, num sítio só:
//   label    texto do feedback
//   timer    duração do feedback em ms
//   damage   health perdida
//   beep     som opcional [freq, ms, volume]
//
// É aqui que se afina a dificuldade da barra de vida.
// ============================================================

const FAILURES = {
  // nota que passou sem ser tocada
  miss: {
    label: "MISS",
    timer: 500,
    damage: 10,
    beep: null
  },

  // tempo certo, fila errada
  wrong: {
    label: "WRONG ROW",
    timer: 550,
    damage: 8,
    beep: [110, 90, 0.12]
  },

  // bateu sem nota nenhuma por perto
  stray: {
    label: "MISS",
    timer: 400,
    damage: 5,
    beep: [110, 60, 0.07]
  }
};

// ============================================================
// QUATRO FILAS / INSTRUMENTOS
// A ordem corresponde às quatro filas físicas do MIDI Fighter
// ============================================================

const LANE_ORDER = ["blue", "green", "yellow", "red"];

const LANES = {
  blue: { color: [24, 207, 255], frequency: 1200 },
  green: { color: [0, 255, 120], frequency: 850 },
  yellow: { color: [255, 220, 40], frequency: 550 },
  red: { color: [217, 44, 255], frequency: 220 }
};

// ============================================================
// CONFIGURAÇÃO MIDI
//
// Depois de ligares o Spectra:
// 1. abre a consola
// 2. carrega nos 16 botões
// 3. o código mostra os números MIDI
//
// Depois colocamos aqui os 4 números de cada fila.
// ============================================================

const MIDI_ROW_NOTES = { blue: [], green: [], yellow: [], red: [] };

const MIDI = { access: null, input: null };

// ============================================================
// NÍVEIS — AGORA SÃO "SEMENTES DE REGRAS"
//
// Cada nível já não tem um "beats" fixo. Em vez disso define
// as regras que controlam a dificuldade:
//
//   bpm                    velocidade
//   beatsPerBar            tempos por compasso
//   subdivisionsPerBeat    subdivisões dentro de cada tempo
//   lanes                  filas permitidas neste nível
//   density                probabilidade (0–1) de uma
//                          célula rítmica aparecer num beat
//   minNotesPerBar         mínimo garantido num compasso normal
//   introMinNotesPerBar    mínimo garantido no primeiro compasso,
//                          cujo primeiro beat fica em silêncio
//   avoidConsecutiveRepeat evita repetir a mesma fila
//                          duas vezes seguidas
//   laneChangesWithinCell  quantas mudanças de fila cabem
//                          dentro de uma célula:
//                          "none" / "split" / "free"
//
// O CONTEÚDO (que fila soa em cada subdivisão) é gerado
// aleatoriamente, de novo, a cada compasso.
// ============================================================

const LANE_CHANGE_MODES = ["none", "split", "free"];

function createLevelRules({
  bpm,
  beatsPerBar,
  subdivisionsPerBeat = 4,

  // Quantas filas distintas entram em jogo neste nível
  // (1 a 4). QUAIS filas (cor) são usadas é sorteado de
  // novo a cada compasso — laneCount controla só a
  // quantidade, não a identidade.
  laneCount = 1,

  // Banco de células rítmicas.
  // Cada célula é um array de subdivisões ativas dentro de UM beat.
  allowedRhythms,

  // density controla a probabilidade de um beat 
  // ter notas ou ficar em silêncio, não cada subdivisão individual.
  density,

  minNotesPerBar = 1,

  // O compasso de introdução tem menos UM tempo disponivel.
  // Herdar o minNotesPerBar deixava-o mais DENSO que os
  // compassos normais, que é o contrário do que ele é para
  // ser: um respiro para ler a partitura nova.
  //
  // O defeito mantém a densidade por tempo, não o total.
  introMinNotesPerBar = Math.floor(
    minNotesPerBar * (beatsPerBar - 1) / beatsPerBar
  ),

  avoidConsecutiveRepeat = false,

  // ----------------------------------------------------------
  // MUDANÇAS DE FILA DENTRO DA CÉLULA
  //
  //   "none"   a célula inteira numa fila só
  //   "split"  UMA mudança: a célula parte-se em dois blocos
  //   "free"   cada nota da célula escolhe fila
  //
  // O degrau a sério está entre "none" e "split": continua a
  // haver um bloco para agarrar, mas já não se pode pousar a
  // mão e esperar. O "free" é o caos, e por isso chega tarde.
  //
  // Células de uma nota só não têm "dentro": os três modos
  // dão exatamente o mesmo resultado.
  // ----------------------------------------------------------
  laneChangesWithinCell = "none",

  hitWindowRules = DEFAULT_HIT_WINDOW_RULES,

  // ----------------------------------------------------------
  // VISIBILIDADE
  //
  // Nenhuma destas flags muda as regras do jogo: uma nota
  // escondida continua a existir, a ser julgada e a contar
  // como MISS. Retiram informação, não notas.
  //
  // A linha e o preview são controlados por ÁREA, para dar um
  // degrau intermédio: manter o contorno do que se está a
  // tocar e perder só a antecipação do compasso seguinte.
  // ----------------------------------------------------------

  // GRELHA DE SUBDIVISÕES
  //
  // Riscos finos nas posições em que as notas podem cair,
  // dentro de cada tempo. Não revelam nada: desenham a grelha,
  // não o que está escrito nela — por isso continuam a fazer
  // sentido mesmo com visibleBeatsAhead ligado.
  //
  // Desligar deixa só os tempos: a subdivisão passa a ser
  // sentida em vez de lida.
  showSubdivisionGrid = true,

  // Linha que une os pontos no compasso ATIVO.
  showScorePath = true,

  // Linha no PREVIEW. Por defeito acompanha o ativo, por isso
  // os níveis que não a mencionam comportam-se como antes.
  showPreviewPath = showScorePath,

  // RASTO: quando não há linha à frente, o percurso é
  // desenhado ATRÁS da bola, à medida que ela passa.
  // Por defeito liga-se sozinho nos níveis sem linha, e não
  // aparece nos que já mostram o percurso todo.
  //
  // Não revela nada: só desenha o que já foi tocado.
  showScoreTrail = !showScorePath,

  // Em quantos tempos o rasto se apaga atrás da bola.
  // null = fica até ao fim do compasso.
  trailFadeBeats = 4,

  // Quantos tempos à frente da bola ficam visíveis.
  // null = tudo visível (comportamento original).
  // Atravessa a fronteira do compasso: com 2, no fim do
  // compasso já se acendem os primeiros tempos do preview.
  //
  // A área do preview continua sempre desenhada — o que muda
  // é ela poder ficar sem notas até a bola se aproximar.
  //
  // Só faz sentido com as linhas desligadas — caso contrário
  // o contorno denuncia o que os pontos escondem.
  visibleBeatsAhead = null,

  // Tempos que a nota demora a aparecer, para não surgir de
  // repente. Puramente estético.
  revealFadeBeats = 0.25
}) {
  const rhythms =
    allowedRhythms ?? [[...Array(subdivisionsPerBeat).keys()]];

  // Uma gralha no modo ("Split", "all") seria silenciosa e o
  // nível sairia com o comportamento errado — mais vale falhar
  // aqui, no arranque.
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