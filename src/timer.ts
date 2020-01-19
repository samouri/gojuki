/**
 * setTimeout and setInterval cannot be trusted to keep accurate time. On their own, they will skew.
 * While there isn't much we can do about setTimeout, we can at least create a self-adjusting setInterval.
 */

let nextId = 0
const intervals: Set<number> = new Set()

export async function sleep(ms: number) {
    return new Promise(res => setTimeout(res, ms))
}

export function setCorrectingInterval(fn: Function, waitMs: number): number {
    intervals.add(nextId)

    let nextTime = Date.now() + waitMs
    const timer = async () => {
        let id = nextId
        while (intervals.has(id)) {
            await sleep(nextTime - Date.now())
            nextTime += waitMs
            fn()
        }
    }
    timer()

    return nextId++
}

export function clearCorrectingInterval(id: number) {
    intervals.delete(id)
}
