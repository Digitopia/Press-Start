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

// ============================================================
// REVERB PARTILHADA
//
// O bus do jogador e o sessionGain da música são dois caminhos
// paralelos que nunca se tocam — cada um vai direto ao seu
// destination. Isto dá-lhes clareza, mas não lhes dá uma sala
// em comum: soam lado a lado, não juntos.
//
// Esta é essa sala. Um único ConvolverNode, com um impulso
// sintético (não há nenhum ficheiro de áudio no jogo, gerar é
// mais simples que ir buscar um). Cada emissor liga-se aqui
// através do SEU PRÓPRIO gain de send — a sala é uma só, mas
// a quantidade que cada bus lhe manda é regulada perto de onde
// esse bus já configura o resto do seu volume
// (PLAYER_AUDIO.reverbSend, MUSIC.reverbSend).
//
// returnVolume é o único botão a mais: quanto a sala em si
// pesa na mistura final, independente do que cada lado lhe
// manda.
//
// normalize = false de propósito. Por omissão o ConvolverNode
// reescala o impulso para manter potência unitária — e o nosso
// impulso é ruído denso ao longo de toda a duração (não um
// impulso real de sala, que é sobretudo silêncio com uns picos),
// por isso tem MUITA energia total. Com normalize ligado, o
// browser baixava-lhe o ganho sozinho, por trás das costas do
// reverbSend — subir o send quase não se ouvia. Desligado, o
// volume da sala é só o que está aqui escrito.
// ============================================================

const SHARED_REVERB = { input: null, convolver: null, returnGain: null };
const SHARED_REVERB_RETURN_VOLUME = 0.15;

// Afasta a cauda do impacto direto — sem isto a reverb começa
// no mesmo instante da batida e cola-se a ela; com um pre-delay
// curto, o ouvido separa as duas e a batida continua nítida.
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

      // Passa-baixo de um polo, cada vez mais apertado ao longo
      // da cauda: os agudos das primeiras reflexões sobrevivem,
      // o fim da cauda já só tem grave. É isto que soa a SALA —
      // ruído sem esta variação soa só a "hiss" parado.
      const smoothing = 0.9 - progress * 0.85;
      smoothed += smoothing * (noise - smoothed);

      // 0.6 compensa o normalize desligado: sem ele, ruído denso
      // nos dois canais durante quase um segundo satura fácil.
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

// Liga source à sala partilhada através de um gain de send
// dedicado, sem tocar na ligação seca que source já tem.
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