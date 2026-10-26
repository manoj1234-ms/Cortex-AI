import axios from "axios";
import pptxgen from "pptxgenjs";

const COLORS = {
  primary: "2563EB",
  secondary: "0F172A",
  text: "334155",
  light: "F8FAFC",
  border: "E2E8F0",
  white: "FFFFFF",
  muted: "64748B",
  accent: "60A5FA",
};

const SLIDE_WIDTH = 13.333;
const FOOTER_Y = 7.02;
const VISUAL_TYPES = new Set(["chart", "diagram", "image", "none"]);
const CHART_TYPES = new Set(["bar", "line", "pie", "doughnut"]);

const addCover = (ppt, data) => {
  const slide = ppt.addSlide();
  slide.background = { color: COLORS.primary };

  slide.addShape(ppt.ShapeType.rect, {
    x: 0,
    y: 0,
    w: SLIDE_WIDTH,
    h: 0.18,
    line: { color: COLORS.accent },
    fill: { color: COLORS.accent },
  });

  slide.addText(data.title || "Untitled Presentation", {
    x: 0.7,
    y: 1.7,
    w: 12,
    h: 0.9,
    fontSize: 30,
    bold: true,
    color: COLORS.white,
    align: "center",
    valign: "mid",
    fit: "shrink",
  });

  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 1,
      y: 2.8,
      w: 11.5,
      h: 0.7,
      fontSize: 16,
      color: "DBEAFE",
      align: "center",
      valign: "mid",
      fit: "shrink",
    });
  }

  slide.addText("Created with ConvexAI", {
    x: 0,
    y: 6.9,
    w: SLIDE_WIDTH,
    h: 0.25,
    fontSize: 10,
    color: "BFDBFE",
    align: "center",
  });
};

const addFooter = (slide, page, totalSlides) => {
  slide.addText("ConvexAI", {
    x: 0.6,
    y: FOOTER_Y,
    w: 2,
    h: 0.2,
    fontSize: 9,
    color: COLORS.muted,
  });
  slide.addText(`${page}/${totalSlides}`, {
    x: 12.1,
    y: FOOTER_Y,
    w: 0.7,
    h: 0.2,
    fontSize: 9,
    color: COLORS.muted,
    align: "right",
  });
};

const addBulletPoints = (ppt, slide, points, hasVisual) => {
  const x = 0.75;
  const width = hasVisual ? 5.1 : 11.8;
  const top = 1.25;
  const availableHeight = 5.35;
  const rowHeight = Math.min(0.85, availableHeight / Math.max(points.length, 1));

  points.slice(0, 6).forEach((point, index) => {
    const y = top + index * rowHeight;
    const height = Math.max(0.52, rowHeight - 0.1);
    slide.addShape(ppt.ShapeType.roundRect, {
      x,
      y,
      w: width,
      h: height,
      rectRadius: 0.08,
      fill: { color: index % 2 ? COLORS.light : "EFF6FF" },
      line: { color: COLORS.border, transparency: 20 },
    });
    slide.addShape(ppt.ShapeType.ellipse, {
      x: x + 0.18,
      y: y + height / 2 - 0.055,
      w: 0.11,
      h: 0.11,
      fill: { color: COLORS.primary },
      line: { color: COLORS.primary },
    });
    slide.addText(point, {
      x: x + 0.43,
      y: y + 0.08,
      w: width - 0.55,
      h: height - 0.16,
      fontSize: hasVisual ? 13 : 15,
      color: COLORS.text,
      valign: "mid",
      breakLine: false,
      fit: "shrink",
      margin: 0.02,
    });
  });
};

const addVisualTitle = (slide, visual) => {
  if (typeof visual.title !== "string" || !visual.title.trim()) {
    return;
  }
  slide.addText(visual.title, {
    x: 6.25,
    y: 1.12,
    w: 6.35,
    h: 0.38,
    fontSize: 15,
    bold: true,
    color: COLORS.secondary,
    align: "center",
    fit: "shrink",
  });
};

const addChart = (ppt, slide, visual) => {
  if (!CHART_TYPES.has(visual.chartType)) {
    throw new Error(`Unsupported chart type: ${visual.chartType ?? "missing"}.`);
  }
  if (
    !Array.isArray(visual.labels) ||
    visual.labels.length < 2 ||
    !Array.isArray(visual.values) ||
    visual.values.length !== visual.labels.length ||
    !visual.values.every((value) => Number.isFinite(value))
  ) {
    throw new Error("Charts need at least two labels and one finite numeric value per label.");
  }
  if (
    ["pie", "doughnut"].includes(visual.chartType) &&
    visual.values.some((value) => value < 0)
  ) {
    throw new Error("Pie and doughnut chart values cannot be negative.");
  }

  addVisualTitle(slide, visual);
  slide.addChart(
    ppt.ChartType[visual.chartType],
    [{
      name: visual.title || "Values",
      labels: visual.labels,
      values: visual.values,
    }],
    {
      x: 6.25,
      y: 1.6,
      w: 6.35,
      h: 4.9,
      showLegend: false,
      showTitle: false,
      showValue: true,
      chartColors: [COLORS.primary, COLORS.accent, "34D399", "F59E0B", "8B5CF6"],
      catAxisLabelFontFace: "Aptos",
      catAxisLabelFontSize: 10,
      valAxisLabelFontFace: "Aptos",
      valAxisLabelFontSize: 9,
      showCatName: visual.chartType === "pie" || visual.chartType === "doughnut",
      showPercent: visual.chartType === "pie" || visual.chartType === "doughnut",
      showValAxisTitle: false,
      showCatAxisTitle: false,
      showBorder: false,
    },
  );
};

const addDiagram = (ppt, slide, visual) => {
  if (
    !Array.isArray(visual.nodes) ||
    visual.nodes.length < 2 ||
    !visual.nodes.every((node) => typeof node === "string" && node.trim())
  ) {
    throw new Error("Diagrams need at least two non-empty node labels.");
  }

  addVisualTitle(slide, visual);
  const nodes = visual.nodes.slice(0, 6);
  const x = 6.65;
  const width = 5.55;
  const height = Math.min(0.68, 4.65 / nodes.length);
  const gap = nodes.length > 1
    ? (4.65 - nodes.length * height) / (nodes.length - 1)
    : 0;
  const top = 1.65;

  nodes.forEach((node, index) => {
    const y = top + index * (height + gap);
    slide.addShape(ppt.ShapeType.roundRect, {
      x,
      y,
      w: width,
      h: height,
      rectRadius: 0.08,
      fill: { color: index % 2 ? "EFF6FF" : COLORS.light },
      line: { color: COLORS.primary, width: 1.2 },
    });
    slide.addText(node, {
      x: x + 0.12,
      y: y + 0.06,
      w: width - 0.24,
      h: height - 0.12,
      fontSize: 13,
      color: COLORS.secondary,
      bold: index === 0,
      align: "center",
      valign: "mid",
      fit: "shrink",
    });

    if (index < nodes.length - 1) {
      slide.addShape(ppt.ShapeType.line, {
        x: x + width / 2,
        y: y + height,
        w: 0,
        h: gap,
        line: {
          color: COLORS.primary,
          width: 1.5,
          endArrowType: "triangle",
        },
      });
    }
  });
};

const generateImage = async (visual, slideIndex) => {
  if (typeof visual.prompt !== "string" || !visual.prompt.trim()) {
    throw new Error(`Slide ${slideIndex} image visual needs a prompt.`);
  }

  const imageUrl = `https://gen.pollinations.ai/image/${encodeURIComponent(visual.prompt.trim())}?model=${encodeURIComponent("black-forest-labs/flux.1-schnell")}`;
  const response = await axios.get(imageUrl, {
    responseType: "arraybuffer",
    timeout: 120_000,
    maxContentLength: 15 * 1024 * 1024,
    headers: process.env.POLLINATIONS_API_KEY
      ? { Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}` }
      : undefined,
  });

  const contentType = response.headers["content-type"]?.split(";")[0];
  if (!["image/png", "image/jpeg"].includes(contentType)) {
    throw new Error(`Slide ${slideIndex} image service returned unsupported content type: ${contentType ?? "unknown"}.`);
  }

  const image = Buffer.from(response.data);
  if (!image.length) {
    throw new Error(`Slide ${slideIndex} image service returned an empty image.`);
  }
  return `data:${contentType};base64,${image.toString("base64")}`;
};

const addImage = (slide, visual) => {
  addVisualTitle(slide, visual);
  slide.addImage({
  data: visual.imageData,
  x: 6.25,
  y: 1.6,
  sizing: { type: "contain", w: 6.35, h: 4.9 },
    altText: visual.title || visual.prompt,
  });
};

const addContentSlide = (ppt, slideData, page, totalSlides) => {
  const slide = ppt.addSlide();
  slide.background = { color: COLORS.white };

  slide.addText(slideData.title || "Untitled Presentation", {
    x: 0.6,
    y: 0.35,
    w: 12,
    h: 0.45,
    fontSize: 24,
    color: COLORS.primary,
    bold: true,
    fit: "shrink",
  });
  slide.addShape(ppt.ShapeType.line, {
    x: 0.6,
    y: 0.92,
    w: 12.1,
    h: 0,
    line: { color: COLORS.border, width: 1.2 },
  });

  const visual = slideData.visual ?? { type: "none" };
  if (!VISUAL_TYPES.has(visual.type)) {
    throw new Error(`Unsupported visual type on slide ${page}: ${visual.type}.`);
  }
  const hasVisual = visual.type !== "none";
  addBulletPoints(ppt, slide, slideData.points, hasVisual);

  if (visual.type === "chart") {
    addChart(ppt, slide, visual);
  } else if (visual.type === "diagram") {
    addDiagram(ppt, slide, visual);
  } else if (visual.type === "image") {
    addImage(slide, visual);
  }

  addFooter(slide, page, totalSlides);
};

const addThankYou = (ppt) => {
  const slide = ppt.addSlide();
  slide.background = { color: COLORS.secondary };
  slide.addText("Thank You!", {
    x: 0,
    y: 2.2,
    w: SLIDE_WIDTH,
    h: 0.8,
    fontFace: "Aptos Display",
    fontSize: 34,
    bold: true,
    align: "center",
    color: COLORS.white,
  });
  slide.addText("Created with ConvexAI", {
    x: 0,
    y: 6.9,
    w: SLIDE_WIDTH,
    h: 0.2,
    fontSize: 10,
    align: "center",
    color: "94A3B8",
  });
};

export const generatePpt = async (data) => {
  if (!data || typeof data !== "object") {
    throw new Error("Presentation data must be an object.");
  }
  if (!Array.isArray(data.slides) || data.slides.length === 0) {
    throw new Error("Presentation data must contain at least one slide.");
  }
  const imageSlides = data.slides.filter((slide) => slide?.visual?.type === "image");
  if (imageSlides.length > 2) {
    throw new Error("A presentation can include at most two generated image slides.");
  }

  const slides = await Promise.all(data.slides.map(async (slide, index) => {
    if (!slide || typeof slide !== "object") {
      throw new Error(`Slide ${index + 1} must be an object.`);
    }
    const points = Array.isArray(slide.points)
      ? slide.points.filter((point) => typeof point === "string" && point.trim()).slice(0, 6)
      : [];
    if (points.length === 0) {
      throw new Error(`Slide ${index + 1} must contain at least one text point.`);
    }
    const normalizedSlide = { ...slide, points };
    if (normalizedSlide.visual?.type === "image") {
      normalizedSlide.visual = {
        ...normalizedSlide.visual,
        imageData: await generateImage(normalizedSlide.visual, index + 1),
      };
    }
    return normalizedSlide;
  }));

  const ppt = new pptxgen();
  ppt.layout = "LAYOUT_WIDE";
  ppt.author = "ConvexAI";
  ppt.title = data.title || "Untitled Presentation";
  ppt.company = "ConvexAI";
  ppt.lang = "en-US";
  ppt.theme = {
    headFontFace: "Aptos",
    bodyFontFace: "Aptos",
    lang: "en-US",
  };

  addCover(ppt, data);
  slides.forEach((slide, index) => {
    addContentSlide(ppt, slide, index + 1, slides.length);
  });
  addThankYou(ppt);

  return ppt;
};
