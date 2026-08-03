/**
 * TicTacToe — a tiny time-killer for the analyze wait. The opponent takes a win
 * or blocks yours, but otherwise plays at random (no fork-setting) — deliberately
 * *beatable* so the user can actually win and get a small smile.
 */
import { useState } from "react";
import { cn } from "../lib/utils";

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function winnerOf(b) {
  for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  return null;
}

// Index that completes a line for `player`, or -1.
function completing(b, player) {
  for (const [a, c, d] of LINES) {
    const cells = [a, c, d];
    const marks = cells.filter((i) => b[i] === player).length;
    const empties = cells.filter((i) => !b[i]);
    if (marks === 2 && empties.length === 1) return empties[0];
  }
  return -1;
}

function aiMove(b) {
  const take = completing(b, "O"); if (take >= 0) return take; // win if we can
  const block = completing(b, "X"); if (block >= 0) return block; // else block the player
  const empties = b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  return empties.length ? empties[Math.floor(Math.random() * empties.length)] : -1; // else random → beatable
}

export default function TicTacToe() {
  const [board, setBoard] = useState(() => Array(9).fill(""));
  const w = winnerOf(board);
  const full = board.every(Boolean);
  const over = !!w || full;

  function play(i) {
    if (board[i] || over) return;
    const b = board.slice();
    b[i] = "X";
    if (!winnerOf(b) && !b.every(Boolean)) {
      const m = aiMove(b);
      if (m >= 0) b[m] = "O";
    }
    setBoard(b);
  }

  const status = w === "X" ? "You win! 🎉" : w === "O" ? "I got this one 🤖" : full ? "Draw 🤝" : "Your move — you're X";

  return (
    <div className="space-y-2">
      <div className="grid w-max grid-cols-3 gap-1">
        {board.map((v, i) => (
          <button
            key={i}
            type="button"
            onClick={() => play(i)}
            disabled={!!v || over}
            aria-label={`Square ${i + 1}${v ? `, ${v}` : ", empty"}`}
            className={cn(
              "h-10 w-10 rounded-md border border-surface-border text-lg font-bold transition-colors",
              v ? "bg-surface-subtle" : "bg-surface hover:border-brand",
              v === "X" ? "text-brand" : v === "O" ? "text-muted-dark" : "",
            )}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted">{status}</span>
        {over && (
          <button type="button" onClick={() => setBoard(Array(9).fill(""))} className="text-xs font-medium text-brand hover:underline">
            Play again
          </button>
        )}
      </div>
    </div>
  );
}
