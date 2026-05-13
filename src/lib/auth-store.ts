import { del, list, put } from "@vercel/blob";
import { cookies } from "next/headers";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);

const DATA_PATH = path.join(process.cwd(), ".fitcheck-data", "auth.json");
const BLOB_AUTH_PATH = "fitcheck-auth/auth.json";
const SESSION_COOKIE = "fitcheck_session";
const CODE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const UPDATE_COOLDOWN_MS = 60 * 24 * 60 * 60 * 1000;

export type PublicUser = {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  usernameUpdatedAt?: string;
  passwordUpdatedAt?: string;
};

export type UserRecord = PublicUser & {
  passwordHash: string;
  createdAt: string;
  pendingEmail?: {
    email: string;
    codeHash: string;
    expiresAt: string;
  };
};

type PendingRegistration = {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  codeHash: string;
  expiresAt: string;
  createdAt: string;
};

type PasswordReset = {
  email: string;
  codeHash: string;
  expiresAt: string;
};

type SessionRecord = {
  userId: string;
  expiresAt: string;
};

type AuthData = {
  users: UserRecord[];
  pendingRegistrations: PendingRegistration[];
  passwordResets: PasswordReset[];
  sessions: Record<string, SessionRecord>;
};

export const authConfig = {
  updateCooldownMs: UPDATE_COOLDOWN_MS,
  updateCooldownDays: 60,
};

function emptyData(): AuthData {
  return {
    users: [],
    pendingRegistrations: [],
    passwordResets: [],
    sessions: {},
  };
}

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

async function readAuthData(): Promise<AuthData> {
  if (hasBlobToken()) {
    try {
      const result = await list({ prefix: BLOB_AUTH_PATH, limit: 1 });
      const blob = result.blobs.find((item) => item.pathname === BLOB_AUTH_PATH);
      if (!blob) return emptyData();
      const response = await fetch(blob.url, { cache: "no-store" });
      if (!response.ok) return emptyData();
      return { ...emptyData(), ...((await response.json()) as Partial<AuthData>) };
    } catch (error) {
      console.error("Auth blob read error:", error);
      return emptyData();
    }
  }

  try {
    return { ...emptyData(), ...(JSON.parse(await readFile(DATA_PATH, "utf8")) as Partial<AuthData>) };
  } catch {
    return emptyData();
  }
}

async function writeAuthData(data: AuthData) {
  if (hasBlobToken()) {
    await put(BLOB_AUTH_PATH, JSON.stringify(data), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
    });
    return;
  }

  await mkdir(path.dirname(DATA_PATH), { recursive: true });
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2));
}

export async function updateAuthData<T>(fn: (data: AuthData) => T | Promise<T>) {
  const data = pruneExpired(await readAuthData());
  const result = await fn(data);
  await writeAuthData(data);
  return result;
}

function pruneExpired(data: AuthData): AuthData {
  const now = Date.now();
  data.pendingRegistrations = data.pendingRegistrations.filter(
    (item) => new Date(item.expiresAt).getTime() > now,
  );
  data.passwordResets = data.passwordResets.filter(
    (item) => new Date(item.expiresAt).getTime() > now,
  );
  for (const [token, session] of Object.entries(data.sessions)) {
    if (new Date(session.expiresAt).getTime() <= now) {
      delete data.sessions[token];
    }
  }
  return data;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function publicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    usernameUpdatedAt: user.usernameUpdatedAt,
    passwordUpdatedAt: user.passwordUpdatedAt,
  };
}

export function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function hashSecret(secret: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(secret, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifySecret(secret: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = (await scrypt(secret, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function newId(prefix: string) {
  return `${prefix}_${randomBytes(16).toString("hex")}`;
}

export async function sendVerificationEmail(params: {
  to: string;
  code: string;
  subject: string;
}) {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.AUTH_EMAIL_FROM?.trim() || "FitCheck <onboarding@resend.dev>";

  if (!resendKey) {
    console.info(`[FitCheck verification] ${params.to}: ${params.code}`);
    return { delivered: false, devCode: params.code };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: params.to,
      subject: params.subject,
      text: `Your FitCheck verification code is ${params.code}. It expires in 10 minutes.`,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Could not send verification email. ${text}`);
  }

  return { delivered: true };
}

export function codeExpiry() {
  return new Date(Date.now() + CODE_TTL_MS).toISOString();
}

export function assertCooldown(lastUpdated?: string) {
  if (!lastUpdated) return;
  const elapsed = Date.now() - new Date(lastUpdated).getTime();
  if (elapsed < UPDATE_COOLDOWN_MS) {
    const days = Math.ceil((UPDATE_COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000));
    throw new Error(`You can update this again in ${days} day${days === 1 ? "" : "s"}.`);
  }
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  await updateAuthData((data) => {
    data.sessions[token] = {
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    };
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await updateAuthData((data) => {
      delete data.sessions[token];
    });
  }
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const data = pruneExpired(await readAuthData());
  const session = data.sessions[token];
  if (!session) return null;
  return data.users.find((user) => user.id === session.userId) ?? null;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("AUTH_REQUIRED");
  return user;
}

export async function saveAvatarFile(userId: string, raw: Blob) {
  const contentType = raw.type.startsWith("image/") ? raw.type : "image/jpeg";
  if (hasBlobToken()) {
    const blob = await put(`fitcheck-avatars/${userId}-${Date.now()}.jpg`, raw, {
      access: "public",
      addRandomSuffix: true,
      contentType,
    });
    return blob.url;
  }

  const buffer = Buffer.from(await raw.arrayBuffer());
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

export async function deleteUserBlobPath(pathname: string) {
  if (hasBlobToken()) {
    await del(pathname);
  }
}
