"use client";

/**
 * Barra de meta da Matilha: carrega como uma barra de progresso, com o
 * cachorro correndo em cima da ponta do preenchimento. Ao terminar, ele senta;
 * ao bater 100%, ganha um osso e a barra brilha.
 * Interativo: o humor do cachorro segue a projeção; passar o mouse mostra a
 * fala dele; clicar faz ele pular, latir e trocar de frase. Os marcos de
 * 25/50/75% acendem quando são ultrapassados.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatBRL, formatDate, formatPercent } from "@/lib/format";
import type { GoalProgress as GoalProgressData } from "@/lib/metrics/goals";
import { cn } from "@/lib/utils";
import { DogRunner } from "./DogRunner";
import { dogLines, dogMood } from "./dogMood";

const DURATION_MS = 1800;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const DOG_W = 72;
/** Fração da largura do cachorro que fica antes da ponta da barra (focinho sobre a ponta). */
const DOG_ANCHOR = 0.86;

export interface GoalProgressProps {
  title: string;
  subtitle?: string;
  progress: GoalProgressData;
  /** Indicadores extras exibidos abaixo (ex.: pedidos, novos clientes). */
  extras?: { label: string; value: string }[];
  size?: "lg" | "md";
  className?: string;
  /** Link de ação quando o cachorro está preocupado (ex.: clientes em risco). */
  helpHref?: string;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function GoalProgress({ title, subtitle, progress, extras, size = "lg", className, helpHref = "/clientes?classe=oportunidades" }: GoalProgressProps) {
  const pct = progress.percent ?? 0;
  const target = Math.min(Math.max(pct, 0), 100);
  const complete = pct >= 100;
  const reduced = usePrefersReducedMotion();

  const [shown, setShown] = useState(0);
  const [running, setRunning] = useState(true);
  const [counter, setCounter] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      setShown(target);
      setCounter(pct);
      setRunning(false);
      return;
    }
    setRunning(true);
    const start = performance.now();
    const first = requestAnimationFrame(() => setShown(target));
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setCounter(pct * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else setRunning(false);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(first);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, pct, reduced]);

  const mood = dogMood(progress);
  const lines = dogLines(progress);
  const [lineIdx, setLineIdx] = useState(0);
  const [bubble, setBubble] = useState<"hover" | "click" | null>(null);
  const [jumping, setJumping] = useState(false);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function poke() {
    if (running) return;
    setLineIdx((i) => (i + 1) % lines.length);
    setBubble("click");
    if (!reduced) {
      setJumping(false);
      requestAnimationFrame(() => setJumping(true));
    }
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), 3200);
  }
  useEffect(
    () => () => {
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    },
    [],
  );

  // Balão alinhado para não sair do card perto das bordas
  const bubbleAlign: "left" | "center" | "right" = shown >= 70 ? "right" : shown <= 30 ? "left" : "center";
  const transition = reduced ? "none" : `width ${DURATION_MS}ms ${EASE}, left ${DURATION_MS}ms ${EASE}`;
  const dogLeft = `clamp(0px, calc(${shown}% - ${DOG_W * DOG_ANCHOR}px), calc(100% - ${DOG_W}px))`;
  const p = progress;

  return (
    <section className={cn("lift animate-rise rounded-xl border border-navy-100 bg-white p-5", className)}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className={cn("font-semibold text-navy-950", size === "lg" ? "text-base" : "text-sm")}>{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        <div className="text-right">
          <span className={cn("font-semibold tabular-nums text-navy-900", size === "lg" ? "text-3xl" : "text-2xl")}>
            {formatPercent(Math.round(counter * 10) / 10)}
          </span>
          <span className="ml-1 text-xs text-muted">da meta</span>
        </div>
      </header>

      {/* pista + cachorro */}
      <div className="relative mt-4 pt-[54px]">
        <div className="goal-dog absolute top-0 z-10" style={{ left: dogLeft, transition, width: DOG_W }}>
          {bubble && !running && (
            <div
              role="status"
              className={cn(
                "speech-bubble pointer-events-none absolute bottom-[58px] z-20 w-max max-w-[240px] rounded-xl border border-navy-100 bg-white px-3 py-2 text-xs leading-snug text-navy-950 shadow-lg shadow-navy-950/10",
                bubbleAlign === "center" && "left-1/2",
                bubbleAlign === "left" && "left-0",
                bubbleAlign === "right" && "right-0",
              )}
              style={{ ["--bx" as string]: bubbleAlign === "center" ? "-50%" : "0%" }}
            >
              {bubble === "click" && <span className="mr-1 font-semibold text-navy-700">Au!</span>}
              {lines[lineIdx]}
              <span
                className="absolute -bottom-1.5 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-navy-100 bg-white"
                style={bubbleAlign === "center" ? { left: "50%" } : bubbleAlign === "left" ? { left: DOG_W / 2 } : { right: DOG_W / 2 - 12 }}
                aria-hidden
              />
            </div>
          )}
          <button
            type="button"
            onClick={poke}
            onMouseEnter={() => !running && bubble !== "click" && setBubble("hover")}
            onMouseLeave={() => bubble === "hover" && setBubble(null)}
            onFocus={() => !running && setBubble("hover")}
            onBlur={() => setBubble(null)}
            aria-label={`Mascote da meta: ${lines[0]}`}
            className={cn(
              "block cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500",
              running && "pointer-events-none",
            )}
          >
            <div
              className={cn(complete && !running && !jumping && "dog-hop", jumping && "dog-jump dog-poke")}
              onAnimationEnd={(e) => e.animationName === "dog-jump" && setJumping(false)}
            >
              <DogRunner pose={running ? "run" : "sit"} celebrate={complete && !running} mood={running ? "normal" : mood} />
            </div>
          </button>
          {complete && !running && <PawBurst />}
        </div>

        <div
          role="progressbar"
          aria-label={title}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(target)}
          aria-valuetext={`${formatPercent(pct)} da meta — ${formatBRL(p.realized)} de ${formatBRL(p.target)}`}
          className={cn(
            "relative h-4 w-full overflow-hidden rounded-full border border-navy-100 bg-white",
            complete && !running && "goal-complete",
          )}
        >
          {/* marcos 25/50/75 */}
          {[25, 50, 75].map((m) => (
            <span key={m} className="absolute top-0 h-full w-px bg-navy-100" style={{ left: `${m}%` }} aria-hidden />
          ))}
          <div
            className="goal-fill relative h-full overflow-hidden rounded-full bg-gradient-to-r from-navy-700 to-navy-900"
            style={{ width: `${shown}%`, transition }}
          >
            {running && !reduced && (
              <span className="goal-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent" aria-hidden />
            )}
          </div>
        </div>

        {/* pontos dos marcos: acendem quando a barra passa por eles */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[22px] h-4">
          {[25, 50, 75].map((m) => {
            const passed = shown >= m;
            return (
              <span
                key={m}
                title={`${m}% da meta · ${p.target === null ? "—" : formatBRL((p.target * m) / 100)}`}
                className={cn(
                  "pointer-events-auto absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors duration-300",
                  passed ? "milestone-on border-white bg-white shadow-[0_0_0_2px_rgba(15,38,71,0.35)]" : "border-navy-100 bg-white",
                )}
                style={{ left: `${m}%`, animationDelay: passed ? `${(m / 100) * DURATION_MS}ms` : undefined }}
              />
            );
          })}
        </div>

        <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted">
          <span>R$ 0</span>
          <span className="hidden text-navy-300 sm:inline">{!running && "passe o mouse no cachorro · clique para ele latir"}</span>
          <span>{formatBRL(p.target)}</span>
        </div>
      </div>

      {p.exceededBy !== null && (
        <p className="animate-pop mt-2 rounded-md bg-navy-50 px-3 py-2 text-sm font-medium text-navy-900">
          Meta batida! {formatBRL(p.exceededBy)} acima da meta (+{formatPercent(pct - 100)}).
        </p>
      )}
      {mood === "preocupado" && p.phase === "em_andamento" && !running && (
        <p className="animate-rise mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-warning">
          <span>No ritmo atual a projeção fica abaixo de 80% da meta.</span>
          <Link href={helpHref} className="font-semibold underline-offset-2 hover:underline">
            Ver clientes para contatar →
          </Link>
        </p>
      )}

      <dl className={cn("mt-4 grid gap-x-6 gap-y-3", size === "lg" ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2")}>
        <Stat label="Realizado" value={formatBRL(p.realized)} strong />
        <Stat label="Meta" value={formatBRL(p.target)} />
        <Stat label="Falta" value={p.remaining === null ? "—" : formatBRL(p.remaining)} />
        <Stat
          label={`Meta diária necessária (${p.dayMode === "UTEIS" ? "dias úteis" : "dias corridos"})`}
          value={p.dailyNeeded === null ? "—" : formatBRL(p.dailyNeeded)}
          hint={p.phase === "encerrado" ? "período encerrado" : `${p.daysRemaining} dia(s) restante(s)`}
        />
        <Stat
          label="Projeção de fechamento"
          value={p.projection === null ? "—" : formatBRL(p.projection)}
          hint={p.projectionPercent === null ? "estimativa indisponível" : `estimativa · ${formatPercent(p.projectionPercent)} da meta`}
        />
        {extras?.map((e) => <Stat key={e.label} label={e.label} value={e.value} />)}
      </dl>
    </section>
  );
}

/** Pegadas que "explodem" para cima quando a meta é batida (uma vez). */
const PAWS = [
  { dx: "-38px", dy: "-34px", rot: "-25deg", delay: 0 },
  { dx: "-14px", dy: "-50px", rot: "-8deg", delay: 80 },
  { dx: "12px", dy: "-46px", rot: "12deg", delay: 160 },
  { dx: "36px", dy: "-30px", rot: "28deg", delay: 60 },
  { dx: "-2px", dy: "-62px", rot: "4deg", delay: 220 },
];

function PawBurst() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-4" aria-hidden>
      {PAWS.map((p, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          width="12"
          height="12"
          className="paw-burst absolute"
          style={{ ["--dx" as string]: p.dx, ["--dy" as string]: p.dy, ["--rot" as string]: p.rot, animationDelay: `${p.delay}ms` }}
        >
          <g fill="#1e3a6b">
            <ellipse cx="6" cy="9" rx="2.1" ry="2.7" />
            <ellipse cx="10.2" cy="5.6" rx="2.1" ry="2.7" />
            <ellipse cx="14.6" cy="5.6" rx="2.1" ry="2.7" />
            <ellipse cx="18.6" cy="9" rx="2.1" ry="2.7" />
            <path d="M12.3 10.5c3 0 6 3.6 6 6.3 0 2-1.6 2.9-3.1 2.4-1.2-.4-1.9-.7-2.9-.7s-1.7.3-2.9.7c-1.5.5-3.1-.4-3.1-2.4 0-2.7 3-6.3 6-6.3Z" />
          </g>
        </svg>
      ))}
    </div>
  );
}

function Stat({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className={cn("mt-0.5 tabular-nums text-navy-950", strong ? "text-base font-semibold" : "text-sm font-medium")}>{value}</dd>
      {hint && <dd className="text-[11px] text-muted">{hint}</dd>}
    </div>
  );
}

/** Estado vazio: sem meta cadastrada ou sem dados — nunca exibe número inventado. */
export function GoalEmpty({ title, message, period }: { title: string; message: string; period?: { start: string; end: string } }) {
  return (
    <section className="animate-rise rounded-xl border border-dashed border-navy-200 bg-navy-50/50 p-5">
      <div className="flex items-center gap-4">
        <DogRunner pose="sit" className="shrink-0 opacity-60" />
        <div>
          <h3 className="text-sm font-semibold text-navy-950">{title}</h3>
          <p className="mt-1 text-sm text-muted">{message}</p>
          {period && (
            <p className="mt-1 text-xs text-muted">
              Período: {formatDate(period.start)} a {formatDate(period.end)}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
