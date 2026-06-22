WEIGHTS = {"LOW": 8, "MEDIUM": 18, "HIGH": 30, "CRITICAL": 45}


def calculate_risk(open_ports: int, vulnerabilities: list[dict]) -> int:
    base = min(open_ports * 8, 35)
    vuln_score = sum(WEIGHTS.get(vulnerability["severity"], 10) for vulnerability in vulnerabilities)
    return min(base + vuln_score, 100)
