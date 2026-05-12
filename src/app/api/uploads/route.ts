import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "heic",
  "heif",
  "avif",
  "bmp",
  "tif",
  "tiff",
]);

function extensionFromName(name: string): string {
  const part = name.split(".").pop()?.toLowerCase() ?? "";
  return part;
}

function looksLikeImage(mime: string, ext: string): boolean {
  if (mime.startsWith("image/")) return true;
  if (IMAGE_EXTENSIONS.has(ext)) return true;
  if (mime === "application/octet-stream" && IMAGE_EXTENSIONS.has(ext)) {
    return true;
  }
  return false;
}

function contentTypeForUpload(mime: string, ext: string): string {
  if (mime.startsWith("image/")) return mime;
  const byExt: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
    avif: "image/avif",
    bmp: "image/bmp",
    tif: "image/tiff",
    tiff: "image/tiff",
  };
  return byExt[ext] ?? "image/jpeg";
}

function safeUploadExtension(ext: string): string {
  return IMAGE_EXTENSIONS.has(ext) ? ext : "jpg";
}

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return NextResponse.json(
      {
        error:
          "Upload storage is not configured. Set BLOB_READ_WRITE_TOKEN in .env.local (local) or in Vercel project settings.",
      },
      { status: 503 },
    );
  }

  try {
    const formData = await request.formData();
    const raw = formData.get("file");

    if (!raw || !(raw instanceof Blob)) {
      return NextResponse.json(
        { error: "A photo file is required." },
        { status: 400 },
      );
    }

    if (raw.size === 0) {
      return NextResponse.json(
        { error: "That file is empty. Try choosing the photo again." },
        { status: 400 },
      );
    }

    const fileName =
      raw instanceof File && raw.name.trim() !== ""
        ? raw.name
        : `fit-${Date.now()}.jpg`;

    const mime = raw.type.trim();
    const ext = extensionFromName(fileName);

    if (!looksLikeImage(mime, ext)) {
      return NextResponse.json(
        {
          error:
            "Only image files are allowed (for example JPG, PNG, HEIC, or WebP).",
        },
        { status: 400 },
      );
    }

    const uploadExt = safeUploadExtension(ext);
    const storageName = `fit-${Date.now()}.${uploadExt}`;
    const contentType = contentTypeForUpload(mime, ext);

    const blob = await put(storageName, raw, {
      access: "public",
      addRandomSuffix: true,
      contentType,
      multipart: raw.size > 4_500_000,
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
    });
  } catch (error) {
    console.error("Upload error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown upload error";
    const hint =
      message.toLowerCase().includes("token") ||
      message.toLowerCase().includes("unauthorized")
        ? " Check BLOB_READ_WRITE_TOKEN is valid and has read/write access."
        : "";
    return NextResponse.json(
      { error: `Could not upload your photo. ${message}${hint}` },
      { status: 500 },
    );
  }
}
