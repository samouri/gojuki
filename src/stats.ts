import { getRTCStats } from './api'

/**
 * @fileoverview Tracks various stats for the game. Used when debug mode is on.
 * Specifically keeps track of FPS, Latency, and Packet Loss.
 */
export class Stats {
    lastRenders: Array<number> = [] // holds the 10 last render times, to create a trailing avg.
    lastRenderTime = Number.NEGATIVE_INFINITY

    nextFrame() {
        const now = Date.now()

        // On the first render, we don't have a lastRenderTime.
        if (this.lastRenderTime < 0) {
            this.lastRenderTime = now
            return
        }
        this.lastRenders.push(now - this.lastRenderTime)
        this.lastRenderTime = now

        // Remove the oldest if we already have 10.
        if (this.lastRenders.length > 10) {
            this.lastRenders.shift()
        }
    }

    getFPS() {
        if (this.lastRenders.length === 0) {
            return 60 // May as well be optimistic for a split second :)
        }

        const sum = this.lastRenders.reduce((acc, v) => acc + v, 0)
        const avg = sum / this.lastRenders.length
        return 1000 / avg
    }

    lastPingTimes: Array<number> = []
    tickTracker: Map<number, number> = new Map()
    lastPacketDrops: Array<number> = []
    nextSend(tickId: number) {
        this.tickTracker.set(tickId, Date.now())

        // If we've gone a whole second without receiving a message back, start assuming we've DCed.
        if (this.tickTracker.size > 30) {
            this.lastPingTimes.push(Number.POSITIVE_INFINITY)
            if (this.lastPingTimes.length > 10) {
                this.lastPingTimes.shift()
            }
        }
    }

    nextAck(ackedTickId: number) {
        if (!this.tickTracker.has(ackedTickId)) {
            console.log('HAPPENED!', ackedTickId)
            /* Can happen in two cases
             *  1. Browser refresh
             *  2. Receiving stale message thats already been deleted / considered dropped.
             */
            return
        }
        const now = Date.now()
        const ping = now - this.tickTracker.get(ackedTickId)
        this.tickTracker.delete(ackedTickId)
        this.lastPingTimes.push(ping)

        // Deal with stale sent packets (which count as a roundtrip drop)
        this.lastPacketDrops.push(0)
        for (const tickId of this.tickTracker.keys()) {
            if (tickId < ackedTickId) {
                this.tickTracker.delete(tickId)
                this.lastPacketDrops[this.lastPacketDrops.length - 1]++
            }
        }

        if (this.lastPacketDrops.length > 10) {
            this.lastPacketDrops.shift()
        }
        if (this.lastPingTimes.length > 10) {
            this.lastPingTimes.shift()
        }
    }

    getPing() {
        if (this.lastPingTimes.length === 0) {
            return Number.POSITIVE_INFINITY // Technically true.
        }

        const sum = this.lastPingTimes.reduce((acc, v) => acc + v, 0)
        const avg = sum / this.lastPingTimes.length
        return avg
    }

    getPacketLoss() {
        if (this.lastPacketDrops.length === 0) {
            return 0
        }
        const sum = this.lastPacketDrops.reduce((acc, v) => acc + v, 0)
        const avg = sum / (this.lastPacketDrops.length + sum)
        return avg * 100
    }

    // TODO: actually do this.
    // nextRTCStats() {
    //     lastRTCStatsTime = Number.NEGATIVE_INFINITY
    //     lastRTCStats: Array<any>
    //     const rtcStats = getRTCStats()
    // }
}

export const stats = new Stats()
export const rates = {
    // TODO: make the actual timers refer to this.
    sendInputs: 32, // double goal framerate
    sendState: 33, // ~30/s
    render: 16, // 60 fps
}
