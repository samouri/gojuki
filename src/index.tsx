import * as React from 'react'
import * as ReactDOM from 'react-dom'
import swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'
import './style.css'
import { Router, Link, RouteComponentProps, navigate } from '@reach/router'
import { Message, Party, joinParty, Player } from '../server/state'
import { World, getGameDimensions, HUD_HEIGHT } from '../server/game'
import { Instance } from 'simple-peer'
import { localClientStep, handleServerTick } from './game'
import { drawWorld } from './draw'

declare global {
    interface Window {
        peer: Instance
        peerId: string
        SimplePeer: any
        appSetState: any
        serverParty: Party
        serverWorld: World
        clientWorld: World
    }
}

const Swal = withReactContent(swal)

const fontFamily = "'Press Start 2P', cursive"

class App extends React.Component {
    state: { serverState: Party; serverConnected: boolean } = {
        serverState: { players: [], status: 'NOT_STARTED', serverTick: 0 },
        serverConnected: false,
    }
    componentDidMount() {
        window.appSetState = (s: any) => this.setState(s)
    }
    componentDidUpdate(_prevProps: any, prevState: { serverState: Party }) {
        const { players, status } = this.state.serverState
        if (players !== prevState.serverState.players) {
            if (
                players.length > 0 &&
                status === 'NOT_STARTED' &&
                !window.location.pathname.includes('party')
            ) {
                navigate('/party')
            } else if (
                status === 'PLAYING' &&
                !window.location.pathname.includes('game')
            ) {
                navigate('/game')
            }
        }
    }

    render() {
        return (
            <div className="app">
                <Router style={{ width: '100%', height: '100%' }}>
                    <StartScreen
                        path="/"
                        isConnected={this.state.serverConnected}
                    />
                    <PartyScreen
                        path="/party"
                        setPlayerName={(playerName: string) => {
                            window.peer.send(
                                JSON.stringify(
                                    joinParty(window.peerId, playerName),
                                ),
                            )
                        }}
                        players={this.state.serverState.players}
                    />
                    <UpgradesMenu path="/upgrades" />
                    <GameScreen
                        path="/game"
                        players={this.state.serverState.players}
                    />
                </Router>
            </div>
        )
    }
}

class Header extends React.Component {
    render() {
        return (
            <div
                style={{
                    flexDirection: 'row',
                    alignSelf: 'start',
                    padding: 20,
                }}
            >
                <Link to="/" className="yellowBtn">
                    <span>Home</span>
                </Link>
                <InfoButton content={HowToPlay}>How to play</InfoButton>
            </div>
        )
    }
}
class PartyScreen extends React.Component<
    RouteComponentProps & { players: Array<Player>; setPlayerName: Function }
> {
    state = {}
    componentDidMount() {
        if (
            !this.props.players.some(({ peerId }) => window.peerId === peerId)
        ) {
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
                style={{
                    width: '100%',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                <Header />
                <h1 style={{ fontSize: 32, fontFamily, color: '#e91e63' }}>
                    Party Lobby
                </h1>
                <h1 style={{ fontSize: 18, fontFamily, color: 'white' }}>
                    Waiting for {waitingFor} more player(s)...
                </h1>
                <ul id="player-list">
                    {players.map(({ playerName }, i) => (
                        <li
                            className={'player player-' + (i + 1)}
                            style={{
                                color: playerColors[i],
                                paddingBottom: '15',
                            }}
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

class StartScreen extends React.Component<
    RouteComponentProps & { isConnected: boolean }
> {
    render() {
        return (
            <div className="app">
                <h1
                    style={{
                        fontSize: 80,
                        fontFamily,
                        color: '#e91e63',
                        paddingTop: 90,
                    }}
                >
                    Gojuki
                </h1>
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

class GameScreen extends React.Component<RouteComponentProps & any> {
    // ctx: CanvasRenderingContext2D
    canvas: HTMLCanvasElement
    lastTime: number
    _isMounted: boolean

    componentDidMount() {
        this._isMounted = true
        requestAnimationFrame(this.gameLoop)
    }
    componentWillUnmount() {
        this._isMounted = false
    }

    gameLoop = (time: number) => {
        const dt = time - this.lastTime
        this.lastTime = time
        if (!this.canvas || !window.serverWorld) {
            return
        }

        // update model
        let world = localClientStep()

        // render
        let ctx = this.canvas.getContext('2d')
        drawWorld(ctx, world)
        requestAnimationFrame(this.gameLoop)
    }

    render() {
        let { width, height } = getGameDimensions()
        height += HUD_HEIGHT
        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    width: '100%',
                }}
            >
                <Header />
                <canvas
                    id="game"
                    style={{ width, height }}
                    ref={canvas => {
                        if (!canvas) {
                            return
                        }
                        canvas.width = width
                        canvas.height = height
                        this.canvas = canvas
                        requestAnimationFrame(this.gameLoop)
                    }}
                />
            </div>
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
                        showCloseButton: true,
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
                <p className="about__content">
                    Hungry, Hungry, ...Cockroaches?
                </p>
                <p className="about__content">
                    Maybe this is what insects do in your kitchen when you're
                    sleeping.
                </p>
                <br />
            </div>
        )
    }
}

class UpgradesMenu extends React.Component<RouteComponentProps> {
    render() {
        const food = 100
        const timeToNextRound = 34
        const powerups = [
            {
                name: 'Sticky Goo',
                qty: 0,
                cost: 5,
                description:
                    'Drop sticky goo to slow your opponents down for 5 seconds.',
            },
            {
                name: 'Speed',
                qty: 0,
                cost: 8,
                description: 'Increase your top speed.',
            },
            {
                name: 'Food Carry Limit',
                qty: 0,
                cost: 10,
                description:
                    'Increase the amount of food you can hold at once.',
            },
        ]

        return (
            <div
                className="upgradesMenu"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    textAlign: 'center',
                    alignItems: 'center',
                    width: '100%',
                }}
            >
                <Header />
                <div
                    className="upgradesMenu__header"
                    style={{ color: 'white' }}
                >
                    <h3>
                        Food:
                        <span style={{ color: '#e91e63', marginRight: 50 }}>
                            {food}
                        </span>
                    </h3>
                    <h3>
                        Time to next round:
                        <span style={{ color: '#e91e63' }}>
                            {' ' + timeToNextRound + ' '}
                        </span>
                        seconds...
                    </h3>
                </div>
                <div className="upgradesMenu__items">
                    {powerups.map(powerup => (
                        <div
                            style={{
                                flexDirection: 'column',
                                backgroundColor: 'white',
                                width: 230,
                                height: 270,
                                margin: 20,
                                padding: 30,
                            }}
                        >
                            <h3 style={{ height: 56 }}>{powerup.name}</h3>
                            <strong
                                style={{
                                    fontSize: 26,
                                    color: 'rgb(233, 30, 99)',
                                }}
                            >
                                {powerup.qty}
                            </strong>
                            <p style={{ height: 45 }}>{powerup.description}</p>
                            <div
                                style={{
                                    alignSelf: 'center',
                                    marginTop: 'auto',
                                }}
                            >
                                <button style={{ marginRight: 10 }}>-</button>
                                <button>+</button>
                            </div>
                            <p>Cost: {powerup.cost}</p>
                        </div>
                    ))}
                </div>
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
                    <li className="howToPlay__info">
                        Collect and return food to your base.
                    </li>
                    <li className="howToPlay__info">
                        Whoever has the most food after 3 rounds wins.
                    </li>
                    <li className="howToPlay__info">
                        Trade food for upgrades between rounds.
                    </li>
                    <li className="howToPlay__info">
                        Use arrow keys to move. Use space to use item.
                    </li>
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
            maxRetransmits: 0,
        },
    })
    window.peer = p
    window.peerId = id
    p.on('signal', function(data: string) {
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
    } else if (message.type === 'SERVER_TICK') {
        handleServerTick(message)
    }
}

window.onload = function init() {
    initServerCxn().catch(err => console.error(err))
    ReactDOM.render(<App />, document.getElementById('app'))
}
