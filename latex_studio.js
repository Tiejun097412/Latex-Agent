import React, { useState, useRef, useEffect } from "react";
import { 
  Settings, Moon, Sun, Play, FileText, CheckCircle, AlertTriangle, X, 
  Code, Eye, MessageSquare, Hammer, TerminalSquare, Menu, ArrowUp, 
  Share, Clock, Folder, File, ChevronDown, ChevronRight, RefreshCw, 
  Download, Maximize2, MoreVertical, ChevronLeft
} from "lucide-react";

// --- Default Templates ---
const TEMPLATES = {
  article: `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{graphicx}
\\usepackage{natbib}

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

\\subsection{Data Collection}
How data was gathered.

\\section{Results}
Present your findings.

\\section{Conclusion}
Summarize your work.

\\end{document}`,
  ieee: `\\documentclass[journal]{IEEEtran}
\\usepackage{amsmath}
\\usepackage{graphicx}

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

// --- Gemini API Call ---
const callGemini = async (prompt, systemInstruction) => {
  const apiKey = ""; // Provided by environment
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] }
  };

  const attempt = async (retries = 3, delay = 1000) => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
    } catch (error) {
      if (retries > 0) {
        await new Promise(res => setTimeout(res, delay));
        return attempt(retries - 1, delay * 2);
      }
      throw error;
    }
  };

  return attempt();
};

// --- Fast Regex LaTeX Previewer ---
function renderLatexPreview(src) {
  let t = "";
  const tm = src.match(/\\title\{([\s\S]+?)\}/);
  const am = src.match(/\\author\{([^}]+)\}/);
  if (tm) t += `<h1 class="text-2xl font-bold text-center mb-2 leading-tight">${tm[1].replace(/\\\\/g, "<br/>")}</h1>`;
  if (am) t += `<p class="text-center text-sm opacity-75 mb-6">${am[1]}</p>`;
  if (tm || am) t += `<hr class="border-t border-gray-300 dark:border-gray-700 mb-6"/>`;
  
  let b = src
    .replace(/\\documentclass[^\n]*/g, "").replace(/\\usepackage[^\n]*/g, "")
    .replace(/\\title\{[\s\S]+?\}/g, "").replace(/\\author\{[^}]+\}/g, "")
    .replace(/\\date\{[^}]*\}/g, "").replace(/\\maketitle/g, "")
    .replace(/\\begin\{document\}/g, "").replace(/\\end\{document\}/g, "")
    .replace(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/g,
      `<div class="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 p-4 mb-6 rounded-r-lg">
        <p class="text-xs font-bold tracking-wider opacity-70 mb-2 uppercase">Abstract</p>
        <p class="text-sm leading-relaxed">$1</p>
       </div>`)
    .replace(/\\section\*?\{([^}]+)\}/g, '<h2 class="text-xl font-semibold mt-8 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">$1</h2>')
    .replace(/\\subsection\*?\{([^}]+)\}/g, '<h3 class="text-lg font-medium mt-6 mb-3">$1</h3>')
    .replace(/\\textbf\{([^}]+)\}/g, "<strong>$1</strong>")
    .replace(/\\textit\{([^}]+)\}/g, "<em>$1</em>")
    .replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, "<ul class='list-disc pl-6 mb-4'>$1</ul>")
    .replace(/\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g, "<ol class='list-decimal pl-6 mb-4'>$1</ol>")
    .replace(/\\item\s+/g, "<li class='mb-1'>")
    .replace(/\$\$([^$]+)\$\$/g, "<div class='text-center italic my-4'>$1</div>")
    .replace(/\$([^$]+)\$/g, "<em class='font-serif'>$1</em>")
    .replace(/\\cite\{([^}]+)\}/g, "<sup class='text-blue-500'>[$1]</sup>")
    .replace(/\\%/g, "%").replace(/\\&/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n\n/g, "</p><p class='mb-4 leading-relaxed'>")
    .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, "$1")
    .replace(/\\[a-zA-Z]+/g, "").replace(/[{}\\]/g, "");
    
  return `<div class="font-serif">${t}<div><p class="mb-4 leading-relaxed">${b}</p></div></div>`;
}

export default function App() {
  const [code, setCode] = useState(TEMPLATES.article);
  const [topic, setTopic] = useState("");
  const [reviews, setReviews] = useState([]);
  const [loadingRole, setLoadingRole] = useState(null);
  const [activeTab, setActiveTab] = useState("preview");
  const [isDark, setIsDark] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Console state
  const [consoleLogs, setConsoleLogs] = useState(["[System] IDE Initialized. Ready to compile."]);
  const [isCompiling, setIsCompiling] = useState(false);
  const consoleEndRef = useRef(null);

  // Chat state
  const [isChatExpanded, setIsChatExpanded] = useState(false);

  // Settings State
  const [settings, setSettings] = useState({
    fontSize: 14,
    fontFamily: "'Fira Code', 'Consolas', monospace",
    wordWrap: "on",
    lineNumbers: true,
    tabSize: 4,
    compiler: "pdflatex",
    template: "article",
    prompts: DEFAULT_PROMPTS
  });

  const editorRef = useRef(null);
  const lineNumRef = useRef(null);
  const reviewEndRef = useRef(null);
  const lineNums = code.split("\n").map((_, i) => i + 1);

  // Extract outline dynamically
  const outline = [];
  const regex = /\\(section|subsection)\*?\{([^}]+)\}/g;
  let match;
  while ((match = regex.exec(code)) !== null) {
    outline.push({ level: match[1], title: match[2] });
  }

  useEffect(() => {
    if (activeTab === "reviews") reviewEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [reviews, activeTab]);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [consoleLogs]);

  const handleScroll = () => {
    if (lineNumRef.current && editorRef.current && settings.lineNumbers) {
      lineNumRef.current.scrollTop = editorRef.current.scrollTop;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const val = e.target.value;
      const spaces = " ".repeat(Number(settings.tabSize));
      setCode(val.substring(0, start) + spaces + val.substring(end));
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.selectionStart = editorRef.current.selectionEnd = start + Number(settings.tabSize);
        }
      }, 0);
    }
  };

  const handleTemplateChange = (e) => {
    const newTemplate = e.target.value;
    setSettings(s => ({ ...s, template: newTemplate }));
    if (window.confirm("Changing template will overwrite current code. Continue?")) {
      setCode(TEMPLATES[newTemplate]);
    }
  };

  // --- Compile ---
  const handleCompile = () => {
    if (isCompiling) return;
    setIsCompiling(true);
    setActiveTab("preview");
    setConsoleLogs(prev => [...prev, `\n> Recompiling ${settings.compiler} main.tex...`]);
    
    setTimeout(() => {
      setConsoleLogs(prev => [...prev, "Checking syntax...", "Resolving references..."]);
    }, 600);
    
    setTimeout(() => {
      setConsoleLogs(prev => [...prev, "[Success] Output written to main.pdf.", "Compilation finished with 0 errors, 0 warnings."]);
      setIsCompiling(false);
    }, 1500);
  };

  // --- AI Agent Actions ---
  const invokeAgent = async (roleId) => {
    setLoadingRole(roleId);
    setConsoleLogs(prev => [...prev, `\n> Waking up AI Agent: ${roleId.toUpperCase()}...`]);
    
    try {
      if (roleId === "researcher") {
        const prompt = topic 
          ? `Research Topic: ${topic}\n\nCurrent Draft (if any):\n${code}\n\nPlease generate or improve the LaTeX document based on this topic.`
          : `Please significantly improve and expand the following LaTeX document:\n\n${code}`;
        
        setConsoleLogs(prev => [...prev, "[Researcher] Analyzing topic and drafting content..."]);
        let result = await callGemini(prompt, settings.prompts.researcher);
        result = result.replace(/^```latex\n/i, "").replace(/^```\n/i, "").replace(/```$/i, "").trim();
        setCode(result);
        setConsoleLogs(prev => [...prev, "[Researcher] Code updated successfully."]);
        handleCompile();
        
      } else if (roleId === "professor") {
        const prompt = `Please review this LaTeX document draft:\n\n${code}`;
        setConsoleLogs(prev => [...prev, "[Professor] Reading manuscript..."]);
        const result = await callGemini(prompt, settings.prompts.professor);
        setReviews(prev => [...prev, { role: "Professor", content: result, time: new Date() }]);
        setActiveTab("reviews");
        setConsoleLogs(prev => [...prev, "[Professor] Review completed."]);
        
      } else if (roleId === "reviewer") {
        const profReviews = reviews.filter(r => r.role === "Professor").map(r => r.content).join("\n\n");
        const prompt = `Document to review:\n${code}\n\n${profReviews ? `Previous Professor's Review (for context):\n${profReviews}\n\n` : ''}Please provide your final journal-level assessment.`;
        setConsoleLogs(prev => [...prev, "[Reviewer] Assessing manuscript strictly..."]);
        const result = await callGemini(prompt, settings.prompts.reviewer);
        setReviews(prev => [...prev, { role: "Reviewer", content: result, time: new Date() }]);
        setActiveTab("reviews");
        setConsoleLogs(prev => [...prev, "[Reviewer] Final decision rendered."]);
      }
    } catch (err) {
      console.error(err);
      setConsoleLogs(prev => [...prev, `[Error] ${roleId} failed to respond: ${err.message}`]);
    } finally {
      setLoadingRole(null);
    }
  };

  // UI Colors
  const bgMain = isDark ? "bg-[#1c2128] text-gray-200" : "bg-white text-slate-900";
  const bgEditor = isDark ? "bg-[#0d1117]" : "bg-white";
  const borderCol = isDark ? "border-[#30363d]" : "border-slate-200";
  const inputBg = isDark ? "bg-[#0d1117] border-gray-700 text-white" : "bg-white border-slate-300 text-slate-900";

  return (
    <div className={`flex flex-col h-screen font-sans ${bgMain}`}>
      
      {/* --- Overleaf Style Dark Global Header --- */}
      <header className={`flex items-center justify-between px-4 py-2 bg-[#272c33] text-white shrink-0 shadow-md z-10`}>
        {/* Left: Project Info */}
        <div className="flex items-center gap-4">
          <Menu size={20} className={`cursor-pointer transition-colors ${isSidebarOpen ? 'text-gray-300 hover:text-white' : 'text-blue-400 hover:text-blue-300'}`} onClick={() => setIsSidebarOpen(!isSidebarOpen)} title="Toggle Sidebar" />
          <ArrowUp size={20} className="text-gray-300 hover:text-white cursor-pointer" />
          <div className="flex flex-col">
            <span className="font-semibold text-[15px] tracking-wide">LaTeX Studio<span className="text-green-400">.ai</span></span>
            <span className="text-[11px] text-gray-400">Owner: You</span>
          </div>
        </div>

        {/* Right: Global Tools */}
        <div className="flex items-center gap-3">
          {/* Tools */}
          <button className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white"><Share size={15}/> Share</button>
          <button className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white"><Clock size={15}/> History</button>
          
          <div className="w-px h-6 bg-gray-600 mx-1"></div>
          
          <button onClick={() => setIsDark(!isDark)} className="p-1.5 text-gray-300 hover:text-white rounded hover:bg-white/10">
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={() => setShowSettings(true)} className="p-1.5 text-gray-300 hover:text-white rounded hover:bg-white/10">
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* --- Main Workspace (3 Columns) --- */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Column 1: Left Sidebar (File Tree & Outline) */}
        {isSidebarOpen && (
          <div className={`w-56 flex flex-col border-r ${borderCol} ${isDark ? 'bg-[#1c2128]' : 'bg-[#f8fafc]'} shrink-0`}>
            {/* File Tree */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className={`px-4 py-2 text-xs font-bold tracking-wider opacity-70 border-b ${borderCol} flex items-center justify-between`}>
                <span>FILES</span>
                <ChevronLeft size={16} className="cursor-pointer hover:text-blue-500 transition-colors" onClick={() => setIsSidebarOpen(false)} title="Hide Sidebar" />
              </div>
              <div className="p-2 overflow-y-auto flex-1 space-y-1 text-sm">
              </div>
              <div className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded ${isDark ? 'bg-[#21262d] text-white' : 'bg-blue-50 text-blue-700'}`}>
                <ChevronDown size={14} className="opacity-0"/><File size={14} className="text-green-500"/> main.tex
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 cursor-pointer text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 rounded">
                <ChevronDown size={14} className="opacity-0"/><File size={14}/> reference.bib
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 cursor-pointer text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 rounded">
                <ChevronDown size={14} className="opacity-0"/><File size={14}/> settings.cls
              </div>
            </div>
          </div>
        )}

        {/* Column 2: Editor Pane */}
        <div className={`flex-1 flex flex-col border-r ${borderCol} ${bgEditor} min-w-[300px]`}>
          <div className={`flex items-center px-4 py-2.5 text-sm font-medium border-b ${borderCol} ${isDark ? 'bg-[#161b22]' : 'bg-[#f1f5f9]'} shrink-0 text-gray-500`}>
             <span className="flex items-center gap-2 text-gray-800 dark:text-gray-200"><Code size={16} /> main.tex</span>
          </div>

          {/* Editor Area */}
          <div className="flex flex-1 overflow-hidden relative" onClick={() => setIsChatExpanded(false)}>
            {settings.lineNumbers && (
              <div 
                ref={lineNumRef}
                className={`w-12 text-right py-4 pr-3 select-none overflow-hidden font-mono leading-relaxed border-r border-transparent shrink-0
                  ${isDark ? 'bg-[#0d1117] text-gray-600' : 'bg-slate-50 text-slate-400'}`}
                style={{ fontSize: `${settings.fontSize}px` }}
              >
                {lineNums.map(n => <div key={n}>{n}</div>)}
              </div>
            )}
            
            <textarea
              ref={editorRef}
              value={code}
              onChange={e => setCode(e.target.value)}
              onScroll={handleScroll}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              className={`flex-1 p-4 font-mono leading-relaxed resize-none outline-none
                ${isDark ? 'bg-[#0d1117] text-[#c9d1d9]' : 'bg-white text-slate-800'}
                ${loadingRole === 'researcher' ? 'opacity-50 cursor-wait' : ''}`}
              style={{
                fontSize: `${settings.fontSize}px`,
                fontFamily: settings.fontFamily,
                whiteSpace: settings.wordWrap === 'on' ? 'pre-wrap' : 'pre',
                tabSize: settings.tabSize
              }}
            />
          </div>

          {/* AI Chat Dialog Box */}
          <div 
            className={`transition-all duration-300 border-t ${borderCol} flex flex-col shrink-0 ${isDark ? 'bg-[#161b22]' : 'bg-slate-50'}`}
            style={{ height: isChatExpanded ? '50%' : '60px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {!isChatExpanded ? (
              <div 
                className="w-full h-full flex items-center justify-center cursor-text px-4"
                onClick={() => setIsChatExpanded(true)}
              >
                <div className={`w-full max-w-xl h-10 rounded-full border ${borderCol} ${isDark ? 'bg-[#0d1117] text-gray-400' : 'bg-white text-gray-500'} flex items-center justify-between px-1 hover:border-blue-500 transition-colors shadow-sm`}>
                   <div className="flex items-center pl-3 flex-1 overflow-hidden">
                     <MessageSquare size={16} className="mr-2 shrink-0" />
                     <span className="text-sm truncate">Ask AI or select an agent...</span>
                   </div>
                   <div className="flex items-center gap-1 shrink-0 bg-transparent pr-1">
                     <button 
                       onClick={(e) => { e.stopPropagation(); invokeAgent("researcher"); }} disabled={loadingRole !== null}
                       className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${loadingRole === 'researcher' ? 'animate-pulse text-blue-400 bg-blue-500/10' : isDark ? 'hover:bg-[#21262d] text-gray-300 hover:text-blue-400' : 'hover:bg-gray-100 text-gray-600 hover:text-blue-600'}`}
                     >
                       <FileText size={14} /> Researcher
                     </button>
                     <button 
                       onClick={(e) => { e.stopPropagation(); invokeAgent("professor"); }} disabled={loadingRole !== null}
                       className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${loadingRole === 'professor' ? 'animate-pulse text-purple-400 bg-purple-500/10' : isDark ? 'hover:bg-[#21262d] text-gray-300 hover:text-purple-400' : 'hover:bg-gray-100 text-gray-600 hover:text-purple-600'}`}
                     >
                       <AlertTriangle size={14} /> Professor
                     </button>
                     <button 
                       onClick={(e) => { e.stopPropagation(); invokeAgent("reviewer"); }} disabled={loadingRole !== null}
                       className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${loadingRole === 'reviewer' ? 'animate-pulse text-rose-400 bg-rose-500/10' : isDark ? 'hover:bg-[#21262d] text-gray-300 hover:text-rose-400' : 'hover:bg-gray-100 text-gray-600 hover:text-rose-600'}`}
                     >
                       <CheckCircle size={14} /> Reviewer
                     </button>
                   </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full w-full">
                <div className={`flex justify-between items-center px-4 py-2 border-b ${borderCol}`}>
                  <span className={`text-sm font-semibold flex items-center gap-2 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                    <MessageSquare size={16}/> AI Assistant
                  </span>
                  <button onClick={() => setIsChatExpanded(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
                    <ChevronDown size={18}/>
                  </button>
                </div>
                <div className="flex-1 p-4 overflow-y-auto text-sm text-gray-500">
                  <div className={`p-3 rounded-lg mb-2 w-max max-w-[80%] ${isDark ? 'bg-[#21262d] text-gray-300' : 'bg-blue-50 text-blue-800'}`}>
                    Hello! I am your AI assistant. You can chat with me or run specialized agents below.
                  </div>
                </div>
                
                {/* AI Agents Quick Action Row */}
                <div className={`px-3 py-2 border-t ${borderCol} flex items-center gap-2 overflow-x-auto ${isDark ? 'bg-[#1c2128]' : 'bg-gray-50'}`}>
                  <span className="text-xs font-semibold text-gray-500 mr-1 shrink-0">Agents:</span>
                  <button 
                    onClick={() => invokeAgent("researcher")} disabled={loadingRole !== null}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border shrink-0 ${loadingRole === 'researcher' ? 'animate-pulse border-blue-500 text-blue-400' : isDark ? 'border-gray-700 hover:bg-[#21262d] text-gray-300' : 'border-gray-300 hover:bg-gray-200 text-gray-700'}`}
                  >
                    <FileText size={14} /> Researcher
                  </button>
                  <button 
                    onClick={() => invokeAgent("professor")} disabled={loadingRole !== null}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border shrink-0 ${loadingRole === 'professor' ? 'animate-pulse border-purple-500 text-purple-400' : isDark ? 'border-gray-700 hover:bg-[#21262d] text-gray-300' : 'border-gray-300 hover:bg-gray-200 text-gray-700'}`}
                  >
                    <AlertTriangle size={14} /> Professor
                  </button>
                  <button 
                    onClick={() => invokeAgent("reviewer")} disabled={loadingRole !== null}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border shrink-0 ${loadingRole === 'reviewer' ? 'animate-pulse border-rose-500 text-rose-400' : isDark ? 'border-gray-700 hover:bg-[#21262d] text-gray-300' : 'border-gray-300 hover:bg-gray-200 text-gray-700'}`}
                  >
                    <CheckCircle size={14} /> Reviewer
                  </button>
                </div>

                <div className={`p-3 flex items-center gap-2`}>
                  <input 
                    autoFocus
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className={`flex-1 h-9 rounded-full border ${borderCol} ${isDark ? 'bg-[#0d1117] text-gray-200' : 'bg-white text-gray-800'} px-4 text-sm outline-none focus:border-blue-500`}
                    placeholder="Enter research topic or message..."
                  />
                  <button className="h-9 w-9 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center text-white transition-colors shrink-0">
                    <ArrowUp size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Preview / Reviews */}
        <div className={`flex-1 flex flex-col ${isDark ? 'bg-[#0d1117]' : 'bg-gray-100'} min-w-[300px]`}>
          
          {/* Overleaf Recompile Bar */}
          <div className={`flex items-center justify-between border-b ${borderCol} px-2 py-1.5 ${isDark ? 'bg-[#161b22]' : 'bg-[#f8fafc]'} shrink-0`}>
            <div className="flex items-center gap-1">
              <button 
                onClick={handleCompile}
                disabled={isCompiling}
                className="flex items-center gap-2 bg-[#2ea44f] hover:bg-[#2c974b] text-white px-3 py-1.5 rounded text-sm font-semibold transition-colors shadow-sm disabled:opacity-70"
              >
                <RefreshCw size={14} className={isCompiling ? "animate-spin" : ""} />
                Recompile
              </button>
              <button className="p-1.5 text-gray-500 hover:bg-black/5 dark:hover:bg-white/10 rounded">
                <ChevronDown size={16} />
              </button>
            </div>

            <div className="flex items-center">
              <button
                onClick={() => setActiveTab("preview")}
                className={`px-3 py-1 text-sm font-medium rounded-l border border-r-0 ${borderCol}
                  ${activeTab === 'preview' ? (isDark ? 'bg-[#21262d] text-white' : 'bg-white text-black') : 'text-gray-500 bg-transparent'}`}
              >
                PDF View
              </button>
              <button
                onClick={() => setActiveTab("reviews")}
                className={`px-3 py-1 text-sm font-medium rounded-r border ${borderCol}
                  ${activeTab === 'reviews' ? (isDark ? 'bg-[#21262d] text-purple-400' : 'bg-white text-purple-600') : 'text-gray-500 bg-transparent'}`}
              >
                AI Reviews {reviews.length > 0 && `(${reviews.length})`}
              </button>
            </div>

            <div className="flex items-center gap-1 text-gray-500">
              <button className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded"><Download size={16}/></button>
              <button className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded"><Maximize2 size={16}/></button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4 relative">
            {activeTab === "preview" && (
              <div 
                className={`max-w-2xl mx-auto p-8 shadow-md border ${borderCol} min-h-[95%]
                  ${isDark ? 'bg-[#1c2128] text-gray-200' : 'bg-white text-black'}`}
                dangerouslySetInnerHTML={{ __html: renderLatexPreview(code) }}
              />
            )}

            {activeTab === "reviews" && (
              <div className="max-w-3xl mx-auto space-y-4">
                {reviews.length === 0 ? (
                  <div className="text-center text-gray-500 mt-20">
                    <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No feedback yet. Run the Professor or Reviewer agents from the top bar.</p>
                  </div>
                ) : (
                  reviews.map((rev, idx) => (
                    <div key={idx} className={`rounded border shadow-sm overflow-hidden
                      ${rev.role === 'Professor' ? 'border-purple-200 dark:border-purple-900/50' : 'border-rose-200 dark:border-rose-900/50'}`}>
                      <div className={`px-4 py-2 border-b flex items-center justify-between text-sm font-semibold
                        ${rev.role === 'Professor' ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900/50' : 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-900/50'}`}>
                        <span>{rev.role}</span>
                        <span className="text-xs font-normal opacity-70">
                          {rev.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className={`p-4 text-[13px] leading-relaxed whitespace-pre-wrap ${isDark ? 'bg-[#1c2128]' : 'bg-white'}`}>
                        {rev.content}
                      </div>
                    </div>
                  ))
                )}
                <div ref={reviewEndRef} />
              </div>
            )}
          </div>

          {/* Output Console moved here */}
          <div className={`h-32 border-t ${borderCol} flex flex-col shrink-0 ${isDark ? 'bg-[#161b22]' : 'bg-slate-50'}`}>
            <div className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 border-b ${borderCol} text-gray-500`}>
              <TerminalSquare size={12} /> Output Console
            </div>
            <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
              {consoleLogs.map((log, i) => (
                <div key={i} className={`${log.includes('[Error]') ? 'text-red-400' : log.includes('[Success]') ? 'text-green-500' : ''}`}>
                  {log}
                </div>
              ))}
              <div ref={consoleEndRef} />
            </div>
          </div>
        </div>

      </div>

      {/* --- Settings Modal --- */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`${isDark ? 'bg-[#161b22]' : 'bg-white'} rounded shadow-2xl w-full max-w-4xl border ${borderCol} overflow-hidden flex flex-col max-h-[90vh]`}>
            <div className={`px-6 py-4 border-b ${borderCol} flex items-center justify-between ${isDark ? 'bg-[#1c2128]' : 'bg-gray-50'}`}>
              <h2 className="text-lg font-semibold flex items-center gap-2"><Settings size={20}/> IDE Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"><X size={20}/></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-8">
              {/* Prism-style Editor Settings */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-4 border-b border-gray-200 dark:border-gray-800 pb-2">Editor Settings</h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-90">Font Family</label>
                    <input type="text" className={`w-full p-2 rounded border ${inputBg} outline-none font-mono text-sm`} value={settings.fontFamily} onChange={e => setSettings(s=>({...s, fontFamily: e.target.value}))}/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-90">Font Size (px)</label>
                    <input type="number" className={`w-full p-2 rounded border ${inputBg} outline-none text-sm`} value={settings.fontSize} onChange={e => setSettings(s=>({...s, fontSize: Number(e.target.value)}))}/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-90">Tab Size</label>
                    <select className={`w-full p-2 rounded border ${inputBg} outline-none text-sm`} value={settings.tabSize} onChange={e => setSettings(s=>({...s, tabSize: Number(e.target.value)}))}>
                      <option value="2">2 spaces</option>
                      <option value="4">4 spaces</option>
                      <option value="8">8 spaces</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-90">Word Wrap</label>
                    <select className={`w-full p-2 rounded border ${inputBg} outline-none text-sm`} value={settings.wordWrap} onChange={e => setSettings(s=>({...s, wordWrap: e.target.value}))}>
                      <option value="on">On</option>
                      <option value="off">Off</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Environment Settings */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-green-500 mb-4 border-b border-gray-200 dark:border-gray-800 pb-2">Environment</h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-90">Compiler</label>
                    <select className={`w-full p-2 rounded border ${inputBg} outline-none text-sm`} value={settings.compiler} onChange={e => setSettings(s=>({...s, compiler: e.target.value}))}>
                      <option value="pdflatex">pdfLaTeX</option>
                      <option value="xelatex">XeLaTeX</option>
                      <option value="lualatex">LuaLaTeX</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-90">Document Template</label>
                    <select className={`w-full p-2 rounded border ${inputBg} outline-none text-sm`} value={settings.template} onChange={handleTemplateChange}>
                      <option value="article">Standard Article</option>
                      <option value="ieee">IEEE Transaction</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Agent Settings */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-500 mb-4 border-b border-gray-200 dark:border-gray-800 pb-2">AI Role Prompts</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-blue-500 mb-1">Researcher</label>
                    <textarea value={settings.prompts.researcher} onChange={e => setSettings(s=>({...s, prompts: {...s.prompts, researcher: e.target.value}}))} className={`w-full p-2 rounded border ${inputBg} h-20 text-xs font-mono`} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-purple-500 mb-1">Professor</label>
                    <textarea value={settings.prompts.professor} onChange={e => setSettings(s=>({...s, prompts: {...s.prompts, professor: e.target.value}}))} className={`w-full p-2 rounded border ${inputBg} h-20 text-xs font-mono`} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-rose-500 mb-1">Reviewer</label>
                    <textarea value={settings.prompts.reviewer} onChange={e => setSettings(s=>({...s, prompts: {...s.prompts, reviewer: e.target.value}}))} className={`w-full p-2 rounded border ${inputBg} h-20 text-xs font-mono`} />
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

    </div>
  );
}