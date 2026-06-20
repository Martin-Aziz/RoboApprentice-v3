#!/usr/bin/env python3
import json
import sys
from pathlib import Path

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

DISCLAIMER = (
    "This document was auto-drafted by Aurevix as a starting point. It must be "
    "reviewed, completed, and signed by a qualified person before the robot is "
    "operated. It does not constitute a certified risk assessment."
)
BLUE = "0284C7"
NAVY = "0F172A"
MUTED = "475569"
YELLOW = "FFF2CC"
LIGHT_BLUE = "EAF6FC"
RED = "B91C1C"


def set_cell_fill(cell, color):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), color)


def set_cell_margins(cell, top=100, start=140, bottom=100, end=140):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def add_page_number(paragraph):
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = paragraph.add_run("Page ")
    run.font.size = Pt(8)
    fld = OxmlElement("w:fldSimple")
    fld.set(qn("w:instr"), "PAGE")
    paragraph._p.append(fld)


def apply_styles(doc):
    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor.from_string(NAVY)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.1
    for name, size, before, after in (
        ("Heading 1", 16, 16, 8),
        ("Heading 2", 13, 12, 6),
    ):
        style = doc.styles[name]
        style.font.name = "Calibri"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor.from_string(BLUE)
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True


def build(input_path, output_path):
    draft = json.loads(Path(input_path).read_text(encoding="utf-8"))
    doc = Document()
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    # Named compact-form override: reduced vertical margins keep the approval block
    # together while preserving comfortable editing space.
    section.top_margin = Inches(0.75)
    section.bottom_margin = Inches(0.75)
    section.left_margin = Inches(0.85)
    section.right_margin = Inches(0.85)
    section.header_distance = Inches(0.35)
    section.footer_distance = Inches(0.35)
    apply_styles(doc)

    header = section.header.paragraphs[0]
    header.text = "AUREVIX  |  RISK ASSESSMENT DRAFT"
    header.runs[0].font.name = "Calibri"
    header.runs[0].font.size = Pt(9)
    header.runs[0].font.bold = True
    header.runs[0].font.color.rgb = RGBColor.from_string(BLUE)

    footer = section.footer
    notice = footer.paragraphs[0]
    notice.text = DISCLAIMER
    notice.alignment = WD_ALIGN_PARAGRAPH.CENTER
    notice.runs[0].font.size = Pt(7)
    notice.runs[0].font.color.rgb = RGBColor.from_string(MUTED)
    add_page_number(footer.add_paragraph())

    kicker = doc.add_paragraph()
    kicker.paragraph_format.space_after = Pt(2)
    run = kicker.add_run("AUREVIX SAFETY WORKFLOW")
    run.font.name = "Calibri"
    run.font.size = Pt(9)
    run.font.bold = True
    run.font.color.rgb = RGBColor.from_string(BLUE)

    title = doc.add_paragraph()
    title.paragraph_format.space_after = Pt(4)
    run = title.add_run("Collaborative Robot Risk Assessment Draft")
    run.font.name = "Calibri"
    run.font.size = Pt(24)
    run.font.bold = True
    run.font.color.rgb = RGBColor.from_string(NAVY)

    subtitle = doc.add_paragraph()
    subtitle.paragraph_format.space_after = Pt(14)
    subtitle.add_run(
        f"Task {draft['task_id']}  |  {draft['robot_model']}  |  Generated {draft['generated_at'][:10]}"
    ).font.color.rgb = RGBColor.from_string(MUTED)

    notice_table = doc.add_table(rows=1, cols=1)
    notice_table.autofit = False
    cell = notice_table.cell(0, 0)
    cell.width = Inches(6.8)
    set_cell_fill(cell, "FDECEC")
    set_cell_margins(cell, 140, 160, 140, 160)
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    r = p.add_run("IMPORTANT - QUALIFIED REVIEW REQUIRED\n")
    r.bold = True
    r.font.color.rgb = RGBColor.from_string(RED)
    r = p.add_run(DISCLAIMER)
    r.font.size = Pt(10)
    r.font.color.rgb = RGBColor.from_string(NAVY)

    legend = doc.add_paragraph()
    legend.paragraph_format.space_before = Pt(8)
    legend.paragraph_format.space_after = Pt(8)
    r = legend.add_run("Yellow fields ")
    r.bold = True
    r.font.highlight_color = 7
    legend.add_run("identify content that must be checked or completed by a qualified person.")

    for risk_section in draft["sections"]:
        doc.add_heading(
            f"{risk_section['section_number']}  {risk_section['title']}",
            level=1,
        )
        content = doc.add_table(rows=1, cols=1)
        content.autofit = False
        cell = content.cell(0, 0)
        cell.width = Inches(6.8)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        set_cell_fill(cell, YELLOW if risk_section["requires_human_review"] else LIGHT_BLUE)
        set_cell_margins(cell)
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        p.add_run(risk_section["auto_populated_content"])

        if risk_section["requires_human_review"]:
            review = doc.add_paragraph()
            review.paragraph_format.space_before = Pt(5)
            review.paragraph_format.space_after = Pt(8)
            label = review.add_run("REQUIRES HUMAN REVIEW: ")
            label.bold = True
            label.font.color.rgb = RGBColor.from_string(RED)
            review.add_run(risk_section["review_prompt"])

    doc.core_properties.title = "Aurevix Collaborative Robot Risk Assessment Draft"
    doc.core_properties.subject = "Auto-drafted document requiring qualified review"
    doc.core_properties.author = "Aurevix"
    doc.save(output_path)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: build-risk-assessment-docx.py INPUT.json OUTPUT.docx")
    build(sys.argv[1], sys.argv[2])
