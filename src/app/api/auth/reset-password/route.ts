import { NextResponse } from "next/server";

import {
  assertCooldown,
  hashSecret,
  normalizeEmail,
  publicUser,
  updateAuthData,
  verifySecret,
} from "@/lib/auth-store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    code?: string;
    password?: string;
  } | null;
  const email = normalizeEmail(body?.email ?? "");
  const code = (body?.code ?? "").trim();
  const password = body?.password ?? "";
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const result = await updateAuthData(async (data) => {
    const user = data.users.find((item) => item.email === email);
    const reset = data.passwordResets.find((item) => item.email === email);
    if (!user || !reset) return { error: "No active reset request found." };
    if (new Date(reset.expiresAt).getTime() < Date.now()) {
      return { error: "That code expired." };
    }
    if (!(await verifySecret(code, reset.codeHash))) {
      return { error: "Invalid verification code." };
    }
    try {
      assertCooldown(user.passwordUpdatedAt);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Password change is locked." };
    }
    user.passwordHash = await hashSecret(password);
    user.passwordUpdatedAt = new Date().toISOString();
    data.passwordResets = data.passwordResets.filter((item) => item.email !== email);
    return { user: publicUser(user) };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, user: result.user });
}

