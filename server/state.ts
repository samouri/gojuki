import * as _ from 'lodash'
const maxPartySize = 4

/* Messages & message creators */
export type LOG_MESSAGE = { type: 'LOG'; message: string }
export type JOIN_PARTY_MESSAGE = { type: 'JOIN_PARTY'; playerName: string; peerId: string }
export type CLIENT_SAVE_STATE_MESSAGE = { type: 'CLIENT_SAVE_STATE'; state: Party }
export type Message = LOG_MESSAGE | JOIN_PARTY_MESSAGE | CLIENT_SAVE_STATE_MESSAGE

export function log(message: string): LOG_MESSAGE {
  return { type: 'LOG', message }
}
export function saveClientState(state: Party): CLIENT_SAVE_STATE_MESSAGE {
  return { type: 'CLIENT_SAVE_STATE', state }
}
export function joinParty(peerId: string, playerName: string): JOIN_PARTY_MESSAGE {
  return { type: 'JOIN_PARTY', playerName, peerId }
}

/* State Types*/
export type stateT = {
  parties: { [id: string]: Party }
}

export type Party = {
  players: Array<Player>
  status: 'NOT_STARTED' | 'PLAYING' | 'FINISHED'
}
export type Player = {
  playerName: string
  peerId: string
}

/* State Handlers */

let state: stateT = {
  parties: {}
}

function handleJoinParty(peerId: string, playerName: string) {
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
          players: [...state.parties[partyToJoin].players, { playerName, peerId }]
        }
      : { status: 'NOT_STARTED', players: [{ peerId, playerName }] }

  return { ...state, parties: { ...state.parties, [partyToJoin]: newParty } }
}

export function handleMessage(message: Message) {
  console.log(`handling message: ${message}`)
  if (message.type === 'JOIN_PARTY') {
    state = handleJoinParty(message.peerId, message.playerName)
  } else if (message.type === 'LOG') {
    console.log(message.message)
  }
}

export function getParties() {
  return state.parties
}
