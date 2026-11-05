/**
 * Mascote da Matilha — cachorro original em SVG (silhueta azul-marinho com
 * contorno branco). Pose "run": patas alternando enquanto a barra carrega.
 * Pose "sit": sentado quando a barra para. Pose "sit" + celebrate: osso acima.
 */
import { useId } from "react";

const NAVY = "#0f2647";
const NAVY_FAR = "#2b4a80";
const NAVY_DEEP = "#0a1a33";

export function DogRunner({
  pose,
  celebrate = false,
  className,
}: {
  pose: "run" | "sit";
  celebrate?: boolean;
  className?: string;
}) {
  const filterId = `dog-outline-${useId().replace(/:/g, "")}`;

  return (
    <svg
      viewBox="0 0 72 52"
      width="72"
      height="52"
      aria-hidden="true"
      className={`${pose === "run" ? "dog-running" : ""} ${className ?? ""}`}
      style={{ overflow: "visible" }}
    >
      <defs>
        {/* contorno branco limpo em volta da silhueta inteira */}
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="1.4" result="dilated" />
          <feFlood floodColor="#ffffff" />
          <feComposite in2="dilated" operator="in" result="outline" />
          <feMerge>
            <feMergeNode in="outline" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {celebrate && (
        <g className="bone-pop" transform="translate(44 -12)">
          <path
            d="M3 4.5a2.6 2.6 0 1 1 3-3.4h8a2.6 2.6 0 1 1 3 3.4 2.6 2.6 0 1 1-3 3.4H6a2.6 2.6 0 1 1-3-3.4Z"
            fill="#ffffff"
            stroke={NAVY}
            strokeWidth="1.3"
          />
        </g>
      )}

      <g filter={`url(#${filterId})`}>
        {pose === "run" ? (
          <g className="dog-body">
            {/* patas do lado de lá (tom mais claro) */}
            <rect className="dog-leg dog-leg-b" x="21" y="29" width="4" height="13" rx="2" fill={NAVY_FAR} />
            <rect className="dog-leg dog-leg-a" x="41" y="29" width="4" height="13" rx="2" fill={NAVY_FAR} />
            {/* cauda */}
            <path className="dog-tail" d="M9 8 C 7 14, 10 20, 18 23" stroke={NAVY} strokeWidth="3.6" fill="none" strokeLinecap="round" />
            {/* corpo */}
            <ellipse cx="31" cy="26" rx="15" ry="8.5" fill={NAVY} />
            {/* pescoço e cabeça */}
            <path d="M39 23 L46 12 L55 16 L47 30 Z" fill={NAVY} />
            <ellipse cx="51" cy="14" rx="8" ry="7" fill={NAVY} />
            <path d="M55 10.5 Q64 10.5 65.5 15.5 Q64.5 20 56 20 Z" fill={NAVY} />
            <path d="M45 9 Q42.5 1.5 48 2.5 Q51.5 6.5 50 11 Z" fill={NAVY_DEEP} />
            <circle cx="64.6" cy="14.4" r="1.7" fill={NAVY_DEEP} />
            <circle cx="53.2" cy="11.8" r="1.4" fill="#ffffff" />
            <circle cx="53.6" cy="11.9" r="0.65" fill={NAVY_DEEP} />
            {/* coleira branca */}
            <path d="M44.5 19.5 L50.5 24.5" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
            {/* patas do lado de cá */}
            <rect className="dog-leg dog-leg-a" x="17" y="29" width="4" height="13" rx="2" fill={NAVY} />
            <rect className="dog-leg dog-leg-b" x="37" y="29" width="4" height="13" rx="2" fill={NAVY} />
          </g>
        ) : (
          <g>
            {/* cauda apoiada no chão */}
            <path className="dog-tail" d="M6 36 C 6 41, 10 45, 18 44" stroke={NAVY} strokeWidth="3.6" fill="none" strokeLinecap="round" />
            {/* quadril e tronco inclinado */}
            <ellipse cx="25" cy="37" rx="10" ry="8" fill={NAVY} />
            <path d="M19 37 C 21 25, 33 16, 42 17 L 47 29 C 43 38, 33 43, 22 43 Z" fill={NAVY} />
            {/* patas dianteiras retas */}
            <rect x="37" y="26" width="4" height="19" rx="2" fill={NAVY_FAR} />
            <rect x="42" y="26" width="4" height="19" rx="2" fill={NAVY} />
            <ellipse cx="28" cy="45" rx="7" ry="2.6" fill={NAVY} />
            {/* cabeça erguida (inclina de curiosidade de vez em quando) */}
            <g className="dog-head">
              <ellipse cx="46" cy="13" rx="8" ry="7" fill={NAVY} />
              <path d="M50 9.5 Q59 9.5 60.5 14.5 Q59.5 19 51 19 Z" fill={NAVY} />
              <path d="M40 8 Q37.5 0.5 43 1.5 Q46.5 5.5 45 10 Z" fill={NAVY_DEEP} />
              <circle cx="59.6" cy="13.4" r="1.7" fill={NAVY_DEEP} />
              <circle cx="48.2" cy="10.8" r="1.4" fill="#ffffff" />
              <circle cx="48.6" cy="10.9" r="0.65" fill={NAVY_DEEP} />
            </g>
            <path d="M39.5 19 L45.5 23.5" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        )}
      </g>
    </svg>
  );
}
