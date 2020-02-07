/**
 * Contains all the details about running a game that are client specific.
 * This includes: canvas details, event handlers, and rendering.
 */
import { PlayerInput } from '../server/game'
import { ReactState } from '../src/index'
import {
    CLIENT_TICK_MESSAGE,
    SERVER_TICK_MESSAGE,
    heartbeat,
    PartyState,
} from '../server/state'
import * as _ from 'lodash'
import { sendRTC } from './api'
import { setCorrectingInterval } from './timer'

const pressedKeys = new Set()
window.addEventListener('keydown', event => pressedKeys.add(event.code))
window.addEventListener('keyup', event => pressedKeys.delete(event.code))
export function getPressedKeys(): PlayerInput {
    return {
        left: pressedKeys.has('ArrowLeft'),
        right: pressedKeys.has('ArrowRight'),
        up: pressedKeys.has('ArrowUp'),
        space: pressedKeys.has('Space'),
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

    if (message?.party) {
        window.serverParty = message.party
    }
    const uiState = getUIState(message)
    if (uiState) {
        window.appSetState(uiState)
    }
    unackedInputs = unackedInputs.filter(elem => elem[0] >= ackedClientTick)
}

export const initialUIState: ReactState = {
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
    scores: [],
    partyId: undefined,
}

let cacheUIState: ReactState = { ...initialUIState }
window.uiState = cacheUIState
function getUIState(message: SERVER_TICK_MESSAGE): ReactState {
    const party: PartyState = message.party
    // TODO: Create separate idea for "can send messages", and "initialized data?". Aka fix issue for signing in username and multiple prompts
    if (!party && cacheUIState.serverConnected) {
        return cacheUIState
    }

    const thisPlayer = party?.game?.players[window.peerId]
    const scores = Object.entries(party?.game?.players ?? {})
        .sort((x, y) => y[1].food - x[1].food)
        .map(([_peerId, player]) => {
            return {
                playerName: player.playerName,
                food: player.food,
                playerNumber: player.playerNumber,
            }
        })

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
        scores,
        partyId: party?.partyId,
    }

    if (!_.isEqual(cacheUIState, newUIState)) {
        cacheUIState = newUIState
        window.uiState = cacheUIState
        return cacheUIState
    }

    return null
}

let unackedInputs: Array<[number, PlayerInput]> = [] // [TickId, PlayerInput]

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

setCorrectingInterval(() => {
    if (isConnectedPeer(window.peer)) {
        if (clientTick > ackedClientTick) {
            sendRTC(getClientTick())
        } else if (dirtyServer) {
            sendRTC(heartbeat(clientTick, serverTick))
        }
        dirtyServer = false
    }

    const shouldRegisterKeypress =
        window.serverParty?.status === 'PLAYING' ||
        window.serverParty?.status === 'TEST'

    if (shouldRegisterKeypress) {
        clientTick++
        const keys = getPressedKeys()
        unackedInputs.push([clientTick, keys])
    }
}, 16)

function isConnectedPeer(peer: any) {
    return (
        peer &&
        (peer as any)._channel &&
        (peer as any)._channel.readyState === 'open'
    )
}

export class GameState {
    inputs: Array<[number, PlayerInput]> = [] // [TickId, PlayerInput]
    clientTick = -1
    serverTick = -1
    ackedClientTick = -1

    clientState: PartyState = null
    serverState: PartyState = null

    getClientTick() {
        return {
            type: 'CLIENT_TICK',
            clientTick: this.clientTick,
            serverTick: this.serverTick,
            inputs: this.inputs,
        }
    }

    clientStep(input: PlayerInput) {
        const shouldRegisterKeypress =
            this.clientState?.status === 'PLAYING' ||
            this.clientState?.status === 'TEST'
        if (!shouldRegisterKeypress) {
            return
        }

        this.clientTick++
        this.inputs.push([this.clientTick, input])
        // TODO: implement client side prediction a-la
        // this.clientState = stepPlayer(this.serverState, this.inputs)
    }
}
