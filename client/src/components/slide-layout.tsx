import { type Slide, type SlideTheme } from "@shared/schema";
import { themeConfigs } from "./slide-theme-card";
import { Fragment, type ReactNode } from "react";

interface SlideLayoutProps {
  slide: Slide;
  theme: SlideTheme;
  slideNumber: number;
  totalSlides: number;
  isFullscreen?: boolean;
  children?: React.ReactNode;
}

type ExportLineType = "subheading" | "bullet" | "paragraph";

function parseContentLine(raw: string): { type: ExportLineType; content: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("##SUB:")) {
    return { type: "subheading", content: trimmed.substring(6).trim() };
  }

  const subheadingMatch = trimmed.match(/^\*\*(.+)\*\*$/);
  if (subheadingMatch) {
    return { type: "subheading", content: subheadingMatch[1].trim() };
  }

  if (trimmed.startsWith("* ")) {
    return { type: "bullet", content: trimmed.substring(2).trim() };
  }

  return { type: "paragraph", content: trimmed };
}

function normalizeSlideTitle(title: string): string {
  return title.trim().replace(/^##\s+/, "");
}

function normalizeFractionMarkers(value: string): string {
  return value
    .replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, (_m, num, den) => `[[FRAC:${num.trim()}:${den.trim()}]]`)
    .replace(/\(([^()]+)\)\s*\/\s*(\d+)/g, (_m, num, den) => `[[FRAC:${num.trim()}:${den}]]`)
    .replace(/(\d+)\s*\/\s*(\d+)/g, (_m, num, den) => `[[FRAC:${num}:${den}]]`);
}

function renderDefaultFractionText(text: string): ReactNode {
  const normalized = normalizeFractionMarkers(text || "");
  const parts = normalized.split(/(\[\[FRAC:[^:\]]+:[^\]]+\]\])/g).filter(Boolean);
  return parts.map((part, index) => {
    const match = part.match(/^\[\[FRAC:([^:\]]+):([^\]]+)\]\]$/);
    if (!match) return <Fragment key={`txt-${index}`}>{part}</Fragment>;
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
          margin: "0 0.12em",
        }}
      >
        <span className="frac-num" style={{ fontSize: "0.8em", lineHeight: 1, whiteSpace: "nowrap" }}>
          {num}
        </span>
        <span className="frac-line" style={{ width: "100%", height: "1px", background: "currentColor", margin: "1px 0" }} />
        <span className="frac-den" style={{ fontSize: "0.8em", lineHeight: 1, whiteSpace: "nowrap" }}>
          {den}
        </span>
      </span>
    );
  });
}

function renderWithFraction(text: string, renderFraction?: (text: string) => ReactNode): ReactNode {
  return renderFraction ? renderFraction(text) : renderDefaultFractionText(text);
}

export function SlideLayout({
  slide,
  theme,
  slideNumber,
  totalSlides,
  isFullscreen = false,
  children,
}: SlideLayoutProps) {
  const config = themeConfigs[theme];

  const containerClass = isFullscreen
    ? "w-[90vw] max-w-[500px] h-[85vh] sm:w-[80vw] sm:max-w-[700px] lg:w-[75vw] lg:max-w-[1400px] lg:h-[80vh] 2xl:w-[70vw] mx-auto"
    : "aspect-video w-full";

  const shellClass = isFullscreen
    ? "rounded-xl lg:rounded-2xl shadow-[0_25px_80px_rgba(0,0,0,0.5)] p-6 sm:p-8 lg:p-12 pb-12 lg:pb-16"
    : "rounded-lg shadow-xl p-6 sm:p-8 md:p-12";

  return (
    <div
      className={`${containerClass} ${shellClass} bg-gradient-to-br ${config.bgGradient} flex flex-col justify-between relative overflow-hidden`}
    >
      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto flex flex-col justify-start">
        {children}
      </div>

      {!isFullscreen && (
        <div className="relative z-10 flex justify-between items-center pt-6">
          <div className={`text-sm ${config.textColor} opacity-50`}>
            Slide {slideNumber} of {totalSlides}
          </div>
        </div>
      )}
    </div>
  );
}

interface ContentSlideProps {
  slide: Slide;
  theme: SlideTheme;
  content: string[];
  renderFraction?: (text: string) => React.ReactNode;
}

export function ContentSlideRenderer({
  slide,
  theme,
  content,
  renderFraction,
}: ContentSlideProps) {
  const config = themeConfigs[theme];
  const lines = content
    .map(parseContentLine)
    .filter((line): line is { type: ExportLineType; content: string } => !!line);
  const subheadingIndices = lines.reduce<number[]>((acc, line, index) => {
    if (line.type === "subheading") acc.push(index);
    return acc;
  }, []);
  const useTwoColumnLayout =
    subheadingIndices.length >= 2 &&
    (slide.title.toLowerCase().includes("two content") ||
      slide.title.toLowerCase().includes("comparison"));
  const splitIndex = useTwoColumnLayout ? subheadingIndices[1] : -1;

  const renderLine = (line: { type: ExportLineType; content: string }, index: number) => {
    if (line.type === "subheading") {
      return (
        <div key={index} className={`text-xl font-semibold ${config.textColor} opacity-90`}>
          {renderWithFraction(line.content, renderFraction)}
        </div>
      );
    }

    if (line.type === "bullet") {
      return (
        <div key={index} className={`flex items-start gap-3 ${config.textColor}`}>
          <span className={`mt-2 w-2 h-2 rounded-full ${config.accentColor}`} />
          <span className="text-lg leading-relaxed">
            {renderWithFraction(line.content, renderFraction)}
          </span>
        </div>
      );
    }

    return (
      <p key={index} className={`text-lg leading-relaxed ${config.textColor} opacity-90`}>
        {renderWithFraction(line.content, renderFraction)}
      </p>
    );
  };

  return (
    <div className="w-full">
      <div className="space-y-2">
        <div className={`w-16 h-1 ${config.accentColor} rounded-full`} />
        <h2 className={`text-3xl font-bold ${config.textColor}`}>
          {renderWithFraction(normalizeSlideTitle(slide.title), renderFraction)}
        </h2>
      </div>

      {useTwoColumnLayout ? (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            {lines
              .map((line, index) => (index < splitIndex ? renderLine(line, index) : null))}
          </div>
          <div className="space-y-4">
            {lines
              .map((line, index) => (index >= splitIndex ? renderLine(line, index) : null))}
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-4">{lines.map((line, index) => renderLine(line, index))}</div>
      )}
    </div>
  );
}

interface TitleSlideProps {
  slide: Slide;
  theme: SlideTheme;
  content: string[];
  renderFraction?: (text: string) => React.ReactNode;
}

export function TitleSlideRenderer({
  slide,
  theme,
  content,
  renderFraction,
}: TitleSlideProps) {
  const config = themeConfigs[theme];

  return (
    <div className="text-center space-y-6 w-full">
      <div className={`w-24 h-1 ${config.accentColor} mx-auto rounded-full`} />
      <h1 className={`text-5xl font-bold ${config.textColor}`}>
        {renderWithFraction(slide.title, renderFraction)}
      </h1>
      {content[0] && (
        <p className={`text-xl ${config.textColor} opacity-80`}>
          {renderWithFraction(content[0], renderFraction)}
        </p>
      )}
    </div>
  );
}

interface QuoteSlideProps {
  slide: Slide;
  theme: SlideTheme;
  content: string[];
  renderFraction?: (text: string) => React.ReactNode;
}

export function QuoteSlideRenderer({
  slide,
  theme,
  content,
  renderFraction,
}: QuoteSlideProps) {
  const config = themeConfigs[theme];

  return (
    <div className="text-center space-y-6 w-full max-w-4xl mx-auto">
      <div className={`text-6xl leading-none ${config.textColor} opacity-20`}>"</div>
      <blockquote className={`text-3xl md:text-4xl font-semibold ${config.textColor} leading-snug`}>
        {renderWithFraction(slide.title, renderFraction)}
      </blockquote>
      {content[0] && (
        <p className={`text-lg ${config.textColor} opacity-80`}>
          {renderWithFraction(content[0], renderFraction)}
        </p>
      )}
    </div>
  );
}

interface MediaSlideProps {
  slide: Slide;
  theme: SlideTheme;
  content: string[];
  renderFraction?: (text: string) => React.ReactNode;
}

export function MediaContentRenderer({
  slide,
  theme,
  content,
  renderFraction,
}: MediaSlideProps) {
  const config = themeConfigs[theme];
  const mediaAlignment = slide.mediaAlignment || "right";
  const contentAlignment = slide.contentAlignment || "left";

  const mediaNode = slide.videoUrl ? (
    <video
      src={slide.videoUrl}
      className="w-full h-64 md:h-80 object-cover rounded-lg border border-white/20"
      controls
    />
  ) : slide.embedHtml ? (
    <iframe
      srcDoc={slide.embedHtml}
      title="Embedded HTML"
      className="w-full h-64 md:h-80 rounded-lg border border-white/20 bg-white"
      sandbox="allow-same-origin allow-scripts"
    />
  ) : slide.embedUrl ? (
    <iframe
      src={slide.embedUrl}
      title="Embedded Content"
      className="w-full h-64 md:h-80 rounded-lg border border-white/20 bg-white"
      sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
    />
  ) : slide.imageUrl ? (
    <img
      src={slide.imageUrl}
      alt="Slide media"
      className="w-full h-64 md:h-80 object-cover rounded-lg border border-white/20"
    />
  ) : null;

  const lines = content
    .map(parseContentLine)
    .filter((line): line is { type: ExportLineType; content: string } => !!line);

  const headingNode = (
    <div className="space-y-2">
      <div className={`w-16 h-1 ${config.accentColor} rounded-full`} />
      <h2 className={`text-3xl font-bold ${config.textColor}`}>
        {renderWithFraction(normalizeSlideTitle(slide.title), renderFraction)}
      </h2>
    </div>
  );

  const contentNode = (
    <div className="space-y-4">
      <div
        className={`space-y-2 ${config.textColor}`}
        style={{
          textAlign:
            mediaAlignment === "left" || mediaAlignment === "right"
              ? "left"
              : (contentAlignment as "left" | "center" | "right"),
        }}
      >
        {lines.map((line, index) => {
          if (line.type === "subheading") {
            return (
              <div key={index} className="text-xl font-semibold opacity-90">
                {renderWithFraction(line.content, renderFraction)}
              </div>
            );
          }
          if (line.type === "bullet") {
            return (
              <div key={index} className="flex items-start gap-3">
                <span className={`mt-2 w-2 h-2 rounded-full ${config.accentColor}`} />
                <span className="text-lg leading-relaxed opacity-90">
                  {renderWithFraction(line.content, renderFraction)}
                </span>
              </div>
            );
          }
          return (
            <p key={index} className="text-lg leading-relaxed opacity-90">
              {renderWithFraction(line.content, renderFraction)}
            </p>
          );
        })}
      </div>
    </div>
  );

  if (!mediaNode) {
    return (
      <ContentSlideRenderer
        slide={slide}
        theme={theme}
        content={content}
        renderFraction={renderFraction}
      />
    );
  }

  if (mediaAlignment === "full") {
    return (
      <div className="space-y-6 w-full">
        {headingNode}
        {mediaNode}
        {contentNode}
      </div>
    );
  }

  if (mediaAlignment === "center") {
    return (
      <div className="space-y-6 w-full text-center">
        {headingNode}
        <div className="max-w-2xl mx-auto">{mediaNode}</div>
        {contentNode}
      </div>
    );
  }

  const isLeft = mediaAlignment === "left";
  return (
    <div className="space-y-6 w-full">
      {headingNode}
      <div className="md:hidden">{mediaNode}</div>
      <div className="md:hidden">{contentNode}</div>
      <div className="hidden md:grid md:grid-cols-2 gap-6 items-start w-full">
        <div className={isLeft ? "md:order-1" : "md:order-2"}>{mediaNode}</div>
        <div className={isLeft ? "md:order-2" : "md:order-1"}>{contentNode}</div>
      </div>
    </div>
  );
}
