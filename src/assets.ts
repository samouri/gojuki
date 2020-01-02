import { mapValues } from 'lodash'

import soundsUrls from '../sounds/*.wav'
import imgUrls from '../img/**/*.png'
import { GamePlayer } from '../server/game'

type images = {
    food: HTMLImageElement
    bug: Array<HTMLImageElement>
    goo: HTMLImageElement
}

export const images: images = mapValues(imgUrls, src => {
    if (typeof src === 'object') {
        return Object.values(src).map(getImg)
    }
    return getImg(src)
})

function getImg(src: string) {
    const img = new Image()
    img.src = src
    return img
}

type sounds = {
    'deploy-goo': HTMLAudioElement
    'pickup-food': HTMLAudioElement
    'returned-to-base': HTMLAudioElement
    'stuck-in-goo': HTMLAudioElement
    play: HTMLAudioElement
}

export const sounds: sounds = mapValues(soundsUrls, src => new Audio(src))

const effectsHistory = {
    deployGooSound: 0,
    pickupFood: 0,
    returnedToBase: 0,
    stuckInGoo: 0,
}

export function playEffects(player: GamePlayer) {
    const {
        lastGooHit,
        lastGooDeployed,
        lastBaseReturn,
        lastFoodEaten,
    } = player.timings
    if (effectsHistory.stuckInGoo !== lastGooHit) {
        effectsHistory.stuckInGoo = player.timings.lastGooHit
        sounds['stuck-in-goo'].play()
    }
    if (effectsHistory.deployGooSound !== lastGooDeployed) {
        effectsHistory.deployGooSound = player.timings.lastGooDeployed
        sounds['deploy-goo'].play()
    }
    if (effectsHistory.returnedToBase !== lastBaseReturn) {
        effectsHistory.returnedToBase = player.timings.lastBaseReturn
        sounds['returned-to-base'].play()
    }
    if (effectsHistory.pickupFood !== lastFoodEaten) {
        effectsHistory.pickupFood = player.timings.lastFoodEaten
        sounds['pickup-food'].play()
    }
    return
}
