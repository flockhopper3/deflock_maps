import { useNetworkStore } from '../../store/networkStore';

const NODE_TYPE_INFO: { type: string; label: string; color: string }[] = [
  { type: 'pd', label: 'PD', color: '#3b82f6' },
  { type: 'so', label: 'Sheriff', color: '#14b8a6' },
  { type: 'federal', label: 'Federal', color: '#f59e0b' },
  { type: 'school', label: 'School', color: '#8b5cf6' },
  { type: 'other', label: 'Other', color: '#6b7280' },
];

export function NetworkLegendBar() {
  const typeFilter = useNetworkStore(s => s.typeFilter);
  const toggleTypeFilter = useNetworkStore(s => s.toggleTypeFilter);
  const clearTypeFilter = useNetworkStore(s => s.clearTypeFilter);

  return (
    <div className="absolute bottom-4 left-4 z-20 hidden lg:block">
      <div className="bg-dark-800/90 rounded-md px-3 py-2 border border-dark-600">
        <div className="flex items-center gap-4 text-sm">
          {NODE_TYPE_INFO.map(({ type, label, color }) => (
            <button
              key={type}
              onClick={() => toggleTypeFilter(type)}
              className={`flex items-center gap-2 transition-opacity ${
                typeFilter.size > 0 && !typeFilter.has(type) ? 'opacity-35' : ''
              }`}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-dark-100">{label}</span>
            </button>
          ))}
          {typeFilter.size > 0 && (
            <>
              <div className="w-px h-5 bg-dark-600" />
              <button
                onClick={clearTypeFilter}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
