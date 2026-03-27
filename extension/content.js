let isRecording = false;
let isPaused = false;
let isAssertionMode = false;
let isWaitMode = false;

// Load initial state
chrome.storage.local.get(['isRecording', 'isPaused', 'isAssertionMode', 'isWaitMode'], (result) => {
  isRecording = result.isRecording;
  isPaused = result.isPaused || false;
  isAssertionMode = result.isAssertionMode || false;
  isWaitMode = result.isWaitMode || false;
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'START_RECORDING') {
    isRecording = true;
    isPaused = false;
    isAssertionMode = false;
    isWaitMode = false;
  } else if (message.type === 'STOP_RECORDING') {
    isRecording = false;
    removeInspectHighlight();
  } else if (message.type === 'TOGGLE_PAUSE') {
    isPaused = message.isPaused;
    if (isPaused) removeInspectHighlight();
  } else if (message.type === 'TOGGLE_ASSERTION_MODE') {
    isAssertionMode = message.isAssertionMode;
    if (isAssertionMode) isWaitMode = false;
  } else if (message.type === 'TOGGLE_WAIT_MODE') {
    isWaitMode = message.isWaitMode;
    if (isWaitMode) isAssertionMode = false;
  }
});

function getSelector(el) {
  // Find nearest interactive parent if clicking a child
  let interactive = el;
  while (interactive && interactive.tagName !== 'BUTTON' && interactive.tagName !== 'A' && interactive.tagName !== 'LI' && interactive.parentNode) {
    if (interactive.tagName === 'BODY') break;
    interactive = interactive.parentNode;
  }
  
  const target = (interactive && (interactive.tagName === 'BUTTON' || interactive.tagName === 'A' || interactive.tagName === 'LI')) ? interactive : el;

  // 1. Data attributes (Best practice)
  const dataAttrs = ['data-cy', 'data-test', 'data-testid', 'data-qa', 'aria-label', 'name'];
  for (const attr of dataAttrs) {
    const val = target.getAttribute(attr);
    if (val) {
      const selector = `[${attr}="${val}"]`;
      if (document.querySelectorAll(selector).length === 1) return selector;
    }
  }

  // 2. ID
  if (target.id && !/^\d/.test(target.id)) {
    const selector = `#${target.id}`;
    if (document.querySelectorAll(selector).length === 1) return selector;
  }

  // 3. Button/Link/List item text (cy.contains candidate)
  if ((target.tagName === 'BUTTON' || target.tagName === 'A' || target.tagName === 'LI') && target.innerText.trim().length > 0 && target.innerText.trim().length < 50) {
    return { type: 'contains', tagName: target.tagName.toLowerCase(), text: target.innerText.trim() };
  }

  // 4. Classes (more specific)
  if (target.className && typeof target.className === 'string') {
    const classes = target.className.trim().split(/\s+/).filter(c => c && !c.includes(':') && !/^[0-9]/.test(c));
    if (classes.length > 0) {
      // Try single classes first
      for (const cls of classes) {
        const selector = `.${cls}`;
        if (document.querySelectorAll(selector).length === 1) return selector;
      }
      // Try combined classes
      const combinedSelector = `.${classes.join('.')}`;
      try {
        if (document.querySelectorAll(combinedSelector).length === 1) return combinedSelector;
      } catch (e) {}
    }
  }

  // 5. Path-based selector (always unique)
  return getPathSelector(target);
}

function getPathSelector(el) {
  const path = [];
  let current = el;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let selector = current.tagName.toLowerCase();
    if (current.id && !/^\d/.test(current.id)) {
      selector += `#${current.id}`;
      path.unshift(selector);
      break;
    } else {
      let sibling = current;
      let nth = 1;
      while (sibling = sibling.previousElementSibling) {
        if (sibling.tagName === current.tagName) nth++;
      }
      if (nth > 1) selector += `:nth-of-type(${nth})`;
    }
    path.unshift(selector);
    current = current.parentNode;
  }
  return path.join(' > ');
}

function addCommand(action, element = null) {
  if (!isRecording || isPaused) return;

  if (element) {
    const hasStableSelector = element.id ||
                             element.getAttribute('data-cy') ||
                             element.getAttribute('data-test') ||
                             element.getAttribute('data-testid');
    if (!hasStableSelector) {
      const sourceInfo = getSourceMetadata(element);
      action.sourceMapping = {
        unstable: true,
        ...(sourceInfo || {}),
        suggestion: `id="${suggestId(element)}"`
      };
    }
  }
  
  chrome.storage.local.get(['commands'], (result) => {
    const commands = result.commands || [];
    commands.push(action);
    chrome.storage.local.set({ commands });
  });
}

function getSourceMetadata(el) {
  // 1. React fiber tree (_debugSource) — works with @babel/plugin-transform-react-jsx-source
  try {
    const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
    if (fiberKey) {
      let fiber = el[fiberKey];
      while (fiber) {
        if (fiber._debugSource) {
          return { path: fiber._debugSource.fileName, line: fiber._debugSource.lineNumber };
        }
        fiber = fiber.return;
      }
    }
  } catch (e) {}

  // 2. Vue 3 component instance (__vueParentComponent)
  try {
    let node = el;
    while (node) {
      const vueKey = Object.keys(node).find(k => k.startsWith('__vueParentComponent') || k === '__vue__');
      if (vueKey) {
        const comp = node[vueKey];
        const file = comp?.type?.__file || comp?.subTree?.component?.type?.__file;
        if (file) return { path: file, line: '?' };
      }
      node = node.parentElement;
    }
  } catch (e) {}

  // 3. DOM attributes fallback (some custom setups)
  let current = el;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    const sourcePath = current.getAttribute('data-source-path') ||
                      current.getAttribute('data-v-source-file') ||
                      current.getAttribute('data-source');
    const sourceLine = current.getAttribute('data-source-line') ||
                      current.getAttribute('data-line');
    if (sourcePath) {
      return { path: sourcePath, line: sourceLine || '?' };
    }
    current = current.parentNode;
  }

  return null;
}

function suggestId(el) {
  const tag = el.tagName.toLowerCase();
  let base = tag;
  
  if (el.name) base = el.name;
  else if (el.placeholder) base = el.placeholder.toLowerCase().replace(/[^a-z0-9]/g, '-');
  else if (el.innerText && el.innerText.length < 20) base = el.innerText.toLowerCase().replace(/[^a-z0-9]/g, '-');
  else if (el.getAttribute('aria-label')) base = el.getAttribute('aria-label').toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  // Clean up base
  base = base.trim().replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!base) base = tag;
  
  const suffix = tag === 'button' ? 'btn' : (tag === 'input' ? 'input' : (tag === 'a' ? 'link' : 'el'));
  return `${base}-${suffix}`;
}

// Record clicks
document.addEventListener('click', (e) => {
  if (!isRecording || isPaused) return;
  
  const selector = getSelector(e.target);
  
  if (isAssertionMode) {
    e.preventDefault();
    e.stopPropagation();
    
    let value = e.target.textContent.trim();
    
    // Fallback for PDF viewers or elements without text
    if (!value) {
      if (e.target.tagName === 'EMBED' || e.target.tagName === 'OBJECT') {
        value = e.target.getAttribute('src') || e.target.getAttribute('data') || 'PDF Content';
      } else if (e.target.tagName === 'IFRAME') {
        value = e.target.src || 'Iframe Content';
      } else if (e.target.tagName === 'IMG') {
        value = e.target.alt || e.target.src;
      }
    }
    
    addCommand({ type: 'assertion', selector, value: value || 'Element exists' }, e.target);
    
    isAssertionMode = false;
    chrome.storage.local.set({ isAssertionMode: false });
    chrome.runtime.sendMessage({ type: 'ASSERTION_RECORDED' });
  } else if (isWaitMode) {
    e.preventDefault();
    e.stopPropagation();
    
    let value = e.target.textContent.trim();
    if (!value && (e.target.tagName === 'EMBED' || e.target.tagName === 'OBJECT')) {
      value = 'PDF Loaded';
    }
    
    addCommand({ type: 'wait', selector, value: value || 'Element visible' }, e.target);
    
    isWaitMode = false;
    chrome.storage.local.set({ isWaitMode: false });
    chrome.runtime.sendMessage({ type: 'WAIT_RECORDED' });
  } else {
    addCommand({ type: 'click', selector }, e.target);
  }
}, true);

// Record input changes
document.addEventListener('change', (e) => {
  if (!isRecording || isPaused) return;
  
  const selector = getSelector(e.target);
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
    addCommand({ type: 'type', selector, value: e.target.value }, e.target);
  }
}, true);

// ── Inspect Mode ──────────────────────────────────────────────────────────────

let inspectTooltip = null;
let lastHighlightedEl = null;

function removeInspectHighlight() {
  if (lastHighlightedEl) {
    lastHighlightedEl.style.outline = lastHighlightedEl._rrOriginalOutline || '';
    lastHighlightedEl._rrOriginalOutline = undefined;
    lastHighlightedEl = null;
  }
  if (inspectTooltip) {
    inspectTooltip.remove();
    inspectTooltip = null;
  }
}

function getElementInfo(el) {
  const relevantAttrs = ['data-cy', 'data-test', 'data-testid', 'data-qa', 'aria-label', 'name', 'type', 'placeholder', 'role'];
  const attributes = {};
  for (const attr of relevantAttrs) {
    const val = el.getAttribute(attr);
    if (val) attributes[attr] = val;
  }
  const hasStableSelector = el.id ||
    el.getAttribute('data-cy') || el.getAttribute('data-test') || el.getAttribute('data-testid');
  const sourceMapping = !hasStableSelector ? getSourceMetadata(el) : null;
  const suggestedId = !hasStableSelector ? suggestId(el) : null;
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || null,
    classes: typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean) : [],
    attributes,
    selector: getSelector(el),
    text: el.innerText ? el.innerText.trim().substring(0, 60) : null,
    sourceMapping,
    suggestedId,
    unstable: !hasStableSelector
  };
}

document.addEventListener('mouseover', (e) => {
  if (!isRecording) return;
  const el = e.target;
  if (el.id === '__rr-inspect-tooltip__') return;

  if (lastHighlightedEl && lastHighlightedEl !== el) {
    lastHighlightedEl.style.outline = lastHighlightedEl._rrOriginalOutline || '';
  }
  lastHighlightedEl = el;
  el._rrOriginalOutline = el.style.outline;
  el.style.outline = '2px solid #38bdf8';

  if (!inspectTooltip) {
    inspectTooltip = document.createElement('div');
    inspectTooltip.id = '__rr-inspect-tooltip__';
    inspectTooltip.style.cssText = [
      'position:fixed', 'z-index:2147483647', 'background:#0f172a',
      'color:#f8fafc', "font-family:'JetBrains Mono',monospace", 'font-size:11px',
      'padding:8px 10px', 'border-radius:4px', 'border:1px solid #38bdf8',
      'pointer-events:none', 'max-width:280px', 'box-shadow:0 4px 12px rgba(0,0,0,0.6)',
      'line-height:1.6'
    ].join(';');
    document.body.appendChild(inspectTooltip);
  }

  const info = getElementInfo(el);
  let html = `<div style="color:#38bdf8;font-weight:bold">&lt;${info.tag}&gt;</div>`;
  if (info.id) html += `<div>id: <span style="color:#f59e0b">${info.id}</span></div>`;
  if (info.classes.length) html += `<div style="color:#94a3b8">.${info.classes.join(' .')}</div>`;
  for (const [k, v] of Object.entries(info.attributes)) {
    html += `<div style="color:#64748b">${k}: <span style="color:#94a3b8">${v}</span></div>`;
  }
  inspectTooltip.innerHTML = html;

  chrome.runtime.sendMessage({ type: 'ELEMENT_HOVERED', info });
}, true);

document.addEventListener('mousemove', (e) => {
  if (!isRecording || !inspectTooltip) return;
  const x = e.clientX + 14;
  const y = e.clientY + 14;
  inspectTooltip.style.left = Math.min(x, window.innerWidth - 300) + 'px';
  inspectTooltip.style.top = Math.min(y, window.innerHeight - 130) + 'px';
}, true);

document.addEventListener('click', (e) => {
  if (!isRecording) return;
  const info = getElementInfo(e.target);
  chrome.runtime.sendMessage({ type: 'ELEMENT_INSPECTED', info });
}, true);

// ── Navigation (URL changes) ───────────────────────────────────────────────────

// Handle navigation (URL changes)
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    if (isRecording && !isPaused) {
      addCommand({ type: 'visit', url: location.href });
    }
  }
}).observe(document, { subtree: true, childList: true });
