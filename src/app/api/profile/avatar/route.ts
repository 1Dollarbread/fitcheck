import { NextResponse } from "next/server";

import {
  getCurrentUser,
  publicUser,
  saveAvatarFile,
  updateAuthData,
} from "@/lib/auth-store";

export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const formData = await request.formData();
  const raw = formData.get("file");
  if (!raw || !(raw instanceof Blob) || raw.size === 0) {
    return NextResponse.json({ error: "Choose an avatar image." }, { status: 400 });
  }
  if (!raw.type.startsWith("image/")) {
    return NextResponse.json({ error: "Avatar must be an image." }, { status: 400 });
  }
  if (raw.size > 2_000_000) {
    return NextResponse.json({ error: "Avatar must be smaller than 2 MB." }, { status: 400 });
  }

  const avatarUrl = await saveAvatarFile(current.id, raw);
  const user = await updateAuthData((data) => {
    const found = data.users.find((item) => item.id === current.id);
    if (!found) return null;
    found.avatarUrl = avatarUrl;
    return publicUser(found);
  });

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, user });
}
