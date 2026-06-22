DEMO_CVES = {
    "http": [
        {
            "cve": "CVE-2021-41773",
            "severity": "HIGH",
            "description": "Apache path traversal exposure used as a demo vulnerability match.",
            "cvss_score": 7.5,
        }
    ],
    "https": [
        {
            "cve": "CVE-2023-44487",
            "severity": "MEDIUM",
            "description": "HTTP/2 rapid reset risk pattern used for portfolio demonstration.",
            "cvss_score": 6.5,
        }
    ],
    "ssh": [
        {
            "cve": "CVE-2023-38408",
            "severity": "MEDIUM",
            "description": "OpenSSH agent forwarding risk example for service exposure awareness.",
            "cvss_score": 5.9,
        }
    ],
    "postgresql": [
        {
            "cve": "CVE-2024-10979",
            "severity": "HIGH",
            "description": "PostgreSQL service exposure risk example requiring hardening review.",
            "cvss_score": 8.1,
        }
    ],
}


def lookup_cves(service: str) -> list[dict]:
    return DEMO_CVES.get(service, [])
