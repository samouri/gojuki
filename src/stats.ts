import { getRTCStats } from './api'

/**
 * @fileoverview Tracks various stats for the game. Used when debug mode is on.
 * Specifically keeps track of FPS, Latency, and Packet Loss.
 */
export class Stats {
    lastRenders: Array<number> = [] // holds the 10 last render times, to create a trailing avg.
    lastRenderTime = Number.NEGATIVE_INFINITY

    lastRTCStatsTime = Number.NEGATIVE_INFINITY
    lastRTCStats: Array<any>

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
            /* Can happen in two cases
             *  1. Browser refresh
             *  2. Receiving stale message
             */
            return
        }
        const now = Date.now()
        const ping = now - this.tickTracker.get(ackedTickId)
        this.tickTracker.delete(ackedTickId)
        this.lastPingTimes.push(ping)

        for (const tickId of this.tickTracker.keys()) {
            if (tickId < ackedTickId) {
                this.tickTracker.delete(tickId)
            }
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

    // TODO: actually do this.
    // nextRTCStats() {
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
