import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import type { Machine } from "@/types";

export async function GET() {
  try {
    const db = getDb();
    const machines = db.prepare("SELECT id, name, host, port, ssh_user, auth_type, created_at, updated_at FROM machines ORDER BY id").all();
    return NextResponse.json({ success: true, data: machines });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, host, port, ssh_user, auth_type, credential } = await request.json();

    if (!name || !host || !ssh_user || !credential) {
      return NextResponse.json({ success: false, error: "请填写所有必填字段" }, { status: 400 });
    }

    const db = getDb();
    const encrypted = encrypt(credential);
    const result = db.prepare(
      "INSERT INTO machines (name, host, port, ssh_user, auth_type, encrypted_credential) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(name, host, port || 22, ssh_user, auth_type || "password", encrypted);

    const machine = db.prepare("SELECT id, name, host, port, ssh_user, auth_type, created_at, updated_at FROM machines WHERE id = ?").get(result.lastInsertRowid) as Machine;
    return NextResponse.json({ success: true, data: machine }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
