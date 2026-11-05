/** Marca Matilha: pegada estilizada em branco sobre azul-marinho. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-white">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <g fill="#0f2647">
            <ellipse cx="6" cy="9" rx="2.1" ry="2.7" />
            <ellipse cx="10.2" cy="5.6" rx="2.1" ry="2.7" />
            <ellipse cx="14.6" cy="5.6" rx="2.1" ry="2.7" />
            <ellipse cx="18.6" cy="9" rx="2.1" ry="2.7" />
            <path d="M12.3 10.5c3 0 6 3.6 6 6.3 0 2-1.6 2.9-3.1 2.4-1.2-.4-1.9-.7-2.9-.7s-1.7.3-2.9.7c-1.5.5-3.1-.4-3.1-2.4 0-2.7 3-6.3 6-6.3Z" />
          </g>
        </svg>
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-sm font-semibold text-white">Matilha</span>
          <span className="block text-[11px] text-navy-300">Pet Intelligence</span>
        </span>
      )}
    </div>
  );
}
