import * as React from 'react'
import * as ReactDOM from 'react-dom'
import swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'
import './style.css'
import { Router, Link, RouteComponentProps, navigate } from '@reach/router'
import { Message, Party, Player, joinParty } from '../server/state'
import { Instance } from 'simple-peer'

declare global {
  interface Window {
    peer: Instance
    peerId: string
    SimplePeer: any
    appSetState: Function
  }
}

const Swal = withReactContent(swal)

const fontFamily = "'Press Start 2P', cursive"

class App extends React.Component {
  state: { serverState: Party; serverConnected: boolean } = {
    serverState: { players: [], status: 'NOT_STARTED' },
    serverConnected: false
  }
  componentDidMount() {
    window.appSetState = (s: any) => this.setState(s)
  }
  componentDidUpdate(_prevProps: any, prevState: { serverState: Party }) {
    const { players, status } = this.state.serverState
    if (players !== prevState.serverState.players) {
      if (players.length > 0 && status === 'NOT_STARTED') {
        navigate('/party')
      }
    }
  }

  render() {
    return (
      <div className="app">
        <Router style={{ width: '100%', height: '100%' }}>
          <GameScreen path="/" />
          {/* <StartScreen path="/" isConnected={this.state.serverConnected} />
          <PartyScreen
            path="/party"
            setPlayerName={(playerName: string) => {
              window.peer.send(JSON.stringify(joinParty(window.peerId, playerName)))
            }}
            players={this.state.serverState.players}
          /> */}
        </Router>
      </div>
    )
  }
}
class PartyScreen extends React.Component<
  RouteComponentProps & { players: Array<Player>; setPlayerName: Function }
> {
  state = {}
  componentDidMount() {
    if (!this.props.players.some(({ peerId }) => window.peerId === peerId)) {
      this.props.setPlayerName(prompt('What is your player name?'))
    }
  }

  render() {
    const { players } = this.props
    const playerColors = ['#E93F3F', '#3FE992', '#3FD3E9', '#E93FDB']
    const maxPlayers = 4
    const waitingFor = maxPlayers - players.length

    return (
      <div
        className="partyScreen"
        style={{ width: '100%', flexDirection: 'column', alignItems: 'center' }}
      >
        <div style={{ flexDirection: 'row', alignSelf: 'start', padding: 20 }}>
          <Link to="/" className="yellowBtn">
            <span>Home</span>
          </Link>
          <InfoButton content={HowToPlay}>How to play</InfoButton>
        </div>
        <h1 style={{ fontSize: 32, fontFamily, color: '#e91e63' }}>Party Lobby</h1>
        <h1 style={{ fontSize: 18, fontFamily, color: 'white' }}>
          Waiting for {waitingFor} more player(s)...
        </h1>
        <ul id="player-list">
          {players.map(({ playerName }, i) => (
            <li
              className={'player player-' + (i + 1)}
              style={{ color: playerColors[i], paddingBottom: '15' }}
              key={playerName}
            >
              player {i + 1}: {playerName}
            </li>
          ))}
        </ul>
      </div>
    )
  }
}

class StartScreen extends React.Component<RouteComponentProps & { isConnected: boolean }> {
  render() {
    return (
      <div className="app">
        <h1 style={{ fontSize: 80, fontFamily, color: '#e91e63', paddingTop: 90 }}>Gojuki</h1>
        {!this.props.isConnected ? (
          <span className="app_loadingbtn">loading...</span>
        ) : (
          <Link to="party">
            <button className="app__playbtn">Play</button>
          </Link>
        )}
        <div style={{ flexDirection: 'row', paddingTop: '30px' }}>
          <InfoButton content={HowToPlay}>How to play</InfoButton>
          <InfoButton content={About}>About</InfoButton>
        </div>
      </div>
    )
  }
}

import bugImg from '../img/bug/bug1.png'
const img = new Image()
img.src = bugImg

const pressedKeys = new Set()
window.addEventListener('keydown', event => pressedKeys.add(event.code))
window.addEventListener('keyup', event => pressedKeys.delete(event.code))

class GameScreen extends React.Component<RouteComponentProps> {
  static canvasWidth = 768
  static canvasHeight = 480
  raf: number
  ctx: CanvasRenderingContext2D
  canvas: HTMLCanvasElement
  pressedKeys = new Set()
  x = 0
  y = 0
  v = 0
  friction = 0.9
  turnSpeed = 0.1
  acceleration = 1
  rotation = 0

  componentDidMount() {
    requestAnimationFrame(this.gameLoop)
  }
  componentWillUnmount() {
    cancelAnimationFrame(this.raf)
  }

  gameLoop = () => {
    if (!this.canvas) {
      return
    }
    let ctx = this.canvas.getContext('2d')
    if (pressedKeys.has('ArrowUp')) {
      this.v += this.acceleration
    }
    this.v *= this.friction
    this.x = this.x + Math.sin(this.rotation) * this.v
    this.y = this.y + Math.cos(this.rotation) * -1 * this.v
    if (pressedKeys.has('ArrowLeft')) {
      this.rotation -= this.turnSpeed
    } else if (pressedKeys.has('ArrowRight')) {
      this.rotation += this.turnSpeed
    }
    this.x = Math.min(Math.max(10, this.x), GameScreen.canvasWidth - 10)
    this.y = Math.min(Math.max(10, this.y), GameScreen.canvasHeight - 10)
    ctx.fillStyle = 'black'
    ctx.clearRect(0, 0, GameScreen.canvasWidth, GameScreen.canvasHeight)
    ctx.translate(this.x, this.y)
    ctx.rotate(this.rotation)
    ctx.drawImage(img, -10, -10, 20, 20)
    ctx.rotate(-this.rotation)
    ctx.translate(-this.x, -this.y)
    requestAnimationFrame(this.gameLoop)
  }

  render() {
    return (
      <>
        <canvas
          id="game"
          style={{
            width: GameScreen.canvasWidth,
            height: GameScreen.canvasHeight,
            margin: '100 auto'
          }}
          ref={canvas => {
            canvas.width = GameScreen.canvasWidth
            canvas.height = GameScreen.canvasHeight
            this.canvas = canvas
          }}
        />
      </>
    )
  }
}

class InfoButton extends React.Component<{ content: CallableFunction }> {
  render() {
    return (
      <a
        className="infoButton"
        onClick={() =>
          Swal.fire({
            html: <this.props.content />,
            customClass: { confirmButton: 'sweetalert_confirm' },
            showCloseButton: true
          })
        }
      >
        {this.props.children}
      </a>
    )
  }
}

class About extends React.Component {
  render() {
    return (
      <div className="about">
        <h1 className="about__header">About</h1>
        <p className="about__content">Hungry, Hungry, ...Cockroaches?</p>
        <p className="about__content">
          Maybe this is what insects do in your kitchen when you're sleeping.
        </p>
        <br />
      </div>
    )
  }
}

class HowToPlay extends React.Component {
  render() {
    return (
      <div className="howToPlay">
        <h1 className="howToPlay__header">How to Play</h1>
        <ul>
          <li className="howToPlay__info">Collect and return food to your base.</li>
          <li className="howToPlay__info">Whoever has the most food after 3 rounds wins.</li>
          <li className="howToPlay__info">Trade food for upgrades between rounds.</li>
          <li className="howToPlay__info">Use arrow keys to move. Use space to use item.</li>
        </ul>
      </div>
    )
  }
}

async function initServerCxn() {
  console.log('init peer cxn')
  const { signal, id } = await (await fetch('/signal')).json()
  console.log('successfully fetched signal from server')
  var p = new window.SimplePeer({
    trickle: false,
    channelConfig: {
      ordered: false,
      maxRetransmits: 0
    }
  })
  window.peer = p
  window.peerId = id
  p.on('signal', function(data: string) {
    console.log('sending our signal to the server')
    fetch('/signal', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id, signal: data }),
      credentials: 'include'
    })
  })

  p.on('connect', function() {
    console.log('CONNECTED')
  })

  p.on('data', function(data: string) {
    handleMessage(JSON.parse(data) as Message)
  })

  // get this show on the road
  p.signal(signal)
  window.appSetState({ serverConnected: true })
}

function handleMessage(message: Message) {
  if (message.type === 'LOG') {
    console.log(message.message)
  } else if (message.type === 'CLIENT_SAVE_STATE') {
    window.appSetState({ serverState: message.state, serverConnected: true })
  }
}

window.onload = function init() {
  initServerCxn().catch(err => console.error(err))
  ReactDOM.render(<App />, document.getElementById('app'))
}
