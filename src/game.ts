/**
 * Contains all the details about running a game that are client specific.
 * This includes: canvas details, event handlers, and rendering.
 */
import { PlayerInput, World, stepPlayer } from '../server/game'
import { CLIENT_TICK_MESSAGE, SERVER_TICK_MESSAGE } from '../server/state'
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

export function handleServerTick(message: SERVER_TICK_MESSAGE) {
  if (!message) {
    throw new Error('new message!!')
  }
  /* Update global ticks*/

  if (serverTick < message.serverTick) {
    serverTick = message.serverTick
  }
  if (ackedClientTick < message.clientTick) {
    ackedClientTick = message.clientTick
  }

  /* Update states*/
  const shouldUpdateParty =
    !window.serverParty ||
    (message.party && message.party.serverTick >= window.serverParty.serverTick)
  if (message.party && shouldUpdateParty) {
    window.appSetState({ serverState: message.party, serverConnected: true })
    window.serverParty = message.party
  }

  const shouldUpdateWorld =
    !window.serverWorld ||
    (message.world && message.world.serverTick >= window.serverWorld.serverTick)
  if (message.world && shouldUpdateWorld) {
    receiveServerWorld(message.world)
  }
}

// 1. Figure out which inputs can be discarded
// 2. Update the world with all of the new state.
export function receiveServerWorld(world: World) {
  console.log('recieving world!! ', world.serverTick)
  window.serverWorld = world
  const unackedTickIds: Array<number> = Object.keys(unackedInputs)
    .map(Number)
    .sort((a, b) => a - b)
    .filter(tId => tId > ackedClientTick)
  unackedInputs = _.pick(unackedInputs, _.takeRight(unackedTickIds, 5))
  window.clientWorld = stepPlayer(
    world,
    getPlayerId(),
    unackedTickIds.map(tId => unackedInputs[tId])
  )
}

let clientWorld: World = { players: [], serverTick: 0 }

let unackedInputs: { [tickId: number]: PlayerInput } = {}
export function clientStep(world: World, playerId: number, inputs: PlayerInput): World {
  return stepPlayer(world, playerId, [inputs])
  // return stepWorld(world)
}

function getPlayerId(): number {
  const playerId = window.serverParty.players.findIndex(player => player.peerId === window.peerId)
  return playerId
}
export function localClientStep(world: World): World {
  clientTick++
  const playerId = getPlayerId()
  unackedInputs[clientTick] = getPressedKeys()
  clientWorld = world
  // clientWorld = clientStep(world, playerId, unackedInputs[clientTick])
  return clientWorld
}

export function getClientTick(): CLIENT_TICK_MESSAGE {
  const inputIdsToTake = _.takeRight(
    Object.keys(unackedInputs)
      .map(Number)
      .sort((a, b) => a - b),
    5
  )
  unackedInputs = _.pick(unackedInputs, inputIdsToTake)
  return { type: 'CLIENT_TICK', clientTick, serverTick, inputs: unackedInputs }
}

let clientTick = 0
let ackedClientTick = -1
let serverTick = -1

setInterval(() => {
  if (isConnectedPeer(window.peer)) {
    const tick = getClientTick()
    if (clientTick != ackedClientTick) {
      window.peer.send(JSON.stringify(getClientTick()))
    }
  }
}, 16)

function isConnectedPeer(peer: any) {
  return peer && (peer as any)._channel && (peer as any)._channel.readyState === 'open'
}
