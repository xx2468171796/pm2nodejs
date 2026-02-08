import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAuthUser, signToken } from "@/lib/auth";

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }

    const { newUsername } = await request.json();
    if (!newUsername || newUsername.trim().length < 2) {
      return NextResponse.json({ success: false, error: "用户名至少2个字符" }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(newUsername.trim(), user.userId);
    if (existing) {
      return NextResponse.json({ success: false, error: "用户名已存在" }, { status: 400 });
    }

    db.prepare("UPDATE users SET username = ?, updated_at = datetime('now') WHERE id = ?").run(newUsername.trim(), user.userId);

    const newToken = signToken({ userId: user.userId, username: newUsername.trim() });
    const response = NextResponse.json({ success: true });
    response.cookies.set("pm2_token", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ success: false, error: "修改用户名失败" }, { status: 500 });
  }
}
