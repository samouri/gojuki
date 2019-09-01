/**
 * All of the game state that is shared between servers and all clients.
 * This means only the model (state).
 */
import * as _ from "lodash"

const GAME_DIMENSIONS = Object.freeze({ width: 769, height: 480 })
export function getGameDimensions() {
  return GAME_DIMENSIONS
}

export type World = {
  players: { [id: string]: GamePlayer }
  serverTick: number
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
}

const baseSize = 70
export const PLAYER_CONFIG: { [id: number]: any } = {
  1: {
    color: "#E93F3F",
    startPosition: { x: baseSize / 2, y: baseSize / 2, rotation: Math.PI },
    basePosition: { x: 0, y: 0 },
  },
  2: {
    color: "#38D183",
    startPosition: {
      x: getGameDimensions().width - baseSize / 2.0,
      y: baseSize / 2,
      rotation: Math.PI,
    },
    basePosition: { x: getGameDimensions().width - baseSize, y: 0 },
  },
  3: {
    color: "#3FD3E9",
    startPosition: { x: baseSize / 2.0, y: getGameDimensions().height - baseSize / 2, rotation: 0 },
    basePosition: { x: 0, y: getGameDimensions().height - baseSize },
  },
  4: {
    color: "#E93FDB",
    startPosition: {
      x: getGameDimensions().width - baseSize / 2.0,
      y: getGameDimensions().height - baseSize / 2,
      rotation: 0,
    },
    basePosition: {
      x: getGameDimensions().width - baseSize,
      y: getGameDimensions().height - baseSize,
    },
  },
}

export function getDefaultPlayer(playerNum: 1 | 2 | 3 | 4, playerName: string): GamePlayer {
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
  }
}

export function stepPlayer(world: World, playerId: string, inputs: Array<PlayerInput>) {
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
  }
}
