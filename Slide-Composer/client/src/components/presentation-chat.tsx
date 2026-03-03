import { useState, useRef, useEffect } from "react";
import { type Presentation } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Send, Loader2, X, MessageCircle, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  slideReference?: number;
}

interface PresentationChatProps {
  presentation: Presentation;
  currentSlide: number;
  onSlideChange: (slide: number) => void;
  onChatOpen: () => void;
  onChatClose: () => void;
  onDoubtCleared: () => void;
  isOpen: boolean;
}

export function PresentationChat({
  presentation,
  currentSlide,
  onSlideChange,
  onChatOpen,
  onChatClose,
  onDoubtCleared,
  isOpen,
}: PresentationChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [slideBeforeChat, setSlideBeforeChat] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    if (slideBeforeChat === null) {
      setSlideBeforeChat(currentSlide);
    }

    onChatOpen();

    try {
      const response = await apiRequest("POST", "/api/presentations/chat", {
        question: userMessage.content,
        presentation: {
          title: presentation.title,
          slides: presentation.slides.map((s, i) => ({
            slideNumber: i + 1,
            title: s.title,
            content: s.content,
            type: s.type,
          })),
        },
        currentSlide: currentSlide + 1,
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.answer,
        slideReference: data.slideReference,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.slideReference && data.slideReference !== currentSlide + 1) {
        onSlideChange(data.slideReference - 1);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I couldn't process your question. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDoubtCleared = () => {
    if (slideBeforeChat !== null) {
      onSlideChange(slideBeforeChat);
      setSlideBeforeChat(null);
    }
    setMessages([]);
    onChatClose();
    onDoubtCleared();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) {
    return (
      <Button
        variant="default"
        onClick={() => {
          if (slideBeforeChat === null) {
            setSlideBeforeChat(currentSlide);
          }
          onChatOpen();
        }}
        className="fixed top-4 right-48 z-[60] h-10 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
        data-testid="button-open-chat"
      >
        <MessageCircle className="h-4 w-4" />
        <span>Ask AI</span>
      </Button>
    );
  }

  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 sm:w-96 bg-background border-l border-border z-50 flex flex-col chat-sidebar" data-testid="chat-sidebar">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Ask about slides</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onChatClose()}
          className="h-8 w-8"
          data-testid="button-close-chat"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Ask questions about the presentation.</p>
              <p className="text-xs mt-1 opacity-70">
                I'll navigate to relevant slides when needed.
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <Card
              key={msg.id}
              className={`p-3 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground ml-4"
                  : "bg-muted mr-4"
              }`}
              data-testid={`message-${msg.role}-${msg.id}`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              {msg.slideReference && (
                <p className="text-xs mt-2 opacity-70">
                  Referenced slide {msg.slideReference}
                </p>
              )}
            </Card>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground p-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Thinking...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border space-y-3">
        <div className="flex gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the slides..."
            className="min-h-[60px] resize-none text-sm"
            disabled={isLoading}
            data-testid="input-chat-message"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-[60px]"
            data-testid="button-send-message"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <Button
          onClick={handleDoubtCleared}
          variant="default"
          className="w-full gap-2"
          data-testid="button-doubt-cleared"
        >
          <CheckCircle className="h-4 w-4" />
          Doubt Cleared - Resume Slideshow
        </Button>
      </div>
    </div>
  );
}
