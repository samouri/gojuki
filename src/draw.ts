import {
    GamePlayer,
    PLAYER_CONFIG,
    getGameDimensions,
    World,
    HUD_HEIGHT,
    Rectangle,
} from '../server/game'
import { images } from './assets'
import { getId } from './api'
import { stats } from './stats'

let debugMode = false
window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyD') {
        debugMode = !debugMode
    }
})

export function drawWorld(ctx: CanvasRenderingContext2D, world: World) {
    const players = Object.values(world.players)
    drawArena(ctx, players)

    world.food.forEach((food) => drawFood(ctx, food))
    world.goo.forEach((goo) => drawGoo(ctx, goo))
    players.forEach((p) => drawPlayer(ctx, p))
    drawHUD(ctx, world)
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: GamePlayer) {
    const fillStyle = PLAYER_CONFIG[player.playerNumber].color
    ctx.translate(player.x, player.y + HUD_HEIGHT)
    ctx.rotate(player.rotation)
    // ctx.drawImage(img, -10, -10, 20, 20)
    drawTintedImage(
        images.bug[player.frame],
        -player.width / 2,
        -player.height / 2,
        player.width,
        player.height,
        ctx,
        fillStyle,
    )
    ctx.rotate(-player.rotation)
    ctx.translate(-player.x, -(player.y + HUD_HEIGHT))
}

function drawFood(ctx: CanvasRenderingContext2D, { x, y, width, height }: Rectangle) {
    ctx.drawImage(images.food, x, y + HUD_HEIGHT, width, height)
}

function drawGoo(
    ctx: CanvasRenderingContext2D,
    { x, y, playerNum }: { x: number; y: number; playerNum: number },
) {
    ctx.save()
    const fillStyle = PLAYER_CONFIG[playerNum].color
    drawTintedImage(images.goo, x, y + HUD_HEIGHT, 20, 20, ctx, fillStyle)
    ctx.restore()
}

function drawHUD(ctx: CanvasRenderingContext2D, world: World) {
    ctx.save()

    const player = world.players[getId()]

    ctx.fillStyle = '#460a20'
    ctx.fillRect(0, 0, getGameDimensions().width, HUD_HEIGHT)

    ctx.fillStyle = 'white'
    ctx.font = '12px Arial'
    ctx.fillText(
        `Food remaining: ${player.carriedFood}/${player.powerups.carryLimit + 5}      Sticky Goo: ${
            player.powerups.goo
        }`,
        20,
        25,
    )
    ctx.fillText(`ROUND: ${world.round}`, getGameDimensions().width / 2 - 50, 25)
    ctx.fillText(
        `Time left: ${Math.floor(world.roundTimeLeft)}`,
        getGameDimensions().width - 100,
        25,
    )

    if (Date.now() - player.timings.carryLimitReached < 1000) {
        ctx.save()
        ctx.fillStyle = 'white'
        ctx.font = '20px Arial'
        ctx.fillText(
            `Carry limit reached, return to base!`,
            getGameDimensions().width / 2 - 160,
            getGameDimensions().height / 2,
        )
        ctx.restore()
    }

    if (debugMode) {
        ctx.fillText(`FPS: ${Math.round(stats.getFPS())}`, getGameDimensions().width - 130, 60)
        ctx.fillText(`PING: ${Math.round(stats.getPing())}ms`, getGameDimensions().width - 130, 75)
        ctx.fillText(
            `PACKET LOSS: ${Math.round(stats.getPacketLoss())}%`,
            getGameDimensions().width - 130,
            90,
        )
    }
    ctx.restore()
}

function drawArena(ctx: CanvasRenderingContext2D, players: Array<GamePlayer>) {
    ctx.fillStyle = 'black'
    const { width, height } = getGameDimensions()
    ctx.clearRect(0, HUD_HEIGHT, width, height)

    players.forEach((player) => {
        const cfg = PLAYER_CONFIG[player.playerNumber]
        ctx.fillStyle = cfg.color
        ctx.fillRect(cfg.basePosition.x, cfg.basePosition.y + HUD_HEIGHT, 70, 70)

        ctx.fillStyle = 'black'
        ctx.font = '18px Arial'
        // Player score in base
        ctx.fillText(player.food + '', cfg.basePosition.x + 5, cfg.basePosition.y + HUD_HEIGHT + 20)
        // Player name
        ctx.fillStyle = 'white'
        ctx.font = '14px Arial'
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
