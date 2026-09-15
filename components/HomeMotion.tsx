"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { animate, createScope, onScroll, stagger, utils } from "animejs";
import { formatAud } from "@/lib/money";

export function HomeMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!root.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const scope = createScope({ root }).add(() => {
      // Hero copy settles in on load, one line after another.
      animate("[data-hero]", {
        opacity: [0, 1],
        y: [28, 0],
        duration: 1000,
        delay: stagger(110, { start: 200 }),
        ease: "outExpo",
      });

      // Each section rises into place the first time it scrolls into view.
      utils.$("[data-reveal]").forEach((section) => {
        animate(section, {
          opacity: [0, 1],
          y: [40, 0],
          duration: 1100,
          ease: "outExpo",
          autoplay: onScroll({ target: section, enter: "bottom-=80 top", repeat: false }),
        });
      });

      // The example plan ticks through its instalments and counts up what has been paid.
      const plan = utils.$("[data-plan]")[0];
      if (plan) {
        animate("[data-instalment]", {
          opacity: [0, 1],
          x: [-20, 0],
          duration: 700,
          delay: stagger(120, { start: 250 }),
          ease: "outQuart",
          autoplay: onScroll({ target: plan, enter: "bottom-=120 top", repeat: false }),
        });

        const counter = plan.querySelector<HTMLElement>("[data-paid-total]");
        if (counter) {
          const paid = { cents: 0 };
          animate(paid, {
            cents: Number(counter.dataset.paidTotal),
            duration: 1600,
            delay: 300,
            ease: "outExpo",
            onUpdate: () => {
              counter.textContent = formatAud(Math.round(paid.cents));
            },
            autoplay: onScroll({ target: plan, enter: "bottom-=120 top", repeat: false }),
          });
        }
      }
    });

    return () => scope.revert();
  }, []);

  return <div ref={root}>{children}</div>;
}
