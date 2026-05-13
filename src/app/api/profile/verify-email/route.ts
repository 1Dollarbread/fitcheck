import { NextResponse } from "next/server";

import {
  getCurrentUser,
  publicUser,
  updateAuthData,
  verifySecret,
} from "@/lib/auth-store";

export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const code = (body?.code ?? "").trim();

  const result = await updateAuthData(async (data) => {
    const user = data.users.find((item) => item.id === current.id);
    if (!user?.pendingEmail) return { error: "No pending email change." };
    if (new Date(user.pendingEmail.expiresAt).getTime() < Date.now()) {
      user.pendingEmail = undefined;
      return { error: "That email code expired." };
    }
    if (!(await verifySecret(code, user.pendingEmail.codeHash))) {
      return { error: "Invalid verification code." };
    }
    user.email = user.pendingEmail.email;
    user.pendingEmail = undefined;
    return { user: publicUser(user) };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, user: result.user });
}

