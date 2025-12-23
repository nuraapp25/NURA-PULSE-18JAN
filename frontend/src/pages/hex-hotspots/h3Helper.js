
import { latLngToCell, cellToLatLng } from 'h3-js';


// Morning: 06:00–15:59, Evening: 16:00–23:59, 00:00–05:59 treated as UNKNOWN
const MORNING_WINDOW = { startHour: 6, endHour: 15 };
const EVENING_WINDOW = { startHour: 16, endHour: 23 };
const DEFAULT_CHENNAI_CENTER = { lat: 13.0827, lng: 80.2707 };

// User-provided whitelist of Hex IDs
export const VALID_HEX_IDS = new Set([
  '88618c4d15fffff', '88618c4d39fffff', '88618c4d03fffff', '88618c4d45fffff', '88618c4d07fffff',
  '88618c4d05fffff', '88618c4d1dfffff', '88618c4d2bfffff', '88618c4d63fffff', '88618c4d0dfffff',
  '88618c4d47fffff', '88618c4d09fffff', '88618c4d0bfffff', '88618c4d01fffff', '88618c4d3dfffff',
  '88618c4d43fffff', '88618c4d23fffff', '88618c4d31fffff', '88618c4d57fffff', '88618c4d67fffff',
  '88618c4d29fffff', '88618c4d55fffff', '88618c4d41fffff', '88618c4897fffff', '88618c4d35fffff',
  '88618c4d4dfffff', '88618c4de9fffff', '88618c4d61fffff', '88618c4d69fffff', '88618c4de1fffff',
  '88618c4d33fffff', '88618c4d17fffff', '88618c4893fffff', '88618c4dc1fffff', '88618c4dc5fffff',
  '88618c4d13fffff', '88618c4debfffff', '88618c4de7fffff', '88618c4de5fffff', '88618c4dedfffff',
  '88618c4d3bfffff', '88618c4d21fffff', '88618c4d2dfffff', '88618c4d6dfffff', '88618c4d65fffff',
  '88618eb25bfffff', '88618c48b3fffff', '88618c48bbfffff', '88618c4895fffff', '88618c4d6bfffff',
  '88618c4891fffff', '88618c489bfffff', '88618c4d19fffff', '88618c4d49fffff', '88618c4d4bfffff',
  '88618c4d5dfffff', '88618c4d51fffff'
]);


/**
 * core algorithm to calculate required autos per hex to meet SLA.
 * Based on Little's Law and utilization buffers.
 */
const calculateSupply = (demandPerHour, config) => {
  const cycleTimeMinutes = config.avgTripTimeMinutes + config.targetSlaMinutes;
  const rawSupply = (demandPerHour * cycleTimeMinutes) / 60;
  const bufferedSupply = rawSupply / config.driverEfficiency;
  return Math.ceil(bufferedSupply);
};

export const extractDate = (timeStr?, dateCol?) => {
  // Helper to parse Excel serial date
  const parseExcelDate = (serial): Date => {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
  };

  // Helper to parse DD-MM-YYYY format (common in India/Europe)
  const parseDDMMYYYY = (dateStr) => {
    const parts = dateStr.trim().match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (parts) {
      const day = parseInt(parts[1], 10);
      const month = parseInt(parts[2], 10) - 1; // JS months are 0-indexed
      const year = parseInt(parts[3], 10);
      if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 2000 && year <= 2100) {
        return new Date(year, month, day);
      }
    }
    return null;
  };

  // PRIORITY 1: Direct date column - prioritize this above everything else
  if (dateCol !== undefined && dateCol !== null && dateCol !== '') {
    const dateColStr = dateCol.toString().trim();

    // Check for DD-MM-YYYY format first (most common format)
    const ddmmParsed = parseDDMMYYYY(dateColStr);
    if (ddmmParsed) return ddmmParsed;

    // Check for Excel Serial Number (e.g., 45226)
    if (!isNaN(Number(dateColStr)) && Number(dateColStr) > 25568) {
      return parseExcelDate(Number(dateColStr));
    }

    // Try standard Date() parsing
    const parsed = new Date(dateColStr);
    if (!isNaN(parsed.getTime())) {
      // Return date-only (strip time component)
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
  }

  // PRIORITY 2: Fallback to time string only if date column is missing/invalid
  if (!timeStr) return null;

  // Check for DD-MM-YYYY in timeStr
  const timeDDMMParsed = parseDDMMYYYY(timeStr);
  if (timeDDMMParsed) return timeDDMMParsed;

  // Check for Excel Serial Number in timeStr
  if (!isNaN(Number(timeStr)) && Number(timeStr) > 25568) {
    return parseExcelDate(Number(timeStr));
  }

  const parsedDate = new Date(timeStr);
  if (!isNaN(parsedDate.getTime())) {
    // Return date-only (strip time component)
    return new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
  }

  return null;
};

export const extractHour = (timeStr, hourCol) => {
  // PRIORITY 1: Direct hour column - treat as simple integer 0-23
  // If hour column exists, use it directly (no complex parsing)
  if (hourCol !== undefined && hourCol !== null && hourCol !== '') {
    // Try direct integer parsing first (most common case)
    const hourNum = parseInt(hourCol, 10);
    if (!isNaN(hourNum) && hourNum >= 0 && hourNum <= 23) {
      return hourNum;
    }

    // If not a direct integer, try Number() conversion
    const hourFloat = Number(hourCol);
    if (!isNaN(hourFloat) && hourFloat >= 0 && hourFloat <= 23) {
      return Math.floor(hourFloat);
    }
  }

  // PRIORITY 2: Fallback to time string parsing only if hour column is missing/invalid
  if (!timeStr) return null;

  // Helper to handle Excel fraction (e.g. 0.5 = 12:00 PM)
  const parseExcelTime = (fraction) => {
    const totalHours = fraction * 24;
    return Math.floor(totalHours);
  };

  // Check for Excel fraction in timeStr
  if (!isNaN(Number(timeStr)) && Number(timeStr) < 1 && Number(timeStr) >= 0) {
    return parseExcelTime(Number(timeStr));
  }

  // Check for AM/PM in the time string
  const timeUpper = timeStr.toUpperCase();
  const isPM = timeUpper.includes('PM');
  const isAM = timeUpper.includes('AM');

  // Try Date() parsing
  const parsedDate = new Date(timeStr);
  if (!isNaN(parsedDate.getTime())) {
    return parsedDate.getHours();
  }

  // Fallback: simple regex for "HH:MM ... PM"
  if (isPM || isAM) {
    const match = timeUpper.match(/(\d+)(?::\d+)?\s*(AM|PM)/);
    if (match) {
      let h = parseInt(match[1], 10);
      if (match[2] === 'PM' && h < 12) h += 12;
      if (match[2] === 'AM' && h === 12) h = 0;
      return h;
    }
  }

  return null;
};

const isDateInRange = (date, startDate, endDate, selectedDates?[]) => {
  // If no date in row, strict exclude if any filter is active
  if (!date) {
    return (!startDate && !endDate && (!selectedDates || selectedDates.length === 0));
  }

  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  // 1. Check Specific Dates (Priority)
  if (selectedDates && selectedDates.length > 0) {
    // Format dateOnly to YYYY-MM-DD
    const y = dateOnly.getFullYear();
    const m = (dateOnly.getMonth() + 1).toString().padStart(2, '0');
    const d = dateOnly.getDate().toString().padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    // If specific dates are selected, the row MUST match one of them
    return selectedDates.includes(dateStr);
  }

  // 2. Fallback to Range
  if (!startDate && !endDate) return true;

  const startOnly = startDate ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()) : null;
  const endOnly = endDate ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()) : null;

  // For single date selection (FROM = TO), use exact equality
  if (startOnly && endOnly && startOnly.getTime() === endOnly.getTime()) {
    return dateOnly.getTime() === startOnly.getTime();
  }

  // For date range, use inclusive boundaries
  if (startOnly && dateOnly < startOnly) return false;
  if (endOnly && dateOnly > endOnly) return false;
  return true;
};

const isMorningHour = (hour | null) => {
  if (hour === null) return false;
  return hour >= MORNING_WINDOW.startHour && hour <= MORNING_WINDOW.endHour;
};

const isEveningHour = (hour | null) => {
  if (hour === null) return false;
  if (hour >= EVENING_WINDOW.startHour) return true;
  return hour < MORNING_WINDOW.startHour;
};

const deriveRiderId = (row: Record<string, any>) | null => {
  const candidate =
    row.userId ||
    row.user_id ||
    row.customerId ||
    row.customer_id ||
    row.riderId ||
    row.passengerId ||
    row.passenger_id ||
    row.UserID ||
    row.UserId ||
    row.CustomerID;

  if (!candidate) return null;
  const normalized = candidate.toString().trim();
  return normalized.length > 0 ? normalized : null;
};

const recordCluster = (
  map: Map<string, ClusterAccumulator>,
  hexId,
  riderId | null,
  status
) => {
  const s = status.toLowerCase();
  // Drop PENDING rows from demand
  if (s.includes('pending')) {
    return;
  }

  if (!map.has(hexId)) {
    map.set(hexId, { demand: 0, riders: new Set(), completed: 0, cancelled: 0, driverNotFound: 0, unknown: 0 });
  }

  const acc = map.get(hexId)!;
  acc.demand += 1;
  if (riderId) {
    acc.riders.add(riderId);
  }

  if (s.includes('completed')) acc.completed += 1;
  else if (s.includes('cancelled')) acc.cancelled += 1;
  else if (s.includes('driver not found')) acc.driverNotFound += 1;
  else acc.unknown += 1;
};

const computeDemandScore = (
  demand,
  userDensity,
  maxDemand,
  maxDensity
) => {
  if (maxDemand === 0 && maxDensity === 0) return 0;

  // Use Square Root transformation to "even space" the scores and reduce outlier impact
  const normalizedDemand = maxDemand === 0 ? 0 : Math.sqrt(demand) / Math.sqrt(maxDemand);
  const normalizedDensity = maxDensity === 0 ? normalizedDemand : Math.sqrt(userDensity) / Math.sqrt(maxDensity);

  const weighted = (normalizedDemand * 0.6) + (normalizedDensity * 0.4);
  return Math.round(Math.min(1, weighted) * 100);
};

const createDefaultCluster = (config) => {
  try {
    const hexId = latLngToCell(DEFAULT_CHENNAI_CENTER.lat, DEFAULT_CHENNAI_CENTER.lng, config.h3Resolution);
    const [lat, lng] = cellToLatLng(hexId);
    return [{
      hexId,
      lat,
      lng,
      demand: 0,
      userDensity: 0,
      demandScore: 0,
      requiredSupply: 0,
      allocatedSupply: 0,
      slaComplianceScore: 0,
      isFallback: true,
      completed: 0,
      cancelled: 0,
      driverNotFound: 0,
      unknown: 0
    }];
  } catch (error) {
    console.error('Failed to build fallback cluster', error);
    return [];
  }
};

const finalizeCluster = (cluster, allocated) => {
  const safeRequired = Math.max(0, cluster.requiredSupply);
  const safeAllocated = Math.max(0, allocated);
  if (safeRequired === 0) {
    return {
      ...cluster,
      allocatedSupply: safeAllocated,
      slaComplianceScore: cluster.isFallback ? 0 : 100
    };
  }

  const coverageRatio = safeAllocated / safeRequired;
  const baseScore = Math.min(1, coverageRatio) * 100;
  const penalty = coverageRatio < 0.5 ? 0.75 : 1;

  return {
    ...cluster,
    allocatedSupply: safeAllocated,
    slaComplianceScore: Math.max(0, Math.round(baseScore * penalty))
  };
};

export const processRideData = (
  rows[],
  config,
  dateFilter?: { startDate; endDate; timeView?: 'ALL' | 'MORNING' | 'EVENING'; selectedDates?[] },
  locationType: 'PICKUP' | 'DROP' = 'PICKUP',
  startHour | 'ALL' = 'ALL',
  endHour | 'ALL' = 'ALL'
): {
  allDay,
  morning,
  evening,
  debugStats: {
    totalRows;
    droppedUniqueReq;
    droppedTimeRange;
    droppedDate;
    droppedInvalidCoord;
    droppedInvalidStatus;
    uniqueStatuses[];
  }
} => {
  const hexMapAll = new Map<string, ClusterAccumulator>();
  const hexMapMorning = new Map<string, ClusterAccumulator>();
  const hexMapEvening = new Map<string, ClusterAccumulator>();
  const uniqueDates = new Set();

  // Debug Counters
  let totalRows = rows.length;
  let droppedUniqueReq = 0;
  let droppedTimeRange = 0;
  let droppedDate = 0;
  let droppedInvalidCoord = 0;
  let droppedInvalidStatus = 0;
  const uniqueStatuses = new Set();

  // 1. Aggregation with date filtering
  rows.forEach(row => {
    // Flexible column matching for coordinates
    // Flexible column matching for coordinates based on LocationType
    let lat = 0;
    let lng = 0;

    if (locationType === 'PICKUP') {
      lat = parseFloat(row.pickupLat || row.latitude || row.Lat || row.LAT || 0);
      lng = parseFloat(row.pickupLong || row.longitude || row.Lng || row.Long || row.LONG || 0);
    } else {
      lat = parseFloat(row.dropLat || row.drop_lat || row.dropLatitude || row.DropLat || 0);
      lng = parseFloat(row.dropLong || row.drop_lng || row.dropLongitude || row.DropLong || 0);
    }

    // Flexible column matching for time and date
    // 1) Hour column – try common variants or any column name containing "hour"
    const hourKey =
      Object.keys(row).find(k => k.toLowerCase() === 'hour') ||
      Object.keys(row).find(k => k.toLowerCase().includes('hour'));
    const hourCol = row.hour || row.Hour || row.HOUR || (hourKey ? row[hourKey] : undefined);

    // 2) Date column – try explicit known names, then fall back to any key containing "date"
    const dateKey =
      Object.keys(row).find(k => ['date', 'ride_date', 'ride date'].includes(k.toLowerCase())) ||
      Object.keys(row).find(k => k.toLowerCase().includes('date'));
    const dateCol = row.date || row.Date || row.dateCreated || row.rideDate || (dateKey ? row[dateKey] : undefined);

    // 3) Time / timestamp column – try explicit names, then any key containing "time"
    const timeKey =
      Object.keys(row).find(k =>
        ['time', 'ride_time', 'ride time', 'start_time', 'start time'].includes(k.toLowerCase())
      ) ||
      Object.keys(row).find(k => k.toLowerCase().includes('time'));
    const timeStr =
      row.rideStartTime ||
      row.createdAt ||
      row.timestamp ||
      row.Date ||
      (timeKey ? row[timeKey] : '');
    const riderId = deriveRiderId(row);
    // Pass dateCol and timeStr separately - extractDate will prioritize dateCol
    const date = extractDate(timeStr, dateCol);
    const hour = extractHour(timeStr, hourCol);

    // Extract Status
    // Look for "Ride Status" column (case-insensitive)
    let status = '';
    const statusKey = Object.keys(row).find(k => k.toLowerCase().includes('ride status') || k.toLowerCase() === 'status');
    if (statusKey) {
      status = row[statusKey]?.toString() || '';
    }
    if (status) uniqueStatuses.add(status);

    // --- Unique Request Filter ---
    // Look for "unique req?" column (case-insensitive)
    const uniqueReqKey = Object.keys(row).find(k => k.toLowerCase().includes('unique req'));
    if (uniqueReqKey) {
      const val = row[uniqueReqKey]?.toString().toLowerCase().trim();
      // If column exists, ONLY include if value is 'yes'
      if (val !== 'yes') {
        droppedUniqueReq++;
        return;
      }
    }

    // --- Time Filter (Range) ---
    if (startHour !== 'ALL' && endHour !== 'ALL') {
      // Range filtering
      if (startHour <= endHour) {
        // Standard range (e.g., 06 to 10)
        if (hour === null || hour < startHour || hour > endHour) {
          droppedTimeRange++;
          return;
        }
      } else {
        // Overnight range (e.g., 22 to 02)
        // Include if hour >= startHour OR hour <= endHour
        if (hour === null || (hour < startHour && hour > endHour)) {
          droppedTimeRange++;
          return;
        }
      }
    } else if (startHour !== 'ALL') {
      // Single start hour selected (treat as exact match)
      if (hour !== startHour) {
        droppedTimeRange++;
        return;
      }
    } else if (endHour !== 'ALL') {
      // Single end hour selected (treat as exact match)
      if (hour !== endHour) {
        droppedTimeRange++;
        return;
      }
    }

    // Apply date filter if provided
    if (dateFilter && !isDateInRange(date, dateFilter.startDate, dateFilter.endDate, dateFilter.selectedDates)) {
      droppedDate++;
      return;
    }

    // Track unique dates for demand normalization
    if (date) {
      uniqueDates.add(date.toDateString());
    }

    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
      console.warn('Skipping invalid coordinates', lat, lng);
      droppedInvalidCoord++;
      return;
    }

    try {
      const hexIndex = latLngToCell(lat, lng, config.h3Resolution);

      // If timeView filter is set, only add to relevant bucket
      const timeView = dateFilter?.timeView;
      if (timeView === 'MORNING') {
        if (isMorningHour(hour)) {
          recordCluster(hexMapMorning, hexIndex, riderId, status);
          recordCluster(hexMapAll, hexIndex, riderId, status);
        }
      } else if (timeView === 'EVENING') {
        if (isEveningHour(hour)) {
          recordCluster(hexMapEvening, hexIndex, riderId, status);
          recordCluster(hexMapAll, hexIndex, riderId, status);
        }
      } else {
        // Add to All Day
        recordCluster(hexMapAll, hexIndex, riderId, status);

        // Add to Time Segments
        if (isMorningHour(hour)) {
          recordCluster(hexMapMorning, hexIndex, riderId, status);
        } else if (isEveningHour(hour)) {
          recordCluster(hexMapEvening, hexIndex, riderId, status);
        }
      }
    } catch (e) {
      console.warn("Invalid coordinates for H3 conversion", lat, lng);
    }
  });

  console.log("--- Data Processing Summary ---");
  console.log(`Total Rows: ${totalRows}`);
  console.log(`Dropped (Unique Req): ${droppedUniqueReq}`);
  console.log(`Dropped (Time Range): ${droppedTimeRange}`);
  console.log(`Dropped (Date Filter): ${droppedDate}`);
  console.log(`Dropped (Invalid Coord): ${droppedInvalidCoord}`);
  console.log(`Unique Statuses Found:`, Array.from(uniqueStatuses));
  console.log("-------------------------------");

  // --- Demand Normalization Logic ---
  const numDays = Math.max(1, uniqueDates.size);

  // If using specific selected dates, use that count for accurate normalization
  // (Though uniqueDates.size should already capture it, this is explicit)
  const daysDenominator = (dateFilter?.selectedDates?.length || 0) > 0
    ? dateFilter!.selectedDates!.length
    : Math.max(1, uniqueDates.size);

  let hoursPerDay = 24;
  if (typeof startHour === 'number' && typeof endHour === 'number') {
    // If range crosses midnight (e.g. 22 to 02), logic is different but simple count works if we assume daily cycle
    if (startHour <= endHour) {
      hoursPerDay = endHour - startHour + 1;
    } else {
      hoursPerDay = (24 - startHour) + endHour + 1;
    }
  } else if (dateFilter?.timeView === 'MORNING') {
    hoursPerDay = MORNING_WINDOW.endHour - MORNING_WINDOW.startHour + 1; // 10 hours
  } else if (dateFilter?.timeView === 'EVENING') {
    hoursPerDay = EVENING_WINDOW.endHour - EVENING_WINDOW.startHour + 1; // 8 hours
  }

  const totalDurationHours = daysDenominator * hoursPerDay;

  // Helper to convert map to clusters
  const mapToClusters = (map: Map<string, ClusterAccumulator>) => {
    if (map.size === 0) {
      return createDefaultCluster(config);
    }

    const entries = Array.from(map.entries()).map(([hexId, stats]) => ({
      hexId,
      demand: stats.demand,
      userDensity: stats.riders.size > 0 ? stats.riders.size : stats.demand,
      completed: stats.completed,
      cancelled: stats.cancelled,
      driverNotFound: stats.driverNotFound,
      unknown: stats.unknown
    }));

    const maxDemand = entries.reduce((acc, entry) => Math.max(acc, entry.demand), 0);
    const maxDensity = entries.reduce((acc, entry) => Math.max(acc, entry.userDensity), 0);

    return entries.map(({ hexId, demand, userDensity, completed, cancelled, driverNotFound, unknown }) => {
      const [lat, lng] = cellToLatLng(hexId);

      // Fix: Normalize demand by duration
      const demandPerHour = demand / totalDurationHours;
      const requiredSupply = calculateSupply(demandPerHour, config);

      const demandScore = computeDemandScore(demand, userDensity, maxDemand, maxDensity);

      return {
        hexId,
        lat,
        lng,
        demand,
        userDensity,
        demandScore,
        requiredSupply,
        allocatedSupply: requiredSupply,
        slaComplianceScore: demand > 0 ? Math.max(10, demandScore) : 0,
        completed,
        cancelled,
        driverNotFound,
        unknown
      };
    }).sort((a, b) => {
      if (b.demandScore === a.demandScore) {
        return b.demand - a.demand;
      }
      return b.demandScore - a.demandScore;
    });
  };

  return {
    allDay: mapToClusters(hexMapAll),
    morning: mapToClusters(hexMapMorning),
    evening: mapToClusters(hexMapEvening),
    debugStats: {
      totalRows,
      droppedUniqueReq,
      droppedTimeRange,
      droppedDate,
      droppedInvalidCoord,
      droppedInvalidStatus,
      uniqueStatuses: Array.from(uniqueStatuses)
    }
  };
};

/**
 * Strategically distributes a fixed number of autos across clusters.
 */
export const optimizeFleetDistribution = (
  clusters,
  fleetSize | null
) => {
  if (!clusters || clusters.length === 0) {
    return [];
  }

  // 1. Sort by Demand (Highest to Lowest) - "Accurate Hotspotting"
  // AND Filter strictly for VALID_HEX_IDS (Fish Bowl)
  const sortedClusters = clusters
    .filter(c => VALID_HEX_IDS.has(c.hexId))
    .sort((a, b) => {
      return b.demand - a.demand;
    });

  // If no fleet limit, just return ideal state for these valid hexes
  if (fleetSize === null || fleetSize === undefined) {
    return sortedClusters.map(cluster => finalizeCluster(cluster, cluster.requiredSupply));
  }

  // 2. Strict Allocation Logic
  let remainingFleet = Math.floor(fleetSize); // Strictly listen to the number of autos

  const allocatedClusters = sortedClusters.map(cluster => {
    // If we have autos left, fill this hotspot
    let allocated = 0;

    if (remainingFleet > 0) {
      // Allocate as much as needed, but not more than available
      // And not more than required (unless we want to oversupply, but usually we fill requirement)
      // "Tell me where to place those autos" -> Fill the need.
      const needed = cluster.requiredSupply;

      if (needed > 0) {
        const take = Math.min(remainingFleet, needed);
        allocated = take;
        remainingFleet -= take;
      }
    }

    // 3. Calculate SLA Score based on this strict allocation
    // Score = (Allocated / Required) * 100
    // If required is 0, score is 100 (met)
    let slaScore = 100;
    if (cluster.requiredSupply > 0) {
      slaScore = Math.round((allocated / cluster.requiredSupply) * 100);
    }

    return {
      ...cluster,
      allocatedSupply: allocated,
      slaComplianceScore: slaScore
    };
  });

  return allocatedClusters;
};

/**
 * Generates CSV for Supply Plans.
 * Format: h3_index, lat, lng, autos_needed, demand
 */
export const generateCSVContent = (clusters) => {
  const headers = ['h3_index', 'lat', 'lng', 'autos_needed', 'demand'];
  const rows = clusters.map(c => [
    c.hexId,
    c.lat.toFixed(6),
    c.lng.toFixed(6),
    c.allocatedSupply, // Use allocated which reflects optimization if active
    c.demand
  ].join(','));
  return [headers.join(','), ...rows].join('\n');
};

export const generateJSONContent = (clusters) => {
  return JSON.stringify(clusters, null, 2);
};

/**
 * Generates an Aggregated CSV for specific ride statuses (Completed, Cancelled, etc.).
 * Aggregates by Hex ID to provide density map data compatible with Kepler.
 * Format: h3_index, lat, lng, demand
 */
export const generateStatusCSV = (
  rawRides[],
  targetStatus,
  config
) => {
  const hexMap = new Map<string, number>();

  // 1. Filter and Aggregate
  rawRides.forEach(row => {
    const status = row.rideStatus || row.status || row.RideStatus || '';
    if (status.toString().toUpperCase() === targetStatus.toUpperCase()) {
      const lat = parseFloat(row.pickupLat || row.latitude || row.Lat || 0);
      const lng = parseFloat(row.pickupLong || row.longitude || row.Lng || 0);

      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        try {
          const hexIndex = latLngToCell(lat, lng, config.h3Resolution);
          hexMap.set(hexIndex, (hexMap.get(hexIndex) || 0) + 1);
        } catch (e) {
          // Ignore invalid coords
        }
      }
    }
  });

  // 2. Format Output
  const headers = ['h3_index', 'lat', 'lng', 'demand'];
  const rows[] = [];

  hexMap.forEach((count, hexId) => {
    const [lat, lng] = cellToLatLng(hexId);
    rows.push([
      hexId,
      lat.toFixed(6),
      lng.toFixed(6),
      count.toString()
    ].join(','));
  });

  return [headers.join(','), ...rows].join('\n');
};

/**
 * Builds H3Clusters for a specific ride status so they can be visualized on the map.
 */
export const buildStatusClusters = (
  rawRides[],
  targetStatuses[],
  config,
  locationType: 'PICKUP' | 'DROP' = 'PICKUP',
  dateFilter?: { startDate; endDate; timeView?: 'ALL' | 'MORNING' | 'EVENING'; selectedDates?[] },
  startHour | 'ALL' = 'ALL',
  endHour | 'ALL' = 'ALL'
) => {
  const hexMap = new Map<string, number>();

  rawRides.forEach(row => {
    const status = row.rideStatus || row.status || row.RideStatus || '';
    const statusStr = status.toString().toUpperCase();

    // Handle Fish Bowl Logic
    const isFishBowl = targetStatuses.includes('FISH_BOWL');

    // Filter statuses: Remove 'FISH_BOWL' from the check list
    const actualStatuses = targetStatuses.filter(s => s !== 'FISH_BOWL');

    // Status filter (ride_status == X OR Y OR Z ...)
    const isMatch = actualStatuses.length === 0
      ? true
      : actualStatuses.some(s => s.toUpperCase() === statusStr);
    if (!isMatch) return;

    // Drop PENDING from demand logic entirely (matches Excel filter ride_status != PENDING)
    if (statusStr.includes('PENDING')) return;

    // Unique Request filter (same logic as processRideData)
    const uniqueReqKey = Object.keys(row).find(k => k.toLowerCase().includes('unique req'));
    if (uniqueReqKey) {
      const val = row[uniqueReqKey]?.toString().toLowerCase().trim();
      if (val !== 'yes') {
        return;
      }
    }

    let lat = 0;
    let lng = 0;

    if (locationType === 'PICKUP') {
      lat = parseFloat(row.pickupLat || row.latitude || row.Lat || 0);
      lng = parseFloat(row.pickupLong || row.longitude || row.Lng || 0);
    } else {
      lat = parseFloat(row.dropLat || row.drop_lat || row.dropLatitude || 0);
      lng = parseFloat(row.dropLong || row.drop_lng || row.dropLongitude || 0);
    }

    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;

    // Flexible column matching for time and date (reuse processRideData behaviour)
    const hourKey =
      Object.keys(row).find(k => k.toLowerCase() === 'hour') ||
      Object.keys(row).find(k => k.toLowerCase().includes('hour'));
    const hourCol = row.hour || row.Hour || row.HOUR || (hourKey ? row[hourKey] : undefined);

    const dateKey =
      Object.keys(row).find(k => ['date', 'ride_date', 'ride date'].includes(k.toLowerCase())) ||
      Object.keys(row).find(k => k.toLowerCase().includes('date'));
    const dateCol = row.date || row.Date || row.dateCreated || row.rideDate || (dateKey ? row[dateKey] : undefined);

    const timeKey =
      Object.keys(row).find(k =>
        ['time', 'ride_time', 'ride time', 'start_time', 'start time'].includes(k.toLowerCase())
      ) ||
      Object.keys(row).find(k => k.toLowerCase().includes('time'));
    const timeStr =
      row.rideStartTime ||
      row.createdAt ||
      row.timestamp ||
      row.Date ||
      (timeKey ? row[timeKey] : '');

    const date = extractDate(timeStr || dateCol, dateCol);
    const hour = extractHour(timeStr, hourCol);

    // Date filter
    if (dateFilter && !isDateInRange(date, dateFilter.startDate, dateFilter.endDate, dateFilter.selectedDates)) {
      return;
    }

    // Time-range filter (same semantics as processRideData)
    if (startHour !== 'ALL' && endHour !== 'ALL') {
      if (startHour <= endHour) {
        if (hour === null || hour < startHour || hour > endHour) return;
      } else {
        if (hour === null || (hour < startHour && hour > endHour)) return;
      }
    } else if (startHour !== 'ALL') {
      if (hour !== startHour) return;
    } else if (endHour !== 'ALL') {
      if (hour !== endHour) return;
    }

    try {
      const hexIndex = latLngToCell(lat, lng, config.h3Resolution);

      // Apply Fish Bowl Spatial Filter if requested
      if (isFishBowl && !VALID_HEX_IDS.has(hexIndex)) {
        return;
      }

      hexMap.set(hexIndex, (hexMap.get(hexIndex) || 0) + 1);
    } catch {
      // ignore invalid
    }
  });

  if (hexMap.size === 0) {
    return [];
  }

  const entries = Array.from(hexMap.entries());
  const maxDemand = entries.reduce((m, [, d]) => Math.max(m, d), 0);

  return entries
    .map(([hexId, demand]) => {
      const [lat, lng] = cellToLatLng(hexId);
      const userDensity = demand;
      const demandScore = computeDemandScore(demand, userDensity, maxDemand, maxDemand);
      const requiredSupply = calculateSupply(demand, config);

      return {
        hexId,
        lat,
        lng,
        demand,
        userDensity,
        demandScore,
        requiredSupply,
        allocatedSupply: 0,
        slaComplianceScore: demandScore
      };
    })
    .sort((a, b) => b.demandScore - a.demandScore || b.demand - a.demand);
};

/**
 * Simple point CSV for pickup or drop coordinates.
 */
export const generatePickupDropPointCSV = (
  rawRides[],
  mode: 'PICKUP' | 'DROP'
) => {
  const headers = ['lat', 'lng'];
  const rows[] = [];

  rawRides.forEach(row => {
    const lat = mode === 'PICKUP'
      ? parseFloat(row.pickupLat || row.latitude || row.Lat || 0)
      : parseFloat(row.dropLat || row.drop_lat || row.dropLatitude || 0);

    const lng = mode === 'PICKUP'
      ? parseFloat(row.pickupLong || row.longitude || row.Lng || row.Long || 0)
      : parseFloat(row.dropLong || row.drop_lng || row.dropLongitude || 0);

    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;

    rows.push([lat.toFixed(6), lng.toFixed(6)].join(','));
  });

  return [headers.join(','), ...rows].join('\n');
};
