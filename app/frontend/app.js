const FILES = {
  workouts: "/data/workouts.json",
  runs: "/data/runs.json",
  recovery: "/data/recovery.json",
  programs: "/data/programs.json",
  exercises: "/data/exercises.json",
  user_settings: "/data/user_settings.json"
};

let STATE = {
  exercises: [],
  programs: [],
  userSettings: {},
  pendingEntries: [],
  sessionResults: [],
  lastAutoLoad: ""
};

function setText(id, text){
  const el = document.getElementById(id);
  if (el) el.textContent = String(text);
}

function esc(value){
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fillSelect(id, items, getValue, getLabel, firstLabel){
  const el = document.getElementById(id);
  if (!el) return;
  const first = firstLabel ? `<option value="">${esc(firstLabel)}</option>` : "";
  el.innerHTML = first + items.map(item =>
    `<option value="${esc(getValue(item))}">${esc(getLabel(item))}</option>`
  ).join("");
}

function getSelectedProgram(){
  const el = document.getElementById("program_id");
  if (!el) return null;
  const id = el.value;
  return (STATE.programs || []).find(x => x.id === id) || null;
}

function getExerciseMeta(exerciseId){
  return (STATE.exercises || []).find(x => x.id === exerciseId) || null;
}

function fillSimpleSelect(el, options, selectedValue, placeholder){
  if (!el) return;
  const first = placeholder ? `<option value="">${esc(placeholder)}</option>` : "";
  const arr = Array.isArray(options) ? options : [];
  el.innerHTML = first + arr.map(x => {
    const value = String(x ?? "");
    const selected = String(selectedValue ?? "") === value ? ' selected' : '';
    return `<option value="${esc(value)}"${selected}>${esc(value)}</option>`;
  }).join("");
}

function ensureInputModeHint(){
  let el = document.getElementById("entryInputModeHint");
  if (el) return el;

  const entryBox = document.querySelector(".entry-box");
  const entryNotesLabel = document.getElementById("entry_notes")?.closest("label");

  if (!entryBox || !entryNotesLabel) return null;

  el = document.createElement("p");
  el.id = "entryInputModeHint";
  el.className = "small";
  el.style.marginTop = "4px";
  el.textContent = "";

  entryNotesLabel.parentNode.insertBefore(el, entryNotesLabel);
  return el;
}

function setFieldVisibility(fieldId, visible){
  const field = document.getElementById(fieldId);
  const label = field ? field.closest("label") : null;
  if (label){
    label.classList.toggle("wizard-step-hidden", !visible);
  }
}

function applyEntryInputMode(exerciseId){
  const meta = getExerciseMeta(exerciseId) || {};
  const inputKind = String(meta.input_kind || "");
  const supportsBodyweight = !!meta.supports_bodyweight;
  const loadOptional = !!meta.load_optional;

  const setsEl = document.getElementById("entry_sets");
  const repsEl = document.getElementById("entry_reps");
  const loadEl = document.getElementById("entry_load");
  const achievedEl = document.getElementById("entry_achieved_reps");
  const hintEl = ensureInputModeHint();

  if (!setsEl || !repsEl || !loadEl) return;

  const setOptions = Array.isArray(meta.set_options) && meta.set_options.length ? meta.set_options : [1,2,3,4,5];
  fillSimpleSelect(setsEl.tagName === "SELECT" ? setsEl : null, setOptions, setsEl.value || "3", "");

  if (inputKind === "time" || inputKind === "cardio_time"){
    const timeOptions = Array.isArray(meta.time_options) && meta.time_options.length ? meta.time_options : ["20 sek","30 sek","40 sek","45 sek","60 sek"];
    fillSimpleSelect(repsEl.tagName === "SELECT" ? repsEl : null, timeOptions, repsEl.value || timeOptions[0], "");
    setFieldVisibility("entry_load", false);
    if (achievedEl){
      achievedEl.placeholder = "fx 45 sek";
    }
    if (hintEl){
      hintEl.textContent = "Belastning: Kropsvægt. Vælg tid i en fast liste for ensartet data.";
    }
    return;
  }

  const repOptions = Array.isArray(meta.rep_options) && meta.rep_options.length ? meta.rep_options : ["6-8","8-10","10-12"];
  fillSimpleSelect(repsEl.tagName === "SELECT" ? repsEl : null, repOptions, repsEl.value || repOptions[0], "");

  if (inputKind === "bodyweight_reps"){
    setFieldVisibility("entry_load", false);
    loadEl.value = "";
    if (achievedEl){
      achievedEl.placeholder = "fx 8";
    }
    if (hintEl){
      hintEl.textContent = "Belastning: Kropsvægt.";
    }
    return;
  }

  setFieldVisibility("entry_load", true);

  if (loadEl.tagName === "SELECT"){
    const loadOptions = Array.isArray(meta.load_options) && meta.load_options.length ? meta.load_options : [];
    const placeholder = loadOptional ? "(Tom = kropsvægt)" : "(Vælg belastning)";
    fillSimpleSelect(loadEl, loadOptions, loadEl.value, placeholder);
  }

  if (achievedEl){
    achievedEl.placeholder = "fx 8";
  }

  if (hintEl){
    const repHint = String(meta.rep_display_hint || "").trim();
    const baseHint = loadOptional && supportsBodyweight
      ? "Belastning er valgfri. Tomt felt tolkes som kropsvægt."
      : "Angiv belastning i standardiserede spring.";

    hintEl.textContent = repHint ? `${repHint} ${baseHint}` : baseHint;
  }
}

function getSelectedProgramDay(){
  const program = getSelectedProgram();
  const daySelect = document.getElementById("program_day_idx");
  if (!program || !daySelect) return null;
  const idx = Number(daySelect.value);
  if (!Number.isInteger(idx) || idx < 0 || !Array.isArray(program.days) || !program.days[idx]) return null;
  return program.days[idx];
}

function refreshProgramDaySelect(){
  const program = getSelectedProgram();
  const daySelect = document.getElementById("program_day_idx");
  if (!daySelect) return;

  if (!program || !Array.isArray(program.days) || program.days.length === 0){
    daySelect.innerHTML = `<option value="">(Ingen dag valgt)</option>`;
    return;
  }

  daySelect.innerHTML =
    `<option value="">(Ingen dag valgt)</option>` +
    program.days.map((day, idx) =>
      `<option value="${idx}">${esc(day.label || `Dag ${idx+1}`)}</option>`
    ).join("");
}

async function getJson(url){
  const res = await fetch(url, {cache:"no-store"});
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return await res.json();
}

async function apiGet(url){
  const res = await fetch(url, {cache:"no-store"});
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return await res.json();
}


async function apiGetProgression(exerciseId){
  if (!exerciseId) return null;
  const res = await fetch(`/api/progression/${encodeURIComponent(exerciseId)}`, {cache:"no-store"});
  if (!res.ok) throw new Error(`/api/progression/${exerciseId} -> HTTP ${res.status}`);
  return await res.json();
}

async function apiPost(url, data){
  const res = await fetch(url, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(data)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `${url} -> HTTP ${res.status}`);
  return json;
}

function resetEntryInputs(form){
  form.entry_exercise_id.value = "";
  form.entry_sets.value = "";
  form.entry_reps.value = "";
  form.entry_achieved_reps.value = "";
  form.entry_load.value = "";
  form.entry_notes.value = "";
  STATE.lastAutoLoad = "";
  applyEntryInputMode("");
}

function renderPendingEntries(){
  const root = document.getElementById("pendingEntriesList");
  if (!root) return;

  const exerciseMap = new Map((STATE.exercises || []).map(x => [x.id, x.name]));
  const exerciseMetaMap = new Map((STATE.exercises || []).map(x => [x.id, x]));

  if (!Array.isArray(STATE.pendingEntries) || STATE.pendingEntries.length === 0){
    root.innerHTML = "";
    setText("entryStatus", "Ingen øvelser tilføjet endnu.");
    return;
  }

  root.innerHTML = STATE.pendingEntries.map((entry, idx) => {
    const meta = exerciseMetaMap.get(entry.exercise_id) || {};
    const showBodyweight = !entry.load && (
      meta.default_unit !== "kg" || Number(meta.start_weight || 0) === 0
    );
    const loadText = entry.load ? ` · ${esc(entry.load)}` : (showBodyweight ? ` · kropsvægt` : "");

    return `
    <li>
      <div class="row">
        <strong>${esc(exerciseMap.get(entry.exercise_id) || entry.exercise_id || "ukendt")}</strong>
        <button type="button" data-remove-entry="${idx}" style="width:auto;padding:8px 12px">Fjern</button>
      </div>
      <div class="small">
        ${entry.sets ? `${esc(entry.sets)} sæt` : "?"}
        ${entry.reps ? ` · mål ${esc(entry.reps)}` : ""}
        ${entry.achieved_reps ? ` · opnået ${esc(entry.achieved_reps)}` : ""}
        ${loadText}
      </div>
      ${entry.notes ? `<div class="small" style="margin-top:6px">${esc(entry.notes)}</div>` : ""}
    </li>
    `;
  }).join("");

  setText("entryStatus", `${STATE.pendingEntries.length} øvelse(r) klar til dette pas`);

  root.querySelectorAll("[data-remove-entry]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-remove-entry"));
      STATE.pendingEntries.splice(idx, 1);
      renderPendingEntries();
    });
  });
}

function renderWorkouts(items){
  const root = document.getElementById("workoutsList");
  if (!root) return;

  if (!Array.isArray(items) || items.length === 0){
    root.innerHTML = `<li><div class="small">Ingen workouts endnu.</div></li>`;
    setText("listMeta", "0 elementer");
    return;
  }

  const exerciseMap = new Map((STATE.exercises || []).map(x => [x.id, x.name]));
  const sorted = [...items]
    .sort((a,b) => String(b.created_at || b.date).localeCompare(String(a.created_at || a.date)))
    .slice(0, 5);

  root.innerHTML = sorted.map(item => {
    const summary = item.summary && typeof item.summary === "object"
      ? item.summary
      : buildSessionSummaryFromResults(item);

    const results = Array.isArray(item.results) ? item.results : [];
    const isCardio = String(item?.session_type || "").trim().toLowerCase() === "løb";
    const cardioMeta = buildCardioHistoryMeta(item);
    const entriesHtml = isCardio
      ? ""
      : results.length
      ? `
        <div style="margin-top:8px">
          ${results.map(result => {
            const sets = Array.isArray(result.sets) ? result.sets : [];
            const setCount = sets.filter(x => x && typeof x === "object" && (String(x.reps || "").trim() || String(x.load || "").trim())).length;
            const estimatedLoadLabel = formatEstimatedLoadLabel(result.exercise_id, result.load || "");
            const loadText = estimatedLoadLabel ? ` · load ${esc(String(estimatedLoadLabel))}` : "";
            const achievedText = String(result.achieved_reps || "").trim()
              ? ` · opnået ${esc(String(result.achieved_reps || "").trim())}`
              : "";
            const targetText = String(result.target_reps || "").trim()
              ? ` · mål ${esc(String(result.target_reps || "").trim())}`
              : "";

            return `
            <div class="small">
              • ${esc(formatExerciseName(result.exercise_id))}
              ${setCount ? ` · ${esc(String(setCount))} sæt` : ""}
              ${targetText}
              ${achievedText}
              ${loadText}
            </div>
            `;
          }).join("")}
        </div>
      `
      : "";

    return `
      <li>
        <div class="row">
          <strong>${esc(formatSessionType(item.session_type || "ukendt"))}</strong>
          <span class="small">${esc(item.date || "")}</span>
        </div>
        <div class="small">
          ${isCardio
            ? esc(cardioMeta || "")
            : `${summary.total_sets != null ? `${esc(String(summary.total_sets))} sæt` : ""}${summary.total_reps != null ? ` · ${esc(String(summary.total_reps))} reps` : ""}${summary.estimated_volume != null ? ` · volumen ${esc(String(summary.estimated_volume))}` : ""}`}
        </div>
        ${item.notes ? `<div style="margin-top:8px">${esc(item.notes)}</div>` : ""}
        ${entriesHtml}
      </li>
    `;
  }).join("");

  setText("listMeta", `${sorted.length} elementer`);
}



function formatCardioKindLabel(value){
  const x = String(value || "").trim().toLowerCase();
  if (x === "restitution") return "Restitution";
  if (x === "base") return "Base";
  if (x === "tempo") return "Tempo";
  if (x === "interval" || x === "intervals") return "Intervaller";
  if (x === "test" || x === "benchmark") return "Test";
  return x || "Cardio";
}

function formatDurationFromSeconds(totalSec){
  const n = Number(totalSec || 0);
  if (!n || n <= 0) return "";
  const mins = Math.floor(n / 60);
  const secs = Math.round(n % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatPaceLabel(secPerKm){
  const n = Number(secPerKm || 0);
  if (!n || n <= 0) return "";
  const mins = Math.floor(n / 60);
  const secs = Math.round(n % 60);
  return `${mins}:${String(secs).padStart(2, "0")}/km`;
}

function buildCardioHistoryMeta(item){
  const cardioKind = formatCardioKindLabel(item?.cardio_kind || "");
  const distance = item?.distance_km != null && item?.distance_km !== ""
    ? `${String(item.distance_km).replace(".", ",")} km`
    : "";
  const duration = formatDurationFromSeconds(item?.duration_total_sec);
  const pace = formatPaceLabel(item?.pace_sec_per_km);
  const rpe = item?.avg_rpe != null && item?.avg_rpe !== "" ? `RPE ${item.avg_rpe}` : "";

  return [cardioKind, distance, duration, pace, rpe].filter(Boolean).join(" · ");
}

function getUserBodyweightKg(){
  const profile = STATE.userSettings && typeof STATE.userSettings === "object" && STATE.userSettings.profile && typeof STATE.userSettings.profile === "object"
    ? STATE.userSettings.profile
    : {};
  const raw = profile.bodyweight_kg;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 85;
}

function parseNumericToken(value){
  const str = String(value || "").trim();
  if (!str) return 0;
  const matches = str.match(/\d+(?:[.,]\d+)?/g);
  if (!matches || !matches.length) return 0;
  const nums = matches
    .map(x => Number(String(x).replace(",", ".")))
    .filter(x => Number.isFinite(x));
  if (!nums.length) return 0;
  return Math.max(...nums);
}

function estimateBodyweightLoadForExercise(exerciseId){
  const id = String(exerciseId || "").trim();
  const bw = getUserBodyweightKg();

  const factors = {
    pull_ups: 1.0,
    chin_ups: 1.0,
    dips: 0.9,
    push_ups: 0.65,
    incline_push_ups: 0.5,
    diamond_push_ups: 0.7,
    lunges: 0.75,
    split_squat: 0.75,
    step_ups: 0.7,
    single_leg_sit_to_stand: 0.75,
    glute_bridge: 0.55,
    single_leg_glute_bridge: 0.6,
    hamstring_walkouts: 0.5,
    hip_hinge_bw: 0.6,
    plank: 0.0,
    side_plank: 0.0,
    dead_bug: 0.0,
    bird_dog: 0.0,
    superman_hold: 0.0,
    reverse_snow_angels: 0.15,
  };

  const factor = Object.prototype.hasOwnProperty.call(factors, id) ? factors[id] : 0.4;
  const load = Number(factor) * Number(bw || 0);
  return Number.isFinite(load) && load > 0 ? Math.round(load * 10) / 10 : 0;
}

function formatEstimatedLoadLabel(exerciseId, explicitLoad){
  const explicit = parseNumericToken(explicitLoad);
  if (explicit > 0){
    return `${explicit} kg`;
  }

  const estimated = estimateBodyweightLoadForExercise(exerciseId);
  return estimated > 0 ? `${estimated} kg` : "";
}

function buildSessionSummaryFromResults(item){
  const results = Array.isArray(item && item.results) ? item.results : [];
  let totalSets = 0;
  let totalReps = 0;
  let estimatedVolume = 0;
  let hitFailureCount = 0;
  const progressFlags = [];

  results.forEach(result => {
    if (!result || typeof result !== "object") return;

    const sets = Array.isArray(result.sets) ? result.sets : [];
    let setCount = 0;

    sets.forEach(setItem => {
      if (!setItem || typeof setItem !== "object") return;
      const repsRaw = String(setItem.reps || "").trim();
      const loadRaw = String(setItem.load || "").trim();
      if (!repsRaw && !loadRaw) return;

      const repsVal = parseNumericToken(repsRaw);
      const parsedLoadVal = parseNumericToken(loadRaw);
      const loadVal = parsedLoadVal > 0 ? parsedLoadVal : estimateBodyweightLoadForExercise(result.exercise_id);

      setCount += 1;
      totalReps += repsVal;
      estimatedVolume += repsVal * loadVal;
    });

    if (!setCount){
      const achievedRaw = String(result.achieved_reps || "").trim();
      const loadRaw = String(result.load || "").trim();
      if (achievedRaw || loadRaw){
        const repsVal = parseNumericToken(achievedRaw);
        const parsedLoadVal = parseNumericToken(loadRaw);
        const loadVal = parsedLoadVal > 0 ? parsedLoadVal : estimateBodyweightLoadForExercise(result.exercise_id);
        setCount += 1;
        totalReps += repsVal;
        estimatedVolume += repsVal * loadVal;
      }
    }

    totalSets += setCount;

    if (result.completed){
      progressFlags.push(`${result.exercise_id || "exercise"}_done`);
    }
    if (result.hit_failure){
      hitFailureCount += 1;
      progressFlags.push(`${result.exercise_id || "exercise"}_failure`);
    }
  });

  let fatigue = "light";
  if (hitFailureCount >= 2){
    fatigue = "high";
  } else if (hitFailureCount === 1 || totalSets >= 16){
    fatigue = "moderate";
  }

  let nextStepHint = "Du kan sandsynligvis progressere næste gang.";
  if (fatigue === "high"){
    nextStepHint = "Reducer belastning eller volumen næste gang.";
  } else if (fatigue === "moderate"){
    nextStepHint = "Hold progressionen rolig næste gang.";
  }

  return {
    total_sets: totalSets,
    total_reps: totalReps,
    estimated_volume: Math.round(estimatedVolume * 10) / 10,
    fatigue,
    next_step_hint: nextStepHint,
    progress_flags: progressFlags
  };
}

function ensureSessionHistoryMount(){
  let root = document.getElementById("sessionResultsList");
  if (root) return root;

  const workoutsList = document.getElementById("workoutsList");
  if (!workoutsList) return null;

  const card = document.createElement("div");
  card.className = "card";
  card.style.marginTop = "16px";
  card.innerHTML = `
    <div class="row">
      <h2>Sessionhistorik</h2>
      <div class="small" id="sessionResultsMeta"></div>
    </div>
    <ul id="sessionResultsList"></ul>
  `;

  const parentCard = workoutsList.closest(".card");
  if (parentCard && parentCard.parentNode){
    parentCard.parentNode.insertBefore(card, parentCard.nextSibling);
  } else if (workoutsList.parentNode) {
    workoutsList.parentNode.appendChild(card);
  }

  return document.getElementById("sessionResultsList");
}

function renderSessionHistory(items){
  const root = ensureSessionHistoryMount();
  if (!root) return;

  if (!Array.isArray(items) || items.length === 0){
    root.innerHTML = `<li><div class="small">Ingen sessions endnu.</div></li>`;
    setText("sessionResultsMeta", "0 elementer");
    return;
  }

  const sorted = [...items].sort((a,b) => String(b.created_at || b.date).localeCompare(String(a.created_at || a.date)));

  root.innerHTML = sorted.map(item => {
    const summary = item && item.summary && typeof item.summary === "object"
      ? item.summary
      : buildSessionSummaryFromResults(item);

    const fatigue = String(summary.fatigue || "").trim() || "ukendt";
    const totalSets = Number(summary.total_sets || 0);
    const totalReps = Number(summary.total_reps || 0);
    const totalTUT = Number(summary.total_time_under_tension_sec || 0);
    const estimatedVolume = Number(summary.estimated_volume || 0);
    const nextStepHint = String(summary.next_step_hint || "").trim();
    const progressFlags = Array.isArray(summary.progress_flags) ? summary.progress_flags : [];
    const notes = String(item && item.notes || "").trim();
    const typeLabel = formatSessionType(item && item.session_type || "");
    const dateLabel = String(item && item.date || "");
    const isCardio = String(item?.session_type || "").trim().toLowerCase() === "løb";
    const cardioMeta = buildCardioHistoryMeta(item);

    return `
      <li>
        <div class="row">
          <strong>${esc(dateLabel)} · ${esc(typeLabel || "ukendt")}</strong>
          <span class="small">fatigue ${esc(fatigue)}</span>
        </div>
        <div class="small" style="margin-top:6px">
          ${isCardio
            ? esc(cardioMeta || "Ingen cardio-data")
            : `Sæt: ${esc(String(totalSets))} · Reps: ${esc(String(totalReps))}${totalTUT ? ` · TUT: ${esc(String(totalTUT))} sek` : ""} · Volumen: ${esc(String(estimatedVolume))}`}
        </div>
        <div class="small" style="margin-top:6px">
          Næste skridt: ${esc(nextStepHint || "Ingen anbefaling")}
        </div>
        <div class="small" style="margin-top:6px">
          ${progressFlags.length ? esc(progressFlags.join(", ")) : "Ingen progress flags"}
        </div>
        ${notes ? `<div class="small" style="margin-top:8px">${esc(notes)}</div>` : ""}
      </li>
    `;
  }).join("");

  setText("sessionResultsMeta", `${sorted.length} elementer`);
}



function ensureLoadMetricsMount(){
  let root = document.getElementById("loadMetricsCard");
  if (root) return root;

  const historyTop = document.getElementById("historyTopSection");
  const historyBottom = document.getElementById("historyBottomSection");
  const parent = historyTop?.parentNode || historyBottom?.parentNode;
  if (!parent) return null;

  const card = document.createElement("div");
  card.className = "card";
  card.id = "loadMetricsCard";
  card.style.marginTop = "16px";
  card.innerHTML = `
    <div class="row">
      <h2>Belastning</h2>
      <div class="small" id="loadMetricsMeta"></div>
    </div>
    <div id="loadMetricsBody" class="small"></div>
  `;

  if (historyTop && historyTop.parentNode){
    historyTop.parentNode.insertBefore(card, historyTop);
  } else {
    parent.appendChild(card);
  }

  return card;
}

function renderLoadMetrics(loadMetrics, recoveryState){
  const root = document.getElementById("loadMetricsRoot") || document.getElementById("loadMetrics");
  const meta = document.getElementById("loadMetricsMeta") || document.getElementById("loadMeta");
  if (!root) return;

  const lm = loadMetrics && typeof loadMetrics === "object" ? loadMetrics : {};
  const rs = recoveryState && typeof recoveryState === "object" ? recoveryState : {};

  const hasStructured =
    lm &&
    (lm.today_load != null || lm.acute_7d_load != null || lm.chronic_28d_load != null || lm.load_status);

  if (!hasStructured){
    const loadStatus = String(rs.load_status || "").trim();
    if (!loadStatus){
      root.innerHTML = `<div class="small">Ingen belastningsdata endnu.</div>`;
      if (meta) meta.textContent = "";
      return;
    }

    root.innerHTML = `
      <div class="small"><strong>Status:</strong> ${esc(loadStatus)}</div>
      ${rs.strain_flag ? `<div class="small" style="margin-top:6px"><strong>Belastningsflag:</strong> aktivt</div>` : `<div class="small" style="margin-top:6px"><strong>Belastningsflag:</strong> ikke aktivt</div>`}
      ${Array.isArray(rs.explanation) && rs.explanation.length ? `<div class="small" style="margin-top:6px">${esc(rs.explanation.join(" · "))}</div>` : ""}
    `;
    if (meta) meta.textContent = "Recovery-baseret fallback";
    return;
  }

  const today = Number(lm.today_load || 0);
  const acute = Number(lm.acute_7d_load || 0);
  const chronic = Number(lm.chronic_28d_load || 0);
  const ratio = Number(lm.load_ratio || 0);
  const status = String(lm.load_status || "").trim() || "ukendt";

  const dailyMap = lm.daily_load_map && typeof lm.daily_load_map === "object" ? lm.daily_load_map : {};
  const dailyRows = Object.entries(dailyMap)
    .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
    .slice(0, 5)
    .map(([date, value]) => `<div class="small">${esc(date)} · ${esc(String(value))}</div>`)
    .join("");

  root.innerHTML = `
    <div class="small"><strong>I dag:</strong> ${esc(String(today))}</div>
    <div class="small"><strong>7 dage:</strong> ${esc(String(acute))}</div>
    <div class="small"><strong>28 dage:</strong> ${esc(String(chronic))}</div>
    <div class="small"><strong>Ratio:</strong> ${esc(String(ratio))}</div>
    <div class="small"><strong>Status:</strong> ${esc(status)}</div>
    ${dailyRows ? `<div style="margin-top:10px">${dailyRows}</div>` : ""}
  `;
  if (meta) meta.textContent = "";
}


function renderExercises(items){
  const root = document.getElementById("exercisesList");
  if (!root) return;

  if (!Array.isArray(items) || items.length === 0){
    root.innerHTML = `<li><div class="small">Ingen øvelser endnu.</div></li>`;
    setText("exerciseMeta", "0 elementer");
    return;
  }

  const sorted = [...items].sort((a,b) => String(a.name).localeCompare(String(b.name), "da"));

  root.innerHTML = sorted.map(item => `
    <li>
      <div class="row">
        <strong>${esc(item.name || "ukendt")}</strong>
        <span class="small">${esc(item.default_unit || "")}</span>
      </div>
      <div class="pill">${esc(item.category || "ukendt")}</div>
      ${item.notes ? `<div class="small" style="margin-top:8px">${esc(item.notes)}</div>` : ""}
    </li>
  `).join("");

  setText("exerciseMeta", `${sorted.length} elementer`);
}

function renderRecovery(items){
  const root = document.getElementById("recoveryList");
  if (!root) return;

  if (!Array.isArray(items) || items.length === 0){
    root.innerHTML = `<li><div class="small">Ingen recovery-logs endnu.</div></li>`;
    setText("recoveryMeta", "0 elementer");
    return;
  }

  const sorted = [...items].sort((a,b) => String(b.created_at || b.date).localeCompare(String(a.created_at || a.date)));

  root.innerHTML = sorted.map(item => `
    <li>
      <div class="row">
        <strong>${esc(item.date || "")}</strong>
        <span class="small">Søvn ${esc(item.sleep_score)} · Energi ${esc(item.energy_score)} · Ømhed ${esc(item.soreness_score)}</span>
      </div>
      <div class="pill">Readiness ${esc(item.readiness_score ?? "-")}</div>
      <div class="pill">${esc(item.readiness_label || "ukendt")}</div>
      ${item.suggestion ? `<div class="small" style="margin-top:8px">${esc(item.suggestion)}</div>` : ""}
      ${item.notes ? `<div style="margin-top:8px">${esc(item.notes)}</div>` : ""}
    </li>
  `).join("");

  setText("recoveryMeta", `${sorted.length} elementer`);
}




function formatSessionType(value){
  const x = String(value || "").trim();
  if (x === "styrke") return "Styrke";
  if (x === "cardio") return "Cardio";
  if (x === "restitution") return "Restitution";
  if (x === "løb") return "Løb";
  if (x === "mobilitet") return "Mobilitet";
  return x || "Ingen plan";
}



function buildForecastLeadText(planItem){
  if (!planItem || typeof planItem !== "object"){
    return "Ingen plan endnu.";
  }

  const sessionType = String(planItem.session_type || "").trim().toLowerCase();
  const entries = Array.isArray(planItem.entries) ? planItem.entries : [];
  const firstEntry = entries.length ? entries[0] : null;
  const firstExercise = String(firstEntry?.exercise_id || "").trim().toLowerCase();
  const targetReps = String(firstEntry?.target_reps || "").trim();

  if (sessionType === "løb" || sessionType === "cardio" || sessionType === "run"){
    if (firstExercise.includes("restitution")){
      return targetReps
        ? `Restitution · ${targetReps}`
        : "Restitution · rolig bevægelse og lav belastning";
    }
    if (firstExercise.includes("interval")){
      return targetReps
        ? `Intervaller · ${targetReps}`
        : "Intervaller · kort, hårdt pas med pauser";
    }
    if (firstExercise.includes("tempo")){
      return targetReps
        ? `Tempopas · ${targetReps}`
        : "Tempopas · kontrolleret hård løbebelastning";
    }
    if (firstExercise.includes("base")){
      return targetReps
        ? `Basepas · ${targetReps}`
        : "Basepas · roligt løb i snakketempo";
    }
    return targetReps
      ? `Løb · ${targetReps}`
      : "Løb · planlagt cardiopas";
  }

  if (sessionType === "restitution"){
    if (entries.length){
      const bits = entries.slice(0, 2).map(entry => formatExerciseName(entry.exercise_id)).filter(Boolean);
      return bits.length
        ? `Restitution · ${bits.join(" + ")}`
        : "Restitution · rolig bevægelse og mobilitet";
    }
    return "Restitution · rolig bevægelse og mobilitet";
  }

  if (sessionType === "styrke" || sessionType === "strength"){
    if (entries.length){
      const bits = entries.slice(0, 3).map(entry => formatExerciseName(entry.exercise_id)).filter(Boolean);
      return bits.length
        ? `Styrkepas · ${bits.join(" + ")}`
        : "Styrkepas · planlagt træning";
    }
    return "Styrkepas · planlagt træning";
  }

  return formatSessionType(planItem.session_type || "ukendt");
}


function getForecastTypeLabel(planItem){
  if (!planItem || typeof planItem !== "object"){
    return formatSessionType("");
  }

  const sessionType = String(planItem.session_type || "").trim().toLowerCase();
  const entries = Array.isArray(planItem.entries) ? planItem.entries : [];
  const firstEntry = entries.length ? entries[0] : null;
  const firstExercise = String(firstEntry?.exercise_id || "").trim().toLowerCase();

  if (sessionType === "løb" || sessionType === "cardio" || sessionType === "run"){
    if (firstExercise.includes("restitution")) return "Restitution";
    if (firstExercise.includes("interval")) return "Intervaller";
    if (firstExercise.includes("tempo")) return "Tempopas";
    if (firstExercise.includes("base")) return "Basepas";
    return "Løb";
  }

  if (sessionType === "restitution"){
    return "Restitution";
  }

  if (sessionType === "styrke" || sessionType === "strength"){
    return "Styrkepas";
  }

  return formatSessionType(planItem.session_type || "ukendt");
}

function renderForecastHero(planItem, latestCheckin){
  setText("forecastDate", planItem?.recommended_for || latestCheckin?.date || "");
  setText("forecastType", getForecastTypeLabel(planItem));

  if (!planItem){
    setText("forecastSummary", "Velkommen. Du starter uden historik, så første skridt er et check-in. Derefter beregner SovereignStrength dagens træning.");
    setText("forecastReason", latestCheckin ? `Seneste readiness: ${latestCheckin.readiness_score ?? "-"}` : "Ingen readiness-data endnu. Start med søvn, energi, ømhed og tid.");
    const btn = document.getElementById("forecastPrimaryBtn");
    if (btn){
      btn.textContent = "Gå til check-in";
      btn.onclick = () => showWizardStep("checkin");
    }
    return;
  }

  const leadText = buildForecastLeadText(planItem);

  const bits = [];
  if (planItem.readiness_score != null) bits.push(`Parathed: ${planItem.readiness_score}`);
  if (planItem.time_budget_min) bits.push(`Tid: ${planItem.time_budget_min} min`);
  if (planItem.timing_state) bits.push(`Timing: ${formatTimingState(planItem.timing_state)}`);
  if (planItem.plan_variant) bits.push(`Plan: ${formatPlanVariant(planItem.plan_variant)}`);
  if (planItem.recovery_state && typeof planItem.recovery_state === "object") bits.push(`Recovery: ${formatRecoveryState(planItem.recovery_state.recovery_state || "")}${planItem.recovery_state.recovery_score != null ? ` (${planItem.recovery_state.recovery_score})` : ""}`);

  setText("forecastSummary", leadText);
  setText("forecastReason", [bits.join(" · "), planItem.reason || ""].filter(Boolean).join(" · "));

  const btn = document.getElementById("forecastPrimaryBtn");
  if (btn){
    btn.textContent = "Se dagens plan";
    btn.onclick = () => showWizardStep("plan");
  }
}




function formatOverviewReadinessLabel(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return "ukendt";
  if (n >= 4.5) return "meget klar";
  if (n >= 3.5) return "klar";
  if (n >= 2.5) return "moderat";
  if (n >= 1.5) return "tag det roligt";
  return "restitution anbefales";
}

function renderOverviewStatus(planItem, latestCheckin, workouts){
  const readinessValue = document.getElementById("overviewReadinessValue");
  const latestCheckinLine = document.getElementById("overviewLatestCheckinLine");
  const overviewTimeLine = document.getElementById("overviewTimeLine");
  const overviewWorkoutLine = document.getElementById("overviewWorkoutLine");

  const sessionCount = Array.isArray(STATE.sessionResults) ? STATE.sessionResults.length : 0;
  const isFirstTime = !planItem && !latestCheckin && sessionCount === 0;

  if (readinessValue){
    if (isFirstTime){
      readinessValue.textContent = "Klar";
    } else {
      const readiness = planItem?.readiness_score ?? latestCheckin?.readiness_score ?? null;
      if (readiness == null || readiness === ""){
        readinessValue.textContent = "-";
      } else {
        readinessValue.textContent = `${readiness} · ${formatOverviewReadinessLabel(readiness)}`;
      }
    }
  }

  if (latestCheckinLine){
    if (isFirstTime){
      latestCheckinLine.textContent = "Første gang i SovereignStrength.";
    } else if (latestCheckin?.date){
      latestCheckinLine.textContent = `Seneste check-in: ${latestCheckin.date}`;
    } else {
      latestCheckinLine.textContent = "Ingen check-in endnu.";
    }
  }

  if (overviewTimeLine){
    if (isFirstTime){
      overviewTimeLine.textContent = "Start med et check-in for at beregne dagens træning.";
    } else if (planItem?.time_budget_min){
      overviewTimeLine.textContent = `Tid i dag: ${planItem.time_budget_min} min`;
    } else if (latestCheckin?.time_budget_min){
      overviewTimeLine.textContent = `Senest angivet tid: ${latestCheckin.time_budget_min} min`;
    } else {
      overviewTimeLine.textContent = "Ingen tidsvurdering endnu.";
    }
  }

  if (overviewWorkoutLine){
    if (isFirstTime){
      overviewWorkoutLine.textContent = "Ingen historik endnu. Du bygger første datapunkt nu.";
    } else if (sessionCount > 0){
      overviewWorkoutLine.textContent = `Registrerede sessioner: ${sessionCount}`;
    } else {
      overviewWorkoutLine.textContent = "Ingen historik endnu.";
    }
  }
}


function renderProfileEquipmentCard(){
  const displayNameEl = document.getElementById("profileDisplayName");
  const equipmentLineEl = document.getElementById("profileEquipmentLine");
  const incrementLineEl = document.getElementById("profileIncrementLine");
  const accountLineEl = document.getElementById("profileAccountLine");
  const accountHelpLineEl = document.getElementById("profileAccountHelpLine");
  const accountBtn = document.getElementById("openAccountSettingsBtn");
  const accountBtn2 = document.getElementById("openAccountSettingsSecondaryBtn");
  const openEquipmentBtn = document.getElementById("openEquipmentSettingsBtn");
  const cancelEquipmentBtn = document.getElementById("cancelEquipmentSettingsBtn");
  const saveEquipmentBtn = document.getElementById("saveEquipmentSettingsBtn");

  const username = AUTH_USER?.username || "ukendt";
  const settings = STATE.userSettings && typeof STATE.userSettings === "object" ? STATE.userSettings : {};
  const profile = settings.profile && typeof settings.profile === "object"
    ? settings.profile
    : {};
  const preferences = settings.preferences && typeof settings.preferences === "object"
    ? settings.preferences
    : {};
  const trainingTypes = preferences.training_types && typeof preferences.training_types === "object"
    ? preferences.training_types
    : {};

  const available = settings.available_equipment && typeof settings.available_equipment === "object"
    ? settings.available_equipment
    : {};

  const increments = settings.equipment_increments && typeof settings.equipment_increments === "object"
    ? settings.equipment_increments
    : {};

  const enabledEquipment = Object.entries(available)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => key);

  const incrementEntries = Object.entries(increments)
    .filter(([key, value]) => key !== "bodyweight" && value !== "" && value != null && !Number.isNaN(Number(value)));

  if (displayNameEl){
    displayNameEl.textContent = username;
  }

  if (equipmentLineEl){
    const profileBits = [];
    if (profile.height_cm != null && profile.height_cm !== "") profileBits.push(`Højde: ${profile.height_cm} cm`);
    if (profile.bodyweight_kg != null && profile.bodyweight_kg !== "") profileBits.push(`Kropsvægt: ${profile.bodyweight_kg} kg`);

    const selectedTraining = [
      trainingTypes.running ? "løb" : "",
      trainingTypes.strength_weights ? "vægte" : "",
      trainingTypes.bodyweight ? "kropsvægt" : "",
      trainingTypes.mobility ? "mobilitet" : ""
    ].filter(Boolean);

    if (selectedTraining.length){
      profileBits.push(`Træningstyper: ${selectedTraining.join(", ")}`);
    }

    const equipmentText = enabledEquipment.length
      ? `Tilgængeligt udstyr: ${enabledEquipment.join(", ")}`
      : "Intet udstyr registreret endnu.";
    equipmentLineEl.textContent = [...profileBits, equipmentText].join(" · ");
  }

  if (incrementLineEl){
    incrementLineEl.textContent = incrementEntries.length
      ? `Vægtspring: ${incrementEntries.map(([k, v]) => `${k}: ${v}`).join(" · ")}`
      : "Ingen vægtspring registreret endnu.";
  }

  if (accountLineEl){
    accountLineEl.textContent = `Konto: ${username}`;
  }

  if (accountHelpLineEl){
    accountHelpLineEl.textContent = "Adgangskode, login og kontooplysninger åbnes via den centrale auth-side.";
  }

  const authHref = `${AUTH_BASE}/account?return_to=${encodeURIComponent(AUTH_RETURN_TO)}`;

  [accountBtn, accountBtn2].forEach(btn => {
    if (!btn) return;
    if (btn.tagName === "A"){
      btn.setAttribute("href", authHref);
    } else if (!btn.dataset.bound){
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => {
        location.href = authHref;
      });
    }
  });

  if (openEquipmentBtn && !openEquipmentBtn.dataset.bound){
    openEquipmentBtn.dataset.bound = "1";
    openEquipmentBtn.addEventListener("click", () => {
      setEquipmentEditorOpen(true);
    });
  }

  if (cancelEquipmentBtn && !cancelEquipmentBtn.dataset.bound){
    cancelEquipmentBtn.dataset.bound = "1";
    cancelEquipmentBtn.addEventListener("click", () => {
      setEquipmentEditorOpen(false);
    });
  }

  }

function populateEquipmentEditor(){
  const settings = STATE.userSettings && typeof STATE.userSettings === "object" ? STATE.userSettings : {};
  const profile = settings.profile && typeof settings.profile === "object"
    ? settings.profile
    : {};
  const preferences = settings.preferences && typeof settings.preferences === "object"
    ? settings.preferences
    : {};
  const trainingTypes = preferences.training_types && typeof preferences.training_types === "object"
    ? preferences.training_types
    : {};
  const available = settings.available_equipment && typeof settings.available_equipment === "object"
    ? settings.available_equipment
    : {};
  const increments = settings.equipment_increments && typeof settings.equipment_increments === "object"
    ? settings.equipment_increments
    : {};

  const setVal = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = String(value);
  };

  const setChecked = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.checked = Boolean(value);
  };

  setVal("profile_height_cm", profile.height_cm ?? "");
  setVal("profile_bodyweight_kg", profile.bodyweight_kg ?? "");

  setChecked("pref_running", trainingTypes.running !== false);
  setChecked("pref_strength_weights", trainingTypes.strength_weights !== false);
  setChecked("pref_bodyweight", trainingTypes.bodyweight !== false);
  setChecked("pref_mobility", trainingTypes.mobility !== false);

  setVal("eq_barbell_enabled", available.barbell === false ? "false" : "true");
  setVal("eq_dumbbell_enabled", available.dumbbell === false ? "false" : "true");
  setVal("eq_bodyweight_enabled", available.bodyweight === false ? "false" : "true");

  setVal("eq_barbell_increment", increments.barbell ?? 10);
  setVal("eq_dumbbell_increment", increments.dumbbell ?? 5);
}

function setEquipmentEditorOpen(isOpen){
  const modal = document.getElementById("equipmentSettingsModal");
  if (!modal) return;
  modal.classList.toggle("wizard-step-hidden", !isOpen);
  if (isOpen){
    populateEquipmentEditor();
    const status = document.getElementById("equipmentSettingsStatus");
    if (status) status.textContent = "Redigér profil og udstyr, og gem når du er klar.";
  }
}

async function handleEquipmentSettingsSubmit(ev){
  ev.preventDefault();

  const statusEl = document.getElementById("equipmentSettingsStatus");

  const readBool = (id) => document.getElementById(id)?.value === "true";
  const readNum = (id, fallback = 0) => {
    const raw = document.getElementById(id)?.value ?? "";
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  const readOptionalNum = (id) => {
    const raw = document.getElementById(id)?.value ?? "";
    if (raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const readChecked = (id) => Boolean(document.getElementById(id)?.checked);

  const payload = {
    profile: {
      height_cm: readOptionalNum("profile_height_cm"),
      bodyweight_kg: readOptionalNum("profile_bodyweight_kg"),
    },
    preferences: {
      training_types: {
        running: readChecked("pref_running"),
        strength_weights: readChecked("pref_strength_weights"),
        bodyweight: readChecked("pref_bodyweight"),
        mobility: readChecked("pref_mobility"),
      }
    },
    available_equipment: {
      barbell: readBool("eq_barbell_enabled"),
      dumbbell: readBool("eq_dumbbell_enabled"),
      bodyweight: readBool("eq_bodyweight_enabled"),
    },
    equipment_increments: {
      barbell: readNum("eq_barbell_increment", 10),
      dumbbell: readNum("eq_dumbbell_increment", 5),
      bodyweight: 0,
    }
  };

  try{
    if (statusEl) statusEl.textContent = "Gemmer udstyr...";
    const res = await apiPost("/api/user-settings", payload);
    STATE.userSettings = res?.item && typeof res.item === "object" ? res.item : payload;
    await refreshAll();
    setEquipmentEditorOpen(false);
    if (statusEl) statusEl.textContent = "Udstyr gemt.";
  }catch(err){
    console.error("equipment save error", err);
    if (statusEl) statusEl.textContent = "Fejl: " + (err?.message || String(err));
  }
}

function bindEquipmentEditor(){
  const form = document.getElementById("equipmentSettingsForm");
  const saveBtn = document.getElementById("saveEquipmentSettingsBtn");
  const cancelBtn = document.getElementById("cancelEquipmentSettingsBtn");
  const statusEl = document.getElementById("equipmentSettingsStatus");

  if (form){
    form.onsubmit = handleEquipmentSettingsSubmit;
  }

  if (saveBtn){
    saveBtn.onclick = (ev) => {
      ev.preventDefault();
      if (statusEl) statusEl.textContent = "DEBUG: klik på Gem udstyr";
      if (form?.requestSubmit){
        form.requestSubmit();
      } else if (form){
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }
    };
  }

  if (cancelBtn){
    cancelBtn.onclick = () => setEquipmentEditorOpen(false);
  }
}

function updateOverviewLayoutForStep(stepId){
  const overviewSection = document.getElementById("overviewSection");
  if (!overviewSection) return;

  const cards = Array.from(overviewSection.querySelectorAll(":scope > section.card"));
  cards.forEach(card => {
    const keepVisible =
      card.id === "forecastHero" ||
      card.id === "overviewStatusCard" ||
      card.id === "profileEquipmentCard";

    card.classList.toggle(
      "overview-metric-hidden",
      stepId === "overview" && !keepVisible
    );
  });
}


function renderReadiness(item){
  if (!item){
    setText("readinessScore", "-");
    setText("readinessLabel", "Ingen data endnu");
    setText("readinessSuggestion", "");
    setText("readinessAction", "");
    return;
  }

  setText("readinessScore", item.readiness_score ?? "-");
  setText("readinessLabel", `Status: ${item.readiness_label || "ukendt"}`);
  setText("readinessSuggestion", item.suggestion || "");

  let action = "";
  if ((item.readiness_score ?? 0) >= 7){
    action = "Dagens forslag: tung styrke eller kvalitetsløb.";
  } else if ((item.readiness_score ?? 0) >= 5){
    action = "Dagens forslag: almindeligt pas med normal volumen.";
  } else {
    action = "Dagens forslag: let træning, mobilitet eller restitution.";
  }

  setText("readinessAction", action);
}




function formatExerciseName(exerciseId){
  const mapped = {
    restitution_walk: "Rolig gang",
    mobility: "Mobilitet",
    cardio_easy: "Rolig cardio",
    cardio_intervals: "Intervaller"
  };
  if (mapped[exerciseId]) return mapped[exerciseId];

  const exerciseMap = new Map((STATE.exercises || []).map(x => [x.id, x.name]));
  return exerciseMap.get(exerciseId) || exerciseId || "ukendt";
}

function formatProgressionDecision(value){
  const x = String(value || "").trim();
  if (x === "increase") return "Øg næste gang";
  if (x === "increase_reps") return "Øg næste gang";
  if (x === "hold") return "Hold i dag";
  if (x === "use_start_weight") return "Startvægt";
  if (x === "no_progression") return "Ingen auto-progression";
  return x || "";
}



function formatTimingState(value){
  const x = String(value || "").trim();
  if (x === "early") return "tidligt";
  if (x === "on_time") return "til tiden";
  if (x === "late") return "sent";
  return x || "";
}

function formatPlanVariant(value){
  const x = String(value || "").trim();
  if (x === "short_20") return "kort (20 min)";
  if (x === "short_30") return "kort (30 min)";
  if (x === "full") return "fuld";
  if (x === "default") return "standard";
  return x || "";
}


function formatTimingExplanation(value){
  const x = String(value || "").trim();
  if (x === "early") return "Du checker ind før anbefalet dag.";
  if (x === "on_time") return "Du checker ind på anbefalet dag.";
  if (x === "late") return "Du checker ind efter anbefalet dag.";
  return "";
}

function buildReviewValueSelect(name, options, selectedValue, placeholder){
  const arr = Array.isArray(options) ? options : [];
  const first = placeholder ? `<option value="">${esc(placeholder)}</option>` : `<option value=""></option>`;
  return `
    <select name="${esc(name)}">
      ${first}
      ${arr.map(x => {
        const value = String(x ?? "");
        const selected = String(selectedValue ?? "") === value ? ' selected' : '';
        return `<option value="${esc(value)}"${selected}>${esc(value)}</option>`;
      }).join("")}
    </select>
  `;
}

function getReviewExerciseMeta(exerciseId){
  return getExerciseMeta(exerciseId) || {};
}

function getReviewRepOptions(meta){
  return Array.isArray(meta?.rep_options) && meta.rep_options.length
    ? meta.rep_options
    : ["6-8", "8-10", "10-12"];
}

function getReviewTimeOptions(meta){
  return Array.isArray(meta?.time_options) && meta.time_options.length
    ? meta.time_options
    : ["20 sek", "30 sek", "40 sek", "45 sek", "60 sek"];
}

function getReviewLoadOptions(meta){
  return Array.isArray(meta?.load_options) && meta.load_options.length
    ? meta.load_options
    : ["0 kg", "3 kg", "6 kg", "9 kg", "12 kg", "15 kg"];
}

function buildReviewSetFields(entry, idx, setIdx){
  const meta = getReviewExerciseMeta(entry?.exercise_id);
  const inputKind = String(meta?.input_kind || "");
  const currentLoad = String(entry?.target_load || "").trim();

  if (inputKind === "time" || inputKind === "cardio_time"){
    return `
      <div class="card" style="margin-top:10px; padding:12px">
        <div class="small" style="margin-bottom:8px">Sæt ${setIdx + 1}</div>

        <label>
          Tid
          ${buildReviewValueSelect(`review_set_reps_${idx}_${setIdx}`, getReviewTimeOptions(meta), "", "(Vælg tid)")}
        </label>

        <div class="small" style="margin-top:6px">Belastning: Kropsvægt</div>
      </div>
    `;
  }

  if (inputKind === "bodyweight_reps"){
    return `
      <div class="card" style="margin-top:10px; padding:12px">
        <div class="small" style="margin-bottom:8px">Sæt ${setIdx + 1}</div>

        <label>
          Reps
          ${buildReviewValueSelect(`review_set_reps_${idx}_${setIdx}`, getReviewRepOptions(meta), "", "(Vælg reps)")}
        </label>

        <div class="small" style="margin-top:6px">Belastning: Kropsvægt</div>
      </div>
    `;
  }

  return `
    <div class="card" style="margin-top:10px; padding:12px">
      <div class="small" style="margin-bottom:8px">Sæt ${setIdx + 1}</div>

      <label>
        Reps
        ${buildReviewValueSelect(`review_set_reps_${idx}_${setIdx}`, getReviewRepOptions(meta), "", "(Vælg reps)")}
      </label>

      <label>
        Belastning
        ${buildReviewValueSelect(`review_set_load_${idx}_${setIdx}`, getReviewLoadOptions(meta), currentLoad, meta?.load_optional ? "(Tom = kropsvægt)" : "(Vælg belastning)")}
      </label>

      ${meta?.load_optional && meta?.supports_bodyweight ? `<div class="small" style="margin-top:6px">Tom belastning tolkes som kropsvægt.</div>` : ""}
    </div>
  `;
}




const RPE_HELP = {
  "1": "Minimal indsats",
  "2": "Meget let",
  "3": "Let, du kan snakke frit",
  "4": "Komfortabelt tempo",
  "5": "Moderat, lidt pres",
  "6": "Hårdt men kontrolleret",
  "7": "Meget hårdt",
  "8": "Næsten maks",
  "9": "Tæt på maks",
  "10": "Maksimal indsats"
};

function setRpePickerValue(value){
  const wrap = document.getElementById("rpePicker");
  const hidden = document.getElementById("avg_rpe");
  const help = document.getElementById("rpeHelp");
  const normalized = String(value || "").trim();

  if (hidden) hidden.value = normalized;

  if (wrap){
    wrap.querySelectorAll("button[data-rpe]").forEach(btn => {
      btn.classList.toggle("active", String(btn.dataset.rpe || "") === normalized);
    });
  }

  if (help){
    help.textContent = normalized
      ? `Valgt: RPE ${normalized} – ${RPE_HELP[normalized] || ""}`
      : "Vælg hvor hårdt passet føltes.";
  }
}

function bindRpePicker(){
  const wrap = document.getElementById("rpePicker");
  const hidden = document.getElementById("avg_rpe");
  if (!wrap || !hidden) return;

  wrap.querySelectorAll("button[data-rpe]").forEach(btn => {
    btn.addEventListener("click", () => {
      const value = String(btn.dataset.rpe || "").trim();
      setRpePickerValue(value);
    });
  });

  setRpePickerValue(hidden.value || "");
}

function formatPaceFromSeconds(secPerKm){
  const total = Number(secPerKm || 0);
  if (!total || total <= 0) return "";
  const mins = Math.floor(total / 60);
  const secs = Math.round(total % 60);
  return `${mins}:${String(secs).padStart(2, "0")} / km`;
}

function updateCardioPacePreview(){
  const kmWholeEl = document.getElementById("cardio_distance_km_whole");
  const kmPartEl = document.getElementById("cardio_distance_km_part");
  const minEl = document.getElementById("cardio_duration_min");
  const secEl = document.getElementById("cardio_duration_sec");
  const previewEl = document.getElementById("cardioPacePreview");

  if (!kmWholeEl || !kmPartEl || !minEl || !secEl || !previewEl) return;

  const kmWhole = Number(kmWholeEl.value || 0);
  const kmPartMeters = Number(kmPartEl.value || 0);
  const distance = kmWhole + (kmPartMeters / 1000);
  const mins = Number(minEl.value || 0);
  const secs = Number(secEl.value || 0);
  const totalSec = (mins * 60) + secs;

  if (distance > 0 && totalSec > 0){
    const pace = totalSec / distance;
    previewEl.textContent = `Beregnet tempo: ${formatPaceFromSeconds(pace)}`;
  } else {
    previewEl.textContent = "";
  }
}

function toggleCardioReviewFields(item){
  const wrap = document.getElementById("cardioReviewFields");
  if (!wrap) return;

  const sessionType = String(item?.session_type || "").trim().toLowerCase();
  const isCardio = sessionType === "løb" || sessionType === "cardio" || sessionType === "run";

  wrap.style.display = isCardio ? "block" : "none";

  const cardioKindEl = document.getElementById("cardio_kind");
  const avgRpeEl = document.getElementById("avg_rpe");

  if (!isCardio){
    if (cardioKindEl) cardioKindEl.value = "";
    if (avgRpeEl) avgRpeEl.value = "";
    setRpePickerValue("");

    const kmWholeEl = document.getElementById("cardio_distance_km_whole");
    const kmPartEl = document.getElementById("cardio_distance_km_part");
    const minEl = document.getElementById("cardio_duration_min");
    const secEl = document.getElementById("cardio_duration_sec");
    const previewEl = document.getElementById("cardioPacePreview");

    if (kmWholeEl) kmWholeEl.value = "";
    if (kmPartEl) kmPartEl.value = "0";
    if (minEl) minEl.value = "";
    if (secEl) secEl.value = "0";
    if (previewEl) previewEl.textContent = "";
    return;
  }

  const firstEntry = Array.isArray(item?.entries) && item.entries.length ? item.entries[0] : null;
  const exId = String(firstEntry?.exercise_id || "").trim().toLowerCase();

  if (cardioKindEl && !cardioKindEl.value){
    if (exId.includes("interval")) cardioKindEl.value = "interval";
    else if (exId.includes("tempo")) cardioKindEl.value = "tempo";
    else if (exId.includes("restitution")) cardioKindEl.value = "restitution";
    else cardioKindEl.value = "base";
  }

  setRpePickerValue(avgRpeEl?.value || "");
  updateCardioPacePreview();
}

function renderSessionReview(item){
  const root = document.getElementById("sessionReviewList");
  if (!root) return;

  if (!item || !Array.isArray(item.entries) || item.entries.length === 0){
    root.innerHTML = `<li><div class="small">Ingen øvelser at reviewe endnu.</div></li>`;
    toggleCardioReviewFields(null);
    return;
  }

  toggleCardioReviewFields(item);

  root.innerHTML = item.entries.map((entry, idx) => {
    const setCount = Math.max(1, Number(entry.sets || 1));
    const meta = getReviewExerciseMeta(entry.exercise_id);
    const inputKind = String(meta?.input_kind || "");
    const isTime = inputKind === "time" || inputKind === "cardio_time";
    const isBodyweight = inputKind === "bodyweight_reps";
    const isCardioEntry = String(item?.session_type || "").trim().toLowerCase() === "løb"
      || String(entry?.exercise_id || "").trim().toLowerCase().startsWith("cardio_");

    if (isCardioEntry){
      return `
        <li>
          <div style="font-weight:700; margin-bottom:8px">${esc(formatExerciseName(entry.exercise_id))}</div>
          <div class="small" style="margin-bottom:10px">
            Mål: ${entry.target_reps ? esc(entry.target_reps) : "Cardiopas"}
          </div>
          <div class="small" style="margin-bottom:10px">
            Type: løb
          </div>
          <label>
            Session-note
            <input type="text" name="review_notes_${idx}" placeholder="fx rolig tur, gode ben">
          </label>
        </li>
      `;
    }

    const setFields = Array.from({length: setCount}, (_, setIdx) =>
      buildReviewSetFields(entry, idx, setIdx)
    ).join("");

    return `
      <li>
        <div style="font-weight:700; margin-bottom:8px">${esc(formatExerciseName(entry.exercise_id))}</div>
        <div class="small" style="margin-bottom:10px">
          Mål: ${entry.sets ? `${esc(entry.sets)} sæt` : ""}${entry.target_reps ? ` · ${esc(entry.target_reps)}` : ""}${entry.target_load ? ` · ${esc(entry.target_load)}` : ""}
        </div>

        <div class="small" style="margin-bottom:10px">
          Type: ${esc(inputKind || "ukendt")}
        </div>

        ${isTime || isBodyweight ? `<div class="small" style="margin-bottom:10px">Belastning: Kropsvægt</div>` : ""}
        ${meta?.rep_display_hint ? `<div class="small" style="margin-bottom:10px">${esc(meta.rep_display_hint)}</div>` : ""}

        ${setFields}

        <label>
          Fail?
          <select name="review_hit_failure_${idx}">
            <option value="false" selected>Nej</option>
            <option value="true">Ja</option>
          </select>
        </label>

        <label>
          Øvelsesnote
          <input type="text" name="review_notes_${idx}" placeholder="fx tung sidste sæt">
        </label>
      </li>
    `;
  }).join("");
}



function renderReviewSummary(item){
  const root = document.getElementById("reviewPlanSummary");
  if (!root) return;

  if (!item || !Array.isArray(item.entries) || item.entries.length === 0){
    root.innerHTML = `<div class="small">Ingen plan at reviewe endnu.</div>`;
    return;
  }

  root.innerHTML = `
    <div class="small" style="margin-bottom:6px">
      ${esc(formatSessionType(item.session_type || ""))}${item.time_budget_min ? ` · ${esc(item.time_budget_min)} min` : ""}${item.readiness_score != null ? ` · readiness ${esc(item.readiness_score)}` : ""}
    </div>
    <div class="small">
      ${item.entries.map(entry => {
        const bits = [];
        if (entry.sets) bits.push(`${esc(entry.sets)} sæt`);
        if (entry.target_reps) bits.push(`mål ${esc(entry.target_reps)}`);
        if (entry.target_load) bits.push(esc(entry.target_load));
        return `${esc(formatExerciseName(entry.exercise_id))}${bits.length ? ` · ${bits.join(" · ")}` : ""}`;
      }).join("<br>")}
    </div>
  `;
}





function renderSessionResultSummary(summary){
  const root = document.getElementById("reviewPlanSummary");
  if (!root) return;
  if (!summary || typeof summary !== "object"){
    return;
  }

  const sessionType = summary.session_type ? formatSessionType(summary.session_type) : "Ukendt";
  const fatigue = String(summary.fatigue || "").trim() || "ukendt";
  const completedExercises = Number(summary.completed_exercises || 0);
  const totalExercises = Number(summary.total_exercises || 0);
  const totalSets = Number(summary.total_sets || 0);
  const totalReps = Number(summary.total_reps || 0);
  const estimatedVolume = Number(summary.estimated_volume || 0);
  const hitFailureCount = Number(summary.hit_failure_count || 0);
  const nextStepHint = String(summary.next_step_hint || "").trim();
  const progressFlags = Array.isArray(summary.progress_flags) ? summary.progress_flags : [];

  root.innerHTML = `
    <div style="font-weight:700; margin-bottom:8px">Session summary</div>
    <div class="small" style="margin-bottom:8px">
      ${esc(sessionType)} · fatigue ${esc(fatigue)}
    </div>
    <div class="small" style="margin-bottom:8px">
      Fuldførte øvelser: ${esc(String(completedExercises))}/${esc(String(totalExercises))}<br>
      Sæt: ${esc(String(totalSets))}<br>
      Reps: ${esc(String(totalReps))}<br>
      Estimeret volumen: ${esc(String(estimatedVolume))}<br>
      Failure-markører: ${esc(String(hitFailureCount))}
    </div>
    <div class="small" style="margin-bottom:8px">
      Næste skridt: ${esc(nextStepHint || "Ingen anbefaling")}
    </div>
    <div class="small">
      ${progressFlags.length ? esc(progressFlags.join(", ")) : "Ingen progress flags"}
    </div>
  `;
}


function formatPlanActionText(entry){
  const decision = String(entry?.progression_decision || "").trim();
  const load = String(entry?.target_load || "").trim();
  const nextTarget = String(entry?.next_target_reps || "").trim();

  if (decision === "increase"){
    return load ? `Brug ${load} i dag` : "Øg belastningen i dag";
  }
  if (decision === "increase_reps"){
    return nextTarget ? `Næste mål: ${nextTarget}` : "Øg reps næste gang";
  }
  if (decision === "hold"){
    return load ? `Hold ${load} i dag` : "Hold nuværende belastning i dag";
  }
  if (decision === "use_start_weight"){
    return load ? `Brug startvægt: ${load}` : "Brug startvægt i dag";
  }
  if (decision === "no_progression"){
    return "Ingen automatisk progression";
  }
  return load ? `Brug ${load} i dag` : "Følg planen i dag";
}

function formatPlanProgressionExtra(entry){
  const bits = [];

  if (entry?.substituted_from){
    bits.push(`Erstattet fra: ${formatExerciseName(entry.substituted_from)}`);
  }
  if (entry?.recommended_next_load != null){
    bits.push(`Ideelt næste load: ${entry.recommended_next_load} kg`);
  }
  if (entry?.actual_possible_next_load != null){
    bits.push(`Næste mulige med udstyr: ${entry.actual_possible_next_load} kg`);
  }

  return bits;
}



function formatRecoveryState(value){
  const v = String(value || "").trim();
  const map = {
    ready: "Klar",
    caution: "Forsigtig",
    recover: "Restitution"
  };
  return map[v] || (v || "Ukendt");
}



function formatFamilyState(value){
  const v = String(value || "").trim();
  const map = {
    fatigued: "Træt",
    stable: "Stabil",
    ready: "Klar",
    unknown: "Ukendt"
  };
  return map[v] || (v || "Ukendt");
}



function formatLearnedRecommendation(value){
  const v = String(value || "").trim();
  const map = {
    increase_load: "Øg belastning",
    increase_reps: "Øg reps",
    increase_time: "Øg tid",
    progress_variation: "Næste variation",
    reduce_support: "Mindre støtte",
    hold: "Hold",
    simplify: "Forenkle"
  };
  return map[v] || (v || "Ukendt");
}

function formatVariationName(value){
  const v = String(value || "").trim();
  if (!v) return "";
  const exercise = getExerciseMeta(v);
  if (exercise && exercise.name) return exercise.name;
  return v.replaceAll("_", " ");
}


function getExerciseImages(exerciseId){
  const meta = getExerciseMeta(exerciseId);
  const images = Array.isArray(meta?.external_images) ? meta.external_images : [];
  return images.filter(Boolean);
}

function openExerciseViewer(exerciseId){
  try {
    const modal = document.getElementById("exerciseViewerModal");
    const titleEl = document.getElementById("exerciseViewerTitle");
    const metaEl = document.getElementById("exerciseViewerMeta");
    const imagesEl = document.getElementById("exerciseViewerImages");

    if (!modal || !titleEl || !metaEl || !imagesEl){
      return;
    }

    const meta = getExerciseMeta(exerciseId) || {};
    const name = meta.name || exerciseId || "Øvelse";
    const images = getExerciseImages(exerciseId);
    const notes = String(meta.notes || "").trim();
    const category = String(meta.category || "").trim();

    titleEl.textContent = name;

    const metaParts = [];
    if (images.length){
      metaParts.push(`${images.length} billede${images.length === 1 ? "" : "r"}`);
    }
    if (category){
      metaParts.push(`Kategori: ${category}`);
    }
    if (notes){
      metaParts.push(notes);
    }

    metaEl.textContent = metaParts.join(" · ");

    if (!images.length){
      imagesEl.innerHTML = `<div class="small">Ingen billeder tilgængelige endnu.</div>`;
    } else {
      imagesEl.innerHTML = images.map((src, idx) => `
        <div style="margin-top:${idx === 0 ? 0 : 12}px">
          <img
            src="${esc(src)}"
            alt="${esc(name)} ${idx + 1}"
            loading="lazy"
            style="width:100%;height:auto;border-radius:18px;display:block;background:#111;border:1px solid rgba(255,255,255,0.08)"
          />
        </div>
      `).join("");
    }

    modal.style.display = "block";
    document.body.style.overflow = "hidden";
  } catch (err) {
    console.error(err);
  }
}

function closeExerciseViewer(){
  const modal = document.getElementById("exerciseViewerModal");
  if (!modal) return;
  modal.style.display = "none";
  document.body.style.overflow = "";
}


document.addEventListener("click", function(ev){
  const openBtn = ev.target.closest("[data-exercise-viewer]");
  if (openBtn){
    ev.preventDefault();
    openExerciseViewer(openBtn.getAttribute("data-exercise-viewer"));
    return;
  }

  const closeBtn = ev.target.closest("#closeExerciseViewerBtn");
  if (closeBtn){
    ev.preventDefault();
    closeExerciseViewer();
    return;
  }

  const backdrop = ev.target.closest("#exerciseViewerBackdrop");
  if (backdrop){
    ev.preventDefault();
    closeExerciseViewer();
  }
});

function bindExerciseViewer(){
  return;
}



function formatTrainingDays(days){
  if (!Array.isArray(days) || !days.length) return "";
  const labels = {
    mon: "man",
    tue: "tir",
    wed: "ons",
    thu: "tor",
    fri: "fre",
    sat: "lør",
    sun: "søn"
  };
  return days.map(x => labels[String(x).trim().toLowerCase()] || x).join(" · ");
}

function formatFamiliesSelected(items){
  if (!Array.isArray(items) || !items.length) return "";
  return items.map(item => {
    const family = String(item?.family_key || "").trim();
    const exId = String(item?.exercise_id || "").trim();
    const exMeta = getExerciseMeta(exId);
    const exName = exMeta?.name || exId || "ukendt";
    return `${family} → ${exName}`;
  }).join(" · ");
}

function formatProgressionChannels(channels){
  if (!Array.isArray(channels) || !channels.length) return "";
  const map = {
    load: "load",
    reps: "reps",
    variation: "variation",
    tempo: "tempo",
    time: "tid",
    support_reduction: "mindre støtte"
  };
  return channels.map(x => map[String(x).trim()] || String(x).trim()).join(" · ");
}

function formatDecisionLabel(decisionObj){
  if (!decisionObj || typeof decisionObj !== "object") return "";
  return String(decisionObj.decision_label || "").trim();
}


function renderExerciseLibrary(){
  const root = document.getElementById("exerciseLibrary");
  if (!root) return;

  const items = Array.isArray(STATE.exercises) ? STATE.exercises.slice() : [];
  if (!items.length){
    root.innerHTML = `<div class="small">Ingen øvelser indlæst endnu.</div>`;
    return;
  }

  const grouped = {};
  for (const item of items){
    if (!item || typeof item !== "object") continue;
    const category = String(item.category || "andet").trim() || "andet";
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(item);
  }

  const order = Object.keys(grouped).sort((a, b) => a.localeCompare(b, "da"));

  root.innerHTML = order.map(category => {
    const rows = grouped[category]
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "da"))
      .map(item => {
        const exId = String(item.id || "").trim();
        const name = String(item.name || exId || "Ukendt øvelse").trim();
        const notes = String(item.notes || "").trim();
        return `
          <div class="card" style="margin-top:10px;padding:14px">
            <div class="row" style="align-items:flex-start;gap:12px">
              <div style="flex:1">
                <div style="font-weight:700">${esc(name)}</div>
                ${notes ? `<div class="small" style="margin-top:6px">${esc(notes)}</div>` : ""}
              </div>
              <button
                type="button"
                class="secondary"
                data-exercise-viewer="${esc(exId)}"
                style="width:auto;padding:8px 12px;white-space:nowrap"
              >Se øvelse</button>
            </div>
          </div>
        `;
      }).join("");

    return `
      <div style="margin-top:14px">
        <h3 style="margin:0 0 8px 0">${esc(category.charAt(0).toUpperCase() + category.slice(1))}</h3>
        ${rows}
      </div>
    `;
  }).join("");

  bindExerciseViewer();
}

function renderTodayPlan(item){
  STATE.currentTodayPlan = item || null;
  const root = document.getElementById("todayPlanList");
  if (!root) return;

  if (!item){
    setText("todayPlanMeta", "");
    setText("todayPlanTiming", "Ingen timing endnu.");
    setText("todayPlanSummary", "Ingen plan endnu. Første plan bliver genereret efter dit check-in.");
    root.innerHTML = `<li><div class="small">Du har ingen plan endnu. Lav et check-in, så opretter systemet dit første datapunkt og dagens træning.</div></li>`;
      renderReviewSummary(null);
      renderSessionReview(null);
      return;
  }

  setText("todayPlanMeta", item.recommended_for || "");
  const variantLabel = formatPlanVariant(item.plan_variant || "");
  const timingLabel = formatTimingState(item.timing_state || "");
  const timingExplanation = formatTimingExplanation(item.timing_state || "");
  const timeLabel = item.time_budget_min ? ` · Tid i dag: ${item.time_budget_min} min` : "";
  const variantText = variantLabel ? ` · Plan: ${variantLabel}` : "";

  setText(
    "todayPlanTiming",
    timingLabel ? `Timing: ${timingLabel}${timingExplanation ? ` · ${timingExplanation}` : ""}` : "Ingen timing endnu."
  );

  const recovery = item && item.recovery_state && typeof item.recovery_state === "object" ? item.recovery_state : null;
  const recoveryLabel = recovery ? formatRecoveryState(recovery.recovery_state || "") : "";
  const recoveryText = recoveryLabel ? ` · Recovery: ${recoveryLabel}${recovery.recovery_score != null ? ` (${recovery.recovery_score})` : ""}` : "";

  const templateMode = String(item?.template_mode || "").trim();
  const planMotorLabel =
    templateMode === "autoplan_v0_1" || templateMode === "autoplan_cardio_v0_1"
      ? "Autoplan"
      : "Fast plan";
  const familiesSelectedText = formatFamiliesSelected(item?.families_selected || []);
  const trainingCtx = item?.training_day_context && typeof item.training_day_context === "object" ? item.training_day_context : {};
  const trainingDaysText = formatTrainingDays(trainingCtx.training_days || []);
  const trainingDaySummary = trainingDaysText ? `Træningsdage: ${trainingDaysText}` : "";
  const trainingAllowedSummary = trainingCtx.is_training_day === false ? "I dag er ikke en planlagt træningsdag" : "";
  const baseSummary = `Type: ${item.session_type || "ukendt"} · Parathed: ${item.readiness_score ?? "-"}${timeLabel}${variantText}${recoveryText} · ${item.reason || ""}`;
  const motorSummary = `Planmotor: ${planMotorLabel}`;
  const familiesSummary = familiesSelectedText ? `Valgte familier: ${familiesSelectedText}` : "";

  setText(
    "todayPlanSummary",
    [baseSummary, motorSummary, familiesSummary, trainingDaySummary, trainingAllowedSummary].filter(Boolean).join("\n")
  );

  if (!Array.isArray(item.entries) || item.entries.length === 0){
    root.innerHTML = `<li><div class="small">Ingen konkrete øvelser i planen.</div></li>`;
      renderReviewSummary(item);
      renderSessionReview(item);
      return;
  }

  const recoveryCard = recovery ? `
    <li>
      <div style="font-weight:700">Recovery</div>
      <div style="margin-top:6px; font-size:1.35rem; font-weight:700">${esc(String(recovery.recovery_score ?? "-"))}</div>
      <div class="small" style="margin-top:6px">Status: ${esc(formatRecoveryState(recovery.recovery_state || ""))}</div>
      <div class="small" style="margin-top:6px">${recovery.strain_flag ? "Belastningsflag aktivt" : "Intet belastningsflag"}</div>
      ${Array.isArray(recovery.explanation) && recovery.explanation.length ? `<div class="small" style="margin-top:6px">Hvorfor: ${esc(recovery.explanation.join(" · "))}</div>` : ""}
    </li>
  ` : "";

  root.innerHTML = recoveryCard + item.entries.map(entry => {
      const extras = formatPlanProgressionExtra(entry);
      return `
      <li>
        <div class="row">
          <strong>${esc(formatExerciseName(entry.exercise_id))}</strong>
          <span class="small">${esc(formatProgressionDecision(entry.progression_decision || ""))}</span>
        </div>
        <div style="margin-top:6px; font-weight:600">${esc(formatPlanActionText(entry))}</div>
        <div class="small">
          ${entry.sets ? `${esc(entry.sets)} sæt` : ""}
          ${entry.target_reps ? ` · mål ${esc(entry.target_reps)}` : ""}
        </div>
        ${entry.progression_reason ? `<div class="small" style="margin-top:6px">Årsag: ${esc(entry.progression_reason)}</div>` : ""}
        ${
          entry.decision && typeof entry.decision === "object" && formatDecisionLabel(entry.decision)
            ? `<div class="small" style="margin-top:6px"><strong>Beslutning:</strong> ${esc(formatDecisionLabel(entry.decision))}</div>`
            : ""
        }
        ${
          entry.decision && typeof entry.decision === "object" && Array.isArray(entry.decision.explanation) && entry.decision.explanation.length
            ? `<div class="small" style="margin-top:6px"><strong>Hvorfor:</strong> ${esc(entry.decision.explanation.join(" · "))}</div>`
            : ""
        }
        ${
          entry.decision && typeof entry.decision === "object" && entry.decision.family_key
            ? `<div class="small" style="margin-top:6px"><strong>Familie:</strong> ${esc(String(entry.decision.family_key))}</div>`
            : ""
        }
        ${
          entry.decision && typeof entry.decision === "object" && entry.decision.family_state
            ? `<div class="small" style="margin-top:6px"><strong>Familietilstand:</strong> ${esc(formatFamilyState(entry.decision.family_state))}</div>`
            : ""
        }
        ${
          entry.decision && typeof entry.decision === "object" && Array.isArray(entry.decision.family_signals) && entry.decision.family_signals.length
            ? `<div class="small" style="margin-top:6px"><strong>Systemobservation:</strong> ${esc(entry.decision.family_signals.join(" · "))}</div>`
            : ""
        }
        ${
          entry.decision && typeof entry.decision === "object" && entry.decision.learned_recommendation
            ? `<div class="small" style="margin-top:6px"><strong>Lært signal:</strong> ${esc(formatLearnedRecommendation(entry.decision.learned_recommendation))}</div>`
            : ""
        }
        ${
          entry.decision && typeof entry.decision === "object" && entry.decision.next_variation
            ? `<div class="small" style="margin-top:6px"><strong>Næste variation:</strong> ${esc(formatVariationName(entry.decision.next_variation))}</div>`
            : ""
        }
        ${
          entry.decision && typeof entry.decision === "object" && Array.isArray(entry.decision.progression_channels) && entry.decision.progression_channels.length
            ? `<div class="small" style="margin-top:6px"><strong>Kanaler:</strong> ${esc(formatProgressionChannels(entry.decision.progression_channels))}</div>`
            : ""
        }
        ${
          entry.decision && typeof entry.decision === "object" && entry.decision.top_hit_rate != null
            ? `<div class="small" style="margin-top:6px"><strong>Top-hit-rate:</strong> ${esc(String(entry.decision.top_hit_rate))}</div>`
            : ""
        }
        ${
          entry.decision && typeof entry.decision === "object" && entry.decision.failure_signal != null
            ? `<div class="small" style="margin-top:6px"><strong>Failure-signal:</strong> ${esc(String(entry.decision.failure_signal))}</div>`
            : ""
        }
        ${
          entry.decision && typeof entry.decision === "object" && entry.decision.dropoff_signal != null
            ? `<div class="small" style="margin-top:6px"><strong>Dropoff:</strong> ${esc(String(entry.decision.dropoff_signal))}</div>`
            : ""
        }
        ${
          entry.decision && typeof entry.decision === "object" && entry.decision.consistency_signal != null
            ? `<div class="small" style="margin-top:6px"><strong>Konsistens:</strong> ${esc(String(entry.decision.consistency_signal))}</div>`
            : ""
        }
        ${
          entry.decision && typeof entry.decision === "object" && entry.decision.confidence != null
            ? `<div class="small" style="margin-top:6px"><strong>Sikkerhed:</strong> ${esc(String(entry.decision.confidence))}</div>`
            : ""
        }
        ${extras.map(x => `<div class="small" style="margin-top:6px">${esc(x)}</div>`).join("")}
        <div style="margin-top:10px">
          <button type="button" class="secondary" data-exercise-viewer="${esc(entry.exercise_id || "")}" style="width:auto;padding:8px 12px">Se øvelse</button>
        </div>
        ${entry.equipment_constraint ? `<div class="small" style="margin-top:6px">Udstyr: næste mulige spring er højere end anbefalet.</div>` : ""}
      </li>
      `;
    }).join("");

  renderReviewSummary(item);
    renderSessionReview(item);
  }

function renderPrograms(programs, exercises){
  const root = document.getElementById("programsRoot");
  if (!root) return;

  const exerciseMap = new Map((Array.isArray(exercises) ? exercises : []).map(x => [x.id, x]));

  if (!Array.isArray(programs) || programs.length === 0){
    root.innerHTML = `<div class="small">Ingen programmer endnu.</div>`;
    setText("programMeta", "0 elementer");
    return;
  }

  root.innerHTML = programs.map(program => `
    <div class="card" style="margin-top:12px; background:#141414">
      <div class="row">
        <h3>${esc(program.name || "Program")}</h3>
        <span class="pill">${esc(program.kind || "")}</span>
      </div>
      ${(program.days || []).map(day => `
        <div class="program-day">
          <strong>${esc(day.label || "Dag")}</strong>
          <ul style="margin-top:10px">
            ${(day.exercises || []).map(ex => {
              const found = exerciseMap.get(ex.exercise_id) || {};
              const name = found.name || ex.exercise_id || "ukendt";
              return `
                <li>
                  <div class="row">
                    <strong>${esc(name)}</strong>
                    <span class="small">${esc(ex.sets ?? "")} sæt × ${esc(ex.reps ?? "")}</span>
                  </div>
                </li>
              `;
            }).join("")}
          </ul>
        </div>
      `).join("")}
    </div>
  `).join("");

  setText("programMeta", `${programs.length} elementer`);
}

async function refreshAll(){
  const debug = {};
  const [workoutsFile, runs, recoveryFile, programs, exercises, userSettingsApi, workoutsApi, recoveryApi, latestRecoveryApi, todayPlanApi, sessionResultsApi] = await Promise.all([
    getJson(FILES.workouts),
    getJson(FILES.runs),
    getJson(FILES.recovery),
    getJson(FILES.programs),
    getJson(FILES.exercises),
    apiGet("/api/user-settings"),
    apiGet("/api/workouts"),
    apiGet("/api/checkins"),
    apiGet("/api/checkin/latest"),
    apiGet("/api/today-plan"),
    apiGet("/api/session-results")
  ]);

  STATE.exercises = Array.isArray(exercises) ? exercises : [];
  STATE.programs = Array.isArray(programs) ? programs : [];
  STATE.userSettings = userSettingsApi && userSettingsApi.item && typeof userSettingsApi.item === "object"
    ? userSettingsApi.item
    : {};
  STATE.sessionResults = Array.isArray(sessionResultsApi && sessionResultsApi.items) ? sessionResultsApi.items : [];

  fillSelect("program_id", STATE.programs, x => x.id, x => x.name, "(Intet program)");
  fillSelect("entry_exercise_id", STATE.exercises, x => x.id, x => x.name, "(Ingen valgt)");
  refreshProgramDaySelect();
  applyEntryInputMode(document.getElementById("entry_exercise_id")?.value || "");

  setText("workoutsCount", Array.isArray(workoutsFile) ? workoutsFile.length : 0);
  setText("exercisesCount", STATE.exercises.length);
  setText("programsCount", STATE.programs.length);
  setText("recoveryCount", Array.isArray(recoveryFile) ? recoveryFile.length : 0);

  renderWorkouts(STATE.sessionResults);
  renderLoadMetrics(sessionResultsApi && sessionResultsApi.load_metrics ? sessionResultsApi.load_metrics : null, todayPlanApi && todayPlanApi.item ? todayPlanApi.item.recovery_state : null);
  renderSessionHistory(STATE.sessionResults);
  renderExercises(STATE.exercises);
  renderExerciseLibrary();
  renderRecovery(recoveryApi.items || []);
  renderReadiness(latestRecoveryApi.item || null);
  renderForecastHero(todayPlanApi.item || null, latestRecoveryApi.item || null);
    renderOverviewStatus(todayPlanApi.item || null, latestRecoveryApi.item || null, workoutsApi.items || []);
  renderProfileEquipmentCard();
    renderTodayPlan(todayPlanApi.item || null);
  renderPrograms(STATE.programs, STATE.exercises);
  renderPendingEntries();

  debug.pendingEntries = STATE.pendingEntries;
  debug.workouts_file = workoutsFile;
  debug.workouts_api = workoutsApi;
  debug.recovery_file = recoveryFile;
  debug.recovery_api = recoveryApi;
  debug.latest_recovery_api = latestRecoveryApi;
  debug.today_plan_api = todayPlanApi;
  debug.session_results_api = sessionResultsApi;
  debug.load_metrics = sessionResultsApi && sessionResultsApi.load_metrics ? sessionResultsApi.load_metrics : null;
  debug.runs = runs;
  debug.programs = programs;
  debug.exercises = exercises;
  debug.user_settings = userSettingsApi && userSettingsApi.item ? userSettingsApi.item : {};

  setText("status", "Frontend + API OK");
  document.getElementById("status")?.classList.add("ok");
  setText("debug", JSON.stringify(debug, null, 2));
}

async function handleExerciseChange(){
  const form = document.getElementById("workoutForm");
  if (!form) return;

  const exerciseId = form.entry_exercise_id.value.trim();
  applyEntryInputMode(exerciseId);

  const currentLoad = String(form.entry_load.value || "").trim();

  if (!exerciseId){
    if (!currentLoad || currentLoad === STATE.lastAutoLoad){
      form.entry_load.value = "";
      STATE.lastAutoLoad = "";
    }
    setText("progressionHint", "Intet load-forslag endnu.");
    return;
  }

  try{
      const meta = getExerciseMeta(exerciseId) || {};
      if (String(meta.input_kind || "") !== "load_reps"){
        setText("progressionHint", meta.input_kind === "time"
          ? "Tid styres via faste valg."
          : "Kropsvægtsøvelse: ingen load-forslag.");
        return;
      }

      const data = await apiGetProgression(exerciseId);
      if (!data || data.next_load == null){
        setText("progressionHint", "Ingen progression tilgængelig for denne øvelse.");
        return;
      }

      const suggested = `${data.next_load} kg`;
      let hint = `Forslag: ${suggested}`;

      if (data.progression_decision === "increase"){
        hint += " · beslutning: stig";
      } else if (data.progression_decision === "hold"){
        hint += " · beslutning: hold";
      } else if (data.progression_decision === "use_start_weight"){
        hint += " · beslutning: startvægt";
      } else if (data.progression_decision === "no_progression"){
        hint += " · beslutning: ingen progression";
      }

      if (data.target_top_reps != null){
        hint += ` · mål-top: ${data.target_top_reps}`;
      }
      if (data.achieved_reps != null){
        hint += ` · opnået: ${data.achieved_reps}`;
      }
      if (data.progression_reason){
        hint += ` · årsag: ${data.progression_reason}`;
      }
      if (data.fatigue_score != null){
        hint += ` · muskeltræthed: ${data.fatigue_score}`;
      }
      if (data.recommended_next_load != null){
        hint += ` · ideelt næste load: ${data.recommended_next_load} kg`;
      }
      if (data.actual_possible_next_load != null){
        hint += ` · næste mulige load: ${data.actual_possible_next_load} kg`;
      }
      if (
        data.equipment_constraint ||
        (data.secondary_constraints && data.secondary_constraints.includes("equipment_constraint"))
      ){
        hint += " · udstyr: næste mulige spring er højere end anbefalet";
      }

      setText("progressionHint", hint);


    if (!currentLoad || currentLoad === STATE.lastAutoLoad){
      form.entry_load.value = suggested;
      STATE.lastAutoLoad = suggested;
    }
  }catch(err){
    console.error(err);
    setText("progressionHint", "Kunne ikke hente progression.");
  }
}

function handleAddEntry(){
  const form = document.getElementById("workoutForm");
  if (!form) return;

  const exercise_id = form.entry_exercise_id.value.trim();
  const sets = form.entry_sets.value.trim();
  const reps = form.entry_reps.value.trim();
  const achieved_reps = form.entry_achieved_reps.value.trim();
  const load = form.entry_load.value.trim();
  const notes = form.entry_notes.value.trim();

  if (!exercise_id){
    setText("entryStatus", "Vælg en øvelse først.");
    document.getElementById("entryStatus")?.classList.add("warn");
    return;
  }

  document.getElementById("entryStatus")?.classList.remove("warn");

  STATE.pendingEntries.push({
    exercise_id,
    sets,
    reps,
    achieved_reps,
    load,
    notes
  });

  resetEntryInputs(form);
  renderPendingEntries();
}

function handleClearEntries(){
  STATE.pendingEntries = [];
  renderPendingEntries();
}

async function handleLoadProgramDay(){
  const program = getSelectedProgram();
  const daySelect = document.getElementById("program_day_idx");
  const statusEl = document.getElementById("programLoadStatus");

  if (!program){
    setText("programLoadStatus", "Vælg et program først.");
    statusEl?.classList.add("warn");
    return;
  }

  const idx = Number(daySelect?.value);
  if (!Number.isInteger(idx) || idx < 0 || !Array.isArray(program.days) || !program.days[idx]){
    setText("programLoadStatus", "Vælg en dag fra programmet.");
    statusEl?.classList.add("warn");
    return;
  }

  const day = program.days[idx];

  const entries = await Promise.all((day.exercises || []).map(async (ex) => {
    let load = "";
    try{
      const prog = await apiGetProgression(ex.exercise_id || "");
      if (prog && prog.next_load != null){
        load = `${prog.next_load} kg`;
      }
    }catch(err){
      console.error(err);
    }

    return {
      exercise_id: ex.exercise_id || "",
      sets: String(ex.sets ?? ""),
      reps: String(ex.reps ?? ""),
      achieved_reps: "",
      load,
      notes: ""
    };
  }));

  STATE.pendingEntries = entries;

  const form = document.getElementById("workoutForm");
  if (form){
    resetEntryInputs(form);
    setText("progressionHint", "Intet load-forslag endnu.");
  }

  statusEl?.classList.remove("warn");
  setText("programLoadStatus", `${day.label || "Dag"} indlæst med ${STATE.pendingEntries.length} øvelse(r).`);
  renderPendingEntries();
}

async function handleWorkoutSubmit(ev){
  ev.preventDefault();

  const form = ev.currentTarget;
  const statusEl = document.getElementById("formStatus");
  const selectedDay = getSelectedProgramDay();

  const payload = {
    date: form.date.value,
    type: form.type.value,
    duration_min: Number(form.duration_min.value || 0),
    notes: form.notes.value.trim(),
    program_id: form.program_id.value.trim(),
    program_day_label: selectedDay?.label || "",
    entries: [...STATE.pendingEntries]
  };

  try{
    setText("formStatus", "Gemmer...");
    statusEl?.classList.remove("warn");
    await apiPost("/api/workouts", payload);
    setText("formStatus", "Workout gemt.");
    statusEl?.classList.add("ok");
    STATE.pendingEntries = [];
    form.reset();
    form.date.value = new Date().toISOString().slice(0,10);
    form.duration_min.value = 45;
    form.type.value = "styrke";
    refreshProgramDaySelect();
    renderPendingEntries();
    setText("programLoadStatus", "Intet program indlæst endnu.");
    await refreshAll();
    advanceWizardAfterCheckin();
  }catch(err){
    setText("formStatus", "Fejl: " + (err?.message || String(err)));
    statusEl?.classList.remove("ok");
    statusEl?.classList.add("warn");
  }
}

async function handleRecoverySubmit(ev){
  ev.preventDefault();

  const form = ev.currentTarget;
  const statusEl = document.getElementById("recoveryFormStatus");

  const payload = {
    date: form.recovery_date.value,
    sleep_score: Number(form.sleep_score.value),
    energy_score: Number(form.energy_score.value),
    soreness_score: Number(form.soreness_score.value),
    time_budget_min: Number(form.time_budget_min.value || 45),
    notes: form.recovery_notes.value.trim()
  };

  try{
    setText("recoveryFormStatus", "Beregner...");
    statusEl?.classList.remove("warn");
    await apiPost("/api/checkin", payload);
    setText("recoveryFormStatus", "Check-in gemt. Dagens plan opdateret.");
    statusEl?.classList.add("ok");
    form.reset();
    form.recovery_date.value = new Date().toISOString().slice(0,10);
    form.sleep_score.value = "3";
    form.energy_score.value = "3";
    form.soreness_score.value = "2";
    form.time_budget_min.value = "45";
    await refreshAll();
  }catch(err){
    setText("recoveryFormStatus", "Fejl: " + (err?.message || String(err)));
    statusEl?.classList.remove("ok");
    statusEl?.classList.add("warn");
  }
}


async function handleSessionResultSubmit(ev){
  ev.preventDefault();

  const form = ev.currentTarget;
  const statusEl = document.getElementById("sessionResultStatus");
  const plan = STATE.currentTodayPlan;

  if (!plan){
    setText("sessionResultStatus", "Ingen dagens plan at gemme endnu.");
    statusEl?.classList.remove("ok");
    statusEl?.classList.add("warn");
    return;
  }

  const cardioKmWhole = Number(form.cardio_distance_km_whole?.value || 0);
  const cardioKmPartMeters = Number(form.cardio_distance_km_part?.value || 0);
  const cardioDistanceKm = (cardioKmWhole + (cardioKmPartMeters / 1000)).toFixed(1).replace(/\.0$/, "");
  const cardioDurationMin = form.cardio_duration_min?.value?.trim() || "";
  const cardioDurationSec = form.cardio_duration_sec?.value?.trim() || "";

  const payload = {
    date: plan.date || new Date().toISOString().slice(0,10),
    
session_type:
  plan.session_type
  || (Array.isArray(plan.entries) && plan.entries.some(e => String(e.exercise_id||"").includes("cardio")) ? "løb" : "styrke"),

    timing_state: plan.timing_state || "",
    readiness_score: plan.readiness_score ?? null,
    completed: String(form.session_completed.value) === "true",
    notes: form.session_notes.value.trim(),
    cardio_kind: form.cardio_kind?.value?.trim() || "",
    avg_rpe: form.avg_rpe?.value?.trim() || "",
    distance_km: cardioDistanceKm === "0" ? "" : cardioDistanceKm,
    duration_min: cardioDurationMin,
    duration_sec: cardioDurationSec,
    results: Array.isArray(plan.entries) ? plan.entries.map((entry, idx) => {
      const setCount = Math.max(1, Number(entry.sets || 1));
      const meta = getReviewExerciseMeta(entry.exercise_id);
      const inputKind = String(meta?.input_kind || "");
      const isTime = inputKind === "time" || inputKind === "cardio_time";
      const isBodyweight = inputKind === "bodyweight_reps";

      const sets = Array.from({length: setCount}, (_, setIdx) => {
        const repsVal = form[`review_set_reps_${idx}_${setIdx}`]?.value?.trim() || "";
        let loadVal = form[`review_set_load_${idx}_${setIdx}`]?.value?.trim() || "";

        if (isTime || isBodyweight){
          loadVal = "";
        }

        return {
          reps: repsVal,
          load: loadVal
        };
      });

      const nonEmptySets = sets.filter(x => x.reps || x.load);
      let firstLoad = nonEmptySets[0]?.load || "";

      if (isTime || isBodyweight){
        firstLoad = "";
      }

      return {
        exercise_id: entry.exercise_id || "",
        completed: String(form.session_completed.value) === "true",
        target_reps: entry.target_reps || "",
        achieved_reps: nonEmptySets[0]?.reps || "",
        load: firstLoad,
        sets: nonEmptySets,
        hit_failure: String(form[`review_hit_failure_${idx}`]?.value || "false") === "true",
        notes: form[`review_notes_${idx}`]?.value?.trim() || ""
      };
    }) : []
  };

  try{
    setText("sessionResultStatus", "Gemmer session-resultat...");
    statusEl?.classList.remove("warn");
    const res = await apiPost("/api/session-result", payload);
    renderSessionResultSummary(res?.summary || null);
    setText("sessionResultStatus", "Session-resultat gemt.");
    statusEl?.classList.add("ok");
    form.reset();
    form.session_completed.value = "true";
    showWizardStep("history");
  }catch(err){
    setText("sessionResultStatus", "Fejl: " + (err?.message || String(err)));
    statusEl?.classList.remove("ok");
    statusEl?.classList.add("warn");
  }
}



const AUTH_BASE = "https://auth.innosocia.dk";
const AUTH_RETURN_TO = "https://strength.innosocia.dk";
let AUTH_USER = null;

function showAuthMessage(msg){
  const statusEl = document.getElementById("status");
  const debugEl = document.getElementById("debug");
  if (statusEl) statusEl.textContent = msg;
  if (debugEl) debugEl.textContent = "";
}



function renderAuthBar(){
  const wrap = document.querySelector(".wrap");
  if (!wrap) return;

  let bar = document.getElementById("authBar");
  if (!bar){
    bar = document.createElement("div");
    bar.id = "authBar";
    bar.style.display = "flex";
    bar.style.justifyContent = "space-between";
    bar.style.alignItems = "center";
    bar.style.gap = "12px";
    bar.style.flexWrap = "wrap";
    bar.style.padding = "12px 14px";
    bar.style.marginBottom = "16px";
    bar.style.border = "1px solid #2c2c2c";
    bar.style.borderRadius = "14px";
    bar.style.background = "#1b1b1b";
    wrap.prepend(bar);
  }

  const username = AUTH_USER?.username || "ukendt";
  bar.innerHTML = `
    <div style="color:#b9b9b9;font-size:.95rem">
      Logget ind som <strong style="color:#f3f3f3">${esc(username)}</strong>
    </div>
    <button id="logoutBtn" type="button" style="width:auto;padding:8px 12px">Log ud</button>
  `;

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    try{
      await fetch(`${AUTH_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
    }catch(err){}
    location.href = `${AUTH_BASE}/login?return_to=${encodeURIComponent(AUTH_RETURN_TO)}`;
  });
}


async function ensureAuthOrRedirect(){
  showAuthMessage("Tjekker login...");

  let res;
  try{
    res = await fetch(`${AUTH_BASE}/api/auth/me`, {
      method: "GET",
      credentials: "include",
      cache: "no-store"
    });
  }catch(err){
    showAuthMessage("Kunne ikke kontakte auth-service.");
    const debugEl = document.getElementById("debug");
    if (debugEl) debugEl.textContent = String(err?.stack || err);
    throw err;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.authenticated){
    const target = `${AUTH_BASE}/login?return_to=${encodeURIComponent(AUTH_RETURN_TO)}`;
    location.href = target;
    return null;
  }

  AUTH_USER = data.user || null;
  if (data.user?.must_change_password){
    showAuthMessage("Du skal skifte password, før appen kan bruges.");
    location.href = `${AUTH_BASE}/account?return_to=${encodeURIComponent(AUTH_RETURN_TO)}`;
    return null;
  }
  showAuthMessage(`Logget ind som ${data.user?.username || "bruger"}. Indlæser app...`);
  return data.user || null;
}




const WIZARD_STEPS = [
  { id: "overview", label: "Overblik" },
  { id: "checkin", label: "Check-in" },
  { id: "plan", label: "Dagens plan" },
  { id: "review", label: "Efter træning" },
  { id: "manual", label: "Manuel workout" },
  { id: "history", label: "Historik" },
];

let CURRENT_STEP = "overview";

function getWizardSections(){
  return {
    overview: [
      document.getElementById("overviewSection"),
    ],
    checkin: [
      document.getElementById("checkinSection"),
    ],
    plan: [
      document.getElementById("todayPlanSection"),
    ],
    review: [
      document.getElementById("todayPlanSection"),
    ],
    manual: [
      document.getElementById("manualWorkoutSection"),
    ],
    history: [
      document.getElementById("historyTopSection"),
      document.getElementById("historyBottomSection"),
    ],
  };
}

function renderWizardNav(){

  const root = document.getElementById("wizardNav");
  if (!root) return;

  root.innerHTML = WIZARD_STEPS.map(step => `
    <button
      type="button"
      data-step="${esc(step.id)}"
      class="${step.id === CURRENT_STEP ? "is-active" : ""}"
    >
      ${esc(step.label)}
    </button>
  `).join("");

  root.querySelectorAll("[data-step]").forEach(btn => {
    btn.addEventListener("click", () => {
      showWizardStep(btn.getAttribute("data-step"));
    });
  });
}





function updateReviewHeadingForStep(stepId){
  const heading = document.getElementById("sessionReviewHeading");
  if (!heading) return;
  heading.textContent = stepId === "review" ? "Review af træning" : "Afslut dagens plan";
}


function updatePlanHeadingForStep(stepId){
  const heading = document.getElementById("todayPlanHeading");
  const meta = document.getElementById("todayPlanMeta");
  if (heading){
    heading.textContent = stepId === "review" ? "Efter træning" : "Dagens plan";
  }
  if (meta){
    meta.classList.toggle("wizard-step-hidden", stepId === "review");
  }
}


function showWizardStep(stepId){
  CURRENT_STEP = stepId;
  const groups = getWizardSections();

  Object.entries(groups).forEach(([key, nodes]) => {
    const active = key === stepId;
    (nodes || []).forEach(node => {
      if (!node) return;
      node.classList.toggle("wizard-step-hidden", !active);
    });
  });

  const sessionResultForm = document.getElementById("sessionResultForm");
  const reviewWrap = sessionResultForm ? sessionResultForm.closest(".card") : null;
  const todayPlanSection = document.getElementById("todayPlanSection");
  const todayPlanList = document.getElementById("todayPlanList");
  const todayPlanTiming = document.getElementById("todayPlanTiming");
  const todayPlanSummary = document.getElementById("todayPlanSummary");
  const reviewSummary = document.getElementById("reviewPlanSummary");

  if (todayPlanSection){
    todayPlanSection.classList.toggle("wizard-step-hidden", !(stepId === "plan" || stepId === "review"));
  }

  if (todayPlanList){
    todayPlanList.classList.toggle("wizard-step-hidden", stepId === "review");
  }

  if (todayPlanTiming){
    todayPlanTiming.classList.toggle("wizard-step-hidden", stepId === "review");
  }

  if (todayPlanSummary){
    todayPlanSummary.classList.toggle("wizard-step-hidden", stepId === "review");
  }

  if (reviewSummary){
    reviewSummary.classList.toggle("wizard-step-hidden", stepId !== "review");
  }

  if (reviewWrap){
    reviewWrap.classList.toggle("wizard-step-hidden", stepId !== "review");
  }

  updatePlanHeadingForStep(stepId);
  updateReviewHeadingForStep(stepId);
  updateOverviewLayoutForStep(stepId);
  renderWizardNav();
}

function advanceWizardAfterCheckin(){
  showWizardStep("plan");
}


async function boot(){
  try{
    const dateEl = document.getElementById("date");
    if (dateEl && !dateEl.value){
      dateEl.value = new Date().toISOString().slice(0,10);
    }

    const recoveryDateEl = document.getElementById("recovery_date");
    if (recoveryDateEl && !recoveryDateEl.value){
      recoveryDateEl.value = new Date().toISOString().slice(0,10);
    }

    const workoutForm = document.getElementById("workoutForm");
    if (workoutForm){
      workoutForm.addEventListener("submit", handleWorkoutSubmit);
    }

    const recoveryForm = document.getElementById("recoveryForm");
    if (recoveryForm){
      recoveryForm.addEventListener("submit", handleRecoverySubmit);
    }

    const sessionResultForm = document.getElementById("sessionResultForm");
    if (sessionResultForm){
      sessionResultForm.addEventListener("submit", handleSessionResultSubmit);

      document.getElementById("cardio_distance_km_whole")?.addEventListener("change", updateCardioPacePreview);
      document.getElementById("cardio_distance_km_part")?.addEventListener("change", updateCardioPacePreview);
      document.getElementById("cardio_duration_min")?.addEventListener("change", updateCardioPacePreview);
      document.getElementById("cardio_duration_sec")?.addEventListener("change", updateCardioPacePreview);
    }

    document.getElementById("addEntryBtn")?.addEventListener("click", handleAddEntry);
    document.getElementById("clearEntriesBtn")?.addEventListener("click", handleClearEntries);
    document.getElementById("loadProgramDayBtn")?.addEventListener("click", handleLoadProgramDay);
    document.getElementById("program_id")?.addEventListener("change", refreshProgramDaySelect);
    document.getElementById("entry_exercise_id")?.addEventListener("change", handleExerciseChange);
    bindEquipmentEditor();
    bindRpePicker();

    await refreshAll();
    renderWizardNav();
    showWizardStep("overview");
  }catch(err){
    setText("status", "Fejl: " + (err?.message || String(err)));
    setText("debug", String(err?.stack || err));
  }
}

(async () => {
  try{
    await ensureAuthOrRedirect();
    renderAuthBar();
    await boot();
  }catch(err){
    setText("status", "Fejl før opstart: " + (err?.message || String(err)));
    setText("debug", String(err?.stack || err));
  }
})();
