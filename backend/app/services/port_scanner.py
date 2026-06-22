import socket
import shutil
import subprocess
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

from app.config import settings
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

    if settings.use_nmap and shutil.which("nmap"):
        return _scan_ports_with_nmap(target, selected_ports)

    with ThreadPoolExecutor(max_workers=20) as executor:
        results = list(executor.map(lambda port: _scan_port(target, port), selected_ports))

    return sorted(results, key=lambda item: item["port"])


def _scan_ports_with_nmap(target: str, ports: list[int]) -> list[dict]:
    command = [
        "nmap",
        "-sT",
        "-Pn",
        "-p",
        ",".join(str(port) for port in ports),
        "-oX",
        "-",
        target,
    ]
    try:
        output = subprocess.check_output(command, text=True, timeout=45)
        root = ET.fromstring(output)
        results_by_port: dict[int, dict] = {}
        for port_node in root.findall(".//port"):
            port_number = int(port_node.attrib["portid"])
            state = port_node.find("state").attrib.get("state", "closed")
            service_node = port_node.find("service")
            service = service_node.attrib.get("name", detect_service(port_number)) if service_node is not None else detect_service(port_number)
            results_by_port[port_number] = {
                "port": port_number,
                "protocol": port_node.attrib.get("protocol", "tcp"),
                "service": service,
                "state": "open" if state == "open" else "closed",
            }
        return [results_by_port.get(port, _closed_port(port)) for port in ports]
    except Exception:
        return [_scan_port(target, port) for port in ports]


def _closed_port(port: int) -> dict:
    return {
        "port": port,
        "protocol": "tcp",
        "service": detect_service(port),
        "state": "closed",
    }
