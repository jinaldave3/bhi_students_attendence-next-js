// Server-only helpers for API routes (uses next/headers, which only
// works in Node route handlers and server components — not in
// middleware, which is why this is separate from lib/auth.js).

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "./auth";

/** The current session payload ({ sub, role, name, ... }), or null. */
export async function getSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySession(token);
}

/**
 * Require a logged-in session, optionally restricted to specific
 * roles. Returns the session on success, or a ready-to-return
 * NextResponse (401/403) that the caller should `return` directly.
 *
 * Usage:
 *   const session = await requireSession(["admin"]);
 *   if (session instanceof NextResponse) return session;
 */
export async function requireSession(allowedRoles) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  return session;
}
