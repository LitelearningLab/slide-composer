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

export const slideSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.array(z.string()),
  type: z.enum(["title", "content", "bullets", "quote", "image", "table"]),
});

export type Slide = z.infer<typeof slideSchema>;

export const presentationSchema = z.object({
  id: z.string(),
  title: z.string(),
  theme: z.enum(slideThemes),
  slides: z.array(slideSchema),
  createdAt: z.string(),
});

export type Presentation = z.infer<typeof presentationSchema>;

export const generateSlidesRequestSchema = z.object({
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
