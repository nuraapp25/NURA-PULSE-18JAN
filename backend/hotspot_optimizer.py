#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hotspot optimizer for maximum coverage with N circles (radius=1km).

Algorithm:
  - Candidate generation: H3 hex centroids where demand exists (fallback to raw points).
  - Neighborhoods: BallTree (haversine), 1km radius.
  - Selection: Greedy Maximum Coverage using CELF (lazy evaluation).
  - Local improvement: 1-swap to close remaining gap.
"""

import numpy as np
import pandas as pd
from sklearn.neighbors import BallTree
from typing import List, Tuple, Optional
import logging
import os
import requests

logger = logging.getLogger(__name__)

EARTH_RADIUS_M = 6371000.0
R_METERS = 1000.0
R_RADIANS = R_METERS / EARTH_RADIUS_M

# Time slot definitions
TIME_SLOTS = [
    {"name": "Morning Rush", "label": "6AM-9AM", "start": 6, "end": 9},
    {"name": "Mid-Morning", "label": "9AM-12PM", "start": 9, "end": 12},
    {"name": "Afternoon", "label": "12PM-4PM", "start": 12, "end": 16},
    {"name": "Evening Rush", "label": "4PM-7PM", "start": 16, "end": 19},
    {"name": "Night", "label": "7PM-10PM", "start": 19, "end": 22},
    {"name": "Late Night", "label": "10PM-1AM", "start": 22, "end": 25}  # 25 means 1AM next day
]


def get_locality_name(lat: float, lon: float) -> str:
    """Get locality name from coordinates using Google Maps Geocoding API."""
    try:
        api_key = os.environ.get('GOOGLE_MAPS_API_KEY')
        if not api_key:
            return "Unknown"
        
        url = f"https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lon}&key={api_key}"
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'OK' and data.get('results'):
                # Try to find locality/sublocality from address components
                for result in data['results']:
                    for component in result.get('address_components', []):
                        if 'sublocality' in component.get('types', []):
                            return component.get('long_name', 'Unknown')
                        elif 'locality' in component.get('types', []):
                            return component.get('long_name', 'Unknown')
                
                # Fallback to formatted address (first part)
                formatted = data['results'][0].get('formatted_address', 'Unknown')
                # Get first part before comma
                return formatted.split(',')[0] if ',' in formatted else formatted
        
        return "Unknown"
    except Exception as e:
        logger.error(f"Geocoding error: {e}")
        return "Unknown"


def generate_candidates_h3(pts: np.ndarray, res: int = 9) -> np.ndarray:
    """Generate H3 hex centroids as candidate locations."""
    try:
        import h3
        hexes = [h3.geo_to_h3(lat, lon, res) for lat, lon in pts]
        unique_hex = list(set(hexes))
        if not unique_hex:
            return np.empty((0, 2))
        centers = np.array([h3.h3_to_geo(hx) for hx in unique_hex], dtype=float)
        return centers
    except Exception as e:
        logger.warning(f"H3 generation failed: {e}")
        return np.empty((0, 2))


def build_balltree_rad(pts_deg: np.ndarray) -> BallTree:
    """Build BallTree with haversine metric."""
    return BallTree(np.radians(pts_deg), metric="haversine")


def query_radius_sets(tree: BallTree, centers_deg: np.ndarray, r_rad: float) -> List[np.ndarray]:
    """Query which points are within radius of each center."""
    centers_rad = np.radians(centers_deg)
    ind_list = tree.query_radius(centers_rad, r=r_rad)
    return [np.asarray(ix, dtype=int) for ix in ind_list]


def celf_greedy(coverage_sets: List[np.ndarray],
                weights: np.ndarray,
                N: int) -> Tuple[List[int], List[np.ndarray], float, np.ndarray]:
    """
    CELF greedy selection with lazy evaluation.
    
    Returns:
        chosen_indices: indices of selected candidates
        cover_sets: list of covered pickup indices per chosen hotspot
        total_covered_weight: total weight of covered points
        covered_mask: boolean array indicating which points are covered
    """
    M = len(weights)
    covered = np.zeros(M, dtype=bool)

    # Initial gains: (negative_gain, candidate_idx, last_update_round, positive_gain)
    gains = []
    for k, idxs in enumerate(coverage_sets):
        if len(idxs) == 0:
            g = 0.0
        else:
            g = float(weights[idxs].sum())
        gains.append([-g, k, 0, g])

    chosen = []
    chosen_cover_sets = []
    round_id = 0

    for _ in range(N):
        improved = False
        while gains:
            gains.sort()  # Sort by negative gain (largest positive first)
            neg_gain, k, last_upd, pos_gain = gains[0]
            
            if last_upd == round_id:
                # Up-to-date; select this candidate
                if pos_gain <= 1e-12:
                    # No more uncovered gain
                    return chosen, chosen_cover_sets, float(weights[covered].sum()), covered
                
                chosen.append(k)
                idxs = coverage_sets[k]
                newly = idxs[~covered[idxs]]
                chosen_cover_sets.append(newly)
                covered[newly] = True
                gains.pop(0)
                improved = True
                round_id += 1
                break
            else:
                # Recompute marginal gain
                idxs = coverage_sets[k]
                mg = 0.0 if len(idxs) == 0 else float(weights[idxs[~covered[idxs]]].sum())
                gains[0] = [-mg, k, round_id, mg]
        
        if not improved:
            break

    total = float(weights[covered].sum())
    return chosen, chosen_cover_sets, total, covered


def one_swap_local_search(chosen: List[int],
                          coverage_sets: List[np.ndarray],
                          weights: np.ndarray,
                          covered_mask: np.ndarray,
                          max_iters: int = 3) -> Tuple[List[int], List[np.ndarray], float, np.ndarray]:
    """
    1-swap local search improvement.
    
    Try replacing each chosen candidate with each unchosen candidate
    to see if total coverage increases.
    """
    M = len(weights)
    
    for _ in range(max_iters):
        improved = False
        chosen_set = set(chosen)
        
        # Build coverage counts per point
        counts = np.zeros(M, dtype=int)
        for k in chosen:
            counts[coverage_sets[k]] += 1
        
        current_total = float(weights[counts > 0].sum())
        
        # Cache add gains for unchosen candidates
        all_indices = range(len(coverage_sets))
        unchosen = [k for k in all_indices if k not in chosen_set]
        add_gain_cache = {}
        
        for u in unchosen:
            idxs = coverage_sets[u]
            if len(idxs) == 0:
                add_gain_cache[u] = 0.0
            else:
                add_gain_cache[u] = float(weights[idxs[counts[idxs] == 0]].sum())
        
        best_delta = 0.0
        best_swap = None
        
        # Try all swaps
        for c in chosen:
            idxs_c = coverage_sets[c]
            loss = 0.0
            if len(idxs_c):
                sole = idxs_c[counts[idxs_c] == 1]
                if len(sole):
                    loss = float(weights[sole].sum())
            
            for u in unchosen:
                gain = add_gain_cache[u]
                delta = gain - loss
                if delta > best_delta + 1e-12:
                    best_delta = delta
                    best_swap = (c, u)
        
        if best_swap is not None:
            c, u = best_swap
            chosen.remove(c)
            chosen.append(u)
            
            # Recompute covered mask
            new_counts = np.zeros(M, dtype=int)
            for k in chosen:
                new_counts[coverage_sets[k]] += 1
            covered_mask = new_counts > 0
            improved = True
        
        if not improved:
            break
    
    total = float(weights[covered_mask].sum())
    
    # Produce cover sets for final chosen
    cover_sets_final = []
    for k in chosen:
        idxs = coverage_sets[k]
        cover_sets_final.append(idxs)
    
    return chosen, cover_sets_final, total, covered_mask


def assign_points_to_hotspots(points: np.ndarray,
                              candidates: np.ndarray,
                              chosen_ids: List[int]) -> np.ndarray:
    """
    Assign each point to its nearest chosen hotspot within 1km.
    
    Returns array of assigned ranks (0 if no hotspot within 1km).
    """
    if len(chosen_ids) == 0:
        return np.zeros(len(points), dtype=int)
    
    chosen_coords = candidates[chosen_ids]
    tree = BallTree(np.radians(chosen_coords), metric="haversine")
    dist, idx = tree.query(np.radians(points), k=1)
    meters = dist.flatten() * EARTH_RADIUS_M
    nearest_rank = idx.flatten() + 1  # ranks are 1-based
    nearest_rank[meters > R_METERS] = 0  # outside 1km → unassigned
    return nearest_rank


def optimize_hotspots(df: pd.DataFrame, N: int = 10, h3_res: int = 9, 
                     use_h3: bool = True) -> dict:
    """
    Main function to optimize hotspot locations for a given time slot.
    
    Args:
        df: DataFrame with columns ['lat', 'lon', 'weight'] and optionally ['pickup_point']
        N: Number of hotspots to find (default: 10)
        h3_res: H3 resolution (8-10 typical)
        use_h3: Whether to use H3 for candidate generation
    
    Returns:
        dict with hotspots, coverage metrics, and geojson data
    """
    if df.empty:
        return {
            "hotspots": [],
            "total_rides": 0,
            "covered_rides": 0,
            "coverage_percentage": 0.0,
            "geojson": {"type": "FeatureCollection", "features": []}
        }
    
    pts = df[["lat", "lon"]].to_numpy(dtype=float)
    weights = df["weight"].to_numpy(dtype=float)
    
    # Extract pickup_point if available
    pickup_points = df["pickup_point"].tolist() if "pickup_point" in df.columns else [None] * len(pts)
    
    # Generate candidates
    if use_h3:
        cand = generate_candidates_h3(pts, res=h3_res)
        if cand.shape[0] == 0:
            # Fallback to deduplicated raw points
            cand = np.unique(np.round(pts, 6), axis=0)
            logger.info(f"H3 failed, using {cand.shape[0]} raw point candidates")
    else:
        cand = np.unique(np.round(pts, 6), axis=0)
        logger.info(f"Using {cand.shape[0]} raw point candidates")
    
    # Build BallTree and get coverage sets
    tree = build_balltree_rad(pts)
    coverage_sets = query_radius_sets(tree, cand, R_RADIANS)
    
    # CELF Greedy selection
    chosen_ids, cover_sets, total_weight, covered_mask = celf_greedy(
        coverage_sets, weights, N
    )
    
    # 1-swap local improvement
    chosen_ids, cover_sets, total_weight, covered_mask = one_swap_local_search(
        chosen_ids, coverage_sets, weights, covered_mask, max_iters=3
    )
    
    # Assign points to hotspots
    assignment = assign_points_to_hotspots(pts, cand, chosen_ids)
    
    # Build results
    hotspots = []
    for rank, (k, idxs) in enumerate(zip(chosen_ids, cover_sets), start=1):
        lat, lon = cand[k]
        covered_weight = float(weights[idxs].sum()) if len(idxs) else 0.0
        locality = get_locality_name(lat, lon)
        hotspots.append({
            "rank": rank,
            "lat": float(lat),
            "lon": float(lon),
            "locality": locality,
            "covered_count": int(len(idxs)),
            "covered_weight": covered_weight
        })
    
    # Build GeoJSON
    features = []
    
    # Add hotspot circles
    for hs in hotspots:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [hs["lon"], hs["lat"]]
            },
            "properties": {
                "type": "hotspot",
                "rank": hs["rank"],
                "radius_m": R_METERS,
                "covered_count": hs["covered_count"],
                "covered_weight": hs["covered_weight"]
            }
        })
    
    # Add pickup points
    for i, (lat, lon) in enumerate(pts):
        props = {
            "type": "pickup",
            "assigned_rank": int(assignment[i]),
            "weight": float(weights[i])
        }
        # Add pickup_point if available
        if pickup_points[i] is not None:
            props["pickup_point"] = str(pickup_points[i])
            
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(lon), float(lat)]
            },
            "properties": props
        })
    
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    total_rides = int(len(pts))
    covered_rides = int(covered_mask.sum())
    coverage_percentage = (covered_rides / total_rides * 100) if total_rides > 0 else 0.0
    
    return {
        "hotspots": hotspots,
        "total_rides": total_rides,
        "covered_rides": covered_rides,
        "coverage_percentage": round(coverage_percentage, 2),
        "geojson": geojson
    }
