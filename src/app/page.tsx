"use client";

import { type ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

type UploadedFit = {
  url: string;
  pathname: string;
};

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return response.statusText || "Upload failed.";
  try {
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error ?? text;
  } catch {
    return text;
  }
}

export default function Home() {
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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

  function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setErrorMessage("");
  }

  function openLibraryPicker() {
    const input = libraryInputRef.current;
    if (!input) return;
    input.value = "";
    input.click();
  }

  function openCameraPicker() {
    const input = cameraInputRef.current;
    if (!input) return;
    input.value = "";
    input.click();
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setErrorMessage("Choose a photo from your library, files, or camera first.");
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
        const message = await readErrorMessage(response);
        throw new Error(message);
      }

      const payload = (await response.json()) as UploadedFit;
      setUploadedFits((current) => [payload, ...current]);
      setSelectedFile(null);
      if (libraryInputRef.current) libraryInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
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
        Upload or snap a photo of your outfit. We save it for now; scoring and
        budget-friendly suggestions come next.
      </p>

      <form
        onSubmit={handleUpload}
        className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <p className="mb-3 text-sm font-medium">Add your fit photo</p>
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          Use{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            Add a file
          </span>{" "}
          for your photo library, the Files app, or Finder / File Explorer. Use{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            Take a photo
          </span>{" "}
          to use the camera right away.
        </p>

        {/* Library / files / Finder / Photo library — no `capture`, so iOS can pick photos or Files */}
        <input
          ref={libraryInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={handleFileSelected}
        />
        {/* Camera only — `capture` hints the device to open the camera */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={handleFileSelected}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={openLibraryPicker}
            className="rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
          >
            Add a file
          </button>
          <button
            type="button"
            onClick={openCameraPicker}
            className="rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Take a photo
          </button>
        </div>

        {selectedFile && (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            Selected:{" "}
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              {selectedFile.name || "Photo"}
            </span>
            {selectedFile.type ? ` (${selectedFile.type})` : ""}
          </p>
        )}

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
          disabled={isUploading || !selectedFile}
          className="mt-6 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
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
