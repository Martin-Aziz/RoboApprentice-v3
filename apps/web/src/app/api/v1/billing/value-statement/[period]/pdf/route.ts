import { spawn } from "child_process";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/billing-auth";
import { getStatement } from "@/lib/billing-store";

export async function GET(request: NextRequest, { params }: { params: Promise<{ period: string }> }) {
  const customerId=requireCustomer(request); const { period }=await params;
  const statement=await getStatement(customerId,period);
  if(!statement) return NextResponse.json({error:"Generate the value statement first."},{status:404});
  const dir=join(tmpdir(),`aurevix-value-${statement.statement_id}`); await mkdir(dir,{recursive:true});
  const input=join(dir,"statement.json"), output=join(dir,"statement.pdf"); await writeFile(input,JSON.stringify(statement));
  try {
    await new Promise<void>((resolve,reject)=>{const p=spawn(process.env.AUREVIX_PDF_PYTHON??"python3",[join(process.cwd(),"scripts","build-value-statement-pdf.py"),input,output]);let e="";p.stderr.on("data",d=>e+=d);p.on("close",c=>c===0?resolve():reject(new Error(e)));});
    return new NextResponse(await readFile(output),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename=\"aurevix-value-statement-${period}.pdf\"`}});
  } finally { await rm(dir,{recursive:true,force:true}); }
}
