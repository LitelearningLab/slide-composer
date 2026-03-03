import { type Presentation } from "@shared/schema";

export function buildDownloadHtml(target: Presentation, autoPlay = false): string {
  const slidesHtml = target.slides
    .map((slide, idx) => {
      const content = slide.content
        .map((line) => `<li>${line.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</li>`)
        .join("");
      return `
      <section class="slide" style="display:${idx === 0 ? "block" : "none"}">
        <h2>${slide.title.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</h2>
        <ul>${content}</ul>
        <div class="meta">Slide ${idx + 1} / ${target.slides.length}</div>
      </section>`;
    })
    .join("");

  const base64Data = typeof window !== 'undefined'
    ? window.btoa(encodeURIComponent(JSON.stringify(target)))
    : Buffer.from(encodeURIComponent(JSON.stringify(target))).toString('base64');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${target.title}</title>
<style>
  body { margin: 0; font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; }
  .deck { width: min(100vw, 1280px); aspect-ratio: 16 / 9; margin: 0 auto; display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box; }
  .slide { width: 100%; height: 100%; border-radius: 12px; background: #1e293b; padding: 32px; box-sizing: border-box; overflow: auto; }
  h2 { margin-top: 0; margin-bottom: 16px; }
  ul { margin: 0; padding-left: 20px; line-height: 1.5; }
  .meta { margin-top: 16px; font-size: 12px; opacity: 0.8; }
  .controls { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); display: flex; gap: 8px; }
  button { border: 0; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
</style>
</head>
<body>
<div class="deck">${slidesHtml}</div>
<div class="controls">
  <button id="prev">Prev</button>
  <button id="next">Next</button>
</div>
<script type="application/json" id="slide-data">${base64Data}</script>
<script>
  const slides = Array.from(document.querySelectorAll('.slide'));
  let index = 0;
  const show = (next) => {
    index = Math.max(0, Math.min(slides.length - 1, next));
    slides.forEach((s, i) => { s.style.display = i === index ? 'block' : 'none'; });
  };
  document.getElementById('prev').onclick = () => show(index - 1);
  document.getElementById('next').onclick = () => show(index + 1);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });
  ${autoPlay ? "setInterval(() => show(index + 1 >= slides.length ? 0 : index + 1), 5000);" : ""}
</script>
</body>
</html>`;
}
