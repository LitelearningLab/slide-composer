import { type Presentation } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getPresentation(id: string): Promise<Presentation | undefined>;
  getAllPresentations(): Promise<Presentation[]>;
  createPresentation(presentation: Omit<Presentation, "id" | "createdAt">): Promise<Presentation>;
  deletePresentation(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private presentations: Map<string, Presentation>;

  constructor() {
    this.presentations = new Map();
  }

  async getPresentation(id: string): Promise<Presentation | undefined> {
    return this.presentations.get(id);
  }

  async getAllPresentations(): Promise<Presentation[]> {
    return Array.from(this.presentations.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async createPresentation(data: Omit<Presentation, "id" | "createdAt">): Promise<Presentation> {
    const id = randomUUID();
    const presentation: Presentation = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
    };
    this.presentations.set(id, presentation);
    return presentation;
  }

  async deletePresentation(id: string): Promise<void> {
    this.presentations.delete(id);
  }
}

export const storage = new MemStorage();
