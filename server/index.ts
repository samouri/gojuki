import * as express from 'express'
import * as session from 'express-session'
import * as bodyParser from 'body-parser'
import * as path from 'path'
import * as peers from './peers'
import * as state from './state'
import { handleMessage, Message } from './state'
const app = express()

app.use(bodyParser.json())
app.use(
    session({
        secret: 'secret',
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false },
    }),
)

app.get('/', (req, res) => res.send(html.replace(`{PEER_ID}`, req.sessionID)))
app.use(express.static(path.resolve(__dirname, '..', 'dist')))
app.get('/signal', async (req, res) => {
    state.initTicks(req.sessionID)
    const signal = await peers.registerPeer(req.sessionID, state.handleMessage)
    res.send(JSON.stringify({ id: req.sessionID, signal }))
})

app.post('/signal', (req, res) => {
    peers.signalPeer(req.sessionID, req.body.signal)
    res.send(`success`)
})

app.post('/api', (req, res) => {
    const resp = handleMessage(req.body as Message, req.sessionID)
    res.json(resp)
})

const html: string = require('fs').readFileSync(path.resolve(__dirname, '..', 'dist/index.html'), {
    encoding: 'utf8',
})
app.get('/*', (req, res) => res.send(html.replace(`{PEER_ID}`, req.sessionID)))

const port = process.env.PORT || 3000
console.log(`Load up the game at: http://localhost:${port}`)
app.listen(port)

setInterval(sendGameUpdates, 33) /* send 30 updates/second. 1000/30 = ~33 */
function sendGameUpdates() {
    state.stepWorlds()
    for (const [clientId, client] of peers.getClients()) {
        client.send(JSON.stringify(state.getTickData(clientId)))
    }
}
