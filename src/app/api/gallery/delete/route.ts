import { del } from "@vercel/blob";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth-store";
import { userAlbumPrefix } from "@/lib/fitcheck-blob";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in before deleting photos." }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return NextResponse.json(
      { error: "Storage is not configured." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const raw = (body as { pathnames?: unknown }).pathnames;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json(
      { error: "Provide a non-empty pathnames array." },
      { status: 400 },
    );
  }

  const pathnames: string[] = [];
  const prefix = userAlbumPrefix(user.id);
  for (const item of raw) {
    if (typeof item !== "string" || item.trim() === "") {
      return NextResponse.json(
        { error: "Each pathname must be a non-empty string." },
        { status: 400 },
      );
    }
    if (!item.startsWith(prefix)) {
      return NextResponse.json(
        { error: "Invalid pathname." },
        { status: 400 },
      );
    }
    pathnames.push(item);
  }

  try {
    await del(pathnames);
    return NextResponse.json({ ok: true, deleted: pathnames.length });
  } catch (error) {
    console.error("Blob delete error:", error);
    return NextResponse.json(
      { error: "Could not delete one or more photos." },
      { status: 500 },
    );
  }
}
