import { defineConfig } from 'vite'

// OKX public taker-volume does not send Access-Control-Allow-Origin.
// The dev server proxies it so the Even Hub simulator can read live flow.
const okxProxy = {
  '/okx': {
    target: 'https://www.okx.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/okx/, ''),
  },
}

export default defineConfig({
  base: './',
  server: { host: true, port: 4177, proxy: okxProxy },
  preview: { host: true, port: 4177, proxy: okxProxy },
  build: { target: 'esnext' },
})
