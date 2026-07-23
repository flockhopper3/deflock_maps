import { useState, useEffect } from 'react';
import { RoutePanelContent } from './RoutePanelContent';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Desktop-only side panel (MapPage mounts it behind !isMobile). */
export function RoutePanel() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  // Enable animations only after first render to prevent initial glitch
  useEffect(() => {
    const timer = setTimeout(() => setHasAnimated(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="hidden lg:block relative h-full">
      {/* Panel Content */}
      <div className={`flex flex-col h-full bg-dark-900 border-r border-dark-700/50 ${
        hasAnimated ? 'transition-all duration-300' : ''
      } ${isCollapsed ? 'w-0 overflow-hidden' : 'w-[400px]'}`}>
        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <RoutePanelContent />
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-3 border-t border-dark-700/50 bg-dark-800/50">
          <p className="text-[10px] text-dark-500 text-center">
            Maps by{' '}
            <a href="https://openroadlabs.org" target="_blank" rel="noopener noreferrer" className="hover:text-dark-300 transition-colors">OpenRoad Labs LLC</a>
          </p>
        </div>
      </div>

      {/* Expand/Collapse Toggle Button - positioned on the edge */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`absolute z-50 top-1/2 -translate-y-1/2 ${
          hasAnimated ? 'transition-all duration-300' : ''
        } ${isCollapsed ? 'left-0' : 'left-[400px]'} w-6 h-16 bg-dark-800 hover:bg-dark-700 border border-dark-600 border-l-0 rounded-r-lg flex items-center justify-center group`}
        aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel'}
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4 text-dark-300 group-hover:text-white transition-colors" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-dark-300 group-hover:text-white transition-colors" />
        )}
      </button>
    </div>
  );
}
