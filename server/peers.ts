import * as Peer from 'simple-peer'
const wrtc: any = require('wrtc')

export interface Client {
    send(data: string): void
}

const peers: Map<string, Peer.Instance> = new Map()

export function signalPeer(sessionId: string, signalData: string) {
    peers.get(sessionId).signal(signalData)
}

export async function registerPeer(
    sessionId: string,
    messageHandler: Function,
): Promise<string> {
    if (peers.has(sessionId)) {
        console.log(
            `peer ${sessionId} already had a cxn, so lets scrap it / recreate it`,
        )
        peers.get(sessionId).destroy()
        peers.delete(sessionId)
    }

    const peer: Peer.Instance = new Peer({
        initiator: true,
        wrtc,
        trickle: false,
        channelConfig: {
            ordered: false,
            maxRetransmits: 0,
        },
    })
    peers.set(sessionId, peer)
    peer.on('data', async data => {
        messageHandler(JSON.parse(data), sessionId)
    })
    return new Promise((resolve, reject) => {
        peer.on('signal', resolve)

        peer.on('error', err => {
            console.error('error in registration: ', err)
            peers.delete(sessionId)
            reject(err)
        })
        peer.on('close', () => {
            console.log(`closing peer for session: ${sessionId}`)
            peers.delete(sessionId)
        })
        peer.on('destroy', () => {
            console.log(`destroying peer for session: ${sessionId}`)
            peers.delete(sessionId)
        })
    })
}

export function getClients(): Map<string, Client> {
    deleteDisconnectedPeers()
    return new Map(
        Array.from(peers.entries()).filter(([id_, peer]) =>
            isConnectedPeer(peer),
        ),
    )
}

// ----------------------------------------------------------------------

function deleteDisconnectedPeers() {
    for (const [id, peer] of peers) {
        if (isDisconnectedPeer(peer)) {
            peers.delete(id)
        }
    }
}
function isDisconnectedPeer(peer: Peer.Instance) {
    const readyState = peer && (peer as any)._channel.readyState
    return readyState !== 'open' && readyState !== 'connecting'
}
function isConnectedPeer(peer: Peer.Instance) {
    const readyState = peer && (peer as any)._channel.readyState
    return readyState === 'open'
}

export async function jitter(n: number) {
    await sleep(Math.random() * n)
}

async function sleep(n: number) {
    return new Promise(resolve => {
        setTimeout(resolve, n)
    })
}
