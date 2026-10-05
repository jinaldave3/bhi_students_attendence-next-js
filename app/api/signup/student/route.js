import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import { hashPassword } from "@/lib/auth";
import { newSheet } from "@/lib/dateUtils";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  const name = (body.name || "").trim();
  const username = (body.username || "")
    .trim()
    .toLowerCase();
  const password = body.password || "";
  const courseId = (body.courseId || "").trim();

  if (!name || !username || !password || !courseId) {
    return NextResponse.json(
      {
        error:
          "Name, username, password, and course are required.",
      },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      {
        error: "Password must be at least 8 characters.",
      },
      { status: 400 }
    );
  }

  if (!ObjectId.isValid(courseId)) {
    return NextResponse.json(
      { error: "Please select a valid course." },
      { status: 400 }
    );
  }

  try {
    const db = await getDb();

    const courseObjectId = new ObjectId(courseId);

    const course = await db
      .collection("courses")
      .findOne({ _id: courseObjectId });

    if (!course) {
      return NextResponse.json(
        { error: "That course could not be found." },
        { status: 404 }
      );
    }

    const existingUser = await db
      .collection("users")
      .findOne({ username });

    if (existingUser) {
      return NextResponse.json(
        { error: "That username is already taken." },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);

    const userDoc = {
      name,
      username,
      passwordHash,
      role: "student",
      courseId: courseObjectId,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db
      .collection("users")
      .insertOne(userDoc);

    const sheet = newSheet({
      _id: result.insertedId,
      studentId: result.insertedId,
      courseId: courseObjectId,
    });

    await db.collection("sheets").insertOne(sheet);

    return NextResponse.json(
      {
        id: result.insertedId.toString(),
        name,
        username,
        role: "student",
      },
      { status: 201 }
    );
  } catch (e) {
    if (e?.code === 11000) {
      return NextResponse.json(
        { error: "That username is already taken." },
        { status: 409 }
      );
    }

    console.error(e);

    return NextResponse.json(
      { error: "Failed to create student account." },
      { status: 500 }
    );
  }
}