import { useState } from "react";
import Editor from "@monaco-editor/react";
import { AnimatePresence, easeInOut, motion } from "motion/react";
import { Code2, Copy, Eye, PanelRight, PanelRightOpen, X } from "lucide-react";
import { useSelector } from "react-redux";

function detectLang(filename = "") {
  const name = filename.toLowerCase();

  if (name.endsWith(".html")) return "html";
  if (name.endsWith(".css")) return "css";
  if (name.endsWith(".js") || name.endsWith(".jsx")) return "javascript";
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "typescript";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".py")) return "python";
  if (name.endsWith(".java")) return "java";
  if (name.endsWith(".cpp")) return "cpp";
  if (name.endsWith(".c")) return "c";

  return "plaintext";
}

function escapeClosingTag(content, tagName) {
  return content.replace(new RegExp(`</${tagName}`, "gi"), `<\\/${tagName}`);
}

function getFileName(path = "") {
  return path.split(/[\\/]/).pop()?.toLowerCase() ?? "";
}

function buildPreviewDoc(htmlFile, styleFiles, scriptFiles) {
  if (!htmlFile) return "";

  const css = styleFiles
    .map((file) => file.content ?? "")
    .filter(Boolean)
    .join("\n");
  const js = scriptFiles
    .map((file) => file.content ?? "")
    .filter(Boolean)
    .join("\n");
  const styleTag = css ? `<style>${escapeClosingTag(css, "style")}</style>` : "";
  const scriptTag = js ? `<script>${escapeClosingTag(js, "script")}</script>` : "";
  let html = htmlFile.content ?? "";

  if (getFileName(htmlFile.name) === "preview.html") {
    return html;
  }

  if (!/<!doctype\s+html|<html[\s>]/i.test(html)) {
    return `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">${styleTag}</head><body>${html}${scriptTag}</body></html>`;
  }

  const localCssNames = new Set(styleFiles.map((file) => getFileName(file.name)));
  const localJsNames = new Set(scriptFiles.map((file) => getFileName(file.name)));
  html = html.replace(/<link\b[^>]*>/gi, (linkTag) => {
    const href = linkTag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    const filename = href?.split(/[?#]/)[0];
    return filename && localCssNames.has(getFileName(filename)) ? "" : linkTag;
  });
  html = html.replace(
    /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>\s*<\/script>/gi,
    (scriptTag, src) => {
      const filename = getFileName(src.split(/[?#]/)[0]);
      return localJsNames.has(filename) ? "" : scriptTag;
    }
  );

  if (styleTag) {
    html = /<\/head>/i.test(html)
      ? html.replace(/<\/head>/i, `${styleTag}</head>`)
      : `${styleTag}${html}`;
  }
  if (scriptTag) {
    html = /<\/body>/i.test(html)
      ? html.replace(/<\/body>/i, `${scriptTag}</body>`)
      : `${html}${scriptTag}`;
  }

  return html;
}

function Artifact() {
  const artifacts = useSelector((state) => state.message?.artifacts ?? []);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tab, setTab] = useState("code");
  const [activeFile, setActiveFile] = useState(0);
  const [copied, setCopied] = useState(false);

  const activeArtifact = artifacts[0] ?? null;
  const files = (activeArtifact?.files ?? []).map((file) => ({
    ...file,
    name: file?.name ?? file?.filename ?? file?.path,
    content: file?.content ?? file?.code,
  })).filter((file) => (
    typeof file.name === "string" &&
    file.name.trim() &&
    typeof file.content === "string"
  ));
  const title = activeArtifact?.title || "Artifacts";
  const htmlFile = files.find((file) => file.name?.toLowerCase() === "preview.html")
    ?? files.find((file) => file.name?.toLowerCase().endsWith(".html"));
  const canPreview = files.length > 0;
  const styleFiles = files.filter((file) => file.name?.toLowerCase().endsWith(".css"));
  const scriptFiles = files.filter((file) => file.name?.toLowerCase().endsWith(".js"));
  const selectedIndex = files.length ? Math.min(activeFile, files.length - 1) : 0;
  const selectedFile = files[selectedIndex] ?? null;

  const previewDoc = buildPreviewDoc(htmlFile, styleFiles, scriptFiles);

  const handleCopy = async () => {
    if (typeof selectedFile?.content !== "string") return;

    try {
      await navigator.clipboard.writeText(selectedFile.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy artifact:", error);
    }
  };

  const panelContent = (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-[#0d0f14]">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] px-4">
        <button
          type="button"
          aria-label="Close artifacts"
          onClick={() => setMobileOpen(false)}
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-slate-500 transition-colors hover:bg-white/[0.05] hover:text-slate-200 lg:hidden"
        >
          <X size={16} />
        </button>
        <button
          type="button"
          aria-label="Collapse artifact panel"
          title="Collapse artifact panel"
          onClick={() => setCollapsed(true)}
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-slate-500 transition-colors hover:bg-white/[0.05] hover:text-slate-200"
        >
          <PanelRight size={16} />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-indigo-500/20 bg-indigo-500/10">
            <Code2 className="text-indigo-400" size={15} />
          </div>
          <div className="truncate text-[13px] font-medium text-slate-200" title={title}>
            {title}
          </div>
        </div>
        <button
          type="button"
          aria-label={copied ? "Copied" : "Copy selected file"}
          title={copied ? "Copied!" : "Copy selected file"}
          onClick={handleCopy}
          disabled={typeof selectedFile?.content !== "string"}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border-none bg-transparent px-2.5 py-1.5 text-[11px] font-medium text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Copy size={15} />
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
        {canPreview && (
          <div className="flex shrink-0 items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.04] p-1">
            <button
              type="button"
              onClick={() => setTab("code")}
              className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${tab === "code" ? "bg-indigo-500 text-white" : "text-slate-500 hover:text-slate-200"}`}
            >
              <Code2 size={11} />
              Code
            </button>
            <button
              type="button"
              onClick={() => setTab("preview")}
              className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${tab === "preview" ? "bg-indigo-500 text-white" : "text-slate-500 hover:text-slate-200"}`}
            >
              <Eye size={11} />
              Preview
            </button>
          </div>
        )}
      </div>

      {tab === "code" && (
        <div className="flex shrink-0 overflow-x-auto border-b border-white/[0.06] text-white [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {files.map((file, index) => (
            <button
              key={`${file.name}-${index}`}
              type="button"
              onClick={() => setActiveFile(index)}
              className={`relative shrink-0 cursor-pointer border-r border-white/[0.06] bg-transparent px-4 py-2.5 text-[11px] font-medium whitespace-nowrap transition-colors hover:bg-white/[0.05] ${selectedIndex === index ? "text-indigo-400" : "text-slate-500 hover:text-slate-300"}`}
            >
              {file.name}
              {selectedIndex === index && (
                <span className="absolute right-0 bottom-0 left-0 h-[2px] rounded-t-full bg-indigo-500" />
              )}
            </button>
          ))}
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {!activeArtifact ? (
          <div className="p-4 text-sm text-slate-500">No artifacts available yet.</div>
        ) : files.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">
            This saved artifact has no file names or code. Generate it again to view the files.
          </div>
        ) : tab === "preview" && !htmlFile ? (
          <div className="p-4 text-sm text-slate-400">
            This project has no standalone HTML preview. Generate the website again to get its browser preview.
          </div>
        ) : tab === "preview" ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0"
          >
            <iframe
              title="Artifact preview"
              srcDoc={previewDoc}
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
              className="h-full w-full border-0 bg-white"
            />
          </motion.div>
        ) : selectedFile ? (
          <motion.div
            key={`${selectedFile.name}-${activeFile}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0"
          >
            <Editor
              theme="vs-dark"
              language={detectLang(selectedFile.name)}
              value={selectedFile.content}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 13,
                renderLineHighlight: "none",
                wordWrap: "on",
                automaticLayout: true,
                scrollBeyondLastColumn: false,
                padding: { top: 16 },
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                folding: true,
                glyphMargin: false,
                contextmenu: true,
              }}
            />
          </motion.div>
        ) : (
          <div className="p-4 text-sm text-slate-500">No files available in this artifact.</div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {artifacts.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setCollapsed(false);
            setMobileOpen(true);
          }}
          className="fixed right-4 bottom-24 z-30 flex items-center gap-2 rounded-xl border-none bg-indigo-600 px-3.5 py-2 text-[12px] font-medium text-white shadow-lg shadow-indigo-500/20 transition-colors duration-150 hover:bg-indigo-500 lg:hidden"
        >
          <Code2 size={16} />
          Artifacts
        </button>
      )}

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close artifacts"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 cursor-default border-0 bg-black/60 p-0 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="fixed inset-y-0 right-0 z-50 flex w-[min(88vw,420px)] max-w-full overflow-hidden border-l border-white/[0.06] lg:hidden"
            >
              {panelContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 48 : 400 }}
        transition={{ duration: 0.25, ease: easeInOut }}
        className="hidden h-full shrink-0 overflow-hidden border-l border-white/[0.06] bg-[#0d0f14] lg:flex"
      >
        {collapsed ? (
          <div className="flex h-full w-full shrink-0 flex-col items-center gap-3 bg-[#0d0f14] py-4">
            <button
              type="button"
              aria-label="Expand artifact panel"
              title="Expand artifact panel"
              onClick={() => setCollapsed(false)}
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-slate-500 transition-colors hover:bg-white/[0.05] hover:text-slate-200"
            >
              <PanelRightOpen size={16} />
            </button>
            <span
              className="overflow-hidden text-[10px] font-medium uppercase tracking-widest text-slate-600"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
              title={title}
            >
              {title}
            </span>
          </div>
        ) : (
          panelContent
        )}
      </motion.aside>
    </>
  );
}

export default Artifact;
