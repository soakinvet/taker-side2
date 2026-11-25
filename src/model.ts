export const COINS = ['BTC', 'ETH', 'SOL'] as const
export type Coin = (typeof COINS)[number]

export const CLIP = 500
export const START_CASH = 10_000

export type Aggressor = 'buy' | 'sell' | 'even'
export type FeedSource = 'okx' | 'demo'

export interface Flow {
  coin: Coin
  /** Taker buy volume from OKX, same unit as sell. */
  buy: number
  /** Taker sell volume from OKX. Array order is [ts, sell, buy]. */
  sell: number
  barTs: number
  mark: number
  source: FeedSource
  stale: boolean
}

export interface Lot {
  coin: Coin
  side: 'buy' | 'sell'
  entry: number
  qty: number
  quote: number
}

export interface Book {
  cash: number
  lots: Partial<Record<Coin, Lot>>
}

export interface PendingJoin {
  kind: 'join'
  side: 'buy' | 'sell'
  mark: number
}

export interface PendingFlatten {
  kind: 'flatten'
  mark: number
}

export type Pending = PendingJoin | PendingFlatten

export interface AppState {
  coin: Coin
  mode: 'glance' | 'confirm'
  book: Book
  pending: Pending | null
  /** Action line override until bannerUntil. */
  banner: string
  bannerUntil: number
}

export function emptyBook(): Book {
  return { cash: START_CASH, lots: {} }
}

export function initialState(): AppState {
  return { coin: 'BTC', mode: 'glance', book: emptyBook(), pending: null, banner: '', bannerUntil: 0 }
}

/** OKX row is [ts, sellVol, buyVol]. */
export function parseTakerRow(row: readonly string[]): { barTs: number; sell: number; buy: number } | null {
  if (row.length < 3) return null
  const barTs = Number(row[0])
  const sell = Number(row[1])
  const buy = Number(row[2])
  if (!Number.isFinite(barTs) || !Number.isFinite(sell) || !Number.isFinite(buy)) return null
  if (sell < 0 || buy < 0) return null
  return { barTs, sell, buy }
}

export function aggressor(flow: Pick<Flow, 'buy' | 'sell'>): Aggressor {
  if (flow.buy === flow.sell) return 'even'
  return flow.buy > flow.sell ? 'buy' : 'sell'
}

export function leadPct(flow: Pick<Flow, 'buy' | 'sell'>): number {
  const total = flow.buy + flow.sell
  if (total <= 0) return 0
  return (Math.max(flow.buy, flow.sell) / total) * 100
}

export function formatVol(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `${trimOne(m)}M`
  }
  if (n >= 1_000) return `${trimOne(n / 1_000)}K`
  return String(Math.round(n))
}

function trimOne(n: number): string {
  // The G2 font has no period glyph. The middle dot is in the firmware set.
  const t = n.toFixed(1).replace('.', '·')
  return t.endsWith('·0') ? t.slice(0, -2) : t
}

export function formatMark(coin: Coin, price: number): string {
  const digits = coin === 'BTC' ? 0 : coin === 'ETH' ? 1 : 2
  const neg = price < 0
  const fixed = Math.abs(price).toFixed(digits)
  const [whole, frac] = fixed.split('.')
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${neg ? '-' : ''}${withCommas}${frac ? `·${frac}` : ''}`
}

export function formatPnl(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toFixed(2).replace('.', '·')}`
}

export function barClock(barTs: number): string {
  const d = new Date(barTs)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function lotPnl(lot: Lot, mark: number): number {
  const diff = lot.side === 'buy' ? mark - lot.entry : lot.entry - mark
  return lot.qty * diff
}

export function join(book: Book, coin: Coin, side: 'buy' | 'sell', mark: number): Book | null {
  if (book.lots[coin]) return null
  if (!(mark > 0) || book.cash < CLIP) return null
  const lot: Lot = { coin, side, entry: mark, qty: CLIP / mark, quote: CLIP }
  return { cash: book.cash - CLIP, lots: { ...book.lots, [coin]: lot } }
}

export function flatten(book: Book, coin: Coin, mark: number): Book | null {
  const lot = book.lots[coin]
  if (!lot || !(mark > 0)) return null
  const next = { ...book.lots }
  delete next[coin]
  return { cash: book.cash + lot.quote + lotPnl(lot, mark), lots: next }
}

export type Intent =
  | { kind: 'join'; side: 'buy' | 'sell' }
  | { kind: 'flatten' }
  | { kind: 'wait'; reason: string }

export function intentFor(state: AppState, flow: Flow | null): Intent {
  const lot = state.book.lots[state.coin]
  if (lot) return { kind: 'flatten' }
  if (!flow || flow.stale || !(flow.mark > 0)) return { kind: 'wait', reason: 'Waiting for OKX' }
  const side = aggressor(flow)
  if (side === 'even') return { kind: 'wait', reason: 'Flow is even' }
  if (state.book.cash < CLIP) return { kind: 'wait', reason: 'Need $500 cash' }
  return { kind: 'join', side }
}

export function onTap(state: AppState, flow: Flow | null, now: number): AppState {
  if (state.mode === 'confirm' && state.pending?.kind === 'flatten') {
    const next = flatten(state.book, state.coin, state.pending.mark)
    if (!next) return { ...state, mode: 'glance', pending: null }
    return {
      ...state,
      mode: 'glance',
      pending: null,
      book: next,
      banner: 'Flattened',
      bannerUntil: now + 2500,
    }
  }
  if (state.mode === 'confirm' && state.pending?.kind === 'join') {
    const next = join(state.book, state.coin, state.pending.side, state.pending.mark)
    if (!next) return { ...state, mode: 'glance', pending: null }
    return {
      ...state,
      mode: 'glance',
      pending: null,
      book: next,
      banner: state.pending.side === 'buy' ? 'Joined buyers' : 'Joined sellers',
      bannerUntil: now + 2500,
    }
  }

  const plan = intentFor(state, flow)
  if (plan.kind === 'wait') {
    return { ...state, banner: plan.reason, bannerUntil: now + 2000 }
  }
  if (plan.kind === 'flatten') {
    const lot = state.book.lots[state.coin]
    const mark = flow?.mark && flow.mark > 0 ? flow.mark : lot?.entry ?? 0
    return { ...state, mode: 'confirm', pending: { kind: 'flatten', mark }, banner: '', bannerUntil: 0 }
  }
  const mark = flow?.mark ?? 0
  return {
    ...state,
    mode: 'confirm',
    pending: { kind: 'join', side: plan.side, mark },
    banner: '',
    bannerUntil: 0,
  }
}

export function onSwipe(state: AppState, direction: 'up' | 'down'): AppState {
  if (state.mode === 'confirm') {
    return { ...state, mode: 'glance', pending: null }
  }
  const i = COINS.indexOf(state.coin)
  const next = direction === 'up' ? (i + 1) % COINS.length : (i + COINS.length - 1) % COINS.length
  return { ...state, coin: COINS[next], banner: '', bannerUntil: 0 }
}

export interface GlanceLines {
  head: string
  verdict: string
  share: string
  vols: string
  paper: string
  action: string
}

export function glanceLines(state: AppState, flow: Flow | null, now: number): GlanceLines {
  const coin = state.coin
  const lot = state.book.lots[coin]
  const head = !flow
    ? `${coin} · OKX`
    : flow.source === 'demo'
      ? `${coin} · DEMO ${barClock(flow.barTs)}`
      : flow.stale
        ? `${coin} · STALE`
        : `${coin} · 5m ${barClock(flow.barTs)}`

  if (!flow) {
    return {
      head,
      verdict: 'Connecting',
      share: 'Reading OKX flow',
      vols: 'Buy  —\nSell —',
      paper: 'Paper cash $10,000',
      action: 'One moment',
    }
  }

  const side = aggressor(flow)
  const pct = Math.round(leadPct(flow))
  const flipped = Boolean(lot && side !== 'even' && lot.side !== side)
  const verdict = flipped ? 'Flipped' : side === 'buy' ? 'Buying' : side === 'sell' ? 'Selling' : 'Even'
  const share =
    side === 'even' ? 'Buy and sell match' : side === 'buy' ? `${pct}% of flow is buying` : `${pct}% of flow is selling`

  const pnl = lot ? lotPnl(lot, flow.mark) : 0
  const paper = lot
    ? `${lot.side === 'buy' ? 'Long' : 'Short'} $500 · ${formatPnl(pnl)}`
    : `Mark ${formatMark(coin, flow.mark)} · flat`

  let action = '> TAP join buyers'
  if (lot) action = '> TAP flatten'
  else if (side === 'sell') action = '> TAP join sellers'
  else if (side === 'even') action = 'Flow is even'
  else if (state.book.cash < CLIP) action = 'Need $500 cash'

  if (state.banner && now < state.bannerUntil) action = state.banner

  return {
    head,
    verdict,
    share,
    vols: `Buy   ${formatVol(flow.buy)}\nSell  ${formatVol(flow.sell)}`,
    paper,
    action,
  }
}

export interface ConfirmLines {
  title: string
  body: string
  action: string
}

export function confirmLines(state: AppState): ConfirmLines {
  const coin = state.coin
  const pending = state.pending
  if (pending?.kind === 'flatten') {
    const lot = state.book.lots[coin]
    const pnl = lot ? lotPnl(lot, pending.mark) : 0
    const held = lot?.side === 'sell' ? 'Short' : 'Long'
    return {
      title: 'CONFIRM',
      body: `Flatten ${coin}\n${held} $500 · ${formatPnl(pnl)}\nPaper only, not sent`,
      action: '> TAP yes · swipe no',
    }
  }
  const side = pending?.kind === 'join' ? pending.side : 'buy'
  const mark = pending?.kind === 'join' ? pending.mark : 0
  const word = side === 'sell' ? 'sellers' : 'buyers'
  return {
    title: 'CONFIRM',
    body: `Join ${word}\n$${CLIP} ${coin} at ${formatMark(coin, mark)}\nPaper only, not sent`,
    action: '> TAP yes · swipe no',
  }
}

/** Deterministic demo tape so the glasses still render if OKX is blocked. */
export function demoFlow(coin: Coin, now: number): Flow {
  const bases: Record<Coin, number> = { BTC: 59680, ETH: 1673, SOL: 69.7 }
  const wave = Math.sin(now / 20000 + COINS.indexOf(coin))
  const buyShare = 0.5 + wave * 0.28
  const total = coin === 'BTC' ? 12_000_000 : coin === 'ETH' ? 5_000_000 : 500_000
  const buy = total * buyShare
  const sell = total - buy
  const mark = bases[coin] * (1 + wave * 0.002)
  const bucket = Math.floor(now / 300_000) * 300_000
  return { coin, buy, sell, barTs: bucket, mark, source: 'demo', stale: false }
}
