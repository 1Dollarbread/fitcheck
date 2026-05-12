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

type TabId = "save" | "album";

type CameraRevealPhase = "flash" | "content";

type PlaceholderScores = {
  overall: number;
  fit: number;
  palette: number;
};

const COMPLIMENTS = [
  "Looking good.",
  "That fit is working.",
  "Sharp — you’re bringing it.",
  "Clean. Confident. Nice.",
  "You’re styled with intention.",
  "Strong silhouette, strong energy.",
  "This one’s a keeper.",
  "Effortless vibe, polished result.",
  "Color and balance are on point.",
  "Ready for the mirror selfie.",
];

function pickCompliment(): string {
  return COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)] ?? "Looking good.";
}

function randomPlaceholderScores(): PlaceholderScores {
  return {
    overall: 72 + Math.floor(Math.random() * 23),
    fit: 6 + Math.floor(Math.random() * 4),
    palette: 6 + Math.floor(Math.random() * 4),
  };
}

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

  const [cameraRevealOpen, setCameraRevealOpen] = useState(false);
  const [cameraRevealPhase, setCameraRevealPhase] =
    useState<CameraRevealPhase>("flash");
  const [revealCompliment, setRevealCompliment] = useState("");
  const [revealScores, setRevealScores] = useState<PlaceholderScores | null>(
    null,
  );

  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [albumLoading, setAlbumLoading] = useState(false);
  const [albumError, setAlbumError] = useState("");

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const [albumDeleteMode, setAlbumDeleteMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

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
    if (tab !== "save") {
      setCameraRevealOpen(false);
      setCameraRevealPhase("flash");
    }
  }, [tab]);

  const closeCameraRevealKeepFile = useCallback(() => {
    setCameraRevealOpen(false);
    setCameraRevealPhase("flash");
  }, []);

  const overlayOpen = Boolean(lightboxUrl) || cameraRevealOpen;

  useEffect(() => {
    if (!overlayOpen) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (lightboxUrl) setLightboxUrl(null);
        else if (cameraRevealOpen) closeCameraRevealKeepFile();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [
    overlayOpen,
    lightboxUrl,
    cameraRevealOpen,
    closeCameraRevealKeepFile,
  ]);

  useEffect(() => {
    if (!cameraRevealOpen || cameraRevealPhase !== "flash") return;
    const timer = window.setTimeout(() => {
      setCameraRevealPhase("content");
    }, 1380);
    return () => window.clearTimeout(timer);
  }, [cameraRevealOpen, cameraRevealPhase]);

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

  function handleLibraryFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setCameraRevealOpen(false);
    setCameraRevealPhase("flash");
    setRevealScores(null);
    setSelectedFile(file);
    setErrorMessage("");
    setSaveSuccess(false);
  }

  function handleCameraFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setErrorMessage("");
    setSaveSuccess(false);
    setRevealScores(null);
    if (file) {
      setRevealCompliment(pickCompliment());
      setRevealScores(randomPlaceholderScores());
      setCameraRevealPhase("flash");
      setCameraRevealOpen(true);
    } else {
      setCameraRevealOpen(false);
    }
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

  function retakeCamera() {
    closeCameraRevealKeepFile();
    setSelectedFile(null);
    if (libraryInputRef.current) libraryInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    window.setTimeout(() => openCameraPicker(), 80);
  }

  const uploadSelectedFile = useCallback(async (): Promise<boolean> => {
    if (!selectedFile) return false;
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

      await response.json();
      setSelectedFile(null);
      if (libraryInputRef.current) libraryInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      setSaveSuccess(true);
      setCameraRevealOpen(false);
      setCameraRevealPhase("flash");
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Upload failed unexpectedly.";
      setErrorMessage(message);
      return false;
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setErrorMessage("Choose a photo from your library, files, or camera first.");
      return;
    }
    await uploadSelectedFile();
  }

  function toggleDeleteSelection(pathname: string) {
    setSelectedForDelete((prev) =>
      prev.includes(pathname)
        ? prev.filter((p) => p !== pathname)
        : [...prev, pathname],
    );
  }

  function exitAlbumDeleteMode() {
    setAlbumDeleteMode(false);
    setSelectedForDelete([]);
  }

  function enterAlbumDeleteMode() {
    setLightboxUrl(null);
    setAlbumDeleteMode(true);
    setSelectedForDelete([]);
  }

  async function confirmDeleteSelected() {
    const n = selectedForDelete.length;
    if (n === 0) return;
    const ok = window.confirm(
      `Permanently delete ${n} photo${n === 1 ? "" : "s"}? This cannot be undone.`,
    );
    if (!ok) return;

    setIsDeleting(true);
    setAlbumError("");
    try {
      const response = await fetch("/api/gallery/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathnames: selectedForDelete }),
      });
      if (!response.ok) {
        const message = await readErrorMessage(response);
        throw new Error(message);
      }
      exitAlbumDeleteMode();
      await loadAlbum();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not delete photos.";
      setAlbumError(message);
    } finally {
      setIsDeleting(false);
    }
  }

  function handleAlbumThumbClick(photo: GalleryPhoto) {
    if (albumDeleteMode) {
      toggleDeleteSelection(photo.pathname);
      return;
    }
    setLightboxUrl(photo.url);
  }

  const deleteSelectedCount = selectedForDelete.length;
  const showAlbumFab = tab === "album" && photos.length > 0;

  return (
    <main
      className={`mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-10 ${showAlbumFab ? "pb-28 sm:pb-24" : ""}`}
    >
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
            onChange={handleLibraryFileSelected}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={handleCameraFileSelected}
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

          {selectedFile && !cameraRevealOpen && (
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Selected:{" "}
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                {selectedFile.name || "Photo"}
              </span>
              {selectedFile.type ? ` (${selectedFile.type})` : ""}
            </p>
          )}

          {previewUrl && !cameraRevealOpen && (
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
          {albumDeleteMode && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
              Tap photos to select them, then use Delete in the corner to remove
              them forever.
            </p>
          )}

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
            {photos.map((photo) => {
              const selected = selectedForDelete.includes(photo.pathname);
              return (
                <button
                  key={photo.pathname}
                  type="button"
                  onClick={() => handleAlbumThumbClick(photo)}
                  className={`group relative aspect-square w-full overflow-hidden rounded-xl border bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black dark:bg-zinc-800 dark:focus-visible:outline-white ${
                    selected
                      ? "border-red-500 ring-2 ring-red-500/80 ring-offset-2 ring-offset-white dark:border-red-500 dark:ring-offset-zinc-900"
                      : "border-zinc-200 dark:border-zinc-700"
                  }`}
                >
                  <img
                    src={photo.url}
                    alt=""
                    className="h-full w-full object-cover transition group-hover:opacity-95"
                  />
                  {albumDeleteMode && selected && (
                    <span className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white shadow">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {showAlbumFab && (
        <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
          {albumDeleteMode ? (
            <>
              <button
                type="button"
                onClick={exitAlbumDeleteMode}
                disabled={isDeleting}
                className="rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 shadow-lg transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteSelected()}
                disabled={deleteSelectedCount === 0 || isDeleting}
                className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isDeleting
                  ? "Deleting…"
                  : deleteSelectedCount === 0
                    ? "Delete"
                    : `Delete (${deleteSelectedCount})`}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={enterAlbumDeleteMode}
              className="rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-lg transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
            >
              Delete
            </button>
          )}
        </div>
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

      {cameraRevealOpen && previewUrl && revealScores && (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-zinc-950 text-zinc-50"
          role="dialog"
          aria-modal="true"
          aria-label="Photo captured"
        >
          {cameraRevealPhase === "flash" && (
            <div
              className="pointer-events-none absolute inset-0 z-20 bg-white fit-flash-screen"
              aria-hidden
            />
          )}

          <button
            type="button"
            onClick={closeCameraRevealKeepFile}
            className="absolute right-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl font-light text-white backdrop-blur transition hover:bg-white/20"
            aria-label="Close"
          >
            ×
          </button>

          <div className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-y-auto px-5 pb-10 pt-16">
            {cameraRevealPhase === "content" && (
              <>
                <p className="fit-fade-up max-w-md text-center text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {revealCompliment}
                </p>

                <p className="fit-fade-up fit-fade-up-delay-1 mt-3 text-center text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                  Preview only
                </p>

                <div className="fit-fade-up fit-fade-up-delay-2 mt-8 grid w-full max-w-sm grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-4 backdrop-blur-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      Overall
                    </p>
                    <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-white">
                      {revealScores.overall}
                      <span className="text-base font-normal text-zinc-500">
                        /100
                      </span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-4 backdrop-blur-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      Fit
                    </p>
                    <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-white">
                      {revealScores.fit}
                      <span className="text-base font-normal text-zinc-500">
                        /10
                      </span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-4 backdrop-blur-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      Palette
                    </p>
                    <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-white">
                      {revealScores.palette}
                      <span className="text-base font-normal text-zinc-500">
                        /10
                      </span>
                    </p>
                  </div>
                </div>

                <p className="fit-fade-up fit-fade-up-delay-3 mt-4 max-w-sm text-center text-xs leading-relaxed text-zinc-500">
                  Full AI scoring and fit tips are coming next. These numbers are
                  placeholders for layout only.
                </p>

                <div className="fit-scale-in mt-8 w-full max-w-sm">
                  <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50 ring-1 ring-white/10">
                    <img
                      src={previewUrl}
                      alt="Your outfit"
                      className="aspect-[3/4] w-full object-cover"
                    />
                  </div>
                </div>

                <div className="fit-fade-up fit-fade-up-delay-4 mt-10 flex w-full max-w-sm flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => void uploadSelectedFile()}
                    className="flex-1 rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-50"
                  >
                    {isUploading ? "Saving…" : "Save to album"}
                  </button>
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={retakeCamera}
                    className="flex-1 rounded-full border border-white/20 bg-transparent px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                  >
                    Retake
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
