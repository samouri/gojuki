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
    window.peer.send(JSON.stringify(json))
}
