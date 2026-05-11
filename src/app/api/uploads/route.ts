import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "A photo file is required." },
        { status: 400 },
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image uploads are allowed." },
        { status: 400 },
      );
    }

    const extension = file.name.split(".").pop() || "jpg";
    const fileName = `fit-${Date.now()}.${extension}`;

    const blob = await put(fileName, file, {
      access: "public",
      addRandomSuffix: true,
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Could not upload your photo. Try again." },
      { status: 500 },
    );
  }
}
