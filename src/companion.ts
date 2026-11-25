import { type AppState, type Flow, confirmLines, glanceLines } from './model'

export function renderCompanion(state: AppState, flow: Flow | null, now: number): void {
  const root = document.querySelector('#app')
  if (!root) return
  const glance = state.mode === 'glance'
  const lines = glance ? glanceLines(state, flow, now) : null
  const confirm = glance ? null : confirmLines(state)
  const verdict = lines?.verdict ?? confirm?.title ?? ''
  const detail = lines
    ? `${lines.share}\n${lines.vols}\n${lines.paper}`
    : (confirm?.body ?? '')
  const action = lines?.action ?? confirm?.action ?? ''
  const feed =
    flow?.source === 'demo'
      ? 'Demo tape. Live OKX did not answer. Add ?feed=mock to force this.'
      : flow?.stale
        ? 'Last OKX reading is stale. The prices on screen are the previous bar.'
        : 'Live OKX contracts. Taker buy and sell volume, current 5-minute bar.'

  root.innerHTML = `
    <section class="card">
      <p class="kicker">Even G2 · Exchanges &amp; Stocks</p>
      <h1>Taker Side</h1>
      <p class="head">${escapeHtml(lines?.head ?? `${state.coin} · confirm`)}</p>
      <p class="verdict">${escapeHtml(verdict)}</p>
      <pre class="detail">${escapeHtml(detail)}</pre>
      <p class="action">${escapeHtml(action)}</p>
      <p class="feed">${escapeHtml(feed)}</p>
      <ul class="help">
        <li><b>Click</b> confirms the line above</li>
        <li><b>Up / Down</b> changes coin, or cancels a confirm</li>
        <li><b>Double click</b> asks the glasses to exit</li>
      </ul>
      <p class="fine">Paper clip is $500. Nothing is sent to OKX. Not advice.</p>
    </section>
  `
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}
