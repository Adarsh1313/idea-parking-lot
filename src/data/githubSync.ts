import type { IdeaParkingLotExport } from "../types";
import { parseImportPayload } from "../utils/ideaValidation";

const OWNER = "Adarsh1313";
const REPO = "idea-parking-lot";
const BRANCH = "main";
const DATA_PATH = "data/ideas.json";
const TOKEN_KEY = "idea-parking-lot.github-token";
const OWNER_EMAIL_KEY = "idea-parking-lot.owner-email";
const OWNER_SESSION_KEY = "idea-parking-lot.owner-session";
const OWNER_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const OWNER_LOGIN_EMAIL = "adarshbharathwaj13@gmail.com";
const OWNER_PASSWORD_HASH = "e835b9b502acc0b340b4a22d7579dee761faffacea127da274e03362b0f265bc";

type GitHubContentResponse = {
  content: string;
  sha: string;
};

type OwnerSessionRecord = {
  expiresAt: number;
};

export function getStoredGitHubToken() {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function storeGitHubToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token.trim());
}

export function getStoredOwnerEmail() {
  return localStorage.getItem(OWNER_EMAIL_KEY) ?? "";
}

export function storeOwnerEmail(email: string) {
  localStorage.setItem(OWNER_EMAIL_KEY, email.trim());
}

export function clearStoredGitHubToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function hasGitHubSyncToken() {
  return Boolean(getStoredGitHubToken());
}

export function clearStoredOwnerEmail() {
  localStorage.removeItem(OWNER_EMAIL_KEY);
}

export function storeOwnerSession() {
  const session: OwnerSessionRecord = {
    expiresAt: Date.now() + OWNER_SESSION_DURATION_MS
  };

  localStorage.setItem(OWNER_SESSION_KEY, JSON.stringify(session));
}

export function clearOwnerSession() {
  localStorage.removeItem(OWNER_SESSION_KEY);
}

export function hasOwnerSession() {
  const rawSession = localStorage.getItem(OWNER_SESSION_KEY);

  if (!rawSession) {
    return false;
  }

  try {
    const parsedSession = JSON.parse(rawSession) as OwnerSessionRecord;

    if (typeof parsedSession.expiresAt !== "number" || parsedSession.expiresAt <= Date.now()) {
      localStorage.removeItem(OWNER_SESSION_KEY);
      return false;
    }

    return true;
  } catch {
    localStorage.removeItem(OWNER_SESSION_KEY);
    return false;
  }
}

async function sha256Hex(value: string) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const bytes = Array.from(new Uint8Array(hashBuffer));

  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyOwnerCredentials(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPasswordHash = await sha256Hex(password);

  return normalizedEmail === OWNER_LOGIN_EMAIL && normalizedPasswordHash === OWNER_PASSWORD_HASH;
}

function encodeUtf8Base64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function decodeUtf8Base64(value: string) {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

async function requestGitHub<T>(path: string, init: RequestInit = {}) {
  const token = getStoredGitHubToken();
  const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers
    }
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`GitHub sync failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export async function pullIdeasFromGitHub() {
  const rawUrl = new URL(`https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${DATA_PATH}`);
  rawUrl.searchParams.set("t", String(Date.now()));
  const rawResponse = await fetch(rawUrl.toString(), {
    cache: "reload",
    headers: {
      "Cache-Control": "no-cache"
    }
  });

  if (rawResponse.ok) {
    return parseImportPayload(await rawResponse.text());
  }

  if (rawResponse.status !== 404) {
    throw new Error(`Could not load public ideas: ${rawResponse.status} ${rawResponse.statusText}`);
  }

  const remoteFile = await requestGitHub<GitHubContentResponse>(`contents/${DATA_PATH}?ref=${BRANCH}`);

  if (!remoteFile) {
    return null;
  }

  return parseImportPayload(decodeUtf8Base64(remoteFile.content));
}

export async function pushIdeasToGitHub(payload: IdeaParkingLotExport) {
  const remoteFile = await requestGitHub<GitHubContentResponse>(`contents/${DATA_PATH}?ref=${BRANCH}`);
  const body: Record<string, unknown> = {
    branch: BRANCH,
    message: "Sync ideas database",
    content: encodeUtf8Base64(`${JSON.stringify(payload, null, 2)}\n`)
  };

  if (remoteFile?.sha) {
    body.sha = remoteFile.sha;
  }

  await requestGitHub(`contents/${DATA_PATH}`, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}
