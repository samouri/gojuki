/**
 * Contains all the details about running a game that are client specific.
 * This includes: canvas details, event handlers, and rendering.
 */
import { PlayerInput, stepPlayer, GamePlayer } from '../server/game'
import { CLIENT_TICK_MESSAGE, SERVER_TICK_MESSAGE, PartyState, PartyStatus } from '../server/state'
import * as _ from 'lodash'
import { sendRTC, getId, isConnected } from './api'
import { setCorrectingInterval } from './timer'
import { stats } from './stats'

const pressedKeys = new Set()
window.addEventListener('keydown', (event) => pressedKeys.add(event.code))
window.addEventListener('keyup', (event) => pressedKeys.delete(event.code))
export function getPressedKeys(): PlayerInput {
    return {
        left: pressedKeys.has('ArrowLeft'),
        right: pressedKeys.has('ArrowRight'),
        up: pressedKeys.has('ArrowUp'),
        space: pressedKeys.has('Space'),
    }
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
        stats.nextSend(clientTick)
    }
}, 32)

const clientHistory: { [id: number]: GamePlayer } = {}

export class GameState {
    inputs: Array<[number, PlayerInput]> = [] // [TickId, PlayerInput]
    clientTick = -1
    serverTick = -1
    ackedClientTick = -1

    clientState: PartyState = null
    serverState: PartyState = null

    optimizations = {
        interpolation: false,
        prediction: true,
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
            console.error('THIS SHOULDNT BE HAPPENING')
            this.inputs.shift()
        }

        if (this.optimizations.prediction) {
            // this modifies it in-place
            stepPlayer(this.clientState.game, this.getPlayerId_(), [input])
            clientHistory[this.clientTick] = this.clientState.game.players[this.getPlayerId_()]
        }
    }

    getPlayerId_() {
        return getId()
    }

    handleServerMessage(message: SERVER_TICK_MESSAGE) {
        if (message.serverTick < this.serverTick) {
            return
        }
        const oldState = this.serverState
        stats.nextAck({
            ackedTickId: message.clientTick,
            serverTick: message.serverTick,
            delay: message.delay,
        })
        this.serverTick = message.serverTick
        this.serverState = message.party
        this.clientState = _.cloneDeep(this.serverState)

        const actual = this.serverState?.game?.players[this.getPlayerId_()]
        const predicted = clientHistory[message.clientTick]
        delete clientHistory[message.clientTick]
        if (
            predicted &&
            actual &&
            !_.isEqual({ x: predicted.x, y: predicted.y }, { x: actual.x, y: actual.y })
        ) {
            console.error(
                `Incorrect prediction at tick ${message.clientTick}, predicted: {${predicted.x}, ${predicted.y}}, was actually: {${actual.x}, ${actual.y}}`,
            )
        }

        this.ackedClientTick = message.clientTick
        this.inputs = this.inputs.filter(([tick, _]) => tick > this.ackedClientTick)

        // when reconnecting to a server its possible we'll want to catch up our client tick.
        if (this.clientTick < this.ackedClientTick) {
            console.warn('Catching up clientTick to ackedClientTick')
            this.clientTick = this.ackedClientTick + 1
        }

        const shouldRegisterKeypress =
            this.getParty()?.status === 'PLAYING' || this.getParty()?.status === 'TEST'
        if (this.optimizations.prediction && shouldRegisterKeypress && this.inputs.length > 0) {
            // reconcile client side predicted future w/ actual server state.
            // TODO: figure out why reconcilation isn't perfect
            // given the redundant packets and 0 lost inputs.
            stepPlayer(
                this.clientState.game,
                this.getPlayerId_(),
                this.inputs.map((x) => x[1]),
            )
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
