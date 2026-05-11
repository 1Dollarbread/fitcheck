"use client";

import { FormEvent, useEffect, useState } from "react";

type UploadedFit = {
  url: string;
  pathname: string;
};

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadedFits, setUploadedFits] = useState<UploadedFit[]>([]);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setErrorMessage("Choose or take a photo before uploading.");
      return;
    }

    setErrorMessage("");
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Upload failed.");
      }

      const payload = (await response.json()) as UploadedFit;
      setUploadedFits((current) => [payload, ...current]);
      setSelectedFile(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Upload failed unexpectedly.";
      setErrorMessage(message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">FitCheck</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        Upload or snap a photo of your outfit. We will save it now, then add AI
        ranking and budget-friendly suggestions in the next step.
      </p>

      <form
        onSubmit={handleUpload}
        className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <label className="mb-2 block text-sm font-medium">Your fit photo</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setSelectedFile(file);
            setErrorMessage("");
          }}
          className="block w-full cursor-pointer rounded-lg border border-zinc-300 bg-zinc-50 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />

        {previewUrl && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">Preview</p>
            <img
              src={previewUrl}
              alt="Preview of selected outfit"
              className="max-h-96 w-auto rounded-xl border border-zinc-200 object-contain dark:border-zinc-700"
            />
          </div>
        )}

        {errorMessage && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={isUploading}
          className="mt-6 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black"
        >
          {isUploading ? "Uploading..." : "Save fit photo"}
        </button>
      </form>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Saved photos</h2>
        {uploadedFits.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            No photos uploaded yet.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {uploadedFits.map((fit) => (
              <article
                key={fit.pathname}
                className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
              >
                <img
                  src={fit.url}
                  alt="Uploaded fit photo"
                  className="h-64 w-full object-cover"
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
