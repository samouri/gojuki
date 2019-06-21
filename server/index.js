const express = require("express");
const app = express();
const Peer = require("simple-peer");
const wrtc = require("wrtc");
const bodyParser = require("body-parser");
const session = require("express-session");
const path = require("path");

let peers = {};
app.use(bodyParser.json());
app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
  })
);

app.use(express.static(path.resolve(__dirname, '..', 'dist')));

app.get("/", (req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'dist/index.html'));
});

app.get("/signal", (req, res) => {
  const id = req.sessionID;
  // if they refresh the browser
  if (peers[id]) {
    console.log(`peer ${id} already had a cxn, so lets scrap it`);
    peers[id].destroy();
    delete peers[id];
  }

  let peer = new Peer({
    initiator: true,
    wrtc,
    trickle: false,
    channelConfig: {
      ordered: false,
      maxRetransmits: 0,
    }
  });
  peer.sessionID = id;
  peers[id] = peer;

  peer.on("connect", function () {
    console.log("CONNECTED!!!");
    peer.send("babe we did it");
  });

  peer.on("signal", data => {
    console.log(`initial signaling for client: ${peer.sessionID}`);
    res.send(JSON.stringify({ id: peer.id, signal: data }));
  });
  peer.on('data', data => {
    console.log(`message: ${data}`);
  })
  peer.on("error", (err) => {
    console.error(err);
    delete peers[id]
  });
  peer.on("close", () => delete peers[id]);
  peer.on("destroy", () => delete peers[id]);
});

app.post("/signal", (req, res) => {
  const { signal } = req.body;
  console.log(`signal recieved back from client: ${req.sessionID}`);
  peers[req.sessionID].signal(signal);
});

app.listen(3000);
