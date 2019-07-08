import * as _ from 'lodash'
import { PlayerInput, World, getDefaultPlayer, stepPlayer } from './game'
import { InputType } from 'zlib'
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
    [id: string]: { clientTick: number; ackedServerTick: number; clientTickAtLastAck: number }
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
              : state.parties[partyToJoin].status
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
  console.log(`handling message: ${JSON.stringify(message)}`)
  if (message.type === 'JOIN_PARTY') {
    state = handleJoinParty(peerId, message.playerName)
  } else if (message.type === 'LOG') {
    console.log(message.message)
  } else if (message.type === 'CLIENT_TICK') {
    state.clientTicks[peerId] = state.clientTicks[peerId] || {
      ackedServerTick: -1,
      clientTick: -1,
      clientTickAtLastAck: -1
    }
    const { clientTick, ackedServerTick, clientTickAtLastAck } = state.clientTicks[peerId]
    const hostId = getHostForPeer(peerId)
    if (!hostId) {
      state.clientTicks[peerId] = {
        ackedServerTick: Math.max(ackedServerTick, message.serverTick),
        clientTick: Math.max(clientTick, message.clientTick),
        clientTickAtLastAck: ackedServerTick < message.serverTick ? clientTick : clientTickAtLastAck
      }
      return
    }
    const inputsTicks: Array<number> = _.sortBy(Object.keys(message.inputs).map(_.toNumber)).filter(
      tickId => clientTick < tickId
    )

    const ticksSinceLastUpdate = serverTick - ackedServerTick
    const inputs = _.pick(
      message.inputs,
      _.takeRight(inputsTicks, Math.min(5, ticksSinceLastUpdate)) // if someone is more than 5 ticks behind...too bad for them, we'll drop their inputs and they can rubberband
    )

    let newWorld = state.games[hostId]
    // newWorld.serverTick = serverTick
    // TODO: move off index this sucks
    let playerId = -1
    state.parties[hostId].players.forEach((player, index) => {
      if (player.peerId === peerId) {
        playerId = index
      }
    })
    if (playerId === -1) {
      throw new Error(`playerId is -1, could not find player for peer ${peerId}`)
    }

    for (const input of Object.values(inputs)) {
      newWorld = stepPlayer(newWorld, playerId, input)
    }
    state.games[hostId] = newWorld

    state.clientTicks[peerId] = {
      ackedServerTick: Math.max(ackedServerTick, message.serverTick),
      clientTick: Math.max(clientTick, message.clientTick),
      clientTickAtLastAck: ackedServerTick < message.serverTick ? clientTick : clientTickAtLastAck
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

function getDataToSend(peerId: string, hostId: string): SERVER_TICK_MESSAGE {
  // const hostId = getHostForPeer(peerId)
  state.clientTicks[peerId] = state.clientTicks[peerId] || {
    ackedServerTick: -1,
    clientTick: -1,
    clientTickAtLastAck: -1
  }
  const { ackedServerTick, clientTick } = state.clientTicks[peerId]
  const data: SERVER_TICK_MESSAGE = {
    type: 'SERVER_TICK',
    serverTick,
    clientTick,
    world: null,
    party: null
  }

  if (ackedServerTick < state.games[hostId].serverTick) {
    data.world = state.games[hostId]
  }
  if (ackedServerTick < state.parties[hostId].serverTick) {
    data.party = state.parties[hostId]
  }

  return data
}

export function getTickData() {
  serverTick++

  const data: { [peerId: string]: SERVER_TICK_MESSAGE } = {}
  Object.entries(state.parties).forEach(([hostId, party]) => {
    party.players.forEach(player => (data[player.peerId] = getDataToSend(player.peerId, hostId)))
  })

  return data
}
