import { type Slide, type SlideTheme } from "@shared/schema";
import { themeConfigs } from "./slide-theme-card";

interface SlideThumbnailProps {
  slide: Slide;
  theme: SlideTheme;
  slideNumber: number;
  isActive: boolean;
  onClick: () => void;
}

export function SlideThumbnail({
  slide,
  theme,
  slideNumber,
  isActive,
  onClick,
}: SlideThumbnailProps) {
  const config = themeConfigs[theme];

  return (
    <div
      className={`cursor-pointer transition-all hover-elevate ${
        isActive
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
          : ""
      }`}
      onClick={onClick}
      data-testid={`thumbnail-slide-${slideNumber}`}
    >
      <div className="relative">
        <div
          className={`aspect-video bg-gradient-to-br ${config.bgGradient} p-3 rounded-lg overflow-hidden`}
        >
          {slide.type === "title" ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className={`w-8 h-0.5 ${config.accentColor} mb-1.5 rounded-full`} />
              <div
                className={`text-[8px] sm:text-[10px] font-bold ${config.textColor} line-clamp-2 leading-tight`}
              >
                {slide.title}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <div className={`w-6 h-0.5 ${config.accentColor} mb-1 rounded-full`} />
              <div
                className={`text-[7px] sm:text-[8px] font-semibold ${config.textColor} line-clamp-1 mb-1`}
              >
                {slide.title}
              </div>
              <div className="space-y-0.5 flex-1 overflow-hidden">
                {slide.content.slice(0, 3).map((_, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div
                      className={`w-1 h-1 rounded-full ${config.accentColor} flex-shrink-0`}
                    />
                    <div
                      className={`h-1 rounded ${
                        config.textColor === "text-white"
                          ? "bg-white/30"
                          : "bg-gray-900/30 dark:bg-white/30"
                      }`}
                      style={{ width: `${60 + Math.random() * 30}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground border border-border">
          {slideNumber}
        </div>
      </div>
    </div>
  );
}
