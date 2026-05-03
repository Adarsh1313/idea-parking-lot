import type { IdeaParkingLotExport } from "../types";
import { parseImportPayload } from "../utils/ideaValidation";

const OWNER = "Adarsh1313";
const REPO = "idea-parking-lot";
const BRANCH = "main";
const DATA_PATH = "data/ideas.json";
const TOKEN_KEY = "idea-parking-lot.github-token";

type GitHubContentResponse = {
  content: string;
  sha: string;
};

export function getStoredGitHubToken() {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function storeGitHubToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token.trim());
}

export function clearStoredGitHubToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function hasGitHubSyncToken() {
  return Boolean(getStoredGitHubToken());
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
  const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${getStoredGitHubToken()}`,
      "X-GitHub-Api-Version": "2022-11-28",
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
