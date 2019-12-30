import {
    GamePlayer,
    PLAYER_CONFIG,
    getGameDimensions,
    World,
    HUD_HEIGHT,
} from '../server/game'

import bug1ImgSrc from '../img/bug/bug1.png'
import bug2ImgSrc from '../img/bug/bug2.png'
import bug3ImgSrc from '../img/bug/bug3.png'
import bug4ImgSrc from '../img/bug/bug4.png'

import foodImgSrc from '../img/food.png'
import gooImgSrc from '../img/goo.png'
const bug1Img = new Image()
bug1Img.src = bug1ImgSrc
const bug2Img = new Image()
bug2Img.src = bug2ImgSrc
const bug3Img = new Image()
bug3Img.src = bug3ImgSrc
const bug4Img = new Image()
bug4Img.src = bug4ImgSrc
const bugImages = [bug1Img, bug2Img, bug3Img, bug4Img]

const foodImg = new Image()
foodImg.src = foodImgSrc
const gooImg = new Image()
gooImg.src = gooImgSrc

export function drawWorld(ctx: CanvasRenderingContext2D, world: World) {
    const players = Object.values(world.players)
    drawArena(ctx, players)

    world.food.forEach(food => drawFood(ctx, food))
    world.goo.forEach(goo => drawGoo(ctx, goo))
    players.forEach(p => drawPlayer(ctx, p))
    drawHUD(ctx, world)
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: GamePlayer) {
    const fillStyle = PLAYER_CONFIG[player.playerNumber].color
    ctx.translate(player.x, player.y + HUD_HEIGHT)
    ctx.rotate(player.rotation)
    // ctx.drawImage(img, -10, -10, 20, 20)
    drawTintedImage(bugImages[player.frame], -10, -10, 20, 20, ctx, fillStyle)
    ctx.rotate(-player.rotation)
    ctx.translate(-player.x, -(player.y + HUD_HEIGHT))
}

function drawFood(
    ctx: CanvasRenderingContext2D,
    { x, y, rotation }: { x: number; y: number; rotation: number },
) {
    ctx.drawImage(foodImg, x, y + HUD_HEIGHT, 10, 10)
}

function drawGoo(
    ctx: CanvasRenderingContext2D,
    { x, y, playerNum }: { x: number; y: number; playerNum: number },
) {
    ctx.save()
    const fillStyle = PLAYER_CONFIG[playerNum].color
    drawTintedImage(gooImg, x, y + HUD_HEIGHT, 20, 20, ctx, fillStyle)
    ctx.restore()
}

function drawHUD(ctx: CanvasRenderingContext2D, world: World) {
    ctx.save()

    const player = world.players[window.peerId]

    ctx.fillStyle = '#460a20'
    ctx.fillRect(0, 0, getGameDimensions().width, HUD_HEIGHT)

    ctx.fillStyle = 'white'
    ctx.font = '12px Arial'
    ctx.fillText(
        `Food remaining: ${player.carriedFood}/${player.powerups.carryLimit +
            5}      Sticky Goo: ${player.powerups.goo}`,
        20,
        25,
    )
    ctx.fillText(
        `ROUND: ${world.round}`,
        getGameDimensions().width / 2 - 50,
        25,
    )
    ctx.fillText(
        `Time left: ${Math.floor(world.roundTimeLeft)}`,
        getGameDimensions().width - 100,
        25,
    )

    if (player.carryLimitReached) {
        ctx.fillStyle = 'white'
        ctx.font = '20px Arial'
        ctx.fillText(
            `Carry limit reached, return to base!`,
            getGameDimensions().width / 2 - 160,
            getGameDimensions().height / 2,
        )
    }
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
        // Player score in base
        ctx.fillText(
            player.food + '',
            cfg.basePosition.x + 30,
            cfg.basePosition.y + 37 + HUD_HEIGHT,
        )
        // Player name
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
