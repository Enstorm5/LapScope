/* Interactive Widget Layout Manager: Drag & Drop, Span Resizing, Zoom Scale, and Local Storage Persistence. */

const LAYOUT_KEY = "ls_widget_layout";

const DEFAULT_LAYOUT = {
  order: ["w-cluster", "w-session", "w-friction", "w-tyre", "w-inputs", "w-strip", "w-circuit", "w-raw"],
  spans: {
    "w-cluster": "span7",
    "w-session": "span5",
    "w-friction": "span4",
    "w-tyre": "span4",
    "w-inputs": "span4",
    "w-strip": "span7",
    "w-circuit": "span5",
    "w-raw": "span12",
  },
  scales: {
    "w-cluster": 1.0,
    "w-session": 1.0,
    "w-friction": 1.0,
    "w-tyre": 1.0,
    "w-inputs": 1.0,
    "w-strip": 1.0,
    "w-circuit": 1.0,
    "w-raw": 1.0,
  }
};

function loadLayout() {
  try {
    const data = JSON.parse(localStorage.getItem(LAYOUT_KEY));
    if (data && data.order && data.spans) {
      return {
        order: data.order,
        spans: { ...DEFAULT_LAYOUT.spans, ...data.spans },
        scales: { ...DEFAULT_LAYOUT.scales, ...(data.scales || {}) }
      };
    }
  } catch (e) { /* private mode or invalid JSON */ }
  return { ...DEFAULT_LAYOUT };
}

let currentLayout = loadLayout();
let isEditMode = false;
let draggedWidgetId = null;

function saveLayoutState() {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(currentLayout));
  } catch (e) { /* silent */ }
}

function applyLayout() {
  const grid = document.querySelector("main.grid");
  if (!grid) return;

  // 1. Re-order widgets in DOM
  const existingMap = new Map();
  const children = Array.from(grid.children);
  for (const child of children) {
    if (child.id) existingMap.set(child.id, child);
  }

  for (const id of currentLayout.order) {
    const el = existingMap.get(id);
    if (el) grid.appendChild(el);
  }

  // 2. Apply grid spans and zoom scale
  for (const [id, el] of existingMap.entries()) {
    const span = currentLayout.spans[id] || "span4";
    el.className = el.className.replace(/\bspan\d+\b/g, "").trim() + " " + span + " widget-wrapper";
    
    const scale = currentLayout.scales[id] || 1.0;
    const inner = el.querySelector(".widget-scale-inner");
    if (inner) {
      inner.style.transform = scale !== 1.0 ? `scale(${scale})` : "";
      inner.style.transformOrigin = "top left";
    }

    const zoomLbl = el.querySelector(".zoom-val-lbl");
    if (zoomLbl) zoomLbl.textContent = `${Math.round(scale * 100)}%`;
  }

  if (typeof initCanvases === "function") {
    try { initCanvases(); } catch(e) {}
  }
}

function setSpan(id, newSpan) {
  currentLayout.spans[id] = newSpan;
  saveLayoutState();
  applyLayout();
}

function setScale(id, delta) {
  let cur = currentLayout.scales[id] || 1.0;
  cur = Math.max(0.7, Math.min(1.5, parseFloat((cur + delta).toFixed(1))));
  currentLayout.scales[id] = cur;
  saveLayoutState();
  applyLayout();
}

function resetLayout() {
  currentLayout = {
    order: [...DEFAULT_LAYOUT.order],
    spans: { ...DEFAULT_LAYOUT.spans },
    scales: { ...DEFAULT_LAYOUT.scales }
  };
  saveLayoutState();
  applyLayout();
}

function toggleEditMode() {
  isEditMode = !isEditMode;
  document.body.classList.toggle("layout-edit-mode", isEditMode);
  const btn = document.getElementById("btn-edit-layout");
  if (btn) {
    btn.classList.toggle("active", isEditMode);
    btn.textContent = isEditMode ? "✓ DONE EDITING" : "⚙ EDIT LAYOUT";
  }
}

function initWidgetControls() {
  const grid = document.querySelector("main.grid");
  if (!grid) return;

  const widgets = Array.from(grid.children);
  for (const w of widgets) {
    if (!w.id) continue;
    
    // Inject control bar if not present
    if (!w.querySelector(".widget-ctrl-bar")) {
      const bar = document.createElement("div");
      bar.className = "widget-ctrl-bar";
      bar.innerHTML = `
        <div class="drag-handle" title="Drag to reposition widget" draggable="true">⠿ DRAG</div>
        <div class="span-ctrls" title="Change column width">
          <button type="button" class="btn-span" data-span="span4">S</button>
          <button type="button" class="btn-span" data-span="span6">M</button>
          <button type="button" class="btn-span" data-span="span7">L</button>
          <button type="button" class="btn-span" data-span="span12">FULL</button>
        </div>
        <div class="zoom-ctrls" title="Zoom/Scale content">
          <button type="button" class="btn-zoom-out">−</button>
          <span class="zoom-val-lbl">100%</span>
          <button type="button" class="btn-zoom-in">+</button>
        </div>
      `;
      w.insertBefore(bar, w.firstChild);

      // Wrap child content inside .widget-scale-inner if not wrapped
      if (!w.querySelector(".widget-scale-inner")) {
        const inner = document.createElement("div");
        inner.className = "widget-scale-inner";
        while (w.children.length > 1) {
          inner.appendChild(w.children[1]);
        }
        w.appendChild(inner);
      }
    }

    // Bind event handlers
    const id = w.id;
    const dragHandle = w.querySelector(".drag-handle");
    if (dragHandle) {
      dragHandle.addEventListener("dragstart", (e) => {
        draggedWidgetId = id;
        w.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
      });
      dragHandle.addEventListener("dragend", () => {
        w.classList.remove("dragging");
        draggedWidgetId = null;
        document.querySelectorAll(".widget-wrapper").forEach(el => el.classList.remove("drag-over"));
      });
    }

    w.addEventListener("dragover", (e) => {
      if (!isEditMode || !draggedWidgetId || draggedWidgetId === id) return;
      e.preventDefault();
      w.classList.add("drag-over");
    });

    w.addEventListener("dragleave", () => {
      w.classList.remove("drag-over");
    });

    w.addEventListener("drop", (e) => {
      if (!isEditMode || !draggedWidgetId || draggedWidgetId === id) return;
      e.preventDefault();
      w.classList.remove("drag-over");

      const idxA = currentLayout.order.indexOf(draggedWidgetId);
      const idxB = currentLayout.order.indexOf(id);
      if (idxA !== -1 && idxB !== -1) {
        currentLayout.order.splice(idxA, 1);
        currentLayout.order.splice(idxB, 0, draggedWidgetId);
        saveLayoutState();
        applyLayout();
      }
    });

    // Span buttons
    w.querySelectorAll(".btn-span").forEach(btn => {
      btn.onclick = () => setSpan(id, btn.dataset.span);
    });

    // Zoom buttons
    const btnOut = w.querySelector(".btn-zoom-out");
    if (btnOut) btnOut.onclick = () => setScale(id, -0.1);
    const btnIn = w.querySelector(".btn-zoom-in");
    if (btnIn) btnIn.onclick = () => setScale(id, 0.1);
  }

  applyLayout();
}

window.addEventListener("load", () => {
  initWidgetControls();
  const editBtn = document.getElementById("btn-edit-layout");
  if (editBtn) editBtn.onclick = toggleEditMode;
  const resetBtn = document.getElementById("btn-reset-layout");
  if (resetBtn) resetBtn.onclick = resetLayout;
});
