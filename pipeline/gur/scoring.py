"""Check 2 (rooftop / population plausibility) and the combined triage score.

The score is 0-100, where 100 = nothing unusual. It is a TRIAGE score for deciding where to
send field checks. It never asserts fraud: every reason carries an innocent explanation.
"""


def plausibility_reasons(register, adults_share, catchment, cfg, buildings=None):
    """register: (synthetic) registered voters for the unit.
    adults_share: estimated adults within the radius divided by the number of units there.
    catchment: dict with adults_in_radius, units_in_radius, reliable (bool).
    buildings: optional dict with latest / y2016 counts in the radius."""
    reasons = []
    if not catchment.get("reliable", False):
        return reasons
    adults = catchment["adults_in_radius"]
    r_km = cfg.radius_km

    if adults < cfg.empty_catchment_adults and register > cfg.empty_catchment_multiple * adults:
        reasons.append({
            "code": "EMPTY_CATCHMENT", "source": "SYNTHETIC", "penalty": 65,
            "text": (f"{register:,} registered voters, but satellite data estimates only "
                     f"~{adults:,.0f} adults living within {r_km:g} km."),
            "innocent": "Unit serves a scattered rural area wider than the radius, or its coordinate is wrong.",
        })
    elif adults_share > 0:
        ratio = register / adults_share
        if ratio >= cfg.ratio_amber:
            pen = 65 if ratio >= cfg.ratio_severe else 45 if ratio >= cfg.ratio_red else 25
            reasons.append({
                "code": "REGISTER_ABOVE_ADULTS", "source": "SYNTHETIC", "penalty": pen,
                "text": (f"Register is {ratio:.1f}x the adults this unit plausibly serves "
                         f"({register:,} registered vs ~{adults_share:,.0f} adults per unit within {r_km:g} km)."),
                "innocent": "Voters registered here but moved away (register not cleaned), "
                            "new estate not yet in population data, or units share one catchment.",
                "ratio": round(ratio, 2),
            })

    if buildings is not None and buildings.get("latest") is not None:
        b = buildings["latest"]
        per_b = register / b if b > 0 else float("inf")
        if per_b >= cfg.voters_per_building_red:
            reasons.append({
                "code": "FEW_ROOFTOPS", "source": "SYNTHETIC", "penalty": 30,
                "text": f"{register:,} registered voters but only {b:,} rooftops within {r_km:g} km.",
                "innocent": "Large compounds/high-rise blocks, or building footprints missing under tree cover.",
            })
        if buildings.get("y2016") == 0 and b > 0:
            reasons.append({
                "code": "NEW_BUILDINGS", "source": "REAL", "penalty": 0,
                "text": "No buildings existed within the radius in 2016; all were built later.",
                "innocent": "Genuinely new settlement - check the unit was created after people arrived.",
            })
    return reasons


def score(reasons):
    total = sum(r.get("penalty", 0) for r in reasons)
    return max(0, min(100, 100 - total))


def band(s, cfg, has_coordinate=True):
    if not has_coordinate:
        return "grey"
    if s >= cfg.green_min:
        return "green"
    if s >= cfg.amber_min:
        return "amber"
    return "red"
