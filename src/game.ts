/**
 * Contains all the details about running a game that are client specific.
 * This includes: canvas details, event handlers, and rendering.
 */
import { PlayerInput, World, stepPlayer } from '../server/game'
import { ReactState } from '../src/index'
import {
    CLIENT_TICK_MESSAGE,
    SERVER_TICK_MESSAGE,
    heartbeat,
    ClientState,
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
        throw new Error('no message!!')
    }

    /* Update global ticks*/
    serverTick = Math.max(serverTick, message.serverTick)
    ackedClientTick = Math.max(ackedClientTick, message.clientTick)
    dirtyServer = true

    const uiState = getUIState(message)
    if (uiState) {
        window.appSetState(uiState)
    }

    if (message?.party?.game) {
        receiveServerWorld(message.party.game)
        window.serverParty = message.party
    }
}

let clientWorld: World = {
    players: {},
    serverTick: 0,
    mode: 'GAMEPLAY',
    round: 1,
    roundStartTime: Date.now(),
    roundTimeLeft: 60,
    food: [],
}

// function pathMemo(fn: Function, paths: Array<string>) {
//     let prevVals: Array<any> = []
//     let memo: any = null
//     return function(obj: any) {
//         let currVals = paths.map(path => obj[path])
//         for (let i = 0; i < currVals.length; i++) {
//             if (currVals[i] !== prevVals[i]) {
//                 memo = fn(obj)
//                 break
//             }
//         }
//         return memo
//     }
// }

let cacheUIState: ReactState = {
    serverConnected: false,
    players: [],
    gameStatus: 'NOT_STARTED',
    upgradesScreen: {
        goo: 0,
        food: 0,
        speed: 0,
        carryLimit: 0,
        secondsLeft: 60,
    },
}

function getUIState(message: SERVER_TICK_MESSAGE): ReactState {
    const party = message.party

    if (!party && cacheUIState.serverConnected) {
        return cacheUIState
    }

    const thisPlayer = party?.game?.players[window.peerId]
    const newUIState = {
        serverConnected: true,
        players: party?.players ?? [],
        gameStatus: party?.status,
        upgradesScreen: {
            goo: thisPlayer?.powerups.goo,
            food: thisPlayer?.food,
            speed: thisPlayer?.powerups.speed,
            carryLimit: thisPlayer?.powerups.carryLimit,
            secondsLeft: party?.game?.roundTimeLeft,
        },
    }

    if (!_.isEqual(cacheUIState, newUIState)) {
        cacheUIState = newUIState
        return cacheUIState
    }

    return null
}

// 1. Figure out which inputs can be discarded
// 2. Update the world with all of the new state.
export function receiveServerWorld(world: World) {
    // console.log('recieving world!! ', world)
    window.serverWorld = world
    unackedInputs = unackedInputs.filter(elem => elem[0] >= ackedClientTick)

    clientWorld = _.cloneDeep(world)
    // stepPlayer(
    //     clientWorld,
    //     window.peerId,
    //     unackedInputs.map(elem => elem[1]),
    // )
}

let unackedInputs: Array<[number, PlayerInput]> = [] // [TickId, PlayerInput]

export function localClientStep() {
    clientTick++
    const keys = getPressedKeys()
    unackedInputs.push([clientTick, keys])
    // unackedInputs = _.takeRight(unackedInputs, 5)
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
