import { Message } from '../server/state'
import { handleServerTick } from './game'
import SimplePeer = require('simple-peer')

let peer: SimplePeer.Instance
let peerId: string

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
    return peerId
}

function handleMessage(message: Message) {
    if (message.type === 'LOG') {
        console.log(message.message)
    } else if (message.type === 'SERVER_TICK') {
        handleServerTick(message)
    }
}

export async function initializeRTC() {
    console.log('init peer cxn')
    const { signal, id } = await (await fetch('/signal')).json()
    console.log('successfully fetched signal from server')
    peerId = id
    peer = new (window as any).SimplePeer({
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
    })

    peer.on('data', function(data: string) {
        handleMessage(JSON.parse(data) as Message)
    })

    // get this show on the road
    peer.signal(signal)
}
