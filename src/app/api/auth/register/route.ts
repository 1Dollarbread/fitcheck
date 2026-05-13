import { NextResponse } from "next/server";

import {
  codeExpiry,
  generateCode,
  hashSecret,
  newId,
  normalizeEmail,
  sendVerificationEmail,
  updateAuthData,
} from "@/lib/auth-store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    username?: string;
    password?: string;
  } | null;

  const email = normalizeEmail(body?.email ?? "");
  const username = (body?.username ?? "").trim();
  const password = body?.password ?? "";

  if (!email.includes("@") || username.length < 3 || password.length < 8) {
    return NextResponse.json(
      {
        error:
          "Use a valid email, a username with 3+ characters, and an 8+ character password.",
      },
      { status: 400 },
    );
  }

  const code = generateCode();
  const codeHash = await hashSecret(code);
  const passwordHash = await hashSecret(password);

  const conflict = await updateAuthData(async (data) => {
    const emailTaken = data.users.some((user) => user.email === email);
    const usernameTaken = data.users.some(
      (user) => user.username.toLowerCase() === username.toLowerCase(),
    );
    if (emailTaken || usernameTaken) return emailTaken ? "email" : "username";

    data.pendingRegistrations = data.pendingRegistrations.filter(
      (item) => item.email !== email,
    );
    data.pendingRegistrations.push({
      id: newId("user"),
      username,
      email,
      passwordHash,
      codeHash,
      expiresAt: codeExpiry(),
      createdAt: new Date().toISOString(),
    });
    return null;
  });

  if (conflict) {
    return NextResponse.json(
      { error: conflict === "email" ? "Email is already registered." : "Username is taken." },
      { status: 409 },
    );
  }

  const delivery = await sendVerificationEmail({
    to: email,
    code,
    subject: "Your FitCheck sign-up code",
  });

  return NextResponse.json({ ok: true, ...delivery });
}
