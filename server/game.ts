/**
 * All of the game state that is shared between servers and all clients.
 * This means only the model (state).
 */
import * as _ from 'lodash'
import { Party, Player } from './state'

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
}

export type PlayerInput = { left: boolean; right: boolean; up: boolean }
export type GamePlayer = {
    playerNumber: 1 | 2 | 3 | 4
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
        acceleration: 0.2,
        powerups: {
            speed: 0,
            goo: 0,
            carryLimit: 5,
        },
        food: 0,
        carriedFood: 0,
        height: 20,
        width: 20,
    }
}

/*
 * Manages events that are directly controlled by time without any user input.
 * For example:
 *   - Food creation
 *   - Time management
 *   - Round
 */
export function stepWorld(world: World, party: Party, serverTick: number) {
    const dt = Date.now() - world.roundStartTime
    world.roundTimeLeft = 60 - dt / 1000

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

    if (world.roundTimeLeft <= 0 && party.status !== 'UPGRADES') {
        world.mode = 'UPGRADES'
        party.status = 'UPGRADES'
        party.serverTick = serverTick
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
        }
        p.v *= p.friction
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
    }
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
    if (player.carriedFood === player.powerups.carryLimit) {
        return
    }

    world.food = world.food.filter(food => {
        if (isTouching(food, player)) {
            if (player.carriedFood < player.powerups.carryLimit) {
                player.carriedFood += 1
                return false
            } else {
                // TODO: display the carry limit reached warning
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
