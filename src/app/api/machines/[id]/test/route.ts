import { NextRequest, NextResponse } from "next/server";
import { testSSHConnection } from "@/lib/ssh";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const version = await testSSHConnection(Number(id));
    return NextResponse.json({ success: true, data: { pm2Version: version } });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
