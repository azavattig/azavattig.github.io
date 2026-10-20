// Pavind demo: replays saved solver output (data/pavind/*.json, produced by
// tools/export_pavind.py) on a Leaflet map with KPI tiles, a km-per-truck bar
// chart, a shift timeline, truck-breakdown re-plans and a five-day comparison.
// Routes follow road geometry stored with the data. Nothing is solved here.
(function () {
  const DATA_DIR = "data/pavind/";
  const SVG_NS = "http://www.w3.org/2000/svg";

  const VEHICLE_TYPES = {
    skip_lorry: { label: "Skip lorry", colorVar: "--viz-1" },
    suction_tanker: { label: "Suction tanker", colorVar: "--viz-2" },
    sludge_truck: { label: "Sludge truck", colorVar: "--viz-3" },
    road_sweeper: { label: "Road sweeper", colorVar: "--viz-night" },
  };
  const JOB_LABELS = {
    skip_pickup: "Skip pickup",
    suction: "Suction",
    sludge_transport: "Sludge transport",
    highway_cleaning: "Motorway cleaning",
  };
  const PLAN_LABELS = { optimizer: "Optimizer", baseline: "Dispatcher baseline" };
  const EVENT_LABELS = {
    pre_shift_coffee: "Coffee before the shift",
    coffee: "Coffee break",
    lunch: "Lunch",
    night_break: "Night break",
    unload: "Unloading at the yard",
  };

  // breakdown: { vehicle, time } while a breakdown scenario is shown.
  // isolated: vehicle id shown alone on the map, or null for all trucks.
  const state = { seed: null, plan: "optimizer", shift: "day", breakdown: null, breakdownTime: 600, isolated: null };
  const days = new Map();
  let index = [];

  const tooltip = document.getElementById("tooltip");
  const isDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches &&
    document.documentElement.dataset.theme !== "light";

  // ---- helpers -------------------------------------------------------------

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function typeColor(vehicleType) {
    return cssVar(VEHICLE_TYPES[vehicleType].colorVar);
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // Minutes from 00:00 of the service day; night shifts run past 1440.
  function clock(minutes) {
    const dayMinutes = ((minutes % 1440) + 1440) % 1440;
    const h = String(Math.floor(dayMinutes / 60)).padStart(2, "0");
    const m = String(dayMinutes % 60).padStart(2, "0");
    return `${h}:${m}`;
  }

  function formatNumber(value, digits = 0) {
    return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function signed(value, digits = 0, unit = "") {
    const rounded = Number(value.toFixed(digits));
    const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "±";
    return `${sign}${formatNumber(Math.abs(rounded), digits)}${unit ? " " + unit : ""}`;
  }

  function plural(count, word) {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
  }

  // Google encoded-polyline format (precision 5), as written by tools/osrm.py.
  function decodePolyline(encoded) {
    const points = [];
    let index = 0;
    let lat = 0;
    let lon = 0;
    while (index < encoded.length) {
      for (const axis of ["lat", "lon"]) {
        let shift = 0;
        let result = 0;
        let byte;
        do {
          byte = encoded.charCodeAt(index++) - 63;
          result |= (byte & 0x1f) << shift;
          shift += 5;
        } while (byte >= 0x20);
        const delta = result & 1 ? ~(result >> 1) : result >> 1;
        if (axis === "lat") lat += delta;
        else lon += delta;
      }
      points.push([lat / 1e5, lon / 1e5]);
    }
    return points;
  }

  // Road geometry for a route's node path (e.g. ["D", "J010", ..., "D"]).
  function roadPoints(day, path) {
    const points = [];
    for (let i = 0; i < path.length - 1; i++) {
      const encoded = day.legs[`${path[i]}>${path[i + 1]}`];
      if (!encoded) throw new Error(`Pavind demo: missing road leg ${path[i]}>${path[i + 1]}`);
      const leg = decodePolyline(encoded);
      points.push(...(points.length ? leg.slice(1) : leg));
    }
    return points;
  }

  function svgEl(name, attrs = {}, parent) {
    const el = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    if (parent) parent.appendChild(el);
    return el;
  }

  function showTooltip(html, event) {
    tooltip.innerHTML = html;
    tooltip.hidden = false;
    const pad = 14;
    const { width, height } = tooltip.getBoundingClientRect();
    let x = event.clientX + pad;
    let y = event.clientY + pad;
    if (x + width > window.innerWidth - 8) x = event.clientX - width - pad;
    if (y + height > window.innerHeight - 8) y = event.clientY - height - pad;
    tooltip.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
  }

  function hideTooltip() {
    tooltip.hidden = true;
  }

  function bindTooltip(el, html) {
    el.addEventListener("pointerenter", (event) => showTooltip(html, event));
    el.addEventListener("pointermove", (event) => showTooltip(html, event));
    el.addEventListener("pointerleave", hideTooltip);
  }

  async function fetchJson(file) {
    // "no-cache" revalidates with the server, so a re-export shows up without a hard refresh.
    const response = await fetch(DATA_DIR + file, { cache: "no-cache" });
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
    return response.json();
  }

  async function loadDay(seed) {
    if (!days.has(seed)) {
      const entry = index.find((day) => day.seed === seed);
      days.set(seed, await fetchJson(entry.file));
    }
    return days.get(seed);
  }

  // ---- derived numbers -----------------------------------------------------

  function shiftRoutes(day, plan) {
    return day.plans[plan].routes.filter((route) => route.shift === state.shift);
  }

  function activeScenario(day) {
    if (!state.breakdown) return null;
    return day.breakdowns.find((s) => s.vehicle === state.breakdown.vehicle && s.time === state.breakdown.time) || null;
  }

  function activeRoutes(day) {
    const scenario = activeScenario(day);
    return scenario ? scenario.routes : shiftRoutes(day, state.plan);
  }

  function statsFor(day, routes) {
    const stops = routes.flatMap((route) => route.stops);
    const shiftJobs = day.jobs.filter((job) => job.shift === state.shift).length;
    return {
      km: routes.reduce((sum, route) => sum + route.km, 0),
      trucks: routes.length,
      late: stops.filter((stop) => stop.lateMin > 0).length,
      overtimeHours: routes.reduce((sum, route) => sum + route.overtimeMin, 0) / 60,
      unserved: shiftJobs - stops.length,
    };
  }

  // ---- KPI tiles -----------------------------------------------------------

  function renderKpis(day) {
    const scenario = activeScenario(day);
    const other = state.plan === "optimizer" ? "baseline" : "optimizer";
    const current = statsFor(day, activeRoutes(day));
    const compare = statsFor(day, shiftRoutes(day, scenario ? "optimizer" : other));
    const versus = scenario ? "original plan" : PLAN_LABELS[other].toLowerCase();
    const tiles = [
      { label: "Total km", value: formatNumber(current.km), delta: signed(current.km - compare.km, 0, "km") },
      { label: "Trucks used", value: current.trucks, delta: signed(current.trucks - compare.trucks) },
      { label: "Late jobs", value: current.late, delta: signed(current.late - compare.late) },
      { label: "Overtime", value: `${formatNumber(current.overtimeHours, 1)} h`, delta: signed(current.overtimeHours - compare.overtimeHours, 1, "h") },
    ];
    const container = document.getElementById("kpis");
    container.replaceChildren(...tiles.map((tile) => {
      const el = document.createElement("div");
      el.className = "pv-kpi";
      el.innerHTML = `<span class="pv-kpi__label">${tile.label}</span>
        <span class="pv-kpi__value">${tile.value}</span>
        <span class="pv-kpi__delta">${escapeHtml(`${tile.delta} vs ${versus}`)}</span>`;
      return el;
    }));
    if (current.unserved > 0) {
      const note = document.createElement("p");
      note.className = "pv-kpi-note";
      note.textContent = `${plural(current.unserved, "job")} could not fit any truck in this plan.`;
      container.appendChild(note);
    }
  }

  // ---- breakdown report ----------------------------------------------------

  function renderReport(day) {
    const report = document.getElementById("bd-report");
    const scenario = activeScenario(day);
    report.hidden = !scenario;
    if (!scenario) return;
    const jobsById = new Map(day.jobs.map((job) => [job.id, job]));
    const original = statsFor(day, shiftRoutes(day, "optimizer"));
    const after = statsFor(day, scenario.routes);
    const originalTrucks = new Set(shiftRoutes(day, "optimizer").map((route) => route.vehicle));
    const spares = scenario.routes.filter((route) => !originalTrucks.has(route.vehicle)).map((route) => route.vehicle);
    const where = scenario.stuckAt === "D" ? "before leaving the depot" : `at ${jobsById.get(scenario.stuckAt).location}`;
    const missed = scenario.brokenRemaining.length;
    const swapped = scenario.reassigned.filter((job) => !scenario.brokenRemaining.includes(job)).length;
    const swapText = swapped > 0 ? ` (and ${plural(swapped, "other job")} swapped between trucks to make room)` : "";
    const spareText = spares.length ? `, including spare ${spares.length === 1 ? "truck" : "trucks"} ${spares.join(", ")} from the depot` : "";
    const unservedText = after.unserved > 0 ? ` ${plural(after.unserved, "job")} still could not be covered.` : "";
    report.innerHTML = `<strong>${escapeHtml(scenario.vehicle)} broke down at ${clock(scenario.time)} ${escapeHtml(where)}.</strong>
      Without a re-plan, ${plural(missed, "job")} would be missed.
      OR-Tools re-planned the rest of the day in ${formatNumber(scenario.solveSeconds, 1)} s: its jobs went to other trucks${spareText}${swapText}.
      Result: ${signed(after.km - original.km, 0, "km")}, ${plural(after.late, "late job")} and ${formatNumber(after.overtimeHours, 1)} h of overtime.${unservedText}`;
  }

  // ---- map -----------------------------------------------------------------

  let map = null;
  let routeLayer = null;
  let tileLayer = null;

  function ensureMap() {
    if (map) return;
    map = L.map("map", { scrollWheelZoom: false, zoomSnap: 0.25 });
    routeLayer = L.layerGroup().addTo(map);
    setTiles();
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      setTiles();
      render();
    });
  }

  // Esri gray canvas basemap (no API key; attribution required), plus its label layer.
  function setTiles() {
    if (tileLayer) tileLayer.remove();
    const tone = isDark() ? "Dark" : "Light";
    const base = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
    const options = { maxZoom: 14, attribution: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors" };
    tileLayer = L.layerGroup([
      L.tileLayer(`${base}/World_${tone}_Gray_Base/MapServer/tile/{z}/{y}/{x}`, options),
      L.tileLayer(`${base}/World_${tone}_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 14 }),
    ]).addTo(map);
  }

  function stopTooltip(job, stop, scenario, originalVehicle) {
    const late = stop.lateMin > 0 ? `<br><strong class="is-late">! Late by ${stop.lateMin} min</strong>` : "";
    const moved = scenario && stop.reassigned ? `<br><strong>Reassigned from ${escapeHtml(originalVehicle.get(job.id))}</strong>` : "";
    return `<strong>${escapeHtml(job.location)}</strong><br>${JOB_LABELS[job.type]} · ${job.id}<br>
      Window ${clock(job.open)}–${clock(job.close)}<br>Served ${clock(stop.start)}–${clock(stop.end)}${late}${moved}`;
  }

  // Each truck = type color + its own line style, so trucks of one type stay
  // distinguishable without relying on near-identical shades.
  const TRUCK_DASHES = [null, "16 8", "6 7", "1 8", "14 6 2 6"];
  const BROKEN_DASH = "6 8";

  function truckDash(vehicle) {
    const number = Number(vehicle.split("-")[1]) || 1;
    return TRUCK_DASHES[(number - 1) % TRUCK_DASHES.length];
  }

  function lineStyle(route) {
    if (route.broken) return { color: cssVar("--card-muted"), dashArray: BROKEN_DASH };
    return { color: typeColor(route.vehicleType), dashArray: truckDash(route.vehicle) };
  }

  // Map labels sit on the stop farthest from the depot, where routes spread out.
  function labelPoint(day, route, jobsById) {
    if (!route.stops.length) return null;
    let far = null;
    let farDistance = -1;
    for (const stop of route.stops) {
      const job = jobsById.get(stop.job);
      const distance = Math.hypot(job.lat - day.depot.lat, job.lon - day.depot.lon);
      if (distance > farDistance) {
        far = job;
        farDistance = distance;
      }
    }
    return [far.lat, far.lon];
  }

  function renderMap(day, shouldFit) {
    ensureMap();
    routeLayer.clearLayers();
    const scenario = activeScenario(day);
    const routes = activeRoutes(day);
    if (state.isolated && !routes.some((route) => route.vehicle === state.isolated)) state.isolated = null;
    const jobsById = new Map(day.jobs.map((job) => [job.id, job]));
    const originalVehicle = new Map(day.plans.optimizer.routes.flatMap((route) => route.stops.map((stop) => [stop.job, route.vehicle])));
    const depot = [day.depot.lat, day.depot.lon];
    const surface = cssVar("--card");
    const ink = cssVar("--card-ink");
    const critical = cssVar("--status-critical");
    const lines = [];
    const bounds = L.latLngBounds([depot]);

    for (const route of routes) {
      const isDimmed = Boolean(state.isolated && state.isolated !== route.vehicle);
      const { color, dashArray } = lineStyle(route);
      const points = roadPoints(day, route.path);
      if (!isDimmed) points.forEach((point) => bounds.extend(point));
      const style = { color, dashArray, weight: 4, opacity: isDimmed ? 0.12 : 0.9 };
      const line = L.polyline(points, { ...style, lineJoin: "round", lineCap: "round" }).addTo(routeLayer);
      const label = route.broken ? "broke down" : `${route.stops.length} stops · ${clock(route.depart)}–${clock(route.back)}`;
      line.bindTooltip(`<strong>${route.vehicle}</strong> · ${VEHICLE_TYPES[route.vehicleType].label}<br>
        ${formatNumber(route.km, 1)} km · ${label}`, { sticky: true });
      line.baseStyle = style;
      lines.push(line);
      if (!state.isolated) {
        line.on("mouseover", () => lines.forEach((other) => other.setStyle(other === line ? { weight: 7, opacity: 1 } : { opacity: 0.2 })));
        line.on("mouseout", () => lines.forEach((other) => other.setStyle(other.baseStyle)));
      }

      for (const stop of route.stops) {
        const job = jobsById.get(stop.job);
        const isLate = stop.lateMin > 0;
        const isMoved = Boolean(scenario && stop.reassigned);
        L.circleMarker([job.lat, job.lon], {
          radius: isLate || isMoved ? 8 : 6,
          color: isLate ? critical : isMoved ? ink : surface,
          weight: isLate || isMoved ? 3 : 2,
          fillColor: color,
          fillOpacity: isDimmed ? 0.15 : 1,
          opacity: isDimmed ? 0.15 : 1,
        }).bindTooltip(stopTooltip(job, stop, scenario, originalVehicle)).addTo(routeLayer);
      }

      const at = labelPoint(day, route, jobsById);
      if (at && !isDimmed) {
        L.marker(at, {
          icon: L.divIcon({
            className: "pv-truck-tag",
            html: `<span style="--tag: ${color}">${escapeHtml(route.vehicle)}</span>`,
            iconSize: [64, 20],
            iconAnchor: [-6, 24],
          }),
          keyboard: false,
          interactive: false,
        }).addTo(routeLayer);
      }
    }

    if (scenario) {
      const stuck = scenario.stuckAt === "D" ? depot : [jobsById.get(scenario.stuckAt).lat, jobsById.get(scenario.stuckAt).lon];
      L.marker(stuck, {
        icon: L.divIcon({ className: "pv-breakdown-pin", html: `<span>⚠ ${escapeHtml(scenario.vehicle)}</span>`, iconSize: [96, 28], iconAnchor: [48, 36] }),
        keyboard: false,
        zIndexOffset: 1000,
      }).bindTooltip(`${scenario.vehicle} broke down here at ${clock(scenario.time)}`).addTo(routeLayer);
    }

    L.marker(depot, {
      icon: L.divIcon({ className: "pv-depot", html: "<span>Depot</span>", iconSize: [58, 26], iconAnchor: [29, 13] }),
      keyboard: false,
    }).bindTooltip("Sulmona depot: every route starts and ends here").addTo(routeLayer);

    if (shouldFit) map.fitBounds(bounds, { padding: [30, 30] });
  }

  function lineSample(route) {
    const { color, dashArray } = lineStyle(route);
    const dash = dashArray ? ` stroke-dasharray="${dashArray}"` : "";
    return `<svg class="pv-line-sample" viewBox="0 0 34 10" aria-hidden="true"><line x1="3" y1="5" x2="31" y2="5" stroke="${color}" stroke-width="4" stroke-linecap="round"${dash}/></svg>`;
  }

  function renderLegend(day) {
    const scenario = activeScenario(day);
    const routes = [...activeRoutes(day)].sort((a, b) => a.vehicle.localeCompare(b.vehicle, "en", { numeric: true }));
    const legend = document.getElementById("legend");
    legend.replaceChildren(...routes.map((route) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const isIsolated = state.isolated === route.vehicle;
      button.type = "button";
      button.className = "pv-truck-toggle";
      button.setAttribute("aria-pressed", String(isIsolated));
      button.title = isIsolated ? "Show all trucks" : `Show only ${route.vehicle}`;
      button.innerHTML = `${lineSample(route)}${escapeHtml(route.vehicle)}${route.broken ? " (broke down)" : ""}`;
      button.addEventListener("click", () => {
        toggleIsolated(day, route.vehicle);
      });
      item.appendChild(button);
      return item;
    }));
    const types = [...new Set(routes.filter((route) => !route.broken).map((route) => route.vehicleType))];
    const extras = types.map((type) => `<span class="swatch" style="--swatch: ${typeColor(type)}"></span>${VEHICLE_TYPES[type].label}`);
    extras.push('<span class="swatch swatch--late" aria-hidden="true">!</span>Late stop (red ring)');
    if (scenario) extras.push('<span class="swatch swatch--moved" aria-hidden="true"></span>Reassigned job (dark ring)');
    const key = document.createElement("li");
    key.className = "pv-legend__key";
    key.innerHTML = extras.map((html) => `<span>${html}</span>`).join("");
    legend.appendChild(key);
  }

  // ---- km per truck --------------------------------------------------------

  // Show one truck alone on the map (or all again). Shared by the legend,
  // the km bars and the timeline rows.
  function toggleIsolated(day, vehicle) {
    state.isolated = state.isolated === vehicle ? null : vehicle;
    renderMap(day, true);
    renderLegend(day);
    renderKmChart(day);
    renderTimeline(day);
    const mapBox = document.getElementById("map").getBoundingClientRect();
    if (state.isolated && (mapBox.bottom < 80 || mapBox.top > window.innerHeight - 80)) {
      document.getElementById("map").scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  // Makes a chart row act as a button that isolates its truck on the map.
  function makeSelectable(el, day, vehicle) {
    const isSelected = state.isolated === vehicle;
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-pressed", String(isSelected));
    el.setAttribute("aria-label", isSelected ? `Show all trucks` : `Show only ${vehicle} on the map`);
    el.classList.add("pv-selectable");
    if (state.isolated && !isSelected) el.classList.add("is-dimmed");
    el.addEventListener("click", () => toggleIsolated(day, vehicle));
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleIsolated(day, vehicle);
      }
    });
  }

  function renderKmChart(day) {
    const svg = document.getElementById("km-chart");
    svg.replaceChildren();
    const scenario = activeScenario(day);
    const routes = [...activeRoutes(day)].sort((a, b) => b.km - a.km);
    const width = svg.clientWidth || 480;
    const rowHeight = 26;
    const labelWidth = 74;
    const valueWidth = 110;
    const height = routes.length * rowHeight + 8;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("height", height);
    document.getElementById("km-caption").textContent = scenario
      ? `after ${scenario.vehicle} breaks down`
      : `${PLAN_LABELS[state.plan].toLowerCase()}, ${state.shift} shift`;

    const maxKm = Math.max(...routes.map((route) => route.km), 1);
    const plotWidth = width - labelWidth - valueWidth;
    routes.forEach((route, i) => {
      const y = i * rowHeight + 4;
      const barWidth = Math.max(4, (route.km / maxKm) * plotWidth);
      const row = svgEl("g", { class: "pv-hit" }, svg);
      svgEl("rect", { x: 0, y: y - 3, width, height: rowHeight, fill: "transparent" }, row);
      svgEl("text", { x: labelWidth - 10, y: y + 13, class: "pv-axis-label", "text-anchor": "end" }, row).textContent = route.vehicle;
      // Square at the baseline, 4px rounded at the data end.
      const r = Math.min(4, barWidth / 2);
      const x0 = labelWidth;
      const x1 = labelWidth + barWidth;
      svgEl("path", {
        d: `M${x0},${y} H${x1 - r} Q${x1},${y} ${x1},${y + r} V${y + 18 - r} Q${x1},${y + 18} ${x1 - r},${y + 18} H${x0} Z`,
        fill: route.broken ? cssVar("--card-muted") : typeColor(route.vehicleType),
      }, row);
      svgEl("text", { x: x1 + 8, y: y + 13, class: "pv-value-label" }, row)
        .textContent = `${formatNumber(route.km)} km${route.broken ? " (broke down)" : ""}`;
      bindTooltip(row, `<strong>${route.vehicle}</strong> · ${VEHICLE_TYPES[route.vehicleType].label}<br>
        ${formatNumber(route.km, 1)} km · ${route.stops.length} stops · load ${route.load}/${route.capacity}`);
      makeSelectable(row, day, route.vehicle);
    });
  }

  // ---- shift timeline ------------------------------------------------------

  function renderTimeline(day) {
    const svg = document.getElementById("timeline");
    svg.replaceChildren();
    const scenario = activeScenario(day);
    const routes = [...activeRoutes(day)].sort((a, b) => a.depart - b.depart);
    const jobsById = new Map(day.jobs.map((job) => [job.id, job]));
    const originalVehicle = new Map(day.plans.optimizer.routes.flatMap((route) => route.stops.map((stop) => [stop.job, route.vehicle])));
    const shift = day.shifts[state.shift];
    const width = svg.clientWidth || 480;
    const labelWidth = 74;
    const rowHeight = 26;
    const axisHeight = 26;
    const height = routes.length * rowHeight + axisHeight + 8;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("height", height);

    const start = Math.min(shift.start, ...routes.map((route) => route.depart)) - 30;
    const end = Math.max(shift.end, ...routes.map((route) => route.back)) + 30;
    const plotWidth = width - labelWidth - 12;
    const xOf = (minute) => labelWidth + ((minute - start) / (end - start)) * plotWidth;
    const muted = cssVar("--card-muted");
    const ink = cssVar("--card-ink");
    const critical = cssVar("--status-critical");

    // Hour grid every 2 hours.
    for (let minute = Math.ceil(start / 120) * 120; minute <= end; minute += 120) {
      const x = xOf(minute);
      svgEl("line", { x1: x, x2: x, y1: 0, y2: height - axisHeight, class: "pv-grid" }, svg);
      svgEl("text", { x, y: height - 8, class: "pv-axis-label", "text-anchor": "middle" }, svg).textContent = clock(minute);
    }
    const shiftEndX = xOf(shift.end);
    svgEl("line", { x1: shiftEndX, x2: shiftEndX, y1: 0, y2: height - axisHeight, class: "pv-shift-end" }, svg);
    svgEl("text", { x: shiftEndX - 4, y: 10, class: "pv-axis-label", "text-anchor": "end" }, svg).textContent = `shift ends ${clock(shift.end)}`;
    if (scenario) {
      const breakX = xOf(scenario.time);
      svgEl("line", { x1: breakX, x2: breakX, y1: 0, y2: height - axisHeight, class: "pv-breakdown-line" }, svg);
      svgEl("text", { x: breakX + 4, y: 10, class: "pv-axis-label" }, svg).textContent = `breakdown ${clock(scenario.time)}`;
    }

    routes.forEach((route, i) => {
      const y = i * rowHeight + 18;
      const isDimmed = Boolean(state.isolated && state.isolated !== route.vehicle);
      const layer = svgEl("g", { opacity: isDimmed ? 0.25 : 1 }, svg);
      const rowGroup = svgEl("g", {}, layer);
      svgEl("rect", { x: 0, y: y - rowHeight / 2, width: labelWidth, height: rowHeight, fill: "transparent" }, rowGroup);
      svgEl("text", { x: labelWidth - 10, y: y + 4, class: "pv-axis-label", "text-anchor": "end" }, rowGroup).textContent = route.vehicle;
      makeSelectable(rowGroup, day, route.vehicle);
      svgEl("line", { x1: xOf(route.depart), x2: xOf(route.back), y1: y, y2: y, stroke: muted, "stroke-width": 2, "stroke-linecap": "round", "stroke-dasharray": route.broken ? "4 4" : "none" }, layer);
      if (route.broken) {
        svgEl("text", { x: xOf(route.back), y: y + 5, class: "pv-break-mark", "text-anchor": "middle" }, layer).textContent = "✕";
      }
      if (route.back > shift.end) {
        svgEl("line", { x1: shiftEndX, x2: xOf(route.back), y1: y, y2: y, stroke: critical, "stroke-width": 3, "stroke-linecap": "round" }, layer);
      }
      for (const event of route.events || []) {
        const x = xOf(event.start);
        const eventWidth = Math.max(3, xOf(event.end) - x - 2);
        const isUnload = event.kind === "unload";
        const block = svgEl("rect", {
          x, y: y - 5, width: eventWidth, height: 10, rx: 2,
          class: isUnload ? "pv-event pv-event--unload pv-hit" : "pv-event pv-event--break pv-hit",
        }, layer);
        bindTooltip(block, `<strong>${route.vehicle}</strong> · ${EVENT_LABELS[event.kind] || "Break"}<br>
          ${clock(event.start)}–${clock(event.end)} · ${event.end - event.start} min`);
      }
      for (const stop of route.stops) {
        const job = jobsById.get(stop.job);
        const isLate = stop.lateMin > 0;
        const isMoved = Boolean(scenario && stop.reassigned);
        const x = xOf(stop.start);
        const blockWidth = Math.max(4, xOf(stop.end) - x - 2);
        const block = svgEl("rect", {
          x, y: y - 7, width: blockWidth, height: 14, rx: 3,
          fill: typeColor(route.vehicleType),
          stroke: isLate ? critical : isMoved ? ink : "none",
          "stroke-width": isLate || isMoved ? 2 : 0,
          class: "pv-hit",
        }, layer);
        if (isLate) {
          svgEl("text", { x: x + blockWidth / 2, y: y - 10, class: "pv-late-mark", "text-anchor": "middle" }, layer).textContent = "!";
        }
        const moved = isMoved ? `<br><strong>Reassigned from ${escapeHtml(originalVehicle.get(job.id))}</strong>` : "";
        bindTooltip(block, `<strong>${route.vehicle}</strong> at ${escapeHtml(job.location)}<br>${JOB_LABELS[job.type]} · ${clock(stop.start)}–${clock(stop.end)}<br>
          Window ${clock(job.open)}–${clock(job.close)}${isLate ? `<br><strong class="is-late">! Late by ${stop.lateMin} min</strong>` : ""}${moved}`);
      }
    });
  }

  // ---- five-day comparison -------------------------------------------------

  function renderDays() {
    const svg = document.getElementById("days-chart");
    svg.replaceChildren();
    const width = svg.clientWidth || 640;
    const height = 260;
    const left = 48;
    const bottom = 30;
    const top = 26;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("height", height);
    const maxKm = Math.ceil(Math.max(...index.flatMap((day) => [day.optimizer.total_km, day.baseline.total_km])) / 500) * 500;
    const yOf = (km) => top + (1 - km / maxKm) * (height - top - bottom);

    for (let km = 0; km <= maxKm; km += 500) {
      svgEl("line", { x1: left, x2: width, y1: yOf(km), y2: yOf(km), class: "pv-grid" }, svg);
      svgEl("text", { x: left - 8, y: yOf(km) + 4, class: "pv-axis-label", "text-anchor": "end" }, svg).textContent = formatNumber(km);
    }
    const groupWidth = (width - left) / index.length;
    const barWidth = Math.min(46, groupWidth * 0.32);
    index.forEach((day, i) => {
      const center = left + groupWidth * (i + 0.5);
      const bars = [
        { plan: "optimizer", km: day.optimizer.total_km, x: center - barWidth - 1 },
        { plan: "baseline", km: day.baseline.total_km, x: center + 1 },
      ];
      for (const bar of bars) {
        const y = yOf(bar.km);
        const r = 4;
        const x0 = bar.x;
        const x1 = bar.x + barWidth;
        const base = yOf(0);
        const group = svgEl("g", { class: "pv-hit" }, svg);
        svgEl("path", {
          d: `M${x0},${base} V${y + r} Q${x0},${y} ${x0 + r},${y} H${x1 - r} Q${x1},${y} ${x1},${y + r} V${base} Z`,
          fill: cssVar(bar.plan === "optimizer" ? "--viz-optimizer" : "--viz-baseline"),
        }, group);
        bindTooltip(group, `<strong>Day ${i + 1}</strong> · ${PLAN_LABELS[bar.plan]}<br>${formatNumber(bar.km)} km · ${day[bar.plan].late_jobs} late jobs · ${formatNumber(day[bar.plan].overtime_hours, 1)} h overtime`);
      }
      const saving = (1 - day.optimizer.total_km / day.baseline.total_km) * 100;
      svgEl("text", { x: center, y: yOf(Math.max(day.optimizer.total_km, day.baseline.total_km)) - 8, class: "pv-value-label", "text-anchor": "middle" }, svg)
        .textContent = `${saving >= 0 ? "−" : "+"}${formatNumber(Math.abs(saving))}%`;
      svgEl("text", { x: center, y: height - 8, class: "pv-axis-label", "text-anchor": "middle" }, svg).textContent = `Day ${i + 1}`;
    });
  }

  function renderDaysSummary() {
    const savings = index.map((day) => 1 - day.optimizer.total_km / day.baseline.total_km);
    const average = (savings.reduce((a, b) => a + b, 0) / savings.length) * 100;
    const lateBase = index.reduce((sum, day) => sum + day.baseline.late_jobs, 0);
    const lateOpt = index.reduce((sum, day) => sum + day.optimizer.late_jobs, 0);
    const overtimeBase = index.reduce((sum, day) => sum + day.baseline.overtime_hours, 0);
    const overtimeOpt = index.reduce((sum, day) => sum + day.optimizer.overtime_hours, 0);
    document.getElementById("days-summary").textContent =
      `On these synthetic days the optimizer drives about ${formatNumber(average)}% fewer km on average. ` +
      `It has ${lateOpt} late jobs and ${formatNumber(overtimeOpt, 1)} h of overtime, against ${lateBase} late jobs and ` +
      `${formatNumber(overtimeBase, 1)} h for the baseline.`;

    const table = document.getElementById("days-table");
    const rows = index.map((day, i) => `<tr><th scope="row">Day ${i + 1}</th>
      <td>${formatNumber(day.optimizer.total_km)}</td><td>${formatNumber(day.baseline.total_km)}</td>
      <td>${day.optimizer.late_jobs} / ${day.baseline.late_jobs}</td>
      <td>${formatNumber(day.optimizer.overtime_hours, 1)} / ${formatNumber(day.baseline.overtime_hours, 1)}</td>
      <td>${day.optimizer.vehicles_used} / ${day.baseline.vehicles_used}</td></tr>`).join("");
    table.innerHTML = `<thead><tr><th scope="col">Day</th><th scope="col">Km optimizer</th><th scope="col">Km baseline</th>
      <th scope="col">Late jobs (opt / base)</th><th scope="col">Overtime h (opt / base)</th><th scope="col">Trucks (opt / base)</th></tr></thead>
      <tbody>${rows}</tbody>`;
  }

  // ---- controls ------------------------------------------------------------

  function setChecked(group, attribute, value) {
    group.querySelectorAll("button").forEach((button) => {
      button.setAttribute("aria-checked", String(button.dataset[attribute] === String(value)));
    });
  }

  function buildDayPicker() {
    const picker = document.getElementById("day-picker");
    picker.replaceChildren(...index.map((day, i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "radio");
      button.dataset.seed = day.seed;
      button.textContent = `Day ${i + 1}`;
      return button;
    }));
  }

  function buildBreakdownControls(day) {
    const select = document.getElementById("bd-truck");
    const previous = select.value;
    const trucks = [...new Set(day.breakdowns.map((s) => s.vehicle))].sort();
    select.replaceChildren(...trucks.map((vehicle) => {
      const option = document.createElement("option");
      option.value = vehicle;
      const route = day.plans.optimizer.routes.find((r) => r.vehicle === vehicle);
      option.textContent = `${vehicle} · ${VEHICLE_TYPES[route.vehicleType].label}`;
      return option;
    }));
    if (trucks.includes(previous)) select.value = previous;
    syncBreakdownTimes(day);
  }

  // Disable times at which the chosen truck has already finished its jobs.
  function syncBreakdownTimes(day) {
    const vehicle = document.getElementById("bd-truck").value;
    const picker = document.getElementById("bd-time");
    const available = new Set(day.breakdowns.filter((s) => s.vehicle === vehicle).map((s) => s.time));
    picker.querySelectorAll("button").forEach((button) => {
      button.disabled = !available.has(Number(button.dataset.time));
    });
    if (!available.has(state.breakdownTime) && available.size) state.breakdownTime = Math.min(...available);
    setChecked(picker, "time", state.breakdownTime);
  }

  function clearBreakdown() {
    state.breakdown = null;
    document.getElementById("bd-reset").hidden = true;
  }

  function wireControls() {
    const dayPicker = document.getElementById("day-picker");
    const planPicker = document.getElementById("plan-picker");
    const shiftPicker = document.getElementById("shift-picker");
    const timePicker = document.getElementById("bd-time");

    dayPicker.addEventListener("click", async (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      state.seed = Number(button.dataset.seed);
      setChecked(dayPicker, "seed", state.seed);
      clearBreakdown();
      await render(true);
      buildBreakdownControls(days.get(state.seed));
    });
    planPicker.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      state.plan = button.dataset.plan;
      setChecked(planPicker, "plan", state.plan);
      clearBreakdown();
      render(false);
    });
    shiftPicker.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      state.shift = button.dataset.shift;
      setChecked(shiftPicker, "shift", state.shift);
      clearBreakdown();
      render(true);
    });

    document.getElementById("bd-truck").addEventListener("change", () => syncBreakdownTimes(days.get(state.seed)));
    timePicker.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button || button.disabled) return;
      state.breakdownTime = Number(button.dataset.time);
      setChecked(timePicker, "time", state.breakdownTime);
    });
    document.getElementById("bd-run").addEventListener("click", () => {
      // A breakdown re-plans the optimizer's day shift.
      state.plan = "optimizer";
      state.shift = "day";
      setChecked(planPicker, "plan", state.plan);
      setChecked(shiftPicker, "shift", state.shift);
      state.breakdown = { vehicle: document.getElementById("bd-truck").value, time: state.breakdownTime };
      document.getElementById("bd-reset").hidden = false;
      render(true);
    });
    document.getElementById("bd-reset").addEventListener("click", () => {
      clearBreakdown();
      render(true);
    });
  }

  let renderToken = 0;
  async function render(shouldFit = false) {
    const token = ++renderToken;
    const day = await loadDay(state.seed);
    if (token !== renderToken) return; // a newer selection already started
    renderKpis(day);
    renderReport(day);
    renderMap(day, shouldFit);
    renderLegend(day);
    renderKmChart(day);
    renderTimeline(day);
  }

  async function init() {
    try {
      index = await fetchJson("index.json");
      state.seed = index[0].seed;
      buildDayPicker();
      setChecked(document.getElementById("day-picker"), "seed", state.seed);
      wireControls();
      await render(true);
      buildBreakdownControls(days.get(state.seed));
      renderDays();
      renderDaysSummary();
    } catch (error) {
      console.error("Pavind demo failed to load:", error);
      document.getElementById("kpis").innerHTML =
        '<p class="pv-kpi-note">The demo data could not be loaded. Please refresh the page.</p>';
    }

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const day = days.get(state.seed);
        if (!day) return;
        renderKmChart(day);
        renderTimeline(day);
        renderDays();
      }, 150);
    });
  }

  init();
})();
