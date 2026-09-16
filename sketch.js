// ============================================================
// PRESS START — PROTÓTIPO RÍTMICO
// ============================================================

let pixelFont;

// ============================================================
// SETUP
// ============================================================

async function setup() {
  pixelFont = await loadFont(
    "assets/fonts/PressStart2P-Regular.ttf"
  );

  // Canvas à resolução real da janela, para o texto ficar nítido.
  createCanvas(windowWidth, windowHeight);

  textFont(pixelFont);

  resetGame();

  initMIDI();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ============================================================
// ESCALA DO ECRÃ
//
// Encaixa SCREEN_SIZE na janela com o mesmo fator nos dois
// eixos (letterbox, sem distorção).
// ============================================================

function getScreenScale() {
  return Math.min(
    width / SCREEN_SIZE.width,
    height / SCREEN_SIZE.height
  );
}

function applyScreenScale() {
  const scaleFactor = getScreenScale();

  // Centra o espaço de desenho no espaço que sobra.
  translate(
    (width - SCREEN_SIZE.width * scaleFactor) / 2,
    (height - SCREEN_SIZE.height * scaleFactor) / 2
  );

  scale(scaleFactor);
}

// ============================================================
// ÁREA VISÍVEL
//
// O canvas inteiro (com as barras) em coordenadas de desenho,
// para os overlays cobrirem tudo.
// ============================================================

function getVisibleArea() {
  const scaleFactor = getScreenScale();

  const visibleWidth = width / scaleFactor;
  const visibleHeight = height / scaleFactor;

  return {
    x: (SCREEN_SIZE.width - visibleWidth) / 2,
    y: (SCREEN_SIZE.height - visibleHeight) / 2,
    width: visibleWidth,
    height: visibleHeight
  };
}

// ============================================================
// ORIENTAÇÃO
//
// Verificado a cada frame: em mobile rodar nem sempre dispara
// windowResized() a tempo.
// ============================================================

function updateOrientation() {
  if (windowHeight > windowWidth) {
    enterRotateMode();
  } else {
    exitRotateMode();
  }
}

// ============================================================
// DRAW
// ============================================================

function draw() {
  background(12);

  updateOrientation();

  updateGame();

  push();

  applyScreenScale();

  if (GAME.state === "rotate") {
    drawRotateOverlay();
  } else if (GAME.state === "standby") {
    drawStandbyOverlay();
  } else {
    drawHeader();

    drawGameArea();

    drawJudgement();
    drawFooter();

    drawCountdownOverlay();
    drawNextLevelOverlay();
    drawLiveLostOverlay();
    drawGameOverOverlay();
  }

  // Fora do if: os wipes continuam após a mudança de estado.
  drawStandbyExitOverlay();
  drawGameOverExitOverlay();

  pop();
}
