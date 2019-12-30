/**
 * All of the game state that is shared between servers and all clients.
 * This means only the model (state).
 */
import * as _ from 'lodash'
import { ClientState, Player } from './state'

const GAME_DIMENSIONS = Object.freeze({ width: 769, height: 480 })
export function getGameDimensions() {
    return GAME_DIMENSIONS
}
export const HUD_HEIGHT = 40

export type World = {
    players: { [id: string]: GamePlayer }
    mode: 'GAMEPLAY' | 'UPGRADES' | 'PARTY'
    round: number
    roundStartTime: number
    roundTimeLeft: number
    serverTick: number
    food: Array<{
        x: number
        y: number
        rotation: number
        height: number
        width: number
    }>
    goo: Array<{
        x: number
        y: number
        height: number
        width: number
        playerNum: PlayerNumber
    }>
}

export type PlayerNumber = 1 | 2 | 3 | 4

export type PlayerInput = {
    left: boolean
    right: boolean
    up: boolean
    space: boolean
}
export type GamePlayer = {
    playerNumber: PlayerNumber
    playerName: string
    x: number
    y: number
    v: number
    friction: number
    turnSpeed: number
    acceleration: number
    rotation: number
    powerups: {
        speed: number
        goo: number
        carryLimit: number
    }
    food: number
    carriedFood: number
    height: number
    width: number
    carryLimitReached: boolean
    lastGooHit: number
    lastGooDeployed: number
}

const baseSize = 70

export const PLAYER_CONFIG: { [id: number]: any } = {
    1: {
        color: '#E93F3F',
        startPosition: { x: baseSize / 2, y: baseSize / 2, rotation: Math.PI },
        basePosition: { x: 0, y: 0, width: baseSize, height: baseSize },
    },
    2: {
        color: '#38D183',
        startPosition: {
            x: getGameDimensions().width - baseSize / 2.0,
            y: baseSize / 2,
            rotation: Math.PI,
        },
        basePosition: {
            x: getGameDimensions().width - baseSize,
            y: 0,
            width: baseSize,
            height: baseSize,
        },
    },
    3: {
        color: '#3FD3E9',
        startPosition: {
            x: baseSize / 2.0,
            y: getGameDimensions().height - baseSize / 2,
            rotation: 0,
        },
        basePosition: {
            x: 0,
            y: getGameDimensions().height - baseSize,
            width: baseSize,
            height: baseSize,
        },
    },
    4: {
        color: '#E93FDB',
        startPosition: {
            x: getGameDimensions().width - baseSize / 2.0,
            y: getGameDimensions().height - baseSize / 2,
            rotation: 0,
        },
        basePosition: {
            x: getGameDimensions().width - baseSize,
            y: getGameDimensions().height - baseSize,
            width: baseSize,
            height: baseSize,
        },
    },
}

export function getDefaultPlayer(
    playerNum: 1 | 2 | 3 | 4,
    playerName: string,
): GamePlayer {
    return {
        playerNumber: playerNum,
        playerName,
        x: PLAYER_CONFIG[playerNum].startPosition.x,
        y: PLAYER_CONFIG[playerNum].startPosition.y,
        v: 0,
        rotation: PLAYER_CONFIG[playerNum].startPosition.rotation,
        friction: 0.9,
        turnSpeed: 0.1,
        acceleration: 1.0,
        powerups: {
            speed: 0,
            goo: 5,
            carryLimit: 0,
        },
        food: 0,
        carriedFood: 0,
        height: 20,
        width: 20,
        carryLimitReached: false,
        lastGooHit: -Infinity,
        lastGooDeployed: -Infinity,
    }
}

/*
 * Manages events that are directly controlled by time without any user input.
 * For example:
 *   - Food creation
 *   - Time management
 *   - Round
 */
export function stepWorld(party: ClientState, serverTick: number) {
    const world: World = party.game
    const dt = Date.now() - world.roundStartTime
    world.roundTimeLeft = Math.floor(60 - dt / 1000)

    const secondsSinceRoundStart = dt / 1000
    const MAX_FOOD = 40

    if (
        world.food.length < MAX_FOOD &&
        secondsSinceRoundStart * 2 > world.food.length
    ) {
        world.food.push({
            x: Math.floor(Math.random() * getGameDimensions().width),
            y: Math.floor(Math.random() * getGameDimensions().height),
            rotation: Math.floor(Math.random() * 360),
            height: 10,
            width: 10,
        })
    }

    if (world.roundTimeLeft <= 0) {
        // ROUND 3 alert
        if (party.status === 'UPGRADES') {
            party.status = 'PLAYING'
            party.serverTick = serverTick
            world.roundStartTime = Date.now()
            party.game.round++
        } else if (party.status === 'PLAYING') {
            if (party.game.round === 3) {
                party.status = 'FINISHED'
                return
            }
            party.status = 'UPGRADES'
            party.serverTick = serverTick
            world.roundStartTime = Date.now()
        }
    }
}

export function stepPlayer(
    world: World,
    playerId: string,
    inputs: Array<PlayerInput>,
) {
    const gameDim = getGameDimensions()
    inputs = [...inputs]

    const p = world.players[playerId]
    while (!_.isEmpty(inputs)) {
        const input = inputs.shift()
        if (input.up) {
            p.v += p.acceleration
            p.v = Math.min(p.powerups.speed + 5, p.v)
            if (isSticky(p)) {
                p.v = Math.min(p.v, 0.5)
            }
        } else {
            p.v *= p.friction
        }

        p.x = p.x + Math.sin(p.rotation) * p.v
        p.y = p.y + Math.cos(p.rotation) * -1 * p.v

        if (input.left) {
            p.rotation -= p.turnSpeed
        } else if (input.right) {
            p.rotation += p.turnSpeed
        }

        p.x = Math.min(Math.max(10, p.x), gameDim.width - 10)
        p.y = Math.min(Math.max(10, p.y), gameDim.height - 10)
        eatFood(world, p)
        depositFood(world, p)

        runIntoGoo(world, p)
        // depositGoo(world, p)
        if (input.space && p.powerups.goo > 0 && outOfCooldown(p)) {
            world.goo.push({
                playerNum: p.playerNumber,
                x: p.x - 10,
                y: p.y - 15,
                width: 20,
                height: 20,
            })
            p.powerups.goo -= 1
            p.lastGooDeployed = Date.now()
        }
    }
}

function outOfCooldown(player: GamePlayer): boolean {
    const duration = 200
    return Date.now() - player.lastGooDeployed > duration
}
function isSticky(player: GamePlayer): boolean {
    const duration = 5000
    return Date.now() - player.lastGooHit < duration
}

function runIntoGoo(world: World, player: GamePlayer) {
    world.goo = world.goo.filter(goo => {
        if (isTouching(goo, player) && goo.playerNum !== player.playerNumber) {
            player.lastGooHit = Date.now()
            return false
        }
        return true
    })
}

function depositFood(world: World, player: GamePlayer) {
    const playerBase = PLAYER_CONFIG[player.playerNumber].basePosition
    if (isTouching(player, playerBase)) {
        player.food += player.carriedFood
        player.carriedFood = 0
    }
}

/* O(n^2): may need to improve this since it runs on each frame. */
function eatFood(world: World, player: GamePlayer) {
    world.food = world.food.filter(food => {
        if (isTouching(food, player)) {
            if (player.carriedFood < player.powerups.carryLimit + 5) {
                player.carriedFood += 1
                return false
            } else {
                player.carryLimitReached = true
                setTimeout(() => (player.carryLimitReached = false), 1000)
            }
        }
        return true
    })
}

type Rectangle = { x: number; y: number; width: number; height: number }
function isTouching(rect1: Rectangle, rect2: Rectangle): boolean {
    // no horizontal overlap
    if (rect1.x > rect2.x + rect2.width || rect2.x > rect1.x + rect1.width) {
        return false
    }

    // no vertical overlap
    if (rect1.y > rect2.y + rect2.height || rect2.y > rect1.y + rect1.height) {
        return false
    }

    return true
}

export const powerups: {
    [name: string]: {
        cost: number
        description: string
        shortName: 'goo' | 'speed' | 'carryLimit'
    }
} = {
    'Sticky Goo': {
        cost: 5,
        description:
            'Drop sticky goo to slow your opponents down for 5 seconds.',
        shortName: 'goo',
    },
    Speed: {
        cost: 8,
        description: 'Increase your top speed.',
        shortName: 'speed',
    },
    'Food Carry Limit': {
        cost: 10,
        description: 'Increase the amount of food you can hold at once.',
        shortName: 'carryLimit',
    },
}
