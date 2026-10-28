import { patrols } from "./model.js";
export const returnContextKey = "nexus-auth-return";
export function readLoginReturn() {
  const url = new URL(window.location.href);
  if (
    !url.searchParams.has("code") &&
    !url.searchParams.has("error") &&
    !url.hash.includes("access_token")
  )
    return {};
  try {
    const saved = JSON.parse(sessionStorage.getItem(returnContextKey) || "{}");
    sessionStorage.removeItem(returnContextKey);
    return {
      patrol: patrols.includes(saved.patrol) ? saved.patrol : null,
      section: [
        "overview",
        "treasury",
        "secretary",
        "progress",
        "codes",
      ].includes(saved.section)
        ? saved.section
        : "overview",
    };
  } catch {
    return {};
  }
}

const callbackQuery = new URLSearchParams(window.location.search);
const callbackHash = new URLSearchParams(window.location.hash.slice(1));
export const loginReturnError = (
  callbackQuery.get("error_description") ||
  callbackHash.get("error_description") ||
  callbackQuery.get("error") ||
  callbackHash.get("error") ||
  ""
).slice(0, 500);
