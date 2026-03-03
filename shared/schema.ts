import { z } from "zod";

export const slideThemes = [
  "modern",
  "corporate",
  "creative",
  "minimal",
  "bold",
  "elegant",
] as const;

export type SlideTheme = (typeof slideThemes)[number];

export const slideTransitions = [
  "fade",
  "push-left",
  "push-up",
  "zoom",
  "rotate",
  "flip",
] as const;

export type SlideTransition = (typeof slideTransitions)[number];

export const slideSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.array(z.string()),
  type: z.enum(["title", "content", "bullets", "quote", "image", "table", "media"]),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  embedUrl: z.string().optional(),
  embedHtml: z.string().optional(),
  mediaAlignment: z.enum(["left", "right", "center", "full"]).optional(),
  contentAlignment: z.enum(["left", "center"]).optional(),
  transition: z.enum(slideTransitions).optional(),
});

export type Slide = z.infer<typeof slideSchema>;

export const presentationSchema = z.object({
  id: z.string(),
  title: z.string(),
  theme: z.enum(slideThemes),
  slides: z.array(slideSchema),
  createdAt: z.string(),
  rawData: z.string().optional(),
});

export type Presentation = z.infer<typeof presentationSchema>;

export const generateSlidesRequestSchema = z.object({
  title: z.string().min(1, "Title is required"),
  rawData: z.string().min(1, "Data is required"),
  theme: z.enum(slideThemes),
});

export type GenerateSlidesRequest = z.infer<typeof generateSlidesRequestSchema>;

export const users = {} as any;
export const insertUserSchema = z.object({
  username: z.string(),
  password: z.string(),
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = { id: string; username: string; password: string };
