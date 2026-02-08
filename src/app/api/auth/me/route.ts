import { NextResponse } from "next/server";
import { getAuthUser, isDefaultPassword } from "@/lib/auth";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    data: {
      userId: user.userId,
      username: user.username,
      isDefaultPassword: isDefaultPassword(user.userId),
    },
  });
}
