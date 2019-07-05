/**
 * Contains all the details about running a game that are client specific.
 * This includes: canvas details, event handlers, and rendering.
 */
import { PlayerInput } from "../server/game"

export function getGameDimensions() {
  return { width: 768, height: 480 }
}

const pressedKeys = new Set()
window.addEventListener("keydown", event => pressedKeys.add(event.code))
window.addEventListener("keyup", event => pressedKeys.delete(event.code))
export function getPressedKeys(): PlayerInput {
  return {
    left: pressedKeys.has("ArrowLeft"),
    right: pressedKeys.has("ArrowRight"),
    up: pressedKeys.has("ArrowUp"),
  }
}
