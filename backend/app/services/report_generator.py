import csv
from io import BytesIO, StringIO

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


def generate_scan_pdf(scan) -> bytes:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(48, height - 60, "VulnScope Vulnerability Report")
    pdf.setFont("Helvetica", 11)
    pdf.drawString(48, height - 90, f"Target: {scan.target}")
    pdf.drawString(48, height - 108, f"Risk score: {scan.risk_score}")
    pdf.drawString(48, height - 126, f"Status: {scan.status}")

    y = height - 165
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(48, y, "Open Ports")
    y -= 22
    pdf.setFont("Helvetica", 10)
    for port in [port for port in scan.ports if port.state == "open"][:12]:
        pdf.drawString(58, y, f"{port.port}/{port.protocol} - {port.service} - {port.state}")
        y -= 16

    y -= 12
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(48, y, "Vulnerabilities")
    y -= 22
    pdf.setFont("Helvetica", 10)
    for vuln in scan.vulnerabilities[:12]:
        pdf.drawString(58, y, f"{vuln.cve} - {vuln.severity} - CVSS {vuln.cvss_score}")
        y -= 16
        pdf.drawString(68, y, vuln.description[:95])
        y -= 20

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def generate_scan_csv(scan) -> str:
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["target", "port", "service", "state", "cve", "severity", "cvss_score"])
    for port in scan.ports:
        if scan.vulnerabilities:
            for vuln in scan.vulnerabilities:
                writer.writerow([scan.target, port.port, port.service, port.state, vuln.cve, vuln.severity, vuln.cvss_score])
        else:
            writer.writerow([scan.target, port.port, port.service, port.state, "", "", ""])
    return output.getvalue()
