import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import { requireSession } from "@/lib/session";
import { hashPassword } from "@/lib/auth";

export async function GET(request) {
  const session = await requireSession(["admin"]);

  if (session instanceof NextResponse) {
    return session;
  }

  const role =
    request.nextUrl.searchParams.get("role");

  try {
    const db = await getDb();

    const filter = role ? { role } : {};

    const users = await db
      .collection("users")
      .find(filter)
      .sort({ name: 1 })
      .toArray();

    return NextResponse.json(
      users.map((u) => ({
        id: u._id.toString(),
        name: u.name,
        username: u.username,
        role: u.role,

        courseId: u.courseId
          ? u.courseId.toString()
          : undefined,

        courseIds: Array.isArray(u.courseIds)
          ? u.courseIds.map(String)
          : [],

        /*
         * Existing teacher accounts may not have
         * an "approved" field. Those accounts are
         * treated as approved so nothing old breaks.
         */
        approved:
          u.role === "teacher"
            ? u.approved !== false
            : undefined,
      }))
    );
  } catch (e) {
    console.error(e);

    return NextResponse.json(
      { error: "Failed to load users" },
      { status: 500 }
    );
  }
}

/*
 * Admin-created teacher accounts.
 *
 * Students use the student signup flow.
 * Self-registering instructors use
 * /api/signup/instructor.
 */
export async function POST(request) {
  const session = await requireSession(["admin"]);

  if (session instanceof NextResponse) {
    return session;
  }

  const body = await request
    .json()
    .catch(() => ({}));

  const name = (body.name || "").trim();

  const username = (body.username || "")
    .trim()
    .toLowerCase();

  const password = body.password || "";

  const role =
    body.role === "admin"
      ? "admin"
      : "teacher";

  let courseIds = [];

  try {
    courseIds = Array.isArray(body.courseIds)
      ? body.courseIds
          .filter(Boolean)
          .map((id) => new ObjectId(id))
      : [];
  } catch (e) {
    return NextResponse.json(
      {
        error:
          "One or more course IDs are invalid.",
      },
      { status: 400 }
    );
  }

  if (!name || !username || !password) {
    return NextResponse.json(
      {
        error:
          "Name, username, and password are required",
      },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      {
        error:
          "Password must be at least 8 characters",
      },
      { status: 400 }
    );
  }

  try {
    const db = await getDb();

    const now = new Date().toISOString();

    const passwordHash =
      await hashPassword(password);

    const doc = {
      name,
      username,
      passwordHash,
      role,
      courseIds,

      /*
       * Accounts manually created by the admin
       * are already trusted and don't need a
       * second approval step.
       */
      ...(role === "teacher"
        ? { approved: true }
        : {}),

      createdAt: now,
      updatedAt: now,
    };

    const result = await db
      .collection("users")
      .insertOne(doc);

    return NextResponse.json(
      {
        id: result.insertedId.toString(),
        name,
        username,
        role,
        approved:
          role === "teacher"
            ? true
            : undefined,
        courseIds: courseIds.map(String),
      },
      { status: 201 }
    );
  } catch (e) {
    if (e?.code === 11000) {
      return NextResponse.json(
        {
          error:
            "That username is already taken",
        },
        { status: 409 }
      );
    }

    console.error(e);

    return NextResponse.json(
      {
        error:
          "Failed to create account",
      },
      { status: 500 }
    );
  }
}