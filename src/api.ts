import {
    SERVER_TICK_MESSAGE,
    LIST_PARTIES_MESSAGE,
    CREATE_PARTY_MESSAGE,
    JOIN_PARTY_MESSAGE,
    SET_PARTY_MESSAGE,
    START_GAME_MESSAGE,
    handleCreateParty,
    handleListParties,
    handleJoinParty,
    handleSetParty,
    handleStartGame,
    handlePlayerUpgrades,
    PLAYER_UPGRADE_MESSAGE,
    Powerup,
} from '../server/state'
import { state } from './game'
import SimplePeer from 'simple-peer'
import { navigateForParty } from '.'

let peer: SimplePeer.Instance

export function isConnected() {
    return peer && (peer as any)._channel && (peer as any)._channel.readyState === 'open'
}

function sendTCP(json: object): Promise<any> {
    return fetch('/api', {
        body: JSON.stringify(json),
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    }).then((res) => res.json())
}

export function sendRTC(json: object) {
    peer.send(JSON.stringify(json))
}

export function getId() {
    return (window as any).PEER_ID
}

let connectedRes: Function
let connectedPromise = new Promise((res) => (connectedRes = res))
export function onConnect(cb: Function) {
    connectedPromise.then(() => cb())
}

export async function initializeRTC() {
    console.log('init peer cxn')
    const { signal, id } = await (await fetch('/signal')).json()
    console.log('successfully fetched signal from server')
    peer = (window as any).peer = new (window as any).SimplePeer({
        trickle: false,
        channelConfig: {
            ordered: false,
            maxRetransmits: 0,
        },
    })
    peer.on('signal', function (data: string) {
        console.log('sending our signal to the server')
        fetch('/signal', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id, signal: data }),
            credentials: 'include',
        })
    })

    peer.on('connect', function () {
        console.log('CONNECTED')
        connectedRes()
    })

    peer.on('data', function (data: string) {
        state.handleServerMessage(JSON.parse(data) as SERVER_TICK_MESSAGE)
        navigateForParty(state.getParty())
    })

    // get this show on the road
    peer.signal(signal)
}

export function listParties(): Promise<ReturnType<typeof handleListParties>> {
    const message: LIST_PARTIES_MESSAGE = { type: 'LIST_PARTIES' }
    return sendTCP(message)
}
export function createParty(name: string): Promise<ReturnType<typeof handleCreateParty>> {
    const message: CREATE_PARTY_MESSAGE = { type: 'CREATE_PARTY', name }
    return sendTCP(message)
}

export function joinParty(
    partyId: string,
    playerName: string,
    test?: boolean,
): Promise<ReturnType<typeof handleJoinParty>> {
    const message: JOIN_PARTY_MESSAGE = { type: 'JOIN_PARTY', playerName, partyId, test }
    return sendTCP(message)
}
export function selectUpgrade(
    powerup: Powerup,
    delta: -1 | 1,
): Promise<ReturnType<typeof handlePlayerUpgrades>> {
    const message: PLAYER_UPGRADE_MESSAGE = { type: 'PLAYER_UPGRADES', powerup, delta }
    return sendTCP(message)
}
export function setParty(id: string): Promise<ReturnType<typeof handleSetParty>> {
    const message: SET_PARTY_MESSAGE = { type: 'SET_PARTY', id }
    return sendTCP(message)
}
export function startGame(partyId: string): Promise<ReturnType<typeof handleStartGame>> {
    const message: START_GAME_MESSAGE = { type: 'START_GAME', partyId }
    return sendTCP(message)
}

// export async function getRTCStats() {
//     let stats: any = (await (peer as any)._pc.getStats())
//         .values()
//         .find((x: any) => x.type === 'data-channel')

//     return {
//         bytesRecieved: stats.bytesReceived,
//         messagesReceived: stats.messagesReceived,
//         bytesSent: stats.bytesSent,
//         messagesSent: stats.messagesSent,
//     }
// }
