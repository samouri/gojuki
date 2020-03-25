import { Message, SERVER_TICK_MESSAGE } from '../server/state'
import { handleServerTick } from './game'
import SimplePeer from 'simple-peer'

let peer: SimplePeer.Instance
let peerId: string

export function isConnected() {
    return peer && (peer as any)._channel && (peer as any)._channel.readyState === 'open'
}
export function sendTCP(json: object): Promise<any> {
    return fetch('/api', {
        body: JSON.stringify(json),
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    })
}

export function sendRTC(json: object) {
    peer.send(JSON.stringify(json))
}

export function getId() {
    return (window as any).PEER_ID
}

function handleMessage(message: SERVER_TICK_MESSAGE) {
    handleServerTick(message)
}

let connectedRes: Function
let connectedPromise = new Promise(res => (connectedRes = res))
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
    peer.on('signal', function(data: string) {
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

    peer.on('connect', function() {
        console.log('CONNECTED')
        connectedRes()
    })

    peer.on('data', function(data: string) {
        handleMessage(JSON.parse(data) as SERVER_TICK_MESSAGE)
    })

    // get this show on the road
    peer.signal(signal)
}

export async function getRTCStats() {
    let stats: any = (await (peer as any)._pc.getStats())
        .values()
        .find((x: any) => x.type === 'data-channel')

    return {
        bytesRecieved: stats.bytesReceived,
        messagesReceived: stats.messagesReceived,
        bytesSent: stats.bytesSent,
        messagesSent: stats.messagesSent,
    }
}
