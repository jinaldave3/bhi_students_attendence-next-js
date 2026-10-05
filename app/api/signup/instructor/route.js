import { NextResponse } from "next/server";

import { getDb } from "@/lib/mongodb";
import { hashPassword } from "@/lib/auth";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  const name = (body.name || "").trim();
  const username = (body.username || "")
    .trim()
    .toLowerCase();
  const password = body.password || "";

  if (!name || !username || !password) {
    return NextResponse.json(
      {
        error:
          "Name, username, and password are required.",
      },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      {
        error:
          "Password must be at least 8 characters.",
      },
      { status: 400 }
    );
  }

  try {
    const db = await getDb();

    const existingUser = await db
      .collection("users")
      .findOne({ username });

    if (existingUser) {
      return NextResponse.json(
        {
          error:
            "That username is already taken.",
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const passwordHash =
      await hashPassword(password);

    const result = await db
      .collection("users")
      .insertOne({
        name,
        username,
        passwordHash,

        // Instructor is stored as "teacher"
        // because that is the role the existing
        // app already uses.
        role: "teacher",

        // Self-registered instructors must be
        // approved by an admin.
        approved: false,

        // Admin assigns courses after approval.
        courseIds: [],

        createdAt: now,
        updatedAt: now,
      });

    return NextResponse.json(
      {
        id: result.insertedId.toString(),
        name,
        username,
        role: "teacher",
        approved: false,
      },
      { status: 201 }
    );
  } catch (e) {
    if (e?.code === 11000) {
      return NextResponse.json(
        {
          error:
            "That username is already taken.",
        },
        { status: 409 }
      );
    }

    console.error(e);

    return NextResponse.json(
      {
        error:
          "Failed to create instructor account.",
      },
      { status: 500 }
    );
  }
}