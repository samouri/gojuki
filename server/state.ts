import * as _ from 'lodash'
import { PlayerInput, World, getDefaultPlayer, stepPlayer } from './game'
const maxPartySize = 2
let serverTick = 0

/* Messages & message creators */
export type LOG_MESSAGE = { type: 'LOG'; message: string }
export type JOIN_PARTY_MESSAGE = { type: 'JOIN_PARTY'; playerName: string; peerId: string }
export type PLAYER_INPUTS = { type: 'CLIENT_INPUTS'; input: PlayerInput }
export type SERVER_TICK_MESSAGE = {
  type: 'SERVER_TICK'
  world: null | World
  party: null | Party
  serverTick: number
  clientTick: number
}
export type CLIENT_TICK_MESSAGE = {
  type: 'CLIENT_TICK'
  inputs: { [tickId: number]: PlayerInput }
  serverTick: number
  clientTick: number
}
export type Message =
  | LOG_MESSAGE
  | JOIN_PARTY_MESSAGE
  | PLAYER_INPUTS
  | SERVER_TICK_MESSAGE
  | CLIENT_TICK_MESSAGE

export function log(message: string): LOG_MESSAGE {
  return { type: 'LOG', message }
}

export function joinParty(peerId: string, playerName: string): JOIN_PARTY_MESSAGE {
  return { type: 'JOIN_PARTY', playerName, peerId }
}

/* State Types*/
export type stateT = {
  parties: { [id: string]: Party }
  games: { [id: string]: World }
  clientTicks: {
    [id: string]: { clientTick: number; ackedServerTick: number }
  }
}

export type Party = {
  players: Array<Player>
  status: 'NOT_STARTED' | 'PLAYING' | 'FINISHED'
  serverTick: number
}

export type Player = {
  playerName: string
  peerId: string
}

/* State Handlers */

let state: stateT = {
  parties: {},
  games: {},
  clientTicks: {}
}

function handleJoinParty(peerId: string, playerName: string): stateT {
  let partyToJoin = peerId // if we can't find an open party, then make a new one with the peerId of the first member.
  for (let [partyId, party] of Object.entries(state.parties)) {
    if (party.status === 'NOT_STARTED' && party.players.length < maxPartySize) {
      partyToJoin = partyId
      break
    }
  }

  const newParty: Party =
    partyToJoin in state.parties
      ? {
          ...state.parties[partyToJoin],
          players: [...state.parties[partyToJoin].players, { peerId, playerName }],
          status:
            maxPartySize === state.parties[partyToJoin].players.length + 1
              ? 'PLAYING'
              : state.parties[partyToJoin].status,
          serverTick
        }
      : {
          status: 'NOT_STARTED',
          players: [{ peerId, playerName }],
          serverTick
        }

  return {
    ...state,
    parties: { ...state.parties, [partyToJoin]: newParty },
    games: { [partyToJoin]: { players: [getDefaultPlayer(1), getDefaultPlayer(2)], serverTick } }
  }
}

export function handleMessage(message: Message, peerId: string) {
  // console.log(`handling message: ${JSON.stringify(message)}`)
  if (message.type === 'JOIN_PARTY') {
    state = handleJoinParty(peerId, message.playerName)
  } else if (message.type === 'LOG') {
    console.log(message.message)
  } else if (message.type === 'CLIENT_TICK') {
    state.clientTicks[peerId] = state.clientTicks[peerId] || {
      ackedServerTick: -1,
      clientTick: -1
    }
    if (message.clientTick <= state.clientTicks[peerId].clientTick) {
      console.log(`dupe or outdated message because of outdated clientTick: ${message.clientTick}`)
    }

    const { clientTick, ackedServerTick } = state.clientTicks[peerId]
    const hostId = getHostForPeer(peerId)
    if (!hostId) {
      // they may not have started a game yet
      state.clientTicks[peerId] = {
        ackedServerTick: Math.max(ackedServerTick, message.serverTick),
        clientTick: Math.max(clientTick, message.clientTick)
      }
      console.log(
        `no game started yet, setting the ticks: ${JSON.stringify(state.clientTicks[peerId])}`
      )
      return
    }
    const inputsTicks: Array<number> = Object.keys(message.inputs)
      .map(Number)
      .sort((a, b) => a - b) // ascending order
      .filter(tickId => tickId > clientTick)

    // This is awful. Simpler better logic should be on the server to hold a counter from 0 that increments up by one every 16ms
    // and then players can be bursty with their lag, but we max out at letting them do ~4 moves at once. kind of like bursty apis with quotas
    const ticksSinceLastUpdate = Number.POSITIVE_INFINITY //serverTick - ackedServerTick
    const inputs: Array<PlayerInput> = _.takeRight(
      inputsTicks,
      Math.min(5, ticksSinceLastUpdate)
    ).map(tId => message.inputs[tId]) // if someone is more than 5 ticks behind...too bad for them, we'll drop their inputs and they can rubberband

    // newWorld.serverTick = serverTick
    // TODO: move off index this sucks
    let playerId = state.parties[hostId].players.findIndex(player => player.peerId === peerId)
    // console.log(JSON.stringify(state.parties[hostId]))
    if (playerId === -1) {
      console.error(`playerId is -1, could not find player for peer ${peerId}`)
      return
    }

    const newWorld = stepPlayer(state.games[hostId], playerId, inputs)
    newWorld.serverTick = serverTick

    state.games[hostId] = newWorld

    state.clientTicks[peerId] = {
      ackedServerTick: Math.max(ackedServerTick, message.serverTick),
      clientTick: Math.max(clientTick, message.clientTick)
    }
  }
}

/**
 *  Client/Server sync strategy.
 *
 * **Ticks**
 * Tick is a concept for both the client and the server. A tick refers to a state update. Every single time the state updates, the tick number is increased by one.
 * Therefore if the tick rate is 60hz (once every 16ms), every second will increase the tick count by 60.
 *
 * The client and server should independently have a monotonically increasing tick.
 * - A client needs to keep track of its own tick, the server's tick, and the latest ACKed `clientTick` that the server recieved.
 * - A server can maintain a single `serverTick` that is reused for all of its clients, but must maintain a unique `clientTick` and `ackedServerTick` for each client.
 *
 * The *acked* tick tells the server/client what still needs to be sent aka everything that hasn't been ACKed.
 */
const buffer = {}

/* TODO: make this O(1) instead of O(n^2)... */
function getHostForPeer(peerId: string) {
  for (let [host, party] of Object.entries(state.parties)) {
    for (let player of party.players) {
      if (player.peerId === peerId) {
        return host
      }
    }
  }

  return null
  // throw Error(`Could not find host for peerId: ${peerId}`)
}

function getGameDataToSend(peerId: string, hostId: string): { world: World; party: Party } {
  if (!peerId || !hostId) {
    // throw new Error(`peerId: ${peerId} hostId: ${hostId}`)
    return { world: null, party: null }
  }

  const { ackedServerTick } = state.clientTicks[peerId]
  console.log(ackedServerTick, _.get(state.games, [hostId, 'serverTick']))

  return {
    party:
      ackedServerTick <= _.get(state.parties, [hostId, 'serverTick'])
        ? state.parties[hostId]
        : null,
    world:
      ackedServerTick <= _.get(state.games, [hostId, 'serverTick']) ? state.games[hostId] : null
  }
}

function getHeartbeatDataToSend(peerId: string) {
  return { serverTick, clientTick: state.clientTicks[peerId].clientTick }
}

export function getTickData(peers: Array<string>): { [id: string]: SERVER_TICK_MESSAGE } {
  serverTick++

  const tickData = peers.reduce((prevData: { [id: string]: SERVER_TICK_MESSAGE }, peerId) => {
    state.clientTicks[peerId] = state.clientTicks[peerId] || {
      ackedServerTick: -1,
      clientTick: -1
    }

    prevData[peerId] = {
      type: 'SERVER_TICK',
      serverTick,
      clientTick: state.clientTicks[peerId].clientTick,
      ...getHeartbeatDataToSend(peerId),
      ...getGameDataToSend(peerId, getHostForPeer(peerId))
    }
    return prevData
  }, {})

  return tickData
}
