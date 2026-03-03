import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation } from "@tanstack/react-query";
import {
  type Presentation,
  type SlideTheme,
  slideThemes,
} from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { SlideRenderer } from "@/components/slide-renderer";
import { SlideThumbnail } from "@/components/slide-thumbnail";
import { PresentationViewer } from "@/components/presentation-viewer";
import { buildDownloadHtml } from "@/lib/export_html";
import { useToast } from "@/hooks/use-toast";
import {
  Presentation as PresentationIcon,
  ArrowLeft,
  Sparkles,
  Play,
  Pencil,
  Loader2,
  FileText,
  Video,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

const exampleData = `Company Annual Report 2024

Executive Summary
Our company achieved record growth with 45 % increase in revenue.We expanded to 3 new markets and launched 2 innovative products.Customer satisfaction reached an all - time high of 94 %.

Key Achievements
  - Revenue increased from $50M to $72.5M
    - Customer base grew by 60,000 new users
      - Team expanded to 250 + employees
        - Successfully launched mobile app with 100K downloads
          - Reduced operational costs by 15 %

            Market Expansion
We entered the European market with offices in London and Berlin.Asia - Pacific region saw 80 % growth.New partnerships established with 25 enterprise clients.

Product Innovation
Launched AI - powered analytics dashboard.Released mobile application for iOS and Android.Introduced real - time collaboration features.

Looking Ahead
Plans for 2025 include expanding to 5 additional markets.Focus on AI integration across all products.Target of reaching $100M in revenue.`;

export default function Create() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const initialTheme = (params.get("theme") as SlideTheme) || "modern";
  const returnedFromEditor = params.get("fromEditor") === "1";
  const isEmbedded = window.top !== window.self;

  const [rawData, setRawData] = useState("");
  const [title, setTitle] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<SlideTheme>(initialTheme);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const { toast } = useToast();
  const editorStorageKey = "slideai-editor-presentation";

  const generateMutation = useMutation({
    mutationFn: async (data: { title: string; rawData: string; theme: SlideTheme }) => {
      const res = await apiRequest("POST", "/api/presentations/generate", data);
      return res.json();
    },
    onSuccess: (data: Presentation) => {
      setPresentation(data);
      setCurrentSlide(0);
      sessionStorage.setItem(editorStorageKey, JSON.stringify(data));
      toast({
        title: "Slides generated!",
        description: `Created ${data.slides.length} slides from your content.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate slides. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your presentation.",
        variant: "destructive",
      });
      return;
    }
    if (!rawData.trim()) {
      toast({
        title: "No content provided",
        description: "Please paste your structured data to generate slides.",
        variant: "destructive",
      });
      return;
    }
    generateMutation.mutate({ title, rawData, theme: selectedTheme });
  };



  const triggerHtmlDownload = (target: Presentation, filenameSuffix: string, autoPlay = false) => {
    const html = buildDownloadHtml(target, autoPlay);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${target.title.replace(/[^a-z0-9]/gi, "_")}${filenameSuffix}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenEditor = () => {
    if (!presentation) return;
    const updatedPresentation = { ...presentation, title, rawData, theme: selectedTheme };
    sessionStorage.setItem(editorStorageKey, JSON.stringify(updatedPresentation));
    navigate(isEmbedded ? "/editor?from=create&embedded=true" : "/editor?from=create");
  };

  const handleSaveToLesson = () => {
    if (!presentation) return;
    const updatedPresentation = { ...presentation, title, rawData, theme: selectedTheme };
    const rawHtml = buildDownloadHtml(updatedPresentation);
    window.parent.postMessage(
      JSON.stringify({ type: "SLIDE_SAVED", presentationId: presentation.id, rawHtml, title: title || presentation.title }),
      "*"
    );
  };

  const handleDownloadHtml = () => {
    if (!presentation) return;
    const updatedPresentation = { ...presentation, title, rawData, theme: selectedTheme };
    triggerHtmlDownload(updatedPresentation, "");
  };

  const handleDownloadVideo = () => {
    if (!presentation) return;
    const updatedPresentation = { ...presentation, title, rawData, theme: selectedTheme };
    triggerHtmlDownload(updatedPresentation, "_video", true);
    toast({
      title: "Video package downloaded",
      description: "Downloaded as an auto-play HTML video package.",
    });
  };

  const handleLoadExample = () => {
    setRawData(exampleData);
    toast({
      title: "Example loaded",
      description: "Sample annual report data has been loaded.",
    });
  };

  useEffect(() => {
    if (!isEmbedded) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data === "REQUEST_SAVE") {
        handleSaveToLesson();
      } else {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "INIT_PRESENTATION" && data.data) {
            try {
              const decodedStr = decodeURIComponent(window.atob(data.data));
              const presentation = JSON.parse(decodedStr) as Presentation;

              if (presentation && presentation.slides && presentation.slides.length > 0) {
                setTitle(presentation.title);
                setSelectedTheme(presentation.theme);
                if (presentation.rawData) {
                  setRawData(presentation.rawData);
                }
                setPresentation(presentation);
                setCurrentSlide(0);
                sessionStorage.setItem(editorStorageKey, JSON.stringify(presentation));
              }
            } catch (e) {
              console.error("Failed to parse INIT_PRESENTATION data", e);
            }
          }
        } catch (e) {
          // ignore non-json messages
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [presentation, isEmbedded, title, rawData, selectedTheme]); // Keep listener fresh when fields change

  // Broadcast if the presentation is ready to save (has a title and slides)
  useEffect(() => {
    if (!isEmbedded) return;
    const canSave = !!presentation && !!presentation.title?.trim() && presentation.slides.length > 0;
    window.parent.postMessage(
      JSON.stringify({ type: "SLIDE_STATE", canSave }),
      "*"
    );
  }, [presentation, isEmbedded]);

  useEffect(() => {
    if (!returnedFromEditor) return;
    const raw = sessionStorage.getItem(editorStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Presentation;
      if (!parsed?.slides?.length) return;
      setPresentation(parsed);
      setCurrentSlide(0);
      toast({
        title: "Changes saved",
        description: "Your edited slides were loaded.",
      });
    } catch {
      // no-op
    }
  }, [returnedFromEditor, toast]);

  useEffect(() => {
    if (!presentation || isViewerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName.toLowerCase();
        const isTypingField =
          target.isContentEditable ||
          tagName === "input" ||
          tagName === "textarea" ||
          tagName === "select";
        if (isTypingField) {
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
  }, [presentation, isViewerOpen]);

  const hasChanges = !presentation ||
    title !== presentation.title ||
    rawData !== (presentation.rawData || "") ||
    selectedTheme !== presentation.theme;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {!isEmbedded && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/")}
                  data-testid="button-back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                    <PresentationIcon className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <span className="font-semibold text-lg text-foreground hidden sm:inline">
                    SlideAI
                  </span>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {presentation && (
              <Button
                onClick={handleOpenEditor}
                className="gap-2"
                variant="outline"
                data-testid="button-edit-page"
              >
                <Pencil className="w-4 h-4" />
                <span className="hidden sm:inline">Edit Page</span>
              </Button>
            )}
            {presentation && (
              <Button
                onClick={handleDownloadHtml}
                className="gap-2"
                variant="outline"
                data-testid="button-download-html"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Download HTML</span>
              </Button>
            )}
            {presentation && (
              <Button
                onClick={handleDownloadVideo}
                className="gap-2"
                variant="outline"
                data-testid="button-download-video"
              >
                <Video className="w-4 h-4" />
                <span className="hidden sm:inline">Download Video</span>
              </Button>
            )}
            {presentation && (
              <Button
                onClick={() => setIsViewerOpen(true)}
                className="gap-2"
                data-testid="button-present"
              >
                <Play className="w-4 h-4" />
                <span className="hidden sm:inline">Present</span>
              </Button>
            )}

            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 w-full h-[calc(100vh-73px)] flex">
        {/* Sidebar - collapsible */}
        <div className="hidden lg:block w-80 border-r border-border bg-background overflow-y-auto p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                Your Content
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground mr-1 hidden sm:inline">Theme:</span>
                <Select
                  value={selectedTheme}
                  onValueChange={(v) => setSelectedTheme(v as SlideTheme)}
                >
                  <SelectTrigger
                    className="w-[140px]"
                    data-testid="select-theme"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {slideThemes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadExample}
                  className="gap-1.5"
                  data-testid="button-load-example"
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Example</span>
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">Presentation Title</span>
              <Input
                placeholder="Enter presentation title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <Textarea
              placeholder="Paste your structured content here...

Examples of what works well:
• Reports with sections and bullet points
• Meeting notes with key topics
• Product descriptions with features
• Research findings with conclusions
• Project updates with milestones

The AI will analyze your content and create organized slides automatically."
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
              className="min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] resize-none text-base"
              data-testid="textarea-content"
            />

            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !rawData.trim() || !title.trim() || !hasChanges}
              className="w-full gap-2"
              size="lg"
              data-testid="button-generate"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating Slides...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  {presentation ? "Regenerate Slides" : "Generate Slides"}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Main Editor Area - Full Page */}
        <div className="flex-1 flex flex-col overflow-hidden bg-muted/30">
          {presentation ? (
            <>
              {/* Slide Preview - Full Page */}
              <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 lg:p-8 min-h-0 gap-3">
                <div className="w-full max-w-[90vw] max-w-5xl flex items-center justify-between gap-3">
                  <div className="text-left text-sm sm:text-base text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      Slide {currentSlide + 1}:
                    </span>{" "}
                    {presentation.slides[currentSlide]?.title}
                  </div>
                </div>
                <div className="w-full h-full max-w-[90vw] max-h-[85vh] flex items-center justify-center">
                  <div className="w-full h-full" style={{ aspectRatio: '16/9' }}>
                    <SlideRenderer
                      slide={presentation.slides[currentSlide]}
                      theme={presentation.theme}
                      slideNumber={currentSlide + 1}
                      totalSlides={presentation.slides.length}
                    />
                  </div>
                </div>
              </div>

              {/* Navigation Controls */}
              <div className="px-4 md:p-6 lg:p-8 pb-4 flex items-center justify-between w-full gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentSlide((p) => Math.max(0, p - 1))}
                  disabled={currentSlide === 0}
                  data-testid="button-prev-preview"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                <ScrollArea className="flex-1 h-24 sm:h-28">
                  <div className="flex gap-3 pb-2 justify-center">
                    {presentation.slides.map((slide, idx) => (
                      <div key={slide.id} className="flex-shrink-0 w-32 sm:w-36">
                        <SlideThumbnail
                          slide={slide}
                          theme={presentation.theme}
                          slideNumber={idx + 1}
                          isActive={currentSlide === idx}
                          onClick={() => setCurrentSlide(idx)}
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {currentSlide + 1} / {presentation.slides.length}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setCurrentSlide((p) =>
                        Math.min(presentation.slides.length - 1, p + 1)
                      )
                    }
                    disabled={currentSlide === presentation.slides.length - 1}
                    data-testid="button-next-preview"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-4 md:p-6 lg:p-8">
              <Card className="aspect-video flex flex-col items-center justify-center text-center p-8 bg-muted/50">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <PresentationIcon className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No slides yet
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Paste your content and click "Generate Slides" to create your
                  presentation
                </p>
              </Card>
            </div>
          )}
        </div>
      </main>

      {presentation && isViewerOpen && (
        <PresentationViewer
          presentation={presentation}
          onClose={() => setIsViewerOpen(false)}
        />
      )}
    </div>
  );
}
