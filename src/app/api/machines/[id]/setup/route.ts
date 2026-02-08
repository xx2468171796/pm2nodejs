import { NextRequest, NextResponse } from "next/server";
import { executeSSHCommand } from "@/lib/ssh";

const SETUP_SCRIPT = `
set -e

# Detect package manager
if command -v apt-get &>/dev/null; then
  PKG="apt-get"
elif command -v yum &>/dev/null; then
  PKG="yum"
elif command -v dnf &>/dev/null; then
  PKG="dnf"
elif command -v apk &>/dev/null; then
  PKG="apk"
else
  PKG=""
fi

# Check and install Node.js
if ! command -v node &>/dev/null; then
  echo "[STEP] 安装 Node.js..."
  if [ "$PKG" = "apt-get" ]; then
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - 2>&1
    apt-get install -y nodejs 2>&1
  elif [ "$PKG" = "yum" ] || [ "$PKG" = "dnf" ]; then
    curl -fsSL https://rpm.nodesource.com/setup_lts.x | bash - 2>&1
    $PKG install -y nodejs 2>&1
  elif [ "$PKG" = "apk" ]; then
    apk add --no-cache nodejs npm 2>&1
  else
    echo "[ERROR] 无法自动安装 Node.js，请手动安装"
    exit 1
  fi
  echo "[OK] Node.js $(node -v) 安装完成"
else
  echo "[OK] Node.js $(node -v) 已安装"
fi

# Check and install PM2
if ! command -v pm2 &>/dev/null; then
  echo "[STEP] 安装 PM2..."
  npm install -g pm2 2>&1
  echo "[OK] PM2 $(pm2 -v) 安装完成"
else
  echo "[OK] PM2 $(pm2 -v) 已安装"
fi

# Setup PM2 startup
echo "[STEP] 配置 PM2 开机自启..."
pm2 startup 2>&1 || true
pm2 save 2>&1 || true
echo "[OK] PM2 开机自启已配置"

echo "[DONE] 环境配置完成"
`.trim();

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const machineId = Number(id);
    if (!machineId) {
      return NextResponse.json({ success: false, error: "无效机器ID" }, { status: 400 });
    }

    const output = await executeSSHCommand(machineId, SETUP_SCRIPT);
    const lines = output.split("\n").filter(l => l.trim());
    const success = lines.some(l => l.includes("[DONE]"));

    return NextResponse.json({
      success,
      data: { log: output },
      error: success ? undefined : "安装过程中出现问题，请查看日志",
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
