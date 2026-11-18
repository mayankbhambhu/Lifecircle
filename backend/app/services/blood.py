"""Blood group compatibility for red-cell transfusion (ABO + RhD)."""

BLOOD_GROUPS = ("O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+")


def _split(group: str) -> tuple[str, str]:
    group = group.strip().upper()
    if group not in BLOOD_GROUPS:
        raise ValueError(f"Unknown blood group: {group!r}")
    return group[:-1], group[-1]


def can_donate_rbc(donor_group: str, recipient_group: str) -> bool:
    """True if red cells from `donor_group` are ABO/Rh compatible with `recipient_group`."""
    d_abo, d_rh = _split(donor_group)
    r_abo, r_rh = _split(recipient_group)
    abo_ok = d_abo == "O" or d_abo == r_abo or r_abo == "AB"
    rh_ok = d_rh == "-" or r_rh == "+"
    return abo_ok and rh_ok


def compatible_donor_groups(recipient_group: str) -> list[str]:
    return [g for g in BLOOD_GROUPS if can_donate_rbc(g, recipient_group)]


def is_exact_match(donor_group: str, recipient_group: str) -> bool:
    """Chronically transfused patients (e.g. thalassemia) should get ABO/Rh-identical blood
    whenever possible to limit alloimmunisation, so exact matches are preferred."""
    return _split(donor_group) == _split(recipient_group)
