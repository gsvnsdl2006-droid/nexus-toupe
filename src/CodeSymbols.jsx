import React from "react";
import { SEMAPHORE_ARMS } from "./codes.mjs";
const vectors = [
  [0, 1],
  [-0.707, 0.707],
  [-1, 0],
  [-0.707, -0.707],
  [0, -1],
  [0.707, -0.707],
  [1, 0],
  [0.707, 0.707],
];
export function SemaphoreSymbol({ letter }) {
  const arms = letter === " " ? [0, 0] : SEMAPHORE_ARMS[letter];
  if (!arms) return null;
  return (
    <svg
      className="semaphore-symbol"
      viewBox="0 0 100 100"
      role="img"
      aria-label={letter === " " ? "Sémaphore espace" : `Sémaphore ${letter}`}
    >
      <rect width="100" height="100" rx="8" fill="#faf8ef" />
      <circle cx="50" cy="32" r="6" fill="#12291c" />
      <rect x="44" y="40" width="12" height="35" rx="5" fill="#12291c" />
      {arms.map((direction, i) => {
        const startX = i ? 58 : 42,
          startY = 44;
        const [dx, dy] = vectors[direction],
          x = startX + dx * 32,
          y = startY + dy * 32;
        return (
          <g key={i}>
            <path
              d={`M${startX} ${startY} L${x} ${y}`}
              stroke="#12291c"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <g
              transform={`translate(${x},${y}) rotate(${direction % 2 ? 45 : 0})`}
            >
              <rect
                x="-12"
                y="-1"
                width="14"
                height="14"
                fill="#ffe52e"
                stroke="#12291c"
                strokeWidth="0.6"
              />
              <path d="M-12 -1 H2 V13 Z" fill="#e83436" />
            </g>
          </g>
        );
      })}
    </svg>
  );
}
export function VowelSymbol({ token }) {
  return (
    <span className="vowel-symbol" aria-label={token}>
      {[...token].map((hat, i) => (
        <span
          key={i}
          className={hat === "^" ? "hat-big" : "hat-small"}
          aria-hidden="true"
        >
          ⌃
        </span>
      ))}
    </span>
  );
}
