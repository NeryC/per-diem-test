# Loom Script (90 seconds)

## 0:00–0:15 — Problem statement and layout

Open the app at `/?at=2026-05-12T15:00`. Show the location switcher,
category chips, item grid with prices and the cart button.

## 0:15–0:30 — Architecture

Cmd-tab to editor. Show `lib/square/client.ts` — server-only Square SDK
init. Show `app/api/catalog/route.ts` — proxy with bigint→string
serialization. Mention: "Token never reaches the client. Every Square
call goes through our own backend, Zod-validated at the boundary."

## 0:30–0:55 — Availability with time simulator

Back to the browser. Show the page at `?at=2026-05-12T15:00`
(afternoon). Change to `?at=2026-05-12T06:00` (early morning). Watch
breakfast items get the "Opens at 11:00 AM" badge. Mention the 11-case
test suite covering DST forward, DST backward, midnight-crossing
windows.

## 0:55–1:10 — Cart with modifiers + location switch confirmation

Click an item with modifiers (e.g., coffee with milk options). Select
size + modifiers. Add to cart. Open the drawer to show the subtotal
computed in bigint cents. Switch location — dialog confirms "Stay or
empty cart and switch".

## 1:10–1:20 — Inventory in action

Show a card with the "Out of stock" badge. On the detail page, the OOS
variation radio is disabled and "Add to cart" reads "Out of stock".

## 1:20–1:30 — Deliberate trade-offs

On camera: "Five bonuses inside a 4–6 h budget was over the LLM
council's recommendation. I accepted the risk and protected each
feature with bigint money math, pure tests, and structured commits so
each stage is independently shippable. Things I left out: service
worker, real OAuth, component tests beyond the resolver. README
documents the trade-offs."
