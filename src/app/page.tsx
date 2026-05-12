"use client";

import {
  type ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { FitAnalysisResponse } from "@/lib/analyze-fit-types";
import { FIT_SCORING_RULES } from "@/lib/fit-scoring-rules";

type GalleryPhoto = {
  url: string;
  pathname: string;
  uploadedAt: string;
};

type TabId = "save" | "album";

type CameraRevealPhase = "flash" | "analyzing" | "content";

function ruleLabel(ruleId: string): string {
  return FIT_SCORING_RULES.find((r) => r.id === ruleId)?.label ?? ruleId;
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
  const [cameraFlowActive, setCameraFlowActive] = useState(false);
  const [fitAnalysis, setFitAnalysis] = useState<FitAnalysisResponse | null>(
    null,
  );
  const [fitAnalysisError, setFitAnalysisError] = useState<string | null>(null);

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
      setCameraRevealPhase("analyzing");
    }, 1380);
    return () => window.clearTimeout(timer);
  }, [cameraRevealOpen, cameraRevealPhase]);

  useEffect(() => {
    if (!cameraRevealOpen || cameraRevealPhase !== "analyzing" || !selectedFile) {
      return;
    }

    const ac = new AbortController();

    (async () => {
      setFitAnalysis(null);
      setFitAnalysisError(null);
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const response = await fetch("/api/analyze-fit", {
          method: "POST",
          body: formData,
          signal: ac.signal,
        });
        const data = (await response.json()) as FitAnalysisResponse & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "Outfit scan failed.");
        }
        setFitAnalysis(data);
        setCameraRevealPhase("content");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        const message =
          error instanceof Error ? error.message : "Outfit scan failed.";
        setFitAnalysisError(message);
        setCameraRevealPhase("content");
      }
    })();

    return () => ac.abort();
  }, [cameraRevealOpen, cameraRevealPhase, selectedFile]);

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
    setCameraFlowActive(false);
    setFitAnalysis(null);
    setFitAnalysisError(null);
    setSelectedFile(file);
    setErrorMessage("");
    setSaveSuccess(false);
  }

  function handleCameraFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setErrorMessage("");
    setSaveSuccess(false);
    setFitAnalysis(null);
    setFitAnalysisError(null);
    if (file) {
      setCameraFlowActive(true);
      setCameraRevealPhase("flash");
      setCameraRevealOpen(true);
    } else {
      setCameraRevealOpen(false);
      setCameraFlowActive(false);
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
    setCameraFlowActive(false);
    setFitAnalysis(null);
    setFitAnalysisError(null);
    setSelectedFile(null);
    if (libraryInputRef.current) libraryInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    window.setTimeout(() => openCameraPicker(), 80);
  }

  function tryAgainNoOutfit() {
    closeCameraRevealKeepFile();
    setCameraFlowActive(false);
    setFitAnalysis(null);
    setFitAnalysisError(null);
    setSelectedFile(null);
    if (libraryInputRef.current) libraryInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    setTab("save");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function retryAnalysis() {
    setFitAnalysis(null);
    setFitAnalysisError(null);
    setCameraRevealPhase("analyzing");
  }

  const uploadSelectedFile = useCallback(async (): Promise<boolean> => {
    if (!selectedFile) return false;
    if (cameraFlowActive) {
      if (!fitAnalysis) {
        setErrorMessage(
          "Wait for the outfit scan to finish before saving, or use Add a file instead.",
        );
        return false;
      }
      if (!fitAnalysis.clothingDetected) {
        setErrorMessage(
          "This capture cannot be saved. Use Try again from the camera results.",
        );
        return false;
      }
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

      await response.json();
      setSelectedFile(null);
      setCameraFlowActive(false);
      setFitAnalysis(null);
      setFitAnalysisError(null);
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
  }, [selectedFile, cameraFlowActive, fitAnalysis]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setErrorMessage("Choose a photo from your library, files, or camera first.");
      return;
    }
    if (cameraFlowActive) {
      if (!fitAnalysis) {
        setErrorMessage(
          "Finish the camera outfit scan first, or use Add a file to upload without the camera flow.",
        );
        return;
      }
      if (!fitAnalysis.clothingDetected) {
        setErrorMessage(
          "This photo cannot be saved to the album. Use Try again from the camera results.",
        );
        return;
      }
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

      {cameraRevealOpen && previewUrl && (
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

          <div className="relative z-10 flex flex-1 flex-col items-center overflow-y-auto px-5 pb-10 pt-16">
            {cameraRevealPhase === "analyzing" && (
              <div className="flex min-h-[50vh] flex-col items-center justify-center gap-5 py-12">
                <div
                  className="h-11 w-11 animate-spin rounded-full border-2 border-white/15 border-t-white"
                  aria-hidden
                />
                <div className="text-center">
                  <p className="text-lg font-semibold tracking-tight">
                    Scanning your outfit…
                  </p>
                  <p className="mt-2 max-w-xs text-sm text-zinc-500">
                    Finding shirt, pants, shoes & accessories — ignoring random
                    objects so they do not count as clothes.
                  </p>
                </div>
              </div>
            )}

            {cameraRevealPhase === "content" && fitAnalysisError && (
              <div className="flex w-full max-w-sm flex-col items-center text-center">
                <p className="text-lg font-semibold text-white">Scan hit a snag</p>
                <p className="mt-2 text-sm text-red-300/90">{fitAnalysisError}</p>
                <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={retryAnalysis}
                    className="flex-1 rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
                  >
                    Retry scan
                  </button>
                  <button
                    type="button"
                    onClick={closeCameraRevealKeepFile}
                    className="flex-1 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {cameraRevealPhase === "content" &&
              !fitAnalysisError &&
              fitAnalysis &&
              !fitAnalysis.clothingDetected && (
                <div className="flex w-full max-w-md flex-col items-center">
                  {fitAnalysis.demoMode && (
                    <div className="mb-5 w-full rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-center text-xs leading-relaxed text-amber-50">
                      <strong className="font-semibold">Demo mode.</strong> No
                      vision API key is set, so results are simulated from your
                      file (not a real camera read). For a free real scan in many
                      regions, add{" "}
                      <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[11px]">
                        GROQ_API_KEY
                      </code>{" "}
                      from{" "}
                      <a
                        href="https://console.groq.com/keys"
                        className="font-semibold underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        console.groq.com
                      </a>
                      .
                    </div>
                  )}
                  <p className="fit-fade-up text-center text-2xl font-semibold leading-snug tracking-tight text-white sm:text-3xl">
                    {fitAnalysis.noClothingMessage ??
                      "The outfit dimension does not exist in this timeline."}
                  </p>
                  <p className="fit-fade-up fit-fade-up-delay-1 mt-3 text-center text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                    Official scorecard
                    {fitAnalysis.demoMode ? " · simulated" : ""}
                  </p>

                  <div className="fit-fade-up fit-fade-up-delay-2 mt-8 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-center backdrop-blur-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      Overall
                    </p>
                    <p className="mt-1 font-mono text-4xl font-semibold tabular-nums text-white">
                      0
                      <span className="text-xl font-normal text-zinc-500">
                        /{fitAnalysis.overallMax}
                      </span>
                    </p>
                  </div>

                  <div className="fit-fade-up fit-fade-up-delay-2 mt-4 max-h-48 w-full space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3">
                    {fitAnalysis.ruleScores.map((row) => (
                      <div
                        key={row.ruleId}
                        className="flex items-center justify-between gap-2 text-xs text-zinc-400"
                      >
                        <span className="truncate text-left text-zinc-300">
                          {ruleLabel(row.ruleId)}
                        </span>
                        <span className="shrink-0 font-mono tabular-nums text-zinc-500">
                          0/{row.maxScore}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="fit-fade-up fit-fade-up-delay-3 mt-4 text-center text-xs leading-relaxed text-zinc-500">
                    Nothing wearable was detected, so this one will not be saved
                    to your album. Wardrobe integrity protocol engaged.
                  </p>

                  <div className="fit-scale-in mt-8 w-full max-w-sm">
                    <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50 ring-1 ring-white/10">
                      <img
                        src={previewUrl}
                        alt="Your photo"
                        className="aspect-[3/4] w-full object-cover opacity-90"
                      />
                    </div>
                  </div>

                  <div className="fit-fade-up fit-fade-up-delay-4 mt-10 flex w-full max-w-sm flex-col gap-3">
                    <button
                      type="button"
                      onClick={tryAgainNoOutfit}
                      className="w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
                    >
                      Try again
                    </button>
                    <button
                      type="button"
                      onClick={retakeCamera}
                      className="w-full rounded-full border border-white/20 bg-transparent px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Retake photo
                    </button>
                  </div>
                </div>
              )}

            {cameraRevealPhase === "content" &&
              !fitAnalysisError &&
              fitAnalysis &&
              fitAnalysis.clothingDetected && (
                <div className="flex w-full max-w-md flex-col items-center">
                  {fitAnalysis.demoMode && (
                    <div className="mb-5 w-full rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-center text-xs leading-relaxed text-amber-50">
                      <strong className="font-semibold">Demo mode.</strong> No
                      vision API key is set, so scores are simulated (not from
                      real image AI). Add a free{" "}
                      <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[11px]">
                        GROQ_API_KEY
                      </code>{" "}
                      from{" "}
                      <a
                        href="https://console.groq.com/keys"
                        className="font-semibold underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        console.groq.com
                      </a>{" "}
                      for real analysis.
                    </div>
                  )}
                  <p className="fit-fade-up max-w-md text-center text-2xl font-semibold leading-snug tracking-tight text-white sm:text-3xl">
                    {fitAnalysis.overallComment}
                  </p>
                  <p className="fit-fade-up fit-fade-up-delay-1 mt-3 text-center text-xs font-medium uppercase tracking-[0.2em] text-emerald-400/90">
                    {fitAnalysis.demoMode
                      ? "Demo scan · simulated scores"
                      : "AI fit check · rule-based score"}
                  </p>

                  {fitAnalysis.detectedItems.length > 0 && (
                    <div className="fit-fade-up fit-fade-up-delay-2 mt-6 flex w-full flex-wrap justify-center gap-2">
                      {fitAnalysis.detectedItems.map((d, i) => (
                        <span
                          key={`${d.label}-${i}`}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-200"
                        >
                          <span className="font-medium text-white">{d.label}</span>
                          <span className="text-zinc-500"> · </span>
                          {d.colorDescription}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="fit-fade-up fit-fade-up-delay-2 mt-8 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-center backdrop-blur-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      Overall
                    </p>
                    <p className="mt-1 font-mono text-4xl font-semibold tabular-nums text-white">
                      {fitAnalysis.overallScore}
                      <span className="text-xl font-normal text-zinc-500">
                        /{fitAnalysis.overallMax}
                      </span>
                    </p>
                  </div>

                  <div className="fit-fade-up fit-fade-up-delay-2 mt-4 max-h-44 w-full space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3">
                    {fitAnalysis.ruleScores.map((row) => (
                      <div
                        key={row.ruleId}
                        className="border-b border-white/5 pb-2 last:border-0 last:pb-0"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-medium text-zinc-300">
                            {ruleLabel(row.ruleId)}
                          </span>
                          <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-400">
                            {row.score}/{row.maxScore}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                          {row.shortFeedback}
                        </p>
                      </div>
                    ))}
                  </div>

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
                </div>
              )}
          </div>
        </div>
      )}
    </main>
  );
}
