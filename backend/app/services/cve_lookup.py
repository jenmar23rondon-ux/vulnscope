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
    normalized_service = service.lower()
    if settings.enable_live_cve_lookup:
        live_results = _lookup_nvd_cves(service)
        if live_results:
            return live_results
    for key, findings in DEMO_CVES.items():
        if key in normalized_service:
            return findings
    return []


def _lookup_nvd_cves(service: str) -> list[dict]:
    try:
        response = httpx.get(
            settings.nvd_api_url,
            params={"keywordSearch": service[:120]},
            timeout=8,
        )
        response.raise_for_status()
        items = response.json().get("vulnerabilities", [])[:5]
        results = []
        for item in items:
            cve = item.get("cve", {})
            metrics = cve.get("metrics", {})
            cvss = _extract_cvss(metrics)
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


def _extract_cvss(metrics: dict) -> dict:
    for key in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
        values = metrics.get(key, [])
        if values:
            metric = values[0]
            cvss_data = metric.get("cvssData", {})
            if "baseSeverity" not in cvss_data and "baseSeverity" in metric:
                cvss_data["baseSeverity"] = metric["baseSeverity"]
            return cvss_data
    return {"baseSeverity": "MEDIUM", "baseScore": 5.0}
