const LINES = [
  { y: 28, size: 18, bright: false },
  { y: 68, size: 28, bright: true },
  { y: 108, size: 18, bright: true },
  { y: 146, size: 18, bright: false },
  { y: 176, size: 18, bright: false },
  { y: 232, size: 18, bright: true },
]

export function showPreviewChrome(): void {
  document.querySelector('#preview')?.removeAttribute('hidden')
}

export function paintPreview(texts: string[], mode: 'glance' | 'confirm'): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#lens')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.textBaseline = 'top'
  const rows = mode === 'confirm' ? splitConfirm(texts) : texts
  rows.forEach((text, index) => {
    const line = LINES[index]
    if (!line || !text) return
    ctx.fillStyle = line.bright ? '#39ff14' : '#1f8f0c'
    ctx.font = `${line.size}px sans-serif`
    const parts = text.split('\n')
    parts.forEach((part, row) => {
      ctx.fillText(part, 16, line.y + row * (line.size + 4))
    })
  })
  ctx.strokeStyle = '#39ff14'
  ctx.lineWidth = 2
  ctx.strokeRect(8, 220, 560, 56)
}

function splitConfirm(texts: string[]): string[] {
  const body = texts[1] ?? ''
  const [first, ...rest] = body.split('\n')
  return [texts[0] ?? '', first ?? '', rest.join('\n'), '', '', texts[2] ?? '']
}
