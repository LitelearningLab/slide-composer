import { useState, useRef, useEffect } from "react";
import { type Presentation } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Send, Loader2, X, MessageCircle, CheckCircle, Mic, MicOff, Volume2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useVoiceRecorder } from "../../replit_integrations/audio/useVoiceRecorder";
import { useAudioPlayback } from "../../replit_integrations/audio/useAudioPlayback";

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
  
  // Voice functionality
  const { state: recordingState, startRecording, stopRecording } = useVoiceRecorder();
  const { play: playAudio } = useAudioPlayback();
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

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

  // Handle voice input
  const handleVoiceStart = async () => {
    try {
      setIsRecording(true);
      await startRecording();
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Could not access microphone. Please check permissions.");
      setIsRecording(false);
    }
  };

  const handleVoiceStop = async () => {
    if (!isRecording) return;
    
    try {
      const audioBlob = await stopRecording();
      setIsRecording(false);
      
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Audio = (reader.result as string).split(",")[1];
        await sendVoiceMessage(base64Audio);
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error("Error stopping recording:", error);
      setIsRecording(false);
    }
  };

  const sendVoiceMessage = async (audioBase64: string) => {
    if (isLoading) return;
    
    setIsLoading(true);
    if (slideBeforeChat === null) {
      setSlideBeforeChat(currentSlide);
    }
    onChatOpen();

    try {
      console.log("[VoiceChat] Sending voice message with audio");
      
      // Convert conversation history to array format for API
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Send voice message
      const voiceResponse = await fetch("/api/voice/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio: audioBase64,
          voice: "alloy",
          conversationHistory,
        }),
      });

      if (!voiceResponse.ok) throw new Error(`Voice message failed: ${voiceResponse.status}`);

      // Process SSE stream
      const reader = voiceResponse.body?.getReader();
      const decoder = new TextDecoder();
      let assistantTranscript = "";
      let audioData: string[] = [];
      let buffer = "";

      if (!reader) throw new Error("No response body reader");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        
        // Keep the last incomplete line in the buffer
        buffer = lines[lines.length - 1];

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i];
          if (line.startsWith("data: ")) {
            try {
              const json = JSON.parse(line.slice(6));
              console.log(`[VoiceChat] Event type: ${json.type}`);

              if (json.type === "user_transcript") {
                const userMessage: Message = {
                  id: `user-${Date.now()}`,
                  role: "user",
                  content: json.data,
                };
                setMessages((prev) => [...prev, userMessage]);
              }

              if (json.type === "transcript") {
                assistantTranscript += json.data;
              }

              if (json.type === "audio") {
                console.log(`[VoiceChat] Received audio chunk, size: ${json.data.length}`);
                audioData.push(json.data);
              }

              if (json.type === "error") {
                console.error(`[VoiceChat] Server error: ${json.error}`);
              }

              if (json.type === "done") {
                console.log(`[VoiceChat] Done event received. Transcript: ${assistantTranscript.substring(0, 50)}...`);
              }
            } catch (parseError) {
              console.error("[VoiceChat] Failed to parse JSON:", parseError, "Line:", line);
            }
          }
        }
      }

      // Process final buffer
      if (buffer.startsWith("data: ")) {
        try {
          const json = JSON.parse(buffer.slice(6));
          if (json.type === "audio") {
            console.log(`[VoiceChat] Received final audio chunk, size: ${json.data.length}`);
            audioData.push(json.data);
          }
        } catch (e) {
          // Ignore
        }
      }

      // Add assistant message and play audio
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: assistantTranscript,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Play audio response if available
      if (audioData.length > 0) {
        console.log(`[VoiceChat] Playing audio. Total chunks: ${audioData.length}`);
        setIsPlayingAudio(true);
        try {
          const combinedAudio = audioData.join("");
          console.log(`[VoiceChat] Combined audio size: ${combinedAudio.length} characters`);
          
          // Decode base64 to bytes
          const binaryString = atob(combinedAudio);
          console.log(`[VoiceChat] Decoded binary size: ${binaryString.length} bytes`);
          
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          // Create audio blob and play
          const audioBlob = new Blob([bytes], { type: "audio/mp3" });
          const audioUrl = URL.createObjectURL(audioBlob);
          console.log(`[VoiceChat] Created audio blob, URL: ${audioUrl.substring(0, 50)}...`);
          
          const audio = new Audio(audioUrl);
          
          audio.onended = () => {
            console.log("[VoiceChat] Audio playback finished");
            setIsPlayingAudio(false);
            URL.revokeObjectURL(audioUrl);
          };
          
          audio.onerror = (err) => {
            console.error("[VoiceChat] Audio playback error:", err);
            setIsPlayingAudio(false);
          };
          
          // Play with a small delay to ensure blob is ready
          setTimeout(() => {
            console.log("[VoiceChat] Starting audio playback");
            audio.play().catch((err) => {
              console.error("[VoiceChat] Failed to play audio:", err);
              setIsPlayingAudio(false);
            });
          }, 100);
        } catch (audioError) {
          console.error("[VoiceChat] Error processing audio:", audioError);
          setIsPlayingAudio(false);
        }
      } else {
        console.warn("[VoiceChat] No audio chunks received");
        setIsPlayingAudio(false);
      }
    } catch (error) {
      console.error("Error processing voice message:", error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I couldn't process your voice message. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return null;
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
            placeholder="Ask about the slides... or use voice button"
            className="min-h-[60px] resize-none text-sm"
            disabled={isLoading || isRecording}
            data-testid="input-chat-message"
          />
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading || isRecording}
              size="icon"
              className="h-[28px] flex-1"
              title="Send text message"
              data-testid="button-send-message"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
            <Button
              onClick={isRecording ? handleVoiceStop : handleVoiceStart}
              disabled={isLoading}
              size="icon"
              variant={isRecording ? "destructive" : "default"}
              className="h-[28px] flex-1"
              title={isRecording ? "Stop recording" : "Start voice input"}
              data-testid="button-voice-record"
            >
              {isRecording ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        
        {isRecording && (
          <div className="text-center text-sm text-red-500 font-medium animate-pulse">
            🎤 Recording... Click mic button to stop
          </div>
        )}
        
        {isPlayingAudio && (
          <div className="text-center text-sm text-blue-500 font-medium flex items-center justify-center gap-2">
            <Volume2 className="h-4 w-4 animate-pulse" />
            Playing audio response...
          </div>
        )}
        
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
