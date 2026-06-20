#!/usr/bin/env python3
import json, sys
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

def usd(v): return "${:,.2f}".format(v)
def build(src, out):
    s=json.loads(Path(src).read_text())
    styles=getSampleStyleSheet()
    styles.add(ParagraphStyle(name="TitleX", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=24, leading=29, textColor=colors.HexColor("#0F172A"), alignment=0))
    styles.add(ParagraphStyle(name="Small", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.5, leading=11, textColor=colors.HexColor("#475569")))
    doc=SimpleDocTemplate(out,pagesize=letter,leftMargin=.7*inch,rightMargin=.7*inch,topMargin=.65*inch,bottomMargin=.65*inch)
    net=s["cost_avoided_usd"]-s["final_billable_usd"]
    story=[Paragraph("AUREVIX | MONTHLY VALUE STATEMENT",styles["Small"]),Spacer(1,10),Paragraph("Here's what Aurevix saved you this month",styles["TitleX"]),Paragraph(f"{s['billing_period']['start']} to {s['billing_period']['end']}",styles["BodyText"]),Spacer(1,16)]
    metrics=Table([["Tasks deployed","Integration cost avoided","Aurevix fee","You kept"],[str(s["tasks_deployed"]),usd(s["cost_avoided_usd"]),usd(s["final_billable_usd"]),usd(net)]],colWidths=[1.65*inch]*4)
    metrics.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#E8EEF5")),("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),("FONTNAME",(0,1),(-1,1),"Helvetica-Bold"),("FONTSIZE",(0,1),(-1,1),15),("ALIGN",(0,0),(-1,-1),"CENTER"),("BOX",(0,0),(-1,-1),.5,colors.HexColor("#CBD5E1")),("INNERGRID",(0,0),(-1,-1),.3,colors.HexColor("#CBD5E1")),("TOPPADDING",(0,0),(-1,-1),10),("BOTTOMPADDING",(0,0),(-1,-1),10)]))
    story += [metrics,Spacer(1,16),Paragraph(f"You avoided <b>{usd(s['cost_avoided_usd'])}</b> in integration costs. Aurevix's share before floor/cap: <b>{usd(s['outcome_fee_usd'])}</b>. Final fee: <b>{usd(s['final_billable_usd'])}</b>. You kept: <b>{usd(net)}</b>.",styles["BodyText"]),Spacer(1,12),Paragraph("A deployment counts only after 10 verified successful cycles in this billing period. Tasks without outcome feedback are excluded.",styles["BodyText"]),Spacer(1,14),Paragraph("Task breakdown",styles["Heading2"])]
    rows=[["Task","Deployment date","Verified cycles"]]+[[x["task_name"],x["deployment_date"],str(x["cycle_count_at_billing"])] for x in s["task_breakdown"]]
    if len(rows)==1: rows.append(["No qualifying deployments","-","-"])
    table=Table(rows,colWidths=[3.5*inch,1.5*inch,1.4*inch],repeatRows=1)
    table.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#E8EEF5")),("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),("GRID",(0,0),(-1,-1),.4,colors.HexColor("#CBD5E1")),("FONTSIZE",(0,0),(-1,-1),9),("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7)]))
    story += [table,Spacer(1,16),Paragraph(f"Confirmed integrator baseline: {usd(s['integrator_cost_baseline_usd'])} per qualifying task. Floor applied: {'Yes' if s['floor_applied'] else 'No'}. Cap applied: {'Yes' if s['cap_applied'] else 'No'}.",styles["BodyText"]),Spacer(1,12),Paragraph("This closed statement is immutable. Corrections are issued as separate credit notes.",styles["Small"])]
    doc.build(story)
if __name__=="__main__": build(sys.argv[1],sys.argv[2])
