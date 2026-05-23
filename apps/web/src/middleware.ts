import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_request: NextRequest) {
  // Auth disabled — all routes accessible without login
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
