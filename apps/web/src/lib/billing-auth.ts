import type { NextRequest } from "next/server";

export function requireCustomer(request: NextRequest) {
  return request.headers.get("x-aurevix-customer-id") ?? "customer-demo";
}

export function requireAdmin(request: NextRequest) {
  if (request.headers.get("x-aurevix-role") !== "admin") {
    throw new Error("ADMIN_REQUIRED");
  }
  return request.headers.get("x-aurevix-user-id") ?? "local-admin";
}

export function authError(error: unknown) {
  return error instanceof Error && error.message === "ADMIN_REQUIRED";
}
