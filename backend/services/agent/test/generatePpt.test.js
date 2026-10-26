import assert from "node:assert/strict";
import { test } from "node:test";
import axios from "axios";
import { generatePpt } from "../utils/generatePpt.js";

const makeSlide = (visual) => ({
  title: "Visual test slide",
  points: ["A useful supporting point"],
  visual,
});

const createPptxBuffer = async (slides) => {
  const ppt = await generatePpt({ title: "Visual test", slides });
  return ppt.write({ outputType: "nodebuffer" });
};

test("generates PPTX slides with editable diagrams and native charts", async () => {
  const buffer = await createPptxBuffer([
    makeSlide({
      type: "diagram",
      title: "Workflow",
      nodes: ["Plan", "Build", "Launch"],
    }),
    makeSlide({
      type: "chart",
      title: "Quarterly results",
      chartType: "bar",
      labels: ["Q1", "Q2", "Q3"],
      values: [12, 18, 24],
    }),
  ]);

  assert.equal(buffer.subarray(0, 4).toString(), "PK\u0003\u0004");
  assert.ok(buffer.length > 10_000);
});

test("embeds generated images in the presentation", async () => {
  const originalGet = axios.get;
  axios.get = async () => ({
    data: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/m7cAAAAASUVORK5CYII=",
      "base64",
    ),
    headers: { "content-type": "image/png" },
  });

  try {
    const buffer = await createPptxBuffer([
      makeSlide({
        type: "image",
        title: "Generated illustration",
        prompt: "A simple blue abstract illustration",
      }),
    ]);

    assert.equal(buffer.subarray(0, 4).toString(), "PK\u0003\u0004");
    assert.ok(buffer.length > 10_000);
  } finally {
    axios.get = originalGet;
  }
});

test("rejects invalid chart data and more than two generated image slides", async () => {
  await assert.rejects(
    () => generatePpt({
      slides: [makeSlide({
        type: "chart",
        chartType: "bar",
        labels: ["Only one"],
        values: [1],
      })],
    }),
    /at least two labels/,
  );

  await assert.rejects(
    () => generatePpt({
      slides: [
        makeSlide({ type: "image", prompt: "first" }),
        makeSlide({ type: "image", prompt: "second" }),
        makeSlide({ type: "image", prompt: "third" }),
      ],
    }),
    /at most two generated image slides/,
  );
});
