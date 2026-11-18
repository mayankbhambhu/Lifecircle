"""Geospatial ranking for Urgent mode.

Donors are ranked by great-circle (haversine) distance to where the blood is
needed (the patient's blood bank). A cheap bounding-box pre-filter discards far
away donors before the trigonometry runs; in production the same box maps 1:1
onto an indexed lat/lng range query (or PostGIS `ST_DWithin`).

Broadcast widens in rings so the closest people are asked first and nobody
30 km away is woken up while someone 2 km away hasn't been asked yet.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable, TypeVar

EARTH_RADIUS_KM = 6371.0088
ESCALATION_RINGS_KM = (5.0, 10.0, 25.0, 50.0)

T = TypeVar("T")


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def bounding_box(lat: float, lng: float, radius_km: float) -> tuple[float, float, float, float]:
    """(min_lat, max_lat, min_lng, max_lng) of a box that fully contains the circle."""
    dlat = math.degrees(radius_km / EARTH_RADIUS_KM)
    cos_lat = max(math.cos(math.radians(lat)), 1e-6)
    dlng = math.degrees(radius_km / (EARTH_RADIUS_KM * cos_lat))
    return lat - dlat, lat + dlat, lng - dlng, lng + dlng


@dataclass
class Ranked:
    item: object
    distance_km: float

    @property
    def label(self) -> str:
        return format_distance(self.distance_km)


def rank_by_distance(
    origin: tuple[float, float],
    items: Iterable[T],
    coords,  # callable: item -> (lat, lng)
    radius_km: float | None = None,
    min_radius_km: float = 0.0,
    limit: int | None = None,
    tiebreak=None,  # callable: item -> sortable, applied after distance
) -> list[Ranked]:
    lat0, lng0 = origin
    box = bounding_box(lat0, lng0, radius_km) if radius_km else None
    out: list[Ranked] = []
    for it in items:
        lat, lng = coords(it)
        if box and not (box[0] <= lat <= box[1] and box[2] <= lng <= box[3]):
            continue
        dist = haversine_km(lat0, lng0, lat, lng)
        if radius_km is not None and dist > radius_km:
            continue
        if dist < min_radius_km:
            continue
        out.append(Ranked(it, dist))
    out.sort(key=lambda r: (round(r.distance_km, 2), tiebreak(r.item) if tiebreak else 0))
    return out[:limit] if limit else out


def format_distance(km: float) -> str:
    if km < 1:
        return f"{int(round(km * 1000, -1))} m"
    return f"{km:.1f} km"


def next_ring(current_radius: float | None) -> float | None:
    """Next broadcast radius, or None when the widest ring has been used."""
    if current_radius is None:
        return ESCALATION_RINGS_KM[0]
    for r in ESCALATION_RINGS_KM:
        if r > current_radius:
            return r
    return None
