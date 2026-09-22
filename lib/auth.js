// Session & password helpers.
//
// Sessions are a signed JWT in an httpOnly cookie. Uses `jose`
// (rather than `jsonwebtoken`) because it works in both the Node
// API routes and the Edge runtime that Next.js middleware runs in.
//
// IMPORTANT: set a real AUTH_SECRET in production (a long random
// string). Without one this falls back to an insecure default so
// local dev still works, but that default must never be used for
// anything real — anyone who reads this source could forge sessions.

import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const RAW_SECRET = process.env.AUTH_SECRET || "dev-only-insecure-secret-change-me";
const secretKey = new TextEncoder().encode(RAW_SECRET);

if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
  console.warn(
    "[attendance] AUTH_SECRET is not set in production — using an insecure default. " +
    "Set a long random AUTH_SECRET in your environment before relying on this."
  );
}

export const SESSION_COOKIE = "attendance_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export async function signSession(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey);
}

export async function verifySession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch (e) {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/** Home path for a role, used after login and for the root redirect. */
export function homeForRole(role) {
  if (role === "admin") return "/admin";
  if (role === "teacher") return "/teacher";
  if (role === "student") return "/student";
  return "/login";
}
