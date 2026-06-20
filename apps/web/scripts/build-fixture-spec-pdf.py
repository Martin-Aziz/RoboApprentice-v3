#!/usr/bin/env python3
import json
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle
)

DISCLAIMER = "This fixture design is a starting point. Have a qualified person verify dimensions before production use."


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#475569"))
    canvas.drawCentredString(letter[0] / 2, 0.42 * inch, DISCLAIMER)
    canvas.drawRightString(letter[0] - 0.65 * inch, 0.42 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build(input_path, output_path):
    design = json.loads(Path(input_path).read_text(encoding="utf-8"))
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="AurevixTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=24, leading=28, textColor=colors.HexColor("#0F172A"), alignment=0, spaceAfter=8))
    styles.add(ParagraphStyle(name="AurevixH1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=15, leading=18, textColor=colors.HexColor("#0284C7"), spaceBefore=12, spaceAfter=7))
    styles.add(ParagraphStyle(name="SmallMuted", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.5, leading=11, textColor=colors.HexColor("#475569")))
    styles["BodyText"].fontName = "Helvetica"
    styles["BodyText"].fontSize = 10
    styles["BodyText"].leading = 14

    doc = BaseDocTemplate(output_path, pagesize=letter, leftMargin=0.7*inch, rightMargin=0.7*inch, topMargin=0.65*inch, bottomMargin=0.75*inch)
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates(PageTemplate(id="fixture", frames=frame, onPage=footer))
    story = [
        Paragraph("AUREVIX | FIXTURE & JIG", styles["SmallMuted"]),
        Spacer(1, 8),
        Paragraph("Fixture Design Specification", styles["AurevixTitle"]),
        Paragraph(f"{design['fixture_type']} | {design['material_recommendation']} | Fixture ID {design['fixture_id']}", styles["SmallMuted"]),
        Spacer(1, 15),
    ]
    warning = Table([[Paragraph("<b>QUALIFIED VERIFICATION REQUIRED</b><br/>" + DISCLAIMER, styles["BodyText"])]], colWidths=[doc.width])
    warning.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#FDECEC")), ("BOX",(0,0),(-1,-1),0.6,colors.HexColor("#DC2626")), ("LEFTPADDING",(0,0),(-1,-1),12), ("RIGHTPADDING",(0,0),(-1,-1),12), ("TOPPADDING",(0,0),(-1,-1),10), ("BOTTOMPADDING",(0,0),(-1,-1),10)]))
    story += [warning, Paragraph("1  Key dimensions", styles["AurevixH1"])]

    rows = [["Dimension", "Nominal", "Tolerance"]]
    for name, value in design["specification"]["dimensions"].items():
        unit = "deg" if "degrees" in name else "mm"
        rows.append([name.replace("_", " ").title(), f"{value['nominal_mm']} {unit}", f"+/- {value['tolerance_mm']} {unit}"])
    table = Table(rows, colWidths=[3.1*inch, 1.45*inch, 1.45*inch], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0),colors.HexColor("#E8EEF5")), ("TEXTCOLOR",(0,0),(-1,0),colors.HexColor("#0F172A")),
        ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"), ("FONTNAME",(0,1),(-1,-1),"Helvetica"),
        ("FONTSIZE",(0,0),(-1,-1),9), ("GRID",(0,0),(-1,-1),0.4,colors.HexColor("#CBD5E1")),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"), ("LEFTPADDING",(0,0),(-1,-1),8), ("RIGHTPADDING",(0,0),(-1,-1),8),
        ("TOPPADDING",(0,0),(-1,-1),7), ("BOTTOMPADDING",(0,0),(-1,-1),7),
    ]))
    story += [
        table,
        Paragraph("2  Fabrication requirements", styles["AurevixH1"]),
        Paragraph("<b>General tolerance:</b> +/- %.2f mm" % design["specification"]["general_tolerance_mm"], styles["BodyText"]),
        Paragraph("<b>Surface finish:</b> " + design["specification"]["surface_finish_requirements"], styles["BodyText"]),
        Paragraph("<b>Mounting:</b> " + design["specification"]["mounting_method"], styles["BodyText"]),
        Paragraph("3  Manufacturing notes", styles["AurevixH1"]),
        Paragraph(design["manufacturing_notes"], styles["BodyText"]),
        Paragraph("4  Release checklist", styles["AurevixH1"]),
        Paragraph("□ Measure the first produced fixture against every stated nominal and tolerance.<br/>□ Confirm robot reach and collision clearance using simulation.<br/>□ Run a low-speed dry cycle without a part.<br/>□ Have a qualified person approve the fixture for production use.", styles["BodyText"]),
        Spacer(1, 12),
        Paragraph("Reviewer: ____________________   Date: ____________________   Signature: ____________________", styles["BodyText"]),
    ]
    doc.build(story)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: build-fixture-spec-pdf.py INPUT.json OUTPUT.pdf")
    build(sys.argv[1], sys.argv[2])
