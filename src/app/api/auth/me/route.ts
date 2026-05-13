import { NextResponse } from "next/server";

import { getCurrentUser, publicUser } from "@/lib/auth-store";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user: user ? publicUser(user) : null });
}

