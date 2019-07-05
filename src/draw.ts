import { GamePlayer, PLAYER_CONFIG, getGameDimensions } from "../server/game"

import bugImg from "../img/bug/bug1.png"
import { Player } from "../server/state"
const img = new Image()
img.src = bugImg

export function drawPlayer(ctx: CanvasRenderingContext2D, player: GamePlayer) {
  const fillStyle = PLAYER_CONFIG[1].color
  ctx.translate(player.x, player.y)
  ctx.rotate(player.rotation)
  // ctx.drawImage(img, -10, -10, 20, 20)
  drawTintedImage(img, -10, -10, 20, 20, ctx, fillStyle)
  ctx.rotate(-player.rotation)
  ctx.translate(-player.x, -player.y)
}

export function drawArena(ctx: CanvasRenderingContext2D, players: Array<Player>) {
  ctx.fillStyle = "black"
  const { width, height } = getGameDimensions()
  ctx.clearRect(0, 0, width, height)

  for (const [id, cfg] of Object.entries(PLAYER_CONFIG)) {
    if (!players[Number(id) - 1]) {
      continue
    }
    ctx.fillStyle = cfg.color
    ctx.fillRect(cfg.basePosition.x, cfg.basePosition.y, 70, 70)

    ctx.fillStyle = "white"
    ctx.fillText("name", cfg.basePosition.x + 5, cfg.basePosition.y + 65)
  }
}

/* Library Funcs */

let buffer: HTMLCanvasElement = null
let bufferContext: CanvasRenderingContext2D = null
function drawTintedImage(
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D,
  fillStyle: string,
) {
  if (!buffer) {
    buffer = document.createElement("canvas")
    bufferContext = buffer.getContext("2d")
  }
  // var srcwidth = img.width,
  //   srcheight = img.height

  buffer.width = width
  buffer.height = height

  tint(bufferContext, img, fillStyle, x, y, width, height)

  ctx.drawImage(buffer, x, y, width, height)
}

function tint(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  fillStyle: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  context.clearRect(0, 0, width, height)

  context.fillStyle = fillStyle
  context.fillRect(0, 0, width, height)

  context.globalCompositeOperation = "multiply"
  context.drawImage(image, 0, 0, width, height)

  context.globalCompositeOperation = "destination-atop"
  context.drawImage(image, 0, 0, width, height)
}
