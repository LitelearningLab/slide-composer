import { randomUUID } from "crypto";
import type { Slide } from "@shared/schema";

interface ParsedSection {
  title: string;
  content: string[];
  type: "title" | "bullets" | "content" | "quote" | "table";
}

/* =====================================================
   UTILITIES
===================================================== */

function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

function formatContent(text: string): string {
  let result = cleanMarkdown(text);
  result = result.replace(/\\text\s*\{\s*([^}]+)\s*\}/g, "$1");
  result = result.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, (_, n, d) => `[[FRAC:${n}:${d}]]`);
  result = result.replace(/(\d+)\/(\d+)/g, (_, n, d) => `[[FRAC:${n}:${d}]]`);
  return result;
}

function isTableRow(line: string): boolean {
  const t = line.trim();
  if (t.includes("\t")) return true;
  if (t.includes("|") && (t.startsWith("|") || t.endsWith("|"))) return true;
  if (t.includes("  ")) return t.split(/\s{2,}/).length >= 3;
  return false;
}

function parseTableRow(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map(c => c.trim()).filter(Boolean);
  if (line.includes("|")) return line.split("|").map(c => c.trim()).filter(Boolean);
  if (line.includes("  ")) return line.split(/\s{2,}/).map(c => c.trim()).filter(Boolean);
  return [line.trim()];
}

function isQuote(line: string): boolean {
  const t = line.trim();
  return t.startsWith(">") || (t.startsWith('"') && t.endsWith('"'));
}

/* =====================================================
   UPDATED STRUCTURED PARSER
===================================================== */

export function parseContentToSlides(rawData: string, explicitTitle?: string): { title: string; slides: Slide[] } {

  const lines = rawData
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;
  let presentationTitle = "";

  const push = () => {
    if (current) sections.push(current);
    current = null;
  };

  for (const line of lines) {

    /* ===============================
       ## SLIDE TITLE
    =============================== */
    if (line.startsWith("## ")) {
      push();
      const title = formatContent(line.replace(/^##\s+/, ""));
      if (!presentationTitle) presentationTitle = title;
      current = { title, content: [], type: "content" };
      continue;
    }

    /* ===============================
       ** SUB HEADING
    =============================== */
    const subheadingMatch = line.match(/^\*\*\s*(.+?)\s*\*\*$/);
    if (subheadingMatch) {
      if (!current) {
        current = { title: presentationTitle || "Slide", content: [], type: "content" };
      }
      current.content.push("##SUB:" + formatContent(subheadingMatch[1]));
      continue;
    }

    /* ===============================
       * MAIN BULLET
    =============================== */
    if (line.startsWith("* ")) {
      if (!current) {
        current = { title: presentationTitle || "Slide", content: [], type: "bullets" };
      }
      current.type = "bullets";
      current.content.push("* " + formatContent(line.replace(/^\*\s+/, "")));
      continue;
    }

    /* ===============================
       - SUB BULLET
    =============================== */
    if (line.startsWith("- ")) {
      if (!current) {
        current = { title: presentationTitle || "Slide", content: [], type: "bullets" };
      }
      current.type = "bullets";
      current.content.push("– " + formatContent(line.replace(/^\-\s+/, "")));
      continue;
    }

    /* ===============================
       TABLE
    =============================== */
    if (isTableRow(line)) {
      if (!current) {
        current = { title: presentationTitle || "Table", content: [], type: "table" };
      }
      current.type = "table";
      current.content.push(parseTableRow(line).map(c => formatContent(c)).join(" | "));
      continue;
    }

    /* ===============================
       QUOTE
    =============================== */
    if (isQuote(line)) {
      push();
      current = {
        title: formatContent(line.replace(/^>\s*/, "")),
        content: [],
        type: "quote"
      };
      continue;
    }

    /* ===============================
       SEPARATOR
    =============================== */
    if (line === "---") continue;

    /* ===============================
       PARAGRAPH
    =============================== */
    if (!current) {
      current = { title: presentationTitle || "Overview", content: [], type: "content" };
    }

    current.content.push(formatContent(line));
  }

  push();

  /* ===============================
     ENSURE TITLE SLIDE
  =============================== */
  if (sections.length && sections[0].type !== "title") {
    sections.unshift({
      title: explicitTitle || presentationTitle || sections[0].title,
      content: [],
      type: "title"
    });
  }

  return {
    title: explicitTitle || presentationTitle || "Presentation",
    slides: sections.map(section => ({
      id: randomUUID(),
      title: section.title,
      content: section.content.length ? section.content : [""],
      type: section.type
    }))
  };
}
