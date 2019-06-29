const canvasHeight = 480
const canvasWidth = 768

// Initialized after page is ready.
let canvas

/** @type {CanvasRenderingContext2D} */
let ctx

const state = {
  pressedKeys: new Set()
}

window.onload = init
function init() {
  canvas = document.getElementById('game')
  canvas.setAttribute('height', canvasHeight)
  canvas.setAttribute('width', canvasWidth)
  ctx = canvas.getContext('2d')

  // register input handlers
  window.addEventListener('keydown', event => state.pressedKeys.add(event.code))
  window.addEventListener('keyup', event => state.pressedKeys.delete(event.code))

  // register the gameloop
  // setInterval(update, 16)
  update()
}

function update() {
  drawPartyScreen()
}

function drawPartyScreen() {
  ctx.save()
  ctx.fillStyle = 'black'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)
  ctx.fillStyle = 'red'
  ctx.font = "80px 'Press Start 2P', cursive"
  ctx.fillText('Gojuki', 150, 100)
  ctx.restore()
}
