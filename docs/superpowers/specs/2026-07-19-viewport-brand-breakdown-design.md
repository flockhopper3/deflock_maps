# Viewport Brand Breakdown — Design

**Date:** 2026-07-19
**Status:** Approved (brainstormed with visual mockups; user selected form B and mobile placement 2)

## Summary

Bring back the camera counter with brand breakdown, now powered by the FHIX
positions index (`cameras-{us,ca}-hourly-index.bin` + `.json` sidecar) instead
of the retired GeoJSON-derived stats. The breakdown is **live and
viewport-reactive**: it recomputes as the user pans/zooms, from the same
sub-millisecond CSR grid walk that already produces the "N in view" count.

Scope decisions (approved during brainstorming):

- **Counts cameras in view, live** — not fixed national totals.
- **Map tab only** — Route/Timeline/Analysis/Network panels are unchanged.
- **Form B: stacked composition bar + two-column legend** (chosen over ranked
  bar list and hero-count-with-disclosure from rendered mockups).
- **Mobile: live strip in the minimized Map drawer** (chosen over
  drawer-content-only and a new peek state).
- **The "Swipe up to learn about this map" hint stays exactly as-is**, below
  the strip. The July About-discoverability fix (`0838c9f`) is preserved.

Live data motivating the feature (US index, build `1a9bb92eb3683e09`):
nationally 82.8% Flock Safety, but Chicago reads 57/24/17
Flock/unknown/Motorola and NYC has 18 brands with none above 29%. The
viewport-level mix is the story a static national table cannot tell.

## 1. Data layer

### cameraIndexService.ts

Generalize the existing CSR walk into one pass that produces both the total
and a per-brand tally:

```ts
export interface BrandTally {
  total: number;
  /** Count per brandId (index = brandId, 0 = unknown). Length 256. */
  counts: Uint32Array;
}

export function tallyInBounds(idx: CameraIndex, bounds: Bounds): BrandTally;
```

- Same traversal as `countInBounds` (interior-cell fast path included: interior
  cells add `cellStarts[s+1] - cellStarts[s]` to the total AND must add each
  member's brandId to the tally, so the interior fast path iterates members for
  the tally while skipping the bounds comparisons).
- `countInBounds` remains exported with its current signature, implemented as
  a wrapper (or kept as-is if the interior fast path makes the shared
  implementation slower for count-only callers; decide at implementation, but
  the public API of `countInBounds` does not change).
- Antimeridian and clamping semantics are identical to `countInBounds`
  (shared normalization).

### mapStore.ts

New state alongside `tileViewCameraCount`:

```ts
export interface TileViewBrandStats {
  total: number;
  /** Top 4 by count. "unknown" ranks like any brand, displayed as "Unknown". */
  top: { label: string; count: number }[];
  otherCount: number;   // cameras beyond top 4
  otherBrands: number;  // distinct brands folded into "other"
}

tileViewBrandStats: TileViewBrandStats | null;
setTileViewBrandStats: (s: TileViewBrandStats | null) => void;
```

Derivation from `BrandTally` + `idx.brands` happens at write time in
`MapLibreContainer` (helper `deriveBrandStats(tally, brands)` lives in
`cameraIndexService.ts` with unit tests), so components receive a tiny
ready-to-render object and per-pan re-renders stay cheap.

### MapLibreContainer.tsx

The two existing index call sites (the idle recount in
`updateVisibleCameras` and the gesture-end recount) switch from
`countInBounds` to `tallyInBounds` and write both stores:

- `setTileViewCameraCount(tally.total)` — existing consumers unchanged.
- `setTileViewBrandStats(deriveBrandStats(tally, idx.brands))`.

Every path that today writes `setTileViewCameraCount(null)` or a
query-fallback count also writes `setTileViewBrandStats(null)` — the
breakdown has no fallback path (see §5).

## 2. Shared component: BrandBreakdown

`src/components/map/BrandBreakdown.tsx`, rendering from
`useMapStore(s => s.tileViewBrandStats)`. Renders nothing when stats are
`null` or `total === 0`.

Two variants:

- **`variant="full"`** (default): 100% stacked bar (h-2, rounded, hairline
  track) + two-column legend. Legend rows: swatch, brand label, bold percent
  (whole numbers, tabular-nums). Rows: top 4 entries + one "N others" row when
  `otherCount > 0`.
- **`variant="strip"`** (mobile minimized): micro-label "IN VIEW BY BRAND" +
  leader summary ("57% Flock Safety") on one line, then the bar. No legend.

Color assignment is **by rank, not brand identity**:

| Slot | Color |
|---|---|
| Rank 1 | `#0080BC` (accent) |
| Rank 2 | `#4db3e0` |
| Rank 3 | `#7dd0f2` |
| Rank 4 | `#b8e5fa` |
| "Unknown" (any rank) | `#3f4550` gray, always |
| "N others" | `#6b7280`-family light gray |

When "Unknown" occupies a rank slot, the blue it would have taken passes to
the next ranked brand, so at most 4 accent tints appear and gray always means
"not a named brand". Bar segments are ordered by rank (unknown in its ranked
position), "others" last.

Copy is plain and declarative, no em dashes (user rule). Labels come straight
from the sidecar `brands[]` (already canonical display names); brandId 0
renders as "Unknown" everywhere (matches the approved form-B mockup).

## 3. Desktop placement (left panel)

`MapPanelContent` (`src/components/panels/MapPanel.tsx`) gains a
"Cameras in view" section **above the About card**:

- Row 1: micro-label `CAMERAS IN VIEW` left, total right
  (`text-lg`-scale accent, tabular-nums).
- Row 2+: `<BrandBreakdown variant="full" />`.
- Hairline divider, then the existing About content untouched.

The section (label + total row included) renders only when
`tileViewBrandStats` is non-null, so the panel degrades to today's
About-first layout exactly when the breakdown is unavailable.

## 4. Mobile placement (Map tab drawer)

In `MobileTabDrawer.tsx`:

- **Minimized Map drawer** grows from 108px to ~160px (exact value tuned at
  implementation): tabs row, then `<BrandBreakdown variant="strip" />`, then
  the unchanged "Swipe up to learn about this map" hint row.
- When stats are `null`, the strip is omitted and `minimizedHeight` returns
  to 108 — the drawer looks exactly like today. The height is derived from
  the same condition that renders the strip so the two can never disagree.
- `minimizedHeight` feeds the existing `--drawer-height` plumbing, so map
  controls and attribution ride above the taller sheet automatically.
- **Full sheet** (`renderTabContent` case `'map'`): leads with the same
  full-variant section as desktop (label + total + bar + legend), then
  `MapPanelContent`'s About content, then `DrawerFooter`. To avoid
  duplication, the section is extracted as `CamerasInViewSection` and
  `MapPanelContent` composes it, so mobile-full and desktop render the same
  tree.
- The header's "N in view" count is untouched; the strip shows the leader
  percent instead of repeating the number.

## 5. Availability rules (when it hides)

The index describes the **unfiltered** dataset only. The breakdown renders
solely from index-derived stats; there is no queryRenderedFeatures or GeoJSON
fallback. `tileViewBrandStats` is `null` (and the UI hides) when:

- `renderMode !== 'tiles'` — covers attribute filters (`filter-tiles`),
  heatmap visualization, and timeline (GeoJSON paths). A filtered header
  count next to an unfiltered breakdown would contradict itself; hiding on
  an explicit user action (applying a filter) reads as intentional.
- The index artifact is unavailable (fetch/contract failure) or not yet
  loaded — before load the UI simply shows today's layout; it appears once
  the index resolves and the next idle recount fires.
- Country switches: the existing per-country `ensureCameraIndex` flow
  already handles this; stats are nulled on country change until the new
  index recount lands. Canada works identically (its index has 11 brands).

## 6. Testing

- `cameraIndexService.test.ts`: `tallyInBounds` against the existing
  synthetic fixtures — per-box brand totals match a brute-force filter,
  `tally.total === countInBounds(...)` for identical bounds (including
  antimeridian wrap and full-world spans), interior fast path agreement.
- `deriveBrandStats`: top-4 selection, unknown ranking, other folding
  (`otherCount`/`otherBrands`), empty viewport → `total: 0`.
- Component behavior (null hides, strip vs full) verified end-to-end via the
  `flockhopper 3:verify` Playwright skill: desktop panel shows the section
  with plausible percentages; mobile minimized drawer shows the strip and the
  About hint below it; applying a brand filter hides both.

## Out of scope

- No changes to Route/Timeline/Analysis/Network panels.
- No national-totals view.
- No brand-tap-to-filter interaction (possible follow-up: tapping a legend
  row could apply that brand filter; deliberately excluded to keep this
  slice small).
- No changes to the FHIX pipeline or artifacts — the client consumes what is
  already published.
