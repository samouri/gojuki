import * as React from 'react'
import * as ReactDOM from 'react-dom'
import swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'
import './style.css'
import { Router, Link, RouteComponentProps, navigate } from '@reach/router'
import { Player, PartyListing, PartyState, Powerup } from '../server/state'
import { getGameDimensions, HUD_HEIGHT, powerups } from '../server/game'
import { state as gameState } from './game'
import { drawWorld } from './draw'
import { playEffects, sounds } from './assets'
import * as api from './api'
import { stats } from './stats'
import { useState, useEffect, useRef } from 'react'

const Swal = withReactContent(swal)

const fontFamily = "'Press Start 2P', cursive"

function useConnected() {
    const [isConnected, setConnected] = useState(false)
    useEffect(() => api.onConnect(() => setConnected(true)), [])
    return isConnected
}

function usePartySync(refreshMs: number): PartyState {
    const [party, setParty] = useState(gameState.getParty())
    useEffect(() => {
        const id = setInterval(() => {
            setParty(gameState.getParty())
        }, refreshMs)
        return function cleanup() {
            clearInterval(id)
        }
    }, [gameState, refreshMs])
    return party
}

function App() {
    return (
        <div className="app">
            <Router style={{ width: '100%', height: '100%' }}>
                <StartScreen path="/" />
                <PartySelectionScreen path="/select-lobby" />
                <PartyScreen path="/party/:partyId" />
                <UpgradesMenu path="/upgrades/:partyId" />
                <GameScreen path="/game/:partyId" />
                <GameScreen path="/test/:partyId" />
                <GameOverScreen path="/finished/:partyId" />
            </Router>
        </div>
    )
}

function PartySelectionScreen(props: RouteComponentProps) {
    function createParty() {
        const lobbyName = prompt('pick a lobby name')
        if (!lobbyName) {
            return
        }
        api.createParty(lobbyName)
            .then(({ id }) => joinParty(id))
            .catch((err) => {
                console.error(err)
            })
    }

    function joinParty(id: string) {
        const playerName = prompt('choose a player name')
        if (!playerName) {
            return
        }
        api.joinParty(id, playerName)
            .then(() => navigate(`/party/${id}`))
            .catch((err) => {
                console.error(err)
            })
    }

    const [parties, setParties] = useState<Array<PartyListing>>([])
    useEffect(() => {
        api.listParties().then(setParties)
    }, [])

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
                {parties.map(({ name, id, players }) => {
                    const inParty = !!players.find((p) => p.peerId === api.getId())
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
                            {!inParty && <button onClick={() => joinParty(id)}>join</button>}
                            {inParty && (
                                <button onClick={() => navigate(`/party/${id}`)}>rejoin</button>
                            )}
                        </div>
                    )
                })}
            </div>
            <button className="app__playbtn" onClick={createParty}>
                Create party
            </button>
        </div>
    )
}

function PartyScreen({ partyId }: RouteComponentProps<{ partyId: string }>) {
    const [loading, setLoading] = useState(true)
    const party = usePartySync(100)
    const players = party?.players ?? []
    if (players && loading) {
        setLoading(false)
    }
    if (
        party?.id === partyId &&
        getPathForParty(party) &&
        getPathForParty(party) !== window.location.pathname
    ) {
        navigate(getPathForParty(party))
    }

    useEffect(() => {
        api.setParty(partyId)
    }, [])

    const playerColors = ['#E93F3F', '#3FE992', '#3FD3E9', '#E93FDB']
    const maxPlayers = 4
    const waitingFor = maxPlayers - players.length
    const inLobby = !!players.find((p) => p.peerId === api.getId())

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
            {loading && <h1 style={{ fontSize: 18, fontFamily, color: 'white' }}>Loading...</h1>}
            {!loading && (
                <h1 style={{ fontSize: 18, fontFamily, color: 'white' }}>
                    Waiting for {waitingFor} more player(s)...
                </h1>
            )}
            <ul id="player-list">
                {players.map(({ playerName, peerId }, i) => (
                    <li
                        className={'player player-' + (i + 1)}
                        style={{
                            color: playerColors[i],
                            paddingBottom: '15',
                        }}
                        key={peerId}
                    >
                        player {i + 1}: {playerName}
                    </li>
                ))}
            </ul>
            {!loading && inLobby && (
                <button
                    className="app__playbtn"
                    onClick={() => {
                        api.startGame(partyId).then(() => navigate(`/game/${partyId}`))
                    }}
                    disabled={!partyId}
                >
                    Start game
                </button>
            )}
            {!loading && !inLobby && (
                <button
                    className="app__playbtn"
                    onClick={() => {
                        const playerName = prompt('what is your player name')
                        if (!playerName) {
                            return
                        }
                        api.joinParty(partyId, playerName)
                    }}
                    disabled={!partyId}
                >
                    Join lobby
                </button>
            )}
        </div>
    )
}

function GameOverScreen(props: RouteComponentProps) {
    const players = usePartySync(1000)?.game?.players
    const scores = Object.entries(players ?? {})
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
    const isConnected = !!players

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
            {isConnected || <h1 style={{ fontSize: 32, fontFamily, color: 'red' }}> Loading...</h1>}
            {isConnected && (
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

function StartScreen(props: RouteComponentProps) {
    const isConnected = useConnected()
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
            {!isConnected ? (
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

function GameScreen(props: RouteComponentProps<{ partyId: string }>) {
    const isConnected = useConnected()
    const canvasRef = useRef<HTMLCanvasElement>()

    function gameStep() {
        // DOM Hack for checking if this component is mounted
        if (canvasRef.current.isConnected) {
            requestAnimationFrame(gameStep)
        }
        if (!gameState.getParty()?.game) {
            return
        }

        stats.nextFrame()
        let world = gameState.getParty().game
        drawWorld(canvasRef.current.getContext('2d'), world)
        playEffects(world.players[api.getId()])
    }
    useEffect(() => {
        if (isConnected) {
            sounds.play.currentTime = 0
            sounds.play.play()
        }
        return () => sounds.play.pause()
    }, [isConnected])
    useEffect(() => {
        requestAnimationFrame(gameStep)
    }, [])
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
                    canvasRef.current = canvas
                }}
            />
        </div>
    )
}

function UpgradesMenu(props: RouteComponentProps) {
    const game = usePartySync(25).game
    const player = game.players[api.getId()]

    const data = {
        secondsLeft: game.roundTimeLeft,
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
                                        api.selectUpgrade(name as Powerup, -1)
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
                                        api.selectUpgrade(name as Powerup, 1)
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

function Header() {
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

function InfoButton(props: { content: () => JSX.Element; children: React.ReactNode }) {
    return (
        <a
            className="infoButton"
            onClick={() =>
                Swal.fire({
                    html: <props.content />,
                    customClass: { confirmButton: 'sweetalert_confirm' },
                    showCloseButton: true,
                })
            }
        >
            {props.children}
        </a>
    )
}

function About() {
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

function HowToPlay() {
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

window.onload = function init() {
    api.initializeRTC().catch((err) => console.error(err))
    ReactDOM.render(<App />, document.getElementById('app'))
}

export function navigateForParty(party: PartyState): void {
    if (!party?.status || !party?.id) {
        return
    }

    const gamePaths = ['/upgrades', '/game', '/test']
    const currentPath = window.location.pathname
    if (!gamePaths.some((str) => currentPath.startsWith(str))) {
        return
    }

    let nextPath = getPathForParty(party)

    if (currentPath !== nextPath) {
        navigate(nextPath)
    }
}

function getPathForParty(party: PartyState) {
    if (!party?.status) {
        return
    }

    const status = party.status
    if (status === 'UPGRADES') {
        return `/upgrades/${party.id}`
    } else if (status === 'PLAYING') {
        return `/game/${party.id}`
    } else if (status === 'TEST') {
        return `/test/${party.id}`
    } else if (status === 'FINISHED') {
        return `/finished/${party.id}`
    }
}
