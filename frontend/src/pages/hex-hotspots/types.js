export interface RideDataRaw {
  id?: string;
  pickupLat: number;
  pickupLong: number;
  [key: string]: any;
}

export interface H3Cluster {
  hexId: string;
  lat: number;
  lng: number;
  demand: number;
  userDensity: number;
  demandScore: number;
  requiredSupply: number;
  allocatedSupply: number; // New field for constrained optimization
  slaComplianceScore: number; // 0 to 100 calculated score
  isFallback?: boolean;
  completed?: number;
  cancelled?: number;
  driverNotFound?: number;
  unknown?: number;
}

export type MapMetric = 'DEMAND' | 'SLA';
export type LocationType = 'PICKUP' | 'DROP';

export interface ProcessingConfig {
  h3Resolution: number; // 0-15, usually 7-9 for city
  targetSlaMinutes: number; // e.g. 5 minutes
  avgTripTimeMinutes: number; // e.g. 20 minutes
  driverEfficiency: number; // 0.1 - 1.0 (utilization rate)
}

export enum AppState {
  UPLOAD = 'UPLOAD',
  PROCESSING = 'PROCESSING',
  DASHBOARD = 'DASHBOARD',
}

export interface GeoPoint {
  lat: number;
  lng: number;
}