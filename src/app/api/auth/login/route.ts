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
    login?: string;
    password?: string;
  } | null;
  const login = (body?.login ?? "").trim();
  const password = body?.password ?? "";

  const result = await updateAuthData(async (data) => {
    const loginEmail = normalizeEmail(login);
    const user = data.users.find(
      (item) =>
        item.email === loginEmail ||
        item.username.toLowerCase() === login.toLowerCase(),
    );
    if (!user || !(await verifySecret(password, user.passwordHash))) {
      return { error: "Invalid email, username, or password." };
    }
    return { user: publicUser(user), userId: user.id };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  await createSession(result.userId);
  return NextResponse.json({ ok: true, user: result.user });
}

