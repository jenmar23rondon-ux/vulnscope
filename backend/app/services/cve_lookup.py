import httpx

from app.config import settings

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
    if settings.enable_live_cve_lookup:
        live_results = _lookup_nvd_cves(service)
        if live_results:
            return live_results
    return DEMO_CVES.get(service, [])


def _lookup_nvd_cves(service: str) -> list[dict]:
    try:
        response = httpx.get(
            settings.nvd_api_url,
            params={"keywordSearch": service, "cvssV3Severity": "HIGH"},
            timeout=8,
        )
        response.raise_for_status()
        items = response.json().get("vulnerabilities", [])[:5]
        results = []
        for item in items:
            cve = item.get("cve", {})
            metrics = cve.get("metrics", {})
            cvss = (
                metrics.get("cvssMetricV31", [{}])[0].get("cvssData", {})
                or metrics.get("cvssMetricV30", [{}])[0].get("cvssData", {})
            )
            descriptions = cve.get("descriptions", [])
            description = next((entry["value"] for entry in descriptions if entry.get("lang") == "en"), "CVE match from NVD.")
            results.append(
                {
                    "cve": cve.get("id", "CVE-UNKNOWN"),
                    "severity": cvss.get("baseSeverity", "HIGH"),
                    "description": description[:500],
                    "cvss_score": float(cvss.get("baseScore", 7.0)),
                }
            )
        return results
    except Exception:
        return []
