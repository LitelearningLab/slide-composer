import express, { type Express, type Request, type Response } from "express";
import { openai, speechToText, ensureCompatibleFormat, textToSpeech } from "./client";

// Body parser with 50MB limit for audio payloads
const audioBodyParser = express.json({ limit: "50mb" });

export function registerAudioRoutes(app: Express): void {
  // Send voice message and get streaming audio response
  // Auto-detects audio format and converts WebM/MP4/OGG to WAV
  app.post("/api/voice/chat", audioBodyParser, async (req: Request, res: Response) => {
    try {
      const { audio, voice = "alloy", conversationHistory = [] } = req.body;

      if (!audio) {
        return res.status(400).json({ error: "Audio data (base64) is required" });
      }

      // 1. Auto-detect format and convert to OpenAI-compatible format
      const rawBuffer = Buffer.from(audio, "base64");
      const { buffer: audioBuffer, format: inputFormat } = await ensureCompatibleFormat(rawBuffer);
      console.log(`Audio format detected: ${inputFormat}, size: ${audioBuffer.length} bytes`);

      // 2. Transcribe user audio
      const userTranscript = await speechToText(audioBuffer, inputFormat);
      console.log(`User transcript: ${userTranscript}`);

      // 3. Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      res.write(`data: ${JSON.stringify({ type: "user_transcript", data: userTranscript })}\n\n`);

      // 4. Prepare chat history
      const chatHistory = [...conversationHistory, { role: "user", content: userTranscript }];

      // 5. Stream text response from gpt-4o (fallback from audio model)
      console.log(`Calling OpenAI with ${chatHistory.length} messages`);
      const stream = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: chatHistory as any,
        stream: true,
      });

      let assistantTranscript = "";

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta as any;
        if (!delta) continue;

        if (delta?.content) {
          assistantTranscript += delta.content;
          res.write(`data: ${JSON.stringify({ type: "transcript", data: delta.content })}\n\n`);
        }
      }

      console.log(`Voice chat completed. Transcript: ${assistantTranscript}`);
      
      // 6. Convert AI response text to speech
      console.log(`[VoiceChat] Generating audio via OpenAI TTS...`);
      try {
        const responseAudioBuffer = await textToSpeech(assistantTranscript, voice);
        console.log(`[VoiceChat] Audio buffer received: ${responseAudioBuffer.length} bytes`);
        
        const audioBase64 = responseAudioBuffer.toString("base64");
        console.log(`[VoiceChat] Base64 encoded. Length: ${audioBase64.length} characters`);
        
        // Send audio as base64
        res.write(`data: ${JSON.stringify({ type: "audio", data: audioBase64, format: "mp3" })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "done", transcript: assistantTranscript })}\n\n`);
        res.end();
      } catch (ttsError) {
        console.error(`[VoiceChat] TTS Error:`, ttsError);
        // Still send the transcript even if audio fails
        res.write(`data: ${JSON.stringify({ type: "error", error: `Audio generation failed: ${ttsError instanceof Error ? ttsError.message : "Unknown error"}` })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "done", transcript: assistantTranscript })}\n\n`);
        res.end();
      }
    } catch (error) {
      console.error("Error processing voice message:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", error: error instanceof Error ? error.message : "Failed to process voice message" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to process voice message" });
      }
    }
  });
}
