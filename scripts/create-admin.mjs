#!/usr/bin/env node
// One-time bootstrap: creates the first admin account. There's no
// public sign-up page on purpose (a student/teacher/admin portal
// shouldn't let anyone self-register as admin), so this is how the
// very first account gets made — every account after this one is
// created from the admin UI at /admin/users or /admin/courses/[id].
//
// Usage:
//   npm run create-admin
//   (reads MONGODB_URI from .env.local automatically — see loadEnvLocal below)
//
// Or override for one run without touching .env.local:
//   MONGODB_URI="mongodb+srv://..." npm run create-admin              (Mac/Linux/bash)
//   $env:MONGODB_URI="mongodb+srv://..."; npm run create-admin        (Windows PowerShell)

import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import fs from "node:fs";
import path from "node:path";

// Plain Node scripts (unlike `next dev`/`next build`) don't read
// .env.local automatically — only the Next.js app itself does. This
// is a tiny, dependency-free loader so `npm run create-admin` works
// without having to export the variable by hand every time.
function loadEnvLocal() {
  for (const filename of [".env.local", ".env"]) {
    const filePath = path.join(process.cwd(), filename);
    if (!fs.existsSync(filePath)) continue;
    const contents = fs.readFileSync(filePath, "utf-8");
    for (const rawLine of contents.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      // Strip matching surrounding quotes, if present.
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[key] = value;
    }
  }
  return out;
}

async function prompt(question) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

async function main() {
  loadEnvLocal();

  const args = parseArgs(process.argv.slice(2));
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error(
      "MONGODB_URI is not set. Add it to .env.local in the project root (same folder as package.json), " +
      "or set it for just this command:\n" +
      '  MONGODB_URI="mongodb+srv://..." npm run create-admin        (Mac/Linux/bash)\n' +
      '  $env:MONGODB_URI="mongodb+srv://..."; npm run create-admin  (Windows PowerShell)'
    );
    process.exit(1);
  }

  const name = args.name || await prompt("Admin full name: ");
  const username = (args.username || await prompt("Admin username: ")).trim().toLowerCase();
  const password = args.password || await prompt("Admin password (8+ characters): ");

  if (!name || !username || !password) {
    console.error("Name, username, and password are all required.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    await db.collection("users").createIndex({ username: 1 }, { unique: true });

    const existing = await db.collection("users").findOne({ username });
    if (existing) {
      console.error(`A user with the username "${username}" already exists.`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();
    await db.collection("users").insertOne({
      name, username, passwordHash, role: "admin", createdAt: now, updatedAt: now,
    });

    console.log(`\nAdmin account created. Sign in at /login with:`);
    console.log(`  username: ${username}`);
    console.log(`  password: (whatever you entered)\n`);
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
