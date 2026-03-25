import React, { useState, useRef, useEffect } from "react";
import JSZip from "jszip";
import katex from "katex";
import "katex/dist/katex.min.css";
import { 
  Settings, Moon, Sun, Play, FileText, CheckCircle, AlertTriangle, X, 
  Code, Eye, MessageSquare, Hammer, TerminalSquare, Menu, ArrowUp, 
  Share, Clock, Folder, File, ChevronDown, ChevronRight, RefreshCw, 
  Download, Maximize2, MoreVertical, ChevronLeft, Paperclip, ImagePlus,
  Search, Replace, ZoomIn, ZoomOut, Save, LogIn, UserPlus, KeyRound, Home, LogOut,
  Trash2, Copy, Edit3, Upload, Command, Sparkles
} from "lucide-react";

const USERS_KEY = "latex_studio_users";
const SESSION_USER_KEY = "latex_studio_session_user";
const PROJECTS_KEY = "latex_studio_projects";
const SETTINGS_KEY = "latex_studio_settings";
const PROJECT_ASSETS_KEY = "latex_studio_project_assets";

const EXTRA_LATEX_PACKAGES = [
  "amsmath",
  "amssymb",
  "amsthm",
  "mathtools",
  "graphicx",
  "booktabs",
  "array",
  "tabularx",
  "float",
  "caption",
  "subcaption",
  "xcolor",
  "hyperref",
  "natbib"
];

const QUICK_INSERT_SNIPPETS = {
  math: `\n\\[\n  E = mc^2\n\\]\n`,
  table: `\n\\begin{table}[htbp]\n  \\centering\n  \\caption{Example table}\n  \\begin{tabular}{lcc}\n    \\toprule\n    Method & Accuracy & F1 \\\\\n    \\midrule\n    Baseline & 0.82 & 0.80 \\\\\n    Ours & 0.91 & 0.90 \\\\\n    \\bottomrule\n  \\end{tabular}\n  \\label{tab:results}\n\\end{table}\n`,
  figure: `\n\\begin{figure}[htbp]\n  \\centering\n  \\LatexStudioIncludeGraphics[width=0.75\\linewidth]{image-name.png}\n  \\caption{Example figure}\n  \\label{fig:example}\n\\end{figure}\n`
};

const FORMULA_LIBRARY = [
  { title: "Inline", snippet: `$E = mc^2$` },
  { title: "Display", snippet: `\\[\n  E = mc^2\n\\]` },
  { title: "Align", snippet: `\\begin{align}\n  a &= b + c \\\\n  &= d + e\n\\end{align}` },
  { title: "Matrix", snippet: `\\[\n  A = \\begin{bmatrix}\n    a_{11} & a_{12} \\\\n    a_{21} & a_{22}\n  \\end{bmatrix}\n\\]` },
  { title: "Cases", snippet: `\\[\n  f(x) = \\begin{cases}\n    x^2, & x > 0 \\\\n    0, & x = 0 \\\\n    -x, & x < 0\n  \\end{cases}\n\\]` }
];

const DEFAULT_TABLE_BUILDER = {
  rows: 4,
  cols: 3,
  alignment: "c",
  caption: "Generated table",
  label: "tab:generated",
  environment: "table"
};

const LATEX_STUDIO_GRAPHICS_MACRO = String.raw`\newcommand{\LatexStudioIncludeGraphics}[2][]{%
  \IfFileExists{#2}{%
    \includegraphics[#1]{#2}%
  }{%
    \fbox{%
      \parbox[c][0.28\textheight][c]{0.75\linewidth}{%
        \centering Missing image\\
        	exttt{#2}%
      }%
    }%
  }%
}`;

const LATEX_PACKAGE_RULES = [
  { test: /\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\\begin\{(?:equation|align|gather|multline|flalign|cases)\*?\}|\\mathcal|\\frac|\\sum|\\int|\\left|\\right/, packages: ["amsmath", "amssymb", "mathtools"] },
  { test: /\\toprule|\\midrule|\\bottomrule/, packages: ["booktabs"] },
  { test: /\\begin\{tabularx\}|\\end\{tabularx\}/, packages: ["tabularx"] },
  { test: /\\begin\{table\}|\\begin\{table\*\}|\\begin\{figure\}|\\begin\{figure\*\}/, packages: ["float", "caption"] },
  { test: /\\begin\{subfigure\}|\\subcaption|\\begin\{subtable\}/, packages: ["subcaption"] },
  { test: /\\includegraphics|\\LatexStudioIncludeGraphics/, packages: ["graphicx"] },
  { test: /\\href|\\url|\\hyperref/, packages: ["hyperref"] },
  { test: /\\citep|\\citet|\\bibliographystyle|\\bibliography/, packages: ["natbib"] },
  { test: /\\textcolor|\\color\{|\\definecolor/, packages: ["xcolor"] },
  { test: /[\u3400-\u9FFF]/, packages: ["ctex"] }
];

// --- Default Templates ---
const TEMPLATES = {
  article: `\\documentclass{article}
${EXTRA_LATEX_PACKAGES.map((pkg) => `\\usepackage{${pkg}}`).join("\n")}

\\title{Your Research Title Here}
\\author{Author Name}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
Your abstract goes here. Briefly describe the problem, method, and results.
\\end{abstract}

\\section{Introduction}
Start your introduction here.

\\section{Methods}
Describe your methodology.

\\subsection{Mathematical Formulation}
We optimize the following objective:
\\[
  \\mathcal{L}(\\theta) = \\sum_{i=1}^{N} \\left(y_i - f(x_i; \\theta)\\right)^2
\\]

\\subsection{Data Collection}
How data was gathered.

\\section{Results}
Present your findings.

\\begin{table}[htbp]
  \\centering
  \\caption{Main quantitative results}
  \\begin{tabular}{lcc}
    \\toprule
    Method & Accuracy & F1 \\\\
    \\midrule
    Baseline & 0.82 & 0.80 \\\\
    Proposed & 0.91 & 0.90 \\\\
    \\bottomrule
  \\end{tabular}
  \\label{tab:main-results}
\\end{table}

\\begin{figure}[htbp]
  \\centering
  \\includegraphics[width=0.6\\linewidth]{image-name.png}
  \\caption{Pipeline overview or qualitative example.}
  \\label{fig:pipeline}
\\end{figure}

\\section{Conclusion}
Summarize your work.

\\end{document}`,
  ieee: `\\documentclass[journal]{IEEEtran}
${EXTRA_LATEX_PACKAGES.map((pkg) => `\\usepackage{${pkg}}`).join("\n")}

\\title{IEEE Paper Title}
\\author{Author 1, Author 2}

\\begin{document}
\\maketitle

\\begin{abstract}
IEEE style abstract.
\\end{abstract}

\\section{Introduction}
IEEE format introduction.

\\end{document}`
};

// --- Default Agent Prompts ---
const DEFAULT_PROMPTS = {
  researcher: `You are an expert academic Researcher. Write or significantly improve the LaTeX paper based on the topic provided. 
Requirements:
- Expand Introduction, Methods, Results, and Conclusion professionally.
- Add mock data tables or baseline comparisons if applicable.
- Ensure high-quality academic English writing.
- OUTPUT ONLY VALID LATEX CODE. Do NOT wrap in markdown blockquotes (like \`\`\`latex). Start exactly with \\documentclass and end with \\end{document}.`,
  
  professor: `You are a strict, senior Professor reviewing your student's draft. 
Conduct a rigorous academic review covering:
1. Methodological flaws or logical gaps.
2. Unjustified claims or lack of data support.
3. Formatting and structural issues.
Write your review in Chinese (or English if the paper is heavily English-specific, but prefer Chinese for the user). Point out specific issues and rate their severity [Critical/Medium/Minor]. Be harsh but constructive.`,
  
  reviewer: `You are 'Reviewer #2' for a top-tier journal (e.g., Nature, CVPR). 
Read the paper and the Professor's initial review. Provide a final, demanding journal-level assessment focusing on:
1. Novelty and Contribution.
2. Statistical rigor and Reproducibility.
Provide a final decision [Major Revision / Minor Revision / Reject] and a list of 'Essential Revisions'. Use a formal, highly critical tone. Use Chinese/English mixed style.`
};

const DEFAULT_LLM_CONFIG = { provider: "gemini", model: "gemini-2.5-flash", apiKey: "", baseUrl: "" };
const DEFAULT_ROLE_LLM_CONFIG = { researcher: { ...DEFAULT_LLM_CONFIG }, professor: { ...DEFAULT_LLM_CONFIG }, reviewer: { ...DEFAULT_LLM_CONFIG } };
const OPENAI_COMPATIBLE_PROVIDERS = new Set(["openai", "deepseek", "qwen", "glm"]);
const LLM_PROVIDER_OPTIONS = [
  { value: "gemini", label: "Google Gemini" },
  { value: "openai", label: "OpenAI" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "qwen", label: "Qwen" },
  { value: "glm", label: "GLM" }
];
const ROLE_UI_META = {
  researcher: { label: "Researcher", tint: "text-blue-500", chip: "from-blue-500/15 to-cyan-500/10 border-blue-500/20" },
  professor: { label: "Professor", tint: "text-purple-500", chip: "from-purple-500/15 to-fuchsia-500/10 border-purple-500/20" },
  reviewer: { label: "Reviewer", tint: "text-rose-500", chip: "from-rose-500/15 to-orange-500/10 border-rose-500/20" }
};

const DEFAULT_SETTINGS = {
  fontSize: 14,
  fontFamily: "'Fira Code', 'Consolas', monospace",
  lineHeight: 1.5,
  wordWrap: "on",
  lineNumbers: true,
  spellCheck: false,
  tabSize: 4,
  editorTheme: "vs-dark",
  syntaxHighlighting: true,
  minimap: false,
  fontLigatures: false,
  formatOnSave: false,
  cursorStyle: "line",
  cursorBlinking: "blink",
  renderWhitespace: "none",
  matchBrackets: true,
  autoCloseBrackets: true,
  autoCompile: false,
  autoSave: true,
  compiler: "xelatex",
  template: "article",
  prompts: { ...DEFAULT_PROMPTS },
  llm: { ...DEFAULT_LLM_CONFIG },
  roleLlm: {
    researcher: { ...DEFAULT_LLM_CONFIG },
    professor: { ...DEFAULT_LLM_CONFIG },
    reviewer: { ...DEFAULT_LLM_CONFIG }
  }
};

const mergeSettings = (saved = {}) => ({
  ...DEFAULT_SETTINGS,
  ...saved,
  prompts: { ...DEFAULT_PROMPTS, ...(saved.prompts || {}) },
  llm: { ...DEFAULT_LLM_CONFIG, ...(saved.llm || {}) },
  roleLlm: {
    researcher: { ...DEFAULT_LLM_CONFIG, ...(saved.roleLlm?.researcher || {}) },
    professor: { ...DEFAULT_LLM_CONFIG, ...(saved.roleLlm?.professor || {}) },
    reviewer: { ...DEFAULT_LLM_CONFIG, ...(saved.roleLlm?.reviewer || {}) }
  }
});

const readStoredProjectAssets = () => {
  try {
    return JSON.parse(localStorage.getItem(PROJECT_ASSETS_KEY) || "{}");
  } catch {
    return {};
  }
};

const getProjectAssets = (projectId) => {
  if (!projectId) return { attachments: [], images: [] };
  const stored = readStoredProjectAssets();
  return stored[projectId] || { attachments: [], images: [] };
};

const setProjectAssets = (projectId, payload) => {
  if (!projectId) return;
  const stored = readStoredProjectAssets();
  stored[projectId] = payload;
  try { localStorage.setItem(PROJECT_ASSETS_KEY, JSON.stringify(stored)); } catch {}
};

const deleteProjectAssets = (projectId) => {
  if (!projectId) return;
  const stored = readStoredProjectAssets();
  delete stored[projectId];
  try { localStorage.setItem(PROJECT_ASSETS_KEY, JSON.stringify(stored)); } catch {}
};

const isBibFile = (name = "") => /\.bib$/i.test(String(name));

const extractBibEntries = (content = "") => Array.from(String(content).matchAll(/@\w+\s*\{\s*([^,\s]+)\s*,/g)).map((match) => match[1]);

const buildBibliographySnippet = (attachments = []) => {
  const bibNames = attachments.filter((attachment) => isBibFile(attachment?.name)).map((attachment) => attachment.name.replace(/\.bib$/i, ""));
  if (!bibNames.length) return "";
  return `\n\\bibliographystyle{plain}\n\\bibliography{${bibNames.join(",")}}\n`;
};

const buildTableSnippet = ({ rows, cols, alignment, caption, label, environment }) => {
  const safeRows = Math.max(2, Number(rows) || 2);
  const safeCols = Math.max(2, Number(cols) || 2);
  const spec = Array.from({ length: safeCols }, () => alignment || "c").join("");
  const header = Array.from({ length: safeCols }, (_, index) => `Header ${index + 1}`).join(" & ");
  const body = Array.from({ length: safeRows - 1 }, (_, rowIndex) => `Row ${rowIndex + 1} & ${Array.from({ length: safeCols - 1 }, (_, cellIndex) => `Cell ${rowIndex + 1}.${cellIndex + 2}`).join(" & ")} \\\\`).join("\n    ");
  return `\n\\begin{${environment}}[htbp]\n  \\centering\n  \\caption{${caption}}\n  \\begin{tabular}{${spec}}\n    \\toprule\n    ${header} \\\\n    \\midrule\n    ${body}\n    \\bottomrule\n  \\end{tabular}\n  \\label{${label}}\n\\end{${environment}}\n`;
};

const parseCompileIssues = (log = "") => {
  const issues = [];
  const seen = new Set();
  for (const match of String(log).matchAll(/(?:^|\n)(?:\.?\\?[^\n]*?main\.tex|main\.tex):(\d+):\s*([^\n]+)/g)) {
    const issue = { line: Number(match[1]), message: match[2].trim() };
    const key = `${issue.line}:${issue.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      issues.push(issue);
    }
  }
  return issues;
};

const getDefaultBaseUrl = (provider) => {
  switch (provider) {
    case "openai": return "https://api.openai.com/v1";
    case "deepseek": return "https://api.deepseek.com/v1";
    case "qwen": return "https://dashscope.aliyuncs.com/compatible-mode/v1";
    case "glm": return "https://open.bigmodel.cn/api/paas/v4";
    case "anthropic": return "https://api.anthropic.com/v1";
    case "gemini": default: return "https://generativelanguage.googleapis.com/v1beta";
  }
};

const getDefaultModelForProvider = (provider) => {
  switch (provider) {
    case "gemini": return "gemini-2.5-flash";
    case "anthropic": return "claude-3-5-sonnet-latest";
    case "deepseek": return "deepseek-chat";
    case "qwen": return "qwen-plus";
    case "glm": return "glm-4-flash";
    case "openai": default: return "gpt-4o-mini";
  }
};

const buildWithRetry = async (requestFn, retries = 2, delay = 1000) => {
  try { return await requestFn(); } 
  catch (error) {
    if (retries > 0) {
      await new Promise(res => setTimeout(res, delay));
      return buildWithRetry(requestFn, retries - 1, delay * 2);
    }
    throw error;
  }
};

// --- Multi-Provider LLM API Call ---
const callLLM = async (prompt, systemInstruction, llmConfig) => {
  const provider = llmConfig?.provider || "gemini";
  const model = llmConfig?.model?.trim() || (provider === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini");
  const apiKey = llmConfig?.apiKey?.trim();
  const rawBaseUrl = llmConfig?.baseUrl?.trim() || getDefaultBaseUrl(provider);
  const baseUrl = rawBaseUrl.replace(/\/+$/, "");

  if (!apiKey) throw new Error("Missing API key. Please set it in Settings > LLM API.");

  const callGemini = async () => {
    const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }], systemInstruction: { parts: [{ text: systemInstruction }] } };
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(`Gemini API error ${response.status}: ${await response.text()}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
  };

  const callOpenAICompatible = async () => {
    const url = `${baseUrl}/chat/completions`;
    const payload = { model, messages: [{ role: "system", content: systemInstruction }, { role: "user", content: prompt }], temperature: 0.3 };
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(`${provider} API error ${response.status}: ${await response.text()}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "No response generated.";
  };

  return buildWithRetry(async () => {
    if (provider === "gemini") return callGemini();
    if (OPENAI_COMPATIBLE_PROVIDERS.has(provider)) return callOpenAICompatible();
    throw new Error(`Unsupported provider: ${provider}`);
  });
};

// --- Fast Regex LaTeX Previewer ---
const escapeHtml = (value = "") => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/\"/g, "&quot;")
  .replace(/'/g, "&#39;");

const getImageLookup = (images = []) => {
  const lookup = new Map();
  images.forEach((image) => {
    if (!image?.name || !image?.dataUrl) return;
    lookup.set(image.name, image.dataUrl);
    const normalized = image.name.replace(/^.*[\\/]/, "");
    lookup.set(normalized, image.dataUrl);
  });
  return lookup;
};

const renderMath = (expression, displayMode = false) => {
  try {
    return katex.renderToString(expression.trim(), { throwOnError: false, displayMode, trust: true, strict: "ignore" });
  } catch {
    return `<code class="rounded px-2 py-1 bg-amber-500/10 text-amber-600">${escapeHtml(expression)}</code>`;
  }
};

const replaceWithTokens = (input, replacer) => {
  const tokens = [];
  const text = input.replace(replacer, (...args) => {
    const html = args[args.length - 1];
    const token = `@@LATEX_BLOCK_${tokens.length}@@`;
    tokens.push({ token, html });
    return token;
  });
  return { text, tokens };
};

const renderInlineLatex = (value = "") => {
  let text = value;
  const mathTokens = [];
  const storeMath = (html) => {
    const token = `@@LATEX_INLINE_${mathTokens.length}@@`;
    mathTokens.push({ token, html });
    return token;
  };

  text = text
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, expr) => storeMath(renderMath(expr, false)))
    .replace(/\$(.+?)\$/g, (_, expr) => storeMath(renderMath(expr, false)));

  text = escapeHtml(text)
    .replace(/\\textbf\{([^{}]+)\}/g, "<strong>$1</strong>")
    .replace(/\\textit\{([^{}]+)\}/g, "<em>$1</em>")
    .replace(/\\emph\{([^{}]+)\}/g, "<em>$1</em>")
    .replace(/\\underline\{([^{}]+)\}/g, "<span class=\"underline\">$1</span>")
    .replace(/\\href\{([^{}]+)\}\{([^{}]+)\}/g, '<a href="$1" target="_blank" rel="noreferrer" class="text-blue-500 underline">$2</a>')
    .replace(/\\cite\{([^}]+)\}/g, "<sup class='text-blue-500 font-medium'>[$1]</sup>")
    .replace(/\\ref\{([^}]+)\}/g, "<span class='font-mono text-xs opacity-70'>[$1]</span>")
    .replace(/\\newline/g, "<br/>")
    .replace(/\\\\/g, "<br/>")
    .replace(/\\%/g, "%")
    .replace(/\\&/g, "&")
    .replace(/\\_/g, "_")
    .replace(/\\# /g, "# ")
    .replace(/\\[a-zA-Z]+\*?\{([^{}]*)\}/g, "$1")
    .replace(/\\[a-zA-Z]+\*?(\[[^\]]*\])?/g, "")
    .replace(/[{}]/g, "");

  mathTokens.forEach(({ token, html }) => { text = text.replaceAll(token, html); });
  return text;
};

const renderListBlock = (itemsSource, ordered = false) => {
  const items = itemsSource
    .split(/\\item\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `<li>${renderInlineLatex(item)}</li>`)
    .join("");
  return `<${ordered ? "ol" : "ul"} class="${ordered ? "list-decimal" : "list-disc"} pl-6 mb-5 space-y-2 text-[15px] leading-relaxed">${items}</${ordered ? "ol" : "ul"}>`;
};

const renderTableBlock = (source) => {
  const caption = source.match(/\\caption\{([\s\S]*?)\}/)?.[1]?.trim() || "";
  const label = source.match(/\\label\{([\s\S]*?)\}/)?.[1]?.trim() || "";
  const tabularMatch = source.match(/\\begin\{(?:tabular|tabularx)\}(?:\{[^}]*\})?\{([^}]*)\}([\s\S]*?)\\end\{(?:tabular|tabularx)\}/);
  if (!tabularMatch) return `<pre class="latex-block">${escapeHtml(source)}</pre>`;

  const rows = tabularMatch[2]
    .replace(/\\toprule|\\midrule|\\bottomrule|\\hline/g, "")
    .split(/\\\\(?:\[[^\]]*\])?\s*/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => row.split(/(?<!\\)&/).map((cell) => renderInlineLatex(cell.trim())));

  if (!rows.length) return "";

  const header = rows[0];
  const bodyRows = rows.slice(1);
  const headHtml = `<thead><tr>${header.map((cell) => `<th>${cell}</th>`).join("")}</tr></thead>`;
  const bodyHtml = bodyRows.length
    ? `<tbody>${bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>`
    : "";

  return `
    <figure class="latex-table-wrap my-8">
      <div class="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
        <table class="latex-table w-full border-collapse">${headHtml}${bodyHtml}</table>
      </div>
      ${caption ? `<figcaption class="mt-3 text-center text-sm opacity-75">Table. ${renderInlineLatex(caption)}</figcaption>` : ""}
      ${label ? `<div class="text-center text-[11px] opacity-50 mt-1">${escapeHtml(label)}</div>` : ""}
    </figure>`;
};

const renderFigureBlock = (source, imageLookup) => {
  const fileName = source.match(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/)?.[1]?.trim() || "";
  const caption = source.match(/\\caption\{([\s\S]*?)\}/)?.[1]?.trim() || "";
  const label = source.match(/\\label\{([\s\S]*?)\}/)?.[1]?.trim() || "";
  const widthOption = source.match(/\\includegraphics\[([^\]]+)\]/)?.[1] || "";
  const widthMatch = widthOption.match(/width\s*=\s*([0-9.]+)\\(?:textwidth|linewidth)/);
  const widthPercent = widthMatch ? `${Math.min(100, Math.max(20, Number(widthMatch[1]) * 100))}%` : "75%";
  const imageSrc = imageLookup.get(fileName) || imageLookup.get(fileName.replace(/^.*[\\/]/, ""));

  return `
    <figure class="my-8 flex flex-col items-center gap-3">
      ${imageSrc
        ? `<img src="${imageSrc}" alt="${escapeHtml(caption || fileName)}" class="rounded-2xl border border-black/10 dark:border-white/10 shadow-lg object-contain" style="max-width:${widthPercent};" />`
        : `<div class="w-full max-w-xl rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/5 px-6 py-10 text-center text-sm text-amber-600">Uploaded image not found for <span class="font-mono">${escapeHtml(fileName || "image-name.png")}</span>. Use the image upload button and keep the filename consistent with <span class="font-mono">\\includegraphics</span>.</div>`}
      ${caption ? `<figcaption class="text-sm opacity-75 text-center">Figure. ${renderInlineLatex(caption)}</figcaption>` : ""}
      ${label ? `<div class="text-center text-[11px] opacity-50">${escapeHtml(label)}</div>` : ""}
    </figure>`;
};

function renderLatexPreview(src, images = []) {
  const imageLookup = getImageLookup(images);
  const title = src.match(/\\title\{([\s\S]+?)\}/)?.[1] || "";
  const author = src.match(/\\author\{([\s\S]+?)\}/)?.[1] || "";
  const bodyMatch = src.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
  let body = (bodyMatch?.[1] || src)
    .replace(/\\documentclass[^\n]*\n?/g, "")
    .replace(/\\usepackage[^\n]*\n?/g, "")
    .replace(/\\title\{[\s\S]+?\}\n?/g, "")
    .replace(/\\author\{[\s\S]+?\}\n?/g, "")
    .replace(/\\date\{[\s\S]*?\}\n?/g, "")
    .replace(/\\maketitle/g, "")
    .trim();

  const tokens = [];
  const pushToken = (html) => {
    const token = `@@LATEX_BLOCK_${tokens.length}@@`;
    tokens.push({ token, html });
    return token;
  };

  body = body
    .replace(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/g, (_, content) => pushToken(`<section class="border-l-4 border-blue-500/80 bg-blue-50/60 dark:bg-blue-900/10 p-5 mb-8 rounded-r-xl shadow-sm"><p class="text-xs font-bold tracking-widest opacity-60 mb-3 uppercase">Abstract</p><p class="text-sm leading-relaxed">${renderInlineLatex(content.trim())}</p></section>`))
    .replace(/\\begin\{figure\*?\}([\s\S]*?)\\end\{figure\*?\}/g, (match) => pushToken(renderFigureBlock(match, imageLookup)))
    .replace(/\\begin\{table\*?\}([\s\S]*?)\\end\{table\*?\}/g, (match) => pushToken(renderTableBlock(match)))
    .replace(/\\begin\{(?:tabular|tabularx)\}(?:\{[^}]*\})?\{[^}]*\}[\s\S]*?\\end\{(?:tabular|tabularx)\}/g, (match) => pushToken(renderTableBlock(match)))
    .replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, (_, items) => pushToken(renderListBlock(items, false)))
    .replace(/\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g, (_, items) => pushToken(renderListBlock(items, true)))
    .replace(/\\begin\{(equation\*?|align\*?|gather\*?)\}([\s\S]*?)\\end\{\1\}/g, (match) => pushToken(`<div class="latex-display my-6 overflow-x-auto">${renderMath(match, true)}</div>`))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, expr) => pushToken(`<div class="latex-display my-6 overflow-x-auto">${renderMath(expr, true)}</div>`))
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => pushToken(`<div class="latex-display my-6 overflow-x-auto">${renderMath(expr, true)}</div>`))
    .replace(/\\section\*?\{([^}]+)\}/g, (_, titleText) => `\n\n${pushToken(`<h2 class="text-xl font-semibold mt-10 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">${renderInlineLatex(titleText)}</h2>`)}\n\n`)
    .replace(/\\subsection\*?\{([^}]+)\}/g, (_, titleText) => `\n\n${pushToken(`<h3 class="text-lg font-medium mt-6 mb-3 opacity-90">${renderInlineLatex(titleText)}</h3>`)}\n\n`);

  const blocks = body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => /^@@LATEX_BLOCK_\d+@@$/.test(block)
      ? block
      : `<p class="mb-4 leading-relaxed text-[15px]">${renderInlineLatex(block)}</p>`)
    .join("");

  let content = `<div class="font-serif latex-preview-content">`;
  if (title) content += `<h1 class="text-2xl font-bold text-center mb-2 leading-tight tracking-wide">${renderInlineLatex(title)}</h1>`;
  if (author) content += `<p class="text-center text-sm opacity-75 mb-6 text-gray-500">${renderInlineLatex(author)}</p>`;
  if (title || author) content += `<hr class="border-t border-gray-300 dark:border-gray-700 mb-6"/>`;
  content += blocks;
  content += `</div>`;

  tokens.forEach(({ token, html }) => {
    content = content.replaceAll(token, html);
  });

  return content;
}

const collectExistingPackages = (src) => {
  const existing = new Set();
  for (const match of src.matchAll(/\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/g)) {
    const names = String(match[1] || "").split(",").map((name) => name.trim()).filter(Boolean);
    names.forEach((name) => existing.add(name));
  }
  return existing;
};

const ensureCompilableLatex = (src) => {
  if (!src?.trim()) return src;

  let output = src.replace(/\r\n/g, "\n");
  const hasDocumentClass = /\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/.test(output);
  if (!hasDocumentClass) return output;

  output = output.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => `\\[\n${expr.trim()}\n\\]`);

  if (/\\includegraphics/.test(output)) {
    output = output.replace(/\\includegraphics(\[[^\]]*\])?\{([^}]+)\}/g, (_, options = "", fileName) => `\\LatexStudioIncludeGraphics${options || ""}{${fileName}}`);
  }

  const existingPackages = collectExistingPackages(output);
  const requiredPackages = new Set();
  LATEX_PACKAGE_RULES.forEach(({ test, packages }) => {
    if (test.test(output)) packages.forEach((pkg) => requiredPackages.add(pkg));
  });
  if (output.includes("\\LatexStudioIncludeGraphics")) requiredPackages.add("graphicx");

  const missingPackages = Array.from(requiredPackages).filter((pkg) => !existingPackages.has(pkg));
  if (missingPackages.length) {
    const packageLines = missingPackages.map((pkg) => `\\usepackage{${pkg}}`).join("\n");
    const usePackageMatches = [...output.matchAll(/\\usepackage(?:\[[^\]]*\])?\{[^}]+\}\n?/g)];
    if (usePackageMatches.length) {
      const last = usePackageMatches[usePackageMatches.length - 1];
      const insertIndex = (last.index || 0) + last[0].length;
      output = `${output.slice(0, insertIndex)}${packageLines}\n${output.slice(insertIndex)}`;
    } else {
      output = output.replace(/(\\documentclass(?:\[[^\]]*\])?\{[^}]+\}\n?)/, `$1${packageLines}\n`);
    }
  }

  if (output.includes("\\LatexStudioIncludeGraphics") && !output.includes("\\newcommand{\\LatexStudioIncludeGraphics}")) {
    output = output.replace(/\\begin\{document\}/, `${LATEX_STUDIO_GRAPHICS_MACRO}\n\n\\begin{document}`);
  }

  return output.replace(/\n{3,}/g, "\n\n");
};

const apiRequest = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || `Request failed: ${response.status}`);
  }
  return data;
};

export default function App() {
  const [code, setCode] = useState(ensureCompilableLatex(TEMPLATES.article));
  const [compiledPdfUrl, setCompiledPdfUrl] = useState("");
  const [compileIssues, setCompileIssues] = useState([]);
  const [topic, setTopic] = useState("");
  const [reviews, setReviews] = useState([]);
  const [dialogQueue, setDialogQueue] = useState([]);
  const [loadingRole, setLoadingRole] = useState(null);
  const [activeTab, setActiveTab] = useState("preview");
  const [isDark, setIsDark] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, selectedText: "" });
  const [page, setPage] = useState("auth");
  const [authTab, setAuthTab] = useState("login");
  const [authMessage, setAuthMessage] = useState("");
  const [currentUser, setCurrentUser] = useState("");
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectTemplate, setNewProjectTemplate] = useState("article");
  const [shareProjectId, setShareProjectId] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [projectSort, setProjectSort] = useState("updated_desc");
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [authForm, setAuthForm] = useState({ username: "", password: "", newPassword: "" });
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showFormulaHelper, setShowFormulaHelper] = useState(false);
  const [showTableBuilder, setShowTableBuilder] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [formulaDraft, setFormulaDraft] = useState("\\frac{a}{b}");
  const [tableBuilder, setTableBuilder] = useState(DEFAULT_TABLE_BUILDER);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [cursorInfo, setCursorInfo] = useState({ line: 1, col: 1, selected: 0 });
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [isExportingBundle, setIsExportingBundle] = useState(false);
  
  const [consoleLogs, setConsoleLogs] = useState(["[System] IDE Initialized. Ready to compile."]);
  const [isCompiling, setIsCompiling] = useState(false);
  const [consoleFilter, setConsoleFilter] = useState("all");
  const consoleEndRef = useRef(null);
  const autoCompileRef = useRef(null);
  const autoSaveRef = useRef(null);
  const initializedRef = useRef(false);

  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [images, setImages] = useState([]);
  const attachmentInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const editorRef = useRef(null);
  const lineNumRef = useRef(null);
  const reviewEndRef = useRef(null);
  const projectImportInputRef = useRef(null);
  const lineNums = code.split("\n").map((_, i) => i + 1);
  const wordCount = code.trim() ? code.trim().split(/\s+/).length : 0;
  const charCount = code.length;

  const outline = [];
  const regex = /\\(section|subsection)\*?\{([^}]+)\}/g;
  let match;
  while ((match = regex.exec(code)) !== null) {
    outline.push({ level: match[1], title: match[2] });
  }

  useEffect(() => { if (activeTab === "reviews") reviewEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [reviews, activeTab]);
  useEffect(() => { consoleEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [consoleLogs]);

  useEffect(() => {
    const init = async () => {
      try {
        const savedUsers = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
        const savedProjects = JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]");
        const savedSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
        const sessionUser = localStorage.getItem(SESSION_USER_KEY) || "";
        setUsers(Array.isArray(savedUsers) ? savedUsers : []);
        setProjects(Array.isArray(savedProjects) ? savedProjects : []);
        if (savedSettings) setSettings(mergeSettings(savedSettings));

        try {
          const remoteUsers = await apiRequest("/api/users");
          if (Array.isArray(remoteUsers.users)) setUsers(remoteUsers.users);
        } catch {}

        if (sessionUser) {
          setCurrentUser(sessionUser);
          setPage("home");
          try {
            const remoteProjects = await apiRequest(`/api/projects?owner=${encodeURIComponent(sessionUser)}`);
            if (Array.isArray(remoteProjects.projects)) setProjects(remoteProjects.projects);
          } catch {}
        }
      } catch {
        setUsers([]);
        setProjects([]);
      }
    };
    init();
  }, []);

  useEffect(() => { try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch {} }, [users]);
  useEffect(() => { try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects)); } catch {} }, [projects]);
  useEffect(() => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {} }, [settings]);
  useEffect(() => { if (activeProjectId) setProjectAssets(activeProjectId, { attachments, images }); }, [activeProjectId, attachments, images]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("latex_studio_draft");
      if (saved) { setCode(ensureCompilableLatex(saved)); setConsoleLogs(prev => [...prev, "[AutoSave] Local draft restored."]); }
    } catch {}
  }, []);

  useEffect(() => {
    if (!settings.autoCompile) return;
    if (!initializedRef.current) { initializedRef.current = true; return; }
    clearTimeout(autoCompileRef.current);
    autoCompileRef.current = setTimeout(() => { if (!isCompiling) handleCompile(); }, 1200);
    return () => clearTimeout(autoCompileRef.current);
  }, [code, settings.autoCompile]);

  useEffect(() => {
    if (!settings.autoSave) return;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      try { localStorage.setItem("latex_studio_draft", code); setLastSavedAt(new Date()); } catch {}
    }, 600);
    return () => clearTimeout(autoSaveRef.current);
  }, [code, settings.autoSave]);

  useEffect(() => {
    const closeMenu = () => setContextMenu(prev => ({ ...prev, visible: false }));
    if (contextMenu.visible) {
      window.addEventListener("click", closeMenu);
      window.addEventListener("scroll", closeMenu, true);
    }
    return () => { window.removeEventListener("click", closeMenu); window.removeEventListener("scroll", closeMenu, true); };
  }, [contextMenu.visible]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (page !== "studio") return;
      if (e.ctrlKey && e.key.toLowerCase() === "k") { e.preventDefault(); setShowCommandPalette(true); }
      if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const normalizedCode = ensureCompilableLatex(code);
        if (normalizedCode !== code) setCode(normalizedCode);
        if (settings.formatOnSave) setConsoleLogs(prev => [...prev, "[Format] Document formatted via auto-save."]);
        if (activeProjectId) {
          setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, content: normalizedCode, updatedAt: Date.now() } : p));
          setConsoleLogs(prev => [...prev, "[Project] Saved current project."]);
          apiRequest("/api/projects/save", {
            method: "POST",
            body: JSON.stringify({
              id: activeProjectId,
              owner: currentUser,
              content: normalizedCode,
              name: (projects.find(p => p.id === activeProjectId)?.name) || "main",
              template: (projects.find(p => p.id === activeProjectId)?.template) || "article"
            })
          }).catch((err) => setConsoleLogs(prev => [...prev, `[Error] Save failed: ${err.message}`]));
        } else { handleDownloadTex(); }
      }
      if (e.ctrlKey && e.key === "Enter") { e.preventDefault(); handleCompile(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [page, activeProjectId, code, settings.formatOnSave]);

  const handleLogin = async () => {
    if (!authForm.username || !authForm.password) { setAuthMessage("Please enter username and password."); return; }
    try {
      await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: authForm.username, password: authForm.password })
      });
      setCurrentUser(authForm.username);
      localStorage.setItem(SESSION_USER_KEY, authForm.username);
      const remoteProjects = await apiRequest(`/api/projects?owner=${encodeURIComponent(authForm.username)}`);
      setProjects(Array.isArray(remoteProjects.projects) ? remoteProjects.projects : []);
      setPage("home");
      setAuthMessage("");
    } catch (err) {
      setAuthMessage(err.message || "Invalid username or password.");
    }
  };

  const handleRegister = async () => {
    if (!authForm.username || !authForm.password) { setAuthMessage("Please enter username and password."); return; }
    if (users.find(u => u.username === authForm.username)) { setAuthMessage("User already exists."); return; }
    try {
      const data = await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ username: authForm.username, password: authForm.password })
      });
      if (Array.isArray(data.users)) setUsers(data.users);
      setCurrentUser(authForm.username);
      localStorage.setItem(SESSION_USER_KEY, authForm.username);
      setProjects([]);
      setPage("home");
      setAuthMessage("");
    } catch (err) {
      setAuthMessage(err.message || "Register failed.");
    }
  };

  const handleLogout = () => {
    setCurrentUser("");
    localStorage.removeItem(SESSION_USER_KEY);
    setPage("auth");
  };

  const handleCreateProject = async () => {
    const name = newProjectName.trim() || `Untitled ${projects.length + 1}`;
    const template = newProjectTemplate in TEMPLATES ? newProjectTemplate : "article";
    const content = ensureCompilableLatex(TEMPLATES[template] || TEMPLATES.article);
    try {
      const data = await apiRequest("/api/projects/create", {
        method: "POST",
        body: JSON.stringify({ owner: currentUser, name, template, content })
      });
      const project = data.project || {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        owner: currentUser,
        name,
        template,
        content,
        updatedAt: Date.now()
      };
      setProjects(prev => [project, ...prev]);
      setActiveProjectId(project.id);
      setAttachments([]);
      setImages([]);
      setCode(ensureCompilableLatex(project.content || content));
      setNewProjectName("");
      setPage("studio");
      setConsoleLogs(prev => [...prev, `[Project] Created: ${name}`]);
    } catch (err) {
      setConsoleLogs(prev => [...prev, `[Error] Create project failed: ${err.message}`]);
    }
  };

  const handleOpenProject = async (project) => {
    if (!project) return;
    try {
      const detail = await apiRequest(`/api/projects/${encodeURIComponent(project.id)}?owner=${encodeURIComponent(currentUser)}`);
      const merged = { ...project, ...(detail.project || {}) };
      const normalizedContent = ensureCompilableLatex(merged.content || TEMPLATES.article);
      const storedAssets = getProjectAssets(merged.id);
      setActiveProjectId(merged.id);
      setAttachments(storedAssets.attachments || []);
      setImages(storedAssets.images || []);
      setCode(normalizedContent);
      setProjects(prev => prev.map(p => p.id === merged.id ? { ...merged, content: normalizedContent } : p));
      setPage("studio");
      setConsoleLogs(prev => [...prev, `[Project] Opened: ${merged.name}`]);
    } catch (err) {
      setConsoleLogs(prev => [...prev, `[Error] Open project failed: ${err.message}`]);
    }
  };

  const handleTemplateChange = (e) => {
    const newTemplate = e.target.value;
    setSettings((prev) => ({ ...prev, template: newTemplate }));
    if (window.confirm("Changing template will overwrite current code. Continue?")) {
      const nextTemplate = ensureCompilableLatex(TEMPLATES[newTemplate] || TEMPLATES.article);
      setCode(nextTemplate);
      setCompiledPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });
      setConsoleLogs((prev) => [...prev, `[Template] Switched to ${newTemplate}.`]);
    }
  };

  const updateGlobalLlmConfig = (patch) => {
    setSettings((prev) => ({ ...prev, llm: { ...prev.llm, ...patch } }));
  };

  const updateRoleLlmConfig = (role, patch) => {
    setSettings((prev) => ({
      ...prev,
      roleLlm: {
        ...prev.roleLlm,
        [role]: { ...(prev.roleLlm?.[role] || DEFAULT_LLM_CONFIG), ...patch }
      }
    }));
  };

  const handleGlobalProviderChange = (provider) => {
    updateGlobalLlmConfig({ provider, model: getDefaultModelForProvider(provider), baseUrl: getDefaultBaseUrl(provider) });
  };

  const handleRoleProviderChange = (role, provider) => {
    updateRoleLlmConfig(role, { provider, model: getDefaultModelForProvider(provider), baseUrl: getDefaultBaseUrl(provider) });
  };

  const handleDeleteProject = async (projectId) => {
    try {
      await apiRequest("/api/projects/delete", {
        method: "POST",
        body: JSON.stringify({ id: projectId, owner: currentUser })
      });
      setProjects(prev => prev.filter(p => p.id !== projectId));
      deleteProjectAssets(projectId);
      if (activeProjectId === projectId) setActiveProjectId(null);
      setConsoleLogs(prev => [...prev, `[Project] Deleted: ${projectId}`]);
    } catch (err) {
      setConsoleLogs(prev => [...prev, `[Error] Delete failed: ${err.message}`]);
    }
  };

  const handleDownloadTex = () => {
    const normalizedCode = ensureCompilableLatex(code);
    if (normalizedCode !== code) setCode(normalizedCode);
    const fileName = `${(currentProject?.name || "main").replace(/[\\/:*?"<>|]/g, "_")}.tex`;
    const blob = new Blob([normalizedCode], { type: "text/x-tex;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setConsoleLogs(prev => [...prev, `[Export] Downloaded ${fileName}`]);
  };

  const handleDownloadPdf = async () => {
    if (!compiledPdfUrl) return;
    const response = await fetch(compiledPdfUrl);
    const blob = await response.blob();
    const fileName = `${(currentProject?.name || "main").replace(/[\\/:*?"<>|]/g, "_")}.pdf`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setConsoleLogs(prev => [...prev, `[Export] Downloaded ${fileName}`]);
  };

  const handleExportBundle = async () => {
    setIsExportingBundle(true);
    try {
      const zip = new JSZip();
      const projectName = (currentProject?.name || "latex-project").replace(/[\\/:*?"<>|]/g, "_");
      zip.file("main.tex", ensureCompilableLatex(code));
      attachments.forEach((attachment) => { if (attachment?.name && typeof attachment.content === "string") zip.file(attachment.name, attachment.content); });
      images.forEach((image) => {
        if (!image?.name || !image?.dataUrl) return;
        const base64 = String(image.dataUrl).split(",")[1];
        if (base64) zip.file(image.name, base64, { base64: true });
      });
      if (compiledPdfUrl) {
        const response = await fetch(compiledPdfUrl);
        zip.file("main.pdf", await response.blob());
      }
      const bundle = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(bundle);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setConsoleLogs(prev => [...prev, `[Export] Downloaded ${projectName}.zip`]);
    } catch (error) {
      setConsoleLogs(prev => [...prev, `[Error] Bundle export failed: ${error.message}`]);
    } finally {
      setIsExportingBundle(false);
    }
  };

  const handleRemoveDialogLine = (id) => {
    setDialogQueue(prev => prev.filter(item => item.id !== id));
  };

  const discardSuggestion = (reviewId) => {
    setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, status: "discarded" } : r));
    setConsoleLogs(prev => [...prev, "[Review] Suggestion discarded."]);
  };

  const handleScroll = () => {
    if (lineNumRef.current && editorRef.current && settings.lineNumbers) {
      lineNumRef.current.scrollTop = editorRef.current.scrollTop;
    }
  };

  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'f') { e.preventDefault(); setShowFindReplace(true); return; }
    if (e.ctrlKey && e.key.toLowerCase() === 'h') { e.preventDefault(); setShowFindReplace(true); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart; const end = e.target.selectionEnd; const val = e.target.value;
      const spaces = " ".repeat(Number(settings.tabSize));
      setCode(val.substring(0, start) + spaces + val.substring(end));
      setTimeout(() => { if (editorRef.current) { editorRef.current.selectionStart = editorRef.current.selectionEnd = start + Number(settings.tabSize); } }, 0);
    }
  };

  const updateCursorInfo = () => {
    const el = editorRef.current; if (!el) return;
    const start = el.selectionStart; const end = el.selectionEnd;
    const lines = el.value.slice(0, start).split("\n");
    setCursorInfo({ line: lines.length, col: lines[lines.length - 1].length + 1, selected: Math.max(0, end - start) });
  };

  const handleFindNext = () => {
    const el = editorRef.current; if (!el || !findText) return;
    const source = code.toLowerCase(); const query = findText.toLowerCase();
    let idx = source.indexOf(query, el.selectionEnd ?? 0);
    if (idx === -1) idx = source.indexOf(query, 0);
    if (idx !== -1) { el.focus(); el.selectionStart = idx; el.selectionEnd = idx + findText.length; updateCursorInfo(); }
  };

  const handleReplaceCurrent = () => {
    const el = editorRef.current; if (!el || !findText) return;
    const selected = code.substring(el.selectionStart, el.selectionEnd);
    if (selected.toLowerCase() === findText.toLowerCase()) {
      const start = el.selectionStart;
      setCode(prev => prev.slice(0, start) + replaceText + prev.slice(el.selectionEnd));
      setTimeout(() => { if (!editorRef.current) return; editorRef.current.selectionStart = start; editorRef.current.selectionEnd = start + replaceText.length; updateCursorInfo(); }, 0);
    } else { handleFindNext(); }
  };

  const handleReplaceAll = () => {
    if (!findText) return;
    setCode(prev => prev.replace(new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), replaceText));
  };

  const handleEditorContextMenu = (e) => {
    const el = editorRef.current; if (!el) return;
    const selectedText = el.value.substring(el.selectionStart, el.selectionEnd).trim();
    if (!selectedText) { setContextMenu(prev => ({ ...prev, visible: false })); return; }
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, selectedText });
  };

  const handleAddToLine = () => {
    if (!contextMenu.selectedText) return;
    setDialogQueue(prev => [...prev, { id: Date.now() + Math.random(), text: contextMenu.selectedText }]);
    setIsChatExpanded(true);
    setConsoleLogs(prev => [...prev, "[Dialog] Selection added to Line queue."]);
    setContextMenu(prev => ({ ...prev, visible: false, selectedText: "" }));
  };

  const sanitizeModelOutput = (text) => (text || "").replace(/^```latex\n/i, "").replace(/^```\n/i, "").replace(/```$/i, "").trim();

  const readFileAsData = (file, asDataUrl = false) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    asDataUrl ? reader.readAsDataURL(file) : reader.readAsText(file);
  });

  const handlePickFiles = async (e, isImage) => {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    try {
      const loaded = await Promise.all(files.map(async file => ({
        id: `${Date.now()}-${Math.random()}`, name: file.name, type: file.type || (isImage ? "image/*" : "text/plain"),
        [isImage ? 'dataUrl' : 'content']: String(await readFileAsData(file, isImage)).slice(0, 160000)
      })));
      isImage ? setImages(prev => [...prev, ...loaded]) : setAttachments(prev => [...prev, ...loaded]);
      setConsoleLogs(prev => [...prev, `[${isImage ? 'Image' : 'Attachment'}] Added ${loaded.length} item(s).`]);
      if (isImage && loaded[0]) {
        insertAtCursor(`\n\\begin{figure}[htbp]\n  \\centering\n  \\LatexStudioIncludeGraphics[width=0.75\\linewidth]{${loaded[0].name}}\n  \\caption{Describe the uploaded image}\n  \\label{fig:${loaded[0].name.replace(/\W+/g, "-").toLowerCase()}}\n\\end{figure}\n`);
        setConsoleLogs(prev => [...prev, `[Image] Figure snippet inserted for ${loaded[0].name}.`]);
      } else if (!isImage && loaded.some((file) => isBibFile(file.name)) && !/\\bibliography\{|\\printbibliography/.test(code)) {
        const bibSnippet = buildBibliographySnippet(loaded.filter((file) => isBibFile(file.name)));
        if (bibSnippet) {
          insertAtCursor(bibSnippet);
          setConsoleLogs(prev => [...prev, "[Bib] Bibliography snippet inserted."]);
        }
      }
      setIsChatExpanded(true);
    } catch (err) { setConsoleLogs(prev => [...prev, `[Error] Failed to load: ${err.message}`]); }
    finally { e.target.value = ""; }
  };

  const insertAtCursor = (snippet) => {
    const editor = editorRef.current;
    if (!editor) {
      setCode(prev => `${prev}${prev.endsWith("\n") ? "" : "\n"}${snippet}`);
      return;
    }
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const nextCode = `${code.slice(0, start)}${snippet}${code.slice(end)}`;
    setCode(nextCode);
    requestAnimationFrame(() => {
      if (!editorRef.current) return;
      const cursor = start + snippet.length;
      editorRef.current.focus();
      editorRef.current.selectionStart = cursor;
      editorRef.current.selectionEnd = cursor;
      updateCursorInfo();
    });
  };

  const insertBeforeEndDocument = (snippet) => {
    if (/\\end\{document\}/.test(code)) {
      setCode((prev) => prev.replace(/\\end\{document\}/, `${snippet}\n\\end{document}`));
    } else {
      insertAtCursor(snippet);
    }
  };

  const jumpToLine = (line) => {
    const editor = editorRef.current;
    if (!editor) return;
    const safeLine = Math.max(1, Number(line) || 1);
    const lines = code.split("\n");
    const index = lines.slice(0, safeLine - 1).reduce((sum, current) => sum + current.length + 1, 0);
    const lineLength = (lines[safeLine - 1] || "").length;
    editor.focus();
    editor.selectionStart = index;
    editor.selectionEnd = index + lineLength;
    const lineHeightPx = Number(settings.fontSize) * Number(settings.lineHeight || 1.5);
    editor.scrollTop = Math.max(0, (safeLine - 2) * lineHeightPx);
    updateCursorInfo();
  };

  const removeImage = (id) => setImages((prev) => prev.filter((item) => item.id !== id));
  const removeAttachment = (id) => setAttachments((prev) => prev.filter((item) => item.id !== id));

  const bibliographyAttachments = attachments.filter((attachment) => isBibFile(attachment?.name));
  const bibliographyEntries = bibliographyAttachments.flatMap((attachment) => extractBibEntries(attachment.content).map((key) => ({ fileName: attachment.name, key })));

  const handleInsertFormula = (snippet) => {
    insertAtCursor(`\n${snippet}\n`);
    setShowFormulaHelper(false);
  };

  const handleInsertCustomFormula = () => {
    const snippet = formulaDraft.trim().startsWith("$") || formulaDraft.includes("\\begin") ? formulaDraft.trim() : `\\[\n  ${formulaDraft.trim()}\n\\]`;
    handleInsertFormula(snippet);
  };

  const handleInsertGeneratedTable = () => {
    insertAtCursor(buildTableSnippet(tableBuilder));
    setShowTableBuilder(false);
  };

  const applySuggestion = (reviewId) => {
    const review = reviews.find(r => r.id === reviewId); if (!review?.targetText || !review?.replacementText) return;
    let replaced = false;
    setCode(prevCode => {
      if (prevCode.includes(review.targetText)) { replaced = true; return prevCode.replace(review.targetText, review.replacementText); }
      return prevCode;
    });
    setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, status: replaced ? "applied" : "failed" } : r));
    if (replaced) { setConsoleLogs(prev => [...prev, `[Apply] ${review.role} suggestion applied.`]); setDialogQueue([]); handleCompile(); }
  };

  const handleCompile = async () => {
    if (isCompiling) return;
    const normalizedCode = ensureCompilableLatex(code);
    if (normalizedCode !== code) {
      setCode(normalizedCode);
      setConsoleLogs(prev => [...prev, "[Fix] Added missing LaTeX packages and safe image wrapper for PDF compilation."]);
    }
    if (compiledPdfUrl) {
      URL.revokeObjectURL(compiledPdfUrl);
      setCompiledPdfUrl("");
    }
    if (activeProjectId && currentUser) {
      try {
        await apiRequest("/api/projects/save", {
          method: "POST",
          body: JSON.stringify({
            id: activeProjectId,
            owner: currentUser,
            content: normalizedCode,
            name: currentProject?.name || "main",
            template: currentProject?.template || "article"
          })
        });
        setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, content: normalizedCode, updatedAt: Date.now() } : p));
        setConsoleLogs(prev => [...prev, `[Project] Auto-saved to local file: ${(currentProject?.name || activeProjectId)}.tex`]);
      } catch (err) {
        setConsoleLogs(prev => [...prev, `[Error] Save before compile failed: ${err.message}`]);
      }
    }
    setIsCompiling(true);
    setActiveTab("preview");
    setConsoleLogs(prev => [...prev, `\n> Recompiling ${settings.compiler} main.tex...`, "Checking syntax...", "Running real LaTeX compiler..."]);

    try {
      const result = await apiRequest("/api/projects/compile", {
        method: "POST",
        body: JSON.stringify({
          id: activeProjectId || `temp-${Date.now()}`,
          owner: currentUser || "guest",
          compiler: settings.compiler,
          content: normalizedCode,
          images,
          attachments
        })
      });

      const binary = atob(result.pdfBase64 || "");
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const pdfBlob = new Blob([bytes], { type: "application/pdf" });
      const pdfUrl = URL.createObjectURL(pdfBlob);
      setCompiledPdfUrl(pdfUrl);
      setCompileIssues(parseCompileIssues(result.log));
      setConsoleLogs(prev => [
        ...prev,
        `[Success] Output written to main.pdf via ${result.compiler}.`,
        "Compilation finished successfully.",
        ...(result.log ? result.log.split(/\r?\n/).filter(Boolean).slice(-12) : [])
      ]);
    } catch (err) {
      setCompileIssues(parseCompileIssues(err.message || ""));
      setConsoleLogs(prev => [...prev, `[Error] Compile failed: ${err.message}`]);
    } finally {
      setIsCompiling(false);
    }
  };

  const invokeAgent = async (roleId) => {
    setLoadingRole(roleId); setConsoleLogs(prev => [...prev, `\n> Waking up AI Agent: ${roleId.toUpperCase()}...`]);
    const roleLlm = settings.roleLlm?.[roleId] || settings.llm || DEFAULT_LLM_CONFIG;
    const dialogTarget = dialogQueue.map(item => item.text).join("\n\n");
    const isDialogMode = dialogQueue.length > 0;
    const focusedInstruction = "You are working in focused-edit mode. Only rewrite the provided selected LaTeX snippet. Output ONLY the revised LaTeX snippet, no explanation.";
    const extraContext = (attachments.length ? `\n\nAttached files:\n${attachments.map(a => a.content).join("\n\n")}` : "") + (images.length ? `\n\nAttached images metadata:\n${images.map(img => img.dataUrl.slice(0, 1000)).join("\n\n")}` : "");
    
    try {
      if (roleId === "researcher") {
        const prompt = isDialogMode ? `Topic: ${topic}\n\nSnippet:\n${dialogTarget}\n\nImprove this.` : (topic ? `Topic: ${topic}\n\nDraft:\n${code}\n\nGenerate/improve.` : `Improve this:\n\n${code}`);
        let result = sanitizeModelOutput(await callLLM(`${prompt}${extraContext}`, isDialogMode ? `${settings.prompts.researcher}\n\n${focusedInstruction}` : settings.prompts.researcher, roleLlm));
        if (isDialogMode) {
          setReviews(prev => [...prev, { id: Date.now(), role: "Researcher", content: result, replacementText: result, targetText: dialogTarget, status: "pending", time: new Date() }]);
          setConsoleLogs(prev => [...prev, "[AI] Researcher suggestion generated."]);
        } else { setCode(result); handleCompile(); }
      } else if (roleId === "professor" || roleId === "reviewer") {
        const basePrompt = roleId === "professor" ? settings.prompts.professor : settings.prompts.reviewer;
        const prompt = isDialogMode ? `Snippet:\n${dialogTarget}\n\nReview this.` : `Draft:\n${code}\n\nReview this.`;
        const result = sanitizeModelOutput(await callLLM(`${prompt}${extraContext}`, isDialogMode ? `${basePrompt}\n\n${focusedInstruction}` : basePrompt, roleLlm));
        setReviews(prev => [...prev, { id: Date.now(), role: roleId === "professor" ? "Professor" : "Reviewer", content: result, replacementText: isDialogMode ? result : null, targetText: isDialogMode ? dialogTarget : null, status: isDialogMode ? "pending" : "review", time: new Date() }]);
        setConsoleLogs(prev => [...prev, `[AI] ${roleId === "professor" ? "Professor" : "Reviewer"} feedback generated.`]);
      }
    } catch (err) { setConsoleLogs(prev => [...prev, `[Error] ${roleId} failed: ${err.message}`]); } 
    finally { setLoadingRole(null); }
  };

  // --- Styled Variables ---
  const bgMain = isDark ? "bg-gradient-to-br from-[#0d1117] to-[#161b22] text-gray-200" : "bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900";
  const bgPanel = isDark ? "bg-[#161b22]/90 backdrop-blur-xl border-white/5" : "bg-white/90 backdrop-blur-xl border-gray-200";
  const bgEditor = isDark ? "bg-[#0d1117]/80" : "bg-white/80";
  const borderCol = isDark ? "border-[#30363d]/60" : "border-slate-200/80";
  const inputBg = isDark ? "bg-[#0d1117]/50 border-gray-700 focus:border-blue-500/50 text-white" : "bg-slate-50 border-slate-300 focus:border-blue-500/50 text-slate-900";
  
  const iconBtn = `p-2 rounded-full transition-all duration-300 active:scale-95 flex items-center justify-center ${isDark ? 'text-gray-400 hover:bg-white/10 hover:text-white' : 'text-gray-500 hover:bg-black/5 hover:text-black'}`;
  const pillBtn = `px-3.5 py-1.5 rounded-full transition-all duration-300 active:scale-95 flex items-center gap-1.5 text-xs font-medium border shadow-sm ${isDark ? 'border-white/5 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white hover:shadow-white/5' : 'border-black/5 bg-white/50 text-gray-700 hover:bg-white hover:text-black hover:shadow-black/5'}`;
  const fancyPillBtn = `group px-3.5 py-2 rounded-2xl transition-all duration-300 active:scale-95 flex items-center gap-2 text-xs font-semibold border shadow-sm ${isDark ? 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10 hover:border-white/20' : 'border-slate-200 bg-white/80 text-slate-700 hover:bg-white hover:border-slate-300'}`;
  const settingsInput = `w-full p-2.5 rounded-xl border ${inputBg} outline-none text-sm transition-all`;
  const settingsToggle = `flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${inputBg}`;

  const currentProject = projects.find(p => p.id === activeProjectId) || null;
  const commandItems = [
    { id: "compile", label: "Recompile PDF", run: () => handleCompile() },
    { id: "toggle-theme", label: isDark ? "Switch to Light Theme" : "Switch to Dark Theme", run: () => setIsDark(v => !v) },
    { id: "open-settings", label: "Open Settings", run: () => setShowSettings(true) },
    { id: "find", label: "Open Find/Replace", run: () => setShowFindReplace(true) }
  ].filter(item => item.label.toLowerCase().includes(commandQuery.toLowerCase()));

  const filteredConsoleLogs = consoleLogs.filter((log) => {
    if (consoleFilter === "all") return true;
    if (consoleFilter === "error") return /\[Error\]|error/i.test(log);
    if (consoleFilter === "warning") return /warning/i.test(log);
    if (consoleFilter === "info") return !/\[Error\]|error|warning/i.test(log);
    return true;
  });

  if (page === "auth") {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 relative overflow-hidden ${bgMain}`}>
        {/* Decorative background blobs */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/20 blur-[120px] rounded-full pointer-events-none" />
        
        <div className={`w-full max-w-md rounded-3xl border shadow-2xl backdrop-blur-2xl z-10 ${bgPanel} p-8`}>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">LaTeX Studio</h2>
            <button onClick={() => setIsDark(!isDark)} className={iconBtn}>{isDark ? <Sun size={18} /> : <Moon size={18} />}</button>
          </div>
          
          <div className="flex gap-2 mb-6 p-1 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
            <button onClick={() => setAuthTab("login")} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${authTab === 'login' ? 'bg-white dark:bg-[#21262d] shadow text-blue-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Sign In</button>
            <button onClick={() => setAuthTab("register")} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${authTab === 'register' ? 'bg-white dark:bg-[#21262d] shadow text-blue-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Sign Up</button>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium opacity-70 ml-1">Username</label>
              <input value={authForm.username} onChange={e => setAuthForm(f => ({ ...f, username: e.target.value }))} className={`w-full px-4 py-2.5 rounded-xl border transition-all ${inputBg}`} placeholder="Enter your username" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium opacity-70 ml-1">Password</label>
              <input type="password" value={authForm.password} onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))} className={`w-full px-4 py-2.5 rounded-xl border transition-all ${inputBg}`} placeholder="••••••••" />
            </div>
            <button
              onClick={authTab === "login" ? handleLogin : handleRegister}
              className="w-full py-3 mt-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300 active:scale-[0.98]"
            >
              {authTab === "login" ? "Enter Studio" : "Create Account"}
            </button>
            {authMessage && <p className="text-xs text-center mt-4 text-amber-500 font-medium bg-amber-500/10 py-2 rounded-lg border border-amber-500/20">{authMessage}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (page === "home") {
    return (
      <div className={`min-h-screen ${bgMain}`}>
        <header className={`px-6 py-4 border-b flex items-center justify-between sticky top-0 z-20 shadow-sm ${bgPanel}`}>
          <div className="flex items-center gap-3 font-bold text-lg tracking-tight"><Sparkles size={20} className="text-blue-500"/> Projects</div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">{currentUser}</span>
            <button onClick={handleLogout} className={pillBtn}><LogOut size={14}/> Logout</button>
          </div>
        </header>

        <main className="p-6 lg:p-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Tools */}
          <div className="space-y-6 lg:col-span-1">
            <section className={`rounded-2xl border p-5 shadow-sm ${bgPanel}`}>
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Folder size={16}/> New Project</h3>
              <div className="space-y-3">
                <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)} className={`w-full px-3 py-2 rounded-xl border text-sm transition-colors ${inputBg}`} placeholder="Project Name" />
                <select value={newProjectTemplate} onChange={e => setNewProjectTemplate(e.target.value)} className={`w-full px-3 py-2 rounded-xl border text-sm transition-colors ${inputBg}`}>
                  <option value="article">Standard Article</option>
                  <option value="ieee">IEEE Transaction</option>
                </select>
                <button onClick={handleCreateProject} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-md shadow-blue-500/20 transition-all active:scale-[0.98]">Create</button>
              </div>
            </section>
          </div>

          {/* Project List */}
          <div className="lg:col-span-3 space-y-6">
            <div className={`rounded-2xl border p-6 shadow-sm min-h-[60vh] ${bgPanel}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h3 className="font-semibold text-lg">My Documents</h3>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
                    <input value={projectSearch} onChange={e => setProjectSearch(e.target.value)} placeholder="Search..." className={`pl-9 pr-3 py-1.5 rounded-full border text-sm w-48 transition-colors ${inputBg}`} />
                  </div>
                  <select value={projectSort} onChange={e => setProjectSort(e.target.value)} className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${inputBg}`}>
                    <option value="updated_desc">Latest</option>
                    <option value="name_asc">A-Z</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.filter(p => p.owner === currentUser).map(project => (
                  <div key={project.id} className={`group rounded-2xl border p-4 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer ${isDark ? 'bg-[#0d1117] border-white/5 hover:border-blue-500/30' : 'bg-white border-gray-200 hover:border-blue-300'}`} onClick={() => handleOpenProject(project)}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0"><FileText size={20}/></div>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }} className={`p-1.5 rounded-full text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all`}><Trash2 size={14}/></button>
                    </div>
                    <div className="font-semibold truncate text-[15px] mb-1">{project.name}</div>
                    <div className="text-xs opacity-60 mb-3">{project.template}</div>
                    <div className="text-[11px] opacity-50 flex items-center gap-1.5"><Clock size={10}/> {new Date(project.updatedAt).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // --- Studio View ---
  return (
    <div className={`flex flex-col h-screen font-sans overflow-hidden ${bgMain}`}>
      
      {/* Global Header (Glassy) */}
      <header className={`flex items-center justify-between px-4 py-2 shrink-0 z-20 ${bgPanel} shadow-sm`}>
        <div className="flex items-center gap-3">
          <button className={iconBtn} onClick={() => setIsSidebarOpen(!isSidebarOpen)}><Menu size={18} /></button>
          <div className="flex flex-col ml-2">
            <span className="font-bold text-[15px] tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">LaTeX Studio</span>
          </div>
          <div className="hidden md:flex items-center ml-4 px-3 py-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
            <span className="text-xs font-medium opacity-80 max-w-[150px] truncate">{currentProject?.name || "Untitled"}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setPage("home")} className={pillBtn}><Home size={14}/> Home</button>
          <button onClick={() => setShowCommandPalette(true)} className={pillBtn}><Command size={14}/> Cmd</button>
          <div className="w-px h-4 bg-gray-500/30 mx-2"></div>
          <button onClick={() => setIsDark(!isDark)} className={iconBtn}>{isDark ? <Sun size={16} /> : <Moon size={16} />}</button>
          <button onClick={() => setShowSettings(true)} className={iconBtn}><Settings size={16} /></button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left Sidebar (Glassy) */}
        <div className={`transition-all duration-300 ease-in-out flex flex-col border-r shrink-0 z-10 ${borderCol} ${bgPanel} ${isSidebarOpen ? 'w-60' : 'w-0 opacity-0 overflow-hidden'}`}>
          <div className="flex-1 flex flex-col overflow-hidden p-3">
            <div className="text-[10px] font-bold tracking-widest uppercase opacity-50 mb-3 px-2">Project Files</div>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors shadow-sm mb-1 ${isDark ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-600 border border-blue-200'}`}>
              <File size={14} className="text-blue-500"/><span className="text-sm font-medium">main.tex</span>
            </div>
            <div className="grid grid-cols-1 gap-2 mt-2">
              <button
                onClick={() => imageInputRef.current?.click()}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${isDark ? 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20 hover:bg-fuchsia-500/15 hover:border-fuchsia-400/30' : 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 hover:bg-fuchsia-100'}`}
              >
                <span className="h-7 w-7 rounded-lg bg-fuchsia-500/15 text-fuchsia-400 flex items-center justify-center"><Upload size={14}/></span>
                Upload Image
              </button>
              <button
                onClick={() => attachmentInputRef.current?.click()}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${isDark ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/15 hover:border-emerald-400/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}
              >
                <span className="h-7 w-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center"><Paperclip size={14}/></span>
                Upload Asset
              </button>
            </div>
            
            <div className="mt-6 mb-3 px-2 text-[10px] font-bold tracking-widest uppercase opacity-50">Outline</div>
            <div className="max-h-36 overflow-y-auto space-y-0.5">
              {outline.map((item, idx) => (
                <div key={idx} className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${item.level === 'subsection' ? 'ml-4 opacity-80' : 'font-medium'} ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
                  {item.title}
                </div>
              ))}
            </div>

            <div className="mt-6 mb-3 px-2 text-[10px] font-bold tracking-widest uppercase opacity-50">Assets</div>
            <div className="space-y-2 max-h-44 overflow-y-auto">
              {images.map((image) => (
                <div key={image.id} className={`rounded-xl border px-3 py-2 text-xs ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white/80'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate font-medium flex items-center gap-2"><ImagePlus size={12} className="text-fuchsia-400" /> {image.name}</div>
                    <button onClick={() => removeImage(image.id)} className="text-red-400"><Trash2 size={12} /></button>
                  </div>
                  <button onClick={() => insertAtCursor(`\n\\begin{figure}[htbp]\n  \\centering\n  \\LatexStudioIncludeGraphics[width=0.75\\linewidth]{${image.name}}\n  \\caption{Describe the uploaded image}\n  \\label{fig:${image.name.replace(/\W+/g, "-").toLowerCase()}}\n\\end{figure}\n`)} className="mt-2 text-[11px] text-blue-400 hover:underline">Insert figure block</button>
                </div>
              ))}
              {attachments.map((attachment) => (
                <div key={attachment.id} className={`rounded-xl border px-3 py-2 text-xs ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white/80'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate font-medium flex items-center gap-2"><Paperclip size={12} className="text-emerald-400" /> {attachment.name}</div>
                    <button onClick={() => removeAttachment(attachment.id)} className="text-red-400"><Trash2 size={12} /></button>
                  </div>
                  {isBibFile(attachment.name) && (
                    <div className="mt-2 space-y-1">
                      {extractBibEntries(attachment.content).slice(0, 5).map((entry) => (
                        <button key={entry} onClick={() => insertAtCursor(`\\cite{${entry}}`)} className="block text-left text-[11px] text-amber-400 hover:underline">Insert cite: {entry}</button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {!images.length && !attachments.length && <div className="px-3 py-2 text-xs opacity-50">No uploaded assets yet.</div>}
            </div>

            {bibliographyAttachments.length > 0 && (
              <>
                <div className="mt-6 mb-3 px-2 text-[10px] font-bold tracking-widest uppercase opacity-50">Bibliography</div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  <button onClick={() => insertBeforeEndDocument(buildBibliographySnippet(bibliographyAttachments))} className={`w-full text-left rounded-xl border px-3 py-2 text-xs font-medium ${isDark ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>Insert bibliography block</button>
                  {bibliographyEntries.map((entry) => (
                    <button key={`${entry.fileName}-${entry.key}`} onClick={() => insertAtCursor(`\\cite{${entry.key}}`)} className={`w-full text-left rounded-xl border px-3 py-2 text-xs ${isDark ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-slate-200 bg-white/80 hover:bg-slate-50'}`}>{entry.key}</button>
                  ))}
                </div>
              </>
            )}

            <div className="mt-6 mb-3 px-2 text-[10px] font-bold tracking-widest uppercase opacity-50">Problems</div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {compileIssues.length ? compileIssues.map((issue, index) => (
                <button key={`${issue.line}-${index}`} onClick={() => jumpToLine(issue.line)} className={`w-full text-left rounded-xl border px-3 py-2 text-xs ${isDark ? 'border-red-500/20 bg-red-500/10 text-red-200 hover:bg-red-500/15' : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'}`}>
                  <div className="font-semibold flex items-center gap-2"><AlertTriangle size={12} /> Line {issue.line}</div>
                  <div className="mt-1 opacity-80 line-clamp-2">{issue.message}</div>
                </button>
              )) : <div className="px-3 py-2 text-xs opacity-50">No compile issues.</div>}
            </div>
          </div>
        </div>

        {/* Editor Pane */}
        <div className={`flex-1 flex flex-col border-r relative z-0 ${borderCol} ${bgEditor} min-w-[300px]`}>
          <div className={`flex items-center gap-2 px-4 py-2 border-b shrink-0 ${borderCol} ${bgPanel}`}>
            <button onClick={() => setShowFormulaHelper(true)} className={fancyPillBtn}><span className="h-7 w-7 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center"><Code size={14}/></span> Formula Lab</button>
            <button onClick={() => setShowTableBuilder(true)} className={fancyPillBtn}><span className="h-7 w-7 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center"><FileText size={14}/></span> Table Builder</button>
            <button onClick={() => insertAtCursor(QUICK_INSERT_SNIPPETS.figure)} className={fancyPillBtn}><span className="h-7 w-7 rounded-xl bg-fuchsia-500/15 text-fuchsia-400 flex items-center justify-center"><ImagePlus size={14}/></span> Figure</button>
            <button onClick={() => insertBeforeEndDocument(buildBibliographySnippet(bibliographyAttachments))} disabled={!bibliographyAttachments.length} className={`${fancyPillBtn} disabled:opacity-40`}><span className="h-7 w-7 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center"><FileText size={14}/></span> Bibliography</button>
          </div>
          {/* Editor Area */}
          <div className="flex flex-1 overflow-hidden relative" onClick={() => setIsChatExpanded(false)}>
            {settings.lineNumbers && (
              <div 
                ref={lineNumRef}
                className={`w-12 text-right py-4 pr-3 select-none overflow-hidden font-mono border-r border-transparent shrink-0 opacity-40`}
                style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}
              >
                {lineNums.map(n => <div key={n}>{n}</div>)}
              </div>
            )}
            <textarea
              ref={editorRef} value={code} onChange={e => setCode(e.target.value)} onScroll={handleScroll}
              onContextMenu={handleEditorContextMenu} onKeyDown={handleKeyDown} onClick={updateCursorInfo} onKeyUp={updateCursorInfo} spellCheck={settings.spellCheck}
              className={`flex-1 p-4 font-mono resize-none outline-none bg-transparent ${loadingRole === 'researcher' ? 'opacity-50' : ''}`}
              style={{ fontSize: `${settings.fontSize}px`, fontFamily: settings.fontFamily, lineHeight: settings.lineHeight, whiteSpace: settings.wordWrap === 'on' ? 'pre-wrap' : 'pre', tabSize: settings.tabSize }}
            />
          </div>

          {/* Bottom Status Bar (Glassy) */}
          <div className={`h-8 flex items-center justify-between px-4 text-[10px] uppercase tracking-wider font-medium shrink-0 border-t ${borderCol} ${bgPanel}`}>
            <div className="flex gap-4 opacity-60"><span>Ln {cursorInfo.line}, Col {cursorInfo.col}</span><span>Words {wordCount}</span></div>
            <div className="flex gap-4 opacity-60"><span className="flex items-center gap-1"><Save size={10}/> {lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}` : 'Not saved'}</span><span>{settings.compiler}</span></div>
          </div>

          {/* AI Chat Dialog (Floating Glass Pill) */}
          <div className={`absolute bottom-12 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 transition-all duration-500 ease-out z-20 ${isChatExpanded ? 'h-[50vh]' : 'h-auto'}`} onClick={e => e.stopPropagation()}>
            <div className={`w-full h-full flex flex-col rounded-3xl border shadow-2xl overflow-hidden backdrop-blur-2xl transition-all ${isChatExpanded ? (isDark ? 'bg-[#161b22]/90 border-white/10' : 'bg-white/95 border-gray-200/80') : (isDark ? 'bg-[#161b22]/70 border-white/10 hover:border-white/20 hover:bg-[#161b22]/90' : 'bg-white/70 border-gray-200/80 hover:border-gray-300 hover:bg-white/90')}`}>
              
              {!isChatExpanded ? (
                <div className="flex items-center h-12 px-2 cursor-text" onClick={() => setIsChatExpanded(true)}>
                  <div className="flex items-center flex-1 px-3 opacity-60"><Sparkles size={16} className="mr-2 text-blue-500" /><span className="text-sm font-medium">Ask AI to modify code...</span></div>
                  <div className="flex items-center gap-1.5 shrink-0 pr-1">
                    <button onClick={(e) => { e.stopPropagation(); invokeAgent("researcher"); }} className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${loadingRole==='researcher'?'animate-pulse bg-blue-500 text-white shadow-lg shadow-blue-500/40':'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20'}`}><FileText size={12}/> Researcher</button>
                    <button onClick={(e) => { e.stopPropagation(); invokeAgent("professor"); }} className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${loadingRole==='professor'?'animate-pulse bg-purple-500 text-white shadow-lg shadow-purple-500/40':'bg-purple-500/10 text-purple-500 hover:bg-purple-500/20'}`}><AlertTriangle size={12}/> Professor</button>
                    <button onClick={(e) => { e.stopPropagation(); invokeAgent("reviewer"); }} className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${loadingRole==='reviewer'?'animate-pulse bg-rose-500 text-white shadow-lg shadow-rose-500/40':'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20'}`}><CheckCircle size={12}/> Reviewer</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full w-full">
                  <div className={`flex justify-between items-center px-5 py-3 border-b ${borderCol}`}>
                    <span className="text-sm font-bold flex items-center gap-2"><Sparkles size={16} className="text-blue-500"/> AI Studio Assistant</span>
                    <button onClick={() => setIsChatExpanded(false)} className={iconBtn}><ChevronDown size={18}/></button>
                  </div>
                  
                  <div className="flex-1 p-5 overflow-y-auto space-y-4">
                    <div className={`p-3.5 rounded-2xl rounded-tl-sm w-max max-w-[85%] text-sm shadow-sm ${isDark ? 'bg-[#21262d] text-gray-200' : 'bg-blue-50 text-blue-900 border border-blue-100'}`}>
                      Hello! I'm your AI assistant. How can I help improve your document today?
                    </div>
                    {dialogQueue.map(item => (
                      <div key={item.id} className={`p-3 rounded-xl border text-xs relative group ${borderCol} ${isDark ? 'bg-black/20' : 'bg-slate-50'}`}>
                        <div className="absolute -top-2 left-3 px-1 text-[9px] font-bold uppercase tracking-wider bg-inherit">Target Snippet</div>
                        <div className="line-clamp-3 opacity-80 mt-1">{item.text}</div>
                        <button onClick={() => handleRemoveDialogLine(item.id)} className="absolute top-2 right-2 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><X size={14}/></button>
                      </div>
                    ))}
                  </div>
                  
                  <div className={`p-3 border-t ${borderCol} bg-black/5 dark:bg-white/5`}>
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <button onClick={() => invokeAgent("researcher")} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${loadingRole==='researcher'?'animate-pulse bg-blue-500 text-white':'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20'}`}>Researcher</button>
                      <button onClick={() => invokeAgent("professor")} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${loadingRole==='professor'?'animate-pulse bg-purple-500 text-white':'bg-purple-500/10 text-purple-500 hover:bg-purple-500/20'}`}>Professor</button>
                      <button onClick={() => invokeAgent("reviewer")} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${loadingRole==='reviewer'?'animate-pulse bg-rose-500 text-white':'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20'}`}>Reviewer</button>
                      <div className="w-px h-4 bg-gray-500/30 mx-1"></div>
                      <button onClick={() => attachmentInputRef.current?.click()} className={iconBtn}><Paperclip size={14}/></button>
                      <button onClick={() => imageInputRef.current?.click()} className={iconBtn}><ImagePlus size={14}/></button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input autoFocus value={topic} onChange={(e) => setTopic(e.target.value)} className={`flex-1 h-10 rounded-full border px-4 text-sm outline-none transition-all ${inputBg}`} placeholder="Type your instruction..." />
                      <button className="h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 transition-all active:scale-90"><ArrowUp size={16} /></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Column 3: Preview / Reviews */}
        <div className={`flex-1 flex flex-col z-0 relative ${bgEditor}`}>
          
          {/* Glassy Recompile Bar */}
          <div className={`flex items-center justify-between border-b px-3 py-2 shrink-0 shadow-sm z-10 ${borderCol} ${bgPanel}`}>
            <button 
              onClick={handleCompile} disabled={isCompiling}
              className={`flex items-center gap-2 px-5 py-1.5 rounded-full text-sm font-bold text-white transition-all shadow-lg active:scale-95 disabled:opacity-70 ${isCompiling ? 'bg-emerald-500 shadow-emerald-500/40' : 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 shadow-emerald-500/30 hover:shadow-emerald-500/50'}`}
            >
              <RefreshCw size={14} className={isCompiling ? "animate-spin" : ""} /> Recompile
            </button>

            <div className="flex items-center p-0.5 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
              <button onClick={() => setActiveTab("preview")} className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${activeTab === 'preview' ? 'bg-white dark:bg-[#21262d] shadow text-blue-500' : 'opacity-60 hover:opacity-100'}`}>PDF View</button>
            </div>
            
            <div className="flex items-center gap-1">
              <button onClick={() => setPreviewZoom(z => Math.max(60, z - 10))} className={iconBtn}><ZoomOut size={14}/></button>
              <span className="text-xs font-medium w-10 text-center opacity-70">{previewZoom}%</span>
              <button onClick={() => setPreviewZoom(z => Math.min(180, z + 10))} className={iconBtn}><ZoomIn size={14}/></button>
              <div className="w-px h-4 bg-gray-500/30 mx-1"></div>
              <button onClick={handleDownloadPdf} disabled={!compiledPdfUrl} className={`${iconBtn} disabled:opacity-40`}><Download size={14}/></button>
              <button onClick={handleDownloadTex} className={iconBtn}><Download size={14}/></button>
              <button onClick={handleExportBundle} disabled={isExportingBundle} className={`${iconBtn} disabled:opacity-40`}><Folder size={14}/></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-black/5 dark:bg-black/20">
            {activeTab === "preview" && (
              <div className="w-full flex justify-center pb-20">
                {compiledPdfUrl ? (
                  <div className={`w-full max-w-[980px] shadow-2xl border min-h-[800px] rounded-lg overflow-hidden transition-all ${isDark ? 'bg-[#0d1117] border-white/10' : 'bg-white border-gray-200'}`} style={{ zoom: `${previewZoom}%` }}>
                    <iframe title="Compiled PDF" src={compiledPdfUrl} className="w-full h-[80vh] bg-white" />
                  </div>
                ) : (
                  <div 
                    className={`w-full max-w-[800px] p-10 md:p-14 shadow-2xl border min-h-[800px] rounded-lg transition-all ${isDark ? 'bg-[#0d1117] border-white/10' : 'bg-white border-gray-200'}`}
                    style={{ zoom: `${previewZoom}%` }}
                    dangerouslySetInnerHTML={{ __html: renderLatexPreview(code, images) }}
                  />
                )}
              </div>
            )}
            
          </div>
          
          {/* Glass Console */}
          <div className={`absolute bottom-0 left-0 w-full h-32 border-t flex flex-col shrink-0 z-10 backdrop-blur-xl ${borderCol} ${isDark ? 'bg-[#0d1117]/80' : 'bg-white/90'}`}>
            <div className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest flex items-center justify-between border-b opacity-70 ${borderCol}`}>
              <span className="flex items-center gap-2"><TerminalSquare size={12} /> Output Console</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed opacity-80">
              {filteredConsoleLogs.map((log, i) => (<div key={i} className={`${log.includes('[Error]') ? 'text-red-400' : log.includes('Success') ? 'text-green-500' : ''}`}>{log}</div>))}
              <div ref={consoleEndRef} />
            </div>
          </div>
        </div>

      </div>
      
      {/* Modals remain structurally similar but apply the new bgPanel classes if opened */}
      {showFormulaHelper && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl shadow-2xl w-full max-w-3xl border overflow-hidden flex flex-col max-h-[90vh] ${borderCol} ${bgPanel}`}>
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-3"><span className="h-10 w-10 rounded-2xl bg-blue-500/15 text-blue-400 flex items-center justify-center border border-white/10"><Code size={18} /></span> Formula Lab</h2>
              <button onClick={() => setShowFormulaHelper(false)} className={iconBtn}><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {FORMULA_LIBRARY.map((item) => (
                  <button key={item.title} onClick={() => handleInsertFormula(item.snippet)} className={`text-left rounded-2xl border p-4 transition-all ${isDark ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                    <div className="font-semibold mb-2">{item.title}</div>
                    <pre className="text-[11px] opacity-70 whitespace-pre-wrap font-mono">{item.snippet}</pre>
                  </button>
                ))}
              </div>
              <div className={`rounded-2xl border p-4 ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}>
                <label className="block text-sm font-medium mb-2">Custom formula</label>
                <textarea value={formulaDraft} onChange={(e) => setFormulaDraft(e.target.value)} className={`${settingsInput} h-28 font-mono`} placeholder="\\frac{a}{b} + \\sum_{i=1}^{n} x_i" />
                <div className="flex flex-wrap gap-2 mt-3">
                  {["\\alpha", "\\beta", "\\gamma", "\\sum", "\\frac{}{}", "\\sqrt{}", "\\int", "\\leq", "\\geq", "\\times"].map((token) => (
                    <button key={token} onClick={() => setFormulaDraft((prev) => `${prev}${prev ? ' ' : ''}${token}`)} className={pillBtn}>{token}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className={`px-6 py-4 border-t ${borderCol} ${isDark ? 'bg-[#1c2128]' : 'bg-gray-50'} flex justify-end gap-3`}>
              <button onClick={() => setShowFormulaHelper(false)} className={pillBtn}>Cancel</button>
              <button onClick={handleInsertCustomFormula} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-semibold transition-colors">Insert Formula</button>
            </div>
          </div>
        </div>
      )}

      {showTableBuilder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl shadow-2xl w-full max-w-3xl border overflow-hidden flex flex-col max-h-[90vh] ${borderCol} ${bgPanel}`}>
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-3"><span className="h-10 w-10 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-white/10"><FileText size={18} /></span> Table Builder</h2>
              <button onClick={() => setShowTableBuilder(false)} className={iconBtn}><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Rows</label>
                <input type="number" min="2" max="12" className={settingsInput} value={tableBuilder.rows} onChange={(e) => setTableBuilder((prev) => ({ ...prev, rows: Number(e.target.value) || 2 }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Columns</label>
                <input type="number" min="2" max="8" className={settingsInput} value={tableBuilder.cols} onChange={(e) => setTableBuilder((prev) => ({ ...prev, cols: Number(e.target.value) || 2 }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Alignment</label>
                <select className={settingsInput} value={tableBuilder.alignment} onChange={(e) => setTableBuilder((prev) => ({ ...prev, alignment: e.target.value }))}>
                  <option value="l">Left</option>
                  <option value="c">Center</option>
                  <option value="r">Right</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Environment</label>
                <select className={settingsInput} value={tableBuilder.environment} onChange={(e) => setTableBuilder((prev) => ({ ...prev, environment: e.target.value }))}>
                  <option value="table">table</option>
                  <option value="table*">table*</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Caption</label>
                <input type="text" className={settingsInput} value={tableBuilder.caption} onChange={(e) => setTableBuilder((prev) => ({ ...prev, caption: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Label</label>
                <input type="text" className={settingsInput} value={tableBuilder.label} onChange={(e) => setTableBuilder((prev) => ({ ...prev, label: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Preview</label>
                <pre className={`rounded-2xl border p-4 text-[11px] whitespace-pre-wrap font-mono ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>{buildTableSnippet(tableBuilder)}</pre>
              </div>
            </div>
            <div className={`px-6 py-4 border-t ${borderCol} ${isDark ? 'bg-[#1c2128]' : 'bg-gray-50'} flex justify-end gap-3`}>
              <button onClick={() => setShowTableBuilder(false)} className={pillBtn}>Cancel</button>
              <button onClick={handleInsertGeneratedTable} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm font-semibold transition-colors">Insert Table</button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl shadow-2xl w-full max-w-4xl border overflow-hidden flex flex-col max-h-[90vh] ${borderCol} ${bgPanel}`}>
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-3"><span className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-blue-400 flex items-center justify-center border border-white/10"><Settings size={18}/></span> IDE Settings</h2>
              <button onClick={() => setShowSettings(false)} className={iconBtn}><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-8 opacity-90">
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-4 border-b border-gray-200 dark:border-gray-800 pb-2 flex items-center gap-2"><span className="h-8 w-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center"><Edit3 size={14}/></span> Editor Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-90">Font Family</label>
                    <input type="text" className={`${settingsInput} font-mono`} value={settings.fontFamily} onChange={e => setSettings(s => ({ ...s, fontFamily: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-90">Font Size (px)</label>
                    <input type="number" min="10" max="32" className={settingsInput} value={settings.fontSize} onChange={e => setSettings(s => ({ ...s, fontSize: Number(e.target.value) || 14 }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-90">Line Height</label>
                    <input type="number" min="1" max="3" step="0.1" className={settingsInput} value={settings.lineHeight} onChange={e => setSettings(s => ({ ...s, lineHeight: Number(e.target.value) || 1.5 }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-90">Tab Size</label>
                    <select className={settingsInput} value={settings.tabSize} onChange={e => setSettings(s => ({ ...s, tabSize: Number(e.target.value) }))}>
                      <option value="2">2 spaces</option>
                      <option value="4">4 spaces</option>
                      <option value="8">8 spaces</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-90">Word Wrap</label>
                    <select className={settingsInput} value={settings.wordWrap} onChange={e => setSettings(s => ({ ...s, wordWrap: e.target.value }))}>
                      <option value="on">On</option>
                      <option value="off">Off</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:pt-7">
                    <label className={settingsToggle}><input type="checkbox" checked={settings.lineNumbers} onChange={e => setSettings(s => ({ ...s, lineNumbers: e.target.checked }))} /> Line Numbers</label>
                    <label className={settingsToggle}><input type="checkbox" checked={settings.spellCheck} onChange={e => setSettings(s => ({ ...s, spellCheck: e.target.checked }))} /> Spell Check</label>
                    <label className={settingsToggle}><input type="checkbox" checked={settings.autoSave} onChange={e => setSettings(s => ({ ...s, autoSave: e.target.checked }))} /> Auto Save</label>
                    <label className={settingsToggle}><input type="checkbox" checked={settings.autoCompile} onChange={e => setSettings(s => ({ ...s, autoCompile: e.target.checked }))} /> Auto Compile</label>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-green-500 mb-4 border-b border-gray-200 dark:border-gray-800 pb-2 flex items-center gap-2"><span className="h-8 w-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center"><TerminalSquare size={14}/></span> Environment</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-90">Compiler</label>
                    <select className={settingsInput} value={settings.compiler} onChange={e => setSettings(s => ({ ...s, compiler: e.target.value }))}>
                      <option value="pdflatex">pdfLaTeX</option>
                      <option value="xelatex">XeLaTeX</option>
                      <option value="lualatex">LuaLaTeX</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-90">Document Template</label>
                    <select className={settingsInput} value={settings.template} onChange={handleTemplateChange}>
                      <option value="article">Standard Article</option>
                      <option value="ieee">IEEE Transaction</option>
                    </select>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-4 border-b border-gray-200 dark:border-gray-800 pb-2 flex items-center gap-2"><span className="h-8 w-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center"><KeyRound size={14}/></span> LLM API Settings</h3>
                <div className={`rounded-2xl border p-4 space-y-4 ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50/80'}`}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 opacity-90">Default Provider</label>
                      <select className={settingsInput} value={settings.llm.provider} onChange={e => handleGlobalProviderChange(e.target.value)}>
                        {LLM_PROVIDER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 opacity-90">Default Model</label>
                      <input type="text" className={settingsInput} value={settings.llm.model} onChange={e => updateGlobalLlmConfig({ model: e.target.value })} placeholder="gemini-2.5-flash / gpt-4o-mini / deepseek-chat" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 opacity-90">API Key</label>
                      <input type="password" className={settingsInput} value={settings.llm.apiKey} onChange={e => updateGlobalLlmConfig({ apiKey: e.target.value })} placeholder="Paste your API key" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 opacity-90">Base URL</label>
                      <input type="text" className={settingsInput} value={settings.llm.baseUrl || getDefaultBaseUrl(settings.llm.provider)} onChange={e => updateGlobalLlmConfig({ baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" />
                    </div>
                  </div>
                  <p className="text-xs opacity-60">默认配置会作为基础配置；下面可以对每个 AI 角色单独覆盖 provider、model、api key 和 base URL。</p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
                  {Object.entries(ROLE_UI_META).map(([role, meta]) => {
                    const roleConfig = settings.roleLlm?.[role] || DEFAULT_LLM_CONFIG;
                    return (
                      <div key={role} className={`rounded-2xl border p-4 space-y-3 bg-gradient-to-br ${meta.chip} ${isDark ? 'bg-[#161b22]/70' : 'bg-white/90'}`}>
                        <div className="flex items-center gap-2">
                          <span className={`h-8 w-8 rounded-xl flex items-center justify-center ${meta.tint} bg-white/10 border border-white/10`}><Sparkles size={14} /></span>
                          <div>
                            <div className={`text-sm font-semibold ${meta.tint}`}>{meta.label}</div>
                            <div className="text-[11px] opacity-60">Role-specific AI endpoint</div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 opacity-80">Provider</label>
                          <select className={settingsInput} value={roleConfig.provider} onChange={e => handleRoleProviderChange(role, e.target.value)}>
                            {LLM_PROVIDER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 opacity-80">Model</label>
                          <input type="text" className={settingsInput} value={roleConfig.model} onChange={e => updateRoleLlmConfig(role, { model: e.target.value })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 opacity-80">API Key</label>
                          <input type="password" className={settingsInput} value={roleConfig.apiKey} onChange={e => updateRoleLlmConfig(role, { apiKey: e.target.value })} placeholder="Leave same as default if desired" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 opacity-80">Base URL</label>
                          <input type="text" className={settingsInput} value={roleConfig.baseUrl || getDefaultBaseUrl(roleConfig.provider)} onChange={e => updateRoleLlmConfig(role, { baseUrl: e.target.value })} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-500 mb-4 border-b border-gray-200 dark:border-gray-800 pb-2 flex items-center gap-2"><span className="h-8 w-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center"><Sparkles size={14}/></span> AI Role Prompts</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-blue-500 mb-1">Researcher</label>
                    <textarea value={settings.prompts.researcher} onChange={e => setSettings(s => ({ ...s, prompts: { ...s.prompts, researcher: e.target.value } }))} className={`${settingsInput} h-24 text-xs font-mono`} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-purple-500 mb-1">Professor</label>
                    <textarea value={settings.prompts.professor} onChange={e => setSettings(s => ({ ...s, prompts: { ...s.prompts, professor: e.target.value } }))} className={`${settingsInput} h-24 text-xs font-mono`} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-rose-500 mb-1">Reviewer</label>
                    <textarea value={settings.prompts.reviewer} onChange={e => setSettings(s => ({ ...s, prompts: { ...s.prompts, reviewer: e.target.value } }))} className={`${settingsInput} h-24 text-xs font-mono`} />
                  </div>
                </div>
              </section>
            </div>
            <div className={`px-6 py-4 border-t ${borderCol} ${isDark ? 'bg-[#1c2128]' : 'bg-gray-50'} flex justify-end`}>
              <button onClick={() => setShowSettings(false)} className="px-6 py-2 bg-[#2ea44f] hover:bg-[#2c974b] text-white rounded text-sm font-semibold transition-colors">
                Apply & Close
              </button>
            </div>
          </div>
        </div>
      )}

      <input ref={attachmentInputRef} type="file" className="hidden" multiple onChange={(e) => handlePickFiles(e, false)} />
      <input ref={imageInputRef} type="file" className="hidden" accept="image/*" multiple onChange={(e) => handlePickFiles(e, true)} />
    </div>
  );
}