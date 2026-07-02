/* Shared UI helpers: Forza-colored class badges and track-condition ribbons. */

const CLASS_LETTERS = ["D", "C", "B", "A", "S1", "S2", "X", "X"];

/* Forza Horizon PI badge colors */
const CLASS_COLORS = {
  D: "#41c7e0",   // light blue
  C: "#f2d21f",   // yellow
  B: "#f7941e",   // orange
  A: "#e63946",   // red
  S1: "#b750e0",  // purple
  S2: "#2f6df6",  // blue
  X: "#37e05c",   // green
};

function classBadge(letter, pi) {
  const color = CLASS_COLORS[letter] || "#7b8794";
  return `<span class="class-badge">` +
    `<span class="cls" style="background:${color}">${letter}</span>` +
    `<span class="pi">${pi ?? "–"}</span></span>`;
}

const CONDITION_META = {
  dry: ["☀️", "Dry"],
  wet: ["🌧️", "Wet"],
  snow: ["❄️", "Snow"],
  dirt: ["🟤", "Dirt"],
};

function condBadge(cond) {
  const [icon, label] = CONDITION_META[cond] || CONDITION_META.dry;
  return `<span class="cond-badge cond-${cond}">${icon} ${label}</span>`;
}

/* course/track type is not in the packet - manual tag like snow/dirt */
const TRACK_META = {
  road: ["🛣️", "Road"],
  street: ["🏙️", "Street"],
  dirt: ["🟫", "Dirt"],
  cross: ["🏞️", "Cross-Country"],
  drag: ["🏁", "Drag"],
};

function trackBadge(type) {
  const [icon, label] = TRACK_META[type] || TRACK_META.road;
  return `<span class="cond-badge track-${type}">${icon} ${label}</span>`;
}

/* DrivetrainType is in every packet: 0=FWD 1=RWD 2=AWD */
const DRIVETRAINS = ["FWD", "RWD", "AWD"];

function dtBadge(dt) {
  return `<span class="dt-badge dt-${dt}">${dt}</span>`;
}
