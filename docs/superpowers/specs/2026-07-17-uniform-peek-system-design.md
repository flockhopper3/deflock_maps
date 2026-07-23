# Uniform peek system — Design

**Date:** 2026-07-17
**Status:** Approved (design), pending implementation plan
**Area:** Mobile drawer peeks for Route / Timeline / Analysis / Network; TimelineBar consolidation
**Builds on:** `2026-07-16-instrument-mobile-refresh-design.md` (shipped: identity peeks, slim header, `--drawer-height`, Analysis detail sheet, route slim-ad peek)

## Problem

After the instrument refresh, the four content modes rest at four different peek heights (Route 122/186, Timeline 80 minimized-only, Analysis 168, Network 140), so the sheet visibly jumps as users tap across tabs. Timeline additionally keeps a separate floating scrubber pill stacked above the drawer (`MapPage.tsx` mobile branch, hardcoded `bottom: calc(84px + env(safe-area-inset-bottom))`) — the last stacked-overlay violation of the one-surface direction. Network's peek explains too little about what the visualization is or how to use it.

## Decisions (from mockup review)

- **Map is deferred** — no Map drawer changes in this effort; it keeps the 108px hint row. (A "top brands in view" peek was mocked and parked.)
- **One shared peek height** (~168px, tuned in-browser) for Route, Timeline, Analysis, Network. The sheet's height is invariant across those four tabs.
- **Timeline cannot collapse below its peek** — the scrubber is the mode.
- **Route does not encourage swipe-up** — the peek is the complete story (the ad); the expanded panel stays reachable by drag but gets no affordance push.
- **Network explains more**: what the map shows, what tapping a node does, and a quiet swipe-up-for-details cue.

## Design

### Shared height

One constant (e.g. `UNIFORM_PEEK_HEIGHT = 168`) replaces the per-mode `MODE_PEEK_HEIGHT` values for route/explore/density/network. Existing dynamic overrides stay layered on top exactly as today: Analysis region detail (`min(430, 62vh)`) and route-with-routes if its content genuinely needs more (only if measured necessary; target is the uniform height). `--drawer-height` publishing is untouched and flows the new values.

### Peek content per mode

- **Route (no routes):** slim FlockHopper line (mark + name + one-liner, whole line = platform store link) + `FlockHopperStoreButtons` (App Store / Android Beta) beneath. No swipe-up hint. **(with routes):** `MobileRoutePreview` + the slim line (as shipped); buttons row drops out.
- **Timeline (`explore`):** the scrubber row — play/pause button + `TimelineSparkline` + scrubber handle — followed by a caption row: `Cameras over time` micro-label left, `<date> · <cumulative count>` right. Full playback/scrub/keyboard behavior identical to the current `TimelineBar` (reuse its internals; see Implementation).
- **Analysis (`density`):** unchanged structure (icon + "Surveillance Analysis" + legend strip); description tightens to **"Tap any state or county to reveal its statistics."** Region-detail behavior unchanged.
- **Network:** icon + **"Sharing Network"** + two lines: **"See which agencies share ALPR data with each other."** and **"Tap an agency node to trace its connections."** + the agency search field (same search the full panel uses — tapping it expands the sheet to full with focus in the field) + a quiet **"Swipe up for details"** micro-cue. When an agency is selected, the peek swaps to that agency's summary (name, type, key counts) with a ✕ to clear — same pattern as Analysis regions.

### Timeline mechanics

- The `TimelineBar` mobile wrapper in `MapPage.tsx` is deleted; desktop wrapper unchanged.
- Scrubber UI moves into the drawer's `headerContent` for explore mode at peek (component extracted/reused from `TimelineBar` so desktop and mobile share playback logic — no forked scrubber code).
- **Floor-at-peek:** in explore mode the drawer's `minimizedHeight` equals the uniform peek height, so the minimized snap collapses out of `BottomSheet`'s active snap set (existing dedupe behavior); dragging down from full lands on the scrubber peek and stops.
- Entering explore rests at peek (the rest-at-peek effect covers it once explore is registered as peekable).
- The `.timeline-active` +56px CSS offsets in `index.css` are deleted — controls track `--drawer-height` alone.
- The scrubber row keeps its ARIA slider semantics and `touchAction: 'none'`; the sheet's drag handler must not swallow scrubber drags (the scrubber row sits inside the draggable header — pointer events on the slider must stop propagation to the sheet drag, verified by driving both gestures).

## Non-goals

- Map drawer content/height (deferred by decision).
- Desktop: panels, the desktop `TimelineBar`, anything ≥1024px.
- Full-height panel content changes (Network full view keeps its current content; search stays at its top).
- Embed mode changes; routing/data logic; new visualizations.

## Edge cases

- **Playback with sheet at full:** the scrubber peek is hidden at full (header shows only tabs); playback continues; the full explore panel is unchanged. Dragging back down lands on the scrubber.
- **Explore sub-visualizations:** the scrubber peek renders for the timeline (dots) visualization; heatmap mode has no timeline — the peek shows the explore identity (icon + "Timeline" title + one-line description) instead of a dead scrubber. (Heatmap is reachable via the explore panel's layer dropdown.)
- **Network selection vs search:** selecting a search result or tapping a node both set `selectedNode`; the peek swap keys off `selectedNode` alone. Clearing (✕) returns to the explanatory peek.
- **Keyboard on search focus:** focusing the peek's search expands to full first (soft keyboard + 168px peek can't coexist usefully).
- **US-only gating, embed, reduced motion:** unchanged.

## Verification

Build + lint at baseline, then drive at 390×844 (Playwright + `flockhopper 3:verify`):
- Tap across Route → Timeline → Analysis → Network at rest: sheet height does not change (measure per mode).
- Timeline: pill gone; play/scrub/keyboard work in the peek; dragging down from full stops at the scrubber; controls/attribution ride above it.
- Network: explanatory peek text + search; tapping search expands with keyboard; selecting an agency swaps the peek; ✕ clears.
- Route: ad + store buttons; no swipe-up cue; with a route, preview + line.
- Analysis: unchanged behaviors, new one-line description.
- Desktop 1280×800: TimelineBar still bottom-floating; no other changes.

## Files touched (anticipated)

| File | Change |
|------|--------|
| `src/components/panels/MobileTabDrawer.tsx` | Uniform height; explore scrubber peek; network explanatory/selected peeks; route buttons row; rest-at-peek registry gains explore |
| `src/modes/timeline/TimelineBar.tsx` | Extract shared scrubber core (`TimelineScrubberRow`) consumed by desktop bar + mobile peek |
| `src/pages/MapPage.tsx` | Delete the mobile TimelineBar wrapper |
| `src/index.css` | Delete `.timeline-active` offset rules |
| `src/components/panels/NetworkPanelContent.tsx` | Export/reuse the search input for the peek (no content change to the full panel) |
