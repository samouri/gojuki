import * as _ from "lodash"
import { PlayerInput, World, getDefaultPlayer, stepPlayer } from "./game"
const maxPartySize = 2
let serverTick = 0

/* Messages & message creators */
export type LOG_MESSAGE = { type: "LOG"; message: string }
export type JOIN_PARTY_MESSAGE = { type: "JOIN_PARTY"; playerName: string; peerId: string }
export type PLAYER_INPUTS = { type: "CLIENT_INPUTS"; input: PlayerInput }
export type SERVER_TICK_MESSAGE = {
  type: "SERVER_TICK"
  world: null | World
  party: null | Party
  serverTick: number
  clientTick: number
}

export type CLIENT_TICK_MESSAGE = {
  type: "CLIENT_TICK"
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
  return { type: "LOG", message }
}

export function joinParty(peerId: string, playerName: string): JOIN_PARTY_MESSAGE {
  return { type: "JOIN_PARTY", playerName, peerId }
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
  status: "NOT_STARTED" | "PLAYING" | "FINISHED"
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
  clientTicks: {},
}

let partyIndex: any = {}
let nextParty = 0
export function initTicks(peerId: string) {
  state.clientTicks[peerId] = {
    ackedServerTick: -1,
    clientTick: -1,
  }
}

function handleJoinParty(peerId: string, playerName: string) {
  let partyId = Object.keys(state.parties).find(partyId => {
    const party = state.parties[partyId]
    return party.status === "NOT_STARTED" && party.players.length < maxPartySize
  })

  if (partyId) {
    const party = state.parties[partyId]
    party.players.push({ peerId, playerName })
    party.serverTick = serverTick
    if (party.players.length === maxPartySize) {
      party.status = "PLAYING"
    }
  } else {
    partyId = String(nextParty++)
    state.parties[partyId] = {
      status: "NOT_STARTED",
      players: [{ peerId, playerName }],
      serverTick,
    }
    partyIndex[peerId] = partyId
  }
}

export function handleMessage(message: Message, peerId: string) {
  // console.log(`handling message: ${JSON.stringify(message)}`)
  if (message.type === "JOIN_PARTY") {
    handleJoinParty(peerId, message.playerName)
  } else if (message.type === "LOG") {
    console.log(message.message)
  } else if (message.type === "CLIENT_TICK") {
    if (message.clientTick <= state.clientTicks[peerId].clientTick) {
      console.log(`dupe or outdated message because of outdated clientTick: ${message.clientTick}`)
    }

    const partyId = getPartyId(peerId)
    if (!partyId) {
      console.log(`no game started yet, why is CLIENT_TICK being called?`)
      return
    }

    const prevClientTick = state.clientTicks[peerId].clientTick
    const clientTick = message.clientTick
    state.clientTicks[peerId] = { clientTick, ackedServerTick: message.serverTick }

    const inputsTicks: Array<number> = Object.keys(message.inputs)
      .map(Number)
      .sort((a, b) => a - b) // ascending order
      .filter(tickId => tickId > prevClientTick)

    // This is awful anti-cheat logic. Right now clients can make 4 moves every move.
    // TODO: use bursty api logic. hold a counter from 0 that increments up by one every 16ms w/ a low max. that num represents how many moves a client can make.
    const inputs: Array<PlayerInput> = _.takeRight(inputsTicks, 4).map(tId => message.inputs[tId]) // if someone is more than 5 ticks behind...too bad for them, we'll drop their inputs and they can rubberband

    // TODO: move off index this sucks
    let playerId = state.parties[partyId].players.findIndex(player => player.peerId === peerId)
    if (playerId === -1) {
      console.error(`playerId is -1, could not find player for peer ${peerId}`)
      return
    }

    state.games[partyId] = stepPlayer(state.games[partyId], playerId, inputs)
    state.games[partyId].serverTick = serverTick
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

function getGameDataToSend(peerId: string, partyId: string): { world: World; party: Party } {
  if (!peerId || !partyId) {
    // throw new Error(`peerId: ${peerId} hostId: ${hostId}`)
    return { world: null, party: null }
  }

  const { ackedServerTick } = state.clientTicks[peerId]

  return {
    party:
      ackedServerTick < _.get(state.parties, [partyId, "serverTick"])
        ? state.parties[partyId]
        : null,
    world:
      ackedServerTick < _.get(state.games, [partyId, "serverTick"]) ? state.games[partyId] : null,
  }
}

function getHeartbeatDataToSend(peerId: string) {
  return { serverTick, clientTick: state.clientTicks[peerId].clientTick }
}

export function getTickData(peers: Array<string>): { [id: string]: SERVER_TICK_MESSAGE } {
  serverTick++

  const tickData: { [id: string]: SERVER_TICK_MESSAGE } = {}
  peers.forEach(peerId => {
    tickData[peerId] = {
      type: "SERVER_TICK",
      ...getHeartbeatDataToSend(peerId),
      ...getGameDataToSend(peerId, getPartyId(peerId)),
    }
    return tickData
  })

  return tickData
}
