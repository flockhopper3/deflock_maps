# Network tab: non-portal agencies visible but gated

**Date:** 2026-07-19
**Status:** Approved

## Problem

The Network tab hides non-portal agencies by default (`portalOnly: true`), and tapping any
visible node draws its arcs and connection list with no distinction between disclosed and
inferred data. All adjacency data comes from portal disclosures, so a non-portal agency's
"connections" are really mentions scraped from other agencies' portals. Newcomers cannot
tell confirmed disclosures from inferred, incomplete ones.

## Goal

Show the whole network by default while making the confirmed/inferred distinction
impossible to miss. Non-portal agencies are inert until the user opts in.

## Design

### 1. Visibility defaults

- `portalOnly` in `networkStore` defaults to `false`. All agencies render, colored by
  type as today (no ring = no portal).
- The "Portal Agencies Only" switch stays, defaulting off.
- The intro panel's legend gains a third row: plain dot (no ring) = no transparency portal.

### 2. The gate

- New store flag `inferredConnectionsEnabled`, default `false`, with a toggle action.
- Tapping a non-portal agency always selects it (panel and mobile peek open with name,
  type, state), but while the flag is off the store computes **no arcs** for it: nothing
  draws on the map, no connection list or count appears. The panel must not show
  "Connections: 0" for a gated selection.
- The panel shows an amber warning card instead:

  > **No transparency portal**
  > This agency does not publish a Flock transparency portal, so its data sharing cannot
  > be confirmed. Some connections can be inferred from portals run by other agencies.
  > **[ Show inferred connections ]**

  The button flips `inferredConnectionsEnabled` in place; arcs and the list appear
  immediately.
- Mobile peek (`NetworkPeekSummary`) shows a one-line "No transparency portal" note in
  place of the connection count for gated selections.
- Desktop hover-preview arcs skip non-portal nodes while gated.
- Search results and connection-list taps that select a non-portal agency get identical
  treatment. Portal agencies behave exactly as today in every state.

### 3. Unlocked state

With the switch on, a non-portal selection shows arcs and its connection list normally,
plus a persistent info banner on the card:

> **Inferred connections**
> This agency has no transparency portal. These connections were found in other agencies'
> portals that list it as a sharing partner. The real list is likely longer.

### 4. Options section

Two switches, each with a one-line sub-label:

- **Portal Agencies Only** - hide agencies without a transparency portal.
- **Inferred Connections** - explore agencies that only appear in other agencies' portals.

### 5. Implementation shape

- The gate lives in `networkStore`: `setSelectedNodeId`, the adjacency backfill in
  `loadNetworkData`, and the new toggle action all compute `selectedArcs` through one
  gate (empty for non-portal selections while the flag is off). `NetworkLayers`, the
  panel, and the peek follow automatically.
- Toggling while a non-portal agency is selected populates/clears its arcs in place.
- Both flags are session-only, like every other network setting.

## Verification

- Unit test for store gating: non-portal selection yields no arcs while gated, arcs after
  toggle, portal selections unaffected either way.
- Playwright pass: tap a blue dot, see the warning and no arcs; press the inline enable
  button, see arcs and the inferred banner; portal agency flow unchanged.
