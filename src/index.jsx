import React from 'react'
import ReactDOM from 'react-dom'
import swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'
import './style.css'

const Swal = withReactContent(swal)

const normalFontSize = '14px'
const largeFontSize = '36px'
const jumboFontSize = '80px'
const fontFamily = "'Press Start 2P', cursive"

class App extends React.Component {
  render() {
    return (
      <div className="app">
        <h1 style={{ fontSize: jumboFontSize, fontFamily, color: '#e91e63', paddingTop: 90 }}>
          Gojuki
        </h1>
        <button className="app__playbtn">Play</button>
        <div style={{ flexDirection: 'row', paddingTop: '30px' }}>
          <a
            className="app__info"
            onClick={() =>
              Swal.fire({
                html: <HowToPlay />,
                customClass: { confirmButton: 'sweetalert_confirm' },
                showCloseButton: true
              })
            }
          >
            How to play
          </a>
          <a
            className="app__info"
            onClick={() =>
              Swal.fire({
                html: <About />,
                customClass: { confirmButton: 'sweetalert_confirm' },
                showCloseButton: true
              })
            }
          >
            About
          </a>
        </div>
      </div>
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
    const instructionStyle = {}

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
