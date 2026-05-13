import { NextResponse } from "next/server";

import {
  assertCooldown,
  codeExpiry,
  generateCode,
  getCurrentUser,
  hashSecret,
  normalizeEmail,
  publicUser,
  sendVerificationEmail,
  updateAuthData,
} from "@/lib/auth-store";

export async function PATCH(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    username?: string;
    email?: string;
    password?: string;
  } | null;

  const username = body?.username?.trim();
  const email = body?.email === undefined ? undefined : normalizeEmail(body.email);
  const password = body?.password;

  let emailCode: string | null = null;
  const result = await updateAuthData(async (data) => {
    const user = data.users.find((item) => item.id === current.id);
    if (!user) return { error: "User not found." };

    if (username !== undefined && username !== user.username) {
      if (username.length < 3) return { error: "Username must be at least 3 characters." };
      if (
        data.users.some(
          (item) =>
            item.id !== user.id &&
            item.username.toLowerCase() === username.toLowerCase(),
        )
      ) {
        return { error: "Username is already taken." };
      }
      try {
        assertCooldown(user.usernameUpdatedAt);
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Username change is locked." };
      }
      user.username = username;
      user.usernameUpdatedAt = new Date().toISOString();
    }

    if (password !== undefined && password !== "") {
      if (password.length < 8) return { error: "Password must be at least 8 characters." };
      try {
        assertCooldown(user.passwordUpdatedAt);
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Password change is locked." };
      }
      user.passwordHash = await hashSecret(password);
      user.passwordUpdatedAt = new Date().toISOString();
    }

    if (email !== undefined && email !== user.email) {
      if (!email.includes("@")) return { error: "Use a valid email address." };
      if (data.users.some((item) => item.id !== user.id && item.email === email)) {
        return { error: "Email is already registered." };
      }
      emailCode = generateCode();
      user.pendingEmail = {
        email,
        codeHash: await hashSecret(emailCode),
        expiresAt: codeExpiry(),
      };
    }

    return { user: publicUser(user), pendingEmail: user.pendingEmail?.email ?? null };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  let delivery: { delivered?: boolean; devCode?: string } = {};
  if (emailCode && result.pendingEmail) {
    delivery = await sendVerificationEmail({
      to: result.pendingEmail,
      code: emailCode,
      subject: "Confirm your new FitCheck email",
    });
  }

  return NextResponse.json({ ok: true, ...result, ...delivery });
}

