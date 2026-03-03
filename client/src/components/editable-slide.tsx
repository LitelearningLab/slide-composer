import { type ChangeEvent, type FocusEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Slide, type SlideTheme } from "@shared/schema";
import { Bold, Italic, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { themeConfigs } from "./slide-theme-card";

type ContentType = "subheading" | "bullet" | "paragraph";

function detectContent(item: string): { type: ContentType; content: string } {
  const trimmed = item.trim();

  if (trimmed.startsWith("##SUB:")) {
    return { type: "subheading", content: trimmed.substring(6).trim() };
  }

  const subMatch = trimmed.match(/^\*\*(.+)\*\*$/);
  if (subMatch) {
    return { type: "subheading", content: subMatch[1].trim() };
  }

  if (trimmed.startsWith("* ")) {
    return { type: "bullet", content: trimmed.substring(2) };
  }

  return { type: "paragraph", content: trimmed };
}

function composeContent(type: ContentType, content: string): string {
  if (type === "subheading") {
    return `##SUB:${content.trim()}`;
  }
  if (type === "bullet") {
    return `* ${content}`;
  }
  return content;
}

function parsePastedLine(raw: string): { type: ContentType; content: string } | null {
  const line = raw.replace(/\t/g, " ").trim();
  if (!line) return null;

  const bulletMatch = line.match(/^(?:[-*\u2022\u25E6]|\d+[.)])\s+(.+)$/);
  if (bulletMatch) {
    return { type: "bullet", content: bulletMatch[1].trim() };
  }

  if (line.endsWith(":") && line.length <= 80) {
    return { type: "subheading", content: line.slice(0, -1).trim() || line };
  }

  return { type: "paragraph", content: line };
}

function fractionMarkup(num: string, den: string) {
  return `<span class="inline-flex flex-col items-center justify-center whitespace-nowrap align-middle" style="line-height:1;vertical-align:middle;transform:translateY(0.08em);"><span class="text-[0.8em] leading-none">${num}</span><span class="w-full h-px bg-current"></span><span class="text-[0.8em] leading-none">${den}</span></span>`;
}

function renderHtml(text: string): string {
  const normalized = text
    .replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, (_m, num, den) => `[[FRAC:${num.trim()}:${den.trim()}]]`)
    .replace(/\(([^()]+)\)\s*\/\s*(\d+)/g, (_m, num, den) => `[[FRAC:${num.trim()}:${den}]]`)
    .replace(/(\d+)\s*\/\s*(\d+)/g, (_m, num, den) => `[[FRAC:${num}:${den}]]`);

  return normalized
    .replace(
      /\[\[FRAC:([^:]+):([^\]]+)\]\]/g,
      (_m, num, den) => fractionMarkup(num, den),
    )
    .replace(/\u2192/g, `<span style="display:inline-block;position:relative;top:-0.05em;">&#8594;</span>`)
    .replace(/\n/g, "<br>");
}

function isFractionOnly(text: string): boolean {
  const plain = text.replace(/<[^>]*>/g, "").trim();
  return /^\[\[FRAC:[^:\]]+:[^\]]+\]\]$/.test(plain);
}

function sanitizeEditableHtml(html: string): string {
  if (typeof window === "undefined") {
    return html;
  }

  const root = document.createElement("div");
  root.innerHTML = html;

  const sanitizeNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.parentNode?.removeChild(node);
      return;
    }

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === "b") {
      const strong = document.createElement("strong");
      strong.innerHTML = el.innerHTML;
      el.replaceWith(strong);
      sanitizeNode(strong);
      return;
    }

    if (tag === "i") {
      const em = document.createElement("em");
      em.innerHTML = el.innerHTML;
      el.replaceWith(em);
      sanitizeNode(em);
      return;
    }

    if (tag === "font") {
      const span = document.createElement("span");
      const color = el.getAttribute("color");
      const face = el.getAttribute("face");
      const fontSizeMap: Record<string, string> = {
        "1": "70%",
        "2": "80%",
        "3": "100%",
        "4": "120%",
        "5": "150%",
        "6": "180%",
        "7": "220%",
      };
      const size = el.getAttribute("size");
      const mappedSize = size ? fontSizeMap[size] : "";
      if (color) {
        span.style.color = color;
      }
      if (face) {
        span.style.fontFamily = face;
      }
      if (mappedSize) {
        span.style.fontSize = mappedSize;
      }
      span.innerHTML = el.innerHTML;
      el.replaceWith(span);
      sanitizeNode(span);
      return;
    }

    if (!["strong", "em", "span", "br"].includes(tag)) {
      const fragment = document.createDocumentFragment();
      while (el.firstChild) {
        fragment.appendChild(el.firstChild);
      }
      el.replaceWith(fragment);
      return;
    }

    if (tag === "span") {
      const color = el.style.color;
      const fontSize = el.style.fontSize;
      const fontFamily = el.style.fontFamily;
      el.removeAttribute("style");
      if (color) {
        el.style.color = color;
      }
      if (fontSize) {
        el.style.fontSize = fontSize;
      }
      if (fontFamily) {
        el.style.fontFamily = fontFamily;
      }
    }

    Array.from(el.childNodes).forEach(sanitizeNode);
  };

  Array.from(root.childNodes).forEach(sanitizeNode);
  return root.innerHTML.replace(/&nbsp;/g, " ").trim();
}

function getCaretSplitHtml(el: HTMLElement): { before: string; after: string } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) {
    return null;
  }

  const beforeRange = document.createRange();
  beforeRange.selectNodeContents(el);
  beforeRange.setEnd(range.startContainer, range.startOffset);

  const afterRange = document.createRange();
  afterRange.selectNodeContents(el);
  afterRange.setStart(range.endContainer, range.endOffset);

  const beforeContainer = document.createElement("div");
  beforeContainer.appendChild(beforeRange.cloneContents());
  const afterContainer = document.createElement("div");
  afterContainer.appendChild(afterRange.cloneContents());

  return {
    before: sanitizeEditableHtml(beforeContainer.innerHTML),
    after: sanitizeEditableHtml(afterContainer.innerHTML),
  };
}

function placeCaret(el: HTMLElement | null, atStart: boolean) {
  if (!el) return;
  el.focus();
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(atStart);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function EditableSlide({
  slide,
  theme,
  onUpdate,
}: {
  slide: Slide;
  theme: SlideTheme;
  slideNumber: number;
  totalSlides: number;
  onUpdate?: (slide: Slide) => void;
}) {
  const config = themeConfigs[theme];
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [selectedColor, setSelectedColor] = useState("#3b82f6");
  const [fontSizePx, setFontSizePx] = useState(16);
  const [selectedFontFamily, setSelectedFontFamily] = useState("Arial");
  const [isMediaMenuOpen, setIsMediaMenuOpen] = useState(false);
  const editableRefs = useRef<Array<HTMLDivElement | null>>([]);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFocusRef = useRef<{ index: number; atStart: boolean } | null>(null);
  const selectionRef = useRef<{ index: number; range: Range } | null>(null);
  const dragSelectRef = useRef<{ active: boolean; startIndex: number | null }>({
    active: false,
    startIndex: null,
  });

  const parsedContent = useMemo(
    () => slide.content.map((item) => detectContent(item)),
    [slide.content],
  );

  const densityMode = useMemo(() => {
    const titleLength = slide.title.trim().length;
    const contentChars = slide.content.reduce((sum, item) => {
      const parsed = detectContent(item);
      return sum + parsed.content.trim().length;
    }, 0);
    const itemCount = slide.content.length;
    const score = titleLength * 1.2 + contentChars + itemCount * 35;

    if (score > 900) return "compact";
    if (score > 650) return "dense";
    return "comfortable";
  }, [slide.content, slide.title]);

  const titleTextClass =
    densityMode === "compact"
      ? "text-2xl md:text-3xl"
      : densityMode === "dense"
        ? "text-3xl md:text-4xl"
        : "text-4xl md:text-5xl";

  const bodyTextClass =
    densityMode === "compact"
      ? "text-base md:text-lg"
      : densityMode === "dense"
        ? "text-lg md:text-xl"
        : "text-xl md:text-2xl";

  const verticalGapClass = densityMode === "compact" ? "space-y-4" : "space-y-6";
  const sectionSpacingClass = densityMode === "compact" ? "mb-7" : "mb-10";
  const fontSizeOptions = useMemo(
    () => Array.from({ length: 65 }, (_v, i) => i + 8),
    [],
  );
  const fontFamilyOptions = useMemo(
    () => [
      "Arial",
      "Calibri",
      "Georgia",
      "Times New Roman",
      "Verdana",
      "Courier New",
    ],
    [],
  );

  useEffect(() => {
    if (!pendingFocusRef.current) return;
    const { index, atStart } = pendingFocusRef.current;
    placeCaret(editableRefs.current[index], atStart);
    pendingFocusRef.current = null;
  }, [slide.content]);

  useEffect(() => {
    const stopDragSelection = () => {
      dragSelectRef.current.active = false;
      dragSelectRef.current.startIndex = null;
    };
    window.addEventListener("mouseup", stopDragSelection);
    return () => window.removeEventListener("mouseup", stopDragSelection);
  }, []);

  useEffect(() => {
    setIsMediaMenuOpen(false);
  }, [slide.id]);

  const updateContentAt = useCallback(
    (index: number, type: ContentType, html: string) => {
      if (!onUpdate) return;
      const next = [...slide.content];
      next[index] = composeContent(type, sanitizeEditableHtml(html));
      onUpdate({ ...slide, content: next });
    },
    [onUpdate, slide],
  );

  const getSelectionFontPx = useCallback((target: HTMLElement): number => {
    const selection = window.getSelection();
    const node = selection?.anchorNode;
    const el =
      node?.nodeType === Node.ELEMENT_NODE
        ? (node as HTMLElement)
        : (node?.parentElement ?? target);
    const px = Math.round(parseFloat(getComputedStyle(el).fontSize || "16") || 16);
    return Math.min(72, Math.max(8, px));
  }, []);

  const captureSelection = useCallback((index: number) => {
    const target = editableRefs.current[index];
    if (!target) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!target.contains(range.startContainer) || !target.contains(range.endContainer)) {
      return;
    }
    selectionRef.current = { index, range: range.cloneRange() };
    setFontSizePx(getSelectionFontPx(target));
    const node = selection.anchorNode;
    const anchorEl =
      node?.nodeType === Node.ELEMENT_NODE
        ? (node as HTMLElement)
        : (node?.parentElement ?? target);
    const computedFamily = getComputedStyle(anchorEl).fontFamily || "Arial";
    const matchedFamily = fontFamilyOptions.find((font) =>
      computedFamily.toLowerCase().includes(font.toLowerCase()),
    );
    if (matchedFamily) {
      setSelectedFontFamily(matchedFamily);
    }
  }, [fontFamilyOptions, getSelectionFontPx]);

  const execFormat = useCallback(
    (command: "bold" | "italic" | "foreColor" | "fontName", value?: string) => {
      if (activeIndex === null) return;
      const target = editableRefs.current[activeIndex];
      if (!target) return;
      target.focus();
      if (selectionRef.current && selectionRef.current.index === activeIndex) {
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(selectionRef.current.range);
        }
      }
      document.execCommand(command, false, value);
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        selectionRef.current = {
          index: activeIndex,
          range: selection.getRangeAt(0).cloneRange(),
        };
      }
      captureSelection(activeIndex);
    },
    [activeIndex, captureSelection],
  );

  const restoreSavedSelection = useCallback((): HTMLElement | null => {
    if (activeIndex === null) return null;
    const target = editableRefs.current[activeIndex];
    const saved = selectionRef.current;
    if (!target || !saved || saved.index !== activeIndex) {
      return target;
    }

    const selection = window.getSelection();
    if (!selection) return target;

    target.focus();
    selection.removeAllRanges();
    selection.addRange(saved.range);
    return target;
  }, [activeIndex]);

  const applySelectionFontSize = useCallback(
    (px: number) => {
      if (activeIndex === null) return;
      const target = restoreSavedSelection() ?? editableRefs.current[activeIndex];
      if (!target) return;

      document.execCommand("fontSize", false, "7");
      const sizedNodes = target.querySelectorAll('font[size="7"]');
      sizedNodes.forEach((fontEl) => {
        const span = document.createElement("span");
        span.style.fontSize = `${px}px`;
        span.innerHTML = (fontEl as HTMLElement).innerHTML;
        fontEl.replaceWith(span);
      });

      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        selectionRef.current = {
          index: activeIndex,
          range: selection.getRangeAt(0).cloneRange(),
        };
      }
      setFontSizePx(px);
    },
    [activeIndex, restoreSavedSelection],
  );

  const splitPoint = useCallback(
    (index: number) => {
      if (!onUpdate) return;
      const target = editableRefs.current[index];
      const current = parsedContent[index];
      if (!target || !current) return;

      const split = getCaretSplitHtml(target);
      if (!split) return;

      const next = [...slide.content];
      next[index] = composeContent(current.type, split.before);
      next.splice(index + 1, 0, composeContent(current.type, split.after));

      pendingFocusRef.current = { index: index + 1, atStart: true };
      onUpdate({ ...slide, content: next });
    },
    [onUpdate, parsedContent, slide],
  );

  const mergeWithPrevious = useCallback(
    (index: number) => {
      if (!onUpdate || index <= 0) return;
      const current = parsedContent[index];
      const previous = parsedContent[index - 1];
      if (!current || !previous) return;

      const mergedType = previous.type;
      const mergedHtml = `${previous.content}${previous.content && current.content ? " " : ""}${current.content}`;
      const next = [...slide.content];
      next[index - 1] = composeContent(mergedType, mergedHtml);
      next.splice(index, 1);

      pendingFocusRef.current = { index: index - 1, atStart: false };
      onUpdate({ ...slide, content: next });
    },
    [onUpdate, parsedContent, slide],
  );

  const deleteContentBlock = useCallback(
    (index: number) => {
      if (!onUpdate) return;
      const next = [...slide.content];
      if (index < 0 || index >= next.length) return;
      next.splice(index, 1);
      onUpdate({ ...slide, content: next });
      const focusIndex = Math.max(0, index - 1);
      pendingFocusRef.current = { index: focusIndex, atStart: false };
    },
    [onUpdate, slide],
  );

  const baseText = `${config.textColor} ${bodyTextClass} leading-relaxed`;

  const isToolbarFocusTarget = useCallback((event: FocusEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    return !!nextTarget && !!toolbarRef.current?.contains(nextTarget);
  }, []);

  const addContentBlock = useCallback(
    (kind: "heading" | "subheading" | "paragraph" | "bullet" | "table") => {
      if (!onUpdate) return;

      if (kind === "heading") {
        onUpdate({ ...slide, title: "Heading" });
        return;
      }

      if (kind === "table") {
        onUpdate({
          ...slide,
          type: "table",
          content: [
            "Column 1 | Column 2 | Column 3",
            "Value 1 | Value 2 | Value 3",
          ],
        });
        return;
      }

      const templateByKind: Record<"subheading" | "paragraph" | "bullet", string> = {
        subheading: composeContent("subheading", "Subheading"),
        paragraph: composeContent("paragraph", "Add paragraph text here."),
        bullet: composeContent("bullet", "Bullet point"),
      };

      const nextContent = [...slide.content];
      const isStarter =
        nextContent.length === 0 ||
        (nextContent.length === 1 &&
          detectContent(nextContent[0]).content.trim().toLowerCase() ===
            "add your content here");

      if (isStarter) {
        nextContent.length = 0;
      }

      nextContent.push(templateByKind[kind]);
      pendingFocusRef.current = { index: nextContent.length - 1, atStart: false };
      onUpdate({
        ...slide,
        type: slide.type === "table" ? "content" : slide.type,
        content: nextContent,
      });
    },
    [onUpdate, slide],
  );

  const hasMedia = !!(slide.imageUrl || slide.videoUrl || slide.embedUrl || slide.embedHtml);

  const updateMedia = useCallback(
    (
      next: Partial<
        Pick<Slide, "imageUrl" | "videoUrl" | "embedUrl" | "embedHtml" | "mediaAlignment">
      >,
    ) => {
      if (!onUpdate) return;
      onUpdate({
        ...slide,
        ...next,
        type: "media",
        mediaAlignment: next.mediaAlignment ?? slide.mediaAlignment ?? "right",
      });
    },
    [onUpdate, slide],
  );

  const handleEmbed = useCallback(() => {
    const existing = slide.embedUrl ?? "";
    const url = window.prompt("Paste embeddable URL", existing);
    if (url === null) return;
    const trimmed = url.trim();
    if (!trimmed) return;

    const imageUrlPattern = /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i;
    const videoUrlPattern = /\.(mp4|webm|ogg|mov)(\?.*)?$/i;

    if (imageUrlPattern.test(trimmed)) {
      updateMedia({ imageUrl: trimmed, videoUrl: undefined, embedUrl: undefined, embedHtml: undefined });
      setIsMediaMenuOpen(false);
      return;
    }

    if (videoUrlPattern.test(trimmed)) {
      updateMedia({ videoUrl: trimmed, imageUrl: undefined, embedUrl: undefined, embedHtml: undefined });
      setIsMediaMenuOpen(false);
      return;
    }

    updateMedia({ embedUrl: trimmed, imageUrl: undefined, videoUrl: undefined, embedHtml: undefined });
    setIsMediaMenuOpen(false);
  }, [slide.embedUrl, updateMedia]);

  const handleAttach = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleAttachFile = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      const isHtml = file.type === "text/html" || /\.html?$/i.test(file.name);

      if (isHtml) {
        const reader = new FileReader();
        reader.onload = () => {
          updateMedia({
            embedHtml: String(reader.result || ""),
            imageUrl: undefined,
            videoUrl: undefined,
            embedUrl: undefined,
          });
        };
        reader.readAsText(file);
      } else if (isImage || isVideo) {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || "");
          if (isImage) {
            updateMedia({
              imageUrl: dataUrl,
              videoUrl: undefined,
              embedUrl: undefined,
              embedHtml: undefined,
            });
          } else {
            updateMedia({
              videoUrl: dataUrl,
              imageUrl: undefined,
              embedUrl: undefined,
              embedHtml: undefined,
            });
          }
        };
        reader.readAsDataURL(file);
      } else {
        window.alert("Unsupported file. Please attach image, video, or HTML.");
      }

      e.target.value = "";
      setIsMediaMenuOpen(false);
    },
    [updateMedia],
  );

  const removeImage = useCallback(() => {
    if (!onUpdate) return;
    onUpdate({
      ...slide,
      imageUrl: undefined,
      videoUrl: undefined,
      embedUrl: undefined,
      embedHtml: undefined,
      type: "media",
    });
  }, [onUpdate, slide]);

  const setMediaAlign = useCallback(
    (mediaAlignment: "left" | "right") => {
      if (!onUpdate || !hasMedia) return;
      onUpdate({ ...slide, mediaAlignment, type: "media" });
    },
    [hasMedia, onUpdate, slide],
  );

  const getEdgeTextNode = useCallback(
    (root: Node, direction: "start" | "end"): Node => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const texts: Text[] = [];
      let current = walker.nextNode();
      while (current) {
        const textNode = current as Text;
        if ((textNode.textContent || "").length > 0) {
          texts.push(textNode);
        }
        current = walker.nextNode();
      }
      if (texts.length === 0) return root;
      return direction === "start" ? texts[0] : texts[texts.length - 1];
    },
    [],
  );

  const selectAcrossContentBlocks = useCallback(
    (fromIndex: number, toIndex: number) => {
      const start = Math.min(fromIndex, toIndex);
      const end = Math.max(fromIndex, toIndex);
      const startEl = editableRefs.current[start];
      const endEl = editableRefs.current[end];
      if (!startEl || !endEl) return;

      const startNode = getEdgeTextNode(startEl, "start");
      const endNode = getEdgeTextNode(endEl, "end");

      const range = document.createRange();
      range.setStart(startNode, 0);
      const endOffset =
        endNode.nodeType === Node.TEXT_NODE
          ? (endNode.textContent || "").length
          : endNode.childNodes.length;
      range.setEnd(endNode, endOffset);

      const selection = window.getSelection();
      if (!selection) return;
      selection.removeAllRanges();
      selection.addRange(range);
      selectionRef.current = { index: end, range: range.cloneRange() };
    },
    [getEdgeTextNode],
  );

  const showEmptySlideQuickActions =
    !!onUpdate &&
    (slide.content.length === 0 ||
      (slide.content.length === 1 &&
        detectContent(slide.content[0]).content.trim().toLowerCase() ===
          "add your content here"));

  const subheadingIndices = useMemo(
    () =>
      parsedContent.reduce<number[]>((acc, item, index) => {
        if (item.type === "subheading") acc.push(index);
        return acc;
      }, []),
    [parsedContent],
  );

  const canRenderTwoColumns =
    !slide.imageUrl &&
    slide.type !== "table" &&
    subheadingIndices.length >= 2 &&
    (slide.title.toLowerCase().includes("two content") ||
      slide.title.toLowerCase().includes("comparison"));

  const splitIndex = canRenderTwoColumns ? subheadingIndices[1] : -1;
  const mediaPreviewNode = slide.videoUrl ? (
    <video
      src={slide.videoUrl}
      className="w-full h-40 md:h-56 rounded-lg border border-white/25 object-cover"
      controls
    />
  ) : slide.embedHtml ? (
    <iframe
      srcDoc={slide.embedHtml}
      title="Embedded HTML"
      className="w-full h-40 md:h-56 rounded-lg border border-white/25 bg-white"
      sandbox="allow-same-origin allow-scripts"
    />
  ) : slide.embedUrl ? (
    <iframe
      src={slide.embedUrl}
      title="Embedded content"
      className="w-full h-40 md:h-56 rounded-lg border border-white/25 bg-white"
      sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
    />
  ) : slide.imageUrl ? (
    <img
      src={slide.imageUrl}
      alt="Slide media"
      className="w-full h-40 md:h-56 rounded-lg border border-white/25 object-cover"
    />
  ) : null;
  const showMediaPlaceholder = slide.type === "media" && !mediaPreviewNode;

  const renderContentItem = (item: (typeof parsedContent)[number], index: number) => {
    const fractionOnly = isFractionOnly(item.content);

    const editor = onUpdate ? (
      <div
        ref={(el) => {
          editableRefs.current[index] = el;
        }}
        className={`${baseText} rounded px-1 -mx-1 focus:outline-none focus:ring-2 focus:ring-white/25`}
        contentEditable
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: renderHtml(item.content) }}
        onFocus={() => {
          setActiveIndex(index);
          captureSelection(index);
        }}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          dragSelectRef.current.active = true;
          dragSelectRef.current.startIndex = index;
        }}
        onMouseEnter={(e) => {
          const drag = dragSelectRef.current;
          if (!drag.active || drag.startIndex === null) return;
          if ((e.buttons & 1) !== 1) return;
          selectAcrossContentBlocks(drag.startIndex, index);
        }}
        onMouseUp={() => captureSelection(index)}
        onKeyUp={() => captureSelection(index)}
        onSelect={() => captureSelection(index)}
        onBlur={(e) => {
          if (isToolbarFocusTarget(e)) {
            captureSelection(index);
            return;
          }
          updateContentAt(index, item.type, e.currentTarget.innerHTML);
        }}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          if (!onUpdate) {
            document.execCommand("insertText", false, text);
            return;
          }

          const normalized = text.replace(/\r\n/g, "\n").trimEnd();

          if (slide.type === "table" && normalized.includes("\t")) {
            const rows = normalized
              .split("\n")
              .map((row) =>
                row
                  .split("\t")
                  .map((cell) => cell.trim())
                  .filter((cell) => cell.length > 0),
              )
              .filter((cells) => cells.length > 0)
              .map((cells) => cells.join(" | "));

            if (rows.length > 0) {
              const next = [...slide.content];
              next[index] = rows[0];
              if (rows.length > 1) {
                next.splice(index + 1, 0, ...rows.slice(1));
              }
              pendingFocusRef.current = {
                index: index + rows.length - 1,
                atStart: false,
              };
              onUpdate({ ...slide, content: next });
            }
            return;
          }

          if (item.type === "bullet") {
            const lines = normalized
              .split("\n")
              .map((line) => line.trim())
              .filter((line) => line.length > 0);

            if (lines.length === 0) return;

            const stripBulletPrefix = (value: string) =>
              value.replace(/^(?:[-*\u2022\u25E6]|\d+[.)])\s+/, "").trim();

            const next = [...slide.content];
            next[index] = composeContent("bullet", stripBulletPrefix(lines[0]));
            if (lines.length > 1) {
              const extras = lines
                .slice(1)
                .map((line) => composeContent("bullet", stripBulletPrefix(line)));
              next.splice(index + 1, 0, ...extras);
            }
            pendingFocusRef.current = {
              index: index + lines.length - 1,
              atStart: false,
            };
            onUpdate({ ...slide, content: next });
            return;
          }

          const parsed = normalized
            .split("\n")
            .map(parsePastedLine)
            .filter((line): line is { type: ContentType; content: string } => !!line);

          if (parsed.length === 0) {
            return;
          }

          const next = [...slide.content];
          next[index] = composeContent(parsed[0].type, parsed[0].content);
          if (parsed.length > 1) {
            const extras = parsed
              .slice(1)
              .map((line) => composeContent(line.type, line.content));
            next.splice(index + 1, 0, ...extras);
          }
          pendingFocusRef.current = {
            index: index + parsed.length - 1,
            atStart: false,
          };
          onUpdate({ ...slide, content: next });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            splitPoint(index);
            return;
          }

          if (e.key === "Backspace") {
            const sel = window.getSelection();
            if (
              sel &&
              sel.rangeCount > 0 &&
              sel.isCollapsed &&
              sel.getRangeAt(0).startOffset === 0 &&
              index > 0
            ) {
              const range = sel.getRangeAt(0);
              if (e.currentTarget.contains(range.startContainer)) {
                e.preventDefault();
                mergeWithPrevious(index);
              }
            }
          }
        }}
      />
    ) : (
      <span
        className={`${baseText} inline-flex items-center`}
        dangerouslySetInnerHTML={{ __html: renderHtml(item.content) }}
      />
    );

    const block = item.type === "subheading" ? (
      <div className={`${baseText} font-semibold mt-6`}>{editor}</div>
    ) : item.type === "bullet" ? (
      <div className={`flex gap-4 ${fractionOnly ? "items-center" : "items-start"}`}>
        <span
          className={`${fractionOnly ? "mt-0" : "mt-3"} w-3 h-3 rounded-full ${config.accentColor}`}
        />
        {editor}
      </div>
    ) : (
      <div className={baseText}>{editor}</div>
    );

    if (!onUpdate) {
      return <div key={index}>{block}</div>;
    }

    return (
      <ContextMenu key={index}>
        <ContextMenuTrigger asChild>
          <div>{block}</div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => deleteContentBlock(index)}>
            Delete Block
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <div
      className={`relative w-full h-full bg-gradient-to-br ${config.bgGradient} p-8 md:p-14 flex flex-col overflow-hidden`}
    >
      {onUpdate && (
        <div
          ref={toolbarRef}
          className="absolute top-4 right-4 z-20 flex flex-nowrap items-center justify-end gap-2 rounded-lg border border-white/20 bg-black/35 px-2 py-1 backdrop-blur max-w-[calc(100%-1.5rem)] overflow-x-auto"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/15"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat("bold")}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/15"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat("italic")}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1 rounded border border-white/20 bg-black/20 px-1.5 py-1">
            <span className="text-[11px] text-white/80 leading-none">Size</span>
            <select
              value={fontSizePx}
              onMouseDown={() => {
                if (activeIndex !== null) {
                  captureSelection(activeIndex);
                }
              }}
              onFocus={() => {
                if (activeIndex !== null) {
                  captureSelection(activeIndex);
                }
              }}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isNaN(next)) return;
                applySelectionFontSize(next);
              }}
              className="h-6 w-16 rounded border border-white/30 bg-black/30 px-1 text-xs text-white outline-none"
              title="Font size"
            >
              {fontSizeOptions.map((size) => (
                <option key={size} value={size} className="text-black">
                  {size}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-white/70 leading-none">pt</span>
          </div>
          <div className="flex items-center gap-1 rounded border border-white/20 bg-black/20 px-1.5 py-1">
            <span className="text-[11px] text-white/80 leading-none">Font</span>
            <select
              value={selectedFontFamily}
              onMouseDown={() => {
                if (activeIndex !== null) {
                  captureSelection(activeIndex);
                }
              }}
              onChange={(e) => {
                const font = e.target.value;
                setSelectedFontFamily(font);
                execFormat("fontName", font);
              }}
              className="h-6 w-32 rounded border border-white/30 bg-black/30 px-1 text-xs text-white outline-none"
              title="Font family"
            >
              {fontFamilyOptions.map((font) => (
                <option key={font} value={font} className="text-black">
                  {font}
                </option>
              ))}
            </select>
          </div>
          <input
            type="color"
            value={selectedColor}
            onMouseDown={() => {
              if (activeIndex !== null) {
                captureSelection(activeIndex);
              }
            }}
            onChange={(e) => {
              const color = e.target.value;
              setSelectedColor(color);
              execFormat("foreColor", color);
            }}
            className="h-8 w-8 cursor-pointer rounded border border-white/30 bg-transparent p-0"
            title="Text color"
          />
          <div className="flex items-center gap-1 rounded border border-white/20 bg-black/20 px-1.5 py-1">
            <span className="text-[11px] text-white/80 leading-none">Add</span>
            <select
              defaultValue=""
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => {
                const next = e.target.value as "" | "heading" | "subheading" | "paragraph" | "bullet" | "table";
                if (!next) return;
                addContentBlock(next);
                e.currentTarget.value = "";
              }}
              className="h-6 w-32 rounded border border-white/30 bg-black/30 px-1 text-xs text-white outline-none"
              title="Add block"
            >
              <option value="" className="text-black">Select</option>
              <option value="heading" className="text-black">Heading</option>
              <option value="subheading" className="text-black">Subheading</option>
              <option value="paragraph" className="text-black">Paragraph</option>
              <option value="bullet" className="text-black">Bullet</option>
              <option value="table" className="text-black">Table</option>
            </select>
          </div>
          <div className="flex items-center gap-1 rounded border border-white/20 bg-black/20 px-1.5 py-1">
            <span className="text-[11px] text-white/80 leading-none">Media</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-white hover:bg-white/15"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (hasMedia) {
                  setIsMediaMenuOpen((prev) => !prev);
                }
              }}
              disabled={!hasMedia}
            >
              Add
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-white hover:bg-white/15"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setMediaAlign("left")}
              disabled={!hasMedia}
            >
              Left
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-white hover:bg-white/15"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setMediaAlign("right")}
              disabled={!hasMedia}
            >
              Right
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-white hover:bg-white/15"
              onMouseDown={(e) => e.preventDefault()}
              onClick={removeImage}
              disabled={!hasMedia}
            >
              Remove
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,.html,.htm,text/html"
            className="hidden"
            onChange={handleAttachFile}
          />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto pb-16 pr-1">
        <div className="min-h-full flex flex-col justify-center">
          <div className={sectionSpacingClass}>
            <div className={`w-16 h-1 ${config.accentColor} mb-4`} />
            <h2
              ref={titleRef}
              className={`${titleTextClass} font-bold ${config.textColor}`}
              contentEditable={!!onUpdate}
              suppressContentEditableWarning
              onBlur={(e) => {
                if (!onUpdate) return;
                onUpdate({ ...slide, title: e.currentTarget.textContent?.trim() || "Untitled Slide" });
              }}
            >
              {slide.title}
            </h2>
          </div>

          {showEmptySlideQuickActions && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <span className={`${config.textColor} text-sm opacity-80`}>Add:</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 bg-white/15 text-white hover:bg-white/25"
                onClick={() => addContentBlock("heading")}
              >
                Heading
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 bg-white/15 text-white hover:bg-white/25"
                onClick={() => addContentBlock("subheading")}
              >
                Subheading
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 bg-white/15 text-white hover:bg-white/25"
                onClick={() => addContentBlock("paragraph")}
              >
                Paragraph
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 bg-white/15 text-white hover:bg-white/25"
                onClick={() => addContentBlock("bullet")}
              >
                Bullet
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 bg-white/15 text-white hover:bg-white/25"
                onClick={() => addContentBlock("table")}
              >
                Table
              </Button>
            </div>
          )}

          <div
            className={`grid grid-cols-1 ${
              mediaPreviewNode || showMediaPlaceholder ? "md:grid-cols-2 gap-6 items-start" : ""
            }`}
          >
            {(mediaPreviewNode || showMediaPlaceholder) && (
              <div className={(slide.mediaAlignment || "right") === "left" ? "md:order-1" : "md:order-2"}>
                <div className="relative">
                  {mediaPreviewNode ? (
                    <button
                      type="button"
                      onClick={() => setIsMediaMenuOpen(true)}
                      className="w-full text-left rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-white/40"
                      title="Change media"
                    >
                      {mediaPreviewNode}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsMediaMenuOpen(true)}
                      className="w-full h-40 md:h-56 rounded-lg border border-dashed border-white/70 bg-transparent text-white flex items-center justify-center hover:bg-white/5"
                      title="Add media"
                    >
                      <span className="inline-flex items-center gap-2 text-lg font-medium">
                        <Plus className="h-5 w-5" />
                        Add
                      </span>
                    </button>
                  )}

                  {isMediaMenuOpen && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 rounded-lg">
                      <div className="rounded-lg border border-white/20 bg-black/75 backdrop-blur px-3 py-2 flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-3 text-xs text-white hover:bg-white/15"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={handleEmbed}
                        >
                          {hasMedia ? "Replace Embed" : "Embed"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-3 text-xs text-white hover:bg-white/15"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={handleAttach}
                        >
                          {hasMedia ? "Replace Attach" : "Attach"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-3 text-xs text-red-200 hover:bg-red-500/20"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            removeImage();
                            setIsMediaMenuOpen(false);
                          }}
                          disabled={!hasMedia}
                        >
                          Delete
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-3 text-xs text-white/80 hover:bg-white/10"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setIsMediaMenuOpen(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div
              className={
                mediaPreviewNode || showMediaPlaceholder
                  ? (slide.mediaAlignment || "right") === "left"
                    ? "md:order-2"
                    : "md:order-1"
                  : ""
              }
            >
              {canRenderTwoColumns ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className={verticalGapClass}>
                    {parsedContent.map((item, index) =>
                      index < splitIndex ? renderContentItem(item, index) : null,
                    )}
                  </div>
                  <div className={verticalGapClass}>
                    {parsedContent.map((item, index) =>
                      index >= splitIndex ? renderContentItem(item, index) : null,
                    )}
                  </div>
                </div>
              ) : (
                <div className={verticalGapClass}>
                  {parsedContent.map((item, index) => renderContentItem(item, index))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export { EditableSlide as AnimatedSlide };
