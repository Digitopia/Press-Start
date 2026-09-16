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

  // O canvas ocupa a janela toda e é desenhado à resolução REAL
  // do ecrã — é isso que mantém o texto nítido numa TV grande.
  // O tamanho de desenho do jogo continua a ser SCREEN_SIZE (ver
  // applyScreenScale()).
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
// Este é o único sítio do projeto que conhece o tamanho real da
// janela (width/height do p5). Tudo o que está em renderer.js
// desenha no espaço fixo SCREEN_SIZE (960x540) e é esta função
// que o encaixa no ecrã.
//
// Os dois eixos usam SEMPRE o mesmo fator — o menor dos dois
// rácios — por isso o jogo nunca estica: sobra espaço à volta
// (letterbox), nunca distorção. E como o scale() é do p5, o
// desenho é feito à resolução real do ecrã em vez de ser uma
// imagem pequena esticada: nítido em qualquer tamanho.
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
// SCREEN_SIZE é o ecrã do JOGO; o canvas costuma ser maior, com
// barras de sobra de um dos lados. Esta função devolve o canvas
// inteiro — barras incluídas — já convertido em coordenadas do
// espaço de desenho, para os fundos dos overlays poderem cobrir
// tudo em vez de pintarem só o retângulo do jogo e deixarem as
// barras de outra cor (ver fillVisibleScreen() em renderer.js).
//
// Num ecrã 16:9 a área devolvida é exatamente SCREEN_SIZE, e x/y
// são zero.
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
// DRAW
// ============================================================

function draw() {
  background(12);

  updateGame();

  push();

  applyScreenScale();

  if (GAME.state === "standby") {
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

  // Independentes do ramo acima: continuam a desenhar-se por
  // cima mesmo depois de o estado já ter mudado (ver
  // drawScreenWipe() em renderer.js).
  drawStandbyExitOverlay();
  drawGameOverExitOverlay();

  pop();
}
