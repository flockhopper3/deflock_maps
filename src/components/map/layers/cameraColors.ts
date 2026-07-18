import type { MapTileStyleId } from '../../../store/appModeStore';

/** Camera point fill per basemap theme. Master's `#0080BC` reads as a rich
 *  azure dot on the light basemap but sinks into the dark one, leaving the
 *  marker looking like a hollow ring. Light stays byte-identical to master;
 *  dark brightens the same hue so the dot reads the same blue on both
 *  grounds. */
export const CAMERA_POINT_FILL: Record<MapTileStyleId, string> = {
  light: '#0080BC',
  dark: '#2196E8',
};
