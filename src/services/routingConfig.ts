/**
 * Routing Configuration — Visualization Constants
 *
 * These constants are used by MapLibreContainer.tsx for rendering
 * camera direction cones and detection zones on the map.
 *
 * All routing/avoidance logic is now handled by the API.
 */

// ============================================================================
// ZONE SAFETY MULTIPLIERS
// ============================================================================

/**
 * Multipliers for avoidance zones relative to the user's detection radius.
 * Used for map visualization of camera zones.
 */
export const ZONE_SAFETY_MULTIPLIERS = {
  /** Block zones are 1.6x the detection radius */
  block: 1.6,
  /** Penalty zones are 2.5x the detection radius */
  penalty: 2.5,
} as const;

// ============================================================================
// DIRECTIONAL ZONE SETTINGS
// ============================================================================

export const DIRECTIONAL_ZONE = {
  /** Total field of view for camera cone (degrees) */
  cameraFovDegrees: 70,
  /** Legacy — not used */
  detectionRangeMeters: 120,
  /** Small buffer behind camera (meters) */
  backBufferMeters: 15,
  /** Number of arc segments for the front curve of the cone */
  arcSegments: 8,
} as const;

// ============================================================================
// CAMERA DETECTION CONFIG
// ============================================================================

export const CAMERA_DETECTION = {
  /** Distance in meters for a camera to be considered "on route" */
  routeBufferMeters: 75,
  /** Bounding box buffer for filtering cameras to route area */
  bboxBufferDegrees: 0.5,
} as const;
