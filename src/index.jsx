import React from 'react'
import ReactDOM from 'react-dom'
import swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'
import './style.css'
import { Router, Link } from '@reach/router'

const Swal = withReactContent(swal)

const fontFamily = "'Press Start 2P', cursive"

class App extends React.Component {
  state = {}
  render() {
    return (
      <div className="app">
        <Router style={{ width: '100%', height: '100%' }}>
          <StartScreen path="/" />
          <PartyScreen path="/party" />
        </Router>
      </div>
    )
  }
}
class PartyScreen extends React.Component {
  render() {
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
        <h1 style={{ fontSize: 18, fontFamily, color: 'white', paddingTop: 20 }}>
          Waiting for N more player(s)...
        </h1>
      </div>
    )
  }
}

class StartScreen extends React.Component {
  render() {
    return (
      <div className="app">
        <h1 style={{ fontSize: 80, fontFamily, color: '#e91e63', paddingTop: 90 }}>Gojuki</h1>
        <Link to="party">
          <button className="app__playbtn">Play</button>
        </Link>
        <div style={{ flexDirection: 'row', paddingTop: '30px' }}>
          <InfoButton content={HowToPlay}>How to play</InfoButton>
          <InfoButton content={About}>About</InfoButton>
        </div>
      </div>
    )
  }
}

class InfoButton extends React.Component {
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
function init() {
  ReactDOM.render(<App />, document.getElementById('app'))
}

window.onload = init
