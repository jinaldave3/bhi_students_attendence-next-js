// Page-level route guard, runs on the Edge runtime. This is a UX
// convenience (no flash of a protected page before redirecting) —
// every API route still checks the session itself independently,
// which is the layer that actually matters for security.

import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "attendance_session";
const RAW_SECRET = process.env.AUTH_SECRET || "dev-only-insecure-secret-change-me";
const secretKey = new TextEncoder().encode(RAW_SECRET);

const ROLE_FOR_PREFIX = [
  ["/student", ["student"]],
  ["/teacher", ["teacher"]],
  ["/admin", ["admin"]],
];

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const match = ROLE_FOR_PREFIX.find(([prefix]) => pathname.startsWith(prefix));
  if (!match) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (!match[1].includes(payload.role)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  } catch (e) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/student/:path*", "/teacher/:path*", "/admin/:path*"],
};
