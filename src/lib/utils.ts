import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Rough token estimate (~4 chars/token) — for UI display only. */
export function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
