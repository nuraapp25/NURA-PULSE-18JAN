// Types and constants for Hex Hotspots

export const AppState = {
  UPLOAD: 'UPLOAD',
  PROCESSING: 'PROCESSING',
  DASHBOARD: 'DASHBOARD',
};

// Note: In JavaScript, we don't have interfaces, but these serve as documentation
// for the shape of objects used in the app

/*
RideDataRaw = {
  id?: string;
  pickupLat: number;
  pickupLong: number;
  [key: string]: any;
}

H3Cluster = {
  hexId: string;
  lat: number;
  lng: number;
  demand: number;
  userDensity: number;
  demandScore: number;
  requiredSupply: number;
  allocatedSupply: number;
  slaComplianceScore: number;
  isFallback?: boolean;
  completed?: number;
  cancelled?: number;
  driverNotFound?: number;
  unknown?: number;
}

ProcessingConfig = {
  h3Resolution: number;
  targetSlaMinutes: number;
  avgTripTimeMinutes: number;
  driverEfficiency: number;
}

GeoPoint = {
  lat: number;
  lng: number;
}
*/
