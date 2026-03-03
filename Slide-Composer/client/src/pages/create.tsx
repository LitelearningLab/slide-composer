import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { type Presentation, type Slide, type SlideTheme, slideThemes } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { SlideRenderer } from "@/components/slide-renderer";
import { EditableSlide } from "@/components/editable-slide";
import { SlideThumbnail } from "@/components/slide-thumbnail";
import { PresentationViewer } from "@/components/presentation-viewer";
import { useToast } from "@/hooks/use-toast";
import {
  Presentation as PresentationIcon,
  ArrowLeft,
  Sparkles,
  Play,
  Loader2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  GripVertical,
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
Our company achieved record growth with 45% increase in revenue. We expanded to 3 new markets and launched 2 innovative products. Customer satisfaction reached an all-time high of 94%.

Key Achievements
- Revenue increased from $50M to $72.5M
- Customer base grew by 60,000 new users
- Team expanded to 250+ employees
- Successfully launched mobile app with 100K downloads
- Reduced operational costs by 15%

Market Expansion
We entered the European market with offices in London and Berlin. Asia-Pacific region saw 80% growth. New partnerships established with 25 enterprise clients.

Product Innovation
Launched AI-powered analytics dashboard. Released mobile application for iOS and Android. Introduced real-time collaboration features.

Looking Ahead
Plans for 2025 include expanding to 5 additional markets. Focus on AI integration across all products. Target of reaching $100M in revenue.`;

export default function Create() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const initialTheme = (params.get("theme") as SlideTheme) || "modern";

  const [rawData, setRawData] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<SlideTheme>(initialTheme);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: async (data: { rawData: string; theme: SlideTheme }) => {
      const res = await apiRequest("POST", "/api/presentations/generate", data);
      return res.json();
    },
    onSuccess: (data: Presentation) => {
      setPresentation(data);
      setCurrentSlide(0);
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
    if (!rawData.trim()) {
      toast({
        title: "No content provided",
        description: "Please paste your structured data to generate slides.",
        variant: "destructive",
      });
      return;
    }
    generateMutation.mutate({ rawData, theme: selectedTheme });
  };

  const handleLoadExample = () => {
    setRawData(exampleData);
    toast({
      title: "Example loaded",
      description: "Sample annual report data has been loaded.",
    });
  };

  const handleSlideUpdate = (updatedSlide: Slide) => {
    if (!presentation) return;
    const newSlides = presentation.slides.map((s) =>
      s.id === updatedSlide.id ? updatedSlide : s
    );
    setPresentation({ ...presentation, slides: newSlides });
  };

  const handleAddSlide = () => {
    if (!presentation) return;
    const newSlide: Slide = {
      id: `slide-${Date.now()}`,
      title: "New Slide",
      content: ["Add your content here"],
      type: "bullets",
    };
    const newSlides = [
      ...presentation.slides.slice(0, currentSlide + 1),
      newSlide,
      ...presentation.slides.slice(currentSlide + 1),
    ];
    setPresentation({ ...presentation, slides: newSlides });
    setCurrentSlide(currentSlide + 1);
    toast({
      title: "Slide added",
      description: "New slide inserted after current slide.",
    });
  };

  const handleDeleteSlide = () => {
    if (!presentation || presentation.slides.length <= 1) {
      toast({
        title: "Cannot delete",
        description: "You need at least one slide in your presentation.",
        variant: "destructive",
      });
      return;
    }
    const newSlides = presentation.slides.filter((_, i) => i !== currentSlide);
    setPresentation({ ...presentation, slides: newSlides });
    setCurrentSlide(Math.min(currentSlide, newSlides.length - 1));
    toast({
      title: "Slide deleted",
      description: "The slide has been removed.",
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
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
          </div>
          <div className="flex items-center gap-2">
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

      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                Your Content
              </h2>
              <div className="flex items-center gap-2">
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
              disabled={generateMutation.isPending || !rawData.trim()}
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
                  Generate Slides
                </>
              )}
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                Preview
              </h2>
              {presentation && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {presentation.slides.length} slides
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddSlide}
                    className="gap-1"
                    data-testid="button-add-slide"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Add</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteSlide}
                    className="gap-1 text-destructive hover:text-destructive"
                    data-testid="button-delete-slide"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                </div>
              )}
            </div>

            {presentation ? (
              <div className="space-y-4">
                <Card className="overflow-hidden">
                  <EditableSlide
                    slide={presentation.slides[currentSlide]}
                    theme={presentation.theme}
                    slideNumber={currentSlide + 1}
                    totalSlides={presentation.slides.length}
                    onUpdate={handleSlideUpdate}
                  />
                </Card>

                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentSlide((p) => Math.max(0, p - 1))}
                    disabled={currentSlide === 0}
                    data-testid="button-prev-preview"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
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

                <ScrollArea className="h-24 sm:h-28">
                  <div className="flex gap-3 pb-2">
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
              </div>
            ) : (
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
            )}
          </div>
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
