import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  aggressor,
  confirmLines,
  demoFlow,
  emptyBook,
  flatten,
  formatMark,
  formatPnl,
  formatVol,
  glanceLines,
  initialState,
  join,
  leadPct,
  lotPnl,
  onSwipe,
  onTap,
  parseTakerRow,
  type Flow,
} from '../src/model.ts'

const btc: Flow = {
  coin: 'BTC',
  buy: 10_268_735,
  sell: 3_217_015,
  barTs: Date.UTC(2026, 10, 25, 0, 50),
  mark: 59686.6,
  source: 'okx',
  stale: false,
}

describe('OKX taker row', () => {
  it('reads [ts, sell, buy]', () => {
    const row = parseTakerRow(['1795567800000', '3217015.1809', '10268735.4853'])
    assert.ok(row)
    assert.equal(row.sell, 3217015.1809)
    assert.equal(row.buy, 10268735.4853)
    assert.equal(aggressor(row), 'buy')
    assert.equal(Math.round(leadPct(row)), 76)
  })

  it('rejects a short row', () => {
    assert.equal(parseTakerRow(['1', '2']), null)
  })
})

describe('paper book', () => {
  it('joins buyers and marks a short-side gain when price falls', () => {
    const opened = join(emptyBook(), 'BTC', 'sell', 100)
    assert.ok(opened)
    assert.equal(opened.cash, 9500)
    const lot = opened.lots.BTC
    assert.ok(lot)
    assert.equal(lot.qty, 5)
    assert.ok(Math.abs(lotPnl(lot, 99) - 5) < 1e-9)
    const closed = flatten(opened, 'BTC', 99)
    assert.ok(closed)
    assert.equal(Object.keys(closed.lots).length, 0)
    assert.ok(Math.abs(closed.cash - 10005) < 1e-6)
  })

  it('refuses a second clip on the same coin', () => {
    const opened = join(emptyBook(), 'ETH', 'buy', 1000)
    assert.ok(opened)
    assert.equal(join(opened, 'ETH', 'buy', 1000), null)
    const other = join(opened, 'SOL', 'sell', 50)
    assert.ok(other)
    assert.equal(other.cash, 9000)
  })
})

describe('gestures', () => {
  it('asks before joining, then fills at the confirmed mark', () => {
    const now = 1_000_000
    const armed = onTap(initialState(), btc, now)
    assert.equal(armed.mode, 'confirm')
    assert.equal(armed.pending?.kind, 'join')
    if (armed.pending?.kind !== 'join') return
    assert.equal(armed.pending.side, 'buy')
    assert.equal(armed.pending.mark, btc.mark)
    const body = confirmLines(armed).body
    assert.match(body, /Join buyers/)
    assert.match(body, /not sent/)
    const filled = onTap(armed, { ...btc, mark: 1 }, now)
    assert.equal(filled.mode, 'glance')
    assert.equal(filled.book.lots.BTC?.entry, btc.mark)
    assert.equal(filled.banner, 'Joined buyers')
  })

  it('swipe cancels a confirm and up moves to ETH', () => {
    const armed = onTap(initialState(), btc, 1)
    const cancelled = onSwipe(armed, 'up')
    assert.equal(cancelled.mode, 'glance')
    assert.equal(cancelled.coin, 'BTC')
    assert.equal(cancelled.book.cash, 10_000)
    const next = onSwipe(cancelled, 'up')
    assert.equal(next.coin, 'ETH')
    assert.equal(onSwipe(next, 'down').coin, 'BTC')
  })

  it('calls a position flipped when takers switch sides', () => {
    const opened = onTap(onTap(initialState(), btc, 1), btc, 1)
    const against: Flow = { ...btc, buy: 1, sell: 9, mark: 59000 }
    const lines = glanceLines(opened, against, 10_000)
    assert.equal(lines.verdict, 'Flipped')
    assert.match(lines.action, /flatten/)
    assert.match(lines.paper, /Long \$500/)
  })
})

describe('copy', () => {
  it('formats the live BTC tape as a glance', () => {
    const lines = glanceLines(initialState(), btc, btc.barTs)
    assert.equal(lines.verdict, 'Buying')
    assert.match(lines.share, /76% of flow is buying/)
    assert.match(lines.vols, /Buy {3}10·3M/)
    assert.match(lines.vols, /Sell {2}3·2M/)
    assert.equal(lines.action, '> TAP join buyers')
    assert.equal(formatMark('BTC', 59686.6), '59,687')
    assert.equal(formatMark('SOL', 69.66), '69·66')
    assert.equal(formatPnl(-1.2), '-$1·20')
    assert.equal(formatVol(500), '500')
  })

  it('labels the demo tape', () => {
    const lines = glanceLines(initialState(), demoFlow('SOL', 1_700_000_000_000), 1_700_000_000_000)
    assert.match(lines.head, /DEMO/)
  })
})
