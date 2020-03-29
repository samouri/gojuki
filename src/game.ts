/**
 * Contains all the details about running a game that are client specific.
 * This includes: canvas details, event handlers, and rendering.
 */
import { PlayerInput, stepPlayer, GamePlayer } from '../server/game'
import { CLIENT_TICK_MESSAGE, SERVER_TICK_MESSAGE, PartyState, PartyStatus } from '../server/state'
import { cloneDeep } from 'lodash'
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
setCorrectingInterval(() => {
    if (isConnected() && window.location.pathname.includes('game')) {
        state.handleInput(getPressedKeys())
    }
}, 16)

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

export class GameState {
    inputs: Array<[number, PlayerInput]> = [] // [TickId, PlayerInput]
    clientTick = -1
    serverTick = -1
    ackedClientTick = -1
    lastServerReceive = -1

    serverStates: Array<PartyState> = []

    optimizations = {
        interpolation: true,
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
        return this.serverStates?.[1]
    }

    handleInput(input: PlayerInput) {
        const shouldRegisterKeypress =
            this.serverStates?.[0]?.status === 'PLAYING' ||
            this.serverStates?.[0]?.status === 'TEST'
        if (!shouldRegisterKeypress) {
            return
        }

        this.clientTick++
        this.inputs.push([this.clientTick, input])
        while (this.inputs.length > 10) {
            console.error(`We've accumulated more than ${10} unacked inputs`)
            this.inputs.shift()
        }
    }

    getRenderedGame() {
        if (
            (!this.optimizations.interpolation && !this.optimizations.prediction) ||
            !this.serverStates[1]?.game?.players
        ) {
            return this.serverStates[0]
        }

        let rendered = this.serverStates[1]
        if (this.optimizations.interpolation) {
            let t = (Date.now() - this.lastServerReceive) / 100 // should be sending 1 frame per 33ms.
            t = Math.min(t, 1)
            rendered = interpolate(this.serverStates[0], this.serverStates[1], t)
        }

        if (this.optimizations.prediction) {
            let me = this.serverStates[1].game.players[getId()]
            rendered.game.players[getId()] = cloneDeep(me)

            stepPlayer(
                rendered.game,
                getId(),
                this.inputs.map((x) => x[1]),
            )
        }

        return rendered
    }

    getPlayerId_() {
        return getId()
    }

    handleServerMessage(message: SERVER_TICK_MESSAGE) {
        if (message.serverTick < this.serverTick) {
            return
        }
        this.lastServerReceive = Date.now()
        stats.nextAck({
            ackedTickId: message.clientTick,
            serverTick: message.serverTick,
            delay: message.delay,
        })
        this.serverTick = message.serverTick
        this.serverStates = [this.serverStates[1] ?? message.party, message.party]

        this.ackedClientTick = message.clientTick
        this.inputs = this.inputs.filter(([tick, _]) => tick > this.ackedClientTick)

        // when reconnecting to a server its possible we'll want to catch up our client tick.
        if (this.clientTick < this.ackedClientTick) {
            console.warn('Catching up clientTick to ackedClientTick')
            this.clientTick = this.ackedClientTick + 1
        }
    }
}

function interpolate(state1: PartyState, state2: PartyState, t: number): PartyState {
    const players1 = state1?.game?.players
    const players2 = state2?.game?.players
    if (!players1 || !players2) {
        return state1
    }

    const lerpedPlayers = Object.entries(players1).map(([id, p1]) => {
        const p2 = players2[id]
        return [
            id,
            {
                ...p1,
                x: lerp(p1.x, p2.x, t),
                y: lerp(p1.y, p2.y, t),
                rotation: lerp(p1.rotation, p2.rotation, t),
            },
        ]
    })
    return {
        ...state2,
        game: {
            ...state2.game,
            players: Object.fromEntries(lerpedPlayers),
        },
    }
}

function lerp(start: number, end: number, t: number) {
    return start * (1 - t) + end * t
}

export const state = new GameState()
;(window as any).gamestate = state
