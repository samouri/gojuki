import * as express from "express"
import * as Peer from "simple-peer"
import * as session from "express-session"
import * as bodyParser from "body-parser"
import * as path from "path"
import * as peers from "./peers"
import * as state from "./state"
const app = express()

app.use(bodyParser.json())
app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  }),
)

app.use(express.static(path.resolve(__dirname, "..", "dist")))
app.get("/", (req, res) => res.sendFile(path.resolve(__dirname, "..", "dist/index.html")))

app.get("/signal", async (req, res) => {
  state.initTicks(req.sessionID)
  const signal = await peers.registerPeer(req.sessionID, state.handleMessage)
  res.send(JSON.stringify({ id: req.sessionID, signal }))
})

app.post("/signal", (req, res) => {
  peers.signalPeer(req.sessionID, req.body.signal)
  res.send(`success`)
})

app.listen(3000)

setInterval(sendGameUpdates, 33) /* send 30 updates/second. 1000/30 = ~33 */
function sendGameUpdates() {
  const piers = peers.getPeers()
  for (const [peerId, tickMessage] of Object.entries(state.getTickData(Array.from(piers.keys())))) {
    // todo: is it okay that getTickData also increases the serverTick?
    const peer = piers.get(peerId)
    peer.send(JSON.stringify(tickMessage))
  }
}
