import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";
import { generateSlidesRequestSchema, type SlideTheme } from "@shared/schema";
import { textToSpeech } from "./replit_integrations/audio/client";
import { parseContentToSlides } from "./slideParser";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/presentations", async (req, res) => {
    try {
      const presentations = await storage.getAllPresentations();
      res.json(presentations);
    } catch (error) {
      console.error("Error fetching presentations:", error);
      res.status(500).json({ error: "Failed to fetch presentations" });
    }
  });

  app.get("/api/presentations/:id", async (req, res) => {
    try {
      const presentation = await storage.getPresentation(req.params.id);
      if (!presentation) {
        return res.status(404).json({ error: "Presentation not found" });
      }
      res.json(presentation);
    } catch (error) {
      console.error("Error fetching presentation:", error);
      res.status(500).json({ error: "Failed to fetch presentation" });
    }
  });

  app.post("/api/presentations/generate", async (req, res) => {
    try {
      const parseResult = generateSlidesRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: parseResult.error.errors 
        });
      }

      const { rawData, theme } = parseResult.data;

      const { title, slides } = parseContentToSlides(rawData);

      const presentation = await storage.createPresentation({
        title,
        theme: theme as SlideTheme,
        slides,
      });

      res.json(presentation);
    } catch (error) {
      console.error("Error generating presentation:", error);
      res.status(500).json({ 
        error: "Failed to generate presentation",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.delete("/api/presentations/:id", async (req, res) => {
    try {
      await storage.deletePresentation(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting presentation:", error);
      res.status(500).json({ error: "Failed to delete presentation" });
    }
  });

  app.post("/api/presentations/narrate", async (req, res) => {
    try {
      const { text, voice = "nova" } = req.body;

      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const audioBuffer = await textToSpeech(text, voice, "mp3");
      const audioBase64 = audioBuffer.toString("base64");

      res.json({ audio: audioBase64 });
    } catch (error) {
      console.error("Error generating narration:", error);
      res.status(500).json({ 
        error: "Failed to generate narration",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/presentations/chat", async (req, res) => {
    try {
      const { question, presentation, currentSlide } = req.body;

      if (!question || !presentation) {
        return res.status(400).json({ error: "Question and presentation are required" });
      }

      const slidesContext = presentation.slides
        .map((s: { slideNumber: number; title: string; content: string[]; type: string }) => 
          `Slide ${s.slideNumber}: "${s.title}"\nContent: ${s.content.join(", ")}`
        )
        .join("\n\n");

      const systemPrompt = `You are a helpful assistant answering questions about a presentation. The user is currently viewing the presentation and may ask questions about specific slides or content.

Presentation Title: ${presentation.title}

Slides:
${slidesContext}

Current slide being viewed: Slide ${currentSlide}

Instructions:
1. Answer the user's question based on the presentation content
2. If the question relates to a specific slide, mention which slide number contains the relevant information
3. Keep answers concise and helpful
4. If you reference content from a different slide than the current one, include the slide number

Respond with JSON:
{
  "answer": "Your helpful answer here",
  "slideReference": <slide number if you're referencing a specific slide, or null if general>
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 1024,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from AI");
      }

      let parsed: { answer: string; slideReference?: number | null };
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        parsed = { answer: content, slideReference: null };
      }

      res.json({
        answer: parsed.answer,
        slideReference: parsed.slideReference || null,
      });
    } catch (error) {
      console.error("Error in chat:", error);
      res.status(500).json({ 
        error: "Failed to process question",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  return httpServer;
}
