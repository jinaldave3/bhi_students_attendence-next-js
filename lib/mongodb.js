// Lazy, cached MongoDB connection. Lazy so importing this file never
// throws just because MONGODB_URI isn't set yet (routes call getDb()
// and handle the error themselves); cached so we don't open a new
// connection on every serverless invocation or dev hot-reload.

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
let clientPromise = null;
let indexesEnsured = false;

function getClientPromise() {
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add it to your environment — see README.md > 'Setting up MongoDB' — and restart/redeploy."
    );
  }
  if (clientPromise) return clientPromise;

  if (process.env.NODE_ENV === "development") {
    // Reuse the connection across hot reloads in dev.
    if (!globalThis._mongoClientPromise) {
      globalThis._mongoClientPromise = new MongoClient(uri).connect();
    }
    clientPromise = globalThis._mongoClientPromise;
  } else {
    clientPromise = new MongoClient(uri).connect();
  }
  return clientPromise;
}

export async function getDb() {
  const client = await getClientPromise();
  const db = client.db(); // database name comes from the URI path
  if (!indexesEnsured) {
    indexesEnsured = true;
    // Idempotent — safe to call repeatedly, cheap once the indexes exist.
    await Promise.all([
      db.collection("users").createIndex({ username: 1 }, { unique: true }),
      db.collection("courses").createIndex({ code: 1 }, { unique: true, sparse: true }),
    ]).catch((e) => console.error("attendance db: failed to ensure indexes", e));
  }
  return db;
}
