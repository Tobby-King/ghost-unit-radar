"""Central configuration for Ghost Unit Radar. Every threshold used in scoring lives here
so that it is documented in one place and can be changed for sensitivity analysis."""
from dataclasses import dataclass, field


@dataclass
class Config:
    # --- Location integrity -------------------------------------------------------------
    # Loose bounding box around Nigeria (deg). Points outside are certainly not in Nigeria.
    nigeria_bbox: tuple = (2.60, 4.20, 14.75, 13.95)  # (min_lon, min_lat, max_lon, max_lat)
    # Simplified state polygons are coarse; points within this distance of the claimed
    # state's border are NOT flagged as "wrong state".
    border_tolerance_km: float = 3.0
    stack_min: int = 10        # >= this many units on one exact point = stacked cluster
    stack_severe: int = 50

    # --- Catchment model ----------------------------------------------------------------
    radius_km: float = 1.0
    # Share of total population aged 18+. Nigeria's population is very young; UN WPP 2022
    # puts ~43% under 15 and ~6-7% aged 15-17, so ~50% are 18+. Used only with the 1 km
    # total-population raster. The Earth Engine path uses WorldPop age bins instead.
    adult_share: float = 0.50
    # Registration rate used to GENERATE synthetic registers (not to score them).
    synth_registration_rate: tuple = (0.55, 0.95)

    # --- Plausibility (synthetic registers) ---------------------------------------------
    ratio_amber: float = 1.2   # registered voters / estimated adults served by the unit
    ratio_red: float = 2.0
    ratio_severe: float = 3.0
    empty_catchment_adults: float = 250.0
    empty_catchment_multiple: float = 2.0   # register > this x adults in the whole radius
    voters_per_building_red: float = 15.0

    # --- Clock audit (synthetic result sheets) ------------------------------------------
    polling_hours: float = 6.0          # 08:30 - 14:30
    seconds_per_voter: float = 45.0     # configurable; sensitivity 30-120
    seconds_per_voter_fastest: float = 30.0
    sensitivity_seconds: tuple = (30, 45, 60, 90, 120)

    # --- Score bands --------------------------------------------------------------------
    green_min: int = 70
    amber_min: int = 40

    seed: int = 2027
    anomalies_per_state: int = 30
    demo_state: str = "KANO"
    extra: dict = field(default_factory=dict)


DEFAULT = Config()
