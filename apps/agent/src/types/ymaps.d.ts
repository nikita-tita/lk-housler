// Yandex Maps API types
export interface YmapsMap {
  setBounds: (bounds: number[][], options?: Record<string, unknown>) => void;
  geoObjects: { add: (obj: unknown) => void };
  events: { add: (event: string, handler: () => void) => void };
  getBounds: () => [[number, number], [number, number]];
}

export interface YmapsPlacemark {
  events: { add: (event: string, handler: () => void) => void };
  options: { set: (key: string, value: unknown) => void };
  properties: { get: (key: string) => unknown };
}

export interface YmapsClusterer {
  add: (placemarks: YmapsPlacemark[]) => void;
  removeAll: () => void;
  getBounds: () => number[][];
  events: { add: (event: string, handler: (e: YmapsClusterEvent) => void) => void };
}

export interface YmapsClusterEvent {
  get: (key: string) => {
    getGeoObjects?: () => Array<{ properties: { get: (key: string) => number } }>
  };
}

export interface YmapsApi {
  ready: (callback: () => void) => void;
  Map: new (container: HTMLElement | null, options: Record<string, unknown>) => YmapsMap;
  Placemark: new (coords: number[], properties: Record<string, unknown>, options: Record<string, unknown>) => YmapsPlacemark;
  Clusterer: new (options: Record<string, unknown>) => YmapsClusterer;
}

declare global {
  interface Window {
    ymaps: YmapsApi;
  }
}
