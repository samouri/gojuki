import * as React from 'react'
import * as ReactDOM from 'react-dom'
import swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'
import './style.css'
import { Router, Link, RouteComponentProps, navigate } from '@reach/router'
import {
    Message,
    joinParty,
    startGame,
    Player,
    selectUpgrade,
    PartyStatus,
    PartyState,
} from '../server/state'
import { World, getGameDimensions, HUD_HEIGHT, powerups } from '../server/game'
import { Instance } from 'simple-peer'
import { registerKeyPresses, handleServerTick, initialUIState } from './game'
import { drawWorld } from './draw'
import { playEffects, sounds } from './assets'
import { sendTCP } from './api'
import _ = require('lodash')
import { sleep } from './timer'

declare global {
    interface Window {
        peer: Instance
        peerId: string
        SimplePeer: any
        appSetState: any
        serverParty: PartyState
        uiState: ReactState
    }
}

const Swal = withReactContent(swal)

const fontFamily = "'Press Start 2P', cursive"

export type ReactState = {
    serverConnected: boolean
    players: Array<Player>
    gameStatus: PartyStatus
    upgradesScreen: {
        secondsLeft: number
        goo: number
        speed: number
        carryLimit: number
        food: number
    }
    scores: Array<{ playerNumber: number; food: number; playerName: string }>
    partyId: string
}
class App extends React.Component {
    state: ReactState = initialUIState

    componentDidMount() {
        window.appSetState = (s: any) => this.setState(s)
    }
    componentDidUpdate(_prevProps: any, prevState: ReactState) {
        const { gameStatus, partyId } = this.state

        if (
            prevState.gameStatus !== gameStatus &&
            this.state.partyId === _.last(window.location.pathname.split('/'))
        ) {
            // TODO: add one for homescreen
            if (gameStatus === 'NOT_STARTED') {
                navigate(`/`)
            } else if (gameStatus === 'LOBBY') {
                navigate(`/party/${partyId}`)
            } else if (gameStatus === 'UPGRADES') {
                navigate(`/upgrades/${partyId}`)
            } else if (gameStatus === 'PLAYING') {
                navigate(`/game/${partyId}`)
            } else if (gameStatus === 'TEST') {
                navigate(`/test/${partyId}`)
            } else if (gameStatus === 'FINISHED') {
                navigate(`/finished/${partyId}`)
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
                        path="/party/:partyId"
                        clientState={this.state}
                    />
                    <UpgradesMenu
                        path="/upgrades/:partyId"
                        clientState={this.state}
                    />
                    <GameScreen
                        path="/game/:partyId"
                        clientState={this.state}
                    />
                    <GameScreen
                        path="/test/:partyId"
                        clientState={this.state}
                    />
                    <GameOverScreen path="/finished/:partyId" {...this.state} />
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

function shouldJoinParty(state: ReactState, partyId: string) {
    const isConnected = state?.serverConnected
    return isConnected && !state?.partyId
}

/* partyId refers to the one in the URL */
function ensureInParty(partyId: string): Promise<void> {
    const state = window?.uiState
    if (state?.partyId) {
        return Promise.resolve()
    }

    if (shouldJoinParty(state, partyId)) {
        const test = window.location.pathname.includes('test')
        sendTCP(
            joinParty(
                window.peerId,
                partyId,
                prompt('What is your player name'),
                test,
            ),
        ).catch(err => {
            console.error(err)
            navigate('/')
        })
    }
    console.log('still connecting')

    return sleep(400).then(() => ensureInParty(partyId))
}

class PartyScreen extends React.Component<
    RouteComponentProps<{ partyId: string }> & { clientState: ReactState }
> {
    componentDidMount() {
        ensureInParty(this.props.partyId)
    }

    render() {
        let { players, partyId } = this.props.clientState
        players =
            this.props.clientState.partyId === this.props.partyId ? players : []

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
                <button
                    className="app__playbtn"
                    onClick={() => {
                        sendTCP(startGame(partyId))
                    }}
                    disabled={!partyId}
                >
                    Start game
                </button>
            </div>
        )
    }
}

class GameOverScreen extends React.Component<RouteComponentProps & ReactState> {
    state = {}

    render() {
        const playerColors = ['#E93F3F', '#3FE992', '#3FD3E9', '#E93FDB']
        const winnerColor =
            playerColors[this.props.scores?.[0]?.playerNumber - 1]
        const winnerName = this.props.scores?.[0]?.playerName

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
                <h1
                    style={{
                        fontSize: 32,
                        fontFamily,
                        color: winnerColor,
                    }}
                >
                    {winnerName} Wins!
                </h1>
                <ul id="player-list">
                    {this.props.scores.map(
                        ({ playerName, food, playerNumber }) => (
                            <li
                                className={'player player-' + playerNumber}
                                style={{
                                    color: playerColors[playerNumber - 1],
                                    paddingBottom: '15',
                                }}
                                key={playerNumber}
                            >
                                {playerName}: {food}
                            </li>
                        ),
                    )}
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
                    <button
                        className="app__playbtn"
                        onClick={() => {
                            const playerName = prompt(
                                'What is your player name?',
                            )
                            sendTCP(
                                joinParty(window.peerId, undefined, playerName),
                            )
                                .then(resp => resp.json())
                                .then(({ partyId }) => {
                                    navigate(`/party/${partyId}`)
                                })
                        }}
                    >
                        Play
                    </button>
                )}
                <div style={{ flexDirection: 'row', paddingTop: '30px' }}>
                    <InfoButton content={HowToPlay}>How to play</InfoButton>
                    <InfoButton content={About}>About</InfoButton>
                </div>
            </div>
        )
    }
}

class GameScreen extends React.Component<
    RouteComponentProps<{ partyId: string }> & { clientState: ReactState }
> {
    // ctx: CanvasRenderingContext2D
    canvas: HTMLCanvasElement
    lastTime: number
    _isMounted: boolean
    _animationCb: number | null = null

    componentDidMount() {
        this._isMounted = true
        if (this._animationCb === null) {
            this._animationCb = requestAnimationFrame(this.gameLoop)
        }
        // TODO: defer these to the first real draw after server connection
        if (this.props.clientState.serverConnected) {
            sounds.play.currentTime = 0
            sounds.play.play()
        }

        ensureInParty(this.props.partyId)
    }

    componentWillUnmount() {
        this._isMounted = false
        window.cancelAnimationFrame(this._animationCb)
        this._animationCb = null
        sounds.play.pause()
    }

    shouldComponentUpdate() {
        return false
    }

    gameLoop = (time: number) => {
        const dt = time - this.lastTime
        this.lastTime = time

        if (!this.canvas || !window.serverParty?.game) {
            requestAnimationFrame(this.gameLoop)
            return
        }

        // update model
        registerKeyPresses()
        let world = window.serverParty?.game

        // render
        let ctx = this.canvas.getContext('2d')
        drawWorld(ctx, world)
        playEffects(world.players[window.peerId])
        requestAnimationFrame(this.gameLoop)
    }

    render() {
        console.log(`Rerender triggered`)
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

class UpgradesMenu extends React.Component<
    RouteComponentProps & { clientState: ReactState }
> {
    render() {
        const data = this.props.clientState.upgradesScreen

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
                            {data.food}
                        </span>
                    </h3>
                    <h3>
                        Time to next round:
                        <span style={{ color: '#e91e63' }}>
                            {' ' + data.secondsLeft + ' '}
                        </span>
                        seconds...
                    </h3>
                </div>
                <div className="upgradesMenu__items">
                    {Object.entries(powerups).map(
                        ([name, { description, shortName, cost }]) => {
                            const canBuy = cost <= data.food
                            const canSell = data[shortName] > 0
                            return (
                                <div
                                    style={{
                                        flexDirection: 'column',
                                        backgroundColor: 'white',
                                        width: 230,
                                        height: 270,
                                        margin: 20,
                                        padding: 30,
                                    }}
                                    key={name}
                                >
                                    <h3 style={{ height: 56 }}>{name}</h3>
                                    <strong
                                        style={{
                                            fontSize: 26,
                                            color: 'rgb(233, 30, 99)',
                                        }}
                                    >
                                        {data[shortName]}
                                    </strong>
                                    <p style={{ height: 45 }}>{description}</p>
                                    <div
                                        style={{
                                            alignSelf: 'center',
                                            marginTop: 'auto',
                                        }}
                                    >
                                        <button
                                            style={{ marginRight: 10 }}
                                            disabled={!canSell}
                                            onClick={() => {
                                                if (!canSell) {
                                                    return
                                                }
                                                sendTCP(
                                                    selectUpgrade(
                                                        name as 'Sticky Goo',
                                                        -1,
                                                    ),
                                                )
                                            }}
                                        >
                                            -
                                        </button>
                                        <button
                                            disabled={!canBuy}
                                            onClick={() => {
                                                if (!canBuy) {
                                                    return
                                                }
                                                sendTCP(
                                                    selectUpgrade(
                                                        name as 'Sticky Goo',
                                                        1,
                                                    ),
                                                )
                                            }}
                                        >
                                            +
                                        </button>
                                    </div>
                                    <p>Cost: {cost}</p>
                                </div>
                            )
                        },
                    )}
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
