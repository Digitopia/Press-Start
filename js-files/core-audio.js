// ============================================================
// AUDIO
// ============================================================

let audioCtx = null;

// ============================================================
// Margem mínima entre criar os nós e o instante de arranque.
//
// Entre criar os nós, ligá-los e o grafo ser committed, a
// thread de áudio já avançou. Sem esta margem o setValueAtTime
// do ataque fica ancorado num instante passado, o ramp é
// avaliado a meio e o ganho arranca num valor não-nulo —
// é essa descontinuidade que se ouve como "click".
// ============================================================

const SFX_LOOKAHEAD_SECONDS = 0.005;

function ensureAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

// ============================================================
// DOIS CAMINHOS
//
// playBeep()     reação imediata a uma ação do jogador
//                (acerto, falha, perda de vida)
//
// scheduleBeep() instante exato, para tudo o que pertence ao
//                relógio musical (metrónomo, contagem)
// ============================================================

function playBeep(frequency, durationMs, volume = 0.25) {
  if (!audioCtx) return null;

  return scheduleBeep(
    frequency,
    durationMs,
    volume,
    audioCtx.currentTime + SFX_LOOKAHEAD_SECONDS
  );
}

function scheduleBeep(frequency, durationMs, volume, startTime) {
  if (!audioCtx) return null;

  const durationSeconds = durationMs / 1000;

  return scheduleTone({
    frequency,
    startTime,
    durationSeconds,
    volume,
    oscillator: "sine",
    attackSeconds: 0.004,
    releaseSeconds: durationSeconds
  });
}

function midiNoteToFrequency(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function scheduleTone({
  frequency,
  startTime,
  durationSeconds,
  volume,
  oscillator = "sine",
  attackSeconds = 0.01,
  releaseSeconds = 0.08,
  destination = audioCtx?.destination
}) {
  if (!audioCtx || !destination) return null;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const safeStartTime = Math.max(startTime, audioCtx.currentTime);
  const endTime = safeStartTime + durationSeconds;
  const attackEnd = Math.min(
    endTime,
    safeStartTime + attackSeconds
  );
  const releaseStart = Math.max(
    attackEnd,
    endTime - releaseSeconds
  );

  osc.type = oscillator;
  osc.frequency.value = frequency;

  gain.gain.setValueAtTime(0.0001, safeStartTime);
  gain.gain.linearRampToValueAtTime(volume, attackEnd);
  gain.gain.setValueAtTime(volume, releaseStart);
  gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

  osc.connect(gain);
  gain.connect(destination);

  osc.start(safeStartTime);

  // O ramp exponencial chega a 0.0001 (−80 dB) exatamente em
  // endTime, por isso cortar aí é inaudível.
  osc.stop(endTime);

  // ==========================================================
  // LIMPEZA
  //
  // Sem isto o GainNode fica ligado ao destino para sempre e
  // continua a ser processado a cada render quantum, mesmo
  // em silêncio. Numa sessão longa isto acumula.
  //
  // addEventListener e NÃO onended: o trackMusicSource() do
  // music-transport.js usa onended e sobreporia esta limpeza.
  // ==========================================================

  osc.addEventListener("ended", () => {
    osc.disconnect();
    gain.disconnect();
  });

  return osc;
}