import {
    GamePlayer,
    PLAYER_CONFIG,
    getGameDimensions,
    World,
    HUD_HEIGHT,
} from '../server/game'

import bugImg from '../img/bug/bug1.png'
import { Player } from '../server/state'
const img = new Image()
img.src = bugImg

export function drawWorld(ctx: CanvasRenderingContext2D, world: World) {
    const players = Object.values(world.players)
    drawHUD(ctx, {})
    drawArena(ctx, players)
    players.forEach(p => drawPlayer(ctx, p))
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: GamePlayer) {
    const fillStyle = PLAYER_CONFIG[player.playerNumber].color
    ctx.translate(player.x, player.y + HUD_HEIGHT)
    ctx.rotate(player.rotation)
    // ctx.drawImage(img, -10, -10, 20, 20)
    drawTintedImage(img, -10, -10, 20, 20, ctx, fillStyle)
    ctx.rotate(-player.rotation)
    ctx.translate(-player.x, -(player.y + HUD_HEIGHT))
}

function drawHUD(ctx: CanvasRenderingContext2D, cfg: any) {
    ctx.save()
    ctx.fillStyle = '#460a20'
    ctx.strokeStyle = '#460a20'
    ctx.fillRect(0, 0, getGameDimensions().width, HUD_HEIGHT)
    // ctx.strokeStyle = 'black'
    ctx.fillStyle = 'white'
    ctx.font = '12px Arial'
    ctx.fillText(`Food remaining: ${5}/${10}      Sticky Goo: ${2}`, 20, 25)
    ctx.fillText(`ROUND: ${2}`, getGameDimensions().width / 2 - 50, 25)
    ctx.fillText(`Time left: ${51}`, getGameDimensions().width - 100, 25)
    ctx.restore()
}

function drawArena(ctx: CanvasRenderingContext2D, players: Array<GamePlayer>) {
    ctx.fillStyle = 'black'
    const { width, height } = getGameDimensions()
    ctx.clearRect(0, HUD_HEIGHT, width, height)

    players.forEach(player => {
        const cfg = PLAYER_CONFIG[player.playerNumber]
        ctx.fillStyle = cfg.color
        ctx.fillRect(
            cfg.basePosition.x,
            cfg.basePosition.y + HUD_HEIGHT,
            70,
            70,
        )

        ctx.fillStyle = 'white'
        ctx.fillText(
            player.playerName,
            cfg.basePosition.x + 5,
            cfg.basePosition.y + 65 + HUD_HEIGHT,
        )
    })
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
        buffer = document.createElement('canvas')
        bufferContext = buffer.getContext('2d')
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

    context.globalCompositeOperation = 'multiply'
    context.drawImage(image, 0, 0, width, height)

    context.globalCompositeOperation = 'destination-atop'
    context.drawImage(image, 0, 0, width, height)
}
