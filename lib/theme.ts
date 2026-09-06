"use client";

export type AppTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "assetpilot-theme";

export function getStoredTheme(): AppTheme {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
}

export function applyTheme(theme: AppTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage may be unavailable (private mode) — still apply the live theme.
  }
}

export function initTheme(): void {
  if (typeof document === "undefined") return;
  if (document.documentElement.dataset.theme) return;
  document.documentElement.dataset.theme = getStoredTheme();
}