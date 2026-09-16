// ============================================================
// ÁUDIO DO JOGADOR
//
// Tudo o que soa em resposta ao GESTO: o acerto, o erro, a
// vida perdida, o fim de jogo. 
//
// Depende de: audioCtx e SFX_LOOKAHEAD_SECONDS (core-audio.js)
// ============================================================


// ============================================================
// CONFIGURAÇÃO
//
// lanes      que voz de percussão toca em cada fila
// accent     o julgamento afeta a dinâmica, não só os pontos:
//            um PERFECT bate mais forte que um OK
// failures   o mesmo para os erros; null = silêncio
//
// Os nomes das vozes vêm de PERCUSSION_VOICES e de
// FEEDBACK_VOICES, em baixo. 
// ============================================================

const PLAYER_AUDIO = {
    // Ganho do bus inteiro. O acompanhamento tem o seu próprio
    // em MUSIC.masterVolume (main-config.js) — é a relação entre
    // os dois que decide o peso do gesto contra a música.
    masterVolume: 0.25,

    // Quanto deste bus vai para a reverb partilhada com a
    // música (core-audio.js). Sinal seco, antes da saturação —
    // a sala recebe o gesto, não a distorção.
    reverbSend: 0.07,

    accent: {
        PERFECT: 1.0,
        GOOD: 0.8,
        OK: 0.6
    },

    // A ordem segue LANE_ORDER, do agudo (blue) ao grave (red):
    // a fila mais acima no ecrã é também a mais aguda.
    lanes: {
        blue: { voice: "hihat", volume: 0.3 },
        green: { voice: "clap", volume: 0.7 },
        // Mais baixa que as outras filas, para não dominar a mistura.
        yellow: { voice: "snare", volume: 0.25 },
        // O kick é a fila mais fraca das quatro: uma fundamental
        // grave e quieta quase não distorce no saturador do bus
        // (ver comentário em cima de getPlayerBus) — sem
        // distorção não há os harmónicos que dão corpo em
        // colunas pequenas.
        red: { voice: "kick", volume: 0.35 }
    },

    // As chaves são as de FAILURES (main-config.js).
    //
    // O miss é mudo de propósito: a nota que passou já não soou,
    // e o silêncio onde devia estar uma batida é o feedback.
    failures: {
        miss: null,
        wrong: { voice: "thud", volume: 0.55 },
        stray: { voice: "tick", volume: 0.20 }
    },

    // Estas duas são as únicas vozes longas do ficheiro. Ficam
    // acima do resto na mistura de propósito: são raras, e cada
    // uma marca o fim de alguma coisa.
    lifeLost: { voice: "fall", volume: 0.85 },
    gameOver: { voice: "collapse", volume: 1.00 }
};


// ============================================================
// BUS
//
// Todas as vozes passam por aqui, para haver um sítio único
// onde baixar ou levantar o áudio do jogador.
//
// Vai direto ao destination e NÃO ao sessionGain da música.
// ============================================================

const PLAYER_BUS = { gain: null, saturator: null };

// ============================================================
// SATURAÇÃO DO BUS
//
// O kick cai até 48 Hz numa sinusoide pura — sem harmónicos.
// Em colunas pequenas essa fundamental não se reproduz, e o
// bombo desaparece; sobra só o click do transiente. O baixo do
// transport, em contraste, é um "triangle" nas mesmas
// frequências e por isso SOA nas mesmas colunas.
//
// A curva de tanh distorce todo o sinal do bus e gera
// harmónicos da fundamental (96, 144, 192 Hz...). O ouvido
// reconstrói o grave a partir deles, sem que a síntese em si
// mude uma única frequência. É também o primeiro ponto onde
// todas as vozes passam pela mesma não-linearidade — o que
// começa a colá-las entre si.
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
// A mesma forma para as três primitivas: sobe, segura, cai.
//
// O hold é o que separa uma batida de um BAM. Sem ele o som
// começa a cair no instante em que chega ao topo, e por mais
// que se estique a cauda nunca ganha corpo.
//
// sustainLevel/sustainDecaySeconds/sustainHoldSeconds são
// opcionais e acrescentam um DEGRAU PLANO à queda: cai depressa
// do pico até sustainLevel (sustainDecaySeconds), fica ali
// PARADO (sustainHoldSeconds — o mesmo truque do hold: um
// setValueAtTime sem rampa a seguir), só depois começa a cauda
// exponencial até 0.0001 em endTime. É o patamar plano que dá
// corpo — duas rampas exponenciais em série, sem hold no meio,
// não bastam: a diferença entre as taxas é pequena de mais para
// se ouvir. Com sustainLevel a 0 (a omissão) não há degrau
// nenhum: sobe, segura, cai.
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
// Um único buffer de um segundo, partilhado por todas as
// batidas. Cada AudioBufferSourceNode é descartável, mas o
// buffer não: gerá-lo a cada nota seria encher o GC de lixo
// nos níveis densos.
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

    // Entrar no buffer num ponto aleatório: duas batidas
    // seguidas deixam de ser a MESMA amostra de ruído, que é o
    // que dá aquele som de máquina a repetir-se.
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
// É a queda rápida de frequência que transforma um oscilador
// num bombo ou num tom. Sem ela é só um beep grave.
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

    // addEventListener e NÃO onended, pela mesma razão do
    // scheduleTone(): onended está reservado ao transporte.
    osc.addEventListener("ended", () => {
        osc.disconnect();
        gain.disconnect();
    });

    return osc;
}


// ============================================================
// PRIMITIVA 3 — METAL
//
// Vários quadrados em razões INARMÓNICAS, filtrados em
// conjunto. É assim que o TR-808 faz o chimbau e o címbalo:
// como as parciais não são múltiplos inteiros, o ouvido não
// lhes encontra fundamental e ouve metal em vez de nota.
//
// É o que as vozes agudas usam em vez de ruído filtrado: ruído
// dá um "chh" sem forma, isto dá um ataque com contorno.
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
        // O ganho é dividido pelas parciais: seis quadrados em
        // fase somam-se e o pico iria muito acima do pedido.
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

    // Um único listener, no último a acabar — todos param no
    // mesmo instante, por isso não vale a pena seis.
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
// Cada voz recebe (startTime, volume) e monta-se a partir das
// primitivas. volume já vem com o peso da fila e o acento do
// julgamento aplicados.
//
// Curtas e secas de propósito. No nível 10 são 5.6 notas por
// segundo: qualquer cauda a mais deixa de ser uma batida e
// passa a ser mancha.
//
// Uma voz por fila: kick, snare, clap e hihat, atribuídas em
// PLAYER_AUDIO.lanes.
// ============================================================

const PERCUSSION_VOICES = {

    // Corpo em "triangle", não sine puro: uma sinusoide é limpa
    // demais — zero harmónicos, por isso soa a blip sintético e
    // depende só da saturação do bus para ganhar peso. Triangle
    // já traz harmónicos próprios (a mesma razão do baixo do
    // music-transport, ver comentário acima de getPlayerBus), o
    // que dá peso E textura ao mesmo tempo.
    kick(startTime, volume) {
        schedulePercussiveTone({
            startTime,
            durationSeconds: 0.75,
            volume: volume * 0.95,
            startFrequency: 135,
            // 46 Hz: fundo o suficiente para dar peso, mas ainda
            // dentro do que colunas pequenas reproduzem — sem se
            // OUVIR o grave, o resto lê-se como lama, não peso.
            endFrequency: 46,
            // Queda rápida de propósito: esticar isto tira
            // definição sem dar mais peso — o peso vem do
            // patamar de sustain, não daqui.
            pitchDecaySeconds: 0.05,
            oscillator: "triangle",
            attackSeconds: 0.002,
            holdSeconds: 0.012,
            // O corpo do bombo: cai para 42% e FICA ali 80ms — é
            // o patamar que se sente como o bombo a "durar", não
            // a rampa final.
            sustainLevel: 0.42,
            sustainDecaySeconds: 0.012,
            sustainHoldSeconds: 0.08
        });

        // O click do ataque: sem ele o bombo perde o contraste
        // entre grave e ataque e soa fino, mesmo com a
        // fundamental mais forte.
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

        // O click do baterista: alto e curtíssimo (18ms), não um
        // "mid" arredondado, e com parâmetros distintos do ruído
        // da tarola — se fossem iguais, as duas ler-se-iam como
        // a mesma batida repetida.
        scheduleNoiseBurst({
            startTime,
            durationSeconds: 0.018,
            volume: volume * 0.45,
            filterType: "highpass",
            frequency: 5500,
            q: 0.7,
            attackSeconds: 0.0003
        });

        // Cauda grave: um sine fixo que fica a soar um pouco
        // depois de o corpo principal já ter caído — a mesma
        // técnica da cauda do fall() (mais abaixo neste ficheiro),
        // encolhida ao tamanho de um bombo. Dá o "chão" que se
        // sente mais do que se ouve, sem mexer na definição do
        // ataque nem no ponto lá de cima.
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

    // Duas peles afinadas mais a bordoneira. A bordoneira é um
    // bandpass — highpass sem teto deixava passar o shimmer que
    // é território do prato/hihat, e os dois liam-se como o
    // mesmo instrumento. Com teto mantém o "zzz" vivo contra a
    // pele de baixo sem invadir essa zona.
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
            // Patamar curto: o mesmo truque do kick para dar
            // corpo à fundamental, sem esticar a tarola toda.
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

    // Duas reflexões juntas, e não mais: o que faz a palma é o
    // atraso entre elas, não a quantidade. À terceira o ouvido
    // deixa de ler um gesto e passa a ler cauda.
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

    // Metal, não ruído. É a fila mais aguda e, nos níveis
    // densos, a que mais vezes toca seguida — por isso esta
    // duração é a que arrisca mais mancha das quatro; testar em
    // nível denso, não só isolado, antes de esticar mais.
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

        // O "shhh": o metal sozinho dá o corpo, mas não a
        // respiração de ar que um hihat de verdade tem por cima.
        // Mais agudo que o teto da tarola (2600), para não voltar
        // a confundir-se com ela.
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
// Os dois erros são curtos, porque acontecem a meio do jogo e
// não podem tapar a nota seguinte.
//
// As duas consequências são o contrário: o compasso já parou
// quando elas tocam — loseLife() chama stopMusicTransport()
// antes de qualquer som — e por isso podem ocupar o silêncio
// todo que quiserem.
// ============================================================

const FEEDBACK_VOICES = {

    // Tempo certo, fila errada.
    //
    // Mini versão da anatomia do fall() (golpe, corpo, cauda),
    // encolhida a ~0.2s — os erros são curtos de propósito, não
    // podem tapar a nota seguinte. O corpo continua a ser dois
    // triângulos dessintonizados: o batimento entre eles dá a
    // sensação de coisa torta sem recorrer a ruído nem distorção.
    // Sem hold e bem mais baixo do que as vozes de acerto — não é
    // suposto soar a instrumento, é suposto soar a coisa pequena e
    // errada.
    thud(startTime, volume) {
        // O golpe, como no fall() — mas curtíssimo.
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

        // Square em vez de triangle nesta segunda camada, só
        // numa das duas: dá uma aresta extra ao batimento sem
        // soar a instrumento de percussão.
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

        // A cauda grave, como no fall() — mais aguda que o chão
        // do kick (50Hz) para não voltar a confundir-se com ele.
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

    // Bateu sem nota nenhuma por perto. É de propósito o som
    // mais pequeno do ficheiro: a punição a sério é o combo a
    // zero, não o barulho. Grave e discreto: um registo agudo
    // confundir-se-ia com o clap; este fica por baixo, sem se
    // misturar.
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
    // Impacto, corpo, cauda. É a mesma anatomia do bombo
    // esticada em dez vezes o tamanho: o hold de 60 ms é o que
    // faz o corpo ficar lá em baixo antes de começar a cair.
    // ==========================================================

    fall(startTime, volume) {
        // O golpe. Grave e muito curto — é o "b" do bam.
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

        // A cauda: uma sinusoide grave fixa, que fica a soar
        // depois de o corpo já ter descido.
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
    // A mesma anatomia do fall, mas bem mais tempo e mais abaixo:
    // o corpo vai buscar os 30 Hz, que já não é altura, é pressão.
    //
    // Os dois triângulos desafinados 4 Hz batem um contra o
    // outro ao longo da queda toda — é o que impede a cauda de
    // ser só um zumbido parado.
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

        // A cauda comprida (0.80s de patamar) é o que faz o fim
        // de jogo demorar de facto mais a apagar-se — os
        // triângulos já mal se ouvem a esta altura.
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
//
// SFX_LOOKAHEAD_SECONDS é a mesma margem do playBeep(): entre
// criar os nós e o grafo ser committed a thread de áudio já
// andou, e sem margem o ataque fica ancorado no passado.
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