import { useState } from 'react';
import { RouteCheckTab } from './RouteCheckTab';
import { RoutePlannerTab } from './RoutePlannerTab';
import { ExploreTab } from './ExploreTab';

type TabId = 'check' | 'planner' | 'explore';

interface Tab {
  id: TabId;
  label: string;
  icon: JSX.Element;
  description: string;
}

const TABS: Tab[] = [
  {
    id: 'check',
    label: 'Route Check',
    description: 'Count cameras on route',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
      </svg>
    ),
  },
  {
    id: 'planner',
    label: 'Route Planner',
    description: 'Avoid cameras',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.71 11.29l-9-9a.996.996 0 00-1.41 0l-9 9a.996.996 0 000 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 000-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z" />
      </svg>
    ),
  },
  {
    id: 'explore',
    label: 'Explore',
    description: 'Search & browse',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
      </svg>
    ),
  },
];

export function TabbedPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('check');
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-label={isCollapsed ? 'Open panel' : 'Close panel'}
        className="lg:hidden fixed bottom-6 right-6 z-50 w-14 h-14 bg-accent rounded-md flex items-center justify-center text-white active:scale-95 transition-transform"
      >
        {isCollapsed ? (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
          </svg>
        ) : (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        )}
      </button>

      {/* Panel */}
      <div
        className={`fixed lg:relative z-40 bg-dark-800 border-r border-dark-600 transition-transform duration-300 ease-out ${
          isCollapsed
            ? 'translate-x-full lg:translate-x-0'
            : 'translate-x-0'
        } right-0 lg:right-auto top-0 lg:top-auto h-full w-full sm:w-96 lg:w-[420px] flex flex-col`}
      >
        {/* Header with branding */}
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-dark-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-danger/10 border border-danger/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-danger" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-display font-bold text-white tracking-tight">
                  FlockHopper
                </h1>
                <p className="text-xs text-dark-400 font-medium">
                  ALPR Camera Avoidance
                </p>
              </div>
            </div>

            {/* Mobile close */}
            <button
              onClick={() => setIsCollapsed(true)}
              className="lg:hidden p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-dark-700/50">
            <div className="flex gap-1" role="tablist">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-all duration-200 border-b-2 ${
                    activeTab === tab.id
                      ? 'text-accent border-accent'
                      : 'text-dark-400 hover:text-dark-200 border-transparent'
                  }`}
                >
                  <span className={activeTab === tab.id ? 'text-accent' : ''}>
                    {tab.icon}
                  </span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
            
            {/* Active tab description */}
            <p className="text-center text-xs text-dark-500 mt-2">
              {TABS.find(t => t.id === activeTab)?.description}
            </p>
          </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5">
                {activeTab === 'check' && <RouteCheckTab />}
                {activeTab === 'planner' && <RoutePlannerTab />}
                {activeTab === 'explore' && <ExploreTab />}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 py-3 border-t border-dark-700/50 bg-dark-800/50">
          <div className="flex items-center justify-between text-xs text-dark-500">
            <span>Data from OpenStreetMap</span>
            <a 
              href="https://github.com/flockhopperdev/FlockHopper-v1"
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-dark-300 transition-colors"
            >
              About
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

