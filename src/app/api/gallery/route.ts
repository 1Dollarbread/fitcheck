import { list } from "@vercel/blob";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth-store";
import { userAlbumPrefix } from "@/lib/fitcheck-blob";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to view your album.", photos: [] }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return NextResponse.json(
      {
        error:
          "Gallery is not configured. Set BLOB_READ_WRITE_TOKEN in .env.local or Vercel.",
        photos: [],
      },
      { status: 503 },
    );
  }

  try {
    const photos: {
      url: string;
      pathname: string;
      uploadedAt: string;
    }[] = [];

    let cursor: string | undefined;
    let pages = 0;

    do {
      const result = await list({
        prefix: userAlbumPrefix(user.id),
        limit: 500,
        cursor,
      });

      for (const blob of result.blobs) {
        photos.push({
          url: blob.url,
          pathname: blob.pathname,
          uploadedAt: blob.uploadedAt.toISOString(),
        });
      }

      cursor = result.hasMore ? result.cursor : undefined;
      pages += 1;
      if (pages > 50) break;
    } while (cursor);

    photos.sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
    );

    return NextResponse.json({ photos });
  } catch (error) {
    console.error("Gallery list error:", error);
    return NextResponse.json(
      { error: "Could not load the album.", photos: [] },
      { status: 500 },
    );
  }
}
