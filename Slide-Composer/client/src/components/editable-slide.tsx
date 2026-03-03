import { useState } from "react";
import { type Slide, type SlideTheme } from "@shared/schema";
import { themeConfigs } from "./slide-theme-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Check, X, Plus, Trash2 } from "lucide-react";

interface EditableSlideProps {
  slide: Slide;
  theme: SlideTheme;
  slideNumber: number;
  totalSlides: number;
  onUpdate: (updatedSlide: Slide) => void;
}

export function EditableSlide({
  slide,
  theme,
  slideNumber,
  totalSlides,
  onUpdate,
}: EditableSlideProps) {
  const config = themeConfigs[theme];
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingContentIndex, setEditingContentIndex] = useState<number | null>(null);
  const [titleValue, setTitleValue] = useState(slide.title);
  const [contentValue, setContentValue] = useState("");

  const handleTitleSave = () => {
    if (titleValue.trim()) {
      onUpdate({ ...slide, title: titleValue.trim() });
    } else {
      setTitleValue(slide.title);
    }
    setIsEditingTitle(false);
  };

  const handleContentSave = (index: number) => {
    const newContent = [...slide.content];
    if (contentValue.trim()) {
      newContent[index] = contentValue.trim();
      onUpdate({ ...slide, content: newContent });
    }
    setEditingContentIndex(null);
    setContentValue("");
  };

  const handleAddContent = () => {
    const newContent = [...slide.content, "New point"];
    onUpdate({ ...slide, content: newContent });
  };

  const handleDeleteContent = (index: number) => {
    const newContent = slide.content.filter((_, i) => i !== index);
    onUpdate({ ...slide, content: newContent });
  };

  const startEditingContent = (index: number) => {
    setContentValue(slide.content[index]);
    setEditingContentIndex(index);
  };

  return (
    <div
      className={`aspect-video w-full bg-gradient-to-br ${config.bgGradient} p-6 sm:p-8 md:p-12 flex flex-col justify-between relative overflow-hidden rounded-lg shadow-xl`}
      data-testid={`editable-slide-${slideNumber}`}
    >
      <div
        className={`absolute top-0 right-0 w-64 h-64 ${config.accentColor} opacity-10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl`}
      />
      <div
        className={`absolute bottom-0 left-0 w-48 h-48 ${config.accentColor} opacity-5 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl`}
      />

      <div className="relative z-10 flex-1 flex flex-col justify-center">
        {slide.type === "title" ? (
          <div className="text-center space-y-4 sm:space-y-6">
            <div className={`w-16 sm:w-24 h-1 ${config.accentColor} mx-auto rounded-full`} />
            
            {isEditingTitle ? (
              <div className="flex items-center justify-center gap-2 max-w-2xl mx-auto">
                <Input
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  className="text-2xl font-bold text-center bg-white/10 border-white/30 text-white placeholder:text-white/50"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTitleSave();
                    if (e.key === "Escape") {
                      setTitleValue(slide.title);
                      setIsEditingTitle(false);
                    }
                  }}
                  data-testid="input-edit-title"
                />
                <Button size="icon" variant="ghost" onClick={handleTitleSave} className="text-white hover:bg-white/20" data-testid="button-save-title">
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => { setTitleValue(slide.title); setIsEditingTitle(false); }} className="text-white hover:bg-white/20" data-testid="button-cancel-title">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="group relative cursor-pointer" onClick={() => { setTitleValue(slide.title); setIsEditingTitle(true); }} data-testid="text-slide-title">
                <h1 className={`text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold ${config.textColor} leading-tight`}>
                  {slide.title}
                </h1>
                <div className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Pencil className={`w-5 h-5 ${config.textColor}`} />
                </div>
              </div>
            )}
            
            {slide.content.length > 0 && (
              <div className="max-w-2xl mx-auto">
                {editingContentIndex === 0 ? (
                  <div className="flex items-center justify-center gap-2">
                    <Input
                      value={contentValue}
                      onChange={(e) => setContentValue(e.target.value)}
                      className="text-lg text-center bg-white/10 border-white/30 text-white placeholder:text-white/50"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleContentSave(0);
                        if (e.key === "Escape") setEditingContentIndex(null);
                      }}
                      data-testid="input-edit-content-0"
                    />
                    <Button size="icon" variant="ghost" onClick={() => handleContentSave(0)} className="text-white hover:bg-white/20">
                      <Check className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <p
                    className={`text-base sm:text-lg md:text-xl ${config.textColor} opacity-80 cursor-pointer hover:opacity-100 transition-opacity group`}
                    onClick={() => startEditingContent(0)}
                    data-testid="text-slide-subtitle"
                  >
                    {slide.content[0]}
                    <Pencil className={`inline-block w-4 h-4 ml-2 opacity-0 group-hover:opacity-100 transition-opacity`} />
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <div className={`w-12 sm:w-16 h-1 ${config.accentColor} rounded-full`} />
              
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                    className="text-xl font-bold bg-white/10 border-white/30 text-white placeholder:text-white/50"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleTitleSave();
                      if (e.key === "Escape") {
                        setTitleValue(slide.title);
                        setIsEditingTitle(false);
                      }
                    }}
                    data-testid="input-edit-title"
                  />
                  <Button size="icon" variant="ghost" onClick={handleTitleSave} className="text-white hover:bg-white/20" data-testid="button-save-title">
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { setTitleValue(slide.title); setIsEditingTitle(false); }} className="text-white hover:bg-white/20" data-testid="button-cancel-title">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="group relative cursor-pointer inline-block" onClick={() => { setTitleValue(slide.title); setIsEditingTitle(true); }} data-testid="text-slide-title">
                  <h2 className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold ${config.textColor}`}>
                    {slide.title}
                  </h2>
                  <div className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil className={`w-5 h-5 ${config.textColor}`} />
                  </div>
                </div>
              )}
            </div>
            
            <ul className="space-y-2 sm:space-y-3 md:space-y-4">
              {slide.content.map((item, index) => (
                <li key={index} className={`flex items-start gap-3 ${config.textColor} text-sm sm:text-base md:text-lg lg:text-xl group`}>
                  <span className={`mt-2 w-2 h-2 rounded-full ${config.accentColor} flex-shrink-0`} />
                  
                  {editingContentIndex === index ? (
                    <div className="flex-1 flex items-center gap-2">
                      <Textarea
                        value={contentValue}
                        onChange={(e) => setContentValue(e.target.value)}
                        className="flex-1 min-h-[40px] bg-white/10 border-white/30 text-white placeholder:text-white/50 resize-none"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleContentSave(index);
                          }
                          if (e.key === "Escape") setEditingContentIndex(null);
                        }}
                        data-testid={`input-edit-content-${index}`}
                      />
                      <Button size="icon" variant="ghost" onClick={() => handleContentSave(index)} className="text-white hover:bg-white/20">
                        <Check className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-start gap-2">
                      <span 
                        className="leading-relaxed cursor-pointer flex-1 hover:opacity-80 transition-opacity"
                        onClick={() => startEditingContent(index)}
                        data-testid={`text-content-${index}`}
                      >
                        {item}
                        <Pencil className="inline-block w-3 h-3 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => handleDeleteContent(index)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-white/50 hover:text-white hover:bg-white/20 h-6 w-6"
                        data-testid={`button-delete-content-${index}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddContent}
              className={`${config.textColor} opacity-60 hover:opacity-100 hover:bg-white/10 gap-1`}
              data-testid="button-add-content"
            >
              <Plus className="w-4 h-4" />
              Add point
            </Button>
          </div>
        )}
      </div>

      <div className="relative z-10 flex justify-between items-center pt-4 sm:pt-6">
        <div className={`text-xs sm:text-sm ${config.textColor} opacity-50`}>
          Slide {slideNumber} of {totalSlides}
        </div>
        <div className="flex gap-1">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-all ${
                i + 1 === slideNumber
                  ? config.accentColor
                  : `${config.textColor === 'text-white' ? 'bg-white/20' : 'bg-gray-900/20 dark:bg-white/20'}`
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
