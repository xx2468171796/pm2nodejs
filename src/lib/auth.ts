import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { getDb } from "./db";

const TOKEN_COOKIE = "pm2_token";
const TOKEN_EXPIRY = "7d";

function getJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET;
  if (envSecret) return envSecret;

  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'jwt_secret'").get() as { value: string } | undefined;

  if (row) return row.value;

  const crypto = require("crypto");
  const newSecret = crypto.randomBytes(64).toString("hex");
  db.prepare("INSERT INTO settings (key, value) VALUES ('jwt_secret', ?)").run(newSecret);
  return newSecret;
}

export interface TokenPayload {
  userId: number;
  username: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as TokenPayload;
  } catch {
    return null;
  }
}

export async function getAuthUser(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function isDefaultPassword(userId: number): boolean {
  const { compareSync } = require("bcryptjs");
  const db = getDb();
  const user = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(userId) as { password_hash: string } | undefined;
  if (!user) return false;
  return compareSync("admin", user.password_hash);
}
