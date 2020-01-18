import * as _ from 'lodash'
import {
    PlayerInput,
    World,
    getDefaultPlayer,
    stepPlayer,
    stepWorld,
    powerups,
} from './game'
const maxPartySize = 3
let serverTick = 0

/* Messages & message creators */
export type LOG_MESSAGE = { type: 'LOG'; message: string }
export type JOIN_PARTY_MESSAGE = {
    type: 'JOIN_PARTY'
    playerName: string
    peerId: string
    partyId?: string
    test?: boolean
}
export type PLAYER_INPUTS = { type: 'CLIENT_INPUTS'; input: PlayerInput }
export type PLAYER_UPGRADE_MESSAGE = {
    type: 'PLAYER_UPGRADES'
    powerup: 'Sticky Goo' | 'Speed' | 'Food Carry Limit'
    delta: 1 | -1
}
export type SERVER_TICK_MESSAGE = {
    type: 'SERVER_TICK'
    party: null | ClientState
    serverTick: number
    clientTick: number
}

export type HEARTBEAT_MESSAGE = {
    type: 'CLIENT_HEARTBEAT'
    serverTick: number
    clientTick: number
}

export type START_GAME_MESSAGE = {
    type: 'START_GAME'
    partyId: string
}

export type CLIENT_TICK_MESSAGE = {
    type: 'CLIENT_TICK'
    inputs: Array<[number, PlayerInput]>
    serverTick: number
    clientTick: number
}

export type Message =
    | LOG_MESSAGE
    | JOIN_PARTY_MESSAGE
    | PLAYER_INPUTS
    | SERVER_TICK_MESSAGE
    | PLAYER_UPGRADE_MESSAGE
    | CLIENT_TICK_MESSAGE
    | HEARTBEAT_MESSAGE
    | START_GAME_MESSAGE

export function log(message: string): LOG_MESSAGE {
    return { type: 'LOG', message }
}

export function heartbeat(
    clientTick: number,
    serverTick: number,
): HEARTBEAT_MESSAGE {
    return { type: 'CLIENT_HEARTBEAT', serverTick, clientTick }
}

export function selectUpgrade(
    powerup: 'Sticky Goo' | 'Speed' | 'Food Carry Limit',
    delta: 1 | -1,
): PLAYER_UPGRADE_MESSAGE {
    return {
        type: 'PLAYER_UPGRADES',
        powerup,
        delta,
    }
}

export function joinParty(
    peerId: string,
    partyId: string,
    playerName: string,
    test?: boolean,
): JOIN_PARTY_MESSAGE {
    const partyMsg: JOIN_PARTY_MESSAGE = {
        type: 'JOIN_PARTY',
        playerName,
        peerId,
    }
    if (test) {
        partyMsg.test = test
    }
    if (partyId) {
        partyMsg.partyId = partyId
    }

    return partyMsg
}

export function startGame(partyId: string): START_GAME_MESSAGE {
    return { type: 'START_GAME', partyId }
}

/* State Types*/
export type stateT = {
    parties: { [id: string]: ClientState }
    clientTicks: {
        [id: string]: { clientTick: number; ackedServerTick: number }
    }
}

export type GameStatus =
    | 'NOT_STARTED'
    | 'LOBBY'
    | 'PLAYING'
    | 'FINISHED'
    | 'UPGRADES'
    | 'TEST'
export type ClientState = {
    players: Array<Player>
    status: GameStatus
    serverTick: number
    game: World | undefined
    partyId: string
}

export type Player = {
    playerName: string
    peerId: string
}

/* State Handlers */

let state: stateT = {
    parties: {},
    clientTicks: {},
}

let partyIndex: any = {}
let nextParty = 1
export function initTicks(peerId: string) {
    state.clientTicks[peerId] = {
        ackedServerTick: -1,
        clientTick: -1,
    }
}

function handleJoinParty(
    peerId: string,
    message: JOIN_PARTY_MESSAGE,
): { partyId: string } | { err: string } {
    let { partyId, test, playerName } = message
    // If not specifying a partyId, check to see if should rejoin an in-progress game.
    if (!partyId) {
        const rejoiningParty = Object.values(state.parties).find(
            party =>
                party.players?.some(player => player.peerId === peerId) &&
                party.status !== 'FINISHED',
        )

        if (rejoiningParty) {
            partyIndex[peerId] = rejoiningParty.partyId
            return { partyId: rejoiningParty.partyId }
        }
    }

    if (state.parties[partyId] && state.parties[partyId].players.length === 4) {
        return { err: 'Sorry, this party is full' }
    }

    if (!partyId) {
        partyId = Object.keys(state.parties).find(partyId => {
            const party = state.parties[partyId]
            return (
                party.status === 'LOBBY' && party.players.length < maxPartySize
            )
        })
    }
    if (!partyId) {
        partyId = String(nextParty++)
    }
    let party = state.parties[partyId]

    if (!party) {
        party = state.parties[partyId] = {
            status: 'LOBBY',
            players: [],
            serverTick,
            game: undefined,
            partyId,
        }
    }

    party.players.push({ peerId, playerName })
    party.serverTick = serverTick
    partyIndex[peerId] = partyId

    if (test) {
        handleStartGame(startGame(partyId))
        state.parties[partyId].status = 'TEST'
    }

    return { partyId }
}

export function handleStartGame(message: START_GAME_MESSAGE) {
    const party = state.parties[message.partyId]
    if (party.players.length > 4) {
        console.error(
            `Should never be more than 4 player, but there were: ${party.players.length}`,
        )
        return
    }
    if (party.status !== 'LOBBY') {
        console.error(
            `Can only start a game that has not already been started. PartyId: ${message.partyId}`,
        )
        return
    }

    party.status = 'PLAYING'
    const gamePlayers = _.fromPairs(
        party.players.map((player, i) => [
            player.peerId,
            getDefaultPlayer((i + 1) as 1 | 2 | 3 | 4, player.playerName),
        ]),
    )

    party.game = {
        players: gamePlayers,
        round: 1,
        roundStartTime: Date.now(),
        roundTimeLeft: 30,
        serverTick,
        food: [],
        goo: [],
    }

    // HACK TO START AT UPGRADES
    const upgradesHack = false
    if (upgradesHack) {
        party.status = 'UPGRADES'
        party.game.players[party.players[0].peerId].food = 18
    }
}

export function handleMessage(message: Message, peerId: string) {
    const partyId = getPartyId(peerId)

    if (message.type === 'JOIN_PARTY') {
        return handleJoinParty(peerId, message)
    } else if (message.type === 'LOG') {
        console.log(message.message)
    } else if (message.type === 'CLIENT_HEARTBEAT') {
        const ticks = state.clientTicks[peerId]
        ticks.clientTick = Math.max(ticks.clientTick, message.clientTick)
        ticks.ackedServerTick = Math.max(
            ticks.ackedServerTick,
            message.serverTick,
        )
    } else if (message.type === 'PLAYER_UPGRADES') {
        const player = state.parties[partyId].game.players[peerId]
        const { cost, shortName } = powerups[message.powerup]

        if (player.food >= cost && message.delta === 1) {
            player.food -= cost
            player.powerups[shortName]++
        } else if (message.delta === -1 && player.powerups[shortName] > 0) {
            player.food += cost
            player.powerups[shortName]--
        }
        return player.powerups
    } else if (message.type === 'CLIENT_TICK') {
        if (message.clientTick <= state.clientTicks[peerId].clientTick) {
            // console.log(
            //     `dupe or outdated message because of outdated clientTick: ${message.clientTick}`,
            // )
        }

        if (!partyId) {
            console.log(`SHOULD NOT BE RECEIVING CLIENT_TICK BEFORE GAME START`)
            return
        }

        const prevClientTick = state.clientTicks[peerId].clientTick
        const clientTick = message.clientTick
        state.clientTicks[peerId] = {
            clientTick,
            ackedServerTick: message.serverTick,
        }

        // This is awful anti-cheat logic. Right now clients can make 4 moves every move.
        // TODO: use bursty api logic. hold a counter from 0 that increments up by one every 16ms w/ a low max. that num represents how many moves a client can make.
        let inputs: Array<PlayerInput> = message.inputs
            .filter(elem => elem[0] > prevClientTick)
            .map(elem => elem[1])
        inputs = _.takeRight(inputs, 5)

        const party = state.parties[partyId]
        if (party.status === 'PLAYING' || party.status === 'TEST') {
            stepPlayer(party.game, peerId, inputs)
            party.game.serverTick = serverTick
        }
    } else if (message.type === 'START_GAME') {
        return handleStartGame(message as START_GAME_MESSAGE)
    }
}

/**
 *  Client/Server sync strategy.
 *
 * **Ticks**
 * Tick is a concept for both the client and the server. A tick refers to a state update. Every single time the state updates, the tick number is increased by one.
 * Therefore if the tick rate is 60hz (once every 16ms), every second will increase the tick number by 60.
 *
 * The client and server should independently have a monotonically increasing tick.
 * - A client needs to keep track of its own tick, the server's tick, and the latest ACKed `clientTick` that the server recieved.
 * - A server can maintain a single `serverTick` that is reused for all of its clients, but must maintain a unique `clientTick` and `ackedServerTick` for each client.
 *
 * The *acked* tick tells the server/client what still needs to be sent aka everything that hasn't been ACKed.
 */

function getPartyId(peerId: string) {
    return partyIndex[peerId]
}

function getGameDataToSend(peerId: string): { party: ClientState } {
    const partyId = getPartyId(peerId)
    if (!peerId || !partyId) {
        // throw new Error(`peerId: ${peerId} hostId: ${hostId}`)
        return { party: null }
    }

    const ret: any = { party: null }

    if (state.parties[partyId].game) {
        stepWorld(state.parties[partyId], serverTick)
    }
    ret.party = state.parties[partyId]

    return ret
}

function getHeartbeatDataToSend(peerId: string) {
    return { serverTick, clientTick: state.clientTicks[peerId].clientTick }
}

export function getTickData(peerId: string): SERVER_TICK_MESSAGE {
    return {
        type: 'SERVER_TICK',
        ...getHeartbeatDataToSend(peerId),
        ...getGameDataToSend(peerId),
    }
}

export function tick() {
    serverTick++
}
