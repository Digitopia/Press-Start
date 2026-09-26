// ============================================================
// AUDIO
// ============================================================

let audioCtx = null;

// ============================================================
// Margem entre criar os nós e o arranque. Sem ela o ataque
// ancora num instante passado e ouve-se um "click".
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
// scheduleBeep() — beep simples num instante exato, para o
// relógio musical: metrónomo e contagem inicial.
//
// destination omitido = direto à saída. Passar um gain próprio
// permite calar beeps já agendados (ex.: metrónomo).
// ============================================================
function scheduleBeep(frequency, durationMs, volume, startTime, destination) {
  if (!audioCtx) return null;

  const durationSeconds = durationMs / 1000;

  return scheduleTone({
    frequency,
    startTime,
    durationSeconds,
    volume,
    oscillator: "sine",
    attackSeconds: 0.004,
    releaseSeconds: durationSeconds,
    destination
  });
}

function midiNoteToFrequency(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

// ============================================================
// REVERB PARTILHADA
//
// Uma sala comum ao jogador e à música, para soarem juntos.
// Cada bus liga-se com o seu próprio send (PLAYER_AUDIO /
// MUSIC.reverbSend); returnVolume pesa a sala na mistura.
//
// normalize = false: o impulso de ruído denso seria atenuado
// pelo browser e o reverbSend quase não se ouviria.
// ============================================================

const SHARED_REVERB = { input: null, convolver: null, returnGain: null };
const SHARED_REVERB_RETURN_VOLUME = 0.15;

// Pre-delay: separa a cauda da batida, que fica mais nítida.
const SHARED_REVERB_PRE_DELAY_SECONDS = 0.02;

function createReverbImpulse(durationSeconds = 0.6, decay = 0.8) {
  const length = Math.floor(audioCtx.sampleRate * durationSeconds);
  const impulse = audioCtx.createBuffer(2, length, audioCtx.sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    let smoothed = 0;

    for (let i = 0; i < length; i++) {
      const progress = i / length;
      const envelope = Math.pow(1 - progress, decay);
      const noise = Math.random() * 2 - 1;

      // Passa-baixo cada vez mais fechado: a cauda escurece e
      // soa a sala em vez de "hiss".
      const smoothing = 0.9 - progress * 0.85;
      smoothed += smoothing * (noise - smoothed);

      // 0.6 evita saturar sem normalize.
      data[i] = smoothed * envelope * 0.6;
    }
  }

  return impulse;
}

function getSharedReverbBus() {
  if (!audioCtx) return null;

  if (!SHARED_REVERB.input) {
    SHARED_REVERB.input = audioCtx.createDelay(1.0);
    SHARED_REVERB.input.delayTime.value = SHARED_REVERB_PRE_DELAY_SECONDS;

    SHARED_REVERB.convolver = audioCtx.createConvolver();
    SHARED_REVERB.convolver.normalize = false;
    SHARED_REVERB.convolver.buffer = createReverbImpulse();

    SHARED_REVERB.returnGain = audioCtx.createGain();
    SHARED_REVERB.returnGain.gain.value = SHARED_REVERB_RETURN_VOLUME;

    SHARED_REVERB.input.connect(SHARED_REVERB.convolver);
    SHARED_REVERB.convolver.connect(SHARED_REVERB.returnGain);
    SHARED_REVERB.returnGain.connect(audioCtx.destination);
  }

  return SHARED_REVERB.input;
}

// Envia source para a sala, mantendo a ligação seca.
function sendToSharedReverb(source, sendLevel) {
  const reverbBus = getSharedReverbBus();

  if (!reverbBus || !sendLevel) return null;

  const send = audioCtx.createGain();
  send.gain.value = sendLevel;

  source.connect(send);
  send.connect(reverbBus);

  return send;
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

  // Em endTime o ganho já está a −80 dB: corte inaudível.
  osc.stop(endTime);

  // Desliga os nós no fim para não acumularem. addEventListener
  // e não onended, que é usado por trackMusicSource().

  osc.addEventListener("ended", () => {
    osc.disconnect();
    gain.disconnect();
  });

  return osc;
}