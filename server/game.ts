/**
 * All of the game state that is shared between servers and all clients.
 * This means only the model (state).
 */

const GAME_DIMENSIONS = Object.freeze({ width: 769, height: 480 })
export function getGameDimensions() {
  return GAME_DIMENSIONS
}

export type PlayerInput = { left: boolean; right: boolean; up: boolean }
export type GamePlayer = PlayerInput & {
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
    color: '#E93F3F',
    startPosition: { x: baseSize / 2, y: baseSize / 2, rotation: Math.PI },
    basePosition: { x: 0, y: 0 }
  },
  2: {
    color: '#38D183',
    startPosition: {
      x: getGameDimensions().width - baseSize / 2.0,
      y: baseSize / 2,
      rotation: Math.PI
    },
    basePosition: { x: getGameDimensions().width - baseSize, y: 0 }
  },
  3: {
    color: '#3FD3E9',
    startPosition: { x: baseSize / 2.0, y: getGameDimensions().height - baseSize / 2, rotation: 0 },
    basePosition: { x: 0, y: getGameDimensions().height - baseSize }
  },
  4: {
    color: '#E93FDB',
    startPosition: {
      x: getGameDimensions().width - baseSize / 2.0,
      y: getGameDimensions().height - baseSize / 2,
      rotation: 0
    },
    basePosition: {
      x: getGameDimensions().width - baseSize,
      y: getGameDimensions().height - baseSize
    }
  }
}

export function getDefaultPlayer(playerNum: number): GamePlayer {
  return {
    x: PLAYER_CONFIG[playerNum].startPosition.x,
    y: PLAYER_CONFIG[playerNum].startPosition.y,
    v: 0,
    rotation: PLAYER_CONFIG[playerNum].startPosition.rotation,
    friction: 0.9,
    turnSpeed: 0.1,
    acceleration: 1,
    left: false,
    right: false,
    up: false
  }
}

export type World = {
  players: Array<GamePlayer>
}

export function stepWorld(world: World): World {
  const gameDim = getGameDimensions()
  const newPlayers = []
  for (const player of world.players) {
    const p = { ...player }
    if (p.up) {
      p.v += p.acceleration
    }
    p.v *= p.friction
    p.x = p.x + Math.sin(p.rotation) * p.v
    p.y = p.y + Math.cos(p.rotation) * -1 * p.v

    if (p.left) {
      p.rotation -= p.turnSpeed
    } else if (p.right) {
      p.rotation += p.turnSpeed
    }

    p.x = Math.min(Math.max(10, p.x), gameDim.width - 10)
    p.y = Math.min(Math.max(10, p.y), gameDim.height - 10)
    newPlayers.push(p)
  }

  return { ...world, players: newPlayers }
}
