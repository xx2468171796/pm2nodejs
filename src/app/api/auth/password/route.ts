import { NextRequest, NextResponse } from "next/server";
import { compareSync, hashSync } from "bcryptjs";
import { getDb } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ success: false, error: "请填写完整" }, { status: 400 });
    }

    if (newPassword.length < 4) {
      return NextResponse.json({ success: false, error: "新密码至少4位" }, { status: 400 });
    }

    const db = getDb();
    const dbUser = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.userId) as { password_hash: string } | undefined;
    if (!dbUser || !compareSync(currentPassword, dbUser.password_hash)) {
      return NextResponse.json({ success: false, error: "当前密码错误" }, { status: 400 });
    }

    const newHash = hashSync(newPassword, 10);
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(newHash, user.userId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "修改密码失败" }, { status: 500 });
  }
}
