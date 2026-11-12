"""Check 3 - Clock audit. Is an accredited-voter total physically possible?

max_accredited = polling_hours * 3600 / seconds_per_voter * bvas_devices

The BVAS accreditation time per voter is uncertain (roughly 30-120 s), so we flag:
  * CLOCK_IMPOSSIBLE  - above the maximum even at the FASTEST plausible speed (default 30 s)
  * CLOCK_IMPLAUSIBLE - above the maximum at the TYPICAL speed (default 45 s)
Result sheets used in the demo are SYNTHETIC.
"""


def max_accredited(polling_hours, seconds_per_voter, devices):
    if seconds_per_voter <= 0 or devices <= 0 or polling_hours <= 0:
        raise ValueError("hours, seconds_per_voter and devices must be positive")
    return int(polling_hours * 3600 // seconds_per_voter) * int(devices)


def audit_sheet(accredited, devices, cfg):
    """Return a reason dict or None."""
    fastest = max_accredited(cfg.polling_hours, cfg.seconds_per_voter_fastest, devices)
    typical = max_accredited(cfg.polling_hours, cfg.seconds_per_voter, devices)
    if accredited > fastest:
        return {
            "code": "CLOCK_IMPOSSIBLE", "source": "SYNTHETIC", "penalty": 50,
            "text": (f"{accredited:,} voters accredited on {devices} BVAS device(s); even at "
                     f"{cfg.seconds_per_voter_fastest:g} s per voter for {cfg.polling_hours:g} h "
                     f"the maximum is {fastest:,}."),
            "innocent": "Late close / extended polling hours, a device not recorded, or a data-entry error.",
        }
    if accredited > typical:
        return {
            "code": "CLOCK_IMPLAUSIBLE", "source": "SYNTHETIC", "penalty": 20,
            "text": (f"{accredited:,} accredited is above the {typical:,} possible at a typical "
                     f"{cfg.seconds_per_voter:g} s per voter on {devices} device(s)."),
            "innocent": "Fast accreditation, voters queued before close were served after 14:30, or extra devices.",
        }
    return None


def sensitivity(accredited, devices, cfg):
    """Max possible and pass/fail at each seconds-per-voter value."""
    out = []
    for s in cfg.sensitivity_seconds:
        m = max_accredited(cfg.polling_hours, s, devices)
        out.append({"seconds_per_voter": s, "max": m, "exceeds": accredited > m})
    return out
