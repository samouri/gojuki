/**
 * Contains all the details about running a game that are client specific.
 * This includes: canvas details, event handlers, and rendering.
 */
import { PlayerInput, World, stepWorld } from '../server/game'
import { CLIENT_TICK_MESSAGE, Player } from '../server/state'
import * as _ from 'lodash'

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

export function receiveServerWorld(
  world: World,
  ticks: { serverTick: number; clientTick: number }
) {
  if (serverTick < ticks.serverTick) {
    window.serverWorld = world
    serverTick = ticks.serverTick
  }
  if (ackedClientTick < ticks.clientTick) {
    ackedClientTick = ticks.clientTick
  }

  if (!world) {
    return
  }

  unackedInputs = _.pickBy(
    unackedInputs,
    (input, tickId: number) => ticks.clientTick < tickId
  ) as any

  let newClientWorld = world
  _.sortBy(Object.values(unackedInputs)).forEach(
    inputs => (newClientWorld = clientStep(newClientWorld, playerId, inputs))
  )
  clientWorld = newClientWorld
}

let clientWorld: World = { players: [], serverTick: 0 }
let playerId = 0

let unackedInputs: { [tickId: number]: PlayerInput } = {}
export function clientStep(world: World, playerId: number, inputs: PlayerInput): World {
  world.players[playerId].up = inputs.up // override the
  world.players[playerId].left = inputs.left // override the
  world.players[playerId].right = inputs.right // override the
  return stepWorld(world)
}

export function localClientStep(world: World, playerId: number): World {
  clientTick++
  unackedInputs[clientTick] = getPressedKeys()
  clientWorld = clientStep(world, playerId, unackedInputs[clientTick])
  return clientWorld
}

export function getClientTick(): CLIENT_TICK_MESSAGE {
  const inputIdsToTake = _.takeRight(_.sortBy(Object.keys(unackedInputs)), 10)
  const inputs = _.pick(unackedInputs, inputIdsToTake)
  return { type: 'CLIENT_TICK', clientTick, serverTick, inputs }
}

let clientTick = 0
let ackedClientTick = -1
let serverTick = -1
let serverTickAtLastClientAck = -1

setInterval(() => {
  if (isConnectedPeer(window.peer)) {
    const tick = getClientTick()
    if (clientTick != ackedClientTick || serverTick != serverTickAtLastClientAck) {
      console.log(`sending out tick: ${JSON.stringify(tick)}`)
      window.peer.send(JSON.stringify(getClientTick()))
    }
  }
}, 16)

function isConnectedPeer(peer: any) {
  return peer && (peer as any)._channel.readyState === 'open'
}
