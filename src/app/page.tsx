"use client";

import {
  type ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type GalleryPhoto = {
  url: string;
  pathname: string;
  uploadedAt: string;
};

type UploadResponse = {
  url: string;
  pathname: string;
};

type TabId = "save" | "album";

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return response.statusText || "Request failed.";
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

  const [tab, setTab] = useState<TabId>("save");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [albumLoading, setAlbumLoading] = useState(false);
  const [albumError, setAlbumError] = useState("");

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const loadAlbum = useCallback(async () => {
    setAlbumError("");
    setAlbumLoading(true);
    try {
      const response = await fetch("/api/gallery");
      const data = (await response.json()) as {
        photos?: GalleryPhoto[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? (await readErrorMessage(response)));
      }
      setPhotos(data.photos ?? []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not load album.";
      setAlbumError(message);
      setPhotos([]);
    } finally {
      setAlbumLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== "album") return;
    void loadAlbum();
  }, [tab, loadAlbum]);

  useEffect(() => {
    if (!lightboxUrl) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setLightboxUrl(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [lightboxUrl]);

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
    setSaveSuccess(false);
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
    setSaveSuccess(false);
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

      await response.json() as UploadResponse;
      setSelectedFile(null);
      if (libraryInputRef.current) libraryInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      setSaveSuccess(true);
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
        Save outfit photos in one place, then browse them in your album.
      </p>

      <div
        className="mt-8 flex rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900"
        role="tablist"
        aria-label="FitCheck sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "save"}
          onClick={() => setTab("save")}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
            tab === "save"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          Save photos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "album"}
          onClick={() => setTab("album")}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
            tab === "album"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          Album
        </button>
      </div>

      {tab === "save" && (
        <form
          onSubmit={handleUpload}
          className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
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

          <input
            ref={libraryInputRef}
            type="file"
            accept="image/*,.heic,.heif"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={handleFileSelected}
          />
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

          {saveSuccess && (
            <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-400">
              Saved. Open the{" "}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => setTab("album")}
              >
                Album
              </button>{" "}
              tab to view it.
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
      )}

      {tab === "album" && (
        <section
          className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          role="tabpanel"
          aria-label="Album"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Your album</h2>
            <button
              type="button"
              onClick={() => void loadAlbum()}
              disabled={albumLoading}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {albumLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {albumError && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">
              {albumError}
            </p>
          )}

          {!albumLoading && !albumError && photos.length === 0 && (
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
              No photos yet. Use the Save photos tab to add your first fit.
            </p>
          )}

          {albumLoading && photos.length === 0 && !albumError && (
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
              Loading album…
            </p>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5">
            {photos.map((photo) => (
              <button
                key={photo.pathname}
                type="button"
                onClick={() => setLightboxUrl(photo.url)}
                className="group relative aspect-square w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black dark:border-zinc-700 dark:bg-zinc-800 dark:focus-visible:outline-white"
              >
                <img
                  src={photo.url}
                  alt=""
                  className="h-full w-full object-cover transition group-hover:opacity-95"
                />
              </button>
            ))}
          </div>
        </section>
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Full size photo"
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl font-light text-white backdrop-blur transition hover:bg-white/20"
            aria-label="Close"
          >
            ×
          </button>
          <img
            src={lightboxUrl}
            alt="Enlarged fit photo"
            className="max-h-[100dvh] max-w-full object-contain"
          />
        </div>
      )}
    </main>
  );
}
