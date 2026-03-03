import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  type Presentation,
  type Slide,
  type SlideTransition,
  slideTransitions,
  type SlideTheme,
  slideThemes,
} from "@shared/schema";
import { Button } from "@/components/ui/button";
import { EditableSlide } from "@/components/editable-slide";
import { SlideThumbnail } from "@/components/slide-thumbnail";
import { PresentationViewer } from "@/components/presentation-viewer";
import { buildDownloadHtml } from "@/lib/export_html";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ChevronLeft, ChevronRight, Play, ArrowLeft, Sparkles } from "lucide-react";

const STORAGE_KEY = "slideai-editor-presentation";

export default function Editor() {
  const [, navigate] = useLocation();
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const search = useSearch();
  const params = new URLSearchParams(search);
  const isEmbedded = window.top !== window.self;

  const returnToCreate = useCallback(() => {
    if (!presentation) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(presentation));

    if (isEmbedded) {
      // Send stringified JSON to parent iframe to save and close
      const rawHtml = buildDownloadHtml(presentation);
      window.parent.postMessage(JSON.stringify({
        type: 'SLIDE_SAVED',
        presentationId: presentation.id,
        rawHtml,
        title: presentation.title
      }), '*');
    } else {
      navigate("/create?fromEditor=1");
    }
  }, [navigate, presentation, isEmbedded]);

  useEffect(() => {
    if (!isEmbedded) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data === "REQUEST_SAVE") {
        returnToCreate();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [returnToCreate, isEmbedded]);

  // Broadcast if the presentation is ready to save
  useEffect(() => {
    if (!isEmbedded) return;
    const canSave = !!presentation && !!presentation.title?.trim() && presentation.slides.length > 0;
    window.parent.postMessage(
      JSON.stringify({ type: "SLIDE_STATE", canSave }),
      "*"
    );
  }, [presentation, isEmbedded]);

  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      navigate("/create");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Presentation;
      if (!parsed?.slides?.length) {
        navigate(isEmbedded ? "/create?embedded=true" : "/create");
        return;
      }
      setPresentation(parsed);
      setCurrentSlide(0);
    } catch {
      navigate(isEmbedded ? "/create?embedded=true" : "/create");
    }
  }, [navigate, isEmbedded]);

  const savePresentation = useCallback((next: Presentation) => {
    setPresentation(next);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const handleSlideUpdate = useCallback(
    (updatedSlide: Slide) => {
      if (!presentation) return;
      const nextSlides = presentation.slides.map((s) =>
        s.id === updatedSlide.id ? updatedSlide : s,
      );
      savePresentation({ ...presentation, slides: nextSlides });
    },
    [presentation, savePresentation],
  );

  const handleTransitionChange = useCallback(
    (transition: SlideTransition) => {
      if (!presentation) return;
      const nextSlides = presentation.slides.map((slide, index) =>
        index === currentSlide ? { ...slide, transition } : slide,
      );
      savePresentation({ ...presentation, slides: nextSlides });
    },
    [currentSlide, presentation, savePresentation],
  );

  const slideTransition = useMemo(
    () => presentation?.slides[currentSlide]?.transition || "fade",
    [currentSlide, presentation],
  );

  const duplicateSlideAt = useCallback(
    (index: number) => {
      if (!presentation) return;
      const target = presentation.slides[index];
      if (!target) return;
      const duplicate: Slide = {
        ...target,
        id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      };
      const nextSlides = [...presentation.slides];
      nextSlides.splice(index + 1, 0, duplicate);
      savePresentation({ ...presentation, slides: nextSlides });
      setCurrentSlide(index + 1);
    },
    [presentation, savePresentation],
  );

  const addEmptySlideAfter = useCallback(
    (
      index: number,
      variant:
        | "title-slide"
        | "title-content"
        | "section-header"
        | "two-content"
        | "comparison"
        | "title-only"
        | "blank"
        | "content-caption"
        | "picture-caption" = "blank",
    ) => {
      if (!presentation) return;
      const templateByVariant: Record<
        | "title-slide"
        | "title-content"
        | "section-header"
        | "two-content"
        | "comparison"
        | "title-only"
        | "blank"
        | "content-caption"
        | "picture-caption",
        {
          title: string;
          content: string[];
          type: Slide["type"];
          imageUrl?: string;
          mediaAlignment?: "left" | "right" | "center" | "full";
          contentAlignment?: "left" | "center";
        }
      > = {
        "title-slide": {
          title: "Presentation Title",
          content: ["Subtitle or speaker name"],
          type: "title",
        },
        "title-content": {
          title: "Title and Content",
          content: [
            "Add paragraph text here.",
            "* First point",
            "* Second point",
            "* Third point",
          ],
          type: "content",
        },
        "section-header": {
          title: "Section Header",
          content: ["Section subtitle"],
          type: "title",
        },
        "two-content": {
          title: "Two Content",
          content: [
            "##SUB:Left Column",
            "* Point 1",
            "* Point 2",
            "##SUB:Right Column",
            "* Point 1",
            "* Point 2",
          ],
          type: "content",
        },
        comparison: {
          title: "Comparison",
          content: [
            "##SUB:Option A",
            "* Benefit 1",
            "* Benefit 2",
            "##SUB:Option B",
            "* Benefit 1",
            "* Benefit 2",
          ],
          type: "content",
        },
        "title-only": {
          title: "Title Only",
          content: [],
          type: "title",
        },
        blank: {
          title: "Blank",
          content: [],
          type: "content",
        },
        "content-caption": {
          title: "Content with Caption",
          content: ["##SUB:Caption", "Add caption text here.", "* Add supporting point"],
          type: "media",
          mediaAlignment: "right",
          contentAlignment: "left",
        },
        "picture-caption": {
          title: "Picture with Caption",
          content: ["##SUB:Caption", "Add picture caption here."],
          type: "media",
          mediaAlignment: "right",
          contentAlignment: "left",
        },
      };

      const selectedTemplate = templateByVariant[variant];
      const empty: Slide = {
        id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: selectedTemplate.title,
        content: selectedTemplate.content,
        type: selectedTemplate.type,
        imageUrl: selectedTemplate.imageUrl,
        mediaAlignment: selectedTemplate.mediaAlignment,
        contentAlignment: selectedTemplate.contentAlignment,
        transition: "fade",
      };
      const nextSlides = [...presentation.slides];
      nextSlides.splice(index + 1, 0, empty);
      savePresentation({ ...presentation, slides: nextSlides });
      setCurrentSlide(index + 1);
    },
    [presentation, savePresentation],
  );

  const deleteSlideAt = useCallback(
    (index: number) => {
      if (!presentation) return;
      if (presentation.slides.length <= 1) return;
      const nextSlides = presentation.slides.filter((_, i) => i !== index);
      savePresentation({ ...presentation, slides: nextSlides });
      setCurrentSlide((prev) => {
        if (prev > index) return prev - 1;
        if (prev === index) return Math.max(0, prev - 1);
        return prev;
      });
    },
    [presentation, savePresentation],
  );

  const moveSlideUp = useCallback(
    (index: number) => {
      if (!presentation || index <= 0) return;
      const nextSlides = [...presentation.slides];
      [nextSlides[index - 1], nextSlides[index]] = [
        nextSlides[index],
        nextSlides[index - 1],
      ];
      savePresentation({ ...presentation, slides: nextSlides });
      setCurrentSlide((prev) => {
        if (prev === index) return index - 1;
        if (prev === index - 1) return index;
        return prev;
      });
    },
    [presentation, savePresentation],
  );

  const moveSlideDown = useCallback(
    (index: number) => {
      if (!presentation || index >= presentation.slides.length - 1) return;
      const nextSlides = [...presentation.slides];
      [nextSlides[index], nextSlides[index + 1]] = [
        nextSlides[index + 1],
        nextSlides[index],
      ];
      savePresentation({ ...presentation, slides: nextSlides });
      setCurrentSlide((prev) => {
        if (prev === index) return index + 1;
        if (prev === index + 1) return index;
        return prev;
      });
    },
    [presentation, savePresentation],
  );

  useEffect(() => {
    if (!presentation) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName.toLowerCase();
        if (
          target.isContentEditable ||
          tagName === "input" ||
          tagName === "textarea" ||
          tagName === "select"
        ) {
          return;
        }
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentSlide((prev) => Math.max(0, prev - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentSlide((prev) =>
          Math.min(presentation.slides.length - 1, prev + 1),
        );
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [presentation]);

  if (!presentation) {
    return null;
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#dbe7e5] flex flex-col">
      <div className="h-14 border-b border-slate-300/80 bg-white/90 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isEmbedded && (
            <>
              <Button variant="ghost" size="icon" onClick={returnToCreate}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="text-sm font-medium">{presentation.title}</div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={presentation.theme}
            onValueChange={(v) => savePresentation({ ...presentation, theme: v as SlideTheme })}
          >
            <SelectTrigger className="w-[140px]" data-testid="select-theme">
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent>
              {slideThemes.map((theme) => (
                <SelectItem key={theme} value={theme}>
                  {theme.charAt(0).toUpperCase() + theme.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={slideTransition}
            onValueChange={(v) => handleTransitionChange(v as SlideTransition)}
          >
            <SelectTrigger className="w-[180px]" data-testid="select-editor-transition">
              <SelectValue placeholder="Transition" />
            </SelectTrigger>
            <SelectContent>
              {slideTransitions.map((transition) => (
                <SelectItem key={transition} value={transition}>
                  {transition
                    .split("-")
                    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                    .join(" ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setIsViewerOpen(true)} className="gap-2">
            <Play className="w-4 h-4" />
            Present
          </Button>
          {!isEmbedded && (
            <Button onClick={returnToCreate} className="gap-2">
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Save Changes</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        <aside className="w-[275px] border-r border-slate-300/80 bg-[#cfdddf]">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-3">
              {presentation.slides.map((slide, idx) => (
                <ContextMenu key={slide.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      onClick={() => setCurrentSlide(idx)}
                      className="w-full text-left cursor-pointer"
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-5 pt-1 text-slate-700">{idx + 1}</div>
                        <div
                          className={`flex-1 rounded-md border-2 p-1 ${currentSlide === idx
                            ? "border-orange-700 shadow-sm"
                            : "border-transparent"
                            }`}
                        >
                          <SlideThumbnail
                            slide={slide}
                            theme={presentation.theme}
                            slideNumber={idx + 1}
                            isActive={currentSlide === idx}
                            onClick={() => setCurrentSlide(idx)}
                          />
                        </div>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => duplicateSlideAt(idx)}>
                      Duplicate Slide
                    </ContextMenuItem>
                    <ContextMenuSub>
                      <ContextMenuSubTrigger>New Slide</ContextMenuSubTrigger>
                      <ContextMenuSubContent>
                        <ContextMenuItem onClick={() => addEmptySlideAfter(idx, "title-slide")}>
                          Title
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => addEmptySlideAfter(idx, "title-content")}>
                          Title + Text
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => addEmptySlideAfter(idx, "picture-caption")}>
                          Text + Image
                        </ContextMenuItem>
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() => moveSlideUp(idx)}
                      disabled={idx === 0}
                    >
                      Move Slide Up
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => moveSlideDown(idx)}
                      disabled={idx === presentation.slides.length - 1}
                    >
                      Move Slide Down
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() => deleteSlideAt(idx)}
                      disabled={presentation.slides.length <= 1}
                      className="text-red-600 focus:text-red-700"
                    >
                      Delete Slide
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>
          </ScrollArea>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0 p-4 md:p-6">
            <div className="h-full w-full rounded-sm border border-slate-300 bg-[#e6efed] flex items-center justify-center">
              <div className="w-full h-full p-5 flex items-center justify-center">
                <div className="w-full max-w-[1500px] aspect-video bg-white border border-slate-300 shadow-sm overflow-hidden">
                  <EditableSlide
                    slide={presentation.slides[currentSlide]}
                    theme={presentation.theme}
                    slideNumber={currentSlide + 1}
                    totalSlides={presentation.slides.length}
                    onUpdate={handleSlideUpdate}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="h-16 border-t border-slate-300/80 bg-[#d7e2e2] px-4 flex items-center justify-between">
            <div className="text-3xl text-slate-500">Click to add notes</div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentSlide((p) => Math.max(0, p - 1))}
                disabled={currentSlide === 0}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-sm text-slate-700 min-w-[64px] text-center">
                {currentSlide + 1} / {presentation.slides.length}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setCurrentSlide((p) =>
                    Math.min(presentation.slides.length - 1, p + 1),
                  )
                }
                disabled={currentSlide === presentation.slides.length - 1}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {isViewerOpen && (
        <PresentationViewer
          presentation={presentation}
          onClose={() => setIsViewerOpen(false)}
        />
      )}
    </div>
  );
}
