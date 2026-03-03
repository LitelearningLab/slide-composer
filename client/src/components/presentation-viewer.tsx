import { useState, useEffect, useCallback, useRef } from "react";
import { type Presentation } from "@shared/schema";
import { AnimatedSlide } from "./animated-slide";
import { PresentationChat } from "./presentation-chat";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Settings,
  Volume2,
  VolumeX,
  Loader2,
  Download,
  MessageCircle,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";

interface PresentationViewerProps {
  presentation: Presentation;
  onClose: () => void;
  hideCloseButton?: boolean;
}

export function PresentationViewer({
  presentation,
  onClose,
  hideCloseButton = false,
}: PresentationViewerProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [slideInterval, setSlideInterval] = useState(5);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [animationKey, setAnimationKey] = useState(`${Date.now()}-0`);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isNarrating, setIsNarrating] = useState(false);
  const [narrationProgress, setNarrationProgress] = useState(0);
  const slideBeforeChatRef = useRef<number | null>(null);
  const wasPlayingBeforeChatRef = useRef<boolean>(false);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const lastNarratedSlideRef = useRef<number>(-1);
  const narrationTokenRef = useRef<number>(0);

  const goToNextSlide = useCallback(() => {
    setCurrentSlide((prev) => {
      const next = prev < presentation.slides.length - 1 ? prev + 1 : prev;
      if (next !== prev) {
        setAnimationKey(`${Date.now()}-${next}`);
      }
      return next;
    });
  }, [presentation.slides.length]);

  const goToPrevSlide = useCallback(() => {
    setCurrentSlide((prev) => {
      const next = prev > 0 ? prev - 1 : prev;
      if (next !== prev) {
        setAnimationKey(`${Date.now()}-${next}`);
      }
      return next;
    });
  }, []);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index);
    setAnimationKey(`${Date.now()}-${index}`);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const downloadAsHtml = useCallback(() => {
    const themeStyles: Record<string, { bg: string; text: string; accent: string }> = {
      modern: { bg: "linear-gradient(135deg, #0f172a, #1e293b)", text: "#ffffff", accent: "#3b82f6" },
      corporate: { bg: "linear-gradient(135deg, #1e3a8a, #1e40af)", text: "#ffffff", accent: "#fbbf24" },
      creative: { bg: "linear-gradient(135deg, #9333ea, #ec4899)", text: "#ffffff", accent: "#fde047" },
      minimal: { bg: "linear-gradient(135deg, #f3f4f6, #ffffff)", text: "#111827", accent: "#111827" },
      bold: { bg: "linear-gradient(135deg, #ea580c, #dc2626)", text: "#ffffff", accent: "#ffffff" },
      elegant: { bg: "linear-gradient(135deg, #064e3b, #0f766e)", text: "#ffffff", accent: "#fcd34d" },
    };
    const style = themeStyles[presentation.theme] || themeStyles.modern;

    // Helper function to render text with inline fractions and safe inline formatting.
    // Supports:
    // - [[FRAC:num:den]] markers
    // - <strong>/<em>
    // - <span style="color: ...">
    const renderContentWithFractions = (text: string): string => {
      const normalizeFractionMarkers = (value: string): string =>
        value
          .replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, (_m, num, den) => `[[FRAC:${num.trim()}:${den.trim()}]]`)
          .replace(/\(([^()]+)\)\s*\/\s*(\d+)/g, (_m, num, den) => `[[FRAC:${num.trim()}:${den}]]`)
          .replace(/(\d+)\s*\/\s*(\d+)/g, (_m, num, den) => `[[FRAC:${num}:${den}]]`);

      const fractionHtmlFromMarker = (num: string, den: string) =>
        `<span class="fraction"><span class="frac-num">${num}</span><span class="frac-line"></span><span class="frac-den">${den}</span></span>`;

      const withFractionHtml = normalizeFractionMarkers(text).replace(
        /\[\[FRAC:([^:]+):([^\]]+)\]\]/g,
        (_m, num, den) => fractionHtmlFromMarker(num, den),
      );

      const root = document.createElement("div");
      root.innerHTML = withFractionHtml;

      const escapeHtml = (value: string) =>
        value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

      const escapeAttr = (value: string) =>
        value
          .replace(/&/g, "&amp;")
          .replace(/"/g, "&quot;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

      const normalizeFractionFromSpan = (el: HTMLElement): string | null => {
        const classes = el.className || "";
        const isExportFraction = /\bfraction\b/.test(classes);
        const isEditorFraction =
          /\binline-flex\b/.test(classes) && /\bflex-col\b/.test(classes);

        if (!isExportFraction && !isEditorFraction) {
          return null;
        }

        if (isExportFraction) {
          const num = el.querySelector(".frac-num")?.textContent?.trim() ?? "";
          const den = el.querySelector(".frac-den")?.textContent?.trim() ?? "";
          if (!num || !den) return null;
          return fractionHtmlFromMarker(escapeHtml(num), escapeHtml(den));
        }

        const parts = Array.from(el.children);
        if (parts.length < 3) return null;
        const num = parts[0]?.textContent?.trim() ?? "";
        const den = parts[2]?.textContent?.trim() ?? "";
        if (!num || !den) return null;
        return fractionHtmlFromMarker(escapeHtml(num), escapeHtml(den));
      };

      const serializeInline = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) {
          return escapeHtml(node.textContent ?? "");
        }
        if (node.nodeType !== Node.ELEMENT_NODE) {
          return "";
        }

        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();
        const children = Array.from(el.childNodes).map(serializeInline).join("");

        if (tag === "br") return "<br>";

        if (tag === "strong" || tag === "b") {
          return `<strong>${children}</strong>`;
        }

        if (tag === "em" || tag === "i") {
          return `<em>${children}</em>`;
        }

        if (tag === "span" || tag === "font") {
          const fraction = normalizeFractionFromSpan(el);
          if (fraction) {
            return fraction;
          }

          const fontSizeFromFontTag = (fontEl: HTMLElement) => {
            const size = fontEl.getAttribute("size");
            const sizeMap: Record<string, string> = {
              "1": "70%",
              "2": "80%",
              "3": "100%",
              "4": "120%",
              "5": "150%",
              "6": "180%",
              "7": "220%",
            };
            return size ? sizeMap[size] || "" : "";
          };

          const color =
            (el as HTMLElement).style.color ||
            (tag === "font" ? el.getAttribute("color") || "" : "");
          const fontSize =
            (el as HTMLElement).style.fontSize ||
            (tag === "font" ? fontSizeFromFontTag(el) : "");
          const fontFamily =
            (el as HTMLElement).style.fontFamily ||
            (tag === "font" ? el.getAttribute("face") || "" : "");

          if (color || fontSize || fontFamily) {
            const styleRules: string[] = [];
            if (color) {
              styleRules.push(`color:${escapeAttr(color)}`);
            }
            if (fontSize) {
              styleRules.push(`font-size:${escapeAttr(fontSize)}`);
            }
            if (fontFamily) {
              styleRules.push(`font-family:${escapeAttr(fontFamily)}`);
            }
            return `<span style="${styleRules.join(";")};">${children}</span>`;
          }
        }

        return children;
      };

      return Array.from(root.childNodes)
        .map(serializeInline)
        .join("")
        .replace(/\u2192/g, `<span class="inline-arrow">&#8594;</span>`);
    };

    type ExportLineType = "subheading" | "bullet" | "paragraph";

    const parseExportLine = (
      raw: string,
    ): { type: ExportLineType; content: string } | null => {
      const trimmed = raw.trim();
      if (!trimmed) {
        return null;
      }

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
    };

    const normalizeSlideTitle = (title: string): string =>
      title.trim().replace(/^##\s+/, "");

    const renderStructuredContent = (
      items: string[],
      textAlign: "left" | "center" | "right" = "left",
    ): string => {
      const blocks = items
        .map((raw) => {
          const parsed = parseExportLine(raw);
          if (!parsed) {
            return "";
          }

          const content = renderContentWithFractions(parsed.content);
          if (parsed.type === "subheading") {
            return `<div class="subheading-item">${content}</div>`;
          }

          if (parsed.type === "bullet") {
            const fractionOnly = /^\s*\[\[FRAC:[^:\]]+:[^\]]+\]\]\s*$/.test(parsed.content);
            return `<div class="bullet-item${fractionOnly ? " fraction-only" : ""}"><span class="bullet-dot" style="background:${style.accent};"></span><span>${content}</span></div>`;
          }

          return `<p class="paragraph-item">${content}</p>`;
        })
        .join("");

      return `<div class="content-blocks" style="text-align:${textAlign};">${blocks}</div>`;
    };

    const slidesHtml = presentation.slides.map((slide, i) => {
      let contentHtml = "";
      const title = renderContentWithFractions(normalizeSlideTitle(slide.title));
      const contentBlocks = renderStructuredContent(slide.content);

      if (slide.type === "title") {
        const subtitle = parseExportLine(slide.content[0] ?? "");
        contentHtml = `
          <div style="text-align:center;">
            <div class="accent-bar" style="background:${style.accent};margin:0 auto 1.5rem;"></div>
            <h1 class="title-text">${title}</h1>
            ${subtitle ? `<p class="subtitle-text" style="opacity:0.8;">${renderContentWithFractions(subtitle.content)}</p>` : ""}
          </div>`;
      } else if (slide.type === "quote") {
        const cite = parseExportLine(slide.content[0] ?? "");
        contentHtml = `
          <div style="text-align:center;max-width:800px;margin:0 auto;">
            <div class="quote-mark" style="opacity:0.3;">"</div>
            <blockquote class="quote-text" style="font-style:italic;margin:1rem 0;">${title}</blockquote>
            ${cite ? `<cite class="cite-text" style="opacity:0.7;">â€” ${renderContentWithFractions(cite.content)}</cite>` : ""}
          </div>`;
      } else if (slide.type === "table") {
        const rows = slide.content.map((row, ri) => {
          const cells = row.split(" | ");
          const cellTag = ri === 0 ? "th" : "td";
          const cellClass = ri === 0 ? "table-header" : "table-cell";
          return `<tr>${cells.map(c => `<${cellTag} class="${cellClass}">${renderContentWithFractions(c)}</${cellTag}>`).join("")}</tr>`;
        }).join("");
        contentHtml = `
          <div class="content-wrap">
            <div class="accent-bar" style="background:${style.accent};"></div>
            <h2 class="heading-text">${title}</h2>
            <div class="table-wrap"><table><tbody>${rows}</tbody></table></div>
          </div>`;
      } else if (slide.imageUrl || slide.videoUrl) {
        // Media slide with alignment
        const mediaAlignment = slide.mediaAlignment || "right";
        const contentAlignment = slide.contentAlignment || "left";
        const mediaHtml = slide.videoUrl
          ? `<video src="${slide.videoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" controls></video>`
          : slide.embedHtml
            ? `<iframe srcdoc="${slide.embedHtml.replace(/"/g, "&quot;")}" style="width:100%;height:100%;border:0;border-radius:8px;background:#fff;"></iframe>`
            : slide.embedUrl
              ? `<iframe src="${slide.embedUrl}" style="width:100%;height:100%;border:0;border-radius:8px;background:#fff;"></iframe>`
              : `<img src="${slide.imageUrl}" alt="Media" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`;

        const mediaContentBlocks = renderStructuredContent(
          slide.content,
          contentAlignment as "left" | "center" | "right",
        );

        if (mediaAlignment === "full") {
          contentHtml = `
            <div class="content-wrap">
              <div style="width:100%;height:300px;margin-bottom:1.5rem;">
                ${mediaHtml}
              </div>
              <div class="accent-bar" style="background:${style.accent};"></div>
              <h2 class="heading-text">${title}</h2>
              ${mediaContentBlocks}
            </div>`;
        } else if (mediaAlignment === "center") {
          contentHtml = `
            <div class="content-wrap" style="text-align:center;">
              <div style="width:100%;max-width:400px;height:300px;margin:0 auto 1.5rem;">
                ${mediaHtml}
              </div>
              <div class="accent-bar" style="background:${style.accent};margin:0 auto 0.75rem;"></div>
              <h2 class="heading-text">${title}</h2>
              ${mediaContentBlocks}
            </div>`;
        } else if (mediaAlignment === "left") {
          contentHtml = `
            <div class="content-wrap media-split media-left">
              <div class="media-heading">
                <div class="accent-bar" style="background:${style.accent};"></div>
                <h2 class="heading-text">${title}</h2>
              </div>
              <div class="media-box">
                ${mediaHtml}
              </div>
              <div class="media-text" style="text-align:${contentAlignment};">
                ${mediaContentBlocks}
              </div>
            </div>`;
        } else {
          // right alignment (default)
          contentHtml = `
            <div class="content-wrap media-split media-right">
              <div class="media-heading">
                <div class="accent-bar" style="background:${style.accent};"></div>
                <h2 class="heading-text">${title}</h2>
              </div>
              <div class="media-box">
                ${mediaHtml}
              </div>
              <div class="media-text" style="text-align:${contentAlignment};">
                ${mediaContentBlocks}
              </div>
            </div>`;
        }
      } else {
        contentHtml = `
          <div class="content-wrap">
            <div class="accent-bar" style="background:${style.accent};"></div>
            <h2 class="heading-text">${title}</h2>
            ${contentBlocks}
          </div>`;
      }
      return `<div class="slide" data-index="${i}" style="display:${i === 0 ? "flex" : "none"};background:${style.bg};color:${style.text};">
        <div class="slide-glow" style="background:${style.accent};"></div>
        <div class="slide-content">${contentHtml}</div>
      </div>`;
    }).join("\n");

    // Store slides data for video playback narration
    const slidesData = JSON.stringify(presentation.slides.map(s => ({
      title: s.title,
      content: s.content,
      type: s.type
    })));

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${presentation.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; width: 100%; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow: hidden; background: #111; display: flex; align-items: center; justify-content: center; }
    
    .slide { height: 85vh; height: 85dvh; width: 90%; max-width: 500px; margin: auto; padding: 1.5rem; padding-bottom: 2.75rem; flex-direction: column; justify-content: flex-start; align-items: center; position: relative; overflow: hidden; border-radius: 12px; box-shadow: 0 15px 50px rgba(0,0,0,0.4); }
    .slide-content { position: relative; z-index: 10; width: 100%; max-width: 100%; margin: 0 auto; flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; padding-right: 0.25rem; }
    .slide-content::-webkit-scrollbar { width: 6px; }
    .slide-content::-webkit-scrollbar-track { background: rgba(255,255,255,0.08); border-radius: 999px; }
    .slide-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.32); border-radius: 999px; }
    .slide-glow { position: absolute; top: 0; right: 0; width: 150px; height: 150px; opacity: 0.1; border-radius: 50%; transform: translate(50%, -50%); filter: blur(40px); }
    
    .accent-bar { width: 2.5rem; height: 4px; border-radius: 2px; margin-bottom: 0.75rem; }
    .title-text { font-size: 1.5rem; font-weight: bold; margin-bottom: 0.5rem; line-height: 1.2; }
    .subtitle-text { font-size: 0.9rem; }
    .heading-text { font-size: 1.25rem; font-weight: bold; margin-bottom: 0.75rem; line-height: 1.2; }
    .quote-mark { font-size: 2.5rem; }
    .quote-text { font-size: 1.1rem; line-height: 1.4; }
    .cite-text { font-size: 0.8rem; display: block; margin-top: 0.75rem; }
    
    .content-wrap { width: 100%; }
    .content-blocks { width: 100%; font-size: 0.9rem; }
    .subheading-item { font-weight: 700; margin: 0.65rem 0 0.35rem; font-size: 1rem; line-height: 1.4; }
    .paragraph-item { margin: 0 0 0.6rem; line-height: 1.5; }
    .bullet-list { list-style: none; padding: 0; font-size: 0.9rem; }
    .bullet-item { margin-bottom: 0.5rem; display: flex; align-items: flex-start; gap: 0.5rem; }
    .bullet-dot { width: 5px; height: 5px; border-radius: 50%; margin-top: 0.4rem; flex-shrink: 0; }
    .bullet-item.fraction-only { align-items: center; }
    .bullet-item.fraction-only .bullet-dot { margin-top: 0; }
    .inline-arrow { display: inline-block; position: relative; top: -0.05em; }
    
    .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    table { width: 100%; border-collapse: collapse; font-size: 0.75rem; min-width: 280px; }
    .table-header { padding: 6px 8px; text-align: left; font-weight: 600; border-bottom: 2px solid rgba(255,255,255,0.3); white-space: nowrap; }
    .table-cell { padding: 6px 8px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1); }
    
    /* Media styles */
    .media-split { display: flex; flex-direction: column; gap: 1rem; align-items: stretch; }
    .media-split .media-heading { order: 1; }
    .media-split .media-box { order: 2; width: 100%; height: 260px; }
    .media-split .media-text { order: 3; min-width: 0; }
    .media-split .media-box video,
    .media-split .media-box img { width: 100%; height: 100%; object-fit: cover; }
    video, img { border-radius: 8px; }
    
    /* Fraction styles - properly aligned with text baseline */
    .fraction { 
      display: inline-flex; 
      flex-direction: column; 
      align-items: center; 
      justify-content: center;
      vertical-align: middle; 
      margin: 0 0.15em; 
      font-size: 0.85em; 
      line-height: 1; 
      position: relative;
      top: 0;
      transform: translateY(0.08em);
      white-space: nowrap;
    }
    .bullet-item.fraction-only .fraction { transform: translateY(0); }
    .frac-num { 
      display: block; 
      text-align: center; 
      padding: 0 0.15em; 
      line-height: 1;
      margin-bottom: 0.05em;
    }
    .frac-den { 
      display: block; 
      text-align: center; 
      padding: 0 0.15em; 
      line-height: 1;
      margin-top: 0.05em;
    }
    .frac-line { 
      display: block; 
      width: 100%; 
      height: 1px; 
      background: currentColor; 
      margin: 0.08em 0; 
      min-width: 1.3em;
    }
    
    .controls { position: fixed; bottom: 8px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; z-index: 100; flex-wrap: wrap; justify-content: center; }
    .controls button { background: rgba(0,0,0,0.75); color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 0.75rem; backdrop-filter: blur(10px); touch-action: manipulation; }
    .controls button:hover { background: rgba(0,0,0,0.85); }
    .controls button:active { background: rgba(0,0,0,0.95); transform: scale(0.97); }
    .controls button:disabled { opacity: 0.35; cursor: not-allowed; }
    .controls button.playing { background: rgba(34, 197, 94, 0.8); }
    .slide-counter { background: rgba(0,0,0,0.65); color: white; padding: 8px 12px; border-radius: 6px; font-size: 0.75rem; display: flex; align-items: center; }
    .help { display: none; }
    
    /* Video mode - content animation */
    .animate-item { opacity: 0; transform: translateY(20px); transition: opacity 0.4s ease, transform 0.4s ease; }
    .animate-item.visible { opacity: 1; transform: translateY(0); }
    .highlight-word { transition: background 0.15s ease; border-radius: 3px; padding: 0 2px; margin: 0 -2px; }
    .highlight-word.speaking { background: rgba(255,255,255,0.25); }
    
    /* Loading indicator */
    .loading-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 200; }
    .loading-overlay.hidden { display: none; }
    .loading-spinner { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    
    /* Mobile landscape */
    @media (max-width: 767px) and (orientation: landscape) {
      .slide { width: 75%; max-width: 600px; height: 80vh; padding: 1rem 1.5rem 2.5rem; }
      .title-text { font-size: 1.3rem; }
      .heading-text { font-size: 1.1rem; }
      .bullet-list { font-size: 0.85rem; }
      .bullet-item { margin-bottom: 0.35rem; }
      .controls { bottom: 6px; }
    }
    
    /* Tablet */
    @media (min-width: 640px) {
      .slide { width: 80%; max-width: 700px; height: 85vh; padding: 2rem; padding-bottom: 3.25rem; border-radius: 14px; }
      .slide-glow { width: 250px; height: 250px; filter: blur(50px); }
      .accent-bar { width: 3.5rem; height: 5px; margin-bottom: 1rem; }
      .title-text { font-size: 2rem; }
      .subtitle-text { font-size: 1.1rem; }
      .heading-text { font-size: 1.6rem; margin-bottom: 1rem; }
      .quote-mark { font-size: 3.5rem; }
      .quote-text { font-size: 1.3rem; }
      .cite-text { font-size: 0.95rem; }
      .bullet-list { font-size: 1rem; }
      .bullet-item { margin-bottom: 0.6rem; gap: 0.6rem; }
      .bullet-dot { width: 6px; height: 6px; }
      table { font-size: 0.9rem; }
      .table-header, .table-cell { padding: 8px 12px; }
      .controls { gap: 8px; bottom: 12px; }
      .controls button { padding: 10px 16px; font-size: 0.85rem; }
      .slide-counter { padding: 10px 14px; font-size: 0.85rem; }
      .fraction { font-size: 0.9em; }
      .media-split { gap: 1.5rem; }
      .media-split .media-box { height: 300px; }
    }
    
    /* Desktop - 3/4 width centered */
    @media (min-width: 1024px) {
      body { background: #0a0a0a; }
      .slide { width: 75%; max-width: 1400px; height: 80vh; margin: auto; border-radius: 16px; box-shadow: 0 25px 80px rgba(0,0,0,0.5); padding: 3rem; padding-bottom: 4.25rem; }
      .slide-glow { width: 350px; height: 350px; filter: blur(70px); }
      .accent-bar { width: 5rem; height: 6px; margin-bottom: 1.5rem; }
      .title-text { font-size: 3rem; margin-bottom: 1rem; }
      .subtitle-text { font-size: 1.4rem; }
      .heading-text { font-size: 2.2rem; margin-bottom: 1.5rem; }
      .quote-mark { font-size: 4.5rem; }
      .quote-text { font-size: 1.8rem; }
      .cite-text { font-size: 1.1rem; }
      .bullet-list { font-size: 1.2rem; }
      .bullet-item { margin-bottom: 0.8rem; gap: 0.8rem; }
      .bullet-dot { width: 8px; height: 8px; }
      table { font-size: 1.1rem; }
      .table-header, .table-cell { padding: 12px 16px; }
      .controls { bottom: 20px; gap: 12px; }
      .controls button { padding: 12px 22px; font-size: 0.95rem; border-radius: 8px; }
      .slide-counter { padding: 12px 18px; font-size: 0.95rem; }
      .help { display: block; position: fixed; bottom: 20px; left: 20px; font-size: 0.7rem; color: rgba(255,255,255,0.4); background: rgba(0,0,0,0.4); padding: 8px 12px; border-radius: 6px; }
      .media-split { flex-direction: row; align-items: flex-start; }
      .media-split .media-heading { order: 1; flex-basis: 100%; }
      .media-split .media-text { flex: 1; order: 2; }
      .media-split .media-box { width: 40%; min-width: 200px; height: 300px; flex-shrink: 0; order: 3; }
      .media-split.media-left { flex-wrap: wrap; }
      .media-split.media-left .media-heading { order: 1; }
      .media-split.media-left .media-box { order: 2; }
      .media-split.media-left .media-text { order: 3; }
      .media-split.media-right { flex-wrap: wrap; }
      .media-split.media-right .media-heading { order: 1; }
      .media-split.media-right .media-text { order: 2; }
      .media-split.media-right .media-box { order: 3; }
    }
    
    /* Large desktop */
    @media (min-width: 1440px) {
      .slide { width: 70%; padding: 4rem; padding-bottom: 4.25rem; }
      .title-text { font-size: 3.5rem; }
      .heading-text { font-size: 2.5rem; }
      .bullet-list { font-size: 1.35rem; }
      table { font-size: 1.2rem; }
    }
  </style>
</head>
<body>
  ${slidesHtml}
  <div class="controls">
    <button id="prev">Prev</button>
    <div class="slide-counter"><span id="current">1</span> / ${presentation.slides.length}</div>
    <button id="next">Next</button>
    <button id="playVideo">Play as Video</button>
  </div>
  <div class="help">Use arrow keys or buttons to navigate | Press Escape to stop video</div>
  <script>
    const slidesData = ${slidesData};
    let current = 0;
    const slides = document.querySelectorAll('.slide');
    const total = slides.length;
    const prevBtn = document.getElementById('prev');
    const nextBtn = document.getElementById('next');
    const playVideoBtn = document.getElementById('playVideo');
    const counter = document.getElementById('current');
    
    let isVideoPlaying = false;
    let currentUtterance = null;
    let originalSlideContents = [];
    let lastVideoState = { slideIndex: 0, itemIndex: 0 };
    let playbackSession = 0;

    slides.forEach((s, i) => {
      originalSlideContents[i] = s.querySelector('.slide-content').innerHTML;
    });

    function showSlide(n, animated = false) {
      slides.forEach((s, i) => {
        s.style.display = i === n ? 'flex' : 'none';
        if (!animated && !isVideoPlaying) {
          s.querySelector('.slide-content').innerHTML = originalSlideContents[i];
        }
      });
      counter.textContent = n + 1;
      prevBtn.disabled = n === 0;
      nextBtn.disabled = n === total - 1;
    }

    function setContentInteractionLocked(locked) {
      slides.forEach((s) => {
        const contentEl = s.querySelector('.slide-content');
        if (!contentEl) return;
        contentEl.style.pointerEvents = locked ? 'none' : '';
        contentEl.style.userSelect = locked ? 'none' : '';
      });
    }

    function autoScrollToItem(contentEl, itemEl) {
      if (!contentEl || !itemEl) return;
      const itemTop = itemEl.offsetTop;
      const itemBottom = itemTop + itemEl.offsetHeight;
      const viewTop = contentEl.scrollTop;
      const viewBottom = viewTop + contentEl.clientHeight;
      const targetTop = Math.max(0, itemBottom - contentEl.clientHeight + 24);

      if (itemBottom > viewBottom - 8 || itemTop < viewTop) {
        contentEl.scrollTo({ top: targetTop, behavior: 'smooth' });
      }
    }

    function restartVideoFromCurrent() {
      if (!isVideoPlaying) return;
      playbackSession++;
      if (currentUtterance) {
        window.speechSynthesis.cancel();
        currentUtterance = null;
      }
      runVideoPlayback(playbackSession);
    }

    function next() {
      if (current < total - 1) {
        current++;
        showSlide(current, isVideoPlaying);
        restartVideoFromCurrent();
      }
    }

    function prev() {
      if (current > 0) {
        current--;
        showSlide(current, isVideoPlaying);
        restartVideoFromCurrent();
      }
    }

    prevBtn.onclick = prev;
    nextBtn.onclick = next;
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isVideoPlaying) { stopVideo(); return; }
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') prev();
    });

    let touchStartX = 0;
    document.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    document.addEventListener('touchend', e => {
      const diff = touchStartX - e.changedTouches[0].screenX;
      if (Math.abs(diff) > 50) { diff > 0 ? next() : prev(); }
    }, { passive: true });

    function parseLine(raw) {
      const trimmed = (raw || '').trim();
      if (!trimmed) return null;
      if (trimmed.startsWith('##SUB:')) {
        return { type: 'subheading', content: trimmed.substring(6).trim() };
      }
      const subMatch = trimmed.match(/^\\*\\*(.+)\\*\\*$/);
      if (subMatch) {
        return { type: 'subheading', content: subMatch[1].trim() };
      }
      if (trimmed.startsWith('* ')) {
        return { type: 'bullet', content: trimmed.substring(2).trim() };
      }
      return { type: 'paragraph', content: trimmed };
    }

    function sanitizeInlineHtml(raw) {
      const normalizeFractionMarkers = (value) => (value || '')
        .replace(/\\(([^()]+)\\)\\s*\\/\\s*\\(([^()]+)\\)/g, (_m, num, den) => '[[FRAC:' + num.trim() + ':' + den.trim() + ']]')
        .replace(/\\(([^()]+)\\)\\s*\\/\\s*(\\d+)/g, (_m, num, den) => '[[FRAC:' + num.trim() + ':' + den + ']]')
        .replace(/(\\d+)\\s*\\/\\s*(\\d+)/g, (_m, num, den) => '[[FRAC:' + num + ':' + den + ']]');

      const root = document.createElement('div');
      root.innerHTML = normalizeFractionMarkers(raw).replace(/\\[\\[FRAC:([^:]+):([^\\]]+)\\]\\]/g, (_m, num, den) =>
        '<span class="fraction"><span class="frac-num">' + num + '</span><span class="frac-line"></span><span class="frac-den">' + den + '</span></span>'
      );

      const walk = (node) => {
        if (node.nodeType === Node.TEXT_NODE) return;
        if (node.nodeType !== Node.ELEMENT_NODE) {
          node.parentNode && node.parentNode.removeChild(node);
          return;
        }
        const el = node;
        const tag = el.tagName.toLowerCase();
        const className = el.className || '';
        const isFraction = /\\bfraction\\b/.test(className) || (/\\binline-flex\\b/.test(className) && /\\bflex-col\\b/.test(className));

        if (tag === 'b') {
          const strong = document.createElement('strong');
          strong.innerHTML = el.innerHTML;
          el.replaceWith(strong);
          walk(strong);
          return;
        }
        if (tag === 'i') {
          const em = document.createElement('em');
          em.innerHTML = el.innerHTML;
          el.replaceWith(em);
          walk(em);
          return;
        }
        if (tag === 'font') {
          const span = document.createElement('span');
          const color = el.getAttribute('color');
          const face = el.getAttribute('face');
          if (color) span.style.color = color;
          if (face) span.style.fontFamily = face;
          span.innerHTML = el.innerHTML;
          el.replaceWith(span);
          walk(span);
          return;
        }

        if (isFraction && tag === 'span') {
          let num = '';
          let den = '';
          const exportNum = el.querySelector('.frac-num');
          const exportDen = el.querySelector('.frac-den');
          if (exportNum && exportDen) {
            num = (exportNum.textContent || '').trim();
            den = (exportDen.textContent || '').trim();
          } else if (el.children.length >= 3) {
            num = (el.children[0].textContent || '').trim();
            den = (el.children[2].textContent || '').trim();
          }
          if (num && den) {
            el.innerHTML = '<span class="frac-num">' + num + '</span><span class="frac-line"></span><span class="frac-den">' + den + '</span>';
            el.className = 'fraction';
            Array.from(el.attributes).forEach((attr) => {
              if (attr.name !== 'class') el.removeAttribute(attr.name);
            });
          }
          return;
        }

        if (!['strong', 'em', 'span', 'br'].includes(tag)) {
          const fragment = document.createDocumentFragment();
          while (el.firstChild) {
            fragment.appendChild(el.firstChild);
          }
          el.replaceWith(fragment);
          return;
        }

        if (tag === 'span') {
          const color = el.style.color;
          const fontSize = el.style.fontSize;
          const fontFamily = el.style.fontFamily;
          Array.from(el.attributes).forEach((attr) => {
            if (attr.name !== 'style') el.removeAttribute(attr.name);
          });
          const styleRules = [];
          if (color) styleRules.push('color:' + color);
          if (fontSize) styleRules.push('font-size:' + fontSize);
          if (fontFamily) styleRules.push('font-family:' + fontFamily);
          if (styleRules.length > 0) {
            el.setAttribute('style', styleRules.join(';') + ';');
          } else {
            el.removeAttribute('style');
          }
        }

        Array.from(el.childNodes).forEach(walk);
      };

      Array.from(root.childNodes).forEach(walk);
      return root.innerHTML;
    }

    function htmlToSpeechText(raw) {
      const temp = document.createElement('div');
      temp.innerHTML = sanitizeInlineHtml(raw);
      temp.querySelectorAll('.fraction').forEach((frac) => {
        const num = (frac.querySelector('.frac-num')?.textContent || '').trim();
        const den = (frac.querySelector('.frac-den')?.textContent || '').trim();
        const spoken = (num && den) ? (num + ' over ' + den) : (frac.textContent || '');
        frac.replaceWith(document.createTextNode(spoken));
      });
      return (temp.textContent || '').replace(/\\s+/g, ' ').trim();
    }

    function htmlToWordSpans(raw) {
      return sanitizeInlineHtml(raw);
    }

    function prepareAnimatedSlide(index) {
      const slide = slidesData[index];
      const slideEl = slides[index];
      const contentEl = slideEl.querySelector('.slide-content');
      const origAccentBar = slideEl.querySelector('.accent-bar');
      const accentColor = origAccentBar ? origAccentBar.style.background : '#3b82f6';

      let html = '';
      const items = [];

      if (slide.type === 'title') {
        items.push({ text: htmlToSpeechText(slide.title), type: 'title' });
        if (slide.content[0]) items.push({ text: htmlToSpeechText(slide.content[0]), type: 'subtitle' });

        html = '<div style="text-align:center;">' +
          '<div class="accent-bar" style="background:' + accentColor + ';margin:0 auto 1.5rem;"></div>' +
          '<h1 class="title-text animate-item">' + htmlToWordSpans(slide.title) + '</h1>' +
          (slide.content[0] ? '<p class="subtitle-text animate-item" style="opacity:0.8;">' + htmlToWordSpans(slide.content[0]) + '</p>' : '') +
          '</div>';
      } else if (slide.type === 'quote') {
        items.push({ text: htmlToSpeechText(slide.title), type: 'quote' });
        if (slide.content[0]) items.push({ text: htmlToSpeechText(slide.content[0]), type: 'cite' });

        html = '<div style="text-align:center;max-width:800px;margin:0 auto;">' +
          '<div class="quote-mark" style="opacity:0.3;">"</div>' +
          '<blockquote class="quote-text animate-item" style="font-style:italic;margin:1rem 0;">' + htmlToWordSpans(slide.title) + '</blockquote>' +
          (slide.content[0] ? '<cite class="cite-text animate-item" style="opacity:0.7;">— ' + htmlToWordSpans(slide.content[0]) + '</cite>' : '') +
          '</div>';
      } else if (slide.type === 'table') {
        items.push({ text: htmlToSpeechText(slide.title), type: 'heading' });
        slide.content.forEach(row => items.push({ text: htmlToSpeechText(row.replace(/\\|/g, ', ')), type: 'row' }));

        const rows = slide.content.map((row, ri) => {
          const cells = row.split(' | ');
          const cellTag = ri === 0 ? 'th' : 'td';
          const cellClass = ri === 0 ? 'table-header' : 'table-cell';
          return '<tr class="animate-item">' + cells.map(c => '<' + cellTag + ' class="' + cellClass + '">' + htmlToWordSpans(c) + '</' + cellTag + '>').join('') + '</tr>';
        }).join('');

        html = '<div class="content-wrap">' +
          '<div class="accent-bar" style="background:' + accentColor + ';"></div>' +
          '<h2 class="heading-text animate-item">' + htmlToWordSpans(slide.title) + '</h2>' +
          '<div class="table-wrap"><table><tbody>' + rows + '</tbody></table></div>' +
          '</div>';
      } else {
        const parsedLines = (slide.content || []).map(parseLine).filter(Boolean);
        items.push({ text: htmlToSpeechText(slide.title), type: 'heading' });
        parsedLines.forEach((line) => items.push({ text: htmlToSpeechText(line.content), type: line.type }));

        const blocks = parsedLines.map((line) => {
          if (line.type === 'subheading') {
            return '<div class="subheading-item animate-item">' + htmlToWordSpans(line.content) + '</div>';
          }
          if (line.type === 'bullet') {
            return '<div class="bullet-item animate-item"><span class="bullet-dot" style="background:' + accentColor + ';"></span><span>' + htmlToWordSpans(line.content) + '</span></div>';
          }
          return '<p class="paragraph-item animate-item">' + htmlToWordSpans(line.content) + '</p>';
        }).join('');

        html = '<div class="content-wrap">' +
          '<div class="accent-bar" style="background:' + accentColor + ';"></div>' +
          '<h2 class="heading-text animate-item">' + htmlToWordSpans(slide.title) + '</h2>' +
          '<div class="content-blocks">' + blocks + '</div>' +
          '</div>';
      }

      contentEl.innerHTML = html;
      contentEl.scrollTop = 0;
      const animateItems = contentEl.querySelectorAll('.animate-item');
      return { animateItems, items, contentEl };
    }

    async function runVideoPlayback(sessionId) {
      let startSlide = current;
      let startItem = 0;
      if (current === lastVideoState.slideIndex) {
        startItem = lastVideoState.itemIndex;
      }

      for (let i = startSlide; i < total; i++) {
        if (!isVideoPlaying || sessionId !== playbackSession) return;
        current = i;
        showSlide(current, true);
        await narrateSlideWithAnimation(i, i === startSlide ? startItem : 0, sessionId);
        if (!isVideoPlaying || sessionId !== playbackSession) return;
        await new Promise(r => setTimeout(r, 500));
      }

      if (isVideoPlaying && sessionId === playbackSession && current === total - 1) {
        current = 0;
        lastVideoState = { slideIndex: 0, itemIndex: 0 };
      }

      if (sessionId === playbackSession) {
        stopVideo();
      }
    }

    async function playVideo() {
      if (isVideoPlaying) {
        stopVideo();
        return;
      }

      if (!('speechSynthesis' in window)) {
        alert('Sorry, your browser does not support text-to-speech. Please use Chrome, Edge, or Safari.');
        return;
      }

      isVideoPlaying = true;
      playVideoBtn.textContent = 'Stop';
      playVideoBtn.classList.add('playing');
      setContentInteractionLocked(true);
      playbackSession++;
      runVideoPlayback(playbackSession);
    }

    function stopVideo() {
      isVideoPlaying = false;
      if (currentUtterance) {
        window.speechSynthesis.cancel();
        currentUtterance = null;
      }
      playVideoBtn.textContent = 'Play as Video';
      playVideoBtn.classList.remove('playing');
      setContentInteractionLocked(false);
      slides.forEach((s, i) => {
        s.querySelector('.slide-content').innerHTML = originalSlideContents[i];
      });
      prevBtn.disabled = current === 0;
      nextBtn.disabled = current === total - 1;
      showSlide(current);
    }

    function narrateItem(text, _wordElements, sessionId) {
      const speechText = (text || '').replace(/\\s+/g, ' ').trim();
      if (!speechText) return Promise.resolve();

      return new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(speechText);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        currentUtterance = utterance;

        utterance.onend = () => {
          currentUtterance = null;
          setTimeout(resolve, 200);
        };

        utterance.onerror = () => {
          currentUtterance = null;
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      });
    }

    async function narrateSlideWithAnimation(index, startItemIndex = 0, sessionId) {
      const { animateItems, items, contentEl } = prepareAnimatedSlide(index);

      for (let i = 0; i < startItemIndex; i++) {
        if (animateItems[i]) animateItems[i].classList.add('visible');
      }
      if (startItemIndex > 0 && animateItems[startItemIndex - 1]) {
        autoScrollToItem(contentEl, animateItems[startItemIndex - 1]);
      }

      for (let i = startItemIndex; i < animateItems.length; i++) {
        if (!isVideoPlaying || sessionId !== playbackSession) break;

        const itemEl = animateItems[i];
        const itemData = items[i];
        lastVideoState = { slideIndex: index, itemIndex: i };
        itemEl.classList.add('visible');
        autoScrollToItem(contentEl, itemEl);
        await new Promise(r => setTimeout(r, 150));
        const wordElements = [];
        if (itemData && itemData.text) {
          await narrateItem(itemData.text, wordElements, sessionId);
        }
      }

      if (isVideoPlaying && sessionId === playbackSession) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    playVideoBtn.onclick = playVideo;
    showSlide(0);
  </script>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${presentation.title.replace(/[^a-z0-9]/gi, "_")}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [presentation]);

  useEffect(() => {
    // When audio is enabled, narration handles slide advancement - skip timer
    if (isPlaying && !isChatOpen && !isAudioEnabled) {
      autoPlayTimerRef.current = setInterval(() => {
        setCurrentSlide((prev) => {
          if (prev >= presentation.slides.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          const next = prev + 1;
          setAnimationKey(`${Date.now()}-${next}`);
          return next;
        });
      }, slideInterval * 1000);
    } else if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }

    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
    };
  }, [isPlaying, isChatOpen, slideInterval, presentation.slides.length, isAudioEnabled]);

  const handleChatOpen = useCallback(() => {
    if (!isChatOpen) {
      slideBeforeChatRef.current = currentSlide;
      wasPlayingBeforeChatRef.current = isPlaying;
      setIsPlaying(false);
    }
    setIsChatOpen(true);
  }, [isChatOpen, currentSlide, isPlaying]);

  const handleChatClose = useCallback(() => {
    setIsChatOpen(false);
  }, []);

  const handleDoubtCleared = useCallback(() => {
    setIsChatOpen(false);
    if (wasPlayingBeforeChatRef.current) {
      setIsPlaying(true);
    }
    wasPlayingBeforeChatRef.current = false;
  }, []);

  const stopCurrentAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setIsNarrating(false);
    setNarrationProgress(0);
  }, []);

  const narrateSlide = useCallback(async (slideIndex: number) => {
    if (!isAudioEnabled || lastNarratedSlideRef.current === slideIndex) {
      return;
    }

    narrationTokenRef.current += 1;
    const currentToken = narrationTokenRef.current;

    lastNarratedSlideRef.current = slideIndex;
    const slide = presentation.slides[slideIndex];
    const text = `${slide.title}. ${slide.content.join(". ")}`;

    stopCurrentAudio();
    setIsNarrating(true);

    try {
      const response = await apiRequest("POST", "/api/presentations/narrate", {
        text,
        voice: "nova",
      });
      const data = await response.json();

      if (currentToken !== narrationTokenRef.current) {
        return;
      }

      if (data.audio && isAudioEnabled) {
        const audioBlob = new Blob(
          [Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0))],
          { type: "audio/mp3" }
        );
        const audioUrl = URL.createObjectURL(audioBlob);
        audioUrlRef.current = audioUrl;
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.ontimeupdate = () => {
          if (audio.duration > 0) {
            setNarrationProgress(audio.currentTime / audio.duration);
          }
        };

        audio.onended = () => {
          if (audioUrlRef.current === audioUrl) {
            URL.revokeObjectURL(audioUrl);
            audioUrlRef.current = null;
          }
          setIsNarrating(false);
          setNarrationProgress(1);
          // Auto-advance to next slide after narration completes
          if (isPlaying) {
            setTimeout(() => {
              goToNextSlide();
            }, 500); // Small delay before advancing
          }
        };

        audio.onerror = () => {
          setIsNarrating(false);
          setNarrationProgress(0);
        };

        setNarrationProgress(0);
        await audio.play();
      } else {
        setIsNarrating(false);
      }
    } catch (error) {
      if (currentToken === narrationTokenRef.current) {
        console.error("Failed to narrate slide:", error);
        setIsNarrating(false);
      }
    }
  }, [isAudioEnabled, presentation.slides, stopCurrentAudio, isPlaying, goToNextSlide]);

  useEffect(() => {
    if (isAudioEnabled) {
      narrateSlide(currentSlide);
    }
  }, [currentSlide, isAudioEnabled, narrateSlide]);

  useEffect(() => {
    if (!isAudioEnabled) {
      narrationTokenRef.current += 1;
      stopCurrentAudio();
      lastNarratedSlideRef.current = -1;
    }
  }, [isAudioEnabled, stopCurrentAudio]);

  useEffect(() => {
    return () => {
      stopCurrentAudio();
    };
  }, [stopCurrentAudio]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isChatOpen && e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case "ArrowRight":
          goToNextSlide();
          break;
        case " ":
          e.preventDefault();
          if (e.shiftKey) {
            togglePlay();
          } else {
            goToNextSlide();
          }
          break;
        case "ArrowLeft":
          goToPrevSlide();
          break;
        case "Escape":
          if (isChatOpen) {
            handleChatClose();
          } else if (isFullscreen) {
            document.exitFullscreen();
            setIsFullscreen(false);
          } else {
            onClose();
          }
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "p":
        case "P":
          togglePlay();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNextSlide, goToPrevSlide, onClose, isFullscreen, isChatOpen, toggleFullscreen, togglePlay, handleChatClose]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex"
      data-testid="presentation-viewer"
    >
      <div className="relative flex-1 flex flex-col">
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="bg-background/80 backdrop-blur-sm"
                data-testid="button-slideshow-settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Auto-play interval: {slideInterval}s</Label>
                  <Slider
                    value={[slideInterval]}
                    onValueChange={(v) => setSlideInterval(v[0])}
                    min={2}
                    max={15}
                    step={1}
                    data-testid="slider-interval"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsAudioEnabled(!isAudioEnabled)}
            className={`bg-background/80 backdrop-blur-sm ${isAudioEnabled ? 'ring-2 ring-primary' : ''}`}
            data-testid="button-audio-toggle"
          >
            {isNarrating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isAudioEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={togglePlay}
            className="bg-background/80 backdrop-blur-sm"
            data-testid="button-play-pause"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={downloadAsHtml}
            className="bg-background/80 backdrop-blur-sm"
            data-testid="button-download-html"
            title="Download as HTML"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleFullscreen}
            className="bg-background/80 backdrop-blur-sm"
            data-testid="button-fullscreen-toggle"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          {!hideCloseButton && (
            <Button
              variant="outline"
              size="icon"
              onClick={onClose}
              className="bg-background/80 backdrop-blur-sm"
              data-testid="button-close-viewer"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex-1 flex items-center justify-center w-full h-full">
          <div className="w-full h-full flex items-center justify-center">
            <AnimatedSlide
              key={animationKey}
              slide={presentation.slides[currentSlide]}
              theme={presentation.theme}
              slideNumber={currentSlide + 1}
              totalSlides={presentation.slides.length}
              animationKey={animationKey}
              isNarrating={isNarrating}
              narrationProgress={narrationProgress}
            />
          </div>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPrevSlide}
            disabled={currentSlide === 0}
            className="bg-background/80 backdrop-blur-sm"
            data-testid="button-prev-slide"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm text-white bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-md flex items-center gap-2">
            {isPlaying && (
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
            <span>{currentSlide + 1} / {presentation.slides.length}</span>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextSlide}
            disabled={currentSlide === presentation.slides.length - 1}
            className="bg-background/80 backdrop-blur-sm"
            data-testid="button-next-slide"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="absolute bottom-4 left-4 text-xs text-white/70 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-md">
          <kbd className="px-1 py-0.5 bg-white/20 rounded text-xs">â†</kbd>{" "}
          <kbd className="px-1 py-0.5 bg-white/20 rounded text-xs">â†’</kbd> navigate â€¢{" "}
          <kbd className="px-1 py-0.5 bg-white/20 rounded text-xs">P</kbd> play/pause â€¢{" "}
          <kbd className="px-1 py-0.5 bg-white/20 rounded text-xs">F</kbd> fullscreen
        </div>

        {!isChatOpen && (
          <Button
            variant="default"
            onClick={handleChatOpen}
            className="z-[90] h-11 rounded-full px-5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
            style={{ position: "fixed", right: "24px", bottom: "24px", left: "auto" }}
            data-testid="button-open-chat"
            title="Ask AI"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Ask Ai</span>
          </Button>
        )}
      </div>

      <PresentationChat
        presentation={presentation}
        currentSlide={currentSlide}
        onSlideChange={goToSlide}
        onChatOpen={handleChatOpen}
        onChatClose={handleChatClose}
        onDoubtCleared={handleDoubtCleared}
        isOpen={isChatOpen}
      />
    </div>
  );
}


