// ============================================================
// createLevelRules() — PARÂMETROS
//
// OBRIGATÓRIOS
//   bpm                   velocidade (afeta também as janelas)
//   beatsPerBar           tempos por compasso (4 binário, 3 ternário)
//   density               0–1, hipótese de UM TEMPO ter notas
//
// RITMO
//   subdivisionsPerBeat   4 semicolcheias / 8 fusas / 6 ternário
//                         (duplicar = janelas a metade)
//   allowedRhythms        banco de células, ex. [0], [0,2], [0,1,2,3]
//                         (se omitido: rajada cheia — define sempre)
//   minNotesPerBar        mínimo por compasso
//                         máx: beatsPerBar × célula mais longa
//   introMinNotesPerBar   mínimo no 1.º compasso (tempo 1 vazio)
//                         defeito: proporcional ao minNotesPerBar
//                         máx: (beatsPerBar-1) × célula mais longa
//
// FILAS
//   laneCount             1–4; as cores são sorteadas a cada compasso
//   avoidConsecutiveRepeat      não repete fila seguida
//   laneChangesWithinCell       mudanças de fila DENTRO da célula
//                               "none"  uma cor por célula
//                               "split" a célula parte-se em dois
//                               "free"  cada nota escolhe fila
//
// VISIBILIDADE (não muda as regras, só a informação dada)
//   showSubdivisionGrid   riscos finos nas subdivisões do tempo
//   showScorePath         linha escura à frente da bola, no
//                         compasso ativo. Atrás dela há sempre
//                         rasto, com ou sem linha.
//   showPreviewPath       linha no preview (defeito: = showScorePath)
//   showScoreTrail        rasto quando showScorePath é false; com
//                         linha esta flag é ignorada
//                         (defeito: = !showScorePath)
//   trailFadeBeats        tempos até o rasto apagar (null = fica)
//   visibleBeatsAhead     tempos visíveis à frente da bola
//                         (null = tudo; atravessa os compassos)
//   revealFadeBeats       fade de entrada das notas (estético)
//
// TOLERÂNCIA
//   hitWindowRules        { perfect/good/ok: { ratio, maxMs } }
//
// CALCULADO
//   hitWindows            de bpm + subdivisões + allowedRhythms
//   crossingDurationMs    duração do compasso
//
// NOTA: as flags de visibilidade não são cumulativas entre níveis.
//
// FORA DAQUI (main-config.js, igual em todos os níveis)
//   HEALTH, FAILURES, LANES, MUSIC
// ============================================================

const LEVEL_CONFIGS = [

  // ==========================================================
  // LEVEL 1 — UMA SÓ FILA
  //
  // Aprender QUANDO bater: só semínimas, sempre no tempo.
  //
  // Janelas: PERFECT 55 / GOOD 100 / OK 160 ms
  // 3 notas em 4.0 s = 0.8 notas/segundo
  // ==========================================================

  createLevelRules({
    bpm: 60,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 1,
    allowedRhythms: [
      [0]     // semínima
    ],
    density: 0.3,
    minNotesPerBar: 3
  }),

  // ==========================================================
  // LEVEL 2 — O CONTRATEMPO
  //
  // Ainda uma só fila. Novidade: a célula [0,2], duas colcheias.
  //
  // Janelas: PERFECT 55 / GOOD 100 / OK 160 ms
  // 4 notas em 4.0 s = 1.0 nota/segundo
  // ==========================================================

  createLevelRules({
    bpm: 60,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 1,
    allowedRhythms: [
      [0],
      [0, 2]
    ],
    density: 0.4,
    minNotesPerBar: 4
  }),

  // ==========================================================
  // LEVEL 3 — O TEMPO FRACO SOZINHO
  //
  // Entra [2], a colcheia sem o tempo forte antes dela.
  // Ainda uma só fila: o foco é todo no ritmo.
  //
  // Janelas: PERFECT 55 / GOOD 100 / OK 160 ms
  // 4 notas em 3.8 s = 1.1 notas/segundo
  // ==========================================================

  createLevelRules({
    bpm: 63,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 1,
    allowedRhythms: [
      [0],
      [2],
      [0, 2]
    ],
    density: 0.5,
    minNotesPerBar: 4,
  }),

  // ==========================================================
  // LEVEL 4 — SEGUNDA FILA E A RAJADA
  //
  // Entra a segunda fila e [0,1,2,3], o tempo cheio. É o maior
  // salto de precisão do jogo: com notas a uma subdivisão de
  // distância, a janela OK cai de 160 para 114 ms.
  //
  // Janelas: PERFECT 52 / GOOD 95 / OK 114 ms
  // 6 notas em 3.8 s = 1.6 notas/segundo
  // ==========================================================

  createLevelRules({
    bpm: 63,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 2,
    allowedRhythms: [
      [0],
      [2],
      [0, 2],
      [0, 1, 2, 3]
    ],
    density: 0.5,
    minNotesPerBar: 6,
    avoidConsecutiveRepeat: true
  }),

  // ==========================================================
  // LEVEL 5 — TERCEIRA FILA
  //
  // Terceira fila, e as células soltas de duas e três notas:
  // [2,3] e [0,2,3].
  //
  // Janelas: PERFECT 50 / GOOD 91 / OK 109 ms
  // 6 notas em 3.6 s = 1.7 notas/segundo
  // ==========================================================

  createLevelRules({
    bpm: 66,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 3,
    allowedRhythms: [
      [0],
      [2],
      [0, 2],
      [0, 1, 2, 3],
      [0, 2, 3],
      [2, 3]
    ],
    density: 0.55,
    minNotesPerBar: 6,
    avoidConsecutiveRepeat: true
  }),

  // ==========================================================
  // LEVEL 6 — O COMPASSO ENCHE
  //
  // Entra [0,3] e o mínimo sobe a 8 notas. Mesmo bpm do 5: o
  // degrau é só a densidade. A linha ainda cá está — sai no 7.
  //
  // Janelas: PERFECT 50 / GOOD 91 / OK 109 ms
  // 8 notas em 3.6 s = 2.2 notas/segundo
  // ==========================================================

  createLevelRules({
    bpm: 66,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 3,
    allowedRhythms: [
      [0],
      [2],
      [0, 2],
      [0, 1, 2, 3],
      [0, 2, 3],
      [2, 3],
      [0, 3]
    ],
    density: 0.6,
    minNotesPerBar: 8,
    avoidConsecutiveRepeat: true,
  }),

  // ==========================================================
  // LEVEL 7 — QUARTA FILA, SEM LINHA
  //
  // Entra a quarta fila, e saem a linha e a grelha de
  // subdivisões: à frente da bola deixa de haver informação.
  //
  // Janelas: PERFECT 47 / GOOD 86 / OK 103 ms
  // 8 notas em 3.4 s = 2.3 notas/segundo
  // ==========================================================

  createLevelRules({
    bpm: 70,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 4,
    allowedRhythms: [
      [0],
      [2],
      [0, 2],
      [0, 1, 2, 3],
      [0, 2, 3],
      [2, 3],
      [0, 3]
    ],
    density: 0.7,
    minNotesPerBar: 8,
    avoidConsecutiveRepeat: true,

    showScorePath: false,
    showPreviewPath: false,
    showSubdivisionGrid: false
  }),

  // ==========================================================
  // LEVEL 8 — DOIS TEMPOS À FRENTE
  //
  // As notas só aparecem a dois tempos: passa a ser reação.
  // Mesmas regras do 7 — o degrau é só a antecipação que se
  // tira. A partir daqui não é suposto ganhar-se.
  //
  // Janelas: PERFECT 47 / GOOD 86 / OK 103 ms
  // 8 notas em 3.4 s = 2.3 notas/segundo
  // ==========================================================

  createLevelRules({
    bpm: 70,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 4,
    allowedRhythms: [
      [0],
      [2],
      [0, 2],
      [0, 1, 2, 3],
      [0, 2, 3],
      [2, 3],
      [0, 3]
    ],
    density: 0.7,
    minNotesPerBar: 8,
    avoidConsecutiveRepeat: true,

    showScorePath: false,
    showPreviewPath: false,
    showSubdivisionGrid: false,
    visibleBeatsAhead: 2
  }),

  // ==========================================================
  // LEVEL 9 — MAIS DEPRESSA
  //
  // Sobe a 76 bpm, entra [0,1,3] e a densidade aperta. Continuam
  // a ver-se dois tempos à frente, mas há menos tempo para
  // decidir.
  //
  // Janelas: PERFECT 43 / GOOD 79 / OK 95 ms
  // 8 notas em 3.2 s = 2.5 notas/segundo
  // ==========================================================

  createLevelRules({
    bpm: 76,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 4,
    allowedRhythms: [
      [0],
      [2],
      [0, 2],
      [0, 1, 2, 3],
      [0, 2, 3],
      [2, 3],
      [0, 3],
      [0, 1, 3]
    ],
    density: 0.8,
    minNotesPerBar: 8,
    avoidConsecutiveRepeat: true,

    showScorePath: false,
    showPreviewPath: false,
    showSubdivisionGrid: false,
    visibleBeatsAhead: 2
  }),

  // ==========================================================
  // LEVEL 10 — SATURAÇÃO
  //
  // Densidade quase máxima, mínimo de 10 notas, e a cor a mudar
  // dentro da célula ("free"): cada nota pode cair noutra fila.
  // É suposto ver-se até onde se vai.
  //
  // Janelas: PERFECT 43 / GOOD 79 / OK 95 ms
  // 10 notas em 3.2 s = 3.2 notas/segundo
  // ==========================================================

  createLevelRules({
    bpm: 76,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 4,
    allowedRhythms: [
      [0],
      [2],
      [0, 2],
      [0, 1, 2, 3],
      [0, 2, 3],
      [2, 3],
      [0, 3],
      [0, 1, 3]
    ],
    density: 0.9,
    minNotesPerBar: 10,

    avoidConsecutiveRepeat: true,
    laneChangesWithinCell: "free",

    showScorePath: false,
    showPreviewPath: false,
    showSubdivisionGrid: false,
    visibleBeatsAhead: 2
  })
];