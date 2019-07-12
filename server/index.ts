import * as express from 'express'
import * as Peer from 'simple-peer'
import * as session from 'express-session'
import * as bodyParser from 'body-parser'
import * as path from 'path'
import { handleMessage, log, getTickData } from './state'
const wrtc: any = require('wrtc')

const app = express()

export type Peers = { [id: string]: Peer.Instance }
let peers: Peers = {}
app.use(bodyParser.json())
app.use(
  session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
  })
)

app.use(express.static(path.resolve(__dirname, '..', 'dist')))

app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'dist/index.html'))
})

app.get('/signal', (req, res) => {
  const id = req.sessionID
  // if they refresh the browser
  if (peers[id]) {
    console.log(`peer ${id} already had a cxn, so lets scrap it / recreate it`)
    peers[id].destroy()
    delete peers[id]
  }

  let peer: Peer.Instance = new Peer({
    initiator: true,
    wrtc,
    trickle: false,
    channelConfig: {
      ordered: false,
      maxRetransmits: 0
    }
  })
  peers[id] = peer

  peer.on('connect', function() {
    console.log('CONNECTED!!!')
    peer.send(JSON.stringify(log('babe we did it')))
  })

  peer.on('signal', data => {
    console.log(`initial signaling for client: ${id}`)
    res.send(JSON.stringify({ id, signal: data }))
  })
  peer.on('data', data => {
    handleMessage(JSON.parse(data), id)
  })
  peer.on('error', err => {
    console.error(err)
    delete peers[id]
  })
  peer.on('close', () => delete peers[id])
  peer.on('destroy', () => delete peers[id])
})

app.post('/signal', (req, res) => {
  const { signal } = req.body
  console.log(`signal recieved back from client: ${req.sessionID}`)
  peers[req.sessionID].signal(signal)
})

app.listen(3000)

setInterval(sendGameUpdates, 33) /* send 30 updates/second. 1000/30 = ~33 */
function sendGameUpdates() {
  const connectedPeers: Array<string> = Object.keys(peers).filter(peerId =>
    isConnectedPeer(peers[peerId])
  )
  for (const [peerId, tickMessage] of Object.entries(getTickData(connectedPeers))) {
    // todo: is it okay that getTickData also increases the serverTick?
    const peer = peers[peerId]
    if (isConnectedPeer(peer)) {
      // console.log(`sending out message: ${JSON.stringify(tickMessage)}`)
      peer.send(JSON.stringify(tickMessage))
    }
  }
}

function isConnectedPeer(peer: Peer.Instance) {
  return peer && (peer as any)._channel.readyState === 'open'
}
