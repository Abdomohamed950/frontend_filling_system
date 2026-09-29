import Wave from "react-wavify";
import tankImage from "../img/tank.png";
import { cn } from "@/lib/utils";

/**
 * Tanker illustration with a live water level.
 *
 * The overlay coordinates were originally hand-aligned inside a square
 * `0 0 250 250` viewBox that letterboxed itself against the portrait PNG —
 * which only stayed registered while the box kept the image's exact ratio.
 * The operator console now sizes the tank by whatever space is left over, so
 * the viewBox is the image's own pixel space (323 × 466) and the original
 * artwork is mapped into it by ONE transform, derived rather than re-typed:
 *
 *   old scale inside the square box : s  = W / 250
 *   new scale inside the image box  : s' = W / 323
 *   x: u·s' = x·s            → u = x · 323/250 = 1.292x
 *   y: v·s' = (H−W)/2 + y·s  → v = (466−323)/2 + 1.292y = 71.5 + 1.292y
 *
 * With `object-contain` on the image and `xMidYMid meet` on the SVG, the two
 * now letterbox identically at any container size or aspect ratio.
 */
const ARTWORK_TRANSFORM = "translate(0 71.5) scale(1.292)";

export default function Tank({ valveState, filling, progress = 0 }) {
  const level = Math.max(0, Math.min(100, Number(progress) || 0));
  const overfilled = Number(progress) > 100;

  const cx = 171;
  const cy = 195;
  const rx = 53;
  const ry = 35;
  const bottom = cy + ry - 15;
  const height = 2 * ry;
  const width = 2 * rx;

  const valveTone =
    valveState === "close"
      ? "var(--destructive)"
      : valveState === "opening" || valveState === "closing"
        ? "var(--warning)"
        : "var(--success)";

  return (
    <div
      className="relative size-full min-h-0 select-none"
      role="img"
      aria-label={`مستوى التعبئة ${level} بالمئة`}
    >
      <img
        src={tankImage}
        alt=""
        aria-hidden
        className="size-full object-contain dark:opacity-90"
        draggable={false}
      />

      {/* Level read-out lives in HTML rather than the SVG so it stays crisp
          and can pick up theme tokens. */}
      <div
        className={cn(
          "absolute top-1 end-1 rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums backdrop-blur-sm transition-colors",
          overfilled
            ? "border-destructive/30 bg-destructive/15 text-destructive"
            : filling
              ? "border-primary/30 bg-primary/15 text-primary"
              : "border-border bg-background/80 text-muted-foreground"
        )}
      >
        {level}%
      </div>

      <svg
        className="pointer-events-none absolute inset-0 size-full"
        viewBox="0 0 323 466"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <defs>
          <linearGradient id="fs-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--water-top)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--water-bottom)" stopOpacity="0.7" />
          </linearGradient>

          <pattern
            id="fs-droplets"
            x="0"
            y="0"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="10" cy="5" r="3" fill="url(#fs-water)" />
            <circle cx="5" cy="15" r="2" fill="url(#fs-water)" />
            <circle cx="15" cy="15" r="2" fill="url(#fs-water)" />
            <animateTransform
              attributeName="patternTransform"
              type="translate"
              from="0 0"
              to="0 20"
              dur="0.5s"
              repeatCount="indefinite"
            />
          </pattern>

          {/* No transform here: `clipPathUnits` defaults to the user space of
              the referencing element, and the foreignObject below already
              sits inside the transformed group. Repeating it would apply the
              mapping twice. */}
          <clipPath id="fs-tank-clip">
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
          </clipPath>
        </defs>

        <g transform={ARTWORK_TRANSFORM}>
          {/* Falling stream from the spout while the valve is passing water. */}
          {filling && (
            <rect x="168" y="25" width="10" height="135" fill="url(#fs-droplets)" />
          )}

          {/* Tank opening rim. */}
          <ellipse
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            fill="none"
            stroke="var(--foreground)"
            strokeOpacity="0.45"
            strokeWidth="1.5"
          />

          <foreignObject
            x={cx - rx}
            y={bottom - (level / 100) * height}
            width={width}
            height={height + 15}
            clipPath="url(#fs-tank-clip)"
            style={{ transition: "y 600ms cubic-bezier(0.4, 0, 0.2, 1)" }}
          >
            {/* Never paused — the surface keeps rippling whether or not the
                valve is open, which is what makes the tank read as live.
                Filling only lifts the amplitude a little. */}
            <Wave
              fill="var(--water-bottom)"
              paused={false}
              options={{
                height: 12,
                amplitude: filling ? 8 : 6,
                speed: 0.3,
                points: 3,
              }}
              style={{ height: "100%", width: "100%" }}
            />
          </foreignObject>

          {/* Valve handwheel — spins while transitioning, tinted by state. */}
          <g transform="rotate(-90 17 230)">
            <circle
              cx="17"
              cy="230"
              r="15"
              fill="var(--card)"
              stroke={valveTone}
              strokeWidth="2.5"
            />
            {[
              [17, 215, 17, 245],
              [2, 230, 32, 230],
              [7, 220, 27, 240],
              [27, 220, 7, 240],
            ].map(([x1, y1, x2, y2]) => (
              <line
                key={`${x1}-${y1}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={valveTone}
                strokeWidth="2"
                strokeLinecap="round"
              />
            ))}

            {valveState === "opening" && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="-90 17 230"
                to="270 17 230"
                dur="3s"
                repeatCount="indefinite"
                fill="freeze"
              />
            )}
            {valveState === "closing" && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="270 17 230"
                to="-90 17 230"
                dur="3s"
                repeatCount="indefinite"
                fill="freeze"
              />
            )}
          </g>
        </g>
      </svg>
    </div>
  );
}
