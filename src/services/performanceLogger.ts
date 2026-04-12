/**
 * Performance logging utility for route calculation metrics
 *
 * Captures detailed timing, memory, and route statistics for load testing.
 * Data can be exported to JSON for analysis.
 */

export interface RouteMetrics {
  timestamp: string;
  routeId: string;

  // Route details
  originLat: number;
  originLon: number;
  destLat: number;
  destLon: number;
  straightLineDistanceKm: number;

  // Timing (milliseconds)
  totalTimeMs: number;
  spatialFilterTimeMs: number;
  normalRouteTimeMs: number;
  avoidanceRouteTimeMs: number;
  waypointIterationsTimeMs?: number;

  // Camera data
  totalCameras: number;
  filteredCameras: number;
  camerasOnNormalRoute: number;
  camerasOnAvoidanceRoute: number;

  // Route results
  normalDistanceMeters: number;
  normalDurationSeconds: number;
  avoidanceDistanceMeters: number;
  avoidanceDurationSeconds: number;
  distanceIncreasePercent: number;

  // Zone stats
  blockZones?: number;
  penaltyZones?: number;

  // Memory (if available)
  heapUsedMB?: number;
  heapTotalMB?: number;

  // Strategy used
  strategy: string;

  // Errors (if any)
  error?: string;
}

class PerformanceLogger {
  private metrics: RouteMetrics[] = [];
  private enabled: boolean;
  private sessionId: string;
  private startTime: number;

  constructor() {
    // Enable by default in development or when explicitly enabled
    this.enabled = import.meta.env.DEV || import.meta.env.VITE_PERF_LOGGING === 'true';
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start a new route measurement
   */
  startRoute(origin: { lat: number; lon: number }, destination: { lat: number; lon: number }): RouteTimer {
    return new RouteTimer(origin, destination, this.enabled);
  }

  /**
   * Record completed route metrics
   */
  record(metrics: RouteMetrics): void {
    if (!this.enabled) return;

    this.metrics.push(metrics);

    // Log to console in a structured format
    console.log('[PERF]', JSON.stringify({
      ...metrics,
      sessionId: this.sessionId,
    }));
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): RouteMetrics[] {
    return [...this.metrics];
  }

  /**
   * Export metrics as JSON string
   */
  exportJSON(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date().toISOString(),
      totalRoutes: this.metrics.length,
      metrics: this.metrics,
    }, null, 2);
  }

  /**
   * Export metrics as CSV
   */
  exportCSV(): string {
    if (this.metrics.length === 0) return '';

    const headers = Object.keys(this.metrics[0]);
    const rows = this.metrics.map(m =>
      headers.map(h => {
        const val = m[h as keyof RouteMetrics];
        return typeof val === 'string' ? `"${val}"` : val;
      }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalRoutes: number;
    avgTotalTimeMs: number;
    p50TotalTimeMs: number;
    p95TotalTimeMs: number;
    p99TotalTimeMs: number;
    avgFilteredCameras: number;
    avgCamerasAvoided: number;
    successRate: number;
  } {
    if (this.metrics.length === 0) {
      return {
        totalRoutes: 0,
        avgTotalTimeMs: 0,
        p50TotalTimeMs: 0,
        p95TotalTimeMs: 0,
        p99TotalTimeMs: 0,
        avgFilteredCameras: 0,
        avgCamerasAvoided: 0,
        successRate: 0,
      };
    }

    const times = this.metrics.map(m => m.totalTimeMs).sort((a, b) => a - b);
    const successful = this.metrics.filter(m => !m.error);

    const percentile = (arr: number[], p: number) => {
      const idx = Math.ceil(arr.length * p / 100) - 1;
      return arr[Math.max(0, idx)];
    };

    return {
      totalRoutes: this.metrics.length,
      avgTotalTimeMs: times.reduce((a, b) => a + b, 0) / times.length,
      p50TotalTimeMs: percentile(times, 50),
      p95TotalTimeMs: percentile(times, 95),
      p99TotalTimeMs: percentile(times, 99),
      avgFilteredCameras: this.metrics.reduce((a, m) => a + m.filteredCameras, 0) / this.metrics.length,
      avgCamerasAvoided: successful.reduce((a, m) => a + (m.camerasOnNormalRoute - m.camerasOnAvoidanceRoute), 0) / successful.length,
      successRate: successful.length / this.metrics.length,
    };
  }

  /**
   * Clear all recorded metrics
   */
  clear(): void {
    this.metrics = [];
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
  }

  /**
   * Download metrics as a file (browser only)
   */
  downloadMetrics(format: 'json' | 'csv' = 'json'): void {
    const content = format === 'json' ? this.exportJSON() : this.exportCSV();
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `route-metrics-${this.sessionId}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

/**
 * Timer helper for measuring route calculation phases
 */
export class RouteTimer {
  private startTime: number;
  private phases: Map<string, { start: number; end?: number }> = new Map();
  private origin: { lat: number; lon: number };
  private destination: { lat: number; lon: number };
  private enabled: boolean;
  private data: Partial<RouteMetrics> = {};

  constructor(origin: { lat: number; lon: number }, destination: { lat: number; lon: number }, enabled: boolean) {
    this.startTime = performance.now();
    this.origin = origin;
    this.destination = destination;
    this.enabled = enabled;

    // Calculate straight-line distance
    const R = 6371; // km
    const dLat = (destination.lat - origin.lat) * Math.PI / 180;
    const dLon = (destination.lon - origin.lon) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(origin.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    this.data.straightLineDistanceKm = R * c;
  }

  startPhase(name: string): void {
    if (!this.enabled) return;
    this.phases.set(name, { start: performance.now() });
  }

  endPhase(name: string): number {
    if (!this.enabled) return 0;
    const phase = this.phases.get(name);
    if (phase) {
      phase.end = performance.now();
      return phase.end - phase.start;
    }
    return 0;
  }

  setData(data: Partial<RouteMetrics>): void {
    if (!this.enabled) return;
    Object.assign(this.data, data);
  }

  /**
   * Complete the measurement and return the metrics
   */
  complete(): RouteMetrics {
    const totalTime = performance.now() - this.startTime;

    // Get memory usage if available
    let heapUsedMB: number | undefined;
    let heapTotalMB: number | undefined;

    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const mem = (performance as unknown as { memory: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
      heapUsedMB = mem.usedJSHeapSize / 1024 / 1024;
      heapTotalMB = mem.totalJSHeapSize / 1024 / 1024;
    }

    const spatialFilterTime = this.phases.get('spatialFilter');
    const normalRouteTime = this.phases.get('normalRoute');
    const avoidanceRouteTime = this.phases.get('avoidanceRoute');
    const waypointTime = this.phases.get('waypointIterations');

    return {
      timestamp: new Date().toISOString(),
      routeId: `route_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,

      originLat: this.origin.lat,
      originLon: this.origin.lon,
      destLat: this.destination.lat,
      destLon: this.destination.lon,
      straightLineDistanceKm: this.data.straightLineDistanceKm || 0,

      totalTimeMs: Math.round(totalTime),
      spatialFilterTimeMs: spatialFilterTime ? Math.round(spatialFilterTime.end! - spatialFilterTime.start) : 0,
      normalRouteTimeMs: normalRouteTime ? Math.round(normalRouteTime.end! - normalRouteTime.start) : 0,
      avoidanceRouteTimeMs: avoidanceRouteTime ? Math.round(avoidanceRouteTime.end! - avoidanceRouteTime.start) : 0,
      waypointIterationsTimeMs: waypointTime ? Math.round(waypointTime.end! - waypointTime.start) : undefined,

      totalCameras: this.data.totalCameras || 0,
      filteredCameras: this.data.filteredCameras || 0,
      camerasOnNormalRoute: this.data.camerasOnNormalRoute || 0,
      camerasOnAvoidanceRoute: this.data.camerasOnAvoidanceRoute || 0,

      normalDistanceMeters: this.data.normalDistanceMeters || 0,
      normalDurationSeconds: this.data.normalDurationSeconds || 0,
      avoidanceDistanceMeters: this.data.avoidanceDistanceMeters || 0,
      avoidanceDurationSeconds: this.data.avoidanceDurationSeconds || 0,
      distanceIncreasePercent: this.data.distanceIncreasePercent || 0,

      blockZones: this.data.blockZones,
      penaltyZones: this.data.penaltyZones,

      heapUsedMB,
      heapTotalMB,

      strategy: this.data.strategy || 'unknown',
      error: this.data.error,
    };
  }
}

// Singleton instance
export const perfLogger = new PerformanceLogger();

// Expose to window for debugging in development only
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { perfLogger: PerformanceLogger }).perfLogger = perfLogger;
}
