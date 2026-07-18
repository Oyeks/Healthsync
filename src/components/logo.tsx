/**
 * HealthSync mark — a shield containing a medical cross overlaid with a
 * three-node sync network, matching the supplied brand artwork.
 */
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 72"
      className={className}
      role="img"
      aria-label="HealthSync"
    >
      <path
        d="M32 2 60 12v28c0 16-12 26-28 30C16 66 4 56 4 40V12L32 2Z"
        fill="#0d1117"
        stroke="#fff"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Medical cross cut-out */}
      <path
        d="M26 16h12v10h10v12H38v18H26V38H16V26h10V16Z"
        fill="#fff"
      />
      {/* Sync network overlay */}
      <g stroke="#00a862" strokeWidth="2.6" strokeLinecap="round">
        <line x1="22" y1="27" x2="41" y2="21" />
        <line x1="22" y1="27" x2="41" y2="35" />
        <line x1="41" y1="21" x2="41" y2="35" />
      </g>
      <g fill="#0d1117" stroke="#0d1117" strokeWidth="1">
        <circle cx="22" cy="27" r="4.6" />
        <circle cx="41" cy="21" r="3.6" />
        <circle cx="41" cy="35" r="3.6" />
      </g>
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-bold tracking-tight ${className}`}>
      <span className="text-brand-600">Health</span>
      <span className="text-sync-500">Sync</span>
    </span>
  );
}

export function Logo({
  markClass,
  textClass,
}: {
  markClass?: string;
  textClass?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark className={markClass ?? "h-8 w-8"} />
      <Wordmark className={textClass ?? "text-xl"} />
    </span>
  );
}
