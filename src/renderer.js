'use strict';

// ── Shape definitions (id must match POINTER_SHAPES keys in cursor-gen.js) ────
const SHAPES = [
  {
    id: 'arrow', label: 'Arrow',
    svg: `<polygon points="2,2 2,22 8,16 12,26 16,24 12,14 20,14" fill="currentColor"/>`,
    hotCenter: false,
  },
  {
    id: 'thick-arrow', label: 'Thick',
    svg: `<polygon points="2,2 2,26 10,18 14,28 20,24 16,14 24,14" fill="currentColor"/>`,
    hotCenter: false,
  },
  {
    id: 'star', label: 'Star',
    svg: `<polygon points="16,2 19,11 29,11 21,17 24,27 16,21 8,27 11,17 3,11 13,11" fill="currentColor"/>`,
    hotCenter: true,
  },
  {
    id: 'circle', label: 'Circle',
    svg: `<circle cx="16" cy="16" r="13" fill="currentColor"/><circle cx="16" cy="16" r="3" fill="rgba(0,0,0,0.4)"/>`,
    hotCenter: true,
  },
  {
    id: 'diamond', label: 'Diamond',
    svg: `<polygon points="16,2 29,16 16,30 3,16" fill="currentColor"/>`,
    hotCenter: true,
  },
  {
    id: 'cross', label: 'Cross',
    svg: `<rect x="11" y="2" width="10" height="28" rx="2" fill="currentColor"/><rect x="2" y="11" width="28" height="10" rx="2" fill="currentColor"/>`,
    hotCenter: true,
  },
  {
    id: 'hand', label: 'Hand',
    svg: `<path d="M10,26 L10,10 Q10,8 12,8 Q14,8 14,10 L14,6 Q14,4 16,4 Q18,4 18,6 L18,8 Q18,6 20,6 Q22,6 22,8 L22,10 Q22,8 24,8 Q26,8 26,10 L26,22 Q26,26 22,26 Z" fill="currentColor"/>`,
    hotCenter: false,
  },
];

// ── Presets ───────────────────────────────────────────────────────────────────
const PRESETS = [
  { name: 'Default',       color: '#ffffff', size: 32,  shape: 'arrow'       },
  { name: 'Big Green',     color: '#00ff66', size: 96,  shape: 'thick-arrow' },
  { name: 'Blue Star',     color: '#0099ff', size: 80,  shape: 'star'        },
  { name: 'Red Diamond',   color: '#ff3333', size: 96,  shape: 'diamond'     },
  { name: 'Gold Circle',   color: '#ffd700', size: 80,  shape: 'circle'      },
  { name: 'Pink Cross',    color: '#ff69b4', size: 64,  shape: 'cross'       },
];

// ── DOM refs ──────────────────────────────────────────────────────────────────
const presetGrid    = document.getElementById('preset-grid');
const shapeGrid     = document.getElementById('shape-grid');
const colorInput    = document.getElementById('color-input');
const colorHex      = document.getElementById('color-hex');
const sizeSlider    = document.getElementById('size-slider');
const sizeDisplay   = document.getElementById('size-display');
const applyBtn      = document.getElementById('apply-btn');
const resetBtn      = document.getElementById('reset-btn');
const statusBar     = document.getElementById('status-bar');
const cursorPreview = document.getElementById('cursor-preview');
const shapeSvg      = document.getElementById('shape-svg');
const previewLabel  = document.getElementById('preview-label');
const closeBtn      = document.getElementById('close-btn');

// ── State ─────────────────────────────────────────────────────────────────────
let activePresetIndex = null;
let selectedShape = 'arrow';
let isApplying = false;

// ── Build shape buttons ───────────────────────────────────────────────────────
SHAPES.forEach((shape) => {
  const btn = document.createElement('button');
  btn.className = 'shape-btn';
  btn.dataset.shape = shape.id;
  btn.title = shape.label;
  btn.innerHTML = `
    <svg viewBox="0 0 32 32" class="shape-icon">${shape.svg}</svg>
    <span class="shape-label">${shape.label}</span>
  `;
  btn.addEventListener('click', () => selectShape(shape.id));
  shapeGrid.appendChild(btn);
});

function selectShape(id) {
  selectedShape = id;
  document.querySelectorAll('.shape-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.shape === id);
  });
  updatePreview(colorInput.value);
  setActivePreset(null);
}

// Activate default shape
selectShape('arrow');

// ── Build preset cards ────────────────────────────────────────────────────────
PRESETS.forEach((preset, idx) => {
  const shapeInfo = SHAPES.find(s => s.id === preset.shape) || SHAPES[0];
  const card = document.createElement('div');
  card.className = 'preset-card';
  card.dataset.index = idx;
  card.innerHTML = `
    <div class="preset-swatch" style="background:${preset.color}">
      <svg viewBox="0 0 32 32" class="swatch-shape">${shapeInfo.svg}</svg>
    </div>
    <div class="preset-name">${preset.name}</div>
    <div class="preset-size">${preset.size}px</div>
  `;
  card.addEventListener('click', () => applyPreset(idx));
  presetGrid.appendChild(card);
});

function setActivePreset(idx) {
  document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
  if (idx !== null) {
    const card = presetGrid.querySelector(`[data-index="${idx}"]`);
    if (card) card.classList.add('active');
  }
  activePresetIndex = idx;
}

async function applyPreset(idx) {
  if (isApplying) return;
  const preset = PRESETS[idx];
  setActivePreset(idx);
  colorInput.value = preset.color;
  colorHex.value   = preset.color;
  sizeSlider.value = preset.size;
  sizeDisplay.textContent = `${preset.size}px`;
  selectShape(preset.shape);
  updatePreview(preset.color);
  await doApply(preset.color, preset.size, preset.shape);
}

// ── Color picker sync ─────────────────────────────────────────────────────────
colorInput.addEventListener('input', () => {
  colorHex.value = colorInput.value;
  updatePreview(colorInput.value);
  setActivePreset(null);
});

colorHex.addEventListener('input', () => {
  const raw = colorHex.value.trim();
  const hex = raw.startsWith('#') ? raw : '#' + raw;
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    colorInput.value = hex;
    updatePreview(hex);
    setActivePreset(null);
  }
});

colorHex.addEventListener('blur', () => {
  const raw = colorHex.value.trim();
  const hex = raw.startsWith('#') ? raw : '#' + raw;
  colorHex.value = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : colorInput.value;
});

// ── Size slider sync ──────────────────────────────────────────────────────────
sizeSlider.addEventListener('input', () => {
  sizeDisplay.textContent = `${sizeSlider.value}px`;
  updatePreview(colorInput.value);
  setActivePreset(null);
});

// ── Preview update ────────────────────────────────────────────────────────────
function updatePreview(color) {
  cursorPreview.style.color = color;
  cursorPreview.style.borderColor = color + '55';
  const shape = SHAPES.find(s => s.id === selectedShape) || SHAPES[0];
  shapeSvg.innerHTML = shape.svg;
  if (previewLabel) {
    previewLabel.textContent = `${shape.label} • ${sizeSlider.value}px`;
  }
}

updatePreview(colorInput.value);

// ── Apply custom ──────────────────────────────────────────────────────────────
applyBtn.addEventListener('click', async () => {
  if (isApplying) return;
  setActivePreset(null);
  await doApply(colorInput.value, parseInt(sizeSlider.value, 10), selectedShape);
});

// ── Reset ─────────────────────────────────────────────────────────────────────
resetBtn.addEventListener('click', async () => {
  if (isApplying) return;
  setApplying(true);
  setStatus('Resetting…', '');
  try {
    const result = await window.cursorAPI.resetDefault();
    if (result.ok) {
      setActivePreset(null);
      setStatus('Reset to Windows default', 'success');
    } else {
      setStatus('Error: ' + result.error, 'error');
    }
  } catch (err) {
    setStatus('Error: ' + err.message, 'error');
  } finally {
    setApplying(false);
  }
});

// ── Close ─────────────────────────────────────────────────────────────────────
closeBtn.addEventListener('click', () => window.close());

// ── Core apply ────────────────────────────────────────────────────────────────
async function doApply(color, size, shape) {
  setApplying(true);
  setStatus(`Generating ${shape} @ ${size}px…`, '');
  try {
    const result = await window.cursorAPI.applyCursor(color, size, shape);
    if (result.ok) {
      setStatus(`✓ ${shape} • ${color} @ ${size}px`, 'success');
    } else {
      setStatus('Error: ' + result.error, 'error');
    }
  } catch (err) {
    setStatus('Error: ' + err.message, 'error');
  } finally {
    setApplying(false);
  }
}

function setApplying(val) {
  isApplying = val;
  applyBtn.disabled = val;
  resetBtn.disabled = val;
  applyBtn.classList.toggle('loading', val);
  applyBtn.textContent = val ? 'Applying' : 'Apply Custom';
}

function setStatus(msg, type) {
  statusBar.textContent = msg;
  statusBar.className = 'status-bar' + (type ? ' ' + type : '');
  if (type === 'success') {
    setTimeout(() => {
      if (statusBar.textContent === msg) {
        statusBar.textContent = 'Ready';
        statusBar.className = 'status-bar';
      }
    }, 4000);
  }
}

window.cursorAPI.onStatusUpdate((msg) => setStatus(msg, 'success'));

// ── Restore last theme on load ────────────────────────────────────────────────
(async () => {
  const last = await window.cursorAPI.getLastTheme();
  if (last) {
    const presetIdx = PRESETS.findIndex(
      p => p.color === last.color && p.size === last.size && p.shape === last.shape
    );
    if (presetIdx >= 0) setActivePreset(presetIdx);
    colorInput.value = last.color;
    colorHex.value   = last.color;
    sizeSlider.value = last.size;
    sizeDisplay.textContent = `${last.size}px`;
    if (last.shape) selectShape(last.shape);
    updatePreview(last.color);
    setStatus(`Last: ${last.shape || 'arrow'} • ${last.color} @ ${last.size}px`, '');
  }
})();
