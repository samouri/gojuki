import { GameState } from '../src/game'
import { PlayerInput } from '../server/game'
import { SERVER_TICK_MESSAGE, PartyState } from '../server/state'

describe('GameState', () => {
    let state: GameState
    const input: PlayerInput = Object.freeze({
        up: false,
        left: false,
        right: false,
        space: false,
    })

    beforeEach(() => {
        state = new GameState()
        state.clientState = { status: 'PLAYING' } as PartyState
    })

    describe('tick management', () => {
        test('initializes all ticks to -1', () => {
            expect(state.getTicks()).toStrictEqual({
                serverTick: -1,
                clientTick: -1,
                ackedClientTick: -1,
            })
        })

        test('should increment clientTick when given an input', () => {
            state.handleInput(input)
            expect(state.getTicks()).toStrictEqual({
                serverTick: -1,
                clientTick: 0,
                ackedClientTick: -1,
            })
        })

        test('on server message, should update ticks if newer', () => {
            const message: SERVER_TICK_MESSAGE = {
                type: 'SERVER_TICK',
                serverTick: 42,
                clientTick: 24,
                party: null,
            }
            state.handleServerMessage(message)

            expect(state.getTicks()).toStrictEqual({
                clientTick: 24, // even though clientTick was -1, the server bumps it up.
                serverTick: 42,
                ackedClientTick: 24,
            })
        })

        test('should discard server message if older', () => {
            state.serverTick = 2
            const message: SERVER_TICK_MESSAGE = {
                type: 'SERVER_TICK',
                serverTick: 1,
                clientTick: 24,
                party: null,
            }
            state.handleServerMessage(message)

            expect(state.getTicks()).toStrictEqual({
                clientTick: -1,
                serverTick: 2,
                ackedClientTick: -1,
            })
        })
    })

    describe('input management', () => {
        test('initializes with empty inputs', () => {
            expect(state.getInputs()).toStrictEqual([])
        })

        test('discards inputs if not PLAYING', () => {
            state.clientState = { status: 'UPGRADES' } as PartyState
            state.handleInput(input)
            expect(state.getInputs()).toStrictEqual([])
        })

        test('accepts inputs if PLAYING', () => {
            state.handleInput(input)
            expect(state.getInputs()).toStrictEqual([[0, input]])

            state.handleInput(input)
            expect(state.getInputs()).toStrictEqual([
                [0, input],
                [1, input],
            ])
        })

        test('removes acked inputs', () => {
            state.inputs = [
                [0, input],
                [1, input],
            ]
            state.handleServerMessage({
                serverTick: 2,
                clientTick: 2,
            } as SERVER_TICK_MESSAGE)

            expect(state.getInputs()).toStrictEqual([])
        })
    })
})
