// ============================================================
// TRANSPORT MUSICAL
//
// Agenda um compasso de cada vez no relógio do AudioContext.
// O jogo e a música partilham a mesma origem temporal, evitando
// que o acompanhamento se afaste visualmente da partitura.
// ============================================================

const MUSIC_TRANSPORT = {
  playing: false,
  nextBarTime: null,
  barIndex: 0,
  sessionGain: null,
  activeSources: new Set(),

  // Uma memória por voz de semicolcheias. A nota e o próximo
  // ponto de mudança usam beats absolutos, atravessando compassos.
  repeatedNoteStates: []
};

// ============================================================
// METRÓNOMO
//
// O click é uma faixa agendada com antecedência, como qualquer
// outra camada, e por isso arranca e pára junto com a música.
//
// nextBeatTime é o instante do próximo click AINDA NÃO agendado.
// beatIndex é absoluto: conta desde o início do transporte, o
// que faz o beat 1 cair sempre em beatIndex % beatsPerBar === 0.
//
// O click tem bus PRÓPRIO, e não o sessionGain da música, por
// duas razões que puxam em sentidos opostos:
//
//   - precisa de um gain nosso, senão não há maneira de o calar
//     depois de agendado. E é sempre agendado com antecedência
//     (MUSIC.scheduleAheadSeconds), por isso há sempre clicks no
//     futuro quando o transporte pára — era isso que deixava
//     ouvir o tempo 1 do compasso seguinte depois de mudar de
//     nível;
//   - mas não pode ser o sessionGain, que tem send para a reverb
//     partilhada. O metrónomo fica fora dela de propósito (ver
//     MUSIC.reverbSend em main-config.js): é referência de
//     tempo, e a cauda turvava o ataque que o torna útil.
// ============================================================

const CLICK_TRANSPORT = {
  nextBeatTime: null,
  beatIndex: 0,
  gain: null
};

// Quanto do volume do metrónomo sobra neste nível: 1 no nível 1,
// 0 a partir de METRONOME.silentFromLevel (ver main-config.js).
function getMetronomeFade(level) {
  const lastAudibleLevel = METRONOME.silentFromLevel - 1;

  if (level > lastAudibleLevel) return 0;

  return 1 - (level - 1) / lastAudibleLevel;
}

function updateClickTransport() {
  if (CLICK_TRANSPORT.nextBeatTime === null || !audioCtx) return;

  const config = getCurrentLevelConfig();
  const beatDurationSeconds = 60 / config.bpm;
  const scheduleLimit =
    audioCtx.currentTime + MUSIC.scheduleAheadSeconds;

  const fade = getMetronomeFade(GAME.level);

  // while e não if: se uma frame se atrasar, não se perde
  // nenhum click — agendam-se todos os que couberem.
  while (CLICK_TRANSPORT.nextBeatTime <= scheduleLimit) {
    const isDownbeat =
      CLICK_TRANSPORT.beatIndex % config.beatsPerBar === 0;

    const click = isDownbeat ? METRONOME.downbeat : METRONOME.offbeat;
    const volume = click.volume * fade;

    // Os contadores avançam na mesma quando o metrónomo já é
    // mudo: o que se cala é o som, não o relógio.
    if (volume > 0) {
      scheduleBeep(
        click.frequency,
        click.durationMs,
        volume,
        CLICK_TRANSPORT.nextBeatTime,
        CLICK_TRANSPORT.gain
      );
    }

    CLICK_TRANSPORT.nextBeatTime += beatDurationSeconds;
    CLICK_TRANSPORT.beatIndex++;
  }
}

function pickRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomIntegerBetween([minimum, maximum]) {
  return minimum + Math.floor(Math.random() * (maximum - minimum + 1));
}

function randomNumberBetween([minimum, maximum]) {
  return minimum + Math.random() * (maximum - minimum);
}

function getMusicChord(level, barIndex) {
  const progressionIndex = Math.min(
    level - 1,
    MUSIC.progressionsByLevel.length - 1
  );
  const progression = MUSIC.progressionsByLevel[progressionIndex];
  const chordKey = progression[barIndex % progression.length];

  return MUSIC.chordBank[chordKey];
}

function trackMusicSource(source) {
  if (!source) return;

  MUSIC_TRANSPORT.activeSources.add(source);
  source.onended = () => MUSIC_TRANSPORT.activeSources.delete(source);
}

function scheduleMusicNote({
  midiNote,
  startTime,
  durationSeconds,
  volume,
  oscillator,
  attackSeconds = 0.01,
  releaseSeconds = 0.08
}) {
  const source = scheduleTone({
    frequency: midiNoteToFrequency(midiNote),
    startTime,
    durationSeconds,
    volume,
    oscillator,
    attackSeconds,
    releaseSeconds,
    destination: MUSIC_TRANSPORT.sessionGain
  });

  trackMusicSource(source);
}

function scheduleMalletNote({
  midiNote,
  startTime,
  durationSeconds,
  volume,
  partials
}) {
  const fundamental = midiNoteToFrequency(midiNote);

  for (const partial of partials) {
    const source = scheduleTone({
      frequency: fundamental * partial.ratio,
      startTime,
      durationSeconds,
      volume: volume * partial.volume,
      oscillator: "sine",
      attackSeconds: 0.003,
      releaseSeconds: durationSeconds,
      destination: MUSIC_TRANSPORT.sessionGain
    });

    trackMusicSource(source);
  }
}

function scheduleBassLayer(barStartTime, chord, beatDurationSeconds, beatsPerBar) {
  const layer = MUSIC.bass;

  // O primeiro tempo ancora sempre o acorde na fundamental grave.
  scheduleMusicNote({
    midiNote: chord.root,
    startTime: barStartTime,
    durationSeconds: layer.downbeatDurationBeats * beatDurationSeconds,
    volume: layer.volume,
    oscillator: layer.oscillator,
    attackSeconds: 0.008,
    releaseSeconds: 0.12
  });

  // Em cada tempo restante há três opções equiprováveis:
  // silêncio; contratempo; ou tempo + contratempo.
  for (let beat = 1; beat < beatsPerBar; beat++) {
    const pattern = randomIntegerBetween([0, 2]);
    const noteBeats = [];

    if (pattern === 1) noteBeats.push(beat + 0.5);
    if (pattern === 2) noteBeats.push(beat, beat + 0.5);

    for (const noteBeat of noteBeats) {
      const midiNote = pickRandomItem([chord.root, chord.fifth]);

      scheduleMusicNote({
        midiNote,
        startTime: barStartTime + noteBeat * beatDurationSeconds,
        durationSeconds: layer.eighthNoteDurationBeats * beatDurationSeconds,
        volume: layer.volume,
        oscillator: layer.oscillator,
        attackSeconds: 0.008,
        releaseSeconds: 0.08
      });
    }
  }
}

function scheduleChordLayer(barStartTime, chord, barDurationSeconds) {
  const layer = MUSIC.blockChords;

  for (const midiNote of chord.notes) {
    scheduleMusicNote({
      midiNote,
      startTime: barStartTime,
      durationSeconds: barDurationSeconds * layer.durationRatio,
      volume: layer.volume,
      oscillator: layer.oscillator,
      attackSeconds: 0.06,
      releaseSeconds: 0.45
    });
  }
}

function scheduleRepeatedNoteLayer(
  barStartTime,
  chord,
  beatDurationSeconds,
  beatsPerBar,
  layer,
  layerIndex,
  barIndex
) {
  const state = MUSIC_TRANSPORT.repeatedNoteStates[layerIndex];
  const barStartBeat = barIndex * beatsPerBar;

  for (let beat = 0; beat < beatsPerBar; beat += layer.everyBeats) {
    const absoluteBeat = barStartBeat + beat;

    if (state.midiNote === null || absoluteBeat >= state.nextChangeBeat) {
      state.midiNote =
        pickRandomItem(chord.repeatedNotes) + layer.octaveOffset;
      state.nextChangeBeat =
        absoluteBeat + randomIntegerBetween(layer.changeEveryBeats);
    }

    scheduleMusicNote({
      midiNote: state.midiNote,
      startTime: barStartTime + beat * beatDurationSeconds,
      durationSeconds: layer.durationBeats * beatDurationSeconds,
      volume: randomNumberBetween(layer.volumeRange),
      oscillator: layer.oscillator,
      attackSeconds: 0.008,
      releaseSeconds: 0.06
    });
  }
}

function scheduleMelodyLayer(barStartTime, chord, beatDurationSeconds, beatsPerBar) {
  const layer = MUSIC.melody;
  let beat = randomIntegerBetween(layer.firstNoteBeat);

  while (beat < beatsPerBar) {
    scheduleMalletNote({
      midiNote: pickRandomItem(chord.notes) + layer.octaveOffset,
      startTime: barStartTime + beat * beatDurationSeconds,
      durationSeconds: layer.durationBeats * beatDurationSeconds,
      volume: layer.volume,
      partials: layer.partials
    });

    beat += randomIntegerBetween(layer.gapBeats);
  }
}

function scheduleMusicBar(barStartTime, barIndex) {
  const config = getCurrentLevelConfig();
  const beatDurationSeconds = 60 / config.bpm;
  const barDurationSeconds = beatDurationSeconds * config.beatsPerBar;
  const chord = getMusicChord(GAME.level, barIndex);

  scheduleBassLayer(
    barStartTime,
    chord,
    beatDurationSeconds,
    config.beatsPerBar
  );
  scheduleChordLayer(barStartTime, chord, barDurationSeconds);

  for (let layerIndex = 0; layerIndex < MUSIC.repeatedNotes.length; layerIndex++) {
    const layer = MUSIC.repeatedNotes[layerIndex];

    scheduleRepeatedNoteLayer(
      barStartTime,
      chord,
      beatDurationSeconds,
      config.beatsPerBar,
      layer,
      layerIndex,
      barIndex
    );
  }

  scheduleMelodyLayer(
    barStartTime,
    chord,
    beatDurationSeconds,
    config.beatsPerBar
  );
}

function startMusicTransport(startTime) {
  stopMusicTransport();

  MUSIC_TRANSPORT.sessionGain = audioCtx.createGain();
  MUSIC_TRANSPORT.sessionGain.gain.setValueAtTime(
    MUSIC.masterVolume,
    startTime
  );
  MUSIC_TRANSPORT.sessionGain.connect(audioCtx.destination);

  // Send para a sala partilhada com o jogador (core-audio.js).
  // O sessionGain é recriado a cada start; o send tem de ser
  // refeito com ele, mas a sala em si só é criada uma vez.
  sendToSharedReverb(MUSIC_TRANSPORT.sessionGain, MUSIC.reverbSend);

  MUSIC_TRANSPORT.playing = true;
  MUSIC_TRANSPORT.nextBarTime = startTime;
  MUSIC_TRANSPORT.barIndex = 0;
  MUSIC_TRANSPORT.repeatedNoteStates = MUSIC.repeatedNotes.map(() => ({
    midiNote: null,
    nextChangeBeat: 0
  }));

  // O metrónomo parte da mesma origem temporal que a música
  // e que o playhead. Sem send para a reverb, de propósito.
  CLICK_TRANSPORT.gain = audioCtx.createGain();
  CLICK_TRANSPORT.gain.connect(audioCtx.destination);

  CLICK_TRANSPORT.nextBeatTime = startTime;
  CLICK_TRANSPORT.beatIndex = 0;

  updateMusicTransport();
}

function stopMusicTransport() {
  if (!audioCtx) return;

  MUSIC_TRANSPORT.playing = false;
  MUSIC_TRANSPORT.nextBarTime = null;

  CLICK_TRANSPORT.nextBeatTime = null;

  const stopTime = audioCtx.currentTime + 0.035;

  // Mais curto que o stopTime da música: um click do metrónomo
  // dura 30–35ms, portanto um fade tão longo como o dela
  // deixava-o tocar por inteiro. Curto, mas em rampa — cortar a
  // seco põe um estalo no lugar do click.
  const clickStopTime = audioCtx.currentTime + 0.008;

  if (CLICK_TRANSPORT.gain) {
    const clickGain = CLICK_TRANSPORT.gain.gain;

    clickGain.cancelScheduledValues(audioCtx.currentTime);
    clickGain.setValueAtTime(
      Math.max(clickGain.value, 0.0001),
      audioCtx.currentTime
    );
    clickGain.exponentialRampToValueAtTime(0.0001, clickStopTime);

    // Os osciladores já agendados continuam ligados a este nó e
    // desligam-se sozinhos quando acabam (ver scheduleTone());
    // o que se perde aqui é só a nossa referência, para o
    // próximo start criar um bus limpo.
    CLICK_TRANSPORT.gain = null;
  }

  if (MUSIC_TRANSPORT.sessionGain) {
    const gain = MUSIC_TRANSPORT.sessionGain.gain;
    gain.cancelScheduledValues(audioCtx.currentTime);
    gain.setValueAtTime(Math.max(gain.value, 0.0001), audioCtx.currentTime);
    gain.exponentialRampToValueAtTime(0.0001, stopTime);
  }

  for (const source of MUSIC_TRANSPORT.activeSources) {
    try {
      source.stop(stopTime);
    } catch (error) {
      // A fonte pode já ter terminado naturalmente.
    }
  }

  MUSIC_TRANSPORT.activeSources.clear();
  MUSIC_TRANSPORT.sessionGain = null;
  MUSIC_TRANSPORT.repeatedNoteStates = [];
}

function updateMusicTransport() {
  if (!MUSIC_TRANSPORT.playing || !audioCtx) return;

  const scheduleLimit =
    audioCtx.currentTime + MUSIC.scheduleAheadSeconds;

  while (MUSIC_TRANSPORT.nextBarTime <= scheduleLimit) {
    const config = getCurrentLevelConfig();
    const barDurationSeconds =
      (60 / config.bpm) * config.beatsPerBar;

    scheduleMusicBar(
      MUSIC_TRANSPORT.nextBarTime,
      MUSIC_TRANSPORT.barIndex
    );

    MUSIC_TRANSPORT.nextBarTime += barDurationSeconds;
    MUSIC_TRANSPORT.barIndex++;
  }

  updateClickTransport();
}