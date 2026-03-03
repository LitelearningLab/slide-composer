import { randomUUID } from "crypto";
import type { Slide } from "@shared/schema";

/* =====================================================
   TYPES
===================================================== */

interface ParsedSection {
  title: string;
  content: string[];
  type: "title" | "bullets" | "content" | "quote" | "table";
}

/* =====================================================
   HEADER DETECTION
===================================================== */

function isHeader(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Markdown header
  if (/^#{1,6}\s+/.test(trimmed)) return true;

  // Slide 1: Title format
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
  return line
    .replace(/^[-•*]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Markdown table format
  if (/^\|.*\|$/.test(trimmed)) return true;

  // Tab-separated
  if (trimmed.includes("\t")) return true;

  // Multi-space separated (at least 3 columns)
  if (/\S+\s{2,}\S+\s{2,}\S+/.test(trimmed)) return true;

  return false;
}

function parseTableRow(line: string): string[] {
  if (line.includes("\t"))
    return line.split("\t").map(c => c.trim());

  if (line.includes("|"))
    return line.split("|").map(c => c.trim()).filter(Boolean);

  if (line.includes("  "))
    return line.split(/\s{2,}/).map(c => c.trim());

  return [line.trim()];
}

function formatContent(text: string): string {
  return text
    .replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, (_m, n, d) => `[[FRAC:${n.trim()}:${d.trim()}]]`)
    .replace(/\(([^()]+)\)\s*\/\s*(\d+)/g, (_m, n, d) => `[[FRAC:${n.trim()}:${d}]]`)
    .replace(/(\d+)\s*\/\s*(\d+)/g, (_m, n, d) => `[[FRAC:${n}:${d}]]`);
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

  for (const line of lines) {

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

    /* ===== SAFETY INIT ===== */
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
      current.content.push(
        cells.map(c => formatContent(c)).join(" | ")
      );
      current.type = "table";
      continue;
    }

    /* ===== BULLET ===== */
    if (isBulletPoint(line)) {
      current.content.push(
        "__BULLET__" + formatContent(cleanBulletText(line))
      );
      current.type = "bullets";
      continue;
    }

    /* ===== NUMBERED ===== */
    if (isNumberedPoint(line)) {
      current.content.push(
        "__NUMBERED__" + formatContent(cleanBulletText(line))
      );
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
