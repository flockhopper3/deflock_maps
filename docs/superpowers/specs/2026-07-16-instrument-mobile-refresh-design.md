# Instrument-grade mobile refresh — Design

**Date:** 2026-07-16
**Status:** Approved (design), pending implementation plan
**Area:** Mobile map screen, drawer, and shared design language
**Supersedes:** `2026-07-16-mobile-drawer-fullbleed-design.md` (full-bleed direction rejected; peek-drawer and Analysis-consolidation ideas carried forward in revised form)

## Problem

The app feels amateurish and un-designed, and the pain is sharpest on mobile:

1. **Tapping through the tabs feels unresponsive.** Mode switches do heavy work (data loads, layer swaps, panel mounts) before the UI acknowledges the tap.
2. **After switching, users can't tell what they're looking at.** Mode identity and descriptions only exist at full drawer height, behind an undiscoverable drag. The "Analysis" tab label doesn't even match the mode's real name.
3. **The chrome reads as unconsidered.** Mixed border/glow/fill treatments, a hamburger menu that duplicates the drawer tabs, a camera count that renders twice, overlays that stack on each other in Analysis mode.

Verified code-level causes (from the 2026-07-16 audit):

- `MapPage.tsx:48,187` subscribes to map bounds and recomputes a viewport camera count on every pan, re-rendering the whole page, solely to feed the mobile header block.
- `MobileTabDrawer.tsx:363` gives Route/Analysis/Network `peekHeight === minimizedHeight`, so the peek snap is skipped; descriptions render only at `snapPoint === 'full'`.
- Mode switches run store loads + full panel mounts synchronously with the tap (`MobileTabDrawer.tsx:93-96`, `renderTabContent`).
- In Analysis, tapping a region stacks a fixed popup (`DensityFeaturePopup.tsx:160`) on top of `DensityLegendBar` on top of the drawer.

## Decisions made during brainstorming

- **Taste direction:** "Instrument-grade minimal" (option A of four mocked directions) — near-black, hairline borders, one restrained blue, uppercase micro-labels, quiet precision.
- **Scope appetite:** not a huge overhaul — "good enough," carefully staged; 6M MAU and few testers means small, independently shippable slices.
- **Structure:** the 5 tabs (Map, Route, Timeline, Analysis, Network) stay exactly as-is.
- **Brand:** the DeFlock logo is mission-critical and must always be visible → keep a **slim header** on mobile (option 3 of three mocked placements), not full-bleed.
- **Camera count:** lives in the slim header, always visible in every mode; the drawer's duplicate goes away.

## Goals

- A tab tap visually responds within one frame; heavy work never blocks the acknowledgment.
- After any mode switch, the mode's real name and a one-line description are immediately visible without a gesture.
- One disciplined visual language (tokens) across the mobile map screen, drawer, and popups — the seed for the whole app over time.
- The map gets more usable area than today despite the identity peek (slim header 48→38px; overlay stacking removed).
- Each slice ships alone and leaves the app coherent.

## Non-goals

- Desktop panel redesign (the token language migrates there in a later effort).
- Map and Timeline drawer content changes.
- IA/mode changes, new visualizations, routing/data-pipeline changes.
- General performance work beyond the three named fixes (no bundle/tile work).

## Design

### 1. Design language ("instrument" tokens)

A small token set added to the Tailwind config and applied to the mobile map screen, drawer, search, and popups in this effort:

- **Surfaces:** one near-black surface family (align to the existing `dark-900` ramp, tightened; no per-component one-off backgrounds).
- **Borders:** hairlines only — `1px` at ~10–14% white; no glows/gradient borders on chrome. Glow is reserved for map data (camera dots).
- **Accent:** one restrained blue, used only for "active/data": active tab, camera dots, key numbers, selection highlights. Never decorative.
- **Type:** one ramp — page/mode titles (~15px semibold, tight tracking), body (~12px), captions (~10px), and uppercase micro-labels (~8.5–9px, +14% tracking) for category text ("COUNTY", "CAMERAS PER CAPITA").
- **Spacing:** 4px scale, applied consistently (audit found mixed 10/11/12/14px paddings).
- **Radii:** 6–8px, square-ish; no pill-radius chrome except the drawer grab handle.
- **Tabs:** uppercase micro-label text tabs with a 1.5px accent underline for the active mode, replacing today's bordered pill buttons.

### 2. Slim header + chrome cleanup (mobile)

- Header shrinks 48→38px: hairline bottom border, containing only **logo (icon + wordmark + MAPS)**, the **live camera count**, and **Share**. Desktop header unchanged.
- **Delete** the hamburger slide-down menu (`MapPage.tsx:411-453`) — the drawer tabs own mode switching (mode availability gating stays in the tabs).
- **Camera count:** one instance, in the header, all modes. Implemented as its own small component that subscribes to bounds itself, so `MapPage` stops re-rendering on pan. The drawer's map-mode count row is removed (the "swipe up" hint may stay).
- `LegacyMapLink` moves to the drawer's expanded footer.
- Container `h-screen` → `dvh` **with fallback**: `h-screen supports-[height:100dvh]:h-[100dvh]`.
- `MapSearch` keeps floating below the header, unchanged position. No floating logo/share chips (that was the rejected full-bleed direction), so no route-card or search inset changes are needed.
- Embed mode unchanged (header already `!isEmbed`).

### 3. Drawer: instant and self-explanatory

**Responsiveness rules:**

- The tapped tab's active state applies immediately on touch; mode-change side effects (data loads via `useEffect`, panel mounts) are wrapped in `startTransition` (or equivalent deferral) so paint happens first.
- Only the active mode's drawer content renders (already true — keep it that way).

**Identity peek (Route, Analysis, Network):**

- Per-mode `peekHeight` distinct from `minimizedHeight`, target **~150–170px total** (Route may run slightly taller to fit the CTA row, but stays under 200px).
- Peek content = one **identity row**: icon chip (hairline, accent tint) + real mode title + one-line description + a subtle chevron. **The entire row is the expand button** (no separate "Controls & details" bar). Copy:
  - Route — **"Route"**: "Set a start and destination to see ALPR exposure along your route — and safer alternatives." Peek also includes the `FlockHopperCTA` row; once routes exist, the existing `MobileRoutePreview` replaces the identity row (existing auto-expand behavior preserved).
  - Analysis — **"Surveillance Analysis"**: "Compare surveillance intensity by state or county. Tap any region to reveal its statistics." Peek includes a slim gradient legend strip.
  - Network — **"Sharing Network"**: "See which agencies share ALPR data with each other. Tap an agency to trace its connections."
- **Snap model:** entering an in-scope mode from minimized raises to peek; switching modes otherwise keeps the current snap. Collapsing (drag down, backdrop tap, header collapse) lands on **peek** when the mode has one, else minimized. Deep-linking straight into an in-scope mode also rests at peek (mount effect).
- `disableHeaderTap` stays (the tabs row lives in the header); the identity row provides the tap affordance instead.
- Map and Timeline keep current behavior.

### 4. Analysis: one surface

- On mobile, tapping a region raises the drawer to a **mid detail height** (fits region name, camera count, the two `RankTrack`s, and the legend without covering the map). The map and the tapped region stay visible above the sheet.
- Stats content is extracted to a shared `DensityFeatureStats` component used by both the mobile drawer and the desktop popup. Desktop's floating popup and corner legend bar are unchanged (legend bar becomes desktop-only).
- The drawer stats include a **✕** that clears the selection and returns to peek. Tapping empty map area still clears (existing behavior). Clearing the selection returns the drawer to peek.
- No fixed mobile popup card; no stacked overlays.

### 5. Performance (scoped)

Exactly three fixes, all in code this design already touches:

1. Remove `MapPage`'s bounds subscription + `viewCameraCount` (moves into the isolated header-count component).
2. Defer mode-switch side effects behind the tab-highlight paint (`startTransition`).
3. Keep drawer content mounting exclusive to the active mode.

### 6. Overlay coexistence (audit fixes)

- The drawer publishes its current resting height as a CSS variable (e.g. `--drawer-height` on `.map-page`); the mobile bottom offsets for the maplibre controls, layers/style control, and attribution (`index.css:441-499`) become `calc()` expressions off it — geolocate, layers, and OSM attribution are never covered at any snap.
- The network disclaimer FAB (`MobileTabDrawer.tsx:353`, `fixed bottom-[96px]`) repositions relative to the drawer height (or folds into the network peek) so the peek never hides it.
- Touch targets on new/changed chrome ≥ 44px.

## Rollout — four independent slices

1. **Responsiveness** — MapPage subscription removal, `startTransition` on mode switch, instant tab feedback. Invisible; ships first.
2. **Token discipline pass** — tokens + restyle of existing components (header, tabs, drawer, search, popups). No layout or behavior changes.
3. **Slim header + chrome cleanup** — 38px header with count, hamburger deletion, `dvh` fix, `--drawer-height` control offsets.
4. **Identity peek + Analysis detail sheet** — the behavior change; ships last.

Stopping after any slice leaves the app coherent.

## Edge cases

- **Route auto-expand:** preserved — routes arriving still raise the drawer to peek (preview + CTA).
- **US-only gating:** unchanged; lives in the drawer tabs.
- **Embed mode:** no header, no new chrome (all additions gated `!isEmbed`).
- **Reduced motion / drag:** `BottomSheet` drag + snap behavior unchanged; affordances are additive.
- **Small phones:** Analysis detail height must fit both RankTracks; the sheet body scrolls if it can't.
- **`dvh` fallback:** browsers without `dvh` keep `100vh` (current behavior), never a missing height.

## Verification

Per slice: `npm run build` + `npm run lint` clean, then drive the app (`flockhopper 3:verify` skill / Playwright) in a mobile viewport:

- Tab taps highlight instantly even with DevTools CPU throttling; no spinner-before-feedback.
- Each of Route/Analysis/Network rests at a peek showing identity + description; tapping the identity row expands.
- Analysis: tapping a region raises the detail sheet with correct stats, map still visible, ✕ clears; no floating popup or legend bar on mobile.
- Header shows logo + live count + share in all modes; count updates on pan without page-wide re-renders (React DevTools profiler).
- Geolocate, layers control, and attribution visible at every snap in every mode.
- Desktop (≥1024px) unchanged in behavior; restyled only where tokens apply.

## Files touched (anticipated)

| File | Slice | Change |
|------|-------|--------|
| `tailwind.config.js` / `src/index.css` | 2 | Instrument tokens; `--drawer-height` offset wiring (slice 3) |
| `src/pages/MapPage.tsx` | 1,2,3 | Drop bounds subscription; slim header; delete hamburger; `dvh` fallback |
| `src/components/panels/MobileTabDrawer.tsx` | 1,2,4 | `startTransition`; token restyle; identity peek; snap model; count row removal; FAB fix |
| `src/components/common/BottomSheet.tsx` | 4 | Collapse-to-peek targets; publish height variable |
| `src/modes/density/DensityFeatureStats.tsx` (new) | 4 | Shared stats body |
| `src/modes/density/DensityFeaturePopup.tsx` | 4 | Use shared stats; drop mobile branch |
| `src/components/map/DensityLegendBar.tsx` | 4 | Desktop-only |
| New: header count component | 1,3 | Isolated bounds subscription + count display |
