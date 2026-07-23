# Instrument-Grade Mobile Refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile map app feel instantly responsive and self-explanatory, in a disciplined "instrument-minimal" visual language — shipped as four independent slices.

**Architecture:** (Slice 1) Isolate the live camera count into its own component and defer mode-switch work behind the tab-highlight paint. (Slice 2) Add two design tokens and restyle existing chrome (underline tabs, hairlines) with zero layout/behavior change. (Slice 3) Slim the mobile header to 38px with logo + count + share, delete the hamburger, fix `dvh`, and tie map-control offsets to a `--drawer-height` CSS variable. (Slice 4) Give Route/Analysis/Network an identity peek whose row is the expand button, and fold Analysis region stats into a mid-height drawer detail.

**Tech Stack:** React 18 + TypeScript, Tailwind CSS, framer-motion (`BottomSheet`), Zustand, lucide-react.

**Spec:** `docs/superpowers/specs/2026-07-16-instrument-mobile-refresh-design.md`

## Global Constraints

- No frontend test framework exists. Per-task verify cycle: `npm run build` (tsc + vite) exits 0, `npm run lint` exits 0, then **drive the app** (`npm run dev`, port 3000) in a mobile viewport (Chrome DevTools device toolbar, iPhone 12 / 390×844; width < 1024px so mobile layout is active). The `flockhopper 3:verify` skill automates driving via Playwright.
- Mobile breakpoint is Tailwind `lg` (1024px). Mobile-only = `lg:hidden`, desktop-only = `hidden lg:…`.
- Desktop (≥1024px) behavior must not change in any task. Restyling desktop-visible chrome is allowed only where a task explicitly says so.
- Embed mode: all header/chrome additions stay gated behind the existing `!isEmbed` checks; add nothing new in embed.
- Touch targets on new/changed mobile chrome ≥ 44px in at least one dimension (the 38px header bounds height; make widths ≥ 44px there).
- Exact copy (verbatim, from the spec):
  - Route: title **"Route"**, description **"Set a start and destination to see ALPR exposure along your route — and safer alternatives."**
  - Analysis: title **"Surveillance Analysis"**, description **"Compare surveillance intensity by state or county. Tap any region to reveal its statistics."**
  - Network: title **"Sharing Network"**, description **"See which agencies share ALPR data with each other. Tap an agency to trace its connections."**
- Peek heights: target ~150–170px; Route may run slightly taller for the CTA row but stays under 200px.
- Do not modify routing/data logic, desktop side panels, or Map/Timeline drawer content (beyond the count-row removal in Task 6).
- Commit after every task; each slice (1–2, 3–4, 5–7, 8–11) leaves the app shippable.

---

## Slice 1 — Responsiveness

### Task 1: Isolate the live camera count (`HeaderCameraCount`)

**Files:**
- Create: `src/components/map/HeaderCameraCount.tsx`
- Modify: `src/pages/MapPage.tsx` (destructure `:39-48`, dead computation `:186-189`, header usage `:385-389`)

**Interfaces:**
- Produces: `HeaderCameraCount` component, props `{ className?: string }`. Renders `"<n> in view"` (filter-aware) or `"Loading…"`. Task 6 re-uses it in the slim header.
- Consumes: `useMapStore` (`bounds`), `useCameraStore` (`getCamerasInBounds`, `isLoading`, `filteredCameras`, `filters`).

- [ ] **Step 1: Create the component**

Create `src/components/map/HeaderCameraCount.tsx`:

```tsx
import { useMemo } from 'react';
import { useCameraStore, useMapStore } from '../../store';

/**
 * Live "N in view" count, isolated in its own component so per-pan bounds
 * updates re-render only this span — not the page that hosts it.
 */
export function HeaderCameraCount({ className = '' }: { className?: string }) {
  const bounds = useMapStore(s => s.bounds);
  const getCamerasInBounds = useCameraStore(s => s.getCamerasInBounds);
  const isLoading = useCameraStore(s => s.isLoading);
  const filteredCameras = useCameraStore(s => s.filteredCameras);
  const filters = useCameraStore(s => s.filters);

  const hasActiveFilters =
    filters.brands.length + filters.operators.length +
    filters.surveillanceZones.length + filters.mountTypes.length > 0;

  // Only built when filters are active, so the per-pan cost stays a grid lookup
  const filteredIdSet = useMemo(
    () => (hasActiveFilters ? new Set(filteredCameras.map(c => c.osmId)) : null),
    [hasActiveFilters, filteredCameras]
  );

  const count = useMemo(() => {
    if (!bounds) return 0;
    const inView = getCamerasInBounds(bounds.north, bounds.south, bounds.east, bounds.west);
    if (!filteredIdSet) return inView.length;
    let n = 0;
    for (const cam of inView) if (filteredIdSet.has(cam.osmId)) n++;
    return n;
  }, [bounds, getCamerasInBounds, filteredIdSet]);

  if (isLoading) {
    return <span className={`text-xs text-dark-400 ${className}`}>Loading…</span>;
  }
  return (
    <span className={`text-xs text-dark-400 ${className}`}>
      <span className="text-dark-200 font-semibold tabular-nums">{count.toLocaleString()}</span> in view
    </span>
  );
}
```

- [ ] **Step 2: Swap it into the existing mobile header block**

In `src/pages/MapPage.tsx`, replace the inline count span (`:387-389`):

```tsx
                <span className="text-xs text-dark-400">
                  <span className="text-dark-200 font-semibold tabular-nums">{viewCameraCount.toLocaleString()}</span> in view
                </span>
```

with:

```tsx
                <HeaderCameraCount />
```

Add the import next to the other map imports:

```tsx
import { HeaderCameraCount } from '@/components/map/HeaderCameraCount';
```

- [ ] **Step 3: Remove the page-wide bounds subscription**

Still in `MapPage.tsx`:
- Delete `const bounds = useMapStore(s => s.bounds);` (`:48`). Keep the `center`/`zoom` subscriptions — they feed the URL sync.
- Remove `getCamerasInBounds,` from the `useCameraStore()` destructure (`:39-47`).
- Delete the `viewCameraCount` computation (`:186-189`, the `const viewCameraCount = bounds ? … : 0;` block and its comment).

Run `grep -n "viewCameraCount\|getCamerasInBounds\|s.bounds" src/pages/MapPage.tsx` — expect zero matches.

- [ ] **Step 4: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: both exit 0 (no unused-variable errors).

- [ ] **Step 5: Verify (drive the app)**

Run: `npm run dev`, mobile viewport. Pan the map.
Expected: the header count updates while panning; with React DevTools Profiler recording, panning highlights only `HeaderCameraCount`, not `MapPage`.

- [ ] **Step 6: Commit**

```bash
git add src/components/map/HeaderCameraCount.tsx src/pages/MapPage.tsx
git commit -m "perf: isolate live camera count so map pans stop re-rendering MapPage"
```

---

### Task 2: Instant tab feedback (optimistic highlight + deferred switch)

**Files:**
- Modify: `src/components/panels/MobileTabDrawer.tsx` (`handleTabPress` `:115-120`, pills `:145-166`)

**Interfaces:**
- Produces: `pendingMode: AppMode | null` state and `activeMode` (`pendingMode ?? appMode`) — Task 4's tab restyle and Task 9's peek logic read `activeMode`/`handleTabPress` as defined here.

Note: React `startTransition` was considered and rejected — Zustand's `useSyncExternalStore` de-opts external-store updates to synchronous, so a transition wouldn't defer the heavy re-render. A double-`requestAnimationFrame` guarantees the highlight paints one frame before the mode switch work starts.

- [ ] **Step 1: Add optimistic state and defer the switch**

In `MobileTabDrawer.tsx`, replace `handleTabPress` (`:115-120`):

```tsx
  /* ---- tab switch ---- */
  const handleTabPress = useCallback((mode: AppMode) => {
    if (mode !== appMode) {
      onModeChange(mode);
    }
    // Keep the drawer at its current snap — do NOT auto-expand on tab tap
  }, [appMode, onModeChange]);
```

with:

```tsx
  /* ---- tab switch ----
   * The tapped tab highlights this frame (pendingMode); the actual mode
   * switch (store update → layer swaps → panel mounts) is deferred one
   * painted frame so the tap always feels instant. */
  const [pendingMode, setPendingMode] = useState<AppMode | null>(null);

  const handleTabPress = useCallback((mode: AppMode) => {
    if (mode === appMode) return;
    setPendingMode(mode);
    requestAnimationFrame(() => requestAnimationFrame(() => onModeChange(mode)));
  }, [appMode, onModeChange]);

  // Clear the optimistic highlight once the real mode lands (or is bounced,
  // e.g. the Canada US-only guard switching back to 'map').
  useEffect(() => {
    setPendingMode(null);
  }, [appMode]);

  const activeMode = pendingMode ?? appMode;
```

- [ ] **Step 2: Drive the pills from `activeMode`**

In the pills map (`:146-166`), change:

```tsx
          const isActive = appMode === mode;
```

to:

```tsx
          const isActive = activeMode === mode;
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: both exit 0.

- [ ] **Step 4: Verify (drive the app)**

Run: `npm run dev`, mobile viewport, DevTools Performance → CPU 6× slowdown.
Expected: tapping Analysis/Network highlights the tapped pill immediately (next frame), visibly before the map layers change. No double-highlight or stuck highlight after the Canada bounce (switch country to Canada while in Analysis — pill returns to Map cleanly).

- [ ] **Step 5: Commit**

```bash
git add src/components/panels/MobileTabDrawer.tsx
git commit -m "perf: optimistic tab highlight — mode switch work deferred past the paint"
```

---

## Slice 2 — Instrument tokens

### Task 3: Add the two design tokens

**Files:**
- Modify: `tailwind.config.js` (`theme.extend.colors`, `theme.extend.fontSize`)

**Interfaces:**
- Produces: `hairline` color token (usable as `border-hairline`, `bg-hairline`) and `text-2xs` font-size token. Tasks 4, 6, 9, 10 use both.

- [ ] **Step 1: Add tokens**

In `tailwind.config.js` inside `theme.extend.colors`, after the `dark` scale, add:

```js
        // Instrument language: the one border treatment for chrome
        hairline: 'rgba(255,255,255,0.12)',
```

Inside `theme.extend.fontSize`, before `'xs'`, add:

```js
        // Uppercase micro-labels ("COUNTY", tab labels)
        '2xs': ['0.625rem', { lineHeight: '0.875rem', letterSpacing: '0.06em' }],
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.js
git commit -m "feat: hairline + 2xs instrument tokens"
```

---

### Task 4: Token pass on existing chrome (no layout/behavior change)

**Files:**
- Modify: `src/components/panels/MobileTabDrawer.tsx` (pills `:145-167` → underline tabs)
- Modify: `src/components/common/BottomSheet.tsx` (sheet chrome `:216`, grab handle `:239`)
- Modify: `src/components/map/MapSearch.tsx` (input `:226`)
- Modify: `src/components/map/DensityLegendBar.tsx` (card `:13`)
- Modify: `src/components/panels/FlockHopperCTA.tsx` (`row` variant `:95-98`)

**Interfaces:**
- Consumes: `activeMode` from Task 2; `hairline`/`text-2xs` tokens from Task 3.
- Produces: the underline tab row (Task 9 renders content beneath it unchanged).

Note: `DensityFeaturePopup` is deliberately NOT restyled here — Task 10 rewrites it; restyle lands there. The map-mode count row's glow dot is NOT touched — Task 6 deletes it.

- [ ] **Step 1: Pills → underline text tabs**

In `MobileTabDrawer.tsx`, replace the whole tabs block (`:145-167`, the `<div className="grid grid-cols-5 gap-1">…</div>`):

```tsx
      <div className="flex items-stretch -mx-4 px-2 border-b border-hairline">
        {TABS.map(({ mode, label }) => {
          const isActive = activeMode === mode;
          const available = isModeAvailable(mode, country);
          return (
            <button
              key={mode}
              onClick={() => available && handleTabPress(mode)}
              disabled={!available}
              aria-disabled={!available}
              className={`relative flex-1 min-w-11 py-2.5 text-2xs font-semibold uppercase tracking-[0.14em] transition-colors ${
                isActive
                  ? 'text-white'
                  : available
                    ? 'text-dark-500 active:text-dark-300'
                    : 'text-dark-600'
              }`}
            >
              {label}
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[1.5px] bg-accent" />
              )}
            </button>
          );
        })}
      </div>
```

- [ ] **Step 2: Sheet chrome hairlines**

In `BottomSheet.tsx:216`, change:

```tsx
        className="fixed bottom-0 left-0 right-0 z-[60] lg:hidden bg-dark-900 rounded-t-xl flex flex-col"
```

to:

```tsx
        className="fixed bottom-0 left-0 right-0 z-[60] lg:hidden bg-dark-900 rounded-t-lg border-t border-hairline flex flex-col"
```

At `:239`, change the grab handle `bg-dark-500` → `bg-dark-600`.

- [ ] **Step 3: Search input hairline**

In `MapSearch.tsx:226`, change the input classes:

```tsx
          className="w-full pl-12 pr-24 py-3.5 bg-dark-800 border border-dark-600 rounded-md text-white placeholder-dark-500 text-base text-left focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20 transition-all"
```

to:

```tsx
          className="w-full pl-12 pr-24 py-3.5 bg-dark-900/90 backdrop-blur border border-hairline rounded-lg text-white placeholder-dark-500 text-base text-left focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20 transition-all"
```

- [ ] **Step 4: Density legend card hairline**

In `DensityLegendBar.tsx:13`, change:

```tsx
      <div className="bg-dark-800/90 rounded-md px-3 py-2 border border-dark-600">
```

to:

```tsx
      <div className="bg-dark-900/90 rounded-lg px-3 py-2 border border-hairline">
```

- [ ] **Step 5: FlockHopper CTA row onto accent tokens**

In `FlockHopperCTA.tsx`, in the `row` variant, change the anchor class (`:95`):

```tsx
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-500/5 border border-blue-500/40 active:bg-blue-500/10 transition-colors"
```

to:

```tsx
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-accent-muted border border-accent/40 active:bg-accent/10 transition-colors"
```

and the icon box (`:97-99`):

```tsx
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
          <Navigation className="w-4 h-4 text-blue-400" />
        </div>
```

to:

```tsx
        <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center flex-shrink-0">
          <Navigation className="w-4 h-4 text-accent" />
        </div>
```

(The `card` variant is desktop/panel-facing — leave it.)

- [ ] **Step 6: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: both exit 0.

- [ ] **Step 7: Verify (drive the app)**

Run: `npm run dev`, mobile viewport.
Expected: drawer tabs are uppercase micro-labels with an accent underline on the active one; every tab still switches modes, disabled (Canada) tabs still gate; drawer top edge and search input show hairline borders; Route peek's CTA row reads in DeFlock blue, not the old bright blue; nothing moved position.

- [ ] **Step 8: Commit**

```bash
git add src/components/panels/MobileTabDrawer.tsx src/components/common/BottomSheet.tsx src/components/map/MapSearch.tsx src/components/map/DensityLegendBar.tsx src/components/panels/FlockHopperCTA.tsx
git commit -m "style: instrument token pass — underline tabs, hairline chrome"
```

---

## Slice 3 — Slim header + chrome cleanup

### Task 5: `dvh` viewport fix (with fallback)

**Files:**
- Modify: `src/pages/MapPage.tsx:330`

**Interfaces:** none.

- [ ] **Step 1: Add the dvh height with vh fallback**

At `MapPage.tsx:330`, change `h-screen` to `h-screen supports-[height:100dvh]:h-[100dvh]`:

```tsx
      <div className={`map-page h-screen supports-[height:100dvh]:h-[100dvh] w-screen flex flex-col bg-dark-900 overflow-hidden ${isExploreMode ? 'timeline-active' : ''} ${appMode === 'map' ? 'map-mode-active' : ''}`}>
```

(Browsers without `dvh` keep today's `100vh` behavior — never a missing height.)

- [ ] **Step 2: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: both exit 0.

- [ ] **Step 3: Verify (drive the app)**

Run: `npm run dev`. On a real phone if available (or responsive mode with dynamic toolbar emulation): the drawer's grab handle and tabs sit fully above the browser's bottom bar.

- [ ] **Step 4: Commit**

```bash
git add src/pages/MapPage.tsx
git commit -m "fix: dvh viewport height with vh fallback so the drawer clears the browser bar"
```

---

### Task 6: Slim 38px mobile header — logo + count + share; delete the hamburger

**Files:**
- Modify: `src/pages/MapPage.tsx` (header `:332-408`, slide-down nav `:410-453`, `mobileMenuOpen` state `:177`, icon imports `:24`)
- Modify: `src/components/common/ShareButton.tsx` (add `icon` variant)
- Modify: `src/components/panels/MobileTabDrawer.tsx` (count row `:168-190`, dead count code `:66-90`, `DrawerFooter`, footers in `renderTabContent`)

**Interfaces:**
- Consumes: `HeaderCameraCount` (Task 1).
- Produces: `ShareButton` accepts `variant="icon"`; local `DrawerFooter` component in `MobileTabDrawer` (used by all five mode cases; Task 10/11 keep it).

- [ ] **Step 1: Add the `icon` variant to ShareButton**

In `ShareButton.tsx`, widen the prop union:

```tsx
interface ShareButtonProps {
  variant: 'header' | 'menu-item' | 'icon';
  className?: string;
}
```

Add before the `header` branch:

```tsx
  if (variant === 'icon') {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className={`flex items-center justify-center w-11 h-full text-dark-400 active:text-dark-200 transition-colors ${className}`}
          aria-label="Share this map view"
        >
          <Share2 className="w-4 h-4" aria-hidden="true" />
        </button>
        {open && <ShareModal onClose={() => setOpen(false)} />}
      </>
    );
  }
```

- [ ] **Step 2: Slim the header on mobile**

In `MapPage.tsx:333`, change the header shell:

```tsx
        <header className="h-12 bg-dark-900 border-b border-dark-600 flex items-center z-50 shrink-0">
```

to:

```tsx
        <header className="h-[38px] lg:h-12 bg-dark-900 border-b border-hairline flex items-center z-50 shrink-0">
```

At `:335`, change the inner row `h-12` → `h-full`:

```tsx
            <div className="flex items-center justify-between h-full">
```

At `:343-352`, make the logo images smaller on mobile: both `<img>` tags change `className="h-7 lg:h-8 w-auto object-contain"` → `className="h-5 lg:h-8 w-auto object-contain"`.

- [ ] **Step 3: Replace the mobile count + hamburger block**

Replace the whole mobile block (`:385-398`, `<div className="lg:hidden flex items-center gap-2">…</div>` — it contains the `HeaderCameraCount` you placed in Task 1 plus the hamburger button):

```tsx
              {/* Mobile: live count + share */}
              <div className="lg:hidden flex items-center gap-2 h-full">
                <HeaderCameraCount />
                <ShareButton variant="icon" className="-mr-2" />
              </div>
```

- [ ] **Step 4: Delete the slide-down menu and its state**

- Delete the entire mobile `<nav>` block (`:410-453`, `{!isEmbed && mobileMenuOpen && ( … )}` including its comment).
- Delete `const [mobileMenuOpen, setMobileMenuOpen] = useState(false);` (`:177`) and its comment.
- In the lucide import (`:24`), remove `Menu` and `X`. Run `grep -n "Menu\|<X \|mobileMenuOpen" src/pages/MapPage.tsx` — expect no remaining uses (the `MODE_LABELS` icons `Route, Compass, BarChart3, Network, MapIcon` stay — they're used by the desktop nav).

- [ ] **Step 5: Remove the drawer's duplicate count; center the hint**

In `MobileTabDrawer.tsx`, replace the map-mode minimized row (`:168-190`, the `{appMode === 'map' && snapPoint === 'minimized' && ( … )}` block):

```tsx
      {appMode === 'map' && snapPoint === 'minimized' && (
        <div className="mt-2.5 flex items-center justify-center gap-1 text-dark-400 animate-fade-in">
          <ChevronUp className="w-3.5 h-3.5 animate-nudge-up" />
          <span className="text-[11px] font-medium">Swipe up for details</span>
        </div>
      )}
```

Then delete the now-dead count machinery (`:66-90`): the `bounds`, `getCamerasInBounds`, `camerasLoading`, `filteredCameras`, `filters` reads, `hasActiveFilters`, `filteredIdSet`, and `viewCameraCount`. Remove `useMapStore` from the store import if nothing else in the file uses it (grep first: `grep -n "useMapStore" src/components/panels/MobileTabDrawer.tsx`). Keep `useCameraStore` — `country` and `isLoading`… note: only `country` remains; remove the `isLoading` read if it was only used by the count.

- [ ] **Step 6: Add `DrawerFooter` and use it in all five cases**

Above the `MobileTabDrawer` function (after the `TABS` array), add:

```tsx
/** Shared drawer footer: legacy-map link (its mobile home now that the
 *  header menu is gone) + attribution. */
function DrawerFooter() {
  return (
    <div className="mt-6 pt-4 border-t border-hairline flex flex-col items-center gap-2">
      <LegacyMapLink variant="menu-item" className="justify-center !py-1 text-xs" />
      <p className="text-[10px] text-dark-500 text-center">
        Maps by{' '}
        <a href="https://openroadlabs.org" target="_blank" rel="noopener noreferrer" className="hover:text-dark-300 transition-colors">OpenRoad Labs LLC</a>
      </p>
    </div>
  );
}
```

Add the import: `import { LegacyMapLink } from '../common/LegacyMapLink';`

In `renderTabContent`, replace the five identical footer blocks (`<div className="mt-6 pt-4 border-t border-dark-700/50">…OpenRoad Labs…</div>` in the **map**, **route**, **explore**, **density**, and **network** cases) each with:

```tsx
            <DrawerFooter />
```

- [ ] **Step 7: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: both exit 0, no unused imports.

- [ ] **Step 8: Verify (drive the app)**

Run: `npm run dev`, mobile viewport.
Expected: header is a slim 38px hairline bar with DeFlock logo (icon + wordmark), live count, and a share icon (share modal opens); no hamburger anywhere; map-mode minimized drawer shows only the centered "Swipe up" hint; every expanded mode footer shows "DeFlock Legacy Map" + attribution; count still updates on pan; desktop header unchanged at ≥1024px. Embed mode (`?embed=true` or however `useEmbedMode` gates — check `src/hooks/useEmbedMode.ts`) still shows no header.

- [ ] **Step 9: Commit**

```bash
git add src/pages/MapPage.tsx src/components/common/ShareButton.tsx src/components/panels/MobileTabDrawer.tsx
git commit -m "feat: slim 38px mobile header (logo + count + share); delete hamburger menu"
```

---

### Task 7: Map controls track the drawer via `--drawer-height`

**Files:**
- Modify: `src/components/panels/MobileTabDrawer.tsx` (publish the variable; network FAB `:353`)
- Modify: `src/index.css` (mobile media query, `:424-499`)

**Interfaces:**
- Produces: CSS custom property `--drawer-height` on `.map-page` (px string), always the drawer's current *resting* height (minimized or peek — never the full height). Tasks 9/11 change peek heights and automatically move the controls through this variable.

- [ ] **Step 1: Publish the variable from the drawer**

In `MobileTabDrawer.tsx`, just below the `minimizedHeight` declaration (`:141`), hoist the peek height into a named variable and add the effect:

```tsx
  // Resting height feeds --drawer-height so map controls/attribution ride
  // above the sheet. Parked at the peek height while 'full' (controls are
  // behind the sheet then anyway; jumping them to 85vh would look broken).
  const peekHeightForMode = isRoutePeekable ? 210 : minimizedHeight;
  const drawerRestHeight = snapPoint === 'minimized' ? minimizedHeight : peekHeightForMode;

  useEffect(() => {
    const el = document.querySelector<HTMLElement>('.map-page');
    el?.style.setProperty('--drawer-height', `${drawerRestHeight}px`);
  }, [drawerRestHeight]);
```

In the `<BottomSheet>` props, change `peekHeight={isRoutePeekable ? 210 : minimizedHeight}` → `peekHeight={peekHeightForMode}`.

- [ ] **Step 2: Reposition the network warning FAB relative to the drawer**

At `:353`, change the FAB from a hardcoded offset:

```tsx
          className="fixed bottom-[96px] left-4 z-[52] flex items-center justify-center w-10 h-10 rounded-full bg-amber-500 shadow-lg shadow-amber-500/30 active:bg-amber-600 transition-colors"
```

to:

```tsx
          className="fixed left-4 z-[52] flex items-center justify-center w-11 h-11 rounded-full bg-amber-500 shadow-lg shadow-amber-500/30 active:bg-amber-600 transition-colors"
          style={{ bottom: 'calc(var(--drawer-height, 80px) + 16px)' }}
```

(The FAB is rendered inside `.map-page`, so it inherits the variable.)

- [ ] **Step 3: Convert the mobile control offsets to `calc()`**

In `src/index.css`, inside the mobile `@media` block (~`:424-499`), the current hardcoded offsets encode "80px drawer + gaps". Replace them:

- `.map-page .maplibregl-ctrl-bottom-right` — `bottom: 92px !important;` → `bottom: calc(var(--drawer-height, 80px) + 12px) !important;`
- `.map-page .maplibregl-ctrl-bottom-left` — `bottom: 92px !important;` → `bottom: calc(var(--drawer-height, 80px) + 12px) !important;`
- `.map-page .map-style-control` — `bottom: 140px;` → `bottom: calc(var(--drawer-height, 80px) + 60px);` (12px gap + 48px geolocate group, matching today's 92+48)
- `.map-page.timeline-active .maplibregl-ctrl-bottom-right` — `bottom: 148px !important;` → `bottom: calc(var(--drawer-height, 80px) + 68px) !important;` (+56px timeline pill)
- `.map-page.timeline-active .map-style-control` — `bottom: 196px;` → `bottom: calc(var(--drawer-height, 80px) + 116px);`
- `.map-page.timeline-active .maplibregl-ctrl-bottom-left` — `bottom: 148px !important;` → `bottom: calc(var(--drawer-height, 80px) + 68px) !important;`
- **Delete** the three `.map-page.map-mode-active …` rules (`:492-499`) — map mode's 108px minimized height now flows through the variable, so the special-case offsets are obsolete. (Keep the `.map-mode-active` class on the container — grep `map-mode-active` in `src/` first; if any other rule uses it, leave the class in place and delete only these three rules.)

Update each rule's explanatory comment to say the offset tracks `--drawer-height`.

- [ ] **Step 4: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: both exit 0.

- [ ] **Step 5: Verify (drive the app)**

Run: `npm run dev`, mobile viewport.
Expected: in Map mode (108px drawer) and Route mode with a planned route at peek (210px), the geolocate button, layers control, and OSM attribution all sit just above the drawer's top edge — never behind it; in Timeline mode they clear the timeline pill; in Network mode select a non-sharing portal agency — the amber FAB rides above the drawer.

- [ ] **Step 6: Commit**

```bash
git add src/components/panels/MobileTabDrawer.tsx src/index.css
git commit -m "feat: map controls and FAB track the drawer height via --drawer-height"
```

---

## Slice 4 — Identity peek + Analysis detail

### Task 8: BottomSheet collapses to peek (when a real peek exists)

**Files:**
- Modify: `src/components/common/BottomSheet.tsx` (backdrop `:211`, header tap `:197-203`)

**Interfaces:**
- Produces: collapse actions (backdrop tap, header tap from full) land on `'peek'` whenever `peekHeight > minimizedHeight`, else `'minimized'`. Drag behavior unchanged.

- [ ] **Step 1: Add the collapse target and use it**

In `BottomSheet.tsx`, after `getClosestSnapPoint` (`:94`), add:

```tsx
  // Collapse lands on peek when the mode has a real peek, else minimized —
  // dismissing content should never strand the user on the bare tab row.
  const collapseTarget = useCallback((): SnapPoint => (
    getSnapPointHeight('peek') > getSnapPointHeight('minimized') ? 'peek' : 'minimized'
  ), [getSnapPointHeight]);
```

Change the backdrop (`:211`):

```tsx
        onClick={() => onSnapPointChange?.('minimized')}
```

to:

```tsx
        onClick={() => onSnapPointChange?.(collapseTarget())}
```

Change `handleHeaderTap` (`:197-203`):

```tsx
  const handleHeaderTap = useCallback(() => {
    if (snapPoint === 'full') {
      onSnapPointChange?.(collapseTarget());
    } else {
      onSnapPointChange?.('full');
    }
  }, [snapPoint, onSnapPointChange, collapseTarget]);
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: both exit 0.

- [ ] **Step 3: Verify (drive the app)**

Run: `npm run dev`, mobile viewport, Route mode with a route planned (only mode with a distinct peek until Task 9). Expand to full, tap the dark backdrop.
Expected: the sheet lands on the peek (route preview visible), not the bare tab row. In Map mode (no distinct peek) it still lands on minimized.

- [ ] **Step 4: Commit**

```bash
git add src/components/common/BottomSheet.tsx
git commit -m "feat: bottom sheet collapse lands on peek when the mode has one"
```

---

### Task 9: Identity peek for Route / Analysis / Network

**Files:**
- Modify: `src/components/panels/MobileTabDrawer.tsx` (imports `:8`, `PEEK` + `IdentityRow`, peek heights, snap-on-enter effect, `headerContent` peek block `:191-196`)

**Interfaces:**
- Consumes: `activeMode`/`pendingMode` (Task 2), `peekHeightForMode`/`drawerRestHeight` (Task 7), `handleExpandSheet` (existing `:112`), `FlockHopperCTA` (`variant="row"`), `MobileRoutePreview`.
- Produces: `PEEK` config (`Partial<Record<AppMode, { title, desc, Icon }>>`); `IdentityRow` component (`{ mode: AppMode; onExpand: () => void; extra?: React.ReactNode }`); `MODE_PEEK_HEIGHT` (`Partial<Record<AppMode, number>>`). Tasks 10/11 extend the `IdentityRow` call's `extra` and the peek height expression.

- [ ] **Step 1: Imports**

Extend the lucide import (`:8`) to:

```tsx
import { AlertTriangle, ChevronUp, BarChart3, Navigation2, Share2 } from 'lucide-react';
```

- [ ] **Step 2: Add `PEEK` and `IdentityRow`**

After the `TABS` array (and after Task 6's `DrawerFooter`), add:

```tsx
const PEEK: Partial<Record<AppMode, { title: string; desc: string; Icon: typeof BarChart3 }>> = {
  route:   { title: 'Route', desc: 'Set a start and destination to see ALPR exposure along your route — and safer alternatives.', Icon: Navigation2 },
  density: { title: 'Surveillance Analysis', desc: 'Compare surveillance intensity by state or county. Tap any region to reveal its statistics.', Icon: BarChart3 },
  network: { title: 'Sharing Network', desc: 'See which agencies share ALPR data with each other. Tap an agency to trace its connections.', Icon: Share2 },
};

/** Mode identity at peek. The whole row is the expand affordance — icon,
 *  real title, one-liner, chevron. */
function IdentityRow({ mode, onExpand, extra }: { mode: AppMode; onExpand: () => void; extra?: React.ReactNode }) {
  const cfg = PEEK[mode];
  if (!cfg) return null;
  const Icon = cfg.Icon;
  return (
    <div className="mt-3 animate-fade-in">
      <button
        onClick={onExpand}
        className="w-full flex items-center gap-3 text-left active:opacity-70 transition-opacity min-h-11"
        aria-label={`${cfg.title} — open controls and details`}
      >
        <div className="w-9 h-9 rounded-lg bg-accent-muted border border-accent/30 flex items-center justify-center flex-shrink-0">
          <Icon className="w-[18px] h-[18px] text-accent" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-display font-semibold text-white leading-tight">{cfg.title}</h2>
          <p className="text-xs text-dark-400 leading-snug mt-0.5">{cfg.desc}</p>
        </div>
        <ChevronUp className="w-4 h-4 text-dark-500 flex-shrink-0" aria-hidden="true" />
      </button>
      {extra}
    </div>
  );
}
```

- [ ] **Step 3: Per-mode peek heights**

Next to `minimizedHeight` (`:141`), add the height map and replace Task 7's `peekHeightForMode`:

```tsx
const MODE_PEEK_HEIGHT: Partial<Record<AppMode, number>> = { route: 196, density: 168, network: 140 };
```

(Module scope, next to `PEEK`.) Then change:

```tsx
  const peekHeightForMode = isRoutePeekable ? 210 : minimizedHeight;
```

to:

```tsx
  const peekHeightForMode = MODE_PEEK_HEIGHT[appMode] ?? minimizedHeight;
```

Delete the `isRoutePeekable` declaration (`:138`) — Step 4 removes its last use. If the route preview + CTA visibly clip at 196px during verification, trim the preview's internal margins rather than raising the height (spec: Route stays under 200px).

- [ ] **Step 4: Render the identity row at peek**

In `headerContent`, replace the route-only preview block (`:191-196`):

```tsx
      {isRoutePeekable && snapPoint !== 'minimized' && (
        <div className="mt-3 space-y-3 animate-fade-in">
          <MobileRoutePreview hasRoutes={hasRoutes} onExpand={handleExpandSheet} />
          {snapPoint === 'peek' && <FlockHopperCTA variant="row" />}
        </div>
      )}
```

with:

```tsx
      {snapPoint === 'peek' && (
        appMode === 'route' && hasRoutes ? (
          <div className="mt-3 space-y-3 animate-fade-in">
            <MobileRoutePreview hasRoutes={hasRoutes} onExpand={handleExpandSheet} />
            <FlockHopperCTA variant="row" />
          </div>
        ) : (
          <IdentityRow
            mode={appMode}
            onExpand={handleExpandSheet}
            extra={appMode === 'route' ? <div className="mt-3"><FlockHopperCTA variant="row" /></div> : undefined}
          />
        )
      )}
```

- [ ] **Step 5: Rest at peek when entering an in-scope mode**

After the route auto-expand effect (`:99-107`), add:

```tsx
  // Entering a mode that has an identity peek from the minimized state
  // raises the sheet to peek — covers tab taps AND deep links, and never
  // fights a user who deliberately expanded or is mid-gesture.
  useEffect(() => {
    if (PEEK[appMode] && snapPoint === 'minimized') {
      setSnapPoint('peek');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appMode]);
```

- [ ] **Step 6: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: both exit 0.

- [ ] **Step 7: Verify (drive the app)**

Run: `npm run dev`, mobile viewport.
Expected: tapping **Analysis** raises the sheet to a compact peek: bar-chart icon, "Surveillance Analysis", its one-liner, chevron; tapping the row expands to controls. **Route** peek shows identity + the FlockHopper CTA (or route preview + CTA once a route exists — and still under the 196px height without clipping). **Network** peek shows its identity. **Map/Timeline** behave as before (no identity peek). Deep link `http://localhost:3000/?mode=density` lands resting at the Analysis peek. Dragging down from peek reaches minimized; switching tabs while expanded keeps the sheet expanded. Map controls ride above every peek (Task 7's variable).

- [ ] **Step 8: Commit**

```bash
git add src/components/panels/MobileTabDrawer.tsx
git commit -m "feat: identity peek for Route/Analysis/Network — the row is the expand button"
```

---

### Task 10: Shared `DensityFeatureStats`; popup desktop-only; legend into the peek

**Files:**
- Create: `src/modes/density/DensityFeatureStats.tsx`
- Modify: `src/modes/density/DensityFeaturePopup.tsx` (rewrite around the shared stats)
- Modify: `src/components/map/DensityLegendBar.tsx:12` (desktop-only)
- Modify: `src/components/panels/MobileTabDrawer.tsx` (add `DensityPeekLegend`, wire `extra`)

**Interfaces:**
- Produces: `DensityFeatureStats` (`{ feature: DensityFeatureProperties; onClose?: () => void }`) — region header (level, name, count, optional ✕) + the two `RankTrack`s. `DensityPeekLegend` (no props). Task 11 consumes both.
- Consumes: `DENSITY_COLOR_RAMPS` from `src/components/map/layers/DensityLayers`; `useAppModeStore` (`densitySettings`).

- [ ] **Step 1: Confirm the type import path**

Run: `grep -rn "DensityFeatureProperties" src/types src/store/densityStore.ts`
Use the path the store imports from (expected: `src/types/density`). Match the import in Step 2 to it.

- [ ] **Step 2: Create the shared stats component**

Create `src/modes/density/DensityFeatureStats.tsx` — move `formatCompact`, `RankTrack`, and the content JSX out of `DensityFeaturePopup.tsx` verbatim, with the header gaining an optional ✕:

```tsx
import { X } from 'lucide-react';
import { useAppModeStore } from '../../store';
import { DENSITY_COLOR_RAMPS } from '../../components/map/layers/DensityLayers';
import type { DensityFeatureProperties } from '../../types/density';

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function RankTrack({ label, rank, total, percentile, detail, gradient }: {
  label: string; rank: number | null; total: number; percentile: number; detail: string; gradient: string;
}) {
  const hasData = rank != null && rank > 0;
  return (
    <div>
      <p className="text-2xs text-dark-400 uppercase font-medium mb-2.5">{label}</p>
      {hasData ? (
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <p className="text-2xl font-display font-bold text-white tabular-nums leading-none">#{Math.round(rank)}</p>
            <p className="text-xs text-dark-400 mt-0.5">of {total.toLocaleString()}</p>
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <div className="relative h-2.5 rounded-full overflow-hidden">
              <div className="absolute inset-0 rounded-full" style={{ background: gradient }} />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-dark-900/40"
                style={{ left: `${Math.min(Math.max(percentile, 2), 98)}%`, transform: 'translate(-50%, -50%)', boxShadow: '0 0 6px rgba(255,255,255,0.5)' }}
              />
            </div>
            <p className="text-xs text-dark-400 mt-1.5">{detail}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-dark-400">No cameras</p>
      )}
    </div>
  );
}

/** Region stats body (no card chrome). Used by the desktop popup and the
 *  mobile drawer detail. */
export function DensityFeatureStats({ feature: f, onClose }: { feature: DensityFeatureProperties; onClose?: () => void }) {
  const colorScheme = useAppModeStore((s) => s.densitySettings.colorScheme);
  const trackGradient = DENSITY_COLOR_RAMPS[colorScheme].gradient.replace('90deg', 'to right');
  const total = f.level === 'state' ? 51 : 3222;
  const perCapitaDetail = `${formatCompact(f.population)} pop · ${f.camerasPerCapita.toFixed(2)} per 10K`;
  const hasRoadData = f.roadMiles != null && f.percentilePerRoadMile != null;
  const perMileDetail = hasRoadData
    ? `${formatCompact(f.roadMiles!)} mi · ${(f.camerasPerRoadMile * 1000) >= 10 ? Math.round(f.camerasPerRoadMile * 1000).toLocaleString() : (f.camerasPerRoadMile * 1000).toFixed(1)} per 1K mi`
    : 'Road data unavailable';

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-2xs text-dark-400 uppercase font-medium">{f.level === 'state' ? 'State' : 'County'}</span>
          <p className="text-[15px] font-display font-semibold text-white leading-snug mt-0.5 truncate">{f.name}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex-shrink-0 w-11 h-8 -mr-2 rounded-lg flex items-center justify-center text-dark-400 active:text-dark-200 transition-colors"
            aria-label="Clear selected region"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <p className="text-sm text-accent font-medium tabular-nums mb-4 mt-1">{f.cameraCount.toLocaleString()} camera{f.cameraCount !== 1 ? 's' : ''}</p>
      <div className="border-t border-hairline mb-4" />
      <RankTrack label="Cameras Per Capita" rank={f.rankPerCapita} total={total} percentile={f.percentilePerCapita} detail={perCapitaDetail} gradient={trackGradient} />
      <div className="border-t border-hairline my-4" />
      <RankTrack label="Cameras Per Road Mile" rank={f.rankPerRoadMile} total={total} percentile={f.percentilePerRoadMile ?? 0} detail={perMileDetail} gradient={trackGradient} />
    </div>
  );
}
```

- [ ] **Step 3: Rewrite the popup as a thin desktop card**

Replace the body of `DensityFeaturePopup.tsx` so it keeps only selection state, Escape handling, and the desktop card (delete `formatCompact`, `RankTrack`, the `isMobile` state/effect, and the mobile fixed-card return):

```tsx
import { useEffect, useCallback } from 'react';
import { useDensityStore } from '../../store/densityStore';
import { DensityFeatureStats } from './DensityFeatureStats';

export function DensityFeaturePopup() {
  const selectedFeature = useDensityStore((s) => s.selectedFeature);
  const setSelectedFeature = useDensityStore((s) => s.setSelectedFeature);

  const handleClose = useCallback(() => {
    setSelectedFeature(null);
  }, [setSelectedFeature]);

  useEffect(() => {
    if (!selectedFeature) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedFeature, handleClose]);

  if (!selectedFeature) return null;

  return (
    <div className="absolute bottom-6 right-6 z-20 w-80 bg-dark-900/95 border border-hairline rounded-lg hidden lg:block">
      <div className="p-4">
        <DensityFeatureStats feature={selectedFeature} onClose={handleClose} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Make the on-map legend bar desktop-only**

In `DensityLegendBar.tsx:12`:

```tsx
    <div className="absolute bottom-4 left-4 z-20">
```

→

```tsx
    <div className="absolute bottom-4 left-4 z-20 hidden lg:block">
```

- [ ] **Step 5: Add `DensityPeekLegend` and wire it into the Analysis peek**

In `MobileTabDrawer.tsx`, add imports:

```tsx
import { DENSITY_COLOR_RAMPS } from '../map/layers/DensityLayers';
```

Near `IdentityRow`, add:

```tsx
/** Slim gradient legend inside the Analysis peek (replaces the floating
 *  legend bar on mobile). */
function DensityPeekLegend() {
  const { densitySettings } = useAppModeStore();
  const label = densitySettings.metric === 'perCapita' ? 'Cameras per 10K residents' : 'Cameras per road mile';
  const gradient = DENSITY_COLOR_RAMPS[densitySettings.colorScheme].gradient.replace('90deg', 'to right');
  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <span className="text-2xs text-dark-500 uppercase">Low</span>
        <div className="h-2 rounded-full flex-1" style={{ background: gradient }} />
        <span className="text-2xs text-dark-500 uppercase">High</span>
      </div>
      <p className="text-[10px] text-dark-500 mt-1">{label}</p>
    </div>
  );
}
```

Update the `IdentityRow` call from Task 9 Step 4 — the `extra` prop becomes:

```tsx
            extra={
              appMode === 'route'
                ? <div className="mt-3"><FlockHopperCTA variant="row" /></div>
                : appMode === 'density'
                  ? <DensityPeekLegend />
                  : undefined
            }
```

- [ ] **Step 6: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: both exit 0.

- [ ] **Step 7: Verify (drive the app)**

Run: `npm run dev`.
Expected — mobile viewport, Analysis: the peek shows identity + the slim gradient legend; **no** floating legend bar; tapping a region does NOT yet show a fixed card (mobile card is gone; drawer detail arrives in Task 11 — selected regions highlight on the map only). Desktop ≥1024px: tapping a region shows the floating card (hairline-styled, ✕ and Escape both clear); corner legend bar present.

- [ ] **Step 8: Commit**

```bash
git add src/modes/density/DensityFeatureStats.tsx src/modes/density/DensityFeaturePopup.tsx src/components/map/DensityLegendBar.tsx src/components/panels/MobileTabDrawer.tsx
git commit -m "feat: shared density stats; popup + legend bar desktop-only; legend in peek"
```

---

### Task 11: Analysis region detail in the drawer (mid-height, map stays visible)

**Files:**
- Modify: `src/components/panels/MobileTabDrawer.tsx` (selection subscription, detail height, snap effect, `headerContent` density branch, density body)

**Interfaces:**
- Consumes: `DensityFeatureStats`/`DensityPeekLegend` (Task 10), `peekHeightForMode`/`drawerRestHeight` (Tasks 7/9), `useDensityStore` (`selectedFeature`, `setSelectedFeature`).

- [ ] **Step 1: Subscribe to the selection**

Near the other density store reads (`:56`), add:

```tsx
  const selectedDensityFeature = useDensityStore(s => s.selectedFeature);
  const setSelectedDensityFeature = useDensityStore(s => s.setSelectedFeature);
```

- [ ] **Step 2: Detail height folds into the peek expression**

Replace Task 9's `peekHeightForMode` line with:

```tsx
  // A selected Analysis region raises the peek to a detail height that fits
  // the stats while keeping the map (and the tapped region) visible above.
  const isDensityDetail = appMode === 'density' && !!selectedDensityFeature;
  const densityDetailHeight = Math.min(430, Math.round(window.innerHeight * 0.62));
  const peekHeightForMode = isDensityDetail
    ? densityDetailHeight
    : (MODE_PEEK_HEIGHT[appMode] ?? minimizedHeight);
```

(`BottomSheet` re-animates when `peekHeight` changes while resting at peek — its snap effect depends on `getSnapPointHeight`.)

- [ ] **Step 3: Selecting a region raises the sheet to the detail peek**

After the peek-on-enter effect (Task 9 Step 5), add:

```tsx
  // Tapping a region on the map surfaces its stats at the detail peek.
  // Clearing (✕, empty-map tap, Escape) shrinks back automatically via
  // peekHeightForMode; we only force the snap up, never down.
  useEffect(() => {
    if (appMode === 'density' && selectedDensityFeature) {
      setSnapPoint('peek');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDensityFeature, appMode]);
```

- [ ] **Step 4: Render the stats at the detail peek**

In `headerContent`, extend the Task 9/10 peek block — the density branch shows stats instead of the identity row while a region is selected. Replace the block from Task 9 Step 4 with:

```tsx
      {snapPoint === 'peek' && (
        appMode === 'route' && hasRoutes ? (
          <div className="mt-3 space-y-3 animate-fade-in">
            <MobileRoutePreview hasRoutes={hasRoutes} onExpand={handleExpandSheet} />
            <FlockHopperCTA variant="row" />
          </div>
        ) : isDensityDetail ? (
          <div className="mt-3 animate-fade-in">
            <DensityFeatureStats
              feature={selectedDensityFeature!}
              onClose={() => setSelectedDensityFeature(null)}
            />
            <DensityPeekLegend />
          </div>
        ) : (
          <IdentityRow
            mode={appMode}
            onExpand={handleExpandSheet}
            extra={
              appMode === 'route'
                ? <div className="mt-3"><FlockHopperCTA variant="row" /></div>
                : appMode === 'density'
                  ? <DensityPeekLegend />
                  : undefined
            }
          />
        )
      )}
```

- [ ] **Step 5: Show the stats at full height too**

In `renderTabContent`'s **density** case, above the description paragraph, add:

```tsx
            {selectedDensityFeature && (
              <div className="mb-5 pb-5 border-b border-hairline">
                <DensityFeatureStats
                  feature={selectedDensityFeature}
                  onClose={() => setSelectedDensityFeature(null)}
                />
              </div>
            )}
```

(So expanding from the detail peek to full keeps the stats in view at the top of the controls.)

- [ ] **Step 6: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: both exit 0.

- [ ] **Step 7: Verify (drive the app)**

Run: `npm run dev`, mobile viewport, Analysis mode.
Expected: tapping a region raises the sheet to ~60% height showing level, name, camera count, both rank tracks, and the legend — the map and tapped region remain visible above; tapping another region swaps the stats in place; ✕ clears and the sheet shrinks to the identity peek; tapping empty map area clears too; dragging up from the detail goes to full with the stats at the top of the controls; drag down → minimized still works. On a 390×844 viewport the two rank tracks fit without clipping (if not, reduce the 0.62 factor is NOT the fix — tighten `DensityFeatureStats` margins). Map controls ride above the detail sheet (Task 7 variable). Desktop unchanged.

- [ ] **Step 8: Commit**

```bash
git add src/components/panels/MobileTabDrawer.tsx
git commit -m "feat: Analysis region stats in a mid-height drawer detail — map stays visible"
```

---

## Self-review notes

- **Spec coverage:** instant tabs (Task 2), MapPage pan re-render (Task 1), active-mode-only content (already true; asserted in Task 2 verify), tokens (Task 3-4), underline tabs (Task 4), slim header w/ logo+count+share (Task 6), hamburger deletion (Task 6), legacy link → footer (Task 6), single count (Tasks 1+6), `dvh` fallback (Task 5), `--drawer-height` offsets + attribution/geolocate (Task 7), network FAB (Task 7), collapse-to-peek (Task 8), identity peek + copy + heights + deep-link (Task 9), shared stats/popup/legend (Task 10), detail sheet + ✕ + full-height stats (Task 11), ≥44px touch targets (icon share `w-11`, identity row `min-h-11`, tab `min-w-11`, FAB `w-11 h-11`, stats ✕ `w-11`).
- **Sequencing:** Task 4 reads `activeMode` (Task 2). Task 6 reuses `HeaderCameraCount` (Task 1) and `hairline` (Task 3). Task 9 replaces Task 7's `peekHeightForMode` expression; Task 11 replaces Task 9's. Task 11 replaces Task 9's peek block via the Task 10-extended version — each replacement block is shown in full at its task, so out-of-order reading still works.
- **Type consistency:** `IdentityRow`, `DrawerFooter`, `DensityPeekLegend`, `DensityFeatureStats { feature, onClose? }`, `PEEK`, `MODE_PEEK_HEIGHT`, `peekHeightForMode`, `drawerRestHeight`, `--drawer-height`, ShareButton `'icon'` — names match across all tasks.
- **Known judgment calls:** double-rAF over `startTransition` (zustand de-opts transitions); `--drawer-height` parks at peek height while full (controls sit behind the sheet then); route peek fixed at 196px with a "trim margins, don't raise" rule.
