import { NextResponse } from "next/server";

import { getDb } from "@/lib/mongodb";

import {
  signSession,
  sessionCookieOptions,
  verifyPassword,
  SESSION_COOKIE,
} from "@/lib/auth";

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }

  const username = (body.username || "")
    .trim()
    .toLowerCase();

  const password = body.password || "";

  if (!username || !password) {
    return NextResponse.json(
      {
        error:
          "Username and password are required",
      },
      { status: 400 }
    );
  }

  let db;

  try {
    db = await getDb();
  } catch (e) {
    console.error(e);

    return NextResponse.json(
      {
        error:
          "Server isn't connected to a database yet — contact your admin.",
      },
      { status: 500 }
    );
  }

  try {
    const user = await db
      .collection("users")
      .findOne({ username });

    if (
      !user ||
      !(await verifyPassword(
        password,
        user.passwordHash
      ))
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid username or password",
        },
        { status: 401 }
      );
    }

    /*
     * Only self-registered teachers have
     * approved: false.
     *
     * Existing teacher accounts don't have
     * this property, so they continue to work.
     */
    if (
      user.role === "teacher" &&
      user.approved === false
    ) {
      return NextResponse.json(
        {
          error:
            "Your instructor account is waiting for administrator approval.",
        },
        { status: 403 }
      );
    }

    const token = await signSession({
      sub: user._id.toString(),
      role: user.role,
      name: user.name,

      courseId: user.courseId
        ? String(user.courseId)
        : undefined,

      courseIds: Array.isArray(
        user.courseIds
      )
        ? user.courseIds.map(String)
        : undefined,
    });

    const res = NextResponse.json({
      ok: true,

      user: {
        id: user._id.toString(),
        name: user.name,
        role: user.role,
      },
    });

    res.cookies.set(
      SESSION_COOKIE,
      token,
      sessionCookieOptions()
    );

    return res;
  } catch (e) {
    console.error(e);

    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}