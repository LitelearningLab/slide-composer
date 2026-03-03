import { type Slide, type SlideTheme } from "@shared/schema";
import {
  SlideLayout,
  MediaContentRenderer,
  ContentSlideRenderer,
  TitleSlideRenderer,
  QuoteSlideRenderer,
} from "./slide-layout";

interface SlideRendererProps {
  slide: Slide;
  theme: SlideTheme;
  slideNumber: number;
  totalSlides: number;
  isFullscreen?: boolean;
  renderFraction?: (text: string) => React.ReactNode;
}

/**
 * Unified slide renderer used for presentation viewing
 * Uses shared layout components to ensure consistency with editing and HTML export
 */
export function SlideRenderer({
  slide,
  theme,
  slideNumber,
  totalSlides,
  isFullscreen = false,
  renderFraction,
}: SlideRendererProps) {


  return (
    <SlideLayout
      slide={slide}
      theme={theme}
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      isFullscreen={isFullscreen}
    >
      {slide.type === "title" ? (
        <TitleSlideRenderer
          slide={slide}
          theme={theme}
          content={slide.content}
          renderFraction={renderFraction}
        />
      ) : slide.type === "quote" ? (
        <QuoteSlideRenderer
          slide={slide}
          theme={theme}
          content={slide.content}
          renderFraction={renderFraction}
        />
      ) : slide.type === "media" || slide.imageUrl || slide.videoUrl ? (
        <MediaContentRenderer
          slide={slide}
          theme={theme}
          content={slide.content}
          renderFraction={renderFraction}
        />
      ) : (
        <ContentSlideRenderer
          slide={slide}
          theme={theme}
          content={slide.content}
          renderFraction={renderFraction}
        />
      )}
    </SlideLayout>
  );
}
