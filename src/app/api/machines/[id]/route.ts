import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { name, host, port, ssh_user, auth_type, credential } = await request.json();

    if (!name || !host || !ssh_user) {
      return NextResponse.json({ success: false, error: "请填写所有必填字段" }, { status: 400 });
    }

    const db = getDb();

    if (credential) {
      const encrypted = encrypt(credential);
      db.prepare(
        "UPDATE machines SET name=?, host=?, port=?, ssh_user=?, auth_type=?, encrypted_credential=?, updated_at=datetime('now') WHERE id=?"
      ).run(name, host, port || 22, ssh_user, auth_type || "password", encrypted, id);
    } else {
      db.prepare(
        "UPDATE machines SET name=?, host=?, port=?, ssh_user=?, updated_at=datetime('now') WHERE id=?"
      ).run(name, host, port || 22, ssh_user, id);
    }

    const machine = db.prepare("SELECT id, name, host, port, ssh_user, auth_type, created_at, updated_at FROM machines WHERE id = ?").get(id);
    return NextResponse.json({ success: true, data: machine });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    db.prepare("DELETE FROM machines WHERE id = ?").run(id);
    db.prepare("DELETE FROM metrics WHERE machine_id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
