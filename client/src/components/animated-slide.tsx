import { type Slide, type SlideTheme, type SlideTransition } from "@shared/schema";
import { SlideRenderer } from "./slide-renderer";
import { Fragment, type ReactNode } from "react";

const transitionClassMap: Record<SlideTransition, string> = {
  fade: "slide-fade 420ms ease-out",
  "push-left": "slide-push-left 420ms ease-out",
  "push-up": "slide-push-up 420ms ease-out",
  zoom: "slide-zoom 420ms ease-out",
  rotate: "slide-rotate 420ms ease-out",
  flip: "slide-flip 520ms ease-out",
};

function normalizeFractionMarkers(value: string): string {
  return value
    .replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, (_m, num, den) => `[[FRAC:${num.trim()}:${den.trim()}]]`)
    .replace(/\(([^()]+)\)\s*\/\s*(\d+)/g, (_m, num, den) => `[[FRAC:${num.trim()}:${den}]]`)
    .replace(/(\d+)\s*\/\s*(\d+)/g, (_m, num, den) => `[[FRAC:${num}:${den}]]`);
}

function renderFractionText(text: string): ReactNode {
  const normalized = normalizeFractionMarkers(text || "");
  const parts = normalized.split(/(\[\[FRAC:[^:\]]+:[^\]]+\]\])/g).filter(Boolean);

  return parts.map((part, index) => {
    const match = part.match(/^\[\[FRAC:([^:\]]+):([^\]]+)\]\]$/);
    if (!match) {
      return <Fragment key={`txt-${index}`}>{part}</Fragment>;
    }
    const num = match[1];
    const den = match[2];
    return (
      <span
        key={`frac-${index}`}
        className="fraction"
        style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
          verticalAlign: "middle",
          transform: "translateY(0.08em)",
        }}
      >
        <span
          className="frac-num"
          style={{ fontSize: "0.8em", lineHeight: 1, whiteSpace: "nowrap" }}
        >
          {num}
        </span>
        <span
          className="frac-line"
          style={{ width: "100%", height: "1px", background: "currentColor", margin: "1px 0" }}
        />
        <span
          className="frac-den"
          style={{ fontSize: "0.8em", lineHeight: 1, whiteSpace: "nowrap" }}
        >
          {den}
        </span>
      </span>
    );
  });
}

export function AnimatedSlide({
  slide,
  theme,
  slideNumber,
  totalSlides,
  animationKey,
}: {
  slide: Slide;
  theme: SlideTheme;
  slideNumber: number;
  totalSlides: number;
  animationKey?: string;
  isNarrating?: boolean;
  narrationProgress?: number;
}) {
  const transition = (slide.transition ?? "fade") as SlideTransition;
  const transitionAnimation =
    transitionClassMap[transition] ?? transitionClassMap.fade;

  return (
    <div key={animationKey} className="w-full h-full flex items-center justify-center" style={{ animation: transitionAnimation }}>
      <style>{`
        @keyframes slide-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-push-left {
          from { opacity: 0; transform: translateX(36px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slide-push-up {
          from { opacity: 0; transform: translateY(36px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-zoom {
          from { opacity: 0; transform: scale(0.94); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slide-rotate {
          from { opacity: 0; transform: rotate(-2deg) scale(0.98); transform-origin: center; }
          to { opacity: 1; transform: rotate(0deg) scale(1); transform-origin: center; }
        }
        @keyframes slide-flip {
          from { opacity: 0; transform: perspective(1000px) rotateY(14deg); transform-origin: center; }
          to { opacity: 1; transform: perspective(1000px) rotateY(0deg); transform-origin: center; }
        }
      `}</style>
      <SlideRenderer
        slide={slide}
        theme={theme}
        slideNumber={slideNumber}
        totalSlides={totalSlides}
        isFullscreen
        renderFraction={renderFractionText}
      />
    </div>
  );
}
