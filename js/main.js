mapboxgl.accessToken = "pk.eyJ1IjoianN1MyIsImEiOiJjbWhlZW45ZTcwZGR4Mm1wd2FoNmc1eGx4In0.1uDkRhqn0WIQeUtnhvLPOA";

const DATA_URL = "data/SDOT_Collisions_All_Years_873625411694151011.geojson";

let fullData = null;
let chart = null;

const startInput = document.getElementById("startDate");
const endInput = document.getElementById("endDate");
const severitySelect = document.getElementById("severity");
const resetBtn = document.getElementById("resetBtn");

// Default to 2025 (you can change anytime in the UI)
startInput.value = "2025-01-01";
endInput.value = "2025-12-31";

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/light-v11",
  center: [-122.335167, 47.608013],
  zoom: 11
});

map.addControl(new mapboxgl.NavigationControl(), "top-left");

// ---------- helpers ----------
function n(x) {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}

// INCDATE in your export looks like: "Wed, 12 Jun 2024 00:00:00 GMT"
function parseIncDate(p) {
  const s = p && p.INCDATE ? String(p.INCDATE) : "";
  if (!s) return null;

  // Works in modern browsers for RFC1123 strings
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateOnlyISO(d) {
  return d.toISOString().slice(0, 10);
}

function severityCode(p) {
  return p && p.SEVERITYCODE != null ? String(p.SEVERITYCODE).trim() : "";
}

function severityWeight(p) {
  // severity proxy for proportional symbols
  return n(p.INJURIES) + n(p.SERIOUSINJURIES) + n(p.FATALITIES);
}

function formatInt(x) {
  return Intl.NumberFormat().format(x);
}

// ---------- filtering ----------
function getFilteredFeatures() {
  if (!fullData) return [];

  const start = startInput.value ? new Date(startInput.value + "T00:00:00") : null;
  const end = endInput.value ? new Date(endInput.value + "T23:59:59") : null;
  const sev = severitySelect.value;

  return (fullData.features || []).filter(f => {
    const p = f.properties || {};
    const d = parseIncDate(p);

    if (start && d && d < start) return false;
    if (end && d && d > end) return false;

    const s = severityCode(p);
    if (sev !== "ALL" && s !== sev) return false;

    return true;
  });
}

// ---------- KPI + chart ----------
function updateKPIs(features) {
  let injuries = 0;
  let fatalities = 0;

  for (const f of features) {
    const p = f.properties || {};
    injuries += n(p.INJURIES);
    fatalities += n(p.FATALITIES);
  }

  document.getElementById("kpiCollisions").textContent = formatInt(features.length);
  document.getElementById("kpiInjuries").textContent = formatInt(injuries);
  document.getElementById("kpiFatalities").textContent = formatInt(fatalities);
}

function groupByDay(features) {
  const m = new Map();

  for (const f of features) {
    const p = f.properties || {};
    const d = parseIncDate(p);
    if (!d) continue;

    const day = dateOnlyISO(d);
    m.set(day, (m.get(day) || 0) + 1);
  }

  const arr = Array.from(m.entries()).map(([date, count]) => ({ date, count }));
  arr.sort((a, b) => a.date.localeCompare(b.date));
  return arr;
}

function updateChart(features) {
  const byDay = groupByDay(features);

  const x = ["x", ...byDay.map(d => d.date)];
  const y = ["collisions", ...byDay.map(d => d.count)];

  if (!chart) {
    chart = c3.generate({
      bindto: "#chart",
      data: { x: "x", columns: [x, y], type: "area" },
      axis: {
        x: { type: "timeseries", tick: { format: "%Y-%m-%d", rotate: 45 } },
        y: { label: "Count" }
      },
      point: { show: false }
    });
  } else {
    chart.load({ columns: [x, y] });
  }
}

// ---------- map ----------
function ensureMapLayer() {
  if (map.getSource("collisions")) return;

  map.addSource("collisions", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] }
  });

  map.addLayer({
    id: "collisions-circles",
    type: "circle",
    source: "collisions",
    paint: {
      "circle-opacity": 0.65,
      "circle-stroke-color": "#111",
      "circle-stroke-width": 0.5,

      // radius based on severityWeight = INJURIES + SERIOUSINJURIES + FATALITIES
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["+",
          ["to-number", ["coalesce", ["get", "INJURIES"], 0]],
          ["to-number", ["coalesce", ["get", "SERIOUSINJURIES"], 0]],
          ["to-number", ["coalesce", ["get", "FATALITIES"], 0]]
        ],
        0, 2,
        1, 5,
        3, 9,
        6, 14,
        10, 18
      ],

      // color by SEVERITYCODE
      "circle-color": [
        "match",
        ["to-string", ["coalesce", ["get", "SEVERITYCODE"], ""]],
        "3", "#7a0019",
        "2b", "#b03060",
        "2", "#ff7f50",
        "1", "#1f77b4",
        "#999999"
      ]
    }
  });

  map.on("click", "collisions-circles", (e) => {
    const f = e.features && e.features[0];
    if (!f) return;

    const p = f.properties || {};
    const d = parseIncDate(p);
    const day = d ? dateOnlyISO(d) : "";

    const title = p.COLLISIONTYPE || "Collision";
    const loc = p.LOCATION || "";
    const sev = severityCode(p);

    const injuries = n(p.INJURIES);
    const serious = n(p.SERIOUSINJURIES);
    const fat = n(p.FATALITIES);

    new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`
        <div style="font-size:13px; line-height:1.3;">
          <div><b>${title}</b></div>
          <div>Date: ${day}</div>
          <div>Severity: ${sev} (${p.SEVERITYDESC || ""})</div>
          <div>Injuries: ${injuries} | Serious: ${serious} | Fatalities: ${fat}</div>
          <div style="color:#666; margin-top:6px;">${loc}</div>
        </div>
      `)
      .addTo(map);
  });

  map.on("mouseenter", "collisions-circles", () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", "collisions-circles", () => (map.getCanvas().style.cursor = ""));
}

function render() {
  if (!fullData) return;

  const features = getFilteredFeatures();
  const fc = { type: "FeatureCollection", features };

  ensureMapLayer();
  map.getSource("collisions").setData(fc);

  updateKPIs(features);
  updateChart(features);
}

// ---------- boot ----------
async function loadData() {
  const res = await fetch(DATA_URL);
  fullData = await res.json();
  render();
}

map.on("load", () => {
  loadData();
});

[startInput, endInput, severitySelect].forEach(el => {
  el.addEventListener("change", render);
});

resetBtn.addEventListener("click", () => {
  severitySelect.value = "ALL";
  startInput.value = "2025-01-01";
  endInput.value = "2025-12-31";
  render();
  map.flyTo({ center: [-122.335167, 47.608013], zoom: 11 });
});
