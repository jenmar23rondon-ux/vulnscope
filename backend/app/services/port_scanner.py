import socket
from concurrent.futures import ThreadPoolExecutor

from app.services.service_detector import detect_service

COMMON_PORTS = [21, 22, 25, 53, 80, 110, 143, 443, 3306, 5432, 6379, 8000, 8080]


def _scan_port(target: str, port: int, timeout: float = 0.35) -> dict:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(timeout)
        result = sock.connect_ex((target, port))
        state = "open" if result == 0 else "closed"
        return {
            "port": port,
            "protocol": "tcp",
            "service": detect_service(port),
            "state": state,
        }


def scan_ports(target: str, ports: list[int] | None = None) -> list[dict]:
    selected_ports = ports or COMMON_PORTS
    selected_ports = [port for port in selected_ports if 1 <= port <= 65535][:50]

    with ThreadPoolExecutor(max_workers=20) as executor:
        results = list(executor.map(lambda port: _scan_port(target, port), selected_ports))

    return sorted(results, key=lambda item: item["port"])
