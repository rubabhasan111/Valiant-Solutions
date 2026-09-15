"use client";

import { useEffect, useRef } from "react";
import { animate, createScope, onScroll, stagger, svg } from "animejs";

// Side-on cutaway of an inline-4 petrol engine, in viewBox units.
const CRANK_Y = 560;
const CRANK_R = 55;
const ROD_L = 190;
const BORE_TOP = 240;
const CYLINDERS = [400, 530, 660, 790];
// Cylinders 1 and 4 share a crank throw; 2 and 3 sit opposite them.
const THROW = [0, 180, 180, 0];
// Firing order 1-3-4-2 across the 720 degree four-stroke cycle.
const FIRE_AT = [0, 540, 180, 360];
const CAMS = [
  { x: 120, y: 110 },
  { x: 250, y: 110 },
];
const PULLEY = { x: 220, y: 560, r: 46 };
const TENSIONER = { x: 95, y: 340 };
const BELT = "M174 560 L73 340 L70 110 A50 50 0 0 1 120 60 L250 60 A50 50 0 0 1 300 110 L266 560 A46 46 0 0 1 174 560 Z";
const REST_ANGLE = 0;
// Crank revolutions across the full height of the page.
const CRANK_TURNS = 8;

const r2 = (n: number) => Math.round(n * 100) / 100;
const wrap720 = (n: number) => ((n % 720) + 720) % 720;

function gearPath(cx: number, cy: number, radius: number, teeth: number, depth = 8) {
  const step = Math.PI / teeth;
  const points: string[] = [];
  for (let i = 0; i < teeth * 2; i++) {
    const r = i % 2 === 0 ? radius : radius - depth;
    for (const a of [i * step, (i + 1) * step]) {
      points.push(`${r2(cx + r * Math.cos(a))} ${r2(cy + r * Math.sin(a))}`);
    }
  }
  return `M${points.join(" L")} Z`;
}

function crankPose(deg: number, i: number) {
  const t = ((deg + THROW[i]) * Math.PI) / 180;
  const offset = CRANK_R * Math.sin(t);
  const pinY = CRANK_Y - CRANK_R * Math.cos(t);
  return {
    pinX: r2(CYLINDERS[i] + offset),
    pinY: r2(pinY),
    wristY: r2(pinY - Math.sqrt(ROD_L ** 2 - offset ** 2)),
  };
}

// Spark glow peaks as each cylinder reaches top dead centre on its power stroke.
function sparkLevel(deg: number, i: number) {
  const d = wrap720(deg - FIRE_AT[i]);
  return r2(Math.max(0, 1 - Math.min(d, 720 - d) / 45));
}

// Exhaust valves open for the 180 degrees after the power stroke, intake for the next 180.
function valveLift(deg: number, i: number, opensAfterFiring: number) {
  const d = wrap720(deg - FIRE_AT[i] - opensAfterFiring);
  return d < 180 ? r2(Math.sin((d / 180) * Math.PI) * 10) : 0;
}

const SPOKES = [0, 60, 120].map((a) => {
  const t = (a * Math.PI) / 180;
  const dx = r2(32 * Math.cos(t));
  const dy = r2(32 * Math.sin(t));
  return { x1: PULLEY.x + dx, y1: PULLEY.y + dy, x2: PULLEY.x - dx, y2: PULLEY.y - dy };
});

export function EngineBackdrop() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const all = <T extends Element>(selector: string) => Array.from(el.querySelectorAll<T>(selector));
    const pistons = all<SVGGElement>("[data-piston]");
    const rods = all<SVGLineElement>("[data-rod]");
    const throws = all<SVGGElement>("[data-throw]");
    const sparks = all<SVGGElement>("[data-spark]");
    const exhaust = all<SVGGElement>("[data-exhaust]");
    const intake = all<SVGGElement>("[data-intake]");
    const cams = all<SVGGElement>("[data-cam]");
    const pulley = el.querySelector<SVGGElement>("[data-pulley]");
    const belt = el.querySelector<SVGPathElement>("[data-belt]");

    const render = (deg: number) => {
      CYLINDERS.forEach((cx, i) => {
        const { pinX, pinY, wristY } = crankPose(deg, i);
        pistons[i].setAttribute("transform", `translate(0 ${r2(wristY - 40)})`);
        rods[i].setAttribute("y1", String(wristY));
        rods[i].setAttribute("x2", String(pinX));
        rods[i].setAttribute("y2", String(pinY));
        throws[i].setAttribute("transform", `rotate(${r2(deg + THROW[i])} ${cx} ${CRANK_Y})`);
        sparks[i].setAttribute("opacity", String(sparkLevel(deg, i)));
        exhaust[i].setAttribute("transform", `translate(0 ${valveLift(deg, i, 180)})`);
        intake[i].setAttribute("transform", `translate(0 ${valveLift(deg, i, 360)})`);
      });
      pulley?.setAttribute("transform", `rotate(${r2(deg)} ${PULLEY.x} ${PULLEY.y})`);
      cams.forEach((cam, k) => cam.setAttribute("transform", `rotate(${r2(deg / 2)} ${CAMS[k].x} ${CAMS[k].y})`));
      // Belt surface speed matches the crank pulley's circumference.
      belt?.setAttribute("stroke-dashoffset", String(r2((-deg / 360) * 2 * Math.PI * PULLEY.r)));
    };

    const crank = { angle: REST_ANGLE };
    const scope = createScope({ root }).add(() => {
      // The outline draws itself in once on load.
      animate(svg.createDrawable("[data-draw]"), {
        draw: ["0 0", "0 1"],
        duration: 1800,
        delay: stagger(90),
        ease: "inOutQuad",
      });

      // Scroll position drives the crankshaft; pistons, valves, cams and belt follow its angle.
      animate(crank, {
        angle: REST_ANGLE + 360 * CRANK_TURNS,
        ease: "linear",
        onUpdate: () => render(crank.angle),
        autoplay: onScroll({ target: document.body, enter: "top top", leave: "bottom bottom", sync: 0.25 }),
      });

      // The whole engine drifts left and tilts as the page scrolls.
      animate("[data-engine-body]", {
        x: ["0%", "-24%"],
        y: ["0%", "8%"],
        rotate: [0, -6],
        scale: [1, 0.92],
        ease: "linear",
        autoplay: onScroll({ target: document.body, enter: "top top", leave: "bottom bottom", sync: 0.25 }),
      });
    });

    return () => scope.revert();
  }, []);

  const rest = CYLINDERS.map((_, i) => crankPose(REST_ANGLE, i));

  return (
    <div ref={root} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        data-engine-body
        className="absolute right-[-62vw] top-[34vh] w-[165vw] opacity-60 sm:right-[-30vw] sm:top-[22vh] sm:w-[115vw] md:right-[-9vw] md:top-[9vh] md:w-[min(1120px,70vw)] md:opacity-100"
      >
        <svg
          viewBox="0 0 1000 760"
          className="h-auto w-full"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "var(--engine)" }}
        >
          {/* Timing belt, tensioner, cam sprockets and crank pulley */}
          <path data-belt d={BELT} strokeWidth={9} strokeDasharray="16 8" />
          <circle cx={TENSIONER.x} cy={TENSIONER.y} r={22} fill="var(--canvas)" />
          <circle cx={TENSIONER.x} cy={TENSIONER.y} r={7} />
          {CAMS.map((cam) => (
            <g key={cam.x} data-cam transform={`rotate(${REST_ANGLE / 2} ${cam.x} ${cam.y})`}>
              <path d={gearPath(cam.x, cam.y, 50, 20)} fill="var(--canvas)" />
              <circle cx={cam.x} cy={cam.y} r={26} />
              <circle cx={cam.x} cy={cam.y} r={8} />
              <line x1={cam.x} y1={cam.y - 26} x2={cam.x} y2={cam.y - 38} strokeWidth={5} />
            </g>
          ))}
          <g data-pulley transform={`rotate(${REST_ANGLE} ${PULLEY.x} ${PULLEY.y})`}>
            <circle cx={PULLEY.x} cy={PULLEY.y} r={PULLEY.r} fill="var(--canvas)" />
            <circle cx={PULLEY.x} cy={PULLEY.y} r={32} />
            {SPOKES.map((s) => (
              <line key={`${s.x1}-${s.y1}`} {...s} />
            ))}
            <circle cx={PULLEY.x} cy={PULLEY.y} r={9} fill="currentColor" />
          </g>
          <rect x={266} y={548} width={64} height={24} rx={6} fill="var(--canvas)" />

          {/* Cam cover, cylinder head, block and sump */}
          <path data-draw d="M335 150 V126 Q335 100 361 100 H829 Q855 100 855 126 V150" />
          <rect data-draw x={320} y={150} width={550} height={90} rx={14} />
          <rect data-draw x={320} y={BORE_TOP} width={550} height={380} rx={18} />
          <line data-draw x1={320} y1={510} x2={870} y2={510} />
          <path data-draw d="M342 620 H848 L822 698 Q818 712 804 712 H386 Q372 712 368 698 Z" />
          <line x1={595} y1={712} x2={595} y2={726} strokeWidth={8} />

          {CYLINDERS.map((cx) => (
            <g key={cx}>
              <rect x={cx - 55} y={BORE_TOP} width={110} height={232} strokeWidth={2} strokeDasharray="6 8" />
              <line x1={cx} y1={72} x2={cx} y2={98} strokeWidth={11} />
              <line x1={cx} y1={98} x2={cx} y2={150} strokeWidth={4} />
            </g>
          ))}
          {[465, 595, 725].map((x) => (
            <circle key={x} cx={x} cy={300} r={7} strokeWidth={2} />
          ))}

          {/* Combustion glow */}
          {CYLINDERS.map((cx, i) => (
            <g key={cx} data-spark opacity={sparkLevel(REST_ANGLE, i)} stroke="none">
              <rect x={cx - 53} y={BORE_TOP + 2} width={106} height={31} rx={4} fill="var(--spark)" opacity={0.3} />
              <circle cx={cx} cy={BORE_TOP + 12} r={9} fill="var(--spark)" />
            </g>
          ))}

          {/* Valves */}
          {CYLINDERS.map((cx, i) => (
            <g key={cx}>
              <g data-exhaust transform={`translate(0 ${valveLift(REST_ANGLE, i, 180)})`}>
                <line x1={cx - 26} y1={166} x2={cx - 26} y2={234} />
                <line x1={cx - 40} y1={236} x2={cx - 12} y2={236} strokeWidth={5} />
              </g>
              <g data-intake transform={`translate(0 ${valveLift(REST_ANGLE, i, 360)})`}>
                <line x1={cx + 26} y1={166} x2={cx + 26} y2={234} />
                <line x1={cx + 12} y1={236} x2={cx + 40} y2={236} strokeWidth={5} />
              </g>
            </g>
          ))}

          {/* Connecting rods, pistons, crankshaft */}
          {CYLINDERS.map((cx, i) => (
            <line
              key={cx}
              data-rod
              x1={cx}
              y1={rest[i].wristY}
              x2={rest[i].pinX}
              y2={rest[i].pinY}
              strokeWidth={14}
            />
          ))}
          {CYLINDERS.map((cx, i) => (
            <g key={cx} data-piston transform={`translate(0 ${r2(rest[i].wristY - 40)})`}>
              <rect x={cx - 50} y={0} width={100} height={70} rx={8} fill="var(--canvas)" />
              <line x1={cx - 50} y1={12} x2={cx + 50} y2={12} strokeWidth={2} />
              <line x1={cx - 50} y1={21} x2={cx + 50} y2={21} strokeWidth={2} />
              <circle cx={cx} cy={40} r={9} />
            </g>
          ))}
          <line x1={330} y1={CRANK_Y} x2={880} y2={CRANK_Y} strokeWidth={14} />
          {[335, 465, 595, 725, 855].map((x) => (
            <circle key={x} cx={x} cy={CRANK_Y} r={17} fill="var(--canvas)" />
          ))}
          {CYLINDERS.map((cx, i) => (
            <g key={cx} data-throw transform={`rotate(${REST_ANGLE + THROW[i]} ${cx} ${CRANK_Y})`}>
              <path d={`M${cx - 44} ${CRANK_Y} A44 44 0 0 0 ${cx + 44} ${CRANK_Y} Z`} fill="var(--canvas)" />
              <path
                d={`M${cx - 15} ${CRANK_Y - CRANK_R} L${cx + 15} ${CRANK_Y - CRANK_R} L${cx + 22} ${CRANK_Y} L${cx - 22} ${CRANK_Y} Z`}
                fill="var(--canvas)"
              />
              <circle cx={cx} cy={CRANK_Y - CRANK_R} r={12} fill="var(--canvas)" />
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
