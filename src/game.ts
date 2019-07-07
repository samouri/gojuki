/**
 * Contains all the details about running a game that are client specific.
 * This includes: canvas details, event handlers, and rendering.
 */
import { PlayerInput, World, stepWorld } from '../server/game'

const pressedKeys = new Set()
window.addEventListener('keydown', event => pressedKeys.add(event.code))
window.addEventListener('keyup', event => pressedKeys.delete(event.code))
export function getPressedKeys(): PlayerInput {
  return {
    left: pressedKeys.has('ArrowLeft'),
    right: pressedKeys.has('ArrowRight'),
    up: pressedKeys.has('ArrowUp')
  }
}

export function receiveServerWorld(world: World, serverTick: number) {
  window.serverWorld = world
  window.clientWorld = window.clientWorld || world
}

// const unackedSteps = []
export function clientStep(world: World) {
  // unackedSteps.push(stepWorld(world))
  window.clientWorld = stepWorld(world)
  return window.clientWorld
}
