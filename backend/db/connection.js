import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || "satisficingmeals";

let client;
let db;

export async function connectDB() {
  if (db) return db;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  console.log(`Connected to MongoDB: ${dbName}`);
  return db;
}

export async function getDB() {
  if (!db) await connectDB();
  return db;
}

export async function closeDB() {
  if (client) {
    await client.close();
    db = null;
    client = null;
  }
}
