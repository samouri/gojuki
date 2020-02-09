import { GameState } from '../src/game'
import { PlayerInput, getDefaultGame } from '../server/game'
import { SERVER_TICK_MESSAGE, PartyState } from '../server/state'
import { cloneDeep } from 'lodash'

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
        state.clientState = state.serverState = { status: 'PLAYING' } as PartyState
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
            state.clientState = state.serverState = { status: 'UPGRADES' } as PartyState
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

        test('should only keep around the last 5 unacked inputs', () => {
            for (var i = 0; i < 10; i++) {
                state.handleInput(input)
            }

            expect(state.getInputs().length).toStrictEqual(5)
            expect(state.getInputs()[0]).toStrictEqual([5, input])
        })
    })

    // TODO: use DI for getId as well as stepPlayer.
    describe('optimization: prediction', () => {
        const playerId = '42'

        beforeEach(() => {
            state.optimizations.prediction = true
            state.clientState.game = getDefaultGame([{ playerName: 'test', peerId: playerId }], 0)
            state.getPlayerId_ = () => playerId
        })

        test('should now return clientState instead of serverState', () => {
            expect(state.getParty()).toBe(state.clientState)
        })

        test('should synchronously update clients state after processing inputs', () => {
            let prevState = cloneDeep(state.getParty())
            state.handleInput({ up: true, left: true, right: false, space: false })
            let postState = cloneDeep(state.getParty())
            expect(prevState).not.toStrictEqual(postState)

            prevState = cloneDeep(postState)
            state.handleInput({ up: true, left: true, right: false, space: false })
            postState = cloneDeep(state.getParty())
            expect(prevState).not.toStrictEqual(postState)
        })

        test('should replay all inputs from server state', () => {
            for (let i = 0; i < 5; i++) {
                state.handleInput(input)
            }
            state.handleServerMessage({
                type: 'SERVER_TICK',
                serverTick: 2,
                clientTick: 2,
                party: state.clientState,
            })

            expect(state.inputs.length).toBe(2)
        })
    })
})
