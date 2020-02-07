import { GameState } from '../src/game'

describe('GameState', () => {
    let state: any
    beforeEach(() => {
        state = new GameState()
    })

    test('initializes with no message to send', () => {
        expect(state.getClientTick()).toStrictEqual({
            type: 'CLIENT_TICK',
            serverTick: -1,
            clientTick: -1,
            inputs: [],
        })
    })
})
