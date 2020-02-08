import { Stats } from '../src/stats'

jest.useFakeTimers()
describe('Performance and Network Statistics', () => {
    let stats: Stats
    let now: number

    beforeEach(() => {
        stats = new Stats()
        now = 0
        // Mocks
        Date.now = jest.spyOn(Date, 'now').mockImplementation(() => now)
    })
    describe('FPS', () => {
        test('Reports 60 when the game starts and hasnt actually had a frame yet', () => {
            expect(stats.getFPS()).toBe(60)
        })

        test('If there is only one frame, thats the FPS', () => {
            stats.nextFrame()
            now = 100
            stats.nextFrame()
            expect(stats.getFPS()).toBe(10)
        })

        test('Will take the rolling avg of frames', () => {
            stats.nextFrame()
            now = 100 // 100ms
            stats.nextFrame()
            now = 300 // 200ms, avg: 150, fps: 6.666677
            stats.nextFrame()
            expect(Math.floor(stats.getFPS())).toBe(6)
            stats.nextFrame() // 0ms, avg 100, fps: 10 again
            expect(stats.getFPS()).toBe(10)
        })

        test('Only includes the last 10 frames in the avg', () => {
            for (let i = 0; i < 100; i++) {
                now += 100
                stats.nextFrame()
            }
            stats.nextFrame()
            expect(Math.floor(stats.getFPS())).toBe(11)
        })
    })

    describe('Ping and Packet Loss', () => {
        test('initializes to infinite ping and 0 packet loss', () => {
            expect(stats.getPing()).toBe(Infinity)
            expect(stats.getPacketLoss()).toBe(0)
        })
        test('Single send/ack should record ping', () => {
            stats.nextSend(1)
            now = 100
            stats.nextAck(1)
            expect(stats.getPing()).toBe(100)
            expect(stats.getPacketLoss()).toBe(0)
        })

        test('Sending three with one drop should only count as two ping recordings', () => {
            stats.nextSend(1)
            now = 100
            stats.nextSend(2)
            stats.nextAck(1)
            now = 200
            stats.nextSend(3)
            now = 320
            stats.nextAck(3)

            expect(stats.getPing()).toBe(110)
            expect(Math.floor(stats.getPacketLoss())).toBe(33)
        })

        test('Two drops and then two hits --> 50', () => {
            stats.nextSend(1)
            stats.nextSend(2)
            stats.nextSend(3)
            stats.nextSend(4)
            stats.nextAck(3)
            stats.nextAck(4)

            expect(Math.floor(stats.getPacketLoss())).toBe(50)
        })

        test('31 sends means infinite ping', () => {
            for (let i = 0; i < 31; i++) {
                stats.nextSend(i)
            }
            expect(Math.floor(stats.getPing())).toBe(Number.POSITIVE_INFINITY)
        })
    })

    describe('Bandwidth', () => {
        test.todo('intialize to 0')
        test.todo('record sent bytes/s')
        test.todo('record received bytes/s')
    })
})
