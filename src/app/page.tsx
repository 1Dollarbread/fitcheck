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

type AuthUser = {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  usernameUpdatedAt?: string;
  passwordUpdatedAt?: string;
};

type AuthMode = "login" | "signup" | "verify-signup" | "forgot" | "reset";

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

async function postJson<T>(
  url: string,
  body?: Record<string, unknown>,
  method = "POST",
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data;
}

function cooldownText(value?: string) {
  if (!value) return "Available now";
  const next = new Date(new Date(value).getTime() + 60 * 24 * 60 * 60 * 1000);
  const days = Math.ceil((next.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return days > 0 ? `Locked for ${days} more day${days === 1 ? "" : "s"}` : "Available now";
}

function AuthScreen({ onAuthed }: { onAuthed: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "login") {
        const data = await postJson<{ user: AuthUser }>("/api/auth/login", {
          login: email,
          password,
        });
        onAuthed(data.user);
      } else if (mode === "signup") {
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        const data = await postJson<{ devCode?: string }>("/api/auth/register", {
          email,
          username,
          password,
        });
        setMode("verify-signup");
        setMessage(
          data.devCode
            ? `Verification code: ${data.devCode}`
            : "Check your email for the 6-digit code.",
        );
      } else if (mode === "verify-signup") {
        const data = await postJson<{ user: AuthUser }>(
          "/api/auth/verify-registration",
          { email, code },
        );
        onAuthed(data.user);
      } else if (mode === "forgot") {
        const data = await postJson<{ devCode?: string }>(
          "/api/auth/forgot-password",
          { email },
        );
        setMode("reset");
        setMessage(
          data.devCode
            ? `Password reset code: ${data.devCode}`
            : "Check your email for the reset code.",
        );
      } else if (mode === "reset") {
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        await postJson("/api/auth/reset-password", { email, code, password });
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setCode("");
        setMessage("Password updated. Sign in with the new password.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    setBusy(true);
    setError("");
    try {
      await postJson("/api/auth/google");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in is not configured.");
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "signup"
      ? "Create account"
      : mode === "verify-signup"
        ? "Verify email"
        : mode === "forgot" || mode === "reset"
          ? "Reset password"
          : "Welcome back";

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col justify-center bg-[radial-gradient(circle_at_top_left,#f3e8ff_0,#fff_36%,#fff_100%)] px-5 py-8 text-[#20172f] shadow-2xl shadow-purple-950/10 sm:my-6 sm:min-h-[880px] sm:rounded-[2rem]">
      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-purple-500">
        FitCheck account
      </p>
      <h1 className="mt-2 text-4xl font-black tracking-tight text-[#27123d]">
        {title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-[#6f5d82]">
        Sign in to keep your album private and tied to your profile.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        {(mode === "signup") && (
          <label className="block text-sm font-bold text-[#352044]">
            Username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-purple-100 bg-white px-4 py-3 outline-none ring-purple-300 focus:ring-2"
              required
            />
          </label>
        )}

        <label className="block text-sm font-bold text-[#352044]">
          {mode === "login" ? "Email or username" : "Email"}
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type={mode === "login" ? "text" : "email"}
            className="mt-2 w-full rounded-2xl border border-purple-100 bg-white px-4 py-3 outline-none ring-purple-300 focus:ring-2"
            required
          />
        </label>

        {(mode === "login" || mode === "signup" || mode === "reset") && (
          <label className="block text-sm font-bold text-[#352044]">
            {mode === "reset" ? "New password" : "Password"}
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              className="mt-2 w-full rounded-2xl border border-purple-100 bg-white px-4 py-3 outline-none ring-purple-300 focus:ring-2"
              required
            />
          </label>
        )}

        {(mode === "signup" || mode === "reset") && (
          <label className="block text-sm font-bold text-[#352044]">
            Confirm password
            <input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              className="mt-2 w-full rounded-2xl border border-purple-100 bg-white px-4 py-3 outline-none ring-purple-300 focus:ring-2"
              required
            />
          </label>
        )}

        {(mode === "verify-signup" || mode === "reset") && (
          <label className="block text-sm font-bold text-[#352044]">
            6-digit code
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              maxLength={6}
              className="mt-2 w-full rounded-2xl border border-purple-100 bg-white px-4 py-3 outline-none ring-purple-300 focus:ring-2"
              required
            />
          </label>
        )}

        {message && <p className="text-sm font-bold text-emerald-700">{message}</p>}
        {error && <p className="text-sm font-bold text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-[#251236] px-5 py-4 text-base font-black text-white shadow-xl shadow-purple-950/20 transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy
            ? "Working..."
            : mode === "signup"
              ? "Send verification code"
              : mode === "verify-signup"
                ? "Create account"
                : mode === "forgot"
                  ? "Send reset code"
                  : mode === "reset"
                    ? "Update password"
                    : "Log in"}
        </button>
      </form>

      <button
        type="button"
        onClick={googleSignIn}
        className="mt-3 w-full rounded-2xl border border-purple-200 bg-white px-5 py-4 text-sm font-black text-purple-800 shadow-sm"
      >
        Continue with Google
      </button>

      <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm font-bold text-purple-700">
        {mode !== "login" && (
          <button type="button" onClick={() => setMode("login")}>
            Log in
          </button>
        )}
        {mode !== "signup" && (
          <button type="button" onClick={() => setMode("signup")}>
            Sign up
          </button>
        )}
        {mode !== "forgot" && mode !== "reset" && (
          <button type="button" onClick={() => setMode("forgot")}>
            Forgot password?
          </button>
        )}
      </div>
    </main>
  );
}

function ProfileModal({
  user,
  onClose,
  onUserChange,
  onLogout,
}: {
  user: AuthUser;
  onClose: () => void;
  onUserChange: (user: AuthUser) => void;
  onLogout: () => void;
}) {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [showPasswordNote, setShowPasswordNote] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await postJson<{
        user: AuthUser;
        pendingEmail?: string | null;
        devCode?: string;
      }>("/api/profile", { username, email, password }, "PATCH");
      onUserChange(data.user);
      setPassword("");
      if (data.pendingEmail) {
        setPendingEmail(data.pendingEmail);
        setMessage(
          data.devCode
            ? `Email confirmation code: ${data.devCode}`
            : "Check your new email for the confirmation code.",
        );
      } else {
        setMessage("Profile updated.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmail() {
    setBusy(true);
    setError("");
    try {
      const data = await postJson<{ user: AuthUser }>(
        "/api/profile/verify-email",
        { code: emailCode },
      );
      onUserChange(data.user);
      setEmail(data.user.email);
      setPendingEmail("");
      setEmailCode("");
      setMessage("Email updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify email.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as { user?: AuthUser; error?: string };
      if (!response.ok || !data.user) throw new Error(data.error ?? "Avatar upload failed.");
      onUserChange(data.user);
      setMessage("Profile image updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Avatar upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#160b22]/55 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <section className="max-h-[92dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[2rem] bg-white p-5 text-[#20172f] shadow-2xl sm:rounded-[2rem]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-purple-500">
              Profile
            </p>
            <h2 className="mt-1 text-3xl font-black tracking-tight">Account</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-2xl text-purple-900"
          >
            ×
          </button>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            className="h-20 w-20 overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600 to-fuchsia-500 text-xl font-black text-white shadow-lg"
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              user.username.slice(0, 2).toUpperCase()
            )}
          </button>
          <div>
            <p className="font-black">{user.username}</p>
            <p className="text-sm text-[#7d6a8f]">{user.email}</p>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="mt-2 text-sm font-black text-purple-700"
            >
              Change photo
            </button>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={uploadAvatar}
          />
        </div>

        <form onSubmit={saveProfile} className="mt-6 space-y-4">
          <label className="block text-sm font-bold">
            Username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-purple-100 px-4 py-3 outline-none ring-purple-300 focus:ring-2"
            />
            <span className="mt-1 block text-xs text-[#8c7a9c]">
              {cooldownText(user.usernameUpdatedAt)}
            </span>
          </label>
          <label className="block text-sm font-bold">
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className="mt-2 w-full rounded-2xl border border-purple-100 px-4 py-3 outline-none ring-purple-300 focus:ring-2"
            />
          </label>
          <label className="block text-sm font-bold">
            Password
            <div className="mt-2 flex gap-2">
              <input
                value={showPasswordNote ? "Stored securely; cannot be revealed" : "••••••••••••"}
                readOnly
                className="min-w-0 flex-1 rounded-2xl border border-purple-100 px-4 py-3 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPasswordNote((value) => !value)}
                className="rounded-2xl bg-purple-50 px-4 text-sm font-black text-purple-800"
              >
                {showPasswordNote ? "Hide" : "Unhide"}
              </button>
            </div>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="New password"
              className="mt-2 w-full rounded-2xl border border-purple-100 px-4 py-3 outline-none ring-purple-300 focus:ring-2"
            />
            <span className="mt-1 block text-xs text-[#8c7a9c]">
              {cooldownText(user.passwordUpdatedAt)}
            </span>
          </label>

          {pendingEmail && (
            <div className="border-l-2 border-purple-400 bg-purple-50 px-3 py-3">
              <p className="text-xs font-bold text-purple-900">
                Confirm {pendingEmail} before the email change is saved.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  value={emailCode}
                  onChange={(event) => setEmailCode(event.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  className="min-w-0 flex-1 rounded-xl border border-purple-100 px-3 py-2"
                />
                <button
                  type="button"
                  onClick={verifyEmail}
                  disabled={busy}
                  className="rounded-xl bg-purple-700 px-3 py-2 text-xs font-black text-white"
                >
                  Verify
                </button>
              </div>
            </div>
          )}

          {message && <p className="text-sm font-bold text-emerald-700">{message}</p>}
          {error && <p className="text-sm font-bold text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-gradient-to-r from-purple-700 to-fuchsia-500 px-5 py-4 text-sm font-black text-white shadow-lg shadow-purple-300/40 disabled:opacity-50"
          >
            {busy ? "Saving..." : "Save profile"}
          </button>
        </form>

        <button
          type="button"
          onClick={onLogout}
          className="mt-3 w-full rounded-2xl border border-purple-200 px-5 py-4 text-sm font-black text-purple-800"
        >
          Log out
        </button>
      </section>
    </div>
  );
}

export default function Home() {
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);

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

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/auth/me");
        const data = (await response.json()) as { user: AuthUser | null };
        if (active) setAuthUser(data.user);
      } finally {
        if (active) setAuthLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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
    const timer = window.setTimeout(() => {
      void loadAlbum();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [tab, loadAlbum]);

  useEffect(() => {
    if (tab === "save") return;
    const timer = window.setTimeout(() => {
      setCameraRevealOpen(false);
      setCameraRevealPhase("flash");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [tab]);

  const closeCameraRevealKeepFile = useCallback(() => {
    setCameraRevealOpen(false);
    setCameraRevealPhase("flash");
  }, []);

  const overlayOpen = Boolean(lightboxUrl) || cameraRevealOpen || profileOpen;

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
        else if (profileOpen) setProfileOpen(false);
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
    profileOpen,
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
      const timer = window.setTimeout(() => {
        setPreviewUrl("");
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    const timer = window.setTimeout(() => {
      setPreviewUrl(objectUrl);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

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
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    window.setTimeout(() => openCameraPicker(), 80);
  }

  function tryAgainNoOutfit() {
    closeCameraRevealKeepFile();
    setCameraFlowActive(false);
    setFitAnalysis(null);
    setFitAnalysisError(null);
    setSelectedFile(null);
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
          "Wait for the outfit scan to finish before saving.",
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
      setErrorMessage("Take or choose a photo first.");
      return;
    }
    if (cameraFlowActive) {
      if (!fitAnalysis) {
        setErrorMessage(
          "Finish the outfit scan before saving this photo.",
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

  async function logout() {
    await postJson("/api/auth/logout");
    setAuthUser(null);
    setProfileOpen(false);
    setPhotos([]);
    setTab("save");
  }

  if (authLoading) {
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] items-center justify-center bg-white px-5 text-[#20172f] shadow-2xl shadow-purple-950/10 sm:my-6 sm:min-h-[880px] sm:rounded-[2rem]">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-purple-500">
          Loading FitCheck
        </p>
      </main>
    );
  }

  if (!authUser) {
    return <AuthScreen onAuthed={setAuthUser} />;
  }

  return (
    <main
      className={`mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col bg-[radial-gradient(circle_at_top_left,#f3e8ff_0,#fff_34%,#fff_100%)] px-5 pb-8 pt-5 text-[#20172f] shadow-2xl shadow-purple-950/10 sm:my-6 sm:min-h-[880px] sm:rounded-[2rem] ${showAlbumFab ? "pb-28" : ""}`}
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-purple-500">
            AI outfit rating
          </p>
          <h1 className="mt-1 text-4xl font-black tracking-tight text-[#27123d]">
            FitCheck
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="fit-soft-float flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-500 text-lg font-black text-white shadow-lg shadow-purple-400/30"
          aria-label="Open profile"
        >
          {authUser.avatarUrl ? (
            <img src={authUser.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden>{authUser.username.slice(0, 2).toUpperCase()}</span>
          )}
        </button>
      </header>
      <p className="mt-4 max-w-[20rem] text-[15px] leading-6 text-[#6f5d82]">
        Take the fit pic, let the AI judge the details, then keep the looks that
        deserve a spot in the album.
      </p>

      <div
        className="mt-7 grid grid-cols-2 border-b border-purple-100"
        role="tablist"
        aria-label="FitCheck sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "save"}
          onClick={() => setTab("save")}
          className={`relative px-4 py-3 text-sm font-bold transition ${
            tab === "save"
              ? "text-purple-700 after:absolute after:inset-x-4 after:bottom-[-1px] after:h-0.5 after:bg-gradient-to-r after:from-purple-600 after:to-fuchsia-500"
              : "text-[#8c7a9c] hover:text-purple-700"
          }`}
        >
          Check fit
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "album"}
          onClick={() => setTab("album")}
          className={`relative px-4 py-3 text-sm font-bold transition ${
            tab === "album"
              ? "text-purple-700 after:absolute after:inset-x-4 after:bottom-[-1px] after:h-0.5 after:bg-gradient-to-r after:from-purple-600 after:to-fuchsia-500"
              : "text-[#8c7a9c] hover:text-purple-700"
          }`}
        >
          Album
        </button>
      </div>

      {tab === "save" && (
        <form
          onSubmit={handleUpload}
          className="mt-8 flex flex-1 flex-col"
        >
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*,.heic,.heif"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={handleCameraFileSelected}
          />

          <section className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br from-purple-700 via-fuchsia-600 to-[#ff7ac8] p-[1px] shadow-2xl shadow-purple-300/35">
            <div className="relative min-h-[420px] overflow-hidden rounded-[27px] bg-white">
              <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(250,245,255,0.52)),radial-gradient(circle_at_20%_16%,rgba(216,180,254,0.75),transparent_32%),radial-gradient(circle_at_82%_0%,rgba(244,114,182,0.5),transparent_28%)]" />
              <div className="relative flex min-h-[420px] flex-col justify-between p-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-purple-600">
                    Camera first
                  </p>
                  <h2 className="mt-3 max-w-[14rem] text-4xl font-black leading-[0.96] tracking-tight text-[#261238]">
                    Show the fit. Get the verdict.
                  </h2>
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={openCameraPicker}
                    className="w-full rounded-2xl bg-[#251236] px-5 py-4 text-base font-black text-white shadow-xl shadow-purple-950/20 transition active:scale-[0.98]"
                  >
                    Take photo
                  </button>
                </div>
              </div>
            </div>
          </section>

          {selectedFile && !cameraRevealOpen && (
            <p className="mt-5 text-xs font-medium text-[#7d6a8f]">
              Selected:{" "}
              <span className="font-bold text-[#2b173f]">
                {selectedFile.name || "Photo"}
              </span>
              {selectedFile.type ? ` (${selectedFile.type})` : ""}
            </p>
          )}

          {previewUrl && !cameraRevealOpen && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-purple-500">
                Preview
              </p>
              <img
                src={previewUrl}
                alt="Preview of selected outfit"
                className="max-h-[430px] w-full rounded-[1.35rem] border border-purple-100 object-cover shadow-lg shadow-purple-100"
              />
            </div>
          )}

          {errorMessage && (
            <p className="mt-4 text-sm font-semibold text-red-600">
              {errorMessage}
            </p>
          )}

          {saveSuccess && (
            <p className="mt-4 text-sm font-semibold text-emerald-700">
              Saved. Open the{" "}
              <button
                type="button"
                className="font-black underline decoration-purple-300 underline-offset-4"
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
            className="mt-6 rounded-2xl bg-gradient-to-r from-purple-700 to-fuchsia-500 px-5 py-4 text-sm font-black text-white shadow-lg shadow-purple-300/40 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isUploading ? "Uploading..." : "Save rated photo"}
          </button>
        </form>
      )}

      {tab === "album" && (
        <section
          className="mt-8"
          role="tabpanel"
          aria-label="Album"
        >
          {albumDeleteMode && (
            <p className="mb-4 border-l-2 border-amber-400 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">
              Tap photos to select them, then use Delete in the corner to remove
              them forever.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black tracking-tight text-[#27123d]">
              Your album
            </h2>
            <button
              type="button"
              onClick={() => void loadAlbum()}
              disabled={albumLoading}
              className="rounded-xl border border-purple-200 bg-white/70 px-3 py-2 text-xs font-black text-purple-800 shadow-sm transition hover:bg-white disabled:opacity-50"
            >
              {albumLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {albumError && (
            <p className="mt-4 text-sm font-semibold text-red-600">
              {albumError}
            </p>
          )}

          {!albumLoading && !albumError && photos.length === 0 && (
            <p className="mt-4 text-sm leading-6 text-[#7d6a8f]">
              No photos yet. Use the Check fit tab to add your first fit.
            </p>
          )}

          {albumLoading && photos.length === 0 && !albumError && (
            <p className="mt-4 text-sm text-[#7d6a8f]">
              Loading album…
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            {photos.map((photo) => {
              const selected = selectedForDelete.includes(photo.pathname);
              return (
                <button
                  key={photo.pathname}
                  type="button"
                  onClick={() => handleAlbumThumbClick(photo)}
                  className={`group relative aspect-[3/4] w-full overflow-hidden rounded-[1.25rem] border bg-purple-50 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-700 ${
                    selected
                      ? "border-red-500 ring-2 ring-red-500/80 ring-offset-2 ring-offset-white"
                      : "border-purple-100"
                  }`}
                >
                  <img
                    src={photo.url}
                    alt=""
                    className="h-full w-full object-cover transition group-hover:opacity-95"
                  />
                  {albumDeleteMode && selected && (
                    <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white shadow">
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
        <div className="fixed bottom-5 right-[max(1.25rem,calc((100vw-430px)/2+1.25rem))] z-40 flex flex-col items-end gap-2">
          {albumDeleteMode ? (
            <>
              <button
                type="button"
                onClick={exitAlbumDeleteMode}
                disabled={isDeleting}
                className="rounded-2xl border border-purple-200 bg-white px-4 py-2.5 text-sm font-black text-purple-900 shadow-lg shadow-purple-200/50 transition hover:bg-purple-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteSelected()}
                disabled={deleteSelectedCount === 0 || isDeleting}
                className="rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-black text-white shadow-lg transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
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
              className="rounded-2xl bg-[#251236] px-4 py-3 text-sm font-black text-white shadow-xl shadow-purple-300/50 transition active:scale-[0.98]"
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
          className="fixed inset-0 z-[70] flex flex-col bg-[#160b22] text-white"
          role="dialog"
          aria-modal="true"
          aria-label="Photo captured"
        >
          {cameraRevealPhase === "flash" && (
            <>
              <div
                className="pointer-events-none absolute inset-0 z-20 bg-white fit-flash-screen"
                aria-hidden
              />
              <div
                className="fit-shutter-pop pointer-events-none absolute left-1/2 top-1/2 z-30 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/90 shadow-[0_0_70px_rgba(255,255,255,0.9)]"
                aria-hidden
              />
            </>
          )}

          <button
            type="button"
            onClick={closeCameraRevealKeepFile}
            className="absolute right-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-2xl font-light text-white backdrop-blur transition hover:bg-white/20"
            aria-label="Close"
          >
            ×
          </button>

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_8%,rgba(168,85,247,0.45),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(236,72,153,0.32),transparent_28%),linear-gradient(180deg,#160b22_0%,#27113d_52%,#0f0718_100%)]" />

          <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-[430px] flex-1 flex-col items-center overflow-y-auto px-5 pb-10 pt-16">
            {cameraRevealPhase === "analyzing" && (
              <div className="flex min-h-[70dvh] w-full flex-col items-center justify-center gap-6 py-12">
                <div className="relative w-full max-w-[260px] overflow-hidden rounded-[1.75rem] border border-white/15 shadow-2xl shadow-purple-950/50">
                  <img
                    src={previewUrl}
                    alt=""
                    className="aspect-[3/4] w-full object-cover opacity-70"
                  />
                  <div className="fit-sweep-line absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-transparent via-white/45 to-transparent" />
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black tracking-tight">
                    Scanning the fit...
                  </p>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-purple-100/70">
                    Checking colors, layers, shoes, and the little choices that
                    make or break the look.
                  </p>
                </div>
              </div>
            )}

            {cameraRevealPhase === "content" && fitAnalysisError && (
              <div className="flex w-full max-w-sm flex-col items-center text-center">
                <p className="text-2xl font-black text-white">Scan hit a snag</p>
                <p className="mt-2 text-sm leading-6 text-red-200/90">
                  {fitAnalysisError}
                </p>
                <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={retryAnalysis}
                    className="flex-1 rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#251236] transition hover:bg-purple-50"
                  >
                    Retry scan
                  </button>
                  <button
                    type="button"
                    onClick={closeCameraRevealKeepFile}
                    className="flex-1 rounded-2xl border border-white/20 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
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
                    <div className="mb-5 w-full border-l-2 border-amber-300 bg-amber-300/10 px-4 py-3 text-center text-xs leading-relaxed text-amber-50">
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
                  <p className="fit-fade-up text-center text-3xl font-black leading-tight tracking-tight text-white">
                    {fitAnalysis.noClothingMessage ??
                      "The outfit dimension does not exist in this timeline."}
                  </p>
                  <p className="fit-fade-up fit-fade-up-delay-1 mt-3 text-center text-xs font-bold uppercase tracking-[0.2em] text-purple-200/70">
                    Official scorecard
                    {fitAnalysis.demoMode ? " · simulated" : ""}
                  </p>

                  <div className="fit-score-card fit-scale-in relative mt-8 w-full overflow-hidden rounded-[1.4rem] bg-white px-4 py-5 text-center text-[#27123d] shadow-2xl shadow-purple-950/30">
                    <p className="text-[10px] font-black uppercase tracking-wider text-purple-500">
                      Overall
                    </p>
                    <p className="mt-1 font-mono text-5xl font-black tabular-nums">
                      0
                      <span className="text-xl font-normal text-purple-300">
                        /{fitAnalysis.overallMax}
                      </span>
                    </p>
                  </div>

                  <div className="fit-fade-up fit-fade-up-delay-2 mt-4 max-h-48 w-full space-y-2 overflow-y-auto border-t border-white/10 pt-4">
                    {fitAnalysis.ruleScores.map((row) => (
                      <div
                        key={row.ruleId}
                        className="flex items-center justify-between gap-2 text-xs text-purple-100/70"
                      >
                        <span className="truncate text-left text-white/80">
                          {ruleLabel(row.ruleId)}
                        </span>
                        <span className="shrink-0 font-mono tabular-nums text-purple-200/70">
                          0/{row.maxScore}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="fit-fade-up fit-fade-up-delay-3 mt-4 text-center text-xs leading-relaxed text-purple-100/60">
                    Nothing wearable was detected, so this one will not be saved
                    to your album.
                  </p>

                  <div className="fit-scale-in mt-8 w-full max-w-sm">
                    <div className="overflow-hidden rounded-[1.4rem] border border-white/10 shadow-2xl shadow-black/50 ring-1 ring-white/10">
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
                      className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#251236] transition hover:bg-purple-50"
                    >
                      Try again
                    </button>
                    <button
                      type="button"
                      onClick={retakeCamera}
                      className="w-full rounded-2xl border border-white/20 bg-transparent px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
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
                    <div className="mb-5 w-full border-l-2 border-amber-300 bg-amber-300/10 px-4 py-3 text-center text-xs leading-relaxed text-amber-50">
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
                  <p className="fit-fade-up max-w-md text-center text-3xl font-black leading-tight tracking-tight text-white">
                    {fitAnalysis.overallComment}
                  </p>
                  <p className="fit-fade-up fit-fade-up-delay-1 mt-3 text-center text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-200">
                    {fitAnalysis.demoMode
                      ? "Demo scan · simulated scores"
                      : "AI fit check · rule-based score"}
                  </p>

                  {fitAnalysis.detectedItems.length > 0 && (
                    <div className="fit-fade-up fit-fade-up-delay-2 mt-6 flex w-full flex-wrap justify-center gap-2">
                      {fitAnalysis.detectedItems.map((d, i) => (
                        <span
                          key={`${d.label}-${i}`}
                          className="rounded-xl border border-white/10 bg-white/10 px-3 py-1 text-xs text-purple-50 backdrop-blur"
                        >
                          <span className="font-medium text-white">{d.label}</span>
                          <span className="text-purple-200/60"> · </span>
                          {d.colorDescription}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="fit-score-card fit-scale-in relative mt-8 w-full overflow-hidden rounded-[1.4rem] bg-white px-4 py-5 text-center text-[#27123d] shadow-2xl shadow-purple-950/30">
                    <p className="text-[10px] font-black uppercase tracking-wider text-purple-500">
                      Overall
                    </p>
                    <p className="mt-1 font-mono text-6xl font-black tabular-nums">
                      {fitAnalysis.overallScore}
                      <span className="text-xl font-normal text-purple-300">
                        /{fitAnalysis.overallMax}
                      </span>
                    </p>
                  </div>

                  <div className="fit-fade-up fit-fade-up-delay-2 mt-5 max-h-52 w-full space-y-3 overflow-y-auto border-t border-white/10 pt-4">
                    {fitAnalysis.ruleScores.map((row) => (
                      <div
                        key={row.ruleId}
                        className="border-b border-white/5 pb-3 last:border-0 last:pb-0"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-bold text-white/90">
                            {ruleLabel(row.ruleId)}
                          </span>
                          <span className="shrink-0 font-mono text-xs tabular-nums text-purple-200/80">
                            {row.score}/{row.maxScore}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-purple-100/60">
                          {row.shortFeedback}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="fit-scale-in mt-8 w-full max-w-sm">
                    <div className={`relative overflow-hidden rounded-[1.4rem] border border-white/10 shadow-2xl shadow-black/50 ring-1 ring-white/10 ${isUploading ? "fit-uploading-photo" : ""}`}>
                      <img
                        src={previewUrl}
                        alt="Your outfit"
                        className="aspect-[3/4] w-full object-cover"
                      />
                      {isUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-purple-950/45 backdrop-blur-[2px]">
                          <div className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-purple-800 shadow-xl">
                            Uploading fit...
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="fit-fade-up fit-fade-up-delay-4 mt-10 flex w-full max-w-sm flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => void uploadSelectedFile()}
                      className="flex-1 rounded-2xl bg-white px-5 py-4 text-sm font-black text-[#251236] shadow-xl shadow-purple-950/20 transition hover:bg-purple-50 disabled:opacity-50"
                    >
                      {isUploading ? "Using photo..." : "Use photo"}
                    </button>
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={retakeCamera}
                      className="flex-1 rounded-2xl border border-white/20 bg-transparent px-5 py-4 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
                    >
                      Retake
                    </button>
                  </div>
                </div>
              )}
          </div>
        </div>
      )}

      {profileOpen && (
        <ProfileModal
          user={authUser}
          onClose={() => setProfileOpen(false)}
          onUserChange={setAuthUser}
          onLogout={() => void logout()}
        />
      )}
    </main>
  );
}
