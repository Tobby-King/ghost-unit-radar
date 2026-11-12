"""SYNTHETIC registers and result sheets. NOT real INEC data.

The hackathon rules require synthetic data, so registered-voter numbers and result sheets
are generated here from realistic distributions, then a known set of anomalies is planted.
The ground truth of planted anomalies is written out so detection can be measured.
"""
import math
import random

ANOMALY_TYPES = ("INFLATED_REGISTER", "EMPTY_CATCHMENT", "CLOCK_IMPOSSIBLE")
NATIONAL_MEAN_REGISTER = 530  # ~93.5m registered / ~176.8k units (INEC 2023)


def base_register(rng, adults_share, cfg):
    """Realistic register for a unit given the adults it plausibly serves."""
    if adults_share is None:
        return int(max(40, min(2500, rng.lognormvariate(math.log(NATIONAL_MEAN_REGISTER), 0.55))))
    lo, hi = cfg.synth_registration_rate
    reg = adults_share * rng.uniform(lo, hi) * rng.lognormvariate(0, 0.15)
    return int(max(25, min(1800, reg)))


def devices_for(register):
    # INEC deploys extra BVAS to very large units; approximate with one per 1,250 voters.
    return 1 + register // 1250


def base_sheet(rng, register):
    turnout = min(0.85, max(0.08, rng.gauss(0.29, 0.09)))  # 2023 national turnout ~27%
    return int(register * turnout)


def generate(units, cfg):
    """units: list of dicts with uid, state, adults_share (or None), reliable (bool).
    Returns (registers, sheets, planted) keyed by uid."""
    rng = random.Random(cfg.seed)
    registers, sheets = {}, {}
    for u in units:
        reg = base_register(rng, u.get("adults_share"), cfg)
        registers[u["uid"]] = reg
        sheets[u["uid"]] = {"accredited": base_sheet(rng, reg), "devices": devices_for(reg)}

    planted = {}
    by_state = {}
    for u in units:
        if u.get("reliable"):
            by_state.setdefault(u["state"], []).append(u)
    n = cfg.anomalies_per_state
    n_infl, n_empty = int(n * 0.4), int(n * 0.27)
    n_clock = n - n_infl - n_empty
    for state in sorted(by_state):
        pool = sorted(by_state[state], key=lambda u: u["uid"])
        if len(pool) < n * 3:
            continue
        sparse = sorted(pool, key=lambda u: u["adults_in_radius"])[: max(n_empty * 4, 20)]
        empty = rng.sample(sparse, n_empty)
        used = {u["uid"] for u in empty}
        rest = [u for u in pool if u["uid"] not in used and u["adults_share"] > 40]
        picks = rng.sample(rest, n_infl + n_clock)
        for u in empty:
            registers[u["uid"]] = rng.randint(1200, 1800)
            sheets[u["uid"]] = {"accredited": base_sheet(rng, registers[u["uid"]]),
                                "devices": devices_for(registers[u["uid"]])}
            planted[u["uid"]] = "EMPTY_CATCHMENT"
        for u in picks[:n_infl]:
            registers[u["uid"]] = int(min(4000, max(registers[u["uid"]] * rng.uniform(4, 8),
                                                    u["adults_share"] * rng.uniform(3.2, 6))))
            sheets[u["uid"]]["accredited"] = base_sheet(rng, min(registers[u["uid"]], 900))
            planted[u["uid"]] = "INFLATED_REGISTER"
        for u in picks[n_infl:]:
            dev = sheets[u["uid"]]["devices"]
            cap = int(cfg.polling_hours * 3600 // cfg.seconds_per_voter_fastest) * dev
            registers[u["uid"]] = max(registers[u["uid"]], int(cap * 1.6))
            sheets[u["uid"]] = {"accredited": int(cap * rng.uniform(1.15, 1.5)), "devices": dev}
            planted[u["uid"]] = "CLOCK_IMPOSSIBLE"
    return registers, sheets, planted
