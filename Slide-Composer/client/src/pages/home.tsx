import { useState } from "react";
import { useLocation } from "wouter";
import { type SlideTheme, slideThemes } from "@shared/schema";
import { SlideThemeCard } from "@/components/slide-theme-card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Presentation, ArrowRight, Sparkles } from "lucide-react";

export default function Home() {
  const [selectedTheme, setSelectedTheme] = useState<SlideTheme>("modern");
  const [, navigate] = useLocation();

  const handleContinue = () => {
    navigate(`/create?theme=${selectedTheme}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Presentation className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg text-foreground">SlideAI</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 sm:py-12 md:py-16">
        <div className="max-w-4xl mx-auto space-y-8 sm:space-y-12">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              AI-Powered Presentations
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground leading-tight">
              Transform Your Data Into
              <br />
              <span className="gradient-text">Stunning Presentations</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Paste your structured content, select a theme, and watch as AI
              automatically creates beautiful, professional slides in seconds.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
                Choose Your Theme
              </h2>
              <p className="text-sm text-muted-foreground">
                Select a visual style for your presentation
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {slideThemes.map((theme) => (
                <SlideThemeCard
                  key={theme}
                  theme={theme}
                  selected={selectedTheme === theme}
                  onSelect={() => setSelectedTheme(theme)}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button
              size="lg"
              onClick={handleContinue}
              className="w-full sm:w-auto gap-2 text-base"
              data-testid="button-continue"
            >
              Continue with {selectedTheme.charAt(0).toUpperCase() + selectedTheme.slice(1)}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </main>

      <footer className="border-t border-border mt-16">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          Create professional presentations in seconds with AI
        </div>
      </footer>
    </div>
  );
}
