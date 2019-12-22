/**
 * Contains all the details about running a game that are client specific.
 * This includes: canvas details, event handlers, and rendering.
 */
import { PlayerInput, World, stepPlayer } from '../server/game'
import {
    CLIENT_TICK_MESSAGE,
    SERVER_TICK_MESSAGE,
    heartbeat,
} from '../server/state'
import * as _ from 'lodash'

const pressedKeys = new Set()
window.addEventListener('keydown', event => pressedKeys.add(event.code))
window.addEventListener('keyup', event => pressedKeys.delete(event.code))
export function getPressedKeys(): PlayerInput {
    return {
        left: pressedKeys.has('ArrowLeft'),
        right: pressedKeys.has('ArrowRight'),
        up: pressedKeys.has('ArrowUp'),
    }
}

export function handleServerTick(message: SERVER_TICK_MESSAGE) {
    if (!message) {
        throw new Error('new message!!')
    }
    /* Update global ticks*/
    serverTick = Math.max(serverTick, message.serverTick)
    ackedClientTick = Math.max(ackedClientTick, message.clientTick)
    dirtyServer = true

    /* Update states*/
    const shouldUpdateParty =
        (!window.serverParty && message.party) ||
        (message.party &&
            message.party.serverTick >= window.serverParty.serverTick)
    if (shouldUpdateParty) {
        window.appSetState({
            serverState: message.party,
            serverConnected: true,
        })
        window.serverParty = message.party
    }

    const shouldUpdateWorld =
        (!window.serverWorld && message.world) ||
        (message.world &&
            message.world.serverTick >= window.serverWorld.serverTick)
    if (shouldUpdateWorld) {
        receiveServerWorld(message.world)
        window.serverWorld = message.world
    }
}

let clientWorld: World = { players: {}, serverTick: 0 }

// 1. Figure out which inputs can be discarded
// 2. Update the world with all of the new state.
export function receiveServerWorld(world: World) {
    // console.log("recieving world!! ", world.serverTick)
    unackedInputs = unackedInputs.filter(elem => elem[0] >= ackedClientTick)
    clientWorld = _.cloneDeep(world)
    stepPlayer(
        clientWorld,
        window.peerId,
        unackedInputs.map(elem => elem[1]),
    )
}

let unackedInputs: Array<[number, PlayerInput]> = [] // [TickId, PlayerInput]

export function localClientStep() {
    clientTick++
    const keys = getPressedKeys()
    unackedInputs.push([clientTick, keys])
    unackedInputs = _.takeRight(unackedInputs, 5)
    stepPlayer(clientWorld, window.peerId, [keys])
    return clientWorld
}

export function getClientTick(): CLIENT_TICK_MESSAGE {
    return {
        type: 'CLIENT_TICK',
        clientTick,
        serverTick,
        inputs: unackedInputs,
    }
}

let clientTick = -1
let ackedClientTick = -1
let serverTick = -1
let dirtyServer = true

setInterval(() => {
    if (isConnectedPeer(window.peer)) {
        if (clientTick > ackedClientTick) {
            window.peer.send(JSON.stringify(getClientTick()))
        } else if (dirtyServer) {
            window.peer.send(JSON.stringify(heartbeat(clientTick, serverTick)))
        }
        dirtyServer = false
    }
}, 16)

function isConnectedPeer(peer: any) {
    return (
        peer &&
        (peer as any)._channel &&
        (peer as any)._channel.readyState === 'open'
    )
}
