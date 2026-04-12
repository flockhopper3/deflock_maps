import { create } from 'zustand';
import type { Location, Route, CameraOnRoute, ALPRCamera } from '../types';
import { haversineDistance } from '../utils/geo';

interface CustomRouteState {
  // Mode management
  isCustomizing: boolean;
  editMode: 'waypoint' | 'draw' | 'edit';
  
  // Route data
  waypoints: Location[];
  customRoute: Route | null;
  camerasOnRoute: CameraOnRoute[];
  baseRoute: Route | null;
  
  // UI state
  isRecalculating: boolean;
  error: string | null;
  undoStack: Location[][];
  
  // Actions
  enterCustomMode: (baseRoute?: Route) => void;
  exitCustomMode: () => void;
  setEditMode: (mode: 'waypoint' | 'draw' | 'edit') => void;
  addWaypoint: (location: Location) => void;
  removeWaypoint: (index: number) => void;
  updateWaypoint: (index: number, location: Location) => void;
  reorderWaypoints: (fromIndex: number, toIndex: number) => void;
  setOrigin: (location: Location) => void;
  setDestination: (location: Location) => void;
  recalculateRoute: (cameras: ALPRCamera[]) => Promise<void>;
  undo: () => void;
  clearWaypoints: () => void;
  applyCustomRoute: () => Route | null;
}

const MAX_UNDO_STATES = 20;

/**
 * Calculate distance from a point to a line segment
 * Returns the distance and the projection point on the segment
 */
function distanceToSegment(
  pointLat: number,
  pointLon: number,
  segStartLat: number,
  segStartLon: number,
  segEndLat: number,
  segEndLon: number
): { distance: number; projLat: number; projLon: number } {
  const dx = segEndLon - segStartLon;
  const dy = segEndLat - segStartLat;
  
  if (dx === 0 && dy === 0) {
    // Segment is a point
    return {
      distance: haversineDistance(pointLat, pointLon, segStartLat, segStartLon),
      projLat: segStartLat,
      projLon: segStartLon,
    };
  }
  
  // Calculate projection parameter
  const t = Math.max(0, Math.min(1,
    ((pointLon - segStartLon) * dx + (pointLat - segStartLat) * dy) / (dx * dx + dy * dy)
  ));
  
  const projLon = segStartLon + t * dx;
  const projLat = segStartLat + t * dy;
  
  return {
    distance: haversineDistance(pointLat, pointLon, projLat, projLon),
    projLat,
    projLon,
  };
}

/**
 * Find the best index to insert a new waypoint based on the route geometry
 * Returns the index where the waypoint should be inserted
 */
function findBestInsertionIndex(
  waypoints: Location[],
  newLocation: Location,
  routeGeometry: [number, number][] | null
): number {
  // If less than 2 waypoints, add at the end
  if (waypoints.length < 2) {
    return waypoints.length;
  }
  
  // If we have route geometry and waypoints, find the nearest waypoint segment
  if (routeGeometry && routeGeometry.length >= 2 && waypoints.length >= 2) {
    // Find the nearest waypoint segment directly
    let nearestWaypointIndex = 1; // Default to inserting after first waypoint
    let minDistance = Infinity;
    
    for (let i = 0; i < waypoints.length - 1; i++) {
      const { distance } = distanceToSegment(
        newLocation.lat, newLocation.lon,
        waypoints[i].lat, waypoints[i].lon,
        waypoints[i + 1].lat, waypoints[i + 1].lon
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestWaypointIndex = i + 1; // Insert after waypoint i
      }
    }
    
    return nearestWaypointIndex;
  }
  
  // Fallback: find nearest segment between existing waypoints
  let minDistance = Infinity;
  let insertIndex = waypoints.length; // Default to end
  
  for (let i = 0; i < waypoints.length - 1; i++) {
    const { distance } = distanceToSegment(
      newLocation.lat, newLocation.lon,
      waypoints[i].lat, waypoints[i].lon,
      waypoints[i + 1].lat, waypoints[i + 1].lon
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      insertIndex = i + 1; // Insert after waypoint i
    }
  }
  
  return insertIndex;
}

/**
 * Extract key waypoints from a route geometry
 * Instead of using all points, sample at intervals to get meaningful waypoints
 */
function extractWaypointsFromRoute(route: Route): Location[] {
  const waypoints: Location[] = [];
  
  // Always include origin
  waypoints.push({
    lat: route.origin.lat,
    lon: route.origin.lon,
    name: route.origin.name || 'Start',
  });
  
  // If route already has waypoints, use them
  if (route.waypoints && route.waypoints.length > 0) {
    waypoints.push(...route.waypoints);
  }
  
  // Always include destination
  waypoints.push({
    lat: route.destination.lat,
    lon: route.destination.lon,
    name: route.destination.name || 'End',
  });
  
  return waypoints;
}

export const useCustomRouteStore = create<CustomRouteState>((set, get) => ({
  // Initial state
  isCustomizing: false,
  editMode: 'waypoint',
  waypoints: [],
  customRoute: null,
  camerasOnRoute: [],
  baseRoute: null,
  isRecalculating: false,
  error: null,
  undoStack: [],

  enterCustomMode: (baseRoute?: Route) => {
    if (baseRoute) {
      // Extract waypoints from existing route
      const waypoints = extractWaypointsFromRoute(baseRoute);
      set({
        isCustomizing: true,
        editMode: 'waypoint',
        baseRoute,
        waypoints,
        customRoute: baseRoute,
        camerasOnRoute: [],
        error: null,
        undoStack: [],
      });
    } else {
      // Start fresh
      set({
        isCustomizing: true,
        editMode: 'waypoint',
        baseRoute: null,
        waypoints: [],
        customRoute: null,
        camerasOnRoute: [],
        error: null,
        undoStack: [],
      });
    }
  },

  exitCustomMode: () => {
    set({
      isCustomizing: false,
      editMode: 'waypoint',
      waypoints: [],
      customRoute: null,
      camerasOnRoute: [],
      baseRoute: null,
      error: null,
      undoStack: [],
    });
  },

  setEditMode: (mode: 'waypoint' | 'draw' | 'edit') => {
    set({ editMode: mode });
  },

  addWaypoint: (location: Location) => {
    const { waypoints, undoStack, customRoute } = get();
    
    // Save current state to undo stack
    const newUndoStack = [...undoStack, waypoints].slice(-MAX_UNDO_STATES);
    
    // Find the best position to insert the new waypoint
    const insertIndex = findBestInsertionIndex(
      waypoints, 
      location, 
      customRoute?.geometry || null
    );
    
    // Insert at the calculated position
    const newWaypoints = [...waypoints];
    newWaypoints.splice(insertIndex, 0, location);
    
    set({
      waypoints: newWaypoints,
      undoStack: newUndoStack,
    });
  },

  removeWaypoint: (index: number) => {
    const { waypoints, undoStack } = get();
    
    if (index < 0 || index >= waypoints.length) return;
    
    // Save current state to undo stack
    const newUndoStack = [...undoStack, waypoints].slice(-MAX_UNDO_STATES);
    
    const newWaypoints = waypoints.filter((_, i) => i !== index);
    
    set({
      waypoints: newWaypoints,
      undoStack: newUndoStack,
    });
  },

  updateWaypoint: (index: number, location: Location) => {
    const { waypoints, undoStack } = get();
    
    if (index < 0 || index >= waypoints.length) return;
    
    // Save current state to undo stack
    const newUndoStack = [...undoStack, waypoints].slice(-MAX_UNDO_STATES);
    
    const newWaypoints = [...waypoints];
    newWaypoints[index] = location;
    
    set({
      waypoints: newWaypoints,
      undoStack: newUndoStack,
    });
  },

  reorderWaypoints: (fromIndex: number, toIndex: number) => {
    const { waypoints, undoStack } = get();
    
    if (fromIndex < 0 || fromIndex >= waypoints.length) return;
    if (toIndex < 0 || toIndex >= waypoints.length) return;
    
    // Save current state to undo stack
    const newUndoStack = [...undoStack, waypoints].slice(-MAX_UNDO_STATES);
    
    const newWaypoints = [...waypoints];
    const [removed] = newWaypoints.splice(fromIndex, 1);
    newWaypoints.splice(toIndex, 0, removed);
    
    set({
      waypoints: newWaypoints,
      undoStack: newUndoStack,
    });
  },

  setOrigin: (location: Location) => {
    const { waypoints, undoStack } = get();
    
    // Save current state to undo stack
    const newUndoStack = [...undoStack, waypoints].slice(-MAX_UNDO_STATES);
    
    if (waypoints.length === 0) {
      set({
        waypoints: [location],
        undoStack: newUndoStack,
      });
    } else {
      const newWaypoints = [...waypoints];
      newWaypoints[0] = location;
      set({
        waypoints: newWaypoints,
        undoStack: newUndoStack,
      });
    }
  },

  setDestination: (location: Location) => {
    const { waypoints, undoStack } = get();
    
    // Save current state to undo stack
    const newUndoStack = [...undoStack, waypoints].slice(-MAX_UNDO_STATES);
    
    if (waypoints.length === 0) {
      set({
        waypoints: [location],
        undoStack: newUndoStack,
      });
    } else if (waypoints.length === 1) {
      set({
        waypoints: [...waypoints, location],
        undoStack: newUndoStack,
      });
    } else {
      const newWaypoints = [...waypoints];
      newWaypoints[newWaypoints.length - 1] = location;
      set({
        waypoints: newWaypoints,
        undoStack: newUndoStack,
      });
    }
  },

  recalculateRoute: async (_cameras: ALPRCamera[]) => {
    set({
      error: 'Custom routing coming soon — waiting for API waypoint support',
      isRecalculating: false,
    });
  },

  undo: () => {
    const { undoStack } = get();
    
    if (undoStack.length === 0) return;
    
    const newUndoStack = [...undoStack];
    const previousState = newUndoStack.pop();
    
    if (previousState) {
      set({
        waypoints: previousState,
        undoStack: newUndoStack,
      });
    }
  },

  clearWaypoints: () => {
    const { waypoints, undoStack } = get();
    
    // Save current state to undo stack
    const newUndoStack = [...undoStack, waypoints].slice(-MAX_UNDO_STATES);
    
    set({
      waypoints: [],
      customRoute: null,
      camerasOnRoute: [],
      undoStack: newUndoStack,
    });
  },

  applyCustomRoute: () => {
    const { customRoute } = get();
    return customRoute;
  },
}));

