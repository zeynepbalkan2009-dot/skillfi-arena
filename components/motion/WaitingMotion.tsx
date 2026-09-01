"use client";

import { useEffect, useState } from "react";

const scenes = [
  {
    name: "Arena in motion",
    hint: "Scanning the arena for an available pilot player.",
  },
  {
    name: "Focus, then catch",
    hint: "Keeping the session warm while matchmaking runs.",
  },
  {
    name: "Reading the angle",
    hint: "Checking compatible game and region settings.",
  },
  { name: "Keeping the rhythm", hint: "Preparing a fair, synchronized start." },
] as const;

function ArenaSpinner() {
  return (
    <svg viewBox="0 0 180 120" aria-hidden="true">
      <ellipse className="wm-ring" cx="90" cy="91" rx="67" ry="14" />
      <g className="wm-spin">
        <path d="M53 27 77 48 66 79 42 56Z" />
        <path d="m127 27-24 21 11 31 24-23Z" />
      </g>
      <circle className="wm-dot" cx="90" cy="57" r="7" />
    </svg>
  );
}

function FiveStones() {
  return (
    <svg viewBox="0 0 180 120" aria-hidden="true">
      <path
        className="wm-hand"
        d="M53 91c15-20 25-31 35-31 8 0 10 7 16 7 8 0 14-8 22-4 9 5 6 20-4 29Z"
      />
      <g className="wm-stones">
        <circle cx="56" cy="47" r="7" />
        <circle cx="76" cy="31" r="6" />
        <circle cx="96" cy="43" r="7" />
        <circle cx="119" cy="30" r="6" />
        <circle cx="137" cy="49" r="7" />
      </g>
    </svg>
  );
}

function MarbleKnock() {
  return (
    <svg viewBox="0 0 180 120" aria-hidden="true">
      <path className="wm-track" d="M27 78c30-27 97-27 126 0" />
      <circle className="wm-marble-a" cx="48" cy="66" r="13" />
      <circle className="wm-marble-b" cx="128" cy="66" r="13" />
      <circle className="wm-spark" cx="89" cy="60" r="5" />
    </svg>
  );
}

function YoyoPulse() {
  return (
    <svg viewBox="0 0 180 120" aria-hidden="true">
      <path className="wm-string" d="M90 12v42" />
      <g className="wm-yoyo">
        <circle cx="90" cy="72" r="27" />
        <circle cx="90" cy="72" r="16" />
        <circle cx="90" cy="72" r="5" />
      </g>
      <circle className="wm-pulse" cx="90" cy="72" r="34" />
    </svg>
  );
}

const art = [ArenaSpinner, FiveStones, MarbleKnock, YoyoPulse] as const;

export function WaitingMotion({
  label = "Finding another active pilot player",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(
      () => setIndex((value) => (value + 1) % scenes.length),
      6000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const Scene = art[index];
  return (
    <div
      className={`waiting-motion ${compact ? "waiting-motion--compact" : ""}`}
      role="status"
      aria-label={label}
    >
      <div className="waiting-motion__art">
        <Scene />
      </div>
      <div>
        <p className="waiting-motion__eyebrow">{label}</p>
        <p className="waiting-motion__title">{scenes[index].name}</p>
        {!compact && (
          <p className="waiting-motion__hint">{scenes[index].hint}</p>
        )}
      </div>
      <div className="waiting-motion__steps" aria-hidden="true">
        {scenes.map((scene, step) => (
          <span
            key={scene.name}
            className={step === index ? "is-active" : ""}
          />
        ))}
      </div>
      <style jsx>{`
        .waiting-motion {
          display: grid;
          justify-items: center;
          gap: 0.65rem;
          text-align: center;
          color: #fff;
        }
        .waiting-motion__art {
          width: min(260px, 72vw);
          padding: 0.4rem;
          border-radius: 1.5rem;
          background: radial-gradient(
            circle at 50% 55%,
            rgba(34, 211, 238, 0.13),
            transparent 65%
          );
        }
        .waiting-motion__art :global(svg) {
          display: block;
          width: 100%;
          height: auto;
          overflow: visible;
        }
        .waiting-motion__art :global(path),
        .waiting-motion__art :global(circle) {
          fill: none;
          stroke: #22d3ee;
          stroke-width: 3;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .waiting-motion__art :global(.wm-ring),
        .waiting-motion__art :global(.wm-track) {
          stroke: #64748b;
          opacity: 0.45;
        }
        .waiting-motion__art :global(.wm-spin) {
          transform-origin: 90px 57px;
          animation: wm-spin 2.8s linear infinite;
        }
        .waiting-motion__art :global(.wm-dot),
        .waiting-motion__art :global(.wm-stones circle),
        .waiting-motion__art :global(.wm-spark) {
          fill: #a78bfa;
          stroke: none;
        }
        .waiting-motion__art :global(.wm-stones circle) {
          animation: wm-toss 1.8s ease-in-out infinite;
        }
        .waiting-motion__art :global(.wm-stones circle:nth-child(even)) {
          animation-delay: -0.45s;
        }
        .waiting-motion__art :global(.wm-hand) {
          stroke: #94a3b8;
        }
        .waiting-motion__art :global(.wm-marble-a) {
          animation: wm-left 1.8s ease-in-out infinite;
        }
        .waiting-motion__art :global(.wm-marble-b) {
          animation: wm-right 1.8s ease-in-out infinite;
        }
        .waiting-motion__art :global(.wm-spark) {
          animation: wm-flash 1.8s ease-in-out infinite;
        }
        .waiting-motion__art :global(.wm-string) {
          stroke: #94a3b8;
        }
        .waiting-motion__art :global(.wm-yoyo) {
          transform-origin: 90px 12px;
          animation: wm-yoyo 2s ease-in-out infinite;
        }
        .waiting-motion__art :global(.wm-yoyo circle) {
          fill: rgba(34, 211, 238, 0.08);
        }
        .waiting-motion__art :global(.wm-pulse) {
          stroke: #a78bfa;
          animation: wm-pulse 2s ease-out infinite;
        }
        .waiting-motion__eyebrow {
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #22d3ee;
        }
        .waiting-motion__title {
          margin-top: 0.25rem;
          font: 700 1.25rem/1.2 var(--font-display, ui-sans-serif);
        }
        .waiting-motion__hint {
          margin: 0.35rem auto 0;
          max-width: 28rem;
          font-size: 0.82rem;
          line-height: 1.5;
          color: #94a3b8;
        }
        .waiting-motion__steps {
          display: flex;
          gap: 0.35rem;
        }
        .waiting-motion__steps span {
          width: 1.1rem;
          height: 3px;
          border-radius: 9px;
          background: #334155;
          transition: 0.3s;
        }
        .waiting-motion__steps .is-active {
          width: 2rem;
          background: #22d3ee;
        }
        .waiting-motion--compact {
          gap: 0.35rem;
        }
        .waiting-motion--compact .waiting-motion__art {
          width: 155px;
        }
        .waiting-motion--compact .waiting-motion__title {
          font-size: 1rem;
        }
        @keyframes wm-spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes wm-toss {
          0%,
          100% {
            transform: translateY(6px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        @keyframes wm-left {
          0%,
          100% {
            transform: translateX(-8px);
          }
          50% {
            transform: translateX(27px);
          }
        }
        @keyframes wm-right {
          0%,
          100% {
            transform: translateX(8px);
          }
          50% {
            transform: translateX(-27px);
          }
        }
        @keyframes wm-flash {
          0%,
          40%,
          65%,
          100% {
            opacity: 0;
            transform: scale(0.5);
          }
          50% {
            opacity: 1;
            transform: scale(1.8);
          }
        }
        @keyframes wm-yoyo {
          0%,
          100% {
            transform: translateY(-5px);
          }
          50% {
            transform: translateY(13px);
          }
        }
        @keyframes wm-pulse {
          0% {
            opacity: 0.65;
            transform: scale(0.7);
            transform-origin: 90px 72px;
          }
          100% {
            opacity: 0;
            transform: scale(1.35);
            transform-origin: 90px 72px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .waiting-motion * {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
