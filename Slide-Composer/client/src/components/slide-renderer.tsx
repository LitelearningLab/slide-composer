import { type Slide, type SlideTheme } from "@shared/schema";
import { themeConfigs } from "./slide-theme-card";

interface SlideRendererProps {
  slide: Slide;
  theme: SlideTheme;
  slideNumber: number;
  totalSlides: number;
  isFullscreen?: boolean;
}

export function SlideRenderer({
  slide,
  theme,
  slideNumber,
  totalSlides,
  isFullscreen = false,
}: SlideRendererProps) {
  const config = themeConfigs[theme];

  const containerClass = isFullscreen
    ? "w-full h-full"
    : "aspect-video w-full";

  return (
    <div
      className={`${containerClass} bg-gradient-to-br ${config.bgGradient} p-6 sm:p-8 md:p-12 flex flex-col justify-between relative overflow-hidden rounded-lg shadow-xl`}
      data-testid={`slide-${slideNumber}`}
    >
      <div
        className={`absolute top-0 right-0 w-64 h-64 ${config.accentColor} opacity-10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl`}
      />
      <div
        className={`absolute bottom-0 left-0 w-48 h-48 ${config.accentColor} opacity-5 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl`}
      />

      <div className="relative z-10 flex-1 flex flex-col justify-center">
        {slide.type === "title" ? (
          <div className="text-center space-y-4 sm:space-y-6">
            <div className={`w-16 sm:w-24 h-1 ${config.accentColor} mx-auto rounded-full`} />
            <h1
              className={`text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold ${config.textColor} leading-tight`}
            >
              {slide.title}
            </h1>
            {slide.content.length > 0 && (
              <p
                className={`text-base sm:text-lg md:text-xl ${config.textColor} opacity-80 max-w-2xl mx-auto`}
              >
                {slide.content[0]}
              </p>
            )}
          </div>
        ) : slide.type === "quote" ? (
          <div className="max-w-3xl mx-auto text-center space-y-4 sm:space-y-6">
            <div className={`text-4xl sm:text-6xl ${config.textColor} opacity-30`}>"</div>
            <blockquote
              className={`text-xl sm:text-2xl md:text-3xl ${config.textColor} italic leading-relaxed`}
            >
              {slide.title}
            </blockquote>
            {slide.content.length > 0 && (
              <cite className={`block text-base sm:text-lg ${config.textColor} opacity-70`}>
                — {slide.content[0]}
              </cite>
            )}
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <div className={`w-12 sm:w-16 h-1 ${config.accentColor} rounded-full`} />
              <h2
                className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold ${config.textColor}`}
              >
                {slide.title}
              </h2>
            </div>
            <ul className="space-y-2 sm:space-y-3 md:space-y-4">
              {slide.content.map((item, index) => (
                <li
                  key={index}
                  className={`flex items-start gap-3 ${config.textColor} text-sm sm:text-base md:text-lg lg:text-xl`}
                >
                  <span
                    className={`mt-2 w-2 h-2 rounded-full ${config.accentColor} flex-shrink-0`}
                  />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="relative z-10 flex justify-between items-center pt-4 sm:pt-6">
        <div className={`text-xs sm:text-sm ${config.textColor} opacity-50`}>
          Slide {slideNumber} of {totalSlides}
        </div>
        <div className="flex gap-1">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-all ${
                i + 1 === slideNumber
                  ? config.accentColor
                  : `${config.textColor === 'text-white' ? 'bg-white/20' : 'bg-gray-900/20 dark:bg-white/20'}`
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
