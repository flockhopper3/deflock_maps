/** Properties attached to each feature in states-metrics / counties-metrics GeoJSON */
export interface DensityFeatureProperties {
  GEOID: string;
  name: string;
  level: 'state' | 'county';
  stateCode: number;
  population: number;
  roadMiles: number | null;
  cameraCount: number;
  camerasPerCapita: number;
  camerasPerRoadMile: number;
  rankPerCapita: number | null;
  rankPerRoadMile: number | null;
  percentilePerCapita: number;
  percentilePerRoadMile: number | null;
}
