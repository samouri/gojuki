import * as _ from "lodash"
import { PlayerInput, World, getDefaultPlayer } from "./game"
const maxPartySize = 2

/* Messages & message creators */
export type LOG_MESSAGE = { type: "LOG"; message: string }
export type JOIN_PARTY_MESSAGE = { type: "JOIN_PARTY"; playerName: string; peerId: string }
export type CLIENT_SAVE_GAME_STATE_MESSAGE = { type: "CLIENT_SAVE_GAME_STATE"; state: World }
export type CLIENT_SAVE_UI_STATE_MESSAGE = { type: "CLIENT_SAVE_UI_STATE"; state: Party }
export type SEND_INPUTS = { type: "CLIENT_INPUTS"; input: PlayerInput }
export type Message =
  | LOG_MESSAGE
  | JOIN_PARTY_MESSAGE
  | CLIENT_SAVE_UI_STATE_MESSAGE
  | SEND_INPUTS
  | CLIENT_SAVE_GAME_STATE_MESSAGE

export function log(message: string): LOG_MESSAGE {
  return { type: "LOG", message }
}
export function saveClientGameState(state: World): CLIENT_SAVE_GAME_STATE_MESSAGE {
  return { type: "CLIENT_SAVE_GAME_STATE", state }
}

export function saveClienUiState(state: Party): CLIENT_SAVE_UI_STATE_MESSAGE {
  return { type: "CLIENT_SAVE_UI_STATE", state }
}
export function joinParty(peerId: string, playerName: string): JOIN_PARTY_MESSAGE {
  return { type: "JOIN_PARTY", playerName, peerId }
}

/* State Types*/
export type stateT = {
  parties: { [id: string]: Party & { fresh: boolean } }
  games: { [id: string]: World }
}

export type Party = {
  players: Array<Player>
  status: "NOT_STARTED" | "PLAYING" | "FINISHED"
}

export type Player = {
  playerName: string
  peerId: string
}

/* State Handlers */

let state: stateT = {
  parties: {},
  games: {},
}

function handleJoinParty(peerId: string, playerName: string) {
  let partyToJoin = peerId // if we can't find an open party, then make a new one with the peerId of the first member.
  for (let [partyId, party] of Object.entries(state.parties)) {
    if (party.status === "NOT_STARTED" && party.players.length < maxPartySize) {
      partyToJoin = partyId
      break
    }
  }

  const newParty: Party & { fresh: boolean } =
    partyToJoin in state.parties
      ? {
          ...state.parties[partyToJoin],
          players: [...state.parties[partyToJoin].players, { playerName, peerId }],
          status:
            maxPartySize === state.parties[partyToJoin].players.length + 1
              ? "PLAYING"
              : state.parties[partyToJoin].status,
          fresh: true,
        }
      : {
          status: "NOT_STARTED",
          players: [{ peerId, playerName }],
          fresh: true,
        }

  return {
    ...state,
    parties: { ...state.parties, [partyToJoin]: newParty },
    games: { [partyToJoin]: { players: [getDefaultPlayer(1), getDefaultPlayer(2)] } },
  }
}

export function handleMessage(message: Message) {
  console.log(`handling message: ${JSON.stringify(message)}`)
  if (message.type === "JOIN_PARTY") {
    state = handleJoinParty(message.peerId, message.playerName)
  } else if (message.type === "LOG") {
    console.log(message.message)
  } else if (message.type === "CLIENT_INPUTS") {
  }
}

export function getParties() {
  return state.parties
}

export function getGames() {
  return state.games
}
