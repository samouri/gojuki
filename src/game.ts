/**
 * Contains all the details about running a game that are client specific.
 * This includes: canvas details, event handlers, and rendering.
 */
import { PlayerInput } from '../server/game'
import { ReactState } from '../src/index'
import { CLIENT_TICK_MESSAGE, SERVER_TICK_MESSAGE, heartbeat, PartyState } from '../server/state'
import * as _ from 'lodash'
import { sendRTC, getId, isConnected } from './api'
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
    state.handleServerMessage(message)

    /* Update global ticks*/
    const uiState = getUIState(message)
    if (uiState) {
        window.appSetState(uiState)
    }
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

    const thisPlayer = party?.game?.players[getId()]
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
        window.uiState = cacheUIState // TODO: why the heck am i doing this?
        return cacheUIState
    }

    return null // TODO: should i be returning null? why not cacheUIState.
}

export function getClientTick(): CLIENT_TICK_MESSAGE {
    return {
        type: 'CLIENT_TICK',
        ...state.getTicks(),
        inputs: state.getInputs(),
    }
}

// step the game forward once every 16ms. note that this is not necessarilly in sync with the animation frames.
setCorrectingInterval(() => state.handleInput(getPressedKeys()), 16)

// send inputs (only when necessary) at half the rate of client side updates.
setCorrectingInterval(() => {
    if (!isConnected()) {
        return
    }
    const { clientTick, ackedClientTick } = state.getTicks()
    if (clientTick > ackedClientTick) {
        sendRTC(getClientTick())
    }
}, 32)

export class GameState {
    inputs: Array<[number, PlayerInput]> = [] // [TickId, PlayerInput]
    clientTick = -1
    serverTick = -1
    ackedClientTick = -1

    clientState: PartyState = null
    serverState: PartyState = null

    optimizations = {
        interpolation: false,
        prediction: false,
    }

    getTicks() {
        return {
            clientTick: this.clientTick,
            serverTick: this.serverTick,
            ackedClientTick: this.ackedClientTick,
        }
    }

    getInputs() {
        return this.inputs
    }

    getParty() {
        return this.optimizations.prediction ? this.clientState : this.serverState
    }

    handleInput(input: PlayerInput) {
        const shouldRegisterKeypress =
            this.getParty()?.status === 'PLAYING' || this.getParty()?.status === 'TEST'
        if (!shouldRegisterKeypress) {
            return
        }

        this.clientTick++
        this.inputs.push([this.clientTick, input])
        while (this.inputs.length > 5) {
            this.inputs.shift()
        }

        if (this.optimizations.prediction) {
            // TODO: implement client side prediction a-la
            // this.clientState = stepPlayer(this.serverState, this.inputs)
        }
    }

    handleServerMessage(message: SERVER_TICK_MESSAGE) {
        if (message.serverTick < this.serverTick) {
            return
        }

        this.serverTick = message.serverTick
        this.serverState = message.party
        this.ackedClientTick = message.clientTick

        // when reconnecting to a server its possible we'll want to catch up our client tick.
        this.clientTick = Math.max(this.clientTick, this.ackedClientTick)
        this.inputs = this.inputs.filter(([tick, _]) => tick > this.ackedClientTick)

        if (this.optimizations.prediction) {
            // reconcile client side predicted future w/ actual server state.
        }
        if (this.optimizations.interpolation) {
            // TODO: implement interpolation. this means holding a buffer of
            // size 1 or 2 for enemy states, and tweening them to their next position.
            // buffer should help smooth out the visual effects of jitter.
        }
    }
}

export const state = new GameState()
;(window as any).gamestate = state
