import { list } from "@vercel/blob";
import { NextResponse } from "next/server";

import { FITCHECK_BLOB_PREFIX } from "@/lib/fitcheck-blob";

export async function GET() {
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
        prefix: FITCHECK_BLOB_PREFIX,
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
