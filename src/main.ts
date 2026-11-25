import {
  CreateStartUpPageContainer,
  OsEventTypeList,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
} from '@evenrealities/even_hub_sdk'
import { renderCompanion } from './companion'
import { fetchFlow } from './feed'
import { paintPreview, showPreviewChrome } from './preview'
import {
  COINS,
  type AppState,
  type Coin,
  type Flow,
  confirmLines,
  demoFlow,
  glanceLines,
  initialState,
  onSwipe,
  onTap,
} from './model'

const bridge = await Promise.race([
  waitForEvenAppBridge().catch(() => null),
  new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 2000)),
])
let paired = false
if (bridge) {
  try {
    paired = Boolean(await bridge.getDeviceInfo())
  } catch {
    paired = false
  }
}
const onGlasses = bridge !== null
const win = window as Window & { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown }
const inSimulator = win.__TAURI__ !== undefined || win.__TAURI_INTERNALS__ !== undefined
const showCanvas = !inSimulator
if (showCanvas) showPreviewChrome()
console.log(`HOST bridge=${onGlasses} device=${paired} simulator=${inSimulator}`)

const forceDemo = new URLSearchParams(location.search).get('feed') === 'mock'
let state: AppState = initialState()
const cache = new Map<Coin, Flow>()
let painted: 'glance' | 'confirm' | null = null
let clickTimer: ReturnType<typeof setTimeout> | null = null

function flowFor(coin: Coin, now: number): Flow | null {
  const live = cache.get(coin)
  if (forceDemo) return demoFlow(coin, now)
  if (live) return live
  if (cache.size === 0 && painted !== null) return null
  return null
}

function linesNow(): { mode: 'glance' | 'confirm'; texts: string[] } {
  const now = Date.now()
  const flow = flowFor(state.coin, now)
  if (state.mode === 'confirm') {
    const lines = confirmLines(state)
    return { mode: 'confirm', texts: [lines.title, lines.body, lines.action] }
  }
  const lines = glanceLines(state, flow, now)
  return { mode: 'glance', texts: [lines.head, lines.verdict, lines.share, lines.vols, lines.paper, lines.action] }
}

function textBox(
  id: number,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  content: string,
  capture: boolean,
  bright: boolean,
  pad: number,
): TextContainerProperty {
  return new TextContainerProperty({
    xPosition: x,
    yPosition: y,
    width: w,
    height: h,
    borderWidth: capture ? 1 : 0,
    borderColor: 12,
    borderRadius: 4,
    paddingLength: pad,
    containerID: id,
    containerName: name,
    content,
    isEventCapture: capture ? 1 : 0,
    textColor: bright ? 4 : 2,
  })
}

function pageContainers(texts: string[], mode: 'glance' | 'confirm'): TextContainerProperty[] {
  if (mode === 'confirm') {
    return [
      textBox(1, 'title', 8, 6, 560, 40, texts[0] ?? '', false, true, 0),
      textBox(2, 'body', 8, 48, 560, 156, texts[1] ?? '', false, true, 0),
      textBox(3, 'action', 8, 214, 560, 68, texts[2] ?? '', true, true, 6),
    ]
  }
  return [
    textBox(1, 'head', 8, 2, 560, 40, texts[0] ?? '', false, false, 0),
    textBox(2, 'verdict', 8, 42, 560, 44, texts[1] ?? '', false, true, 0),
    textBox(3, 'share', 8, 88, 560, 40, texts[2] ?? '', false, true, 0),
    textBox(4, 'vols', 8, 128, 560, 56, texts[3] ?? '', false, false, 0),
    textBox(5, 'paper', 8, 184, 560, 36, texts[4] ?? '', false, false, 0),
    textBox(6, 'action', 8, 222, 560, 62, texts[5] ?? '', true, true, 6),
  ]
}

async function paint(forceRebuild: boolean): Promise<void> {
  const now = Date.now()
  const view = linesNow()
  renderCompanion(state, flowFor(state.coin, now), now)
  if (showCanvas) {
    paintPreview(view.texts, view.mode)
    document.documentElement.dataset.boot = onGlasses ? 'both' : 'browser'
  } else {
    document.documentElement.dataset.boot = 'glasses'
  }
  if (!onGlasses) {
    const flow = flowFor(state.coin, now)
    if (flow) console.log(`READY coin=${flow.coin} side=${view.texts[1]} src=${flow.source}`)
    return
  }
  const boxes = pageContainers(view.texts, view.mode)
  if (forceRebuild || painted !== view.mode) {
    const container = new RebuildPageContainer({
      containerTotalNum: boxes.length,
      textObject: boxes,
    })
    const ok =
      painted === null
        ? (await bridge.createStartUpPageContainer(
            new CreateStartUpPageContainer({
              containerTotalNum: boxes.length,
              textObject: boxes,
            }),
          )) === 0
        : await bridge.rebuildPageContainer(container)
    if (!ok) console.error('Page render failed')
    painted = view.mode
  } else {
    for (const box of boxes) {
      await bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: box.containerID,
          containerName: box.containerName,
          content: box.content,
          textColor: box.textColor,
        }),
      )
    }
  }
  const flow = flowFor(state.coin, now)
  if (flow) {
    console.log(`READY coin=${flow.coin} side=${view.texts[1]} src=${flow.source}`)
  }
}

async function refreshFeeds(): Promise<void> {
  if (forceDemo) return
  const results = await Promise.allSettled(COINS.map((coin) => fetchFlow(coin)))
  results.forEach((result, index) => {
    const coin = COINS[index]
    if (result.status === 'fulfilled') {
      cache.set(coin, result.value)
      return
    }
    const prev = cache.get(coin)
    if (prev) cache.set(coin, { ...prev, stale: true })
    console.warn(`OKX ${coin} failed`, result.reason)
  })
  if (cache.size === 0) {
    for (const coin of COINS) cache.set(coin, demoFlow(coin, Date.now()))
    console.warn('OKX unavailable. Showing the demo tape.')
  }
}

function apply(next: AppState): void {
  const rebuild = next.mode !== state.mode
  state = next
  void paint(rebuild)
}

function eventTypeOf(envelope?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  if (!envelope) return null
  return envelope.eventType ?? OsEventTypeList.CLICK_EVENT
}

const unsubscribe = onGlasses
  ? bridge.onEvenHubEvent((event) => {
  const sysType = eventTypeOf(event.sysEvent)
  const textType = eventTypeOf(event.textEvent)
  const types = [sysType, textType].filter((value): value is OsEventTypeList => value !== null)

  if (types.includes(OsEventTypeList.DOUBLE_CLICK_EVENT)) {
    if (clickTimer) {
      clearTimeout(clickTimer)
      clickTimer = null
    }
    void bridge?.shutDownPageContainer(1)
    return
  }
  if (types.includes(OsEventTypeList.SCROLL_TOP_EVENT)) {
    apply(onSwipe(state, 'up'))
    return
  }
  if (types.includes(OsEventTypeList.SCROLL_BOTTOM_EVENT)) {
    apply(onSwipe(state, 'down'))
    return
  }
  if (sysType === OsEventTypeList.SYSTEM_EXIT_EVENT || sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
    unsubscribe()
    return
  }
  if (types.includes(OsEventTypeList.CLICK_EVENT)) {
    if (clickTimer) return
    clickTimer = setTimeout(() => {
      clickTimer = null
      const now = Date.now()
      apply(onTap(state, flowFor(state.coin, now), now))
    }, 280)
  }
})
  : () => {}

if (!onGlasses) {
  document.querySelector('#tap-click')?.addEventListener('click', () => {
    const now = Date.now()
    apply(onTap(state, flowFor(state.coin, now), now))
  })
  document.querySelector('#tap-up')?.addEventListener('click', () => apply(onSwipe(state, 'up')))
  document.querySelector('#tap-down')?.addEventListener('click', () => apply(onSwipe(state, 'down')))
}

await paint(true)
await refreshFeeds()
await paint(false)
window.setInterval(() => {
  void refreshFeeds().then(() => paint(false))
}, 6000)
window.setInterval(() => {
  if (state.banner && Date.now() >= state.bannerUntil) void paint(false)
}, 400)
