import { type SlideTheme } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";

interface SlideThemeCardProps {
  theme: SlideTheme;
  selected: boolean;
  onSelect: () => void;
}

const themeConfigs: Record<SlideTheme, {
  name: string;
  description: string;
  bgGradient: string;
  textColor: string;
  accentColor: string;
}> = {
  modern: {
    name: "Modern",
    description: "Clean lines with vibrant accents",
    bgGradient: "from-slate-900 to-slate-800",
    textColor: "text-white",
    accentColor: "bg-blue-500",
  },
  corporate: {
    name: "Corporate",
    description: "Professional and trustworthy",
    bgGradient: "from-blue-900 to-blue-800",
    textColor: "text-white",
    accentColor: "bg-amber-400",
  },
  creative: {
    name: "Creative",
    description: "Bold and expressive",
    bgGradient: "from-purple-600 to-pink-500",
    textColor: "text-white",
    accentColor: "bg-yellow-300",
  },
  minimal: {
    name: "Minimal",
    description: "Simple and elegant",
    bgGradient: "from-gray-100 to-white dark:from-gray-900 dark:to-gray-800",
    textColor: "text-gray-900 dark:text-white",
    accentColor: "bg-gray-900 dark:bg-white",
  },
  bold: {
    name: "Bold",
    description: "Strong impact statements",
    bgGradient: "from-orange-600 to-red-600",
    textColor: "text-white",
    accentColor: "bg-white",
  },
  elegant: {
    name: "Elegant",
    description: "Sophisticated and refined",
    bgGradient: "from-emerald-900 to-teal-800",
    textColor: "text-white",
    accentColor: "bg-amber-300",
  },
};

export function SlideThemeCard({ theme, selected, onSelect }: SlideThemeCardProps) {
  const config = themeConfigs[theme];

  return (
    <Card
      className={`relative cursor-pointer overflow-hidden transition-all duration-300 hover-elevate ${
        selected
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
          : ""
      }`}
      onClick={onSelect}
      data-testid={`card-theme-${theme}`}
    >
      <div className={`aspect-video bg-gradient-to-br ${config.bgGradient} p-4 flex flex-col justify-between`}>
        <div className="space-y-2">
          <div className={`h-2 w-16 ${config.accentColor} rounded-full`} />
          <div className={`h-3 w-24 ${config.accentColor} opacity-60 rounded`} />
        </div>
        <div className="space-y-1.5">
          <div className={`h-1.5 w-full ${config.textColor === 'text-white' ? 'bg-white/30' : 'bg-gray-900/30 dark:bg-white/30'} rounded`} />
          <div className={`h-1.5 w-3/4 ${config.textColor === 'text-white' ? 'bg-white/20' : 'bg-gray-900/20 dark:bg-white/20'} rounded`} />
          <div className={`h-1.5 w-1/2 ${config.textColor === 'text-white' ? 'bg-white/20' : 'bg-gray-900/20 dark:bg-white/20'} rounded`} />
        </div>
      </div>
      <div className="p-4 space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">{config.name}</h3>
          {selected && (
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-3 h-3 text-primary-foreground" />
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{config.description}</p>
      </div>
    </Card>
  );
}

export { themeConfigs };
