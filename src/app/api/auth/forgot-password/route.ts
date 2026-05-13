import { NextResponse } from "next/server";

import {
  codeExpiry,
  generateCode,
  hashSecret,
  normalizeEmail,
  sendVerificationEmail,
  updateAuthData,
} from "@/lib/auth-store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = normalizeEmail(body?.email ?? "");
  const code = generateCode();

  const exists = await updateAuthData(async (data) => {
    const user = data.users.find((item) => item.email === email);
    if (!user) return false;
    data.passwordResets = data.passwordResets.filter((item) => item.email !== email);
    data.passwordResets.push({
      email,
      codeHash: await hashSecret(code),
      expiresAt: codeExpiry(),
    });
    return true;
  });

  if (!exists) {
    return NextResponse.json({ error: "No account exists for that email." }, { status: 404 });
  }

  const delivery = await sendVerificationEmail({
    to: email,
    code,
    subject: "Your FitCheck password reset code",
  });

  return NextResponse.json({ ok: true, ...delivery });
}

