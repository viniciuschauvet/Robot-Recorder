/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Square, 
  Copy, 
  Check, 
  Chrome, 
  FileCode, 
  ExternalLink, 
  Terminal,
  MousePointer2,
  Type,
  Navigation
} from 'lucide-react';

interface FileContent {
  name: string;
  content: string;
  language: string;
}

export default function App() {
  const [activeFile, setActiveFile] = useState<string>('manifest.json');
  const [copied, setCopied] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedSteps, setRecordedSteps] = useState<string[]>([]);

  const files: FileContent[] = [
    {
      name: 'manifest.json',
      language: 'json',
      content: `{
  "manifest_version": 3,
  "name": "Cypress Recorder",
  "version": "1.0",
  "description": "Record user interactions and generate Cypress test scripts.",
  "permissions": ["storage", "activeTab", "scripting"],
  "action": {
    "default_popup": "popup.html"
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"]
    }
  ]
}`
    },
    {
      name: 'popup.html',
      language: 'html',
      content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Cypress Recorder</title>
  <style>
    body { width: 300px; padding: 16px; font-family: sans-serif; }
    .status { padding: 4px 8px; border-radius: 9999px; font-size: 12px; }
    button { width: 100%; padding: 10px; margin-top: 8px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>Cypress Recorder</h1>
  <div id="statusIndicator" class="status">Idle</div>
  <button id="startBtn">Start Recording</button>
  <button id="stopBtn" disabled>Stop Recording</button>
  <button id="copyBtn">Copy Code</button>
  <div id="previewContainer" style="display: none;">
    <pre id="codePreview"></pre>
  </div>
  <script src="popup.js"></script>
</body>
</html>`
    },
    {
      name: 'popup.js',
      language: 'javascript',
      content: `let isRecording = false;

chrome.storage.local.get(['isRecording'], (result) => {
  isRecording = result.isRecording || false;
  updateUI();
});

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const copyBtn = document.getElementById('copyBtn');

function updateUI() {
  // Update button states and status text
}

startBtn.addEventListener('click', () => {
  isRecording = true;
  chrome.storage.local.set({ isRecording: true, commands: [] });
  updateUI();
  // Notify content script...
});

stopBtn.addEventListener('click', () => {
  isRecording = false;
  chrome.storage.local.set({ isRecording: false });
  updateUI();
});

copyBtn.addEventListener('click', () => {
  chrome.storage.local.get(['commands'], (result) => {
    const code = wrapInTemplate(result.commands);
    navigator.clipboard.writeText(code);
  });
});`
    },
    {
      name: 'content.js',
      language: 'javascript',
      content: `let isRecording = false;

chrome.storage.local.get(['isRecording'], (result) => {
  isRecording = result.isRecording;
});

function getSelector(el) {
  if (el.getAttribute('data-cy')) return \`[data-cy="\${el.getAttribute('data-cy')}"]\`;
  if (el.id) return \`#\${el.id}\`;
  return el.tagName.toLowerCase();
}

document.addEventListener('click', (e) => {
  if (!isRecording) return;
  const selector = getSelector(e.target);
  addCommand(\`cy.get('\${selector}').click();\`);
}, true);

document.addEventListener('change', (e) => {
  if (!isRecording) return;
  const selector = getSelector(e.target);
  addCommand(\`cy.get('\${selector}').type('\${e.target.value}');\`);
}, true);`
    }
  ];

  const handleCopy = () => {
    const content = files.find(f => f.name === activeFile)?.content || '';
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const simulateRecording = () => {
    if (!isRecording) {
      setIsRecording(true);
      setRecordedSteps(["cy.visit('https://example.com');"]);
    } else {
      setIsRecording(false);
    }
  };

  const addStep = (type: 'click' | 'type' | 'nav') => {
    if (!isRecording) return;
    let step = "";
    if (type === 'click') step = "cy.get('.btn-primary').click();";
    if (type === 'type') step = "cy.get('#search').type('Cypress Recorder');";
    if (type === 'nav') step = "cy.visit('/dashboard');";
    setRecordedSteps(prev => [...prev, step]);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-300 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-semibold text-white tracking-tight">Cypress Recorder <span className="text-zinc-500 font-normal">v1.0</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <a 
              href="https://chrome.google.com/webstore/devconsole" 
              target="_blank" 
              className="text-sm hover:text-white transition-colors flex items-center gap-2"
            >
              <Chrome className="w-4 h-4" />
              Developer Dashboard
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-12 gap-12">
          
          {/* Left Column: Info & Preview */}
          <div className="lg:col-span-5 space-y-12">
            <section>
              <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">Generate E2E tests as you browse.</h2>
              <p className="text-zinc-400 leading-relaxed text-lg">
                A powerful Chrome Extension that captures your interactions and converts them into clean, 
                runnable Cypress scripts. Built with Manifest V3 and robust selector strategies.
              </p>
            </section>

            {/* Interactive Demo */}
            <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <MousePointer2 className="w-24 h-24" />
              </div>
              
              <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 mb-6">Live Simulator</h3>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between bg-black/40 p-4 rounded-xl border border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-zinc-700'}`} />
                    <span className="text-sm font-medium">{isRecording ? 'Recording Session...' : 'Ready to record'}</span>
                  </div>
                  <button 
                    onClick={simulateRecording}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                      isRecording 
                        ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' 
                        : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20'
                    }`}
                  >
                    {isRecording ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isRecording ? 'Stop' : 'Start'}
                  </button>
                </div>

                {isRecording && (
                  <div className="grid grid-cols-3 gap-3">
                    <button 
                      onClick={() => addStep('click')} 
                      className="p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg border border-zinc-700/50 text-xs flex flex-col items-center gap-2 transition-colors"
                    >
                      <MousePointer2 className="w-4 h-4 text-blue-400" /> Click
                    </button>
                    <button 
                      onClick={() => addStep('type')} 
                      className="p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg border border-zinc-700/50 text-xs flex flex-col items-center gap-2 transition-colors"
                    >
                      <Type className="w-4 h-4 text-emerald-400" /> Type
                    </button>
                    <button 
                      onClick={() => addStep('nav')} 
                      className="p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg border border-zinc-700/50 text-xs flex flex-col items-center gap-2 transition-colors"
                    >
                      <Navigation className="w-4 h-4 text-purple-400" /> Visit
                    </button>
                  </div>
                )}

                <div className="bg-black rounded-xl p-4 font-mono text-xs min-h-[160px] border border-zinc-800">
                  <div className="text-zinc-600 mb-2">// Generated Cypress Code</div>
                  <AnimatePresence mode="popLayout">
                    {recordedSteps.map((step, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-blue-400 mb-1"
                      >
                        {step}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {!isRecording && recordedSteps.length === 0 && (
                    <div className="text-zinc-700 italic">Click Start to begin recording...</div>
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-white font-semibold">How to install:</h3>
              <ol className="space-y-3">
                {[
                  "Download the extension files from the code editor.",
                  "Open Chrome and navigate to chrome://extensions",
                  "Enable 'Developer mode' in the top right corner.",
                  "Click 'Load unpacked' and select the extension folder."
                ].map((step, i) => (
                  <li key={i} className="flex gap-4 text-sm text-zinc-400">
                    <span className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-500 shrink-0">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {/* Right Column: Code Editor */}
          <div className="lg:col-span-7">
            <div className="bg-[#0d0d0d] border border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-[700px] shadow-2xl">
              {/* Editor Tabs */}
              <div className="flex bg-black/40 border-b border-zinc-800 px-4 overflow-x-auto scrollbar-hide">
                {files.map(file => (
                  <button
                    key={file.name}
                    onClick={() => setActiveFile(file.name)}
                    className={`px-4 py-3 text-sm font-medium transition-all border-b-2 whitespace-nowrap ${
                      activeFile === file.name 
                        ? 'text-white border-blue-500 bg-blue-500/5' 
                        : 'text-zinc-500 border-transparent hover:text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4" />
                      {file.name}
                    </div>
                  </button>
                ))}
              </div>

              {/* Editor Content */}
              <div className="flex-1 relative overflow-hidden">
                <div className="absolute top-4 right-4 z-10">
                  <button 
                    onClick={handleCopy}
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-all flex items-center gap-2 text-xs font-medium"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied' : 'Copy Code'}
                  </button>
                </div>
                
                <pre className="p-6 font-mono text-sm leading-relaxed overflow-auto h-full text-zinc-400">
                  <code>
                    {files.find(f => f.name === activeFile)?.content}
                  </code>
                </pre>
              </div>

              {/* Editor Footer */}
              <div className="bg-black/40 border-t border-zinc-800 px-6 py-3 flex items-center justify-between text-[10px] uppercase tracking-widest font-bold text-zinc-600">
                <div className="flex gap-4">
                  <span>UTF-8</span>
                  <span>TypeScript / JS</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  Ready to deploy
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-zinc-800/50 mt-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-zinc-500 text-sm">© 2026 Cypress Recorder. Open source tool for developers.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-zinc-500 hover:text-white transition-colors text-sm">Documentation</a>
            <a href="#" className="text-zinc-500 hover:text-white transition-colors text-sm">GitHub</a>
            <a href="#" className="text-zinc-500 hover:text-white transition-colors text-sm flex items-center gap-1">
              Cypress Docs <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
