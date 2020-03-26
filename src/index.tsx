import * as React from 'react'
import * as ReactDOM from 'react-dom'
import swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'
import './style.css'
import { Router, Link, RouteComponentProps, navigate } from '@reach/router'
import {
    joinParty,
    startGame,
    Player,
    selectUpgrade,
    PartyStatus,
    PartyListing,
    createParty,
    listParties,
    setParty,
} from '../server/state'
import { getGameDimensions, HUD_HEIGHT, powerups } from '../server/game'
import { state as gameState } from './game'
import { drawWorld } from './draw'
import { playEffects, sounds } from './assets'
import { sendTCP, initializeRTC, getId, onConnect } from './api'
import { sleep } from './timer'
import { stats } from './stats'

const Swal = withReactContent(swal)

const fontFamily = "'Press Start 2P', cursive"

class App extends React.Component {
    state = { isConnected: false }

    componentDidMount() {
        onConnect(() => this.setState({ isConnected: true }))
    }

    render() {
        return (
            <div className="app">
                <Router style={{ width: '100%', height: '100%' }}>
                    <StartScreen path="/" isConnected={this.state.isConnected} />
                    <PartySelectionScreen path="/select-lobby" />
                    <PartyScreen path="/party/:partyId" />
                    <UpgradesMenu path="/upgrades/:partyId" />
                    <GameScreen path="/game/:partyId" isConnected={this.state.isConnected} />
                    <GameScreen path="/test/:partyId" isConnected={this.state.isConnected} />
                    <GameOverScreen path="/finished/:partyId" />
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

class PartySelectionScreen extends React.Component<RouteComponentProps> {
    state: { parties: Array<PartyListing> } = { parties: [] }
    componentDidMount() {
        sendTCP(listParties())
            .then((res) => res.json())
            .then((parties) => {
                this.setState({ parties })
            })
    }

    createParty() {
        const lobbyName = prompt('pick a lobby name')
        if (!lobbyName) {
            return
        }
        sendTCP(createParty(lobbyName))
            .then((res) => res.json())
            .then(({ id }) => this.joinParty(id))
            .catch((err) => {
                console.error(err)
            })
    }

    joinParty(id: string) {
        const playerName = prompt('choose a player name')
        if (!playerName) {
            return
        }
        sendTCP(joinParty(id, playerName)).catch((err) => {
            console.error(err)
        })
    }

    render() {
        const { parties } = this.state
        return (
            <div
                className="partySelectionScreen"
                style={{
                    width: '100%',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                <Header />
                <h1 style={{ fontSize: 32, fontFamily, color: '#e91e63' }}>Available Parties</h1>
                <div
                    id="parties-list"
                    style={{
                        maxHeight: '600px',
                        overflow: 'auto',
                        flexDirection: 'column',
                    }}
                >
                    <div>
                        <div>Name</div> <div># players</div>
                    </div>
                    {parties.map(({ name, id, players, status }) => {
                        const inParty = !!players.find((p) => p.peerId === getId())
                        console.log(`id: ${getId()}, players: ${JSON.stringify(players)}`)
                        return (
                            <div
                                style={{
                                    paddingBottom: '15',
                                    color: 'white',
                                    borderBlock: '1px solid line',
                                }}
                                key={id}
                            >
                                <div style={{ width: 100 }}>{name} </div>
                                <div style={{ width: 100 }}>{players.length} </div>
                                {!inParty && (
                                    <button onClick={() => this.joinParty(id)}>join</button>
                                )}
                                {inParty && (
                                    <button onClick={() => navigateForGameStatus(status, id)}>
                                        rejoin
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>
                <button className="app__playbtn" onClick={() => this.createParty()}>
                    Create party
                </button>
            </div>
        )
    }
}

class PartyScreen extends React.Component<RouteComponentProps<{ partyId: string }>> {
    isMounted_ = false
    state: { players: Array<Player>; loading: boolean } = {
        players: [],
        loading: true,
    }

    componentDidMount() {
        sendTCP(setParty(this.props.partyId))
        this.isMounted_ = true
        this.refreshLoop()
    }
    componentWillUnmount() {
        this.isMounted_ = false
    }

    async refreshLoop() {
        while (this.isMounted_) {
            const party = gameState.getParty()
            const players = party?.players
            if (players) {
                this.setState({ players })
                if (this.state.loading) {
                    this.setState({ loading: false })
                }
            }
            await sleep(100)
        }
    }

    render() {
        let { partyId } = this.props
        let { players } = this.state

        const playerColors = ['#E93F3F', '#3FE992', '#3FD3E9', '#E93FDB']
        const maxPlayers = 4
        const waitingFor = maxPlayers - players.length
        const inLobby = !!players.find((p) => p.peerId === getId())

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
                <h1 style={{ fontSize: 32, fontFamily, color: '#e91e63' }}>Party Lobby</h1>
                {this.state.loading && (
                    <h1 style={{ fontSize: 18, fontFamily, color: 'white' }}>Loading...</h1>
                )}
                {!this.state.loading && (
                    <h1 style={{ fontSize: 18, fontFamily, color: 'white' }}>
                        Waiting for {waitingFor} more player(s)...
                    </h1>
                )}
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
                {!this.state.loading && inLobby && (
                    <button
                        className="app__playbtn"
                        onClick={() => {
                            sendTCP(startGame(partyId))
                        }}
                        disabled={!partyId}
                    >
                        Start game
                    </button>
                )}
                {!this.state.loading && !inLobby && (
                    <button
                        className="app__playbtn"
                        onClick={() => {
                            const playerName = prompt('what is your player name')
                            if (!playerName) {
                                return
                            }
                            sendTCP(joinParty(partyId, playerName))
                        }}
                        disabled={!partyId}
                    >
                        Join lobby
                    </button>
                )}
            </div>
        )
    }
}

class GameOverScreen extends React.Component<RouteComponentProps> {
    state = { isConnected: false }
    componentDidMount() {
        onConnect(() => this.setState({ isConnected: true }))
    }
    render() {
        const players = gameState.getParty()?.game?.players ?? {}
        const scores = Object.entries(players)
            .sort((x, y) => y[1].food - x[1].food)
            .map(([_id, player]) => {
                return {
                    playerName: player.playerName,
                    food: player.food,
                    playerNumber: player.playerNumber,
                }
            })

        const playerColors = ['#E93F3F', '#3FE992', '#3FD3E9', '#E93FDB']
        const winnerColor = playerColors[scores?.[0]?.playerNumber - 1]
        const winnerName = scores?.[0]?.playerName

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
                {this.state.isConnected || (
                    <h1 style={{ fontSize: 32, fontFamily, color: 'red' }}> Loading...</h1>
                )}
                {this.state.isConnected && (
                    <>
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
                            {scores.map(({ playerName, food, playerNumber }) => (
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
                            ))}
                        </ul>
                    </>
                )}
            </div>
        )
    }
}

class StartScreen extends React.Component<RouteComponentProps & { isConnected: boolean }> {
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
                            navigate(`/select-lobby`)
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
    RouteComponentProps<{ partyId: string }> & { isConnected: boolean }
> {
    // ctx: CanvasRenderingContext2D
    canvas: HTMLCanvasElement
    _isMounted: boolean
    _animationCb: number | null = null

    componentDidMount() {
        this._isMounted = true
        if (this._animationCb === null) {
            this._animationCb = requestAnimationFrame(this.gameLoop)
        }
        // TODO: defer these to the first real draw after server connection
        if (this.props.isConnected) {
            sounds.play.currentTime = 0
            sounds.play.play()
        }

        // ensureInParty(this.props.partyId, () => this.props.clientState)
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

    gameLoop = () => {
        const party = gameState.getParty()
        if (!this.canvas || !party?.game) {
            this._animationCb = requestAnimationFrame(this.gameLoop)
            return
        }

        let world = party.game
        stats.nextFrame()

        // render
        let ctx = this.canvas.getContext('2d')
        drawWorld(ctx, world)
        playEffects(world.players[getId()])
        this._animationCb = requestAnimationFrame(this.gameLoop)
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
                    ref={(canvas) => {
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
                <p className="about__content">Hungry, Hungry, ...Cockroaches?</p>
                <p className="about__content">
                    Maybe this is what insects do in your kitchen when you're sleeping.
                </p>
                <br />
            </div>
        )
    }
}

class UpgradesMenu extends React.Component<RouteComponentProps> {
    render() {
        const player = gameState.getParty().game.players[getId()]
        const data = {
            secondsLeft: gameState.getParty().game.roundTimeLeft,
            goo: player.powerups.goo,
            speed: player.powerups.speed,
            carryLimit: player.powerups.carryLimit,
            food: player.food,
        }

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
                <div className="upgradesMenu__header" style={{ color: 'white' }}>
                    <h3>
                        Food:
                        <span style={{ color: '#e91e63', marginRight: 50 }}>{data.food}</span>
                    </h3>
                    <h3>
                        Time to next round:
                        <span style={{ color: '#e91e63' }}>{' ' + data.secondsLeft + ' '}</span>
                        seconds...
                    </h3>
                </div>
                <div className="upgradesMenu__items">
                    {Object.entries(powerups).map(([name, { description, shortName, cost }]) => {
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
                                            sendTCP(selectUpgrade(name as any, -1)).then(
                                                async () => {
                                                    await sleep(50)
                                                    this.setState({})
                                                },
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
                                            sendTCP(selectUpgrade(name as any, 1)).then(
                                                async () => {
                                                    await sleep(50)
                                                    this.setState({})
                                                },
                                            )
                                        }}
                                    >
                                        +
                                    </button>
                                </div>
                                <p>Cost: {cost}</p>
                            </div>
                        )
                    })}
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
                    <li className="howToPlay__info">Collect and return food to your base.</li>
                    <li className="howToPlay__info">
                        Whoever has the most food after 3 rounds wins.
                    </li>
                    <li className="howToPlay__info">Trade food for upgrades between rounds.</li>
                    <li className="howToPlay__info">
                        Use arrow keys to move. Use space to use item.
                    </li>
                </ul>
            </div>
        )
    }
}

window.onload = function init() {
    initializeRTC().catch((err) => console.error(err))
    ReactDOM.render(<App />, document.getElementById('app'))
}

export function navigateForGameStatus(status: PartyStatus, partyId: string): void {
    if (!status || !partyId) {
        return
    }

    const currentPath = window.location.pathname
    let nextPath
    if (status === 'LOBBY' || status === 'NOT_STARTED') {
        nextPath = `/party/${partyId}`
    } else if (status === 'UPGRADES') {
        nextPath = `/upgrades/${partyId}`
    } else if (status === 'PLAYING') {
        nextPath = `/game/${partyId}`
    } else if (status === 'TEST') {
        nextPath = `/test/${partyId}`
    } else if (status === 'FINISHED') {
        nextPath = `/finished/${partyId}`
    }

    if (currentPath !== nextPath) {
        navigate(nextPath)
    }
}
