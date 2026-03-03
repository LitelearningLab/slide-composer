import { randomUUID } from "crypto";
import type { Slide } from "@shared/schema";

interface ParsedSection {
  title: string;
  content: string[];
  type: "title" | "bullets" | "content" | "quote" | "table";
}

/* =====================================================
   STRICT HEADER DETECTION (NO GUESSING)
===================================================== */

function isHeader(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Only explicit markdown headers create slides
  if (/^#{1,6}\s+/.test(trimmed)) return true;

  // Explicit Slide markers
  if (/^Slide\s*\d+\s*[:.\-]/i.test(trimmed)) return true;

  return false;
}

function cleanHeaderText(line: string): string {
  let text = line.trim();
  text = text.replace(/^#{1,6}\s+/, "");
  text = text.replace(/^Slide\s*\d+\s*[:.\-]\s*/i, "");
  return text.trim();
}

/* =====================================================
   STRUCTURE HELPERS
===================================================== */

function isBulletPoint(line: string): boolean {
  return /^[-•*]\s+/.test(line.trim());
}

function isNumberedPoint(line: string): boolean {
  return /^\d+[.)]\s+/.test(line.trim());
}

function cleanBulletText(line: string): string {
  return line.replace(/^[-•*]\s+/, "").replace(/^\d+[.)]\s+/, "").trim();
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.includes("|")) return true;
  if (trimmed.includes("\t")) return true;
  if (trimmed.includes("  ")) {
    const cols = trimmed.split(/\s{2,}/).filter(Boolean);
    return cols.length >= 3;
  }
  return false;
}

function parseTableRow(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map(c => c.trim());
  if (line.includes("|")) return line.split("|").map(c => c.trim()).filter(Boolean);
  if (line.includes("  ")) return line.split(/\s{2,}/).map(c => c.trim());
  return [line.trim()];
}

function formatContent(text: string): string {
  return text.replace(/(\d+)\/(\d+)/g, (_, n, d) => `[[FRAC:${n}:${d}]]`);
}

/* =====================================================
   MAIN PARSER
===================================================== */

export function parseContentToSlides(rawData: string): {
  title: string;
  slides: Slide[];
} {

  const lines = rawData
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      title: "Untitled",
      slides: [{
        id: randomUUID(),
        title: "Empty Slide",
        content: ["No content"],
        type: "title"
      }]
    };
  }

  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;
  let presentationTitle = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    /* ===== HEADER ===== */
    if (isHeader(line)) {
      if (current) sections.push(current);

      const headerText = cleanHeaderText(line);

      if (!presentationTitle) presentationTitle = headerText;

      current = {
        title: headerText,
        content: [],
        type: sections.length === 0 ? "title" : "content"
      };

      continue;
    }

    if (!current) {
      presentationTitle = lines[0];
      current = {
        title: presentationTitle,
        content: [],
        type: "title"
      };
    }

    /* ===== TABLE ===== */
    if (isTableRow(line)) {
      const cells = parseTableRow(line);
      current.content.push(cells.map(c => formatContent(c)).join(" | "));
      current.type = "table";
      continue;
    }

    /* ===== BULLET ===== */
    if (isBulletPoint(line)) {
      current.content.push(formatContent(cleanBulletText(line)));
      current.type = "bullets";
      continue;
    }

    /* ===== NUMBERED ===== */
    if (isNumberedPoint(line)) {
      current.content.push("– " + formatContent(cleanBulletText(line)));
      current.type = "bullets";
      continue;
    }

    /* ===== PARAGRAPH ===== */
    current.content.push(formatContent(line));
    if (current.type !== "bullets" && current.type !== "table") {
      current.type = "content";
    }
  }

  if (current) sections.push(current);

  /* ===== ENSURE TITLE SLIDE ===== */
  if (sections.length && sections[0].type !== "title") {
    sections.unshift({
      title: presentationTitle,
      content: [],
      type: "title"
    });
  }

  const slides: Slide[] = sections.map(section => ({
    id: randomUUID(),
    title: section.title,
    content: section.content.length ? section.content : [""],
    type: section.type
  }));

  return {
    title: presentationTitle || "Presentation",
    slides
  };
}