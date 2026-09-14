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
//                         defeito: proporcional ao minNotesPerBar,
//                         para o compasso de introdução não ficar
//                         MAIS denso que os normais
//                         máx: (beatsPerBar-1) × célula mais longa
//
// FILAS
//   laneCount             1–4; as cores são sorteadas a cada compasso
//   avoidConsecutiveRepeat      não repete fila seguida
//   allowLaneChangesWithinCell  cada nota da célula muda de fila
//
// VISIBILIDADE (não muda as regras, só a informação dada)
//   showScorePath         linha no compasso ativo
//   showPreviewPath       linha no preview (defeito: = showScorePath)
//   showScoreTrail        rasto atrás da bola quando não há linha
//                         (defeito: = !showScorePath)
//   trailFadeBeats        tempos até o rasto apagar (null = fica)
//   visibleBeatsAhead     tempos visíveis à frente da bola
//                         (null = tudo; atravessa os compassos)
//                         a área do preview fica sempre no ecrã,
//                         só pode ficar sem notas
//   revealFadeBeats       fade de entrada das notas (estético)
//
// TOLERÂNCIA
//   hitWindowRules        { perfect/good/ok: { ratio, maxMs } }
//
// CALCULADO
//   hitWindows            de bpm + subdivisões + allowedRhythms
//   crossingDurationMs    duração do compasso
//
// NOTA: as flags de visibilidade NÃO são cumulativas. Cada
// nível é lido isoladamente — um nível que queira manter a
// linha escondida tem de a voltar a desligar.
//
// FORA DAQUI (main-config.js, igual em todos os níveis)
//   HEALTH, FAILURES, LANES, MUSIC
// ============================================================

const LEVEL_CONFIGS = [

  // ==========================================================
  // LEVEL 1 — UMA SÓ FILA
  //
  //Aprender simplesmente QUANDO bater. 
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
      [0],     // semínima
      [2]      // colcheia no contratempo
    ],
    density: 0.3,
    minNotesPerBar: 4,

    // O primeiro tempo do compasso de introdução fica sempre
    // vazio, para dar tempo de ler a partitura nova. Como cada
    // célula deste nível tem uma nota, só cabem três — e é
    // exatamente isso que o defeito proporcional dá.
    introMinNotesPerBar: 3
  }),

  // ==========================================================
  // LEVEL 2 — DUAS FILAS
  //
  // O degrau é só a escolha de fila: bpm, densidade e janelas
  // ficam exatamente iguais ao nível 1. Entra a célula [0,2].
  //
  // Janelas: PERFECT 55 / GOOD 100 / OK 160 ms
  // 4 notas em 4.0 s = 1.0 nota/segundo
  // ==========================================================

  createLevelRules({
    bpm: 60,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 2,
    allowedRhythms: [
      [0],
      [0, 2],
      [2]
    ],
    density: 0.4,
    minNotesPerBar: 4,

    // TO TEST VISIBILITY RULES
    // showPreviewPath: false,
    // showScorePath: false,
    // visibleBeatsAhead: 1
  }),

  // ==========================================================
  // LEVEL 3 — O SALTO DE PRECISÃO
  //
  // Continua com duas filas: o degrau é inteiramente rítmico.
  //
  // Entra [2,3], a primeira célula com duas notas coladas. 
  // É o maior salto de precisão do jogo inteiro.
  //
  // Com laneCount 2 e avoidConsecutiveRepeat, o gerador fica
  // sem escolha de cor: as filas alternam rigidamente. Aqui
  // isso ajuda, porque deixa a atenção toda para o ritmo.
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
      [2, 3]
    ],
    density: 0.5,
    minNotesPerBar: 6,
    avoidConsecutiveRepeat: true
  }),

  // ==========================================================
  // LEVEL 4 — TRÊS FILAS
  //
  // Entra a terceira fila, e com ela volta a haver escolha de cor.
  //
  // No ritmo quase nada muda: sai [0,2] e entra [0,3], que é
  // a mesma ideia de antecipação do [2,3] mas a abrir o tempo
  // em vez de o fechar.
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
      [0, 3],
      [2, 3]
    ],
    density: 0.5,
    minNotesPerBar: 6,
    avoidConsecutiveRepeat: true
  }),

  // ==========================================================
  // LEVEL 5 — QUATRO FILAS, CÉLULAS DE TRÊS NOTAS
  //
  // Entra a quarta fila e as duas primeiras células de três
  // notas, [0,2,3] e [0,1,3]: pela primeira vez um único
  // tempo pode conter três ataques.
  //
  // Janelas: PERFECT 47 / GOOD 86 / OK 103 ms
  // 6 notas em 3.4 s = 1.8 notas/segundo
  // ==========================================================

  createLevelRules({
    bpm: 66,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 4,
    allowedRhythms: [
      [0],
      [2],
      [0, 3],
      [0, 2],
      [2, 3],
      [0, 2, 3],
      [0, 1, 3]
    ],
    density: 0.55,
    minNotesPerBar: 6,
    avoidConsecutiveRepeat: true
  }),

  // ==========================================================
  // LEVEL 6 — O TEMPO CHEIO, E A LINHA DESAPARECE
  //
  // Entra [0,1,2,3]: como as filas ainda não mudam dentro da
  // célula, é uma rajada na mesma cor.
  //
  // E cai a linha — primeira informação retirada. Sem ela
  // perde-se o contorno para antecipação de para onde a bola
  // vai saltar.
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
      [2, 3],
      [0, 1, 3],
      [0, 2, 3],
      [0, 1, 2, 3]
    ],
    density: 0.6,
    minNotesPerBar: 8,
    avoidConsecutiveRepeat: true,

    showScorePath: false,
    showPreviewPath: false
  }),

  // ==========================================================
  // LEVEL 7 — A CÉLULA PARTE-SE
  //
  // allowLaneChangesWithinCell: a rajada do nível anterior
  // deixa de ser uma cor só e pode saltar de fila em cada
  // semicolcheia.
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
      [2, 3],
      [0, 1, 3],
      [0, 2, 3],
      [0, 1, 2, 3]
    ],
    density: 0.7,
    minNotesPerBar: 10,
    avoidConsecutiveRepeat: true,
    allowLaneChangesWithinCell: true,

    // As flags são por nível, não cumulativas: sem estas duas
    // a linha voltava a aparecer aqui.
    showScorePath: false,
    showPreviewPath: false
  }),

  // ==========================================================
  // LEVEL 8 — DOIS TEMPOS À FRENTE
  //
  // As notas passam a acender-se só quando a bola está a dois
  // tempos de distância.
  //
  // Deixa de ser leitura à primeira vista e passa a ser reação.
  //
  // Entra também [1,3], a única célula que ignora por
  // completo o tempo forte.
  //
  // A partir daqui não é suposto ganhar-se.
  //
  // Janelas: PERFECT 41 / GOOD 75 / OK 90 ms
  // 12 notas em 3.0 s = 4.0 notas/segundo
  // ==========================================================

  createLevelRules({
    bpm: 80,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 4,
    allowedRhythms: [
      [0],
      [2],
      [0, 2],
      [1, 3],
      [2, 3],
      [0, 1, 3],
      [0, 2, 3],
      [0, 1, 2, 3]
    ],
    density: 0.8,
    minNotesPerBar: 12,
    avoidConsecutiveRepeat: true,
    allowLaneChangesWithinCell: true,

    showScorePath: false,
    showPreviewPath: false,
    visibleBeatsAhead: 2
  }),

  // ==========================================================
  // LEVEL 9 — UM TEMPO À FRENTE
  //
  // O tempo de reação de escolha entre quatro alternativas anda pelos
  // 350–450 ms, portanto já não sobra margem para errar a
  // fila e corrigir.
  //
  // Janelas: PERFECT 39 / GOOD 71 / OK 86 ms
  // 14 notas em 2.9 s = 4.9 notas/segundo
  // ==========================================================

  createLevelRules({
    bpm: 84,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 4,
    allowedRhythms: [
      [0],
      [2],
      [0, 2],
      [1, 3],
      [2, 3],
      [0, 1, 3],
      [0, 2, 3],
      [0, 1, 2, 3]
    ],
    density: 0.9,
    minNotesPerBar: 14,
    avoidConsecutiveRepeat: true,
    allowLaneChangesWithinCell: true,

    showScorePath: false,
    showPreviewPath: false,
    visibleBeatsAhead: 1
  }),

  // ==========================================================
  // LEVEL 10 — SATURAÇÃO
  // 
  // A densidade — density 1.0 e 16 nota –  é o máximo que a
  // grelha permite num compasso. 
  //
  // Cai também o rasto: sem linha, sem preview útil e sem
  // percurso atrás, resta a grelha de tempos.
  //
  // Não é suposto ganhar-se. É suposto ver-se até onde se vai.
  //
  // Janelas: PERFECT 38 / GOOD 68 / OK 82 ms
  // 16 notas em 2.7 s = 5.9 notas/segundo
  // ==========================================================

  createLevelRules({
    bpm: 88,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 4,
    allowedRhythms: [
      [0],
      [2],
      [0, 2],
      [1, 3],
      [2, 3],
      [0, 1, 3],
      [0, 2, 3],
      [0, 1, 2, 3]
    ],
    density: 1.0,
    minNotesPerBar: 16,

    // Único nível que precisa de o escrever: o proporcional
    // daria 12, que é o máximo teórico, e o compasso de
    // introdução ficaria sempre igual e saturado.
    introMinNotesPerBar: 10,

    avoidConsecutiveRepeat: true,
    allowLaneChangesWithinCell: true,

    showScorePath: false,
    showPreviewPath: false,
    showScoreTrail: false, // tira o rasto da bola
    visibleBeatsAhead: 1
  })
];