const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const pauseBtn = document.getElementById('pauseBtn');
const pauseText = document.getElementById('pauseText');
const pauseIcon = document.getElementById('pauseIcon');
const assertBtn = document.getElementById('assertBtn');
const waitBtn = document.getElementById('waitBtn');
const copyBtn = document.getElementById('copyBtn');
const clearBtn = document.getElementById('clearBtn');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const frameworkSelect = document.getElementById('frameworkSelect');
const protocolDisplay = document.getElementById('protocolDisplay');
const statusIndicator = document.getElementById('statusIndicator');
const previewContainer = document.getElementById('previewContainer');
const codePreview = document.getElementById('codePreview');
const inspectorContainer = document.getElementById('inspectorContainer');
const inspectorContent = document.getElementById('inspectorContent');
const inspectorStatus = document.getElementById('inspectorStatus');

let isRecording = false;
let isPaused = false;
let isAssertionMode = false;
let isWaitMode = false;
let isLightMode = false;
let currentFramework = 'cypress';

// Initialize state
chrome.storage.local.get(['isRecording', 'isPaused', 'isAssertionMode', 'isWaitMode', 'commands', 'theme', 'framework'], (result) => {
  isRecording = result.isRecording || false;
  isPaused = result.isPaused || false;
  isAssertionMode = result.isAssertionMode || false;
  isWaitMode = result.isWaitMode || false;
  isLightMode = result.theme === 'light';
  currentFramework = result.framework || 'cypress';

  if (isLightMode) {
    document.body.classList.add('light-mode');
    updateThemeIcon();
  }

  if (frameworkSelect) frameworkSelect.value = currentFramework;
  if (protocolDisplay) protocolDisplay.textContent = currentFramework.toUpperCase();
  updateUI();
});

function translateAction(action, framework) {
  const isCypress = framework === 'cypress';
  const isPlaywright = framework === 'playwright';
  const isRobot = framework === 'robot';

  let selectorStr = '';
  if (action.selector) {
    if (typeof action.selector === 'object' && action.selector.type === 'contains') {
      if (isCypress) {
        selectorStr = `cy.contains('${action.selector.tagName}', '${action.selector.text}')`;
      } else if (isPlaywright) {
        const role = action.selector.tagName === 'a' ? 'link' : (action.selector.tagName === 'button' ? 'button' : null);
        if (role) {
          selectorStr = `page.getByRole('${role}', { name: '${action.selector.text}' })`;
        } else {
          selectorStr = `page.getByText('${action.selector.text}')`;
        }
      } else if (isRobot) {
        const role = action.selector.tagName === 'a' ? 'link' : (action.selector.tagName === 'button' ? 'button' : null);
        if (role) {
          selectorStr = `role=${role}[name="${action.selector.text}"]`;
        } else {
          selectorStr = `text="${action.selector.text}"`;
        }
      } else {
        selectorStr = action.selector.text;
      }
    } else {
      if (isCypress) {
        selectorStr = `cy.get('${action.selector}')`;
      } else if (isPlaywright) {
        // Use modern locators if possible
        if (action.selector.startsWith('[data-testid="')) {
          const match = action.selector.match(/"([^"]+)"/);
          const id = match ? match[1] : '';
          selectorStr = `page.getByTestId('${id}')`;
        } else if (action.selector.startsWith('[aria-label="')) {
          const match = action.selector.match(/"([^"]+)"/);
          const label = match ? match[1] : '';
          selectorStr = `page.getByLabel('${label}')`;
        } else {
          selectorStr = `page.locator('${action.selector}')`;
        }
      } else if (isRobot) {
        // Use standard prefixes for clarity
        if (action.selector.startsWith('#')) {
          selectorStr = `id=${action.selector.substring(1)}`;
        } else if (action.selector.startsWith('.')) {
          selectorStr = `css=${action.selector}`;
        } else {
          selectorStr = action.selector;
        }
      } else {
        selectorStr = action.selector;
      }
    }
  }

  switch (framework) {
    case 'playwright':
      if (action.type === 'visit') return `await page.goto('${action.url}');`;
      if (action.type === 'click') return `await ${selectorStr}.click();`;
      if (action.type === 'type') return `await ${selectorStr}.fill('${action.value}');`;
      if (action.type === 'assertion') return `await expect(${selectorStr}).toHaveText('${action.value}');`;
      if (action.type === 'wait') return `await expect(${selectorStr}).toBeVisible({ timeout: 10000 });`;
      return '';
    case 'robot':
      if (action.type === 'visit') return `Open Browser    ${action.url}    chrome`;
      if (action.type === 'click') return `Click Element    ${selectorStr}`;
      if (action.type === 'type') return `Input Text    ${selectorStr}    ${action.value}`;
      if (action.type === 'assertion') return `Element Should Contain    ${selectorStr}    ${action.value}`;
      if (action.type === 'wait') return `Wait Until Element Is Visible    ${selectorStr}    10s`;
      return '';
    case 'cypress':
    default:
      if (action.type === 'visit') return `cy.visit('${action.url}');`;
      if (action.type === 'click') return `${selectorStr}.first().click({ force: true });`;
      if (action.type === 'type') return `${selectorStr}.first().clear({ force: true }).type('${action.value}', { force: true });`;
      if (action.type === 'assertion') return `${selectorStr}.first().should('be.visible').and('contain', '${action.value}');`;
      if (action.type === 'wait') return `${selectorStr}.first().should('be.visible');`;
      return '';
  }
}

function formatFullScript(commands, framework) {
  const translated = commands.map(cmd => translateAction(cmd, framework)).filter(Boolean);
  
  switch (framework) {
    case 'playwright':
      return `import { test, expect } from '@playwright/test';

test('Recorded Test', async ({ page }) => {
  ${translated.join('\n  ')}
});`;
    case 'robot':
      return `*** Settings ***
Library    SeleniumLibrary

*** Test Cases ***
Recorded Test
    ${translated.join('\n    ')}
    [Teardown]    Close Browser`;
    case 'cypress':
    default:
      return `describe('Recorded Test', () => {
  it('should perform the recorded actions', () => {
    ${translated.join('\n    ')}
  });
});`;
  }
}

function updateUI() {
  if (!statusIndicator || !startBtn || !stopBtn || !pauseBtn || !assertBtn || !waitBtn || !clearBtn || !frameworkSelect) return;

  if (isRecording) {
    if (isPaused) {
      statusIndicator.textContent = 'Recording Paused';
      statusIndicator.className = 'status status-idle';
      if (pauseText) pauseText.textContent = 'Resume';
      if (pauseIcon) pauseIcon.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
    } else {
      statusIndicator.textContent = 'Recording...';
      statusIndicator.className = 'status status-recording';
      if (pauseText) pauseText.textContent = 'Pause';
      if (pauseIcon) pauseIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    }

    if (isAssertionMode) {
      assertBtn.style.borderColor = 'var(--accent-emerald)';
      assertBtn.style.color = 'var(--accent-emerald)';
      assertBtn.style.background = 'rgba(16, 185, 129, 0.1)';
    } else {
      assertBtn.style.borderColor = '';
      assertBtn.style.color = '';
      assertBtn.style.background = '';
    }

    if (isWaitMode) {
      waitBtn.style.borderColor = 'var(--accent-cyan)';
      waitBtn.style.color = 'var(--accent-cyan)';
      waitBtn.style.background = 'rgba(56, 189, 248, 0.1)';
    } else {
      waitBtn.style.borderColor = '';
      waitBtn.style.color = '';
      waitBtn.style.background = '';
    }

    startBtn.disabled = true;
    stopBtn.disabled = false;
    pauseBtn.disabled = false;
    assertBtn.disabled = isPaused;
    waitBtn.disabled = isPaused;
    clearBtn.disabled = true;
    frameworkSelect.disabled = true;
  } else {
    statusIndicator.textContent = 'Ready to Record';
    statusIndicator.className = 'status status-idle';
    startBtn.disabled = false;
    stopBtn.disabled = true;
    pauseBtn.disabled = true;
    assertBtn.disabled = true;
    waitBtn.disabled = true;
    clearBtn.disabled = false;
    frameworkSelect.disabled = false;

    // Reset styles
    assertBtn.style.borderColor = '';
    assertBtn.style.color = '';
    assertBtn.style.background = '';
    waitBtn.style.borderColor = '';
    waitBtn.style.color = '';
    waitBtn.style.background = '';

    if (inspectorContainer) inspectorContainer.style.display = 'none';
  }
  updatePreview();
}

function updatePreview() {
  chrome.storage.local.get(['commands'], (result) => {
    const commands = result.commands || [];
    if (commands.length > 0) {
      previewContainer.style.display = 'block';
      codePreview.innerHTML = '';
      
      commands.forEach((cmd, index) => {
        const translated = translateAction(cmd, currentFramework);
        if (!translated) return;
        
        const item = document.createElement('div');
        item.className = 'command-item';
        item.style.flexDirection = 'column';
        
        const mainRow = document.createElement('div');
        mainRow.style.display = 'flex';
        mainRow.style.width = '100%';
        mainRow.style.justifyContent = 'space-between';
        mainRow.style.alignItems = 'center';
        
        const text = document.createElement('div');
        text.className = 'command-text';
        text.textContent = translated;
        
        if (cmd.sourceMapping && cmd.sourceMapping.unstable) {
          const warning = document.createElement('span');
          warning.className = 'unstable-warning';
          warning.innerHTML = `
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            UNSTABLE
          `;
          warning.title = 'Unstable Selector: No ID found.';
          text.appendChild(warning);
        }
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-cmd-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Remove this line';
        deleteBtn.onclick = (e) => {
          e.stopPropagation();
          removeCommand(index);
        };
        
        mainRow.appendChild(text);
        mainRow.appendChild(deleteBtn);
        item.appendChild(mainRow);
        
        if (cmd.sourceMapping && cmd.sourceMapping.unstable && cmd.sourceMapping.path) {
          const sourceInfo = document.createElement('div');
          sourceInfo.className = 'source-info';
          const vscodeUrl = `vscode://file/${cmd.sourceMapping.path}:${cmd.sourceMapping.line}`;
          sourceInfo.innerHTML = `
            <div>Source: <a href="${vscodeUrl}" style="color: var(--accent-cyan); text-decoration: underline;">${cmd.sourceMapping.path}:${cmd.sourceMapping.line}</a></div>
            <div class="fix-suggestion">Fix: Add <code>${cmd.sourceMapping.suggestion}</code> to this line.</div>
          `;
          item.appendChild(sourceInfo);
        }
        
        codePreview.appendChild(item);
      });
    } else {
      previewContainer.style.display = 'none';
    }
  });
}

function removeCommand(index) {
  chrome.storage.local.get(['commands'], (result) => {
    const commands = result.commands || [];
    commands.splice(index, 1);
    chrome.storage.local.set({ commands }, () => {
      updatePreview();
    });
  });
}

if (frameworkSelect) {
  frameworkSelect.addEventListener('change', (e) => {
    currentFramework = e.target.value;
    if (protocolDisplay) protocolDisplay.textContent = currentFramework.toUpperCase();
    chrome.storage.local.set({ framework: currentFramework });
    updatePreview();
  });
}

if (pauseBtn) {
  pauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    chrome.storage.local.set({ isPaused });
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_PAUSE', isPaused });
      }
    });
    
    updateUI();
  });
}

if (assertBtn) {
  assertBtn.addEventListener('click', () => {
    isAssertionMode = !isAssertionMode;
    if (isAssertionMode) isWaitMode = false;
    chrome.storage.local.set({ isAssertionMode, isWaitMode });
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_ASSERTION_MODE', isAssertionMode });
      }
    });
    
    updateUI();
  });
}

if (waitBtn) {
  waitBtn.addEventListener('click', () => {
    isWaitMode = !isWaitMode;
    if (isWaitMode) isAssertionMode = false;
    chrome.storage.local.set({ isWaitMode, isAssertionMode });
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_WAIT_MODE', isWaitMode });
      }
    });
    
    updateUI();
  });
}

function updateThemeIcon() {
  if (!themeIcon) return;
  if (isLightMode) {
    themeIcon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
  } else {
    themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  }
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    isLightMode = !isLightMode;
    document.body.classList.toggle('light-mode');
    chrome.storage.local.set({ theme: isLightMode ? 'light' : 'dark' });
    updateThemeIcon();
  });
}

if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the current session?')) {
      chrome.storage.local.set({ commands: [] }, () => {
        updatePreview();
      });
    }
  });
}

// Listen for storage changes to update preview in real-time
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.commands || changes.isAssertionMode)) {
    if (changes.isAssertionMode) {
      isAssertionMode = changes.isAssertionMode.newValue;
      updateUI();
    }
    updatePreview();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'ASSERTION_RECORDED' || message.type === 'WAIT_RECORDED') {
    isAssertionMode = false;
    isWaitMode = false;
    updateUI();
  } else if (message.type === 'ELEMENT_HOVERED') {
    renderInspectorInfo(message.info, false);
  } else if (message.type === 'ELEMENT_INSPECTED') {
    renderInspectorInfo(message.info, true);
  }
});

function renderInspectorInfo(info, locked) {
  if (!inspectorContainer || !inspectorContent) return;
  inspectorContainer.style.display = 'block';
  if (inspectorStatus) inspectorStatus.textContent = locked ? '[LOCKED]' : '[HOVER]';

  const rows = [];

  rows.push({ label: 'Tag', value: `<${info.tag}>`, color: '#38bdf8' });
  if (info.id) rows.push({ label: 'ID', value: info.id, color: '#f59e0b' });
  if (info.classes && info.classes.length) rows.push({ label: 'Class', value: info.classes.join(' '), color: '#94a3b8' });
  for (const [k, v] of Object.entries(info.attributes || {})) {
    rows.push({ label: k, value: v, color: '#94a3b8' });
  }
  if (info.text) rows.push({ label: 'Text', value: info.text, color: '#64748b' });

  const selectorVal = typeof info.selector === 'object'
    ? (info.selector.type === 'contains' ? `${info.selector.tagName}:contains("${info.selector.text}")` : JSON.stringify(info.selector))
    : info.selector;
  rows.push({ label: 'Selector', value: selectorVal, color: '#38bdf8' });

  let extra = '';

  if (info.unstable) {
    extra += `<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;margin-top:4px;background:rgba(245,158,11,0.08);border-radius:2px;border-left:2px solid #f59e0b;">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span style="color:#f59e0b;font-size:10px;font-weight:bold;">UNSTABLE SELECTOR</span>
    </div>`;
    if (info.suggestedId) {
      extra += `<div style="font-size:10px;color:#10b981;padding:3px 6px;">
        Suggested: <code style="color:#38bdf8">id="${escapeHtml(info.suggestedId)}"</code>
      </div>`;
    }
  }

  if (info.sourceMapping && info.sourceMapping.path) {
    const vscodeUrl = `vscode://file/${info.sourceMapping.path}:${info.sourceMapping.line}`;
    extra += `<div style="font-size:10px;color:#94a3b8;padding:4px 6px;margin-top:4px;background:rgba(255,255,255,0.03);border-left:2px solid #38bdf8;border-radius:2px;">
      <div style="color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-size:9px;margin-bottom:2px;">Source</div>
      <a href="${vscodeUrl}" style="color:#38bdf8;text-decoration:underline;word-break:break-all;">${escapeHtml(info.sourceMapping.path)}:${info.sourceMapping.line}</a>
    </div>`;
  } else if (info.unstable) {
    const searches = [];
    if (info.classes && info.classes.length) {
      searches.push(...info.classes.slice(0, 2).map(c => ({ label: 'class', term: `.${c}` })));
    }
    if (info.text) {
      searches.push({ label: 'text', term: info.text.substring(0, 40) });
    }
    for (const [k, v] of Object.entries(info.attributes || {})) {
      searches.push({ label: k, term: v });
      break;
    }

    if (searches.length) {
      const items = searches.map(s =>
        `<div style="display:flex;justify-content:space-between;align-items:center;gap:4px;margin-top:3px;">
          <code style="color:#38bdf8;word-break:break-all;flex:1">${escapeHtml(s.term)}</code>
          <button class="inspector-copy" title="Copy" style="opacity:1" onclick="navigator.clipboard.writeText('${escapeAttr(s.term)}')">⎘</button>
        </div>`
      ).join('');
      extra += `<div style="font-size:10px;padding:6px;margin-top:4px;background:rgba(255,255,255,0.03);border-left:2px solid #a78bfa;border-radius:2px;">
        <div style="color:#a78bfa;text-transform:uppercase;letter-spacing:0.05em;font-size:9px;font-weight:bold;margin-bottom:4px;">Find in project — search for:</div>
        ${items}
        <div style="color:#475569;margin-top:6px;font-style:italic;">No ID found. Add <code style="color:#38bdf8">id="${escapeHtml(info.suggestedId || 'element-id')}"</code> to make it stable.</div>
      </div>`;
    }
  }

  inspectorContent.innerHTML = rows.map(r => `
    <div class="inspector-row">
      <span class="inspector-label">${r.label}</span>
      <span class="inspector-value" style="color:${r.color}">${escapeHtml(String(r.value))}</span>
      <button class="inspector-copy" title="Copy" onclick="navigator.clipboard.writeText('${escapeAttr(String(r.value))}')">⎘</button>
    </div>
  `).join('') + extra;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}


if (startBtn) {
  startBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) {
        if (statusIndicator) {
          statusIndicator.textContent = 'Cannot record on this page';
          statusIndicator.className = 'status status-idle';
        }
        return;
      }

      isRecording = true;
      const initialAction = { type: 'visit', url: tab.url };
      
      await chrome.storage.local.set({ 
        isRecording: true, 
        commands: [initialAction] 
      });
      
      updateUI();

      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      } catch (e) {
        console.log('Script injection skipped');
      }

      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'START_RECORDING' });
      } catch (e) {
        console.log('Content script not ready yet');
      }
    } catch (err) {
      console.error('Failed to start recording:', err);
      if (statusIndicator) statusIndicator.textContent = 'Error starting recorder';
    }
  });
}

if (stopBtn) {
  stopBtn.addEventListener('click', () => {
    isRecording = false;
    chrome.storage.local.set({ isRecording: false });
    updateUI();
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'STOP_RECORDING' });
      }
    });
  });
}

if (copyBtn) {
  copyBtn.addEventListener('click', () => {
    chrome.storage.local.get(['commands'], (result) => {
      const commands = result.commands || [];
      const code = formatFullScript(commands, currentFramework);
      
      navigator.clipboard.writeText(code).then(() => {
        const originalText = copyBtn.innerText;
        copyBtn.innerText = 'Copied!';
        setTimeout(() => {
          copyBtn.innerText = originalText;
        }, 2000);
      });
    });
  });
}
