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
}

export function PresentationViewer({
  presentation,
  onClose,
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

  const renderFractions = (text: string): string => {
    return text.replace(/\[\[FRAC:([^:]+):([^\]]+)\]\]/g, (_, num, den) => {
      return `<span class="fraction">
                <span class="frac-num">${num}</span>
                <span class="frac-line"></span>
                <span class="frac-den">${den}</span>
              </span>`;
    });
  };

  const slidesHtml = presentation.slides.map((slide, i) => {
    let contentHtml = "";
    const title = renderFractions(slide.title);

    const content = slide.content.map(c => renderFractions(c));

    if (slide.type === "title") {
      contentHtml = `
        <div style="text-align:center;">
          <div class="accent-bar" style="background:${style.accent};margin:0 auto 1.5rem;"></div>
          <h1 class="title-text">${title}</h1>
          ${content[0] ? `<p class="subtitle-text">${content[0]}</p>` : ""}
        </div>`;
    }

    else if (slide.type === "quote") {
      contentHtml = `
        <div style="text-align:center;max-width:800px;margin:0 auto;">
          <div class="quote-mark">"</div>
          <blockquote class="quote-text">${title}</blockquote>
          ${content[0] ? `<cite class="cite-text">— ${content[0]}</cite>` : ""}
        </div>`;
    }

    else if (slide.type === "table") {
      const rows = content.map((row, ri) => {
        const cells = row.split(" | ");
        const tag = ri === 0 ? "th" : "td";
        const cls = ri === 0 ? "table-header" : "table-cell";
        return `<tr>${cells.map(c => `<${tag} class="${cls}">${c}</${tag}>`).join("")}</tr>`;
      }).join("");

      contentHtml = `
        <div class="content-wrap">
          <div class="accent-bar" style="background:${style.accent};"></div>
          <h2 class="heading-text">${title}</h2>
          <div class="table-wrap"><table><tbody>${rows}</tbody></table></div>
        </div>`;
    }

    else {
      const items = content.map(c => {

        if (c.startsWith("__SUBHEADING__")) {
          return `<h3 class="subheading-item">${c.replace("__SUBHEADING__", "")}</h3>`;
        }

        if (c.startsWith("__SUBBULLET__")) {
          return `
            <li class="bullet-item sub-bullet">
              <span class="bullet-dot small" style="background:${style.accent};"></span>
              <span>${c.replace("__SUBBULLET__", "")}</span>
            </li>`;
        }

        if (c.startsWith("__BULLET__")) {
          return `
            <li class="bullet-item">
              <span class="bullet-dot" style="background:${style.accent};"></span>
              <span>${c.replace("__BULLET__", "")}</span>
            </li>`;
        }

        return `<p class="paragraph-item">${c}</p>`;
      }).join("");

      contentHtml = `
        <div class="content-wrap">
          <div class="accent-bar" style="background:${style.accent};"></div>
          <h2 class="heading-text">${title}</h2>
          <ul class="bullet-list">${items}</ul>
        </div>`;
    }

    return `
      <div class="slide" data-index="${i}" style="display:${i === 0 ? "flex" : "none"};background:${style.bg};color:${style.text};">
        <div class="slide-glow" style="background:${style.accent};"></div>
        <div class="slide-content">${contentHtml}</div>
        <div class="slide-number">Slide ${i + 1} of ${presentation.slides.length}</div>
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
    
    .slide { min-height: 85vh; min-height: 85dvh; width: 90%; max-width: 500px; margin: auto; padding: 1.5rem; padding-bottom: 3.5rem; flex-direction: column; justify-content: center; align-items: center; position: relative; overflow: hidden; border-radius: 12px; box-shadow: 0 15px 50px rgba(0,0,0,0.4); }
    .slide-content { position: relative; z-index: 10; width: 100%; max-width: 100%; margin: 0 auto; }
    .slide-glow { position: absolute; top: 0; right: 0; width: 150px; height: 150px; opacity: 0.1; border-radius: 50%; transform: translate(50%, -50%); filter: blur(40px); }
    .slide-number { position: absolute; bottom: 3.5rem; left: 50%; transform: translateX(-50%); font-size: 0.7rem; opacity: 0.6; }
    
    .accent-bar { width: 2.5rem; height: 4px; border-radius: 2px; margin-bottom: 0.75rem; }
    .title-text { font-size: 1.5rem; font-weight: bold; margin-bottom: 0.5rem; line-height: 1.2; }
    .subtitle-text { font-size: 0.9rem; }
    .heading-text { font-size: 1.25rem; font-weight: bold; margin-bottom: 0.75rem; line-height: 1.2; }
    .quote-mark { font-size: 2.5rem; }
    .quote-text { font-size: 1.1rem; line-height: 1.4; }
    .cite-text { font-size: 0.8rem; display: block; margin-top: 0.75rem; }
    
    .content-wrap { width: 100%; }
    .bullet-list { list-style: none; padding: 0; font-size: 0.9rem; }
    .bullet-item { margin-bottom: 0.5rem; display: flex; align-items: flex-start; gap: 0.5rem; }
    .bullet-dot { width: 5px; height: 5px; border-radius: 50%; margin-top: 0.4rem; flex-shrink: 0; }
    
    .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    table { width: 100%; border-collapse: collapse; font-size: 0.75rem; min-width: 280px; }
    .table-header { padding: 6px 8px; text-align: left; font-weight: 600; border-bottom: 2px solid rgba(255,255,255,0.3); white-space: nowrap; }
    .table-cell { padding: 6px 8px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1); }
    
    /* Fraction styles */
    .fraction { display: inline-flex; flex-direction: column; align-items: center; vertical-align: middle; margin: 0 0.15em; font-size: 0.85em; line-height: 1; }
    .frac-num, .frac-den { display: block; text-align: center; padding: 0 0.1em; }
    .frac-line { display: block; width: 100%; height: 1px; background: currentColor; margin: 1px 0; }
    
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
      .slide { width: 75%; max-width: 600px; min-height: 80vh; padding: 1rem 1.5rem 2.5rem; }
      .title-text { font-size: 1.3rem; }
      .heading-text { font-size: 1.1rem; }
      .bullet-list { font-size: 0.85rem; }
      .bullet-item { margin-bottom: 0.35rem; }
      .slide-number { bottom: 2rem; }
      .controls { bottom: 6px; }
    }
    
    /* Tablet */
    @media (min-width: 640px) {
      .slide { width: 80%; max-width: 700px; min-height: 85vh; padding: 2rem; padding-bottom: 4rem; border-radius: 14px; }
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
    }
    
    /* Desktop - 3/4 width centered */
    @media (min-width: 1024px) {
      body { background: #0a0a0a; }
      .slide { width: 75%; max-width: 1400px; min-height: 80vh; margin: auto; border-radius: 16px; box-shadow: 0 25px 80px rgba(0,0,0,0.5); padding: 3rem; padding-bottom: 5rem; }
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
      .slide-number { bottom: 1.5rem; }
      .controls { bottom: 20px; gap: 12px; }
      .controls button { padding: 12px 22px; font-size: 0.95rem; border-radius: 8px; }
      .slide-counter { padding: 12px 18px; font-size: 0.95rem; }
      .help { display: block; position: fixed; bottom: 20px; left: 20px; font-size: 0.7rem; color: rgba(255,255,255,0.4); background: rgba(0,0,0,0.4); padding: 8px 12px; border-radius: 6px; }
    }
    
    /* Large desktop */
    @media (min-width: 1440px) {
      .slide { width: 70%; padding: 4rem; padding-bottom: 5rem; }
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
    <button id="prev">← Prev</button>
    <div class="slide-counter"><span id="current">1</span> / ${presentation.slides.length}</div>
    <button id="next">Next →</button>
    <button id="playVideo">▶ Play as Video</button>
  </div>
  <div class="help">Use ← → arrow keys or buttons to navigate | Press Escape to stop video</div>
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
    
    // Store original HTML content for each slide
    slides.forEach((s, i) => {
      originalSlideContents[i] = s.querySelector('.slide-content').innerHTML;
    });
    
    function showSlide(n, animated = false) {
      slides.forEach((s, i) => {
        s.style.display = i === n ? 'flex' : 'none';
        // Reset to original content when not in video mode
        if (!animated && !isVideoPlaying) {
          s.querySelector('.slide-content').innerHTML = originalSlideContents[i];
        }
      });
      counter.textContent = n + 1;
      prevBtn.disabled = n === 0 || isVideoPlaying;
      nextBtn.disabled = n === total - 1 || isVideoPlaying;
    }
    
    function next() { if (current < total - 1 && !isVideoPlaying) { current++; showSlide(current); } }
    function prev() { if (current > 0 && !isVideoPlaying) { current--; showSlide(current); } }
    
    prevBtn.onclick = prev;
    nextBtn.onclick = next;
    document.addEventListener('keydown', e => {
      if (isVideoPlaying) {
        if (e.key === 'Escape') stopVideo();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') prev();
    });
    
    let touchStartX = 0;
    document.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    document.addEventListener('touchend', e => {
      if (isVideoPlaying) return;
      const diff = touchStartX - e.changedTouches[0].screenX;
      if (Math.abs(diff) > 50) { diff > 0 ? next() : prev(); }
    }, { passive: true });
    
    // Get text for speech (clean version without markers)
    function getSlideText(slide) {
      let text = slide.title;
      if (slide.content && slide.content.length > 0) {
        text += '. ' + slide.content.join('. ');
      }
      // Convert fraction markers to spoken form
      text = text.replace(/\\[\\[FRAC:([^:]+):([^\\]]+)\\]\\]/g, '$1 over $2');
      return text;
    }
    
    // Convert text to word spans for highlighting during speech
    function textToWordSpans(text) {
      // First, extract fractions and replace with placeholders
      const fractions = [];
      let processed = text.replace(/\\[\\[FRAC:([^:]+):([^\\]]+)\\]\\]/g, (match, num, den) => {
        const idx = fractions.length;
        fractions.push('<span class="fraction highlight-word"><span class="frac-num">' + num + '</span><span class="frac-line"></span><span class="frac-den">' + den + '</span></span>');
        return '___FRAC' + idx + '___';
      });
      
      // Split into words
      const words = processed.split(/\\s+/).filter(w => w.length > 0);
      let result = '';
      words.forEach(word => {
        const fracMatch = word.match(/___FRAC(\\d+)___/);
        if (fracMatch) {
          result += fractions[parseInt(fracMatch[1])] + ' ';
        } else {
          result += '<span class="highlight-word">' + word + '</span> ';
        }
      });
      return result;
    }
    
    // Prepare slide for animated playback with item-by-item animation and word highlighting
    function prepareAnimatedSlide(index) {
      const slide = slidesData[index];
      const slideEl = slides[index];
      const contentEl = slideEl.querySelector('.slide-content');
      
      // Get accent color from original slide's accent-bar
      const origAccentBar = slideEl.querySelector('.accent-bar');
      const accentColor = origAccentBar ? origAccentBar.style.background : '#3b82f6';
      
      let html = '';
      const items = []; // Track content items with their text for narration
      
      if (slide.type === 'title') {
        items.push({ text: slide.title, type: 'title' });
        if (slide.content[0]) items.push({ text: slide.content[0], type: 'subtitle' });
        
        html = '<div style="text-align:center;">' +
          '<div class="accent-bar" style="background:' + accentColor + ';margin:0 auto 1.5rem;"></div>' +
          '<h1 class="title-text animate-item">' + textToWordSpans(slide.title) + '</h1>' +
          (slide.content[0] ? '<p class="subtitle-text animate-item" style="opacity:0.8;">' + textToWordSpans(slide.content[0]) + '</p>' : '') +
          '</div>';
      } else if (slide.type === 'quote') {
        items.push({ text: slide.title, type: 'quote' });
        if (slide.content[0]) items.push({ text: slide.content[0], type: 'cite' });
        
        html = '<div style="text-align:center;max-width:800px;margin:0 auto;">' +
          '<div class="quote-mark" style="opacity:0.3;">"</div>' +
          '<blockquote class="quote-text animate-item" style="font-style:italic;margin:1rem 0;">' + textToWordSpans(slide.title) + '</blockquote>' +
          (slide.content[0] ? '<cite class="cite-text animate-item" style="opacity:0.7;">— ' + textToWordSpans(slide.content[0]) + '</cite>' : '') +
          '</div>';
      } else if (slide.type === 'table') {
        items.push({ text: slide.title, type: 'heading' });
        slide.content.forEach(row => items.push({ text: row.replace(/\\|/g, ', '), type: 'row' }));
        
        const rows = slide.content.map((row, ri) => {
          const cells = row.split(' | ');
          const cellTag = ri === 0 ? 'th' : 'td';
          const cellClass = ri === 0 ? 'table-header' : 'table-cell';
          return '<tr class="animate-item">' + cells.map(c => '<' + cellTag + ' class="' + cellClass + '">' + textToWordSpans(c) + '</' + cellTag + '>').join('') + '</tr>';
        }).join('');
        html = '<div class="content-wrap">' +
          '<div class="accent-bar" style="background:' + accentColor + ';"></div>' +
          '<h2 class="heading-text animate-item">' + textToWordSpans(slide.title) + '</h2>' +
          '<div class="table-wrap"><table><tbody>' + rows + '</tbody></table></div>' +
          '</div>';
      } else if (slide.type === 'content') {
        // Content/paragraph slides - each paragraph animates separately
        items.push({ text: slide.title, type: 'heading' });
        slide.content.forEach(c => items.push({ text: c, type: 'paragraph' }));
        
        const paragraphs = slide.content.map(c => '<p class="paragraph-item animate-item" style="margin-bottom:0.75rem;">' + textToWordSpans(c) + '</p>').join('');
        html = '<div class="content-wrap">' +
          '<div class="accent-bar" style="background:' + accentColor + ';"></div>' +
          '<h2 class="heading-text animate-item">' + textToWordSpans(slide.title) + '</h2>' +
          '<div class="paragraphs">' + paragraphs + '</div>' +
          '</div>';
      } else {
        // Bullets
        items.push({ text: slide.title, type: 'heading' });
        slide.content.forEach(c => items.push({ text: c, type: 'bullet' }));
        
        const bullets = slide.content.map(c => '<li class="bullet-item animate-item"><span class="bullet-dot" style="background:' + accentColor + ';"></span><span>' + textToWordSpans(c) + '</span></li>').join('');
        html = '<div class="content-wrap">' +
          '<div class="accent-bar" style="background:' + accentColor + ';"></div>' +
          '<h2 class="heading-text animate-item">' + textToWordSpans(slide.title) + '</h2>' +
          '<ul class="bullet-list">' + bullets + '</ul>' +
          '</div>';
      }
      
      contentEl.innerHTML = html;
      
      // Return animate items with their word elements
      const animateItems = contentEl.querySelectorAll('.animate-item');
      return { animateItems, items };
    }
    
    async function playVideo() {
      if (isVideoPlaying) {
        stopVideo();
        return;
      }
      
      // Check if speech synthesis is available
      if (!('speechSynthesis' in window)) {
        alert('Sorry, your browser does not support text-to-speech. Please use Chrome, Edge, or Safari.');
        return;
      }
      
      isVideoPlaying = true;
      playVideoBtn.textContent = '⏹ Stop';
      playVideoBtn.classList.add('playing');
      current = 0;
      
      for (let i = 0; i < total && isVideoPlaying; i++) {
        current = i;
        showSlide(current, true);
        await narrateSlideWithAnimation(i);
        if (!isVideoPlaying) break;
        await new Promise(r => setTimeout(r, 500));
      }
      
      stopVideo();
    }
    
    function stopVideo() {
      isVideoPlaying = false;
      if (currentUtterance) {
        window.speechSynthesis.cancel();
        currentUtterance = null;
      }
      playVideoBtn.textContent = '▶ Play as Video';
      playVideoBtn.classList.remove('playing');
      // Restore original slide content
      slides.forEach((s, i) => {
        s.querySelector('.slide-content').innerHTML = originalSlideContents[i];
      });
      prevBtn.disabled = current === 0;
      nextBtn.disabled = current === total - 1;
    }
    
    // Narrate a single item with word highlighting
    function narrateItem(text, wordElements) {
      // Clean text for speech
      let speechText = text.replace(/\\[\\[FRAC:([^:]+):([^\\]]+)\\]\\]/g, '$1 over $2');
      speechText = speechText.replace(/\\*\\*/g, '');
      
      return new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(speechText);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        currentUtterance = utterance;
        
        let wordIndex = 0;
        let animationInterval = null;
        const totalWords = wordElements.length;
        const estimatedDuration = (speechText.length / 12) * 1000;
        const wordDelay = totalWords > 0 ? estimatedDuration / totalWords : 500;
        
        utterance.onboundary = (event) => {
          if (event.name === 'word' && wordIndex < totalWords) {
            if (wordIndex > 0 && wordElements[wordIndex - 1]) {
              wordElements[wordIndex - 1].classList.remove('speaking');
            }
            if (wordElements[wordIndex]) {
              wordElements[wordIndex].classList.add('speaking');
            }
            wordIndex++;
          }
        };
        
        utterance.onstart = () => {
          let fallbackIndex = 0;
          animationInterval = setInterval(() => {
            if (fallbackIndex < totalWords && wordIndex <= fallbackIndex) {
              if (fallbackIndex > 0 && wordElements[fallbackIndex - 1]) {
                wordElements[fallbackIndex - 1].classList.remove('speaking');
              }
              if (wordElements[fallbackIndex]) {
                wordElements[fallbackIndex].classList.add('speaking');
              }
              fallbackIndex++;
            }
          }, wordDelay);
        };
        
        utterance.onend = () => {
          if (animationInterval) clearInterval(animationInterval);
          wordElements.forEach(w => w.classList.remove('speaking'));
          currentUtterance = null;
          setTimeout(resolve, 200);
        };
        
        utterance.onerror = () => {
          if (animationInterval) clearInterval(animationInterval);
          wordElements.forEach(w => w.classList.remove('speaking'));
          currentUtterance = null;
          resolve();
        };
        
        window.speechSynthesis.speak(utterance);
      });
    }
    
    async function narrateSlideWithAnimation(index) {
      const { animateItems, items } = prepareAnimatedSlide(index);
      
      // Process each item: show it, then narrate with word highlighting
      for (let i = 0; i < animateItems.length; i++) {
        if (!isVideoPlaying) break;
        
        const itemEl = animateItems[i];
        const itemData = items[i];
        
        // Show the item with animation
        itemEl.classList.add('visible');
        
        // Small delay for animation to complete
        await new Promise(r => setTimeout(r, 150));
        
        // Get word elements within this item
        const wordElements = itemEl.querySelectorAll('.highlight-word');
        
        // Narrate with word highlighting
        if (itemData && itemData.text) {
          await narrateItem(itemData.text, wordElements);
        }
      }
      
      // Brief pause before next slide
      await new Promise(r => setTimeout(r, 300));
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
      <div className={`flex-1 flex flex-col ${isChatOpen ? 'mr-80 sm:mr-96' : ''} transition-all duration-300`}>
        <div className="absolute top-4 right-4 z-10 flex gap-2" style={{ right: isChatOpen ? 'calc(20rem + 1rem)' : '1rem' }}>
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
          <Button
            variant="outline"
            size="icon"
            onClick={onClose}
            className="bg-background/80 backdrop-blur-sm"
            data-testid="button-close-viewer"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full h-full">
            <AnimatedSlide
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

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4" style={{ transform: isChatOpen ? 'translateX(calc(-50% - 10rem))' : 'translateX(-50%)' }}>
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
          <kbd className="px-1 py-0.5 bg-white/20 rounded text-xs">←</kbd>{" "}
          <kbd className="px-1 py-0.5 bg-white/20 rounded text-xs">→</kbd> navigate •{" "}
          <kbd className="px-1 py-0.5 bg-white/20 rounded text-xs">P</kbd> play/pause •{" "}
          <kbd className="px-1 py-0.5 bg-white/20 rounded text-xs">F</kbd> fullscreen
        </div>
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
