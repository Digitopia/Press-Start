// ============================================================
// ÁUDIO DO JOGADOR
//
// Sons de resposta ao jogador: acerto, erro, vida, fim de jogo.
// ============================================================


// ============================================================
// CONFIGURAÇÃO
//
// lanes      voz de cada fila
// accent     volume por julgamento
// failures   voz de cada erro; null = silêncio
// ============================================================

const PLAYER_AUDIO = {
    // Volume do bus do jogador, independente do da música.
    masterVolume: 0.25,

    // Envio para a reverb, antes da saturação.
    reverbSend: 0.07,

    accent: {
        PERFECT: 1.0,
        GOOD: 0.8,
        OK: 0.6
    },

    // Do agudo (topo do ecrã) ao grave.
    lanes: {
        blue: { voice: "hihat", volume: 0.3 },
        green: { voice: "clap", volume: 0.7 },
        yellow: { voice: "snare", volume: 0.25 },
        red: { voice: "kick", volume: 0.35 }
    },

    // Chaves de FAILURES. O miss é mudo: o silêncio é o feedback.
    failures: {
        miss: null,
        wrong: { voice: "thud", volume: 0.55 },
        stray: { voice: "tick", volume: 0.20 }
    },

    // Vozes longas e raras, por isso mais altas.
    lifeLost: { voice: "fall", volume: 0.85 },
    gameOver: { voice: "collapse", volume: 1.00 }
};


// ============================================================
// BUS
//
// Todas as vozes do jogador; vai direto ao destination.
// ============================================================

const PLAYER_BUS = { gain: null, saturator: null };

// ============================================================
// SATURAÇÃO DO BUS
//
// tanh gera harmónicos para o grave se ouvir em colunas
// pequenas, e cola as vozes entre si.
// ============================================================

function createSaturationCurve(amount = 3) {
    const sampleCount = 2048;
    const curve = new Float32Array(sampleCount);
    const normalizer = Math.tanh(amount);

    for (let index = 0; index < sampleCount; index++) {
        const x = (index / (sampleCount - 1)) * 2 - 1;
        curve[index] = Math.tanh(amount * x) / normalizer;
    }

    return curve;
}

function getPlayerBus() {
    if (!audioCtx) return null;

    if (!PLAYER_BUS.gain) {
        PLAYER_BUS.gain = audioCtx.createGain();
        PLAYER_BUS.gain.gain.value = PLAYER_AUDIO.masterVolume;

        PLAYER_BUS.saturator = audioCtx.createWaveShaper();
        PLAYER_BUS.saturator.curve = createSaturationCurve();
        PLAYER_BUS.saturator.oversample = "4x";

        PLAYER_BUS.gain.connect(PLAYER_BUS.saturator);
        PLAYER_BUS.saturator.connect(audioCtx.destination);

        sendToSharedReverb(PLAYER_BUS.gain, PLAYER_AUDIO.reverbSend);
    }

    return PLAYER_BUS.gain;
}


// ============================================================
// ENVOLVENTE
//
// Sobe, segura (hold), cai. O hold dá corpo à batida.
//
// sustain* (opcional) acrescenta um patamar plano a meio da
// queda: pico -> sustainLevel -> parado -> cauda até 0.
// ============================================================

function applyPercussiveEnvelope(gain, {
    startTime,
    durationSeconds,
    volume,
    attackSeconds,
    holdSeconds = 0,
    sustainLevel = 0,
    sustainDecaySeconds = 0,
    sustainHoldSeconds = 0
}) {
    const endTime = startTime + durationSeconds;
    const attackEnd = Math.min(endTime, startTime + attackSeconds);
    const holdEnd = Math.min(endTime, attackEnd + holdSeconds);
    const bodyLevel = volume * sustainLevel;
    const decayEnd = Math.min(endTime, holdEnd + sustainDecaySeconds);
    const sustainEnd = Math.min(endTime, decayEnd + sustainHoldSeconds);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, attackEnd);

    if (holdEnd > attackEnd) {
        gain.gain.setValueAtTime(volume, holdEnd);
    }

    if (bodyLevel > 0 && decayEnd > holdEnd) {
        gain.gain.exponentialRampToValueAtTime(bodyLevel, decayEnd);

        if (sustainEnd > decayEnd) {
            gain.gain.setValueAtTime(bodyLevel, sustainEnd);
        }
    }

    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    return endTime;
}


// ============================================================
// RUÍDO BRANCO
//
// Um buffer de 1 s partilhado, para não gerar lixo por nota.
// ============================================================

let noiseBuffer = null;

function getNoiseBuffer() {
    if (!audioCtx) return null;

    if (noiseBuffer && noiseBuffer.sampleRate === audioCtx.sampleRate) {
        return noiseBuffer;
    }

    const length = Math.floor(audioCtx.sampleRate);
    const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < length; index++) {
        data[index] = Math.random() * 2 - 1;
    }

    noiseBuffer = buffer;

    return noiseBuffer;
}


// ============================================================
// PRIMITIVA 1 — RAJADA DE RUÍDO
// ============================================================

function scheduleNoiseBurst({
    startTime,
    durationSeconds,
    volume,
    filterType = "highpass",
    frequency = 1000,
    q = 1,
    attackSeconds = 0.001,
    holdSeconds = 0
}) {
    const bus = getPlayerBus();
    const buffer = getNoiseBuffer();

    if (!bus || !buffer) return null;

    const source = audioCtx.createBufferSource();
    const filter = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();

    const safeStartTime = Math.max(startTime, audioCtx.currentTime);

    source.buffer = buffer;
    source.loop = true;

    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;

    const endTime = applyPercussiveEnvelope(gain, {
        startTime: safeStartTime,
        durationSeconds,
        volume,
        attackSeconds,
        holdSeconds
    });

    source.connect(filter);
    filter.connect(gain);
    gain.connect(bus);

    // Offset aleatório, para batidas seguidas não soarem iguais.
    source.start(safeStartTime, Math.random() * buffer.duration);
    source.stop(endTime);

    source.addEventListener("ended", () => {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
    });

    return source;
}


// ============================================================
// PRIMITIVA 2 — CORPO AFINADO COM QUEDA DE ALTURA
//
// A queda de frequência transforma o beep num bombo ou tom.
// ============================================================

function schedulePercussiveTone({
    startTime,
    durationSeconds,
    volume,
    startFrequency,
    endFrequency = startFrequency,
    pitchDecaySeconds = 0.04,
    oscillator = "sine",
    attackSeconds = 0.002,
    holdSeconds = 0,
    sustainLevel = 0,
    sustainDecaySeconds = 0,
    sustainHoldSeconds = 0
}) {
    const bus = getPlayerBus();

    if (!bus) return null;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    const safeStartTime = Math.max(startTime, audioCtx.currentTime);

    osc.type = oscillator;
    osc.frequency.setValueAtTime(startFrequency, safeStartTime);

    if (endFrequency !== startFrequency) {
        osc.frequency.exponentialRampToValueAtTime(
            endFrequency,
            safeStartTime + Math.min(pitchDecaySeconds, durationSeconds)
        );
    }

    const endTime = applyPercussiveEnvelope(gain, {
        startTime: safeStartTime,
        durationSeconds,
        volume,
        attackSeconds,
        holdSeconds,
        sustainLevel,
        sustainDecaySeconds,
        sustainHoldSeconds
    });

    osc.connect(gain);
    gain.connect(bus);

    osc.start(safeStartTime);
    osc.stop(endTime);

    // addEventListener: onended é do transporte.
    osc.addEventListener("ended", () => {
        osc.disconnect();
        gain.disconnect();
    });

    return osc;
}


// ============================================================
// PRIMITIVA 3 — METAL
//
// Quadrados em razões inarmónicas, filtrados (como no TR-808):
// soa a metal em vez de nota.
// ============================================================

const METALLIC_RATIOS = [1, 1.47, 1.79, 2.41, 2.93, 3.41];

function scheduleMetallicBurst({
    startTime,
    durationSeconds,
    volume,
    baseFrequency,
    ratios = METALLIC_RATIOS,
    filterType = "highpass",
    frequency = 7000,
    q = 0.7,
    attackSeconds = 0.0005,
    holdSeconds = 0
}) {
    const bus = getPlayerBus();

    if (!bus) return null;

    const filter = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();

    const safeStartTime = Math.max(startTime, audioCtx.currentTime);

    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;

    const endTime = applyPercussiveEnvelope(gain, {
        startTime: safeStartTime,
        durationSeconds,
        // Dividido pelas parciais, que se somam.
        volume: volume / ratios.length,
        attackSeconds,
        holdSeconds
    });

    filter.connect(gain);
    gain.connect(bus);

    const oscillators = ratios.map(ratio => {
        const osc = audioCtx.createOscillator();

        osc.type = "square";
        osc.frequency.value = baseFrequency * ratio;
        osc.connect(filter);
        osc.start(safeStartTime);
        osc.stop(endTime);

        return osc;
    });

    // Param todos juntos: basta um listener.
    oscillators[oscillators.length - 1].addEventListener("ended", () => {
        for (const osc of oscillators) osc.disconnect();
        filter.disconnect();
        gain.disconnect();
    });

    return oscillators[0];
}


// ============================================================
// VOZES — PERCUSSÃO (ACERTO)
//
// Cada voz recebe (startTime, volume) já com fila e acento.
// Curtas e secas: nos níveis densos são mais de 3 notas/s.
// ============================================================

const PERCUSSION_VOICES = {

    // Corpo em triangle: harmónicos próprios, mais peso que sine.
    kick(startTime, volume) {
        schedulePercussiveTone({
            startTime,
            durationSeconds: 0.75,
            volume: volume * 0.95,
            startFrequency: 135,
            // Grave, mas ainda audível em colunas pequenas.
            endFrequency: 46,
            // Rápida: o peso vem do sustain, não daqui.
            pitchDecaySeconds: 0.05,
            oscillator: "triangle",
            attackSeconds: 0.002,
            holdSeconds: 0.012,
            // Patamar a 42% durante 80ms: o corpo do bombo.
            sustainLevel: 0.42,
            sustainDecaySeconds: 0.012,
            sustainHoldSeconds: 0.08
        });

        // Click do ataque, para contrastar com o grave.
        schedulePercussiveTone({
            startTime,
            durationSeconds: 0.32,
            volume: volume * 0.26,
            startFrequency: 900,
            endFrequency: 300,
            pitchDecaySeconds: 0.008,
            oscillator: "sine",
            attackSeconds: 0.0005
        });

        // Click de ruído de 18ms, distinto do da tarola.
        scheduleNoiseBurst({
            startTime,
            durationSeconds: 0.018,
            volume: volume * 0.45,
            filterType: "highpass",
            frequency: 5500,
            q: 0.7,
            attackSeconds: 0.0003
        });

        // Cauda grave fixa: o "chão" que se sente.
        schedulePercussiveTone({
            startTime,
            durationSeconds: 1.4,
            volume: volume * 0.20,
            startFrequency: 50,
            oscillator: "sine",
            attackSeconds: 0.006,
            holdSeconds: 0.15
        });
    },

    // Duas peles + bordoneira em bandpass (para não invadir o hihat).
    snare(startTime, volume) {
        schedulePercussiveTone({
            startTime,
            durationSeconds: 0.13,
            volume: volume * 0.38,
            startFrequency: 200,
            endFrequency: 168,
            pitchDecaySeconds: 0.05,
            oscillator: "sine",
            attackSeconds: 0.001,
            holdSeconds: 0.006,
            // Patamar curto para dar corpo.
            sustainLevel: 0.42,
            sustainDecaySeconds: 0.008,
            sustainHoldSeconds: 0.03
        });

        schedulePercussiveTone({
            startTime,
            durationSeconds: 0.08,
            volume: volume * 0.20,
            startFrequency: 345,
            endFrequency: 300,
            pitchDecaySeconds: 0.04,
            oscillator: "sine",
            attackSeconds: 0.001
        });

        scheduleNoiseBurst({
            startTime,
            durationSeconds: 0.3,
            volume: volume * 0.48,
            filterType: "bandpass",
            frequency: 2600,
            q: 1.0,
            attackSeconds: 0.0005,
            holdSeconds: 0.006
        });
    },

    // Duas reflexões: o atraso entre elas faz a palma.
    clap(startTime, volume) {
        const reflections = [
            { offset: 0, volume: 0.9 },
            { offset: 0.010, volume: 0.65 }
        ];

        for (const reflection of reflections) {
            scheduleNoiseBurst({
                startTime: startTime + reflection.offset,
                durationSeconds: 0.014,
                volume: volume * reflection.volume * 0.75,
                filterType: "bandpass",
                frequency: 1500,
                q: 1.8,
                attackSeconds: 0.0004
            });
        }

        scheduleNoiseBurst({
            startTime: startTime + 0.022,
            durationSeconds: 0.085,
            volume: volume * 0.46,
            filterType: "bandpass",
            frequency: 1350,
            q: 1.5,
            attackSeconds: 0.0008
        });
    },

    // Metal. Testar em nível denso antes de alongar.
    hihat(startTime, volume) {
        scheduleMetallicBurst({
            startTime,
            durationSeconds: 0.15,
            volume: volume * 0.45,
            baseFrequency: 320,
            filterType: "highpass",
            frequency: 5200,
            q: 0.8
        });

        // O "shhh" de ar, acima da tarola.
        scheduleNoiseBurst({
            startTime,
            durationSeconds: 0.1,
            volume: volume * 0.40,
            filterType: "highpass",
            frequency: 8000,
            q: 0.7,
            attackSeconds: 0.0008
        });
    },
};


// ============================================================
// VOZES — ERRO E CONSEQUÊNCIA
//
// Erros curtos, para não tapar a nota seguinte. As
// consequências tocam com a música já parada e podem ser longas.
// ============================================================

const FEEDBACK_VOICES = {

    // Tempo certo, fila errada. Um fall() em miniatura (~0.2s);
    // dois tons desafinados dão a sensação de coisa torta.
    thud(startTime, volume) {
        // Golpe curtíssimo.
        scheduleNoiseBurst({
            startTime,
            durationSeconds: 0.025,
            volume: volume * 0.20,
            filterType: "lowpass",
            frequency: 300,
            q: 0.7,
            attackSeconds: 0.001
        });

        schedulePercussiveTone({
            startTime,
            durationSeconds: 0.18,
            volume: volume * 0.26,
            startFrequency: 183,
            endFrequency: 120,
            pitchDecaySeconds: 0.10,
            oscillator: "triangle",
            attackSeconds: 0.004
        });

        // Square: aresta extra ao batimento.
        schedulePercussiveTone({
            startTime,
            durationSeconds: 0.18,
            volume: volume * 0.15,
            startFrequency: 180,
            endFrequency: 126,
            pitchDecaySeconds: 0.10,
            oscillator: "square",
            attackSeconds: 0.004
        });

        // Cauda grave, acima do kick (50Hz).
        schedulePercussiveTone({
            startTime,
            durationSeconds: 0.20,
            volume: volume * 0.14,
            startFrequency: 85,
            oscillator: "sine",
            attackSeconds: 0.01,
            holdSeconds: 0.02
        });
    },

    // Bateu sem nota por perto. Pequeno e grave, para não
    // se confundir com o clap.
    tick(startTime, volume) {
        schedulePercussiveTone({
            startTime,
            durationSeconds: 0.03,
            volume: volume * 0.30,
            startFrequency: 260,
            endFrequency: 180,
            pitchDecaySeconds: 0.012,
            oscillator: "sine",
            attackSeconds: 0.001
        });
    },

    // ==========================================================
    // A BARRA CHEGOU A ZERO — 1.3 s
    //
    // Impacto, corpo, cauda: um bombo dez vezes maior.
    // ==========================================================

    fall(startTime, volume) {
        // O golpe, grave e curto.
        scheduleNoiseBurst({
            startTime,
            durationSeconds: 0.06,
            volume: volume * 0.30,
            filterType: "lowpass",
            frequency: 850,
            q: 0.7,
            attackSeconds: 0.001
        });

        // O corpo, a cair de 240 para 62 Hz.
        schedulePercussiveTone({
            startTime,
            durationSeconds: 1.30,
            volume: volume * 0.55,
            startFrequency: 240,
            endFrequency: 62,
            pitchDecaySeconds: 0.40,
            oscillator: "triangle",
            attackSeconds: 0.004,
            holdSeconds: 0.06
        });

        // A cauda: sine grave fixo.
        schedulePercussiveTone({
            startTime,
            durationSeconds: 1.30,
            volume: volume * 0.32,
            startFrequency: 58,
            oscillator: "sine",
            attackSeconds: 0.02,
            holdSeconds: 0.20
        });
    },

    // ==========================================================
    // SEM VIDAS — 3.4 s
    //
    // Como o fall, mais longo e até ~30 Hz. Dois triângulos
    // desafinados 4 Hz batem entre si durante a queda.
    // ==========================================================

    collapse(startTime, volume) {
        scheduleNoiseBurst({
            startTime,
            durationSeconds: 0.10,
            volume: volume * 0.39,
            filterType: "lowpass",
            frequency: 1100,
            q: 0.7,
            attackSeconds: 0.001,
            holdSeconds: 0.01
        });

        schedulePercussiveTone({
            startTime,
            durationSeconds: 3.40,
            volume: volume * 0.58,
            startFrequency: 190,
            endFrequency: 31,
            pitchDecaySeconds: 1.40,
            oscillator: "triangle",
            attackSeconds: 0.006,
            holdSeconds: 0.12
        });

        schedulePercussiveTone({
            startTime,
            durationSeconds: 3.40,
            volume: volume * 0.39,
            startFrequency: 186,
            endFrequency: 29,
            pitchDecaySeconds: 1.40,
            oscillator: "triangle",
            attackSeconds: 0.006,
            holdSeconds: 0.12
        });

        // Cauda longa (0.80s de hold).
        schedulePercussiveTone({
            startTime,
            durationSeconds: 3.40,
            volume: volume * 0.35,
            startFrequency: 44,
            oscillator: "sine",
            attackSeconds: 0.03,
            holdSeconds: 0.80
        });
    }
};


// ============================================================
// DISPARO
// ============================================================

function triggerPlayerVoice(bank, setting) {
    if (!audioCtx || !setting) return;

    const voice = bank[setting.voice];
    if (!voice) return;

    voice(
        audioCtx.currentTime + SFX_LOOKAHEAD_SECONDS,
        setting.volume
    );
}


// ============================================================
// FACHADA
// ============================================================

function playPlayerHit(lane, judgement) {
    const setting = PLAYER_AUDIO.lanes[lane];
    if (!setting) return;

    const accent = PLAYER_AUDIO.accent[judgement] ?? 1;

    triggerPlayerVoice(PERCUSSION_VOICES, {
        voice: setting.voice,
        volume: setting.volume * accent
    });
}

function playPlayerFailure(type) {
    triggerPlayerVoice(FEEDBACK_VOICES, PLAYER_AUDIO.failures[type]);
}

function playPlayerLifeLost() {
    triggerPlayerVoice(FEEDBACK_VOICES, PLAYER_AUDIO.lifeLost);
}

function playPlayerGameOver() {
    triggerPlayerVoice(FEEDBACK_VOICES, PLAYER_AUDIO.gameOver);
}