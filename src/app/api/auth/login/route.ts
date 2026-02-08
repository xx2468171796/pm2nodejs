import { NextRequest, NextResponse } from "next/server";
import { compareSync } from "bcryptjs";
import { getDb } from "@/lib/db";
import { signToken } from "@/lib/auth";
import type { User } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, error: "用户名和密码不能为空" }, { status: 400 });
    }

    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as User | undefined;

    if (!user || !compareSync(password, user.password_hash)) {
      return NextResponse.json({ success: false, error: "用户名或密码错误" }, { status: 401 });
    }

    const token = signToken({ userId: user.id, username: user.username });
    const isDefaultPwd = compareSync("admin", user.password_hash);

    const response = NextResponse.json({ success: true, data: { username: user.username, isDefaultPassword: isDefaultPwd } });
    response.cookies.set("pm2_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ success: false, error: "登录失败" }, { status: 500 });
  }
}
