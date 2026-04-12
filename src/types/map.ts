export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapState {
  center: [number, number];
  zoom: number;
  bounds: MapBounds | null;
}

export interface MapLayer {
  id: string;
  name: string;
  visible: boolean;
  type: 'cameras' | 'route' | 'avoidance' | 'heatmap';
}

