/* Interactive Widget Layout Manager: Drag & Drop, Span Resizing, Zoom Scale, and Local Storage Persistence. */

const LAYOUT_KEY = "ls_widget_layout";

const DEFAULT_LAYOUT = {
  order: ["w-cluster", "w-transmission", "w-session", "w-tyre", "w-inputs", "w-friction", "w-surface", "w-apex", "w-impact", "w-strip", "w-circuit", "w-raw"],
  spans: {
    "w-cluster": "span6",
    "w-transmission": "span3",
    "w-session": "span3",
    "w-tyre": "span7",
    "w-inputs": "span5",
    "w-friction": "span5",
    "w-surface": "span6",
    "w-apex": "span6",
    "w-impact": "span6",
    "w-strip": "span7",
    "w-circuit": "span5",
    "w-raw": "span12",
  },
  scales: {
    "w-cluster": 1.0,
    "w-transmission": 1.0,
    "w-session": 1.0,
    "w-tyre": 1.0,
    "w-inputs": 1.0,
    "w-friction": 1.0,
    "w-surface": 1.0,
    "w-apex": 1.0,
    "w-impact": 1.0,
    "w-strip": 1.0,
    "w-circuit": 1.0,
    "w-raw": 1.0,
  },
  heights: {}
};

function loadLayout() {
  try {
    const data = JSON.parse(localStorage.getItem(LAYOUT_KEY));
    if (data && data.order && data.spans) {
      // Merge any new default widgets that aren't in the saved order
      const savedOrder = [...data.order];
      for (const defId of DEFAULT_LAYOUT.order) {
        if (!savedOrder.includes(defId)) savedOrder.push(defId);
      }
      return {
        order: savedOrder,
        spans: { ...DEFAULT_LAYOUT.spans, ...data.spans },
        scales: { ...DEFAULT_LAYOUT.scales, ...(data.scales || {}) },
        heights: { ...(DEFAULT_LAYOUT.heights || {}), ...(data.heights || {}) }
      };
    }
  } catch (e) { /* private mode or invalid JSON */ }
  return { ...DEFAULT_LAYOUT, heights: {} };
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

  // 1. Build map of all widgets currently in DOM
  const existingMap = new Map();
  const children = Array.from(grid.children);
  for (const child of children) {
    if (child.id) existingMap.set(child.id, child);
  }

  // 2. Add any DOM widgets missing from order array
  for (const domId of existingMap.keys()) {
    if (!currentLayout.order.includes(domId)) {
      currentLayout.order.push(domId);
    }
  }

  // 3. Re-order widgets in DOM according to order array
  for (const id of currentLayout.order) {
    const el = existingMap.get(id);
    if (el) grid.appendChild(el);
  }

  // 4. Apply grid spans, freeform height, and zoom scale
  for (const [id, el] of existingMap.entries()) {
    const span = currentLayout.spans[id] || "span4";
    el.classList.remove(...Array.from(el.classList).filter(c => /^span\d+$/.test(c)));
    el.classList.add(span, "widget-wrapper");
    
    // Apply freeform custom height if set
    const h = currentLayout.heights ? currentLayout.heights[id] : null;
    if (h) {
      el.style.minHeight = `${h}px`;
      el.style.height = `${h}px`;
    } else {
      el.style.minHeight = "";
      el.style.height = "";
    }

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

function setScale(id, delta, setAbsolute = false) {
  let curScale = currentLayout.scales[id] || 1.0;
  if (setAbsolute) {
    curScale = Math.max(0.5, Math.min(2.0, parseFloat(delta.toFixed(2))));
  } else {
    curScale = Math.max(0.5, Math.min(2.0, parseFloat((curScale + delta).toFixed(2))));
  }
  currentLayout.scales[id] = curScale;
  saveLayoutState();
  applyLayout();
}

function resetLayout() {
  currentLayout = {
    order: [...DEFAULT_LAYOUT.order],
    spans: { ...DEFAULT_LAYOUT.spans },
    scales: { ...DEFAULT_LAYOUT.scales },
    heights: {}
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
    const id = w.id;
    
    // Inject control bar if not present
    if (!w.querySelector(".widget-ctrl-bar")) {
      const bar = document.createElement("div");
      bar.className = "widget-ctrl-bar";
      bar.innerHTML = `
        <div class="drag-handle" title="Click and drag to reposition widget">⠿ DRAG</div>
        <div class="span-ctrls" title="Change column width">
          <button type="button" class="btn-span" data-span="span2">XS</button>
          <button type="button" class="btn-span" data-span="span3">S</button>
          <button type="button" class="btn-span" data-span="span4">M</button>
          <button type="button" class="btn-span" data-span="span6">HALF</button>
          <button type="button" class="btn-span" data-span="span8">L</button>
          <button type="button" class="btn-span" data-span="span9">XL</button>
          <button type="button" class="btn-span" data-span="span12">FULL</button>
        </div>
        <div class="zoom-ctrls" title="Zoom/Scale content (or Ctrl + Scroll / Pinch)">
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

      // Add interactive bottom-right corner resize handle
      const corner = document.createElement("div");
      corner.className = "resize-corner-handle";
      corner.title = "Drag corner to fluidly resize width and height";
      corner.innerHTML = "◢";
      w.appendChild(corner);

      // Freeform Corner Drag-to-Resize Logic (Horizontal width + Vertical height)
      let startX = 0, startY = 0, startWidth = 0, startHeight = 0;
      corner.addEventListener("mousedown", (e) => {
        e.preventDefault();
        startX = e.clientX;
        startY = e.clientY;
        startWidth = w.offsetWidth;
        startHeight = w.offsetHeight;

        const onMouseMove = (moveEv) => {
          const dx = moveEv.clientX - startX;
          const dy = moveEv.clientY - startY;

          // Freeform horizontal resizing (updates grid column span)
          const gridWidth = grid.offsetWidth;
          const colWidth = gridWidth / 12;
          const newWidth = Math.max(140, startWidth + dx);
          const approxSpan = Math.max(1, Math.min(12, Math.round(newWidth / colWidth)));
          currentLayout.spans[id] = `span${approxSpan}`;

          // Freeform vertical resizing (updates tile height to any pixel size!)
          const newHeight = Math.max(100, Math.round(startHeight + dy));
          if (!currentLayout.heights) currentLayout.heights = {};
          currentLayout.heights[id] = newHeight;

          saveLayoutState();
          applyLayout();
        };

        const onMouseUp = () => {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });
    }

    // Pinch / Mouse Wheel Zoom handler (Ctrl + Scroll or Pinch gesture)
    w.addEventListener("wheel", (e) => {
      if (e.ctrlKey || isEditMode) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.05 : -0.05;
        setScale(id, delta);
      }
    }, { passive: false });

    // Touch Pinch Zoom Handler
    let touchDist = 0;
    w.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        touchDist = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY
        );
      }
    });

    w.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2) {
        const curDist = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY
        );
        if (touchDist > 0) {
          const delta = (curDist - touchDist) / 200;
          setScale(id, delta);
          touchDist = curDist;
        }
      }
    });

    // ---- Smooth Mouse-Based Drag & Drop Reordering ----
    const dragHandle = w.querySelector(".drag-handle");
    if (dragHandle) {
      dragHandle.addEventListener("mousedown", (e) => {
        if (!isEditMode) return;
        e.preventDefault();
        draggedWidgetId = id;
        w.classList.add("dragging");

        // Create a ghost clone that follows the mouse
        const ghost = w.cloneNode(true);
        ghost.id = "drag-ghost";
        ghost.style.cssText = `
          position: fixed; z-index: 9999; pointer-events: none;
          width: ${w.offsetWidth}px; opacity: 0.7;
          border: 2px solid var(--accent); border-radius: 8px;
          box-shadow: 0 0 30px rgba(0, 229, 255, 0.3);
          transition: none;
        `;
        ghost.style.left = `${e.clientX - 60}px`;
        ghost.style.top = `${e.clientY - 20}px`;
        document.body.appendChild(ghost);

        // Create the insertion line marker
        let marker = document.getElementById("drop-marker");
        if (!marker) {
          marker = document.createElement("div");
          marker.id = "drop-marker";
          document.body.appendChild(marker);
        }
        marker.style.display = "none";

        let dropTargetId = null;
        let dropAfter = false;

        const onMouseMove = (moveEv) => {
          ghost.style.left = `${moveEv.clientX - 60}px`;
          ghost.style.top = `${moveEv.clientY - 20}px`;

          const allWidgets = Array.from(grid.querySelectorAll(".widget-wrapper"));

          // Primary: find widget directly under cursor using elementFromPoint
          let hitWidget = null;
          ghost.style.display = "none"; // temporarily hide ghost so it doesn't block
          const elUnder = document.elementFromPoint(moveEv.clientX, moveEv.clientY);
          ghost.style.display = "";
          if (elUnder) {
            hitWidget = elUnder.closest(".widget-wrapper");
            if (hitWidget && (hitWidget.id === id || !grid.contains(hitWidget))) hitWidget = null;
          }

          // Fallback: find closest widget by 2D center distance
          if (!hitWidget) {
            let closestDist = Infinity;
            for (const target of allWidgets) {
              if (target.id === id) continue;
              const rect = target.getBoundingClientRect();
              const cx = rect.left + rect.width / 2;
              const cy = rect.top + rect.height / 2;
              const dist = Math.hypot(moveEv.clientX - cx, moveEv.clientY - cy);
              if (dist < closestDist && dist < 400) {
                closestDist = dist;
                hitWidget = target;
              }
            }
          }

          // Clear all previous indicators
          allWidgets.forEach(t => t.classList.remove("drag-over", "drag-over-top", "drag-over-bottom", "drag-over-left", "drag-over-right"));

          if (hitWidget) {
            dropTargetId = hitWidget.id;
            const rect = hitWidget.getBoundingClientRect();
            const relY = moveEv.clientY - rect.top;
            dropAfter = relY > (rect.height / 2);

            // Show insertion line marker
            marker.style.display = "block";
            marker.style.cssText = `
              position: fixed; z-index: 9998; pointer-events: none;
              left: ${rect.left}px; width: ${rect.width}px;
              height: 4px; background: #00e5ff;
              border-radius: 2px;
              box-shadow: 0 0 12px rgba(0, 229, 255, 0.6);
              top: ${dropAfter ? rect.bottom + 3 : rect.top - 7}px;
            `;

            hitWidget.classList.add("drag-over");
            hitWidget.classList.add(dropAfter ? "drag-over-bottom" : "drag-over-top");
          } else {
            marker.style.display = "none";
            dropTargetId = null;
          }
        };

        const onMouseUp = () => {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
          w.classList.remove("dragging");
          draggedWidgetId = null;

          // Remove ghost and marker
          const g = document.getElementById("drag-ghost");
          if (g) g.remove();
          const m = document.getElementById("drop-marker");
          if (m) m.style.display = "none";

          // Clear all indicators
          document.querySelectorAll(".widget-wrapper").forEach(el =>
            el.classList.remove("drag-over", "drag-over-top", "drag-over-bottom", "drag-over-left", "drag-over-right")
          );

          // Perform the reorder
          if (dropTargetId && dropTargetId !== id) {
            const idxA = currentLayout.order.indexOf(id);
            let idxB = currentLayout.order.indexOf(dropTargetId);
            if (idxA !== -1 && idxB !== -1) {
              currentLayout.order.splice(idxA, 1);
              // Recalculate idxB after removal
              idxB = currentLayout.order.indexOf(dropTargetId);
              if (dropAfter) idxB += 1;
              currentLayout.order.splice(idxB, 0, id);
              saveLayoutState();
              applyLayout();
            }
          }
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });
    }

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

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      document.body.classList.add("immersive-fullscreen");
    }).catch(err => {
      document.body.classList.toggle("immersive-fullscreen");
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
    document.body.classList.remove("immersive-fullscreen");
  }
}

document.addEventListener("fullscreenchange", () => {
  const isFS = !!document.fullscreenElement;
  document.body.classList.toggle("immersive-fullscreen", isFS);
  const btn = document.getElementById("btn-fullscreen");
  if (btn) {
    btn.textContent = isFS ? "✕ EXIT FULLSCREEN" : "⛶ FULLSCREEN";
    btn.classList.toggle("active", isFS);
  }
});

window.addEventListener("load", () => {
  initWidgetControls();
  const fsBtn = document.getElementById("btn-fullscreen");
  if (fsBtn) fsBtn.onclick = toggleFullscreen;
  const editBtn = document.getElementById("btn-edit-layout");
  if (editBtn) editBtn.onclick = toggleEditMode;
  const resetBtn = document.getElementById("btn-reset-layout");
  if (resetBtn) resetBtn.onclick = resetLayout;
});
