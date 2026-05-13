import { NextResponse } from "next/server";

import {
  createSession,
  normalizeEmail,
  publicUser,
  updateAuthData,
  verifySecret,
} from "@/lib/auth-store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    code?: string;
  } | null;
  const email = normalizeEmail(body?.email ?? "");
  const code = (body?.code ?? "").trim();

  let createdUserId = "";
  const result = await updateAuthData(async (data) => {
    const pending = data.pendingRegistrations.find((item) => item.email === email);
    if (!pending) return { error: "No pending registration found." };
    if (new Date(pending.expiresAt).getTime() < Date.now()) {
      return { error: "That code expired. Please sign up again." };
    }
    if (!(await verifySecret(code, pending.codeHash))) {
      return { error: "Invalid verification code." };
    }
    if (data.users.some((user) => user.email === email)) {
      return { error: "Email is already registered." };
    }

    const user = {
      id: pending.id,
      username: pending.username,
      email: pending.email,
      passwordHash: pending.passwordHash,
      createdAt: new Date().toISOString(),
    };
    data.users.push(user);
    data.pendingRegistrations = data.pendingRegistrations.filter(
      (item) => item.email !== email,
    );
    createdUserId = user.id;
    return { user: publicUser(user) };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await createSession(createdUserId);
  return NextResponse.json({ ok: true, user: result.user });
}

