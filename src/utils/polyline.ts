/**
 * Decode a Valhalla/Google encoded polyline string into coordinates
 * Based on the algorithm from: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodePolyline(encoded: string, precision: number = 6): [number, number][] {
  const coordinates: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  const factor = Math.pow(10, precision);

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    // Decode latitude
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    // Decode longitude
    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLon = result & 1 ? ~(result >> 1) : result >> 1;
    lon += deltaLon;

    coordinates.push([lat / factor, lon / factor]);
  }

  return coordinates;
}

/**
 * Encode coordinates to a polyline string
 */
export function encodePolyline(coordinates: [number, number][], precision: number = 6): string {
  const factor = Math.pow(10, precision);
  let encoded = '';
  let prevLat = 0;
  let prevLon = 0;

  for (const [lat, lon] of coordinates) {
    const scaledLat = Math.round(lat * factor);
    const scaledLon = Math.round(lon * factor);

    encoded += encodeNumber(scaledLat - prevLat);
    encoded += encodeNumber(scaledLon - prevLon);

    prevLat = scaledLat;
    prevLon = scaledLon;
  }

  return encoded;
}

function encodeNumber(num: number): string {
  let value = num < 0 ? ~(num << 1) : num << 1;
  let encoded = '';

  while (value >= 0x20) {
    encoded += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
    value >>= 5;
  }

  encoded += String.fromCharCode(value + 63);
  return encoded;
}

