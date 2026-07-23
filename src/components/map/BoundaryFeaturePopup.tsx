import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useBoundaryStore } from '../../store/boundaryStore';

/**
 * Small identity card for the boundaries overlay. Shows the name + context of
 * the boundary under the cursor (hover) or the one clicked/tapped (pinned).
 * Sits top-left of the map so it never collides with the search bar or the
 * corner controls.
 */
export function BoundaryFeaturePopup() {
  const hoverInfo = useBoundaryStore((s) => s.hoverInfo);
  const selected = useBoundaryStore((s) => s.selected);
  const setSelected = useBoundaryStore((s) => s.setSelected);

  const info = selected ?? hoverInfo;

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, setSelected]);

  if (!info) return null;

  let title = info.name || '—';
  const parts: string[] = [];
  if (info.level === 'states') {
    if (info.abbrev) parts.push(info.abbrev);
    parts.push('State');
  } else if (info.level === 'counties') {
    title = info.name ? `${info.name} County` : 'County';
    if (info.state) parts.push(info.state);
  } else {
    if (info.type) parts.push(info.type);
    if (info.county) parts.push(`${info.county} County`);
    if (info.state) parts.push(info.state);
  }
  const context = parts.join(' · ');

  return (
    <div
      data-testid="boundary-id-card"
      className="absolute z-20 top-[72px] left-1/2 -translate-x-1/2 lg:top-4 lg:left-auto lg:right-4 lg:translate-x-0 max-w-[calc(100%-1.5rem)]"
    >
      <div className="flex items-center gap-3 bg-dark-900/95 backdrop-blur-md border border-hairline rounded-lg px-3.5 py-2 shadow-xl shadow-black/40">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{title}</p>
          {context && <p className="text-[11px] text-dark-400 truncate">{context}</p>}
        </div>
        {selected && (
          <button
            onClick={() => setSelected(null)}
            aria-label="Dismiss"
            className="flex-shrink-0 text-dark-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
