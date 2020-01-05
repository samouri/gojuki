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
    res.json(handleMessage(req.body as Message, req.sessionID))
})

app.get('/*', (req, res) =>
    res.sendFile(path.resolve(__dirname, '..', 'dist/index.html')),
)

app.listen(3000)

setInterval(sendGameUpdates, 33) /* send 30 updates/second. 1000/30 = ~33 */
function sendGameUpdates() {
    state.tick()
    for (const [clientId, client] of peers.getClients()) {
        client.send(JSON.stringify(state.getTickData(clientId)))
    }
}
