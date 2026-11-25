# DoraHacks paste sheet

Copy each block into the matching BUIDL field. Deadline: **29 Nov 2026, 21:59 Europe/Athens** (23:59 Dubai, 19:59 UTC).

## Project name

Taker Side

## Tagline

Who is crossing the spread on OKX, and a one-tap paper join.

## Track

Exchanges & Stocks

## Description

During a session you should not pull out a phone to see whether aggressive flow just flipped. Taker Side puts that one fact on Even G2: for BTC, ETH, or SOL, what share of OKX taker volume in the current 5-minute bar is buying, and what share is selling.

The mark underneath is the live OKX price. One tap asks you to join the side that is crossing, as a $500 paper clip. A second tap confirms. Swipe changes coin, or cancels the confirm. If takers flip while the clip is open, the glasses say so, and the same tap flattens it.

No OKX account, no API key, no order. The demo is paper trading on public read-only data. It is not advice.

## How it uses the required integration

OKX is the exchange. The app reads two public endpoints and writes nothing back:

- `GET /api/v5/rubik/stat/taker-volume` for BTC, ETH, and SOL contracts, period `5m`. Each row is timestamp, taker sell volume, taker buy volume.
- `GET /api/v5/public/mark-price` for `BTC-USDT-SWAP`, `ETH-USDT-SWAP`, and `SOL-USDT-SWAP`. That mark is the paper fill price.

Those domains are whitelisted in `app.json`. The taker-volume endpoint does not send CORS headers, so the simulator demo reaches it through the local dev server, which is the Even Hub pattern when an API cannot be called from the page directly.

## Tech stack

TypeScript, Vite, the official Even Hub minimal template, `@evenrealities/even_hub_sdk` 0.0.16, Even Hub CLI, Even Hub simulator. Glasses UI is text containers on the 576×288 display. Input is tap, swipe, and double tap.

## Optional feature requests

1. OKX rubik `taker-volume` does not send `Access-Control-Allow-Origin`, so a glasses WebView cannot read it directly. Public market-stat GETs need CORS.
2. A small "latest taker share" field (buy percent, sell percent, bar time) would save a glasses client from pulling the history array.
3. Even Hub still has one font size. A single larger style for the one word that matters (`Buying`, `Selling`) would make the glance easier.
4. The firmware font has no period glyph, so decimals have to be drawn with a middle dot.
5. A keyless OKX paper-order sandbox would let a later version turn the same confirm tap into a test order without putting a secret in the app.

## Demo video script (about 75 seconds)

Record the simulator window, glasses and the button row. Talk while you do it. Do not use `?feed=mock`. The header should show a coin and `5m`, not the word `DEMO`.

1. Show the glasses on BTC. Say: "Taker Side, Exchanges track. This is OKX's current 5-minute taker bar. No account and no key. Buyers or sellers, whichever side is crossing, and the live mark."
2. Point at the percent and the bottom line. Say: "One action. Join that side for 500 dollars, on paper."
3. Press **Click** once. The confirm screen appears: join that side, the mark, and "Paper only, not sent."
4. Press **Click** again. Say: "Filled on paper. The line is now a long or a short, marked to the live OKX price."
5. Press **Up**. ETH replaces BTC, with that coin's own flow.
6. Press **Up** again. SOL. If the bottom line now says sellers, say: "Different coin, other side of the tape. Same one-tap confirm."
7. Press **Double click**. Say: "Double tap leaves the app."

Keep it under 3 minutes. The glasses shots in `docs/screenshots/` match these steps.

## What you do on DoraHacks

1. Create the public GitHub repository from this project if it is not public yet.
2. Sign in on https://dorahacks.io/hackathon/even-realities/detail and submit a BUIDL before the deadline.
3. Paste the name, tagline, description, and track from this file.
4. Add the public repository URL. A demo video is required. Upload the screen recording of the script above.
5. Optional: upload `release/taker-side.ehpk` if the form asks for a package. The video should still be the simulator running `npm run dev`, because that is the live OKX feed.
6. Registration questions are yours to answer: Demo Day in Dubai, whether you have G2 glasses, your Telegram handle, and how you heard about the hackathon.

No secrets go in the form. The repo does not contain an API key.
