import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Google sign-in needs Firebase/Google OAuth project credentials before it can be enabled.",
    },
    { status: 501 },
  );
}
