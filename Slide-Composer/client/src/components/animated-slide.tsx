import type { Slide } from "@shared/schema";

interface AnimatedSlideProps {
  slide: Slide;
  theme: any;
  slideNumber: number;
  totalSlides: number;
  animationKey: string;
  isNarrating?: boolean;
  narrationProgress?: number;
}

export function AnimatedSlide({
  slide,
  theme,
  slideNumber,
  totalSlides,
  animationKey,
  isNarrating,
  narrationProgress
}: AnimatedSlideProps) {

  return (
    <div
      key={animationKey}
      className="w-full h-full flex flex-col items-center justify-center text-center px-10 transition-all duration-500"
    >
      {/* Slide Title */}
      <h2 className="text-3xl font-bold mb-6">
        {slide.title}
      </h2>

      {/* Slide Content */}
      <div className="space-y-3 max-w-4xl">

        {slide.content.map((item, i) => {

          /* Subheading */
          if (item.startsWith("__SUBHEADING__")) {
            return (
              <h3
                key={i}
                className="text-xl font-semibold mt-4"
              >
                {item.replace("__SUBHEADING__", "")}
              </h3>
            );
          }

          /* Main Bullet */
          if (item.startsWith("__BULLET__")) {
            return (
              <div key={i} className="flex items-start gap-2 justify-center">
                <span className="mt-1">•</span>
                <span>{item.replace("__BULLET__", "")}</span>
              </div>
            );
          }

          /* Sub Bullet */
          if (item.startsWith("__SUBBULLET__")) {
            return (
              <div key={i} className="flex items-start gap-2 justify-center ml-6 text-sm">
                <span className="mt-1">◦</span>
                <span>{item.replace("__SUBBULLET__", "")}</span>
              </div>
            );
          }

          /* Table Row */
          if (slide.type === "table") {
            const cells = item.split(" | ");
            return (
              <div key={i} className="flex justify-center gap-8 border-b py-1">
                {cells.map((cell, cIndex) => (
                  <div key={cIndex} className="min-w-[100px]">
                    {cell}
                  </div>
                ))}
              </div>
            );
          }

          /* Paragraph */
          return (
            <p key={i}>
              {item}
            </p>
          );
        })}
      </div>

      {/* Footer Slide Counter */}
      <div className="mt-10 text-sm opacity-60">
        {slideNumber} / {totalSlides}
      </div>

    </div>
  );
}