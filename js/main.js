mapboxgl.accessToken = "YOUR_MAPBOX_TOKEN_HERE";

// --- Data source (Socrata / SODA) ---
// Dataset: SDOT Collisions All Years (qdnv-25h8). :contentReference[oaicite:2]{index=2}
// We request GeoJSON output so Mapbox can load it directly.
function buildSocrataUrl({ startISO, endISO, severity }) {
  const base = "https://data.seattle.gov/resource/qdnv-25h8.geojson";
  const whereParts = [];

  // Date filter
  if (startISO && endISO) {
    // incdate is a date field in the SDOT schema. :contentReference[oaicite:3]{index=3}
    whereParts.push(`incdate between '${startISO}' and '${endISO}'`);
  }

  // Severity filter (3, 2b, 2, 1, 0)
  if (severity && severity !== "ALL") {
    // SEVERITYCODE exists and uses codes like 3, 2b, 2, 1. :contentReference[oaicite:4]{index=4}
    whereParts.push(`severitycode='${severity}'`);
  }

  // Limit: keep it reasonable for a dashboard. You can raise it later.
  const limit = 5000;

  const params = new URLSearchParams();
  params.set("$limit", String(limit));
  if (whereParts.length) params.set("$where", whereParts.join(" AND "));

  return `${base}?${params.toString()}`;
}

// --- Utilities ---
function toISODateString(d) {
  // YYYY-MM-DD
  return d.toISOString().slice(0, 10);
}

function safeNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function formatInt(n) {
  return Intl.NumberFormat().format(n);
}

function groupByDay(features) {
  // returns [{date: 'YYYY-MM-DD', count: N}, ...] sorted
  const m = new Map();
  for (const f of features) {
    const props = f.properties || {};
    const incdate = props.incdate; // should be ISO-ish date string
    if (!incdate) continue;
    const day = String(incdate).slice(0, 10);
    m.set(day, (m.get(day) || 0) + 1);
  }
  const arr = Array.from(m.entries()).map(([date, count]) => ({ date, count }));
  arr.sort((a, b) => a.date.localeCompare(b.date));
  return arr;
}

// --- Map + chart state ---
let chart = null;
let currentGeojson = null;

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/light-v11",
  center: [-122.335167, 47.608013],
  zoom: 11
});

map.addControl(new mapboxgl.NavigationControl(), "top-left");

// Default date range: last 30 days
const endDefault = new Date();
const startDefault = new Date();
startDefault.setDate(endDefault.getDate() - 30);

const startInput = document.getElementById("startDate");
const endInput = document.getElementById("endDate");
const severitySelect = document.getElementById("severity");
const resetBtn = document.getElementById("resetBtn");

startInput.value = toISODateString(startDefault);
endInput.value = toISODateString(endDefault);

async function loadDataAndRender() {
  const startISO = startInput.value ? `${startInput.value}T00:00:00` : null;
  const endISO = endInput.value ? `${endInput.value}T23:59:59` : null;
  const severity = severitySelect.value;

  const url = buildSocrataUrl({ startISO, endISO, severity });

  const res = await fetch(url);
  if (!res.ok) {
    console.error("Failed to load data:", res.status, await res.text());
    alert("Data load failed. If Socrata blocks anonymous GeoJSON, download a GeoJSON/CSV snapshot and host it in /data.");
    return;
  }

  const geojson = await res.json();
  currentGeojson = geojson;

  updateMapSource(geojson);
  updateKPIs(geojson);
  updateChart(geojson);
}

function updateMapSource(geojson) {
  if (map.getSource("collisions")) {
    map.getSource("collisions").setData(geojson);
    return;
  }

  map.addSource("collisions", { type: "geojson", data: geojson });

  // Proportional circles: radius based on injuries + fatalities (severity proxy)
  map.addLayer({
    id: "collisions-circles",
    type: "circle",
    source: "collisions",
    paint: {
      "circle-opacity": 0.65,
      "circle-stroke-color": "#111",
      "circle-stroke-width": 0.5,

      // radius from 2 to 18 depending on (injuries + fatalities)
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["+", ["to-number", ["get", "injuries"], 0], ["to-number", ["get", "fatalities"], 0]],
        0, 2,
        1, 5,
        3, 9,
        6, 14,
        10, 18
      ],

      // color by severity code (3,2b,2,1,0) :contentReference[oaicite:5]{index=5}
      "circle-color": [
        "match",
        ["get", "severitycode"],
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
    new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`
        <div style="font-size:13px;">
          <div><b>${p.collisiontype || "Collision"}</b></div>
          <div>Date: ${String(p.incdate || "").slice(0,10)}</div>
          <div>Severity: ${p.severitycode || ""}</div>
          <div>Injuries: ${p.injuries || 0} | Fatalities: ${p.fatalities || 0}</div>
          <div style="color:#666; margin-top:6px;">${p.location || ""}</div>
        </div>
      `)
      .addTo(map);
  });

  map.on("mouseenter", "collisions-circles", () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", "collisions-circles", () => (map.getCanvas().style.cursor = ""));
}

function updateKPIs(geojson) {
  const feats = geojson.features || [];
  let injuries = 0;
  let fatalities = 0;

  for (const f of feats) {
    const p = f.properties || {};
    injuries += safeNumber(p.injuries);
    fatalities += safeNumber(p.fatalities);
  }

  document.getElementById("kpiCollisions").textContent = formatInt(feats.length);
  document.getElementById("kpiInjuries").textContent = formatInt(injuries);
  document.getElementById("kpiFatalities").textContent = formatInt(fatalities);
}

function updateChart(geojson) {
  const feats = geojson.features || [];
  const byDay = groupByDay(feats);

  const x = ["x", ...byDay.map(d => d.date)];
  const y = ["collisions", ...byDay.map(d => d.count)];

  if (!chart) {
    chart = c3.generate({
      bindto: "#chart",
      data: {
        x: "x",
        columns: [x, y],
        type: "area"
      },
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

// --- Events ---
map.on("load", () => {
  loadDataAndRender();
});

[startInput, endInput, severitySelect].forEach(el => {
  el.addEventListener("change", () => loadDataAndRender());
});

resetBtn.addEventListener("click", () => {
  severitySelect.value = "ALL";
  startInput.value = toISODateString(startDefault);
  endInput.value = toISODateString(endDefault);
  loadDataAndRender();

  map.flyTo({ center: [-122.335167, 47.608013], zoom: 11 });
});
