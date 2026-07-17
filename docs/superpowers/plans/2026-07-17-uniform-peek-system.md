# Uniform Peek System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route/Timeline/Analysis/Network all rest at one shared peek height; the timeline scrubber moves from a floating pill into the Timeline peek (which becomes that mode's floor); Network's peek explains the mode and carries agency search.

**Architecture:** One `UNIFORM_PEEK_HEIGHT` constant replaces per-mode peek heights (Analysis's dynamic detail height stays layered on top). `TimelineBar` gains `bare`/`showCount` props so the drawer reuses the exact desktop scrubber (no forked playback logic); explore's `minimizedHeight` is set equal to the peek so the lower snap collapses out of `BottomSheet`'s snap set, and an `effectiveSnap` normalization keeps rendering correct when a drag lands on the (equal-height) `minimized` label. Network gets a search facade in the peek that expands the sheet and focuses the real input, plus a selected-agency summary mirroring the Analysis-region pattern.

**Tech Stack:** React 18 + TypeScript, Tailwind, framer-motion (`BottomSheet`), Zustand, lucide-react.

**Spec:** `docs/superpowers/specs/2026-07-17-uniform-peek-system-design.md`

## Global Constraints

- No frontend test framework. Per-task verify: `npm run build` exits 0; `npm run lint` at the 18-problem pre-existing baseline (exit 1 from 5 pre-existing `worker/` errors IS the baseline), zero NEW problems; then drive the app (`npm run dev`, port 3000, Chrome DevTools / Playwright at 390×844).
- `UNIFORM_PEEK_HEIGHT = 172` is the single shared value. If content doesn't fit with ≥6px clearance below the last element, tune SPACING (margins/paddings) — never fork the height per mode. Analysis region-detail (`min(430, 62vh)`) remains the only taller peek.
- Exact copy (verbatim):
  - Analysis description: **"Tap any state or county to reveal its statistics."**
  - Network description: **"See which agencies share ALPR data with each other. Tap an agency node to trace its connections."**
  - Timeline identity (heatmap visualization only): title **"Timeline"**, description **"Watch ALPR camera deployment grow over time."**
  - Timeline caption micro-label: **"Cameras over time"**; Network peek cue: **"Swipe up for details"**.
- Route peek gets NO swipe-up affordance or hint.
- Desktop (≥1024px) behavior and the desktop `TimelineBar` wrapper unchanged. Embed mode, US-only gating, routing/data logic unchanged. Map mode's drawer untouched (108px hint row stays).
- Playback must continue and the ticker must stay registered when the sheet is at `full` in Timeline mode (the scrubber block hides visually but must NOT unmount — `useTimelineTicker` lives inside `TimelineBar`).
- The working tree has uncommitted USER changes in `src/components/map/layers/CameraMarkerLayers.tsx` and `CameraTileLayers.tsx` — never touch or stage them; stage only files each task names.
- Commit after every task.

---

### Task 1: Uniform height, Route store buttons, Analysis copy

**Files:**
- Modify: `src/components/panels/MobileTabDrawer.tsx` (`MODE_PEEK_HEIGHT` `:62`, `PEEK.density` `:58`, `peekHeightForMode` `:236-240`, route peek block `:282-287`)
- Modify: `src/components/panels/FlockHopperCTA.tsx` (line variant gains `noAction`)

**Interfaces:**
- Produces: `UNIFORM_PEEK_HEIGHT` (module const, `172`) — Tasks 2/3 reference it. `FlockHopperCTA` accepts `noAction?: boolean` (line variant only: omits the "Get the app" pill).

- [ ] **Step 1: `noAction` on the CTA line variant**

In `FlockHopperCTA.tsx`, widen the props and thread the flag:

```tsx
interface FlockHopperCTAProps {
  variant: 'card' | 'row' | 'line';
  /** Line variant only: omit the trailing "Get the app" pill (used when
   *  store buttons render directly beneath the line). */
  noAction?: boolean;
  /** Card variant only */
  title?: string;
  /** Card variant only */
  description?: string;
}

export function FlockHopperCTA({ variant, noAction, title, description }: FlockHopperCTAProps) {
```

In the `line` branch, wrap the pill span:

```tsx
        {!noAction && (
          <span className="px-3 py-2 rounded-lg bg-accent text-white text-xs font-bold flex-shrink-0">Get the app</span>
        )}
```

(Everything else in the line branch unchanged — the whole line stays a store link either way.)

- [ ] **Step 2: One height to rule them all**

In `MobileTabDrawer.tsx`, replace the `MODE_PEEK_HEIGHT` line (`:62`):

```tsx
const MODE_PEEK_HEIGHT: Partial<Record<AppMode, number>> = { route: 122, density: 168, network: 140 };
```

with:

```tsx
/** One resting height for every content-mode peek — the sheet never changes
 *  height switching among Route/Timeline/Analysis/Network. Tune spacing to
 *  fit content, never this number per-mode. */
const UNIFORM_PEEK_HEIGHT = 172;
const PEEK_MODES: ReadonlySet<AppMode> = new Set(['route', 'explore', 'density', 'network']);
```

Replace the `peekHeightForMode` expression (`:236-240`):

```tsx
  const peekHeightForMode = isDensityDetail
    ? densityDetailHeight
    : appMode === 'route' && hasRoutes
      ? 186 // route preview + slim FlockHopper line, measured in-browser (390x844 viewport)
      : (MODE_PEEK_HEIGHT[appMode] ?? minimizedHeight);
```

with:

```tsx
  const peekHeightForMode = isDensityDetail
    ? densityDetailHeight
    : PEEK_MODES.has(appMode)
      ? UNIFORM_PEEK_HEIGHT
      : minimizedHeight;
```

(Explore joins for real in Task 2 — until then explore's peek content is still empty but its height is already uniform; that half-state lasts one task and ships fine because explore still rests at `minimized` until Task 2 registers it as peekable.)

- [ ] **Step 3: Route peek — buttons when there's no route**

Extend the FlockHopper import (`:12`):

```tsx
import { FlockHopperCTA, FlockHopperStoreButtons } from './FlockHopperCTA';
```

Replace the route branch of the peek block (`:283-287`):

```tsx
        appMode === 'route' ? (
          <div className="mt-3 space-y-3 animate-fade-in">
            {hasRoutes && <MobileRoutePreview hasRoutes={hasRoutes} onExpand={handleExpandSheet} />}
            <FlockHopperCTA variant="line" />
          </div>
        ) : isDensityDetail ? (
```

with:

```tsx
        appMode === 'route' ? (
          <div className="mt-3 space-y-2.5 animate-fade-in">
            {hasRoutes ? (
              <>
                <MobileRoutePreview hasRoutes={hasRoutes} onExpand={handleExpandSheet} />
                <FlockHopperCTA variant="line" />
              </>
            ) : (
              <>
                <FlockHopperCTA variant="line" noAction />
                <FlockHopperStoreButtons />
              </>
            )}
          </div>
        ) : isDensityDetail ? (
```

- [ ] **Step 4: Analysis copy**

In the `PEEK` config (`:58`), change the density description to the exact string:

```tsx
  density: { title: 'Surveillance Analysis', desc: 'Tap any state or county to reveal its statistics.', Icon: BarChart3 },
```

- [ ] **Step 5: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: build exit 0; lint at the 18-problem baseline, zero new.

- [ ] **Step 6: Verify (drive the app, 390×844)**

- Route (no route): peek shows the FlockHopper line WITHOUT the pill + App Store / Android Beta buttons; no swipe-up hint anywhere in the peek; whole line still opens the store link; each button opens its store link.
- Route (plan a route, e.g. two nearby city searches): preview + line WITH the pill; same 172px sheet height (measure `getBoundingClientRect` — sheet height must equal Analysis's and Network's).
- Analysis peek: icon + "Surveillance Analysis" + the new one-line description + legend; height 172.
- Network peek: unchanged content this task; height 172.
- All four peeks: last element has ≥6px clearance; if any clips, tighten that mode's internal margins (e.g. `mt-3`→`mt-2`, `space-y-2.5`→`space-y-2`) — do not change `UNIFORM_PEEK_HEIGHT`.

- [ ] **Step 7: Commit**

```bash
git add src/components/panels/MobileTabDrawer.tsx src/components/panels/FlockHopperCTA.tsx
git commit -m "feat: uniform 172px peek; route peek gains store buttons; tighter analysis copy"
```

---

### Task 2: Timeline scrubber into the peek; peek becomes Timeline's floor

**Files:**
- Modify: `src/modes/timeline/TimelineBar.tsx` (props `:18`, root row `:150`, count span `:195-198`)
- Modify: `src/components/panels/MobileTabDrawer.tsx` (imports, `PEEK` explore entry, `minimizedHeight` `:227`, `effectiveSnap`, explore peek block, `StopSheetDrag`)
- Modify: `src/pages/MapPage.tsx` (timeline wrapper `:463-475`, `timeline-active` class `:321`)
- Modify: `src/index.css` (delete the three `.timeline-active` rules `:475-488`)

**Interfaces:**
- Consumes: `UNIFORM_PEEK_HEIGHT` (Task 1), `IdentityRow`, `handleExpandSheet`, `effectiveSnap` conditions.
- Produces: `TimelineBar` accepts `{ bare?: boolean; showCount?: boolean }`; `effectiveSnap` (drawer-local) — Task 3 reads the same conditions.

- [ ] **Step 1: `bare` / `showCount` props on TimelineBar**

In `TimelineBar.tsx:18`, change the signature:

```tsx
export function TimelineBar({ bare = false, showCount = false }: { bare?: boolean; showCount?: boolean } = {}) {
```

Root row (`:150`) — make the horizontal padding conditional:

```tsx
    <div className={`flex items-center gap-2 lg:gap-3 h-full select-none ${bare ? '' : 'px-3 lg:px-4'}`}>
```

Date/count span (`:195-198`) — widen and unhide the count when `showCount`:

```tsx
      <span className={`flex-shrink-0 text-[11px] sm:text-xs lg:text-sm text-white/90 tabular-nums font-mono tracking-tight whitespace-nowrap text-right ${showCount ? 'w-[150px]' : 'w-[84px] sm:w-[92px]'} lg:w-[180px]`}>
        {dateLabel}
        <span className={`${showCount ? 'inline' : 'hidden lg:inline'} text-white/30`}> · {cumulativeCount.toLocaleString()}</span>
      </span>
```

(Desktop renders `<TimelineBar />` with no props — both defaults false — so nothing changes there.)

- [ ] **Step 2: Delete the mobile floating pill**

In `MapPage.tsx:463-475`, the wrapper currently renders for both breakpoints:

```tsx
            {/* Timeline Bar — single instance, wrapper switches on breakpoint */}
            {isExploreMode && (
              <div className={isMobile
                ? "timeline-bar-mobile fixed left-3 right-3 z-[51] h-12 bg-dark-900/70 backdrop-blur-xl rounded-xl border border-white/[0.06] shadow-lg shadow-black/30"
                : "timeline-bar-desktop absolute bottom-4 left-4 right-20 z-20 h-14 bg-dark-900/70 backdrop-blur-xl rounded-xl border border-white/[0.06] shadow-lg shadow-black/30"
              }
              // 84px clears the BottomSheet's minimized height; the inset keeps the
              // bar off the iOS home indicator on notched phones.
              style={isMobile ? { bottom: 'calc(84px + env(safe-area-inset-bottom))' } : undefined}
              >
                <TimelineBar />
              </div>
            )}
```

Replace with a desktop-only wrapper (the mobile scrubber lives in the drawer now):

```tsx
            {/* Timeline Bar — desktop only; on mobile the scrubber lives in the drawer peek */}
            {isExploreMode && !isMobile && (
              <div className="timeline-bar-desktop absolute bottom-4 left-4 right-20 z-20 h-14 bg-dark-900/70 backdrop-blur-xl rounded-xl border border-white/[0.06] shadow-lg shadow-black/30">
                <TimelineBar />
              </div>
            )}
```

At `:321`, remove `${isExploreMode ? 'timeline-active' : ''}` from the container className. First run `grep -rn "timeline-active" src/` — after the index.css deletions in Step 3 the only remaining reference must be this className; if anything else still uses it, STOP and report instead of deleting.

- [ ] **Step 3: Delete the `.timeline-active` offset rules**

In `src/index.css` (`:475-488`), delete the comment block and all three rules:

```css
  /* Timeline bar active — push controls up by 56px to clear the floating pill.
     Offset tracks --drawer-height + 68px (12px gap + 56px timeline pill). */
  .map-page.timeline-active .maplibregl-ctrl-bottom-right { ... }
  .map-page.timeline-active .map-style-control { ... }
  .map-page.timeline-active .maplibregl-ctrl-bottom-left { ... }
```

(The base `calc(var(--drawer-height, 80px) + …)` rules now cover explore — the drawer height variable carries the scrubber peek.)

- [ ] **Step 4: Register explore as peekable; floor at the peek**

In `MobileTabDrawer.tsx`:

Imports — add `History` to the lucide import (`:9`) and the bar:

```tsx
import { AlertTriangle, ChevronUp, BarChart3, Navigation2, Share2, History } from 'lucide-react';
import { TimelineBar } from '../../modes/timeline/TimelineBar';
```

`PEEK` config — add the explore entry (used by the rest-at-peek effect for all visualizations, and by `IdentityRow` when the heatmap visualization is active):

```tsx
  explore: { title: 'Timeline', desc: 'Watch ALPR camera deployment grow over time.', Icon: History },
```

`minimizedHeight` (`:227`) — explore's floor is the peek:

```tsx
  // Map mode's minimized header carries the swipe-up hint row. Explore's
  // floor IS the peek (scrubber always visible), so its minimized height
  // equals the peek height and the lower snap collapses out of the sheet.
  const minimizedHeight = appMode === 'map' ? 108 : appMode === 'explore' ? UNIFORM_PEEK_HEIGHT : 80;
```

Directly below `handleExpandSheet` (`:179`), add the normalization:

```tsx
  // With minimized === peek (explore), a drag can land on the 'minimized'
  // label at the same height — normalize so rendering treats it as peek.
  const effectiveSnap: SnapPoint = appMode === 'explore' && snapPoint === 'minimized' ? 'peek' : snapPoint;
```

- [ ] **Step 5: `StopSheetDrag` — the scrubber must not drag the sheet**

framer-motion's sheet drag listens for NATIVE pointerdown on the drag header, so a React-synthetic `stopPropagation` (which runs at the React root) fires too late. Add this next to `DrawerFooter`:

```tsx
/** Native pointerdown isolation: children (the timeline scrubber) own their
 *  pointer gestures; without this the BottomSheet's framer-motion drag
 *  handler (native listener on the header) would also move the sheet. */
function StopSheetDrag({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = (e: PointerEvent) => e.stopPropagation();
    el.addEventListener('pointerdown', stop);
    return () => el.removeEventListener('pointerdown', stop);
  }, []);
  return <div ref={ref}>{children}</div>;
}
```

- [ ] **Step 6: The explore peek block (always mounted, hidden at full)**

In `headerContent`, change the generic peek gate (`:282`) from:

```tsx
      {snapPoint === 'peek' && (
```

to (explore gets its own block; others also read the normalized snap):

```tsx
      {appMode === 'explore' && (
        <div className={`mt-3 animate-fade-in ${effectiveSnap === 'full' ? 'hidden' : ''}`}>
          {mapVisualization === 'heatmap' ? (
            <IdentityRow mode="explore" onExpand={handleExpandSheet} />
          ) : (
            <>
              <StopSheetDrag>
                <div className="h-12"><TimelineBar bare showCount /></div>
              </StopSheetDrag>
              <p className="text-2xs text-dark-500 uppercase mt-1">Cameras over time</p>
            </>
          )}
        </div>
      )}
      {appMode !== 'explore' && effectiveSnap === 'peek' && (
```

The `hidden`-not-unmounted wrapper is deliberate: `TimelineBar` hosts `useTimelineTicker` — unmounting it at `full` would silently stop playback. Do not "simplify" it to conditional rendering.

Also update the map-hint gate (`:276`) to the normalized snap for consistency: `{appMode === 'map' && effectiveSnap === 'minimized' && (`.

- [ ] **Step 7: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: build exit 0; lint at the 18-problem baseline, zero new.

- [ ] **Step 8: Verify (drive the app, 390×844)**

- Tap Timeline: NO floating pill anywhere; the sheet rests at 172 showing play + sparkline + scrubber + date · count, "CAMERAS OVER TIME" caption beneath.
- Press play: dots animate; date/count advance. Drag the scrubber: date follows the finger and the SHEET DOES NOT MOVE. Drag the grab handle: the sheet moves and the timeline does not scrub.
- Drag the sheet down hard: it stops at the scrubber (never a bare tab row). Drag up to full: explore controls panel; playback keeps running (watch the map dots continue); drag back down: scrubber reappears mid-playback with the advanced date.
- Switch layer to Heatmap (in the expanded panel): collapse to peek → identity row ("Timeline" / "Watch ALPR camera deployment grow over time.") instead of a dead scrubber; switch back to dots → scrubber returns.
- Map controls + attribution ride above the 172 sheet in explore (no +56 ghost offsets).
- Deep link `/timeline`: rests at the scrubber peek.
- Desktop 1280×800: floating TimelineBar bottom bar unchanged, speed button present.

- [ ] **Step 9: Commit**

```bash
git add src/modes/timeline/TimelineBar.tsx src/components/panels/MobileTabDrawer.tsx src/pages/MapPage.tsx src/index.css
git commit -m "feat: timeline scrubber lives in the drawer peek — floating pill removed, peek is the floor"
```

---

### Task 3: Network peek — explanation, agency search, selected summary

**Files:**
- Modify: `src/components/panels/NetworkPanelContent.tsx` (export `TYPE_LABELS` `:11`, search input id `:198`)
- Modify: `src/components/panels/MobileTabDrawer.tsx` (`PEEK.network` desc, `NetworkPeekSearch` + `NetworkPeekSummary`, network `extra`, raise-on-select effect)

**Interfaces:**
- Consumes: `useNetworkStore` (`selectedNode`, `setSelectedNodeId`), `TYPE_LABELS` (exported here), `handleExpandSheet`, `effectiveSnap` (Task 2), Search/X icons.
- Produces: search input DOM id `network-agency-search` (focused by the peek facade).

- [ ] **Step 1: Export the type labels; id the search input**

In `NetworkPanelContent.tsx:11`, change `const TYPE_LABELS` to `export const TYPE_LABELS`.

At the search `<input`, add the id:

```tsx
            <input
              id="network-agency-search"
```

(No other change to the full panel.)

- [ ] **Step 2: Network copy**

In `MobileTabDrawer.tsx`, `PEEK.network` gets the exact two-sentence description:

```tsx
  network: { title: 'Sharing Network', desc: 'See which agencies share ALPR data with each other. Tap an agency node to trace its connections.', Icon: Share2 },
```

- [ ] **Step 3: Peek search facade + selected-agency summary**

Add imports:

```tsx
import { Search, X } from 'lucide-react';
import { TYPE_LABELS } from './NetworkPanelContent';
```

(`Search`/`X` merge into the existing lucide import line.) Add `setSelectedNodeId` next to the existing network store reads (`:132-134`):

```tsx
  const setSelectedNodeId = useNetworkStore(s => s.setSelectedNodeId);
```

Add the two components next to `DensityPeekLegend`:

```tsx
/** Peek search facade: looks like the input, but a tap expands the sheet and
 *  focuses the real search (a 172px peek and the soft keyboard can't coexist). */
function NetworkPeekSearch({ onExpand }: { onExpand: () => void }) {
  return (
    <button
      onClick={() => {
        onExpand();
        // Focus after the expand animation has begun and the panel is mounted
        requestAnimationFrame(() => requestAnimationFrame(() => {
          document.getElementById('network-agency-search')?.focus();
        }));
      }}
      className="mt-3 w-full h-10 px-3 flex items-center gap-2 rounded-lg border border-hairline text-left active:bg-dark-800 transition-colors"
      aria-label="Search agencies"
    >
      <Search className="w-3.5 h-3.5 text-dark-500" aria-hidden="true" />
      <span className="text-xs text-dark-500 flex-1">Search agencies…</span>
      <span className="text-2xs text-dark-600 uppercase">Swipe up for details</span>
    </button>
  );
}

/** Selected agency at peek — name, type, key counts; ✕ clears (same pattern
 *  as Analysis regions). */
function NetworkPeekSummary({ onExpand, onClear }: { onExpand: () => void; onClear: () => void }) {
  const node = useNetworkStore(s => s.selectedNode);
  const adjacency = useNetworkStore(s => s.adjacency);
  if (!node) return null;
  const connections = adjacency[node.id]?.length ?? node.connectionCount;
  return (
    <div className="mt-3 animate-fade-in">
      <div className="flex items-start gap-3">
        <button onClick={onExpand} className="flex-1 min-w-0 text-left active:opacity-70 transition-opacity" aria-label={`${node.name} — open details`}>
          <p className="text-[15px] font-display font-semibold text-white leading-snug truncate">{node.name}</p>
          <p className="text-2xs text-dark-400 uppercase mt-0.5">{TYPE_LABELS[node.type]} · {node.state}</p>
          <p className="text-xs text-dark-400 mt-1.5 tabular-nums">
            {connections.toLocaleString()} connection{connections !== 1 ? 's' : ''}
            {node.isPortal && node.cameras > 0 && <> · {node.cameras.toLocaleString()} cameras</>}
          </p>
        </button>
        <button
          onClick={onClear}
          className="flex-shrink-0 w-11 h-8 -mr-2 rounded-lg flex items-center justify-center text-dark-400 active:text-dark-200 transition-colors"
          aria-label="Clear selected agency"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire the network branch of the peek block**

In the non-explore peek block (Task 2's `{appMode !== 'explore' && effectiveSnap === 'peek' && (`), extend the chain — after the `isDensityDetail` branch, add a network-selected branch, and give network's `IdentityRow` the search facade as `extra`:

```tsx
        ) : appMode === 'network' && selectedNode ? (
          <NetworkPeekSummary
            onExpand={handleExpandSheet}
            onClear={() => setSelectedNodeId(null)}
          />
        ) : (
          <IdentityRow
            mode={appMode}
            onExpand={handleExpandSheet}
            extra={
              appMode === 'density'
                ? <DensityPeekLegend />
                : appMode === 'network'
                  ? <NetworkPeekSearch onExpand={handleExpandSheet} />
                  : undefined
            }
          />
        )
```

- [ ] **Step 5: Raise on agency selection (never yank down)**

After the density-selection effect (`:169-174`), add:

```tsx
  // Tapping an agency node surfaces its summary at the peek. Only ever
  // raises — same contract as the Analysis-region effect above.
  useEffect(() => {
    if (appMode === 'network' && selectedNode && snapPoint !== 'full') {
      setSnapPoint('peek');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode, appMode]);
```

(If lint flags the disable directive as unused, remove the directive.)

- [ ] **Step 6: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: build exit 0; lint at the 18-problem baseline, zero new.

- [ ] **Step 7: Verify (drive the app, 390×844)**

- Network peek: icon + "Sharing Network" + both explanation sentences + the search facade with the "SWIPE UP FOR DETAILS" cue; sheet height 172 (equal to Route/Analysis).
- Tap the facade: sheet expands to full AND the real search input has focus (soft keyboard up on device; in Playwright assert `document.activeElement.id === 'network-agency-search'`).
- Collapse; tap an agency node on the map: peek swaps to name / type · state / counts; tapping the text expands to the full details; ✕ returns to the explanatory peek and clears the map selection (arcs gone).
- Non-sharing portal agency: the amber FAB still rides above the 172 peek.
- Analysis/Route peeks unaffected; desktop network panel unchanged.

- [ ] **Step 8: Commit**

```bash
git add src/components/panels/NetworkPanelContent.tsx src/components/panels/MobileTabDrawer.tsx
git commit -m "feat: network peek explains the mode, carries agency search + selected summary"
```

---

### Task 4: Cross-mode uniformity verification and spacing tune

**Files:**
- Modify (only if measurements demand spacing tweaks): `src/components/panels/MobileTabDrawer.tsx`

**Interfaces:** none — this is the consolidated drive-and-measure pass.

- [ ] **Step 1: Measure all four peeks**

`npm run dev`, Playwright 390×844. For each of Route (no route), Route (with route), Timeline (dots), Timeline (heatmap identity), Analysis, Network (unselected), Network (selected): record sheet `getBoundingClientRect().height` and the gap between the last content element's bottom and the sheet's visible bottom edge.
Expected: every sheet height identical (172 + safe-area padding); every gap ≥6px and ≤24px.

- [ ] **Step 2: Tune spacing where needed**

Fix any clip (<6px) or dead zone (>24px) by adjusting that branch's margins (`mt-*`, `space-y-*`, caption `mt-*`) in `MobileTabDrawer.tsx` only. `UNIFORM_PEEK_HEIGHT` may change ONLY globally (all modes together) and only within 164–180.

- [ ] **Step 3: Gesture + regression sweep**

- Tab across all five tabs at rest: the sheet height animates only entering/leaving Map.
- Timeline: scrub vs sheet-drag isolation (both directions); playback across full↔peek transitions.
- Analysis region detail + ✕; Network agency summary + ✕; backdrop collapse from full lands on peek in all four modes.
- Map mode: untouched 108px hint row.
- Desktop 1280×800: side panels, floating TimelineBar, density popup, legend bar all unchanged.

- [ ] **Step 4: Verify build + lint, commit (if changes)**

Run: `npm run build && npm run lint` — baseline, zero new.

```bash
git add src/components/panels/MobileTabDrawer.tsx
git commit -m "polish: peek spacing tuned to uniform height across modes"
```

(Skip the commit if Step 2 required no changes.)

---

## Self-review notes

- **Spec coverage:** shared height (T1), route buttons/no-hint (T1), analysis copy (T1), scrubber into peek + pill deletion + floor-at-peek + `.timeline-active` cleanup + heatmap identity fallback (T2), network copy/search/cue/selected summary + keyboard-expand (T3), uniformity measurement + gesture isolation + playback-at-full (T2 §8, T4). Map deferred ✓; desktop untouched ✓.
- **Traps documented in-task:** ticker unmount (T2 §6 `hidden` wrapper), native-listener drag isolation (T2 §5), equal-height snap normalization (`effectiveSnap`, T2 §4), keyboard-vs-peek (T3 facade).
- **Type consistency:** `UNIFORM_PEEK_HEIGHT`/`PEEK_MODES` (T1) consumed in T2; `effectiveSnap` (T2) consumed by T3's peek-block wiring; `TimelineBar { bare, showCount }` matches its call site; `setSelectedNodeId(null)` matches `networkStore.ts:90`; `TYPE_LABELS` export matches the import.
- **Judgment calls:** explore identity copy fixed here (spec left it open); `PEEK_MODES` set instead of keying off `PEEK` (route/explore render custom content, so presence-in-`PEEK` and has-uniform-height are deliberately the same set — the set makes it explicit).
