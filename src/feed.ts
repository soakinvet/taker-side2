import { type Coin, type Flow, parseTakerRow } from './model'

const SWAP: Record<Coin, string> = {
  BTC: 'BTC-USDT-SWAP',
  ETH: 'ETH-USDT-SWAP',
  SOL: 'SOL-USDT-SWAP',
}

function okxUrl(path: string): string {
  if (import.meta.env.DEV) return `/okx${path}`
  return `https://www.okx.com${path}`
}

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(okxUrl(path), { cache: 'no-store', signal: AbortSignal.timeout(7000) })
  if (!res.ok) throw new Error(`OKX ${res.status} ${path}`)
  const body = (await res.json()) as { code?: string; data?: unknown; msg?: string }
  if (body.code !== '0' || !Array.isArray(body.data)) {
    throw new Error(`OKX ${body.msg || body.code || 'bad payload'}`)
  }
  return body.data
}

export async function fetchFlow(coin: Coin): Promise<Flow> {
  const [tape, marks] = await Promise.all([
    getJson(`/api/v5/rubik/stat/taker-volume?ccy=${coin}&instType=CONTRACTS&period=5m`),
    getJson(`/api/v5/public/mark-price?instType=SWAP&instId=${SWAP[coin]}`),
  ])
  const row = (tape as unknown[])[0]
  if (!Array.isArray(row) || !row.every((cell) => typeof cell === 'string')) {
    throw new Error('OKX taker row missing')
  }
  const parsed = parseTakerRow(row)
  if (!parsed) throw new Error('OKX taker row invalid')
  const markRow = (marks as { markPx?: string }[])[0]
  const mark = Number(markRow?.markPx)
  if (!(mark > 0)) throw new Error('OKX mark missing')
  return {
    coin,
    buy: parsed.buy,
    sell: parsed.sell,
    barTs: parsed.barTs,
    mark,
    source: 'okx',
    stale: false,
  }
}
