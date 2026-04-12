import type { Route, GPXMetadata } from '../types';

/**
 * Generate GPX file content from a route
 */
export function generateGPX(route: Route, metadata?: Partial<GPXMetadata>): string {
  const name = metadata?.name || `FlockHopper Route`;
  const description =
    metadata?.description ||
    `Route from ${route.origin.name || 'Origin'} to ${route.destination.name || 'Destination'}`;

  const now = new Date().toISOString();

  const trackPoints = route.geometry
    .map(
      ([lat, lon]) => `      <trkpt lat="${lat}" lon="${lon}">
      </trkpt>`
    )
    .join('\n');

  const routePoints =
    route.maneuvers
      ?.map(
        (m) => `    <rtept lat="${route.geometry[m.beginShapeIndex][0]}" lon="${route.geometry[m.beginShapeIndex][1]}">
      <name>${escapeXml(m.instruction)}</name>
    </rtept>`
      )
      .join('\n') || '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" 
     creator="FlockHopper - ALPR Camera Avoidance Routing"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(name)}</name>
    <desc>${escapeXml(description)}</desc>
    <author>
      <name>FlockHopper</name>
      <link href="https://flockhopper.app">
        <text>FlockHopper</text>
      </link>
    </author>
    <time>${now}</time>
  </metadata>

  <wpt lat="${route.origin.lat}" lon="${route.origin.lon}">
    <name>Start: ${escapeXml(route.origin.name || 'Origin')}</name>
    <sym>Flag, Green</sym>
  </wpt>

  <wpt lat="${route.destination.lat}" lon="${route.destination.lon}">
    <name>End: ${escapeXml(route.destination.name || 'Destination')}</name>
    <sym>Flag, Red</sym>
  </wpt>

  <rte>
    <name>${escapeXml(name)}</name>
${routePoints}
  </rte>

  <trk>
    <name>${escapeXml(name)} Track</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
}

/**
 * Download GPX file
 */
export function downloadGPX(route: Route, filename?: string): void {
  const gpxContent = generateGPX(route, {
    name: `FlockHopper: ${route.origin.name || 'Origin'} to ${route.destination.name || 'Destination'}`,
    description: `Camera avoidance route - ${(route.distanceMeters / 1609.34).toFixed(1)} miles`,
  });

  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `flockhopper-route-${Date.now()}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

