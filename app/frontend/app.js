const FILES = {
  workouts: "/data/workouts.json",
  runs: "/data/runs.json",
  recovery: "/data/recovery.json",
  programs: "/data/programs.json",
  exercises: "/data/exercises.json",
  user_settings: "/data/user_settings.json",
  seed_programs: "/app/data/seed/programs.json",
  seed_exercises: "/app/data/seed/exercises.json"
};

let STATE = {
  exercises: [],
  programs: [],
  userSettings: {},
  pendingEntries: [],
  sessionResults: [],
  lastAutoLoad: ""
};

function tr(key, vars = {}){
  try{
    if (window.t) return window.t(key, vars);
  }catch(err){}
  let text = key;
  for (const [name, value] of Object.entries(vars || {})){
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

function getCurrentLang(){
  try{
    return window.I18N?.lang || localStorage.getItem("ss_lang") || "da";
  }catch(err){
    return "da";
  }
}

function getNextLang(){
  return getCurrentLang() === "da" ? "en" : "da";
}

function updateLanguageToggleLabel(){
  const btn = document.getElementById("languageToggleBtn");
  if (!btn) return;
  const lang = getCurrentLang();
  btn.textContent = lang === "da" ? "🇩🇰 Dansk ▾" : "🇬🇧 English ▾";
}

async function initLanguageToggle(){
  const btn = document.getElementById("languageToggleBtn");
  const menu = document.getElementById("languageMenu");
  const wrap = document.getElementById("languageMenuWrap");
  if (!btn) return;

  updateLanguageToggleLabel();

  if (!menu || !wrap){
    btn.addEventListener("click", async () => {
      try{
        const next = getNextLang();
        await window.I18N.load(next);
        updateLanguageToggleLabel();
        await rerenderUiAfterLanguageChange();
      }catch(err){
        setText("status", "Fejl ved sprogskift: " + (err?.message || String(err)));
      }
    });
    return;
  }

  if (btn.dataset.langMenuBound === "1") return;
  btn.dataset.langMenuBound = "1";

  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    menu.hidden = !menu.hidden;
  });

  document.querySelectorAll("[data-language-choice]").forEach((opt) => {
    if (opt.dataset.bound === "1") return;
    opt.dataset.bound = "1";

    opt.addEventListener("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const chosen = opt.getAttribute("data-language-choice");
      menu.hidden = true;
      if (!chosen || chosen === getCurrentLang()) return;

      try{
        await window.I18N.load(chosen);
        updateLanguageToggleLabel();
        await rerenderUiAfterLanguageChange();
      }catch(err){
        setText("status", "Fejl ved sprogskift: " + (err?.message || String(err)));
      }
    });
  });

  document.addEventListener("click", (ev) => {
    if (!wrap.contains(ev.target)) menu.hidden = true;
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") menu.hidden = true;
  });
}

function applyStaticTranslations(){
  document.title = tr("app.title");

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    el.textContent = tr(key);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (!key) return;
    el.setAttribute("placeholder", tr(key));
  });

  const toggleSystemInfo = document.getElementById("toggleSystemInfo");
  if (toggleSystemInfo){
    toggleSystemInfo.textContent = tr("button.hide");
  }
}

function resetEnhancedCheckinUi(){
  document.querySelectorAll(".checkin-score-wrap").forEach((el) => el.remove());
  document.querySelectorAll(".checkin-score-hidden").forEach((el) => el.classList.remove("checkin-score-hidden"));

  ["sleep_score", "energy_score", "soreness_score"].forEach((fieldId) => {
    const valueEl = document.getElementById(`checkin_value_${fieldId}`);
    if (valueEl) valueEl.remove();
  });
}

function deriveDailyUiState(planItem, latestCheckin){
  const today = new Date().toISOString().slice(0,10);
  const latestDate = String(latestCheckin?.date || "").slice(0,10);
  const hasCheckinToday = latestDate === today;
  const hasPlan = !!(planItem && typeof planItem === "object");

  if (!hasCheckinToday) return "needs_checkin";
  if (hasPlan) return "ready_for_plan";
  return "overview";
}

function getDefaultWizardStepForDailyState(planItem, latestCheckin){
  const dailyState = deriveDailyUiState(planItem, latestCheckin);
  if (dailyState === "needs_checkin") return "checkin";
  if (dailyState === "ready_for_plan") return "plan";
  return "overview";
}

async function rerenderUiAfterLanguageChange(){
  applyStaticTranslations();
  resetEnhancedCheckinUi();
  if (typeof initCheckinScoreButtons === "function") initCheckinScoreButtons();
  renderWizardNav();
  renderAuthBar();
  const uiState = await refreshAll();
  showWizardStep(CURRENT_STEP || uiState?.defaultStep || "overview");
}

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
// --- Equipment labels (DA) ---
function getEquipmentLabels(){
  return {
    barbell: tr("equipment.barbell"),
    dumbbell: tr("equipment.dumbbell"),
    bodyweight: tr("equipment.bodyweight"),
    kettlebell: tr("equipment.kettlebell"),
    machine: tr("equipment.machine"),
    bands: tr("equipment.bands")
  };
}

function formatEquipmentList(list){
  if (!Array.isArray(list)) return "";
  return list
    .slice()
    .sort()
    .map(k => getEquipmentLabels()[k] || k)
    .join(", ");
}

function formatLoadIncrements(obj){
  if (!obj || typeof obj !== "object") return "";
  return Object.entries(obj)
    .map(([k, v]) => `${getEquipmentLabels()[k] || k}: ${v}`)
    .join(" · ");
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
    const timeOptions = Array.isArray(meta.time_options) && meta.time_options.length ? meta.time_options : [`20 ${tr("unit.seconds")}`,`30 ${tr("unit.seconds")}`,`40 ${tr("unit.seconds")}`,`45 ${tr("unit.seconds")}`,`60 ${tr("unit.seconds")}`];
    fillSimpleSelect(repsEl.tagName === "SELECT" ? repsEl : null, timeOptions, repsEl.value || timeOptions[0], "");
    setFieldVisibility("entry_load", false);
    if (achievedEl){
      achievedEl.placeholder = tr("workout.achieved_time_placeholder");
    }
    if (hintEl){
      hintEl.textContent = tr("after_training.bodyweight_time_hint");
    }
    return;
  }

  const repOptions = Array.isArray(meta.rep_options) && meta.rep_options.length ? meta.rep_options : ["6-8","8-10","10-12"];
  fillSimpleSelect(repsEl.tagName === "SELECT" ? repsEl : null, repOptions, repsEl.value || repOptions[0], "");

  if (inputKind === "bodyweight_reps"){
    setFieldVisibility("entry_load", false);
    loadEl.value = "";
    if (achievedEl){
      achievedEl.placeholder = tr("workout.achieved_placeholder");
    }
    if (hintEl){
      hintEl.textContent = tr("after_training.bodyweight_load_hint");
    }
    return;
  }

  setFieldVisibility("entry_load", true);

  if (loadEl.tagName === "SELECT"){
    const loadOptions = Array.isArray(meta.load_options) && meta.load_options.length ? meta.load_options : [];
    const placeholder = loadOptional ? "(Tom = kropsvægt)" : tr("workout.load_placeholder");
    fillSimpleSelect(loadEl, loadOptions, loadEl.value, placeholder);
  }

  if (achievedEl){
    achievedEl.placeholder = tr("workout.achieved_placeholder");
  }

  if (hintEl){
    const repHint = String(meta.rep_display_hint || "").trim();
    const baseHint = loadOptional && supportsBodyweight
      ? tr("manual_workout.load_optional_hint")
      : tr("workout.load_hint");

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
    daySelect.innerHTML = `<option value="">${tr("workout.no_day_selected")}</option>`;
    return;
  }

  daySelect.innerHTML =
    `<option value="">${tr("workout.no_day_selected")}</option>` +
    program.days.map((day, idx) =>
      `<option value="${idx}">${esc(day.label || `Dag ${idx+1}`)}</option>`
    ).join("");
}

async function getJson(url){
  const res = await fetch(url, {cache:"no-store"});
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return await res.json();
}

async function getJsonOrSeed(primaryPath, seedPath){
  const primary = await getJson(primaryPath);
  if (Array.isArray(primary) && primary.length) return primary;
  const seed = await getJson(seedPath);
  return Array.isArray(seed) ? seed : [];
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
    setText("entryStatus", tr("workout.no_exercises"));
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
        <strong>${esc(exerciseMap.get(entry.exercise_id) || entry.exercise_id || tr("common.unknown_lower"))}</strong>
        <button type="button" data-remove-entry="${idx}" style="width:auto;padding:8px 12px">${esc(tr("button.remove"))}</button>
      </div>
      <div class="small">
        ${entry.sets ? tr("exercise.sets_count", { count: esc(entry.sets) }) : "?"}
        ${entry.reps ? ` · ${tr("exercise.target_label", { value: esc(entry.reps) })}` : ""}
        ${entry.achieved_reps ? ` · ${tr("exercise.achieved_label", { value: esc(entry.achieved_reps) })}` : ""}
        ${loadText}
      </div>
      ${entry.notes ? `<div class="small" style="margin-top:6px">${esc(entry.notes)}</div>` : ""}
    </li>
    `;
  }).join("");

  setText("entryStatus", tr("workout.pending_entries_ready", { count: STATE.pendingEntries.length }));

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
    root.innerHTML = `<li><div class="small">${esc(tr("workouts.none_yet"))}</div></li>`;
    setText("listMeta", tr("common.items_count", { count: 0 }));
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
              ? ` · ${tr("exercise.achieved_label", { value: esc(String(result.achieved_reps || "").trim()) })}`
              : "";
            const targetText = String(result.target_reps || "").trim()
              ? ` · ${tr("exercise.target_label", { value: formatTarget(String(result.target_reps || "").trim()) })}`
              : "";

            return `
            <div class="small">
              • ${esc(formatExerciseName(result.exercise_id))}
              ${setCount ? ` · ${tr("exercise.sets_count", { count: esc(String(setCount)) })}` : ""}
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
          <strong>${esc(formatSessionType(item.session_type || tr("common.unknown_lower")))}</strong>
          <span class="small">${esc(item.date || "")}</span>
        </div>
        <div class="small">
          ${isCardio
            ? esc(cardioMeta || "")
            : `${summary.total_sets != null ? tr("exercise.sets_count", { count: esc(String(summary.total_sets)) }) : ""}${summary.total_reps != null ? ` · ${tr("exercise.reps_count", { count: esc(String(summary.total_reps)) })}` : ""}${summary.estimated_volume != null ? ` · ${tr("exercise.volume_label", { value: esc(String(summary.estimated_volume)) })}` : ""}`}
        </div>
        ${item.notes ? `<div style="margin-top:8px">${esc(item.notes)}</div>` : ""}
        ${entriesHtml}
      </li>
    `;
  }).join("");

  setText("listMeta", tr("common.items_count", { count: sorted.length }));
}



function formatCardioKindLabel(value){
  const x = String(value || "").trim().toLowerCase();
  if (x === "restitution") return tr("session_type.recovery");
  if (x === "base") return tr("cardio.kind.base");
  if (x === "tempo") return tr("cardio.kind.tempo");
  if (x === "interval" || x === "intervals") return tr("cardio.kind.intervals");
  if (x === "test" || x === "benchmark") return tr("cardio.kind.test");
  return x || tr("cardio.kind.generic");
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

  let nextStepHint = tr("progression.next_step_likely_progress");
  if (fatigue === "high"){
    nextStepHint = tr("progression.next_step_reduce_load_or_volume");
  } else if (fatigue === "moderate"){
    nextStepHint = tr("progression.next_step_keep_progression_easy");
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
  card.innerHTML = `
    <div class="row">
      <h2>${tr("history.session_history")}</h2>
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
    root.innerHTML = `<li><div class="small">${esc(tr("history.sessions_none"))}</div></li>`;
    setText("sessionResultsMeta", tr("common.items_count", { count: 0 }));
    return;
  }

  const sorted = [...items].sort((a,b) => String(b.created_at || b.date).localeCompare(String(a.created_at || a.date)));

  root.innerHTML = sorted.map(item => {
    const summary = item && item.summary && typeof item.summary === "object"
      ? item.summary
      : buildSessionSummaryFromResults(item);

    const fatigue = String(summary.fatigue || "").trim() || tr("common.unknown_lower");
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
          <strong>${esc(dateLabel)} · ${esc(typeLabel || tr("common.unknown_lower"))}</strong>
          <span class="small">${tr("history.fatigue_label", { value: formatFatigueText(fatigue) })}</span>
        </div>
        <div class="small" style="margin-top:6px">
          ${isCardio
            ? esc(cardioMeta || tr("history.cardio_none"))
            : `${tr("history.session_totals", { sets: esc(String(totalSets)), reps: esc(String(totalReps)), tut_part: totalTUT ? ` · TUT: ${esc(String(totalTUT))} ${tr("unit.seconds")}` : "", volume: esc(String(estimatedVolume)) })}`}
        </div>
        <div class="small" style="margin-top:6px">
          ${tr("history.next_step_label")}: ${esc(nextStepHint || tr("common.no_recommendation"))}
        </div>
        <div class="small" style="margin-top:6px">
          ${progressFlags.length ? esc(progressFlags.map(formatProgressFlag).join(", ")) : tr("history.no_progress_flags")}
        </div>
        ${notes ? `<div class="small" style="margin-top:8px">${esc(notes)}</div>` : ""}
      </li>
    `;
  }).join("");

  setText("sessionResultsMeta", tr("common.items_count", { count: sorted.length }));
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
      <h2>${esc(tr("load.title"))}</h2>
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
      root.innerHTML = `<div class="small">${esc(tr("load.none_yet"))}</div>`;
      if (meta) meta.textContent = "";
      return;
    }

    root.innerHTML = `
      <div class="small"><strong>${tr("common.status_label")}:</strong> ${esc(loadStatus)}</div>
      ${rs.strain_flag ? `<div class="small" style="margin-top:6px"><strong>${tr("recovery.strain_flag_label")}:</strong> ${tr("common.active")}</div>` : `<div class="small" style="margin-top:6px"><strong>${tr("recovery.strain_flag_label")}:</strong> ${tr("common.inactive")}</div>`}
      ${Array.isArray(rs.explanation) && rs.explanation.length ? `<div class="small" style="margin-top:6px">${esc(rs.explanation.join(" · "))}</div>` : ""}
    `;
    if (meta) meta.textContent = tr("recovery.fallback_label");
    return;
  }

  const today = Number(lm.today_load || 0);
  const acute = Number(lm.acute_7d_load || 0);
  const chronic = Number(lm.chronic_28d_load || 0);
  const ratio = Number(lm.load_ratio || 0);
  const status = String(lm.load_status || "").trim() || tr("common.unknown_lower");

  const dailyMap = lm.daily_load_map && typeof lm.daily_load_map === "object" ? lm.daily_load_map : {};
  const dailyRows = Object.entries(dailyMap)
    .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
    .slice(0, 5)
    .map(([date, value]) => `<div class="small">${esc(date)} · ${esc(String(value))}</div>`)
    .join("");

  root.innerHTML = `
    <div class="small"><strong>${tr("load.today_label")}:</strong> ${esc(String(today))}</div>
    <div class="small"><strong>${tr("load.days_7_label")}:</strong> ${esc(String(acute))}</div>
    <div class="small"><strong>${tr("load.days_28_label")}:</strong> ${esc(String(chronic))}</div>
    <div class="small"><strong>${tr("load.ratio_label")}:</strong> ${esc(String(ratio))}</div>
    <div class="small"><strong>${tr("common.status_label")}:</strong> ${esc(status)}</div>
    ${dailyRows ? `<div style="margin-top:10px">${dailyRows}</div>` : ""}
  `;
  if (meta) meta.textContent = "";
}


function renderExercises(items){
  const root = document.getElementById("exercisesList");
  if (!root) return;

  if (!Array.isArray(items) || items.length === 0){
    root.innerHTML = `<li><div class="small">${esc(tr("exercise.none_yet"))}</div></li>`;
    setText("exerciseMeta", tr("common.items_count", { count: 0 }));
    return;
  }

  const sorted = [...items].sort((a,b) => String(a.name).localeCompare(String(b.name), "da"));

  root.innerHTML = sorted.map(item => `
    <li>
      <div class="row">
        <strong>${esc(item.name || tr("common.unknown_lower"))}</strong>
        <span class="small">${esc(item.default_unit || "")}</span>
      </div>
      <div class="pill">${esc(formatExerciseCategory(item.category || tr("common.unknown_lower")))}</div>
      ${item.notes ? `<div class="small" style="margin-top:8px">${esc(item.notes)}</div>` : ""}
    </li>
  `).join("");

  setText("exerciseMeta", tr("common.items_count", { count: sorted.length }));
}

function renderRecovery(items){
  const root = document.getElementById("recoveryList");
  if (!root) return;

  if (!Array.isArray(items) || items.length === 0){
    root.innerHTML = `<li><div class="small">${esc(tr("recovery.none_yet"))}</div></li>`;
    setText("recoveryMeta", tr("common.items_count", { count: 0 }));
    return;
  }

  const sorted = [...items].sort((a,b) => String(b.created_at || b.date).localeCompare(String(a.created_at || a.date)));

  root.innerHTML = sorted.map(item => `
    <li>
      <div class="row">
        <strong>${esc(item.date || "")}</strong>
        <span class="small">${tr("history.recovery_scores", { sleep: esc(item.sleep_score), energy: esc(item.energy_score), soreness: esc(item.soreness_score) })}</span>
      </div>
      <div class="pill">${tr("overview.readiness_label")} ${esc(item.readiness_score ?? "-")}</div>
      <div class="pill">${esc(formatOverviewReadinessLabel(item.readiness_score))}</div>
      ${item.suggestion ? `<div class="small" style="margin-top:8px">${esc(item.suggestion)}</div>` : ""}
      ${item.notes ? `<div style="margin-top:8px">${esc(item.notes)}</div>` : ""}
    </li>
  `).join("");

  setText("recoveryMeta", tr("common.items_count", { count: sorted.length }));
}




function formatSessionType(value){
  const x = String(value || "").trim();
  if (x === "styrke") return tr("workout.type.strength");
  if (x === "cardio") return tr("session_type.cardio");
  if (x === "restitution") return tr("session_type.recovery");
  if (x === "løb") return tr("session_type.run");
  if (x === "mobilitet") return tr("session_type.mobility");
  return x || tr("plan.none");
}



function buildForecastLeadText(planItem){
  if (!planItem || typeof planItem !== "object"){
    return tr("today_plan.no_plan_yet_short");
  }

  const sessionType = String(planItem.session_type || "").trim().toLowerCase();
  const entries = Array.isArray(planItem.entries) ? planItem.entries : [];
  const firstEntry = entries.length ? entries[0] : null;
  const firstExercise = String(firstEntry?.exercise_id || "").trim().toLowerCase();
  const targetReps = String(firstEntry?.target_reps || "").trim();

  if (sessionType === "løb" || sessionType === "cardio" || sessionType === "run"){
    if (firstExercise.includes("restitution")){
      return targetReps
        ? tr("forecast.recovery_with_target", { value: targetReps })
        : tr("forecast.recovery_low_load");
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
        ? tr("forecast.recovery_with_exercises", { value: bits.join(" + ") })
        : tr("forecast.recovery_mobility");
    }
    return tr("forecast.recovery_mobility");
  }

  if (sessionType === "styrke" || sessionType === "strength"){
    if (entries.length){
      const bits = entries.slice(0, 3).map(entry => formatExerciseName(entry.exercise_id)).filter(Boolean);
      return bits.length
        ? `${tr("session_type.strength_session")} · ${bits.join(" + ")}`
        : tr("plan.strength_planned");
    }
    return tr("plan.strength_planned");
  }

  return formatSessionType(planItem.session_type || tr("common.unknown_lower"));
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
    if (firstExercise.includes("restitution")) return tr("session_type.recovery");
    if (firstExercise.includes("interval")) return tr("forecast.type.intervals");
    if (firstExercise.includes("tempo")) return tr("forecast.type.tempo");
    if (firstExercise.includes("base")) return tr("forecast.type.base");
    return tr("session_type.run");
  }

  if (sessionType === "restitution"){
    return tr("session_type.recovery");
  }

  if (sessionType === "styrke" || sessionType === "strength"){
    return tr("session_type.strength_session");
  }

  return formatSessionType(planItem.session_type || tr("common.unknown_lower"));
}

function renderForecastHero(planItem, latestCheckin){
  setText("forecastDate", planItem?.recommended_for || latestCheckin?.date || "");
  setText("forecastType", getForecastTypeLabel(planItem));

  if (!planItem){
    setText("forecastSummary", tr("forecast.welcome_no_history"));
    setText("forecastReason", latestCheckin ? tr("forecast.latest_readiness", { value: latestCheckin.readiness_score ?? "-" }) : tr("forecast.no_readiness_data"));
    const btn = document.getElementById("forecastPrimaryBtn");
    if (btn){
      btn.textContent = tr("overview.go_to_checkin");
      btn.onclick = () => showWizardStep("checkin");
    }
    return;
  }

  const leadText = buildForecastLeadText(planItem);

  const bits = [];
  if (planItem.readiness_score != null) bits.push(tr("forecast.readiness_label", { value: planItem.readiness_score }));
  if (planItem.time_budget_min) bits.push(tr("forecast.time_label", { minutes: planItem.time_budget_min }));
  const timingLabel = formatTimingState(planItem.timing_state);
  if (timingLabel) bits.push(tr("forecast.timing_label", { value: timingLabel }));
  const planVariantLabel = formatPlanVariant(planItem.plan_variant || "");
  if (planVariantLabel) bits.push(tr("forecast.plan_label", { value: formatPlanMotor(planVariantLabel) }));
  if (planItem.recovery_state && typeof planItem.recovery_state === "object") bits.push(tr("forecast.recovery_label", { value: `${formatRecoveryState(planItem.recovery_state.recovery_state || "")}${planItem.recovery_state.recovery_score != null ? ` (${planItem.recovery_state.recovery_score})` : ""}` }));

  const reasonParts = [bits.join(" · "), formatPlanReason(planItem.reason || "")].filter(Boolean);

  setText("forecastSummary", leadText);
  setText("forecastReason", reasonParts.join(" · "));

  const btn = document.getElementById("forecastPrimaryBtn");
  if (btn){
    btn.textContent = tr("button.view_today_plan");
    btn.onclick = () => showWizardStep("plan");
  }
}




function formatOverviewReadinessLabel(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return tr("common.unknown_lower");
  if (n >= 4.5) return tr("overview.readiness_state.very_ready");
  if (n >= 3.5) return tr("overview.readiness_state.ready");
  if (n >= 2.5) return tr("overview.readiness_state.moderate");
  if (n >= 1.5) return tr("overview.readiness_state.take_it_easy");
  return tr("overview.readiness_state.recovery_recommended");
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
      readinessValue.textContent = tr("status.ready");
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
      latestCheckinLine.textContent = tr("overview.first_time");
    } else if (latestCheckin?.date){
      latestCheckinLine.textContent = tr("overview.latest_checkin", { value: latestCheckin.date });
    } else {
      latestCheckinLine.textContent = tr("overview.no_checkin_yet");
    }
  }

  if (overviewTimeLine){
    if (isFirstTime){
      overviewTimeLine.textContent = tr("overview.start_with_checkin");
    } else if (planItem?.time_budget_min){
      overviewTimeLine.textContent = tr("overview.time_today", { minutes: planItem.time_budget_min });
    } else if (latestCheckin?.time_budget_min){
      overviewTimeLine.textContent = tr("overview.latest_time_budget", { minutes: latestCheckin.time_budget_min });
    } else {
      overviewTimeLine.textContent = tr("overview.no_time_estimate_yet");
    }
  }

  if (overviewWorkoutLine){
    if (isFirstTime){
      overviewWorkoutLine.textContent = tr("overview.no_history_first_point");
    } else if (sessionCount > 0){
      overviewWorkoutLine.textContent = tr("overview.logged_sessions_count", { count: sessionCount });
    } else {
      overviewWorkoutLine.textContent = tr("overview.no_history_yet");
    }
  }
}


function renderProfileEquipmentCard(){
  const displayNameEl = document.getElementById("profileDisplayName");
  const bodyLineEl = document.getElementById("profileBodyLine");
  const trainingTypesLineEl = document.getElementById("profileTrainingTypesLine");
  const trainingDaysLineEl = document.getElementById("profileTrainingDaysLine");
  const equipmentLineEl = document.getElementById("profileEquipmentLine");
  const incrementLineEl = document.getElementById("profileIncrementLine");
  const accountLineEl = document.getElementById("profileAccountLine");
  const accountHelpLineEl = document.getElementById("profileAccountHelpLine");
  const accountBtn = document.getElementById("openAccountSettingsBtn");
  const accountBtn2 = document.getElementById("openAccountSettingsSecondaryBtn");
  const openEquipmentBtn = document.getElementById("openEquipmentSettingsBtn");
  const cancelEquipmentBtn = document.getElementById("cancelEquipmentSettingsBtn");
  const saveEquipmentBtn = document.getElementById("saveEquipmentSettingsBtn");

  const username = AUTH_USER?.username || tr("common.unknown");
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
  const trainingDays = preferences.training_days && typeof preferences.training_days === "object"
    ? preferences.training_days
    : {};
  const weeklyTargetSessions = Number(preferences.weekly_target_sessions || 3) || 3;

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

  const profileBits = [];
  if (profile.height_cm != null && profile.height_cm !== "") profileBits.push(tr("profile.height_value", { value: `${profile.height_cm} cm` }));
  if (profile.bodyweight_kg != null && profile.bodyweight_kg !== "") profileBits.push(tr("profile.bodyweight_value", { value: `${profile.bodyweight_kg} kg` }));

  const selectedTraining = [
    trainingTypes.running ? tr("training_type.run") : "",
    trainingTypes.strength_weights ? tr("training_type.strength") : "",
    trainingTypes.bodyweight ? tr("training_type.bodyweight") : "",
    trainingTypes.mobility ? tr("training_type.mobility") : ""
  ].filter(Boolean);

  const selectedDays = [
    trainingDays.mon ? tr("day.mon") : "",
    trainingDays.tue ? tr("day.tue") : "",
    trainingDays.wed ? tr("day.wed") : "",
    trainingDays.thu ? tr("day.thu") : "",
    trainingDays.fri ? tr("day.fri") : "",
    trainingDays.sat ? tr("day.sat") : "",
    trainingDays.sun ? tr("day.sun") : ""
  ].filter(Boolean);

  if (bodyLineEl){
    bodyLineEl.textContent = profileBits.length
      ? profileBits.join(" · ")
      : tr("profile.no_body_metrics_yet");
  }

  if (trainingTypesLineEl){
    trainingTypesLineEl.textContent = selectedTraining.length
      ? tr("profile.training_types_value", { value: selectedTraining.join(", ") })
      : tr("profile.training_types_none");
  }

  if (trainingDaysLineEl){
    const dayText = selectedDays.length
      ? `Mulige træningsdage: ${selectedDays.join(", ")}`
      : tr("checkin.possible_days_none");
    trainingDaysLineEl.textContent = `${dayText} · ${tr("profile.week_goal_value", { count: weeklyTargetSessions })}`;
  }

  if (equipmentLineEl){
    equipmentLineEl.textContent = enabledEquipment.length
      ? tr("profile.available_equipment_value", { value: formatEquipmentList(enabledEquipment) })
      : tr("profile.no_equipment_yet");
  }

  if (incrementLineEl){
    incrementLineEl.textContent = incrementEntries.length
      ? tr("profile.weight_increment_value", { value: formatLoadIncrements(Object.fromEntries(incrementEntries)) })
      : tr("profile.no_weight_increment_yet");
  }

  if (accountLineEl){
    accountLineEl.textContent = tr("profile.account_value", { value: username });
  }

  if (accountHelpLineEl){
    accountHelpLineEl.textContent = tr("profile.account_help_extended");
  }

  const authHref = `${AUTH_BASE}/account?return_to=${encodeURIComponent(AUTH_RETURN_TO)}&lang=${encodeURIComponent(getCurrentLang())}`;

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
  const trainingDays = preferences.training_days && typeof preferences.training_days === "object"
    ? preferences.training_days
    : {};
  const weeklyTargetSessions = Number(preferences.weekly_target_sessions || 3) || 3;
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

  setChecked("day_mon", trainingDays.mon !== false);
  setChecked("day_tue", trainingDays.tue !== false);
  setChecked("day_wed", trainingDays.wed !== false);
  setChecked("day_thu", trainingDays.thu !== false);
  setChecked("day_fri", trainingDays.fri !== false);
  setChecked("day_sat", trainingDays.sat !== false);
  setChecked("day_sun", trainingDays.sun !== false);
  setVal("weekly_target_sessions", weeklyTargetSessions);

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
    if (status) status.textContent = tr("profile.edit_and_save_when_ready");
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
      },
      training_days: {
        mon: readChecked("day_mon"),
        tue: readChecked("day_tue"),
        wed: readChecked("day_wed"),
        thu: readChecked("day_thu"),
        fri: readChecked("day_fri"),
        sat: readChecked("day_sat"),
        sun: readChecked("day_sun"),
      },
      weekly_target_sessions: Number(document.getElementById("weekly_target_sessions")?.value || 3)
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

async function handleResetCatalogFromSeed(){
  const statusEl = document.getElementById("equipmentSettingsStatus");
  const btn = document.getElementById("resetCatalogFromSeedBtn");
  try{
    if (btn) btn.disabled = true;
    if (statusEl) statusEl.textContent = tr("status.resetting_catalog");
    await apiPost("/api/admin/reset-catalog", {});
    await refreshAll();
    if (statusEl) statusEl.textContent = tr("status.catalog_reset_done");
  }catch(err){
    if (statusEl) statusEl.textContent = tr("status.error_prefix") + ": " + (err?.message || String(err));
  }finally{
    if (btn) btn.disabled = false;
  }
}

function bindEquipmentEditor(){
  const form = document.getElementById("equipmentSettingsForm");
  const saveBtn = document.getElementById("saveEquipmentSettingsBtn");
  const cancelBtn = document.getElementById("cancelEquipmentSettingsBtn");
  const resetBtn = document.getElementById("resetCatalogFromSeedBtn");
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

  if (resetBtn && !resetBtn.dataset.bound){
    resetBtn.dataset.bound = "1";
    resetBtn.onclick = () => handleResetCatalogFromSeed();
  }
}

function updateOverviewLayoutForStep(stepId){
  const overviewSection = document.getElementById("overviewSection");
  if (!overviewSection) return;

  const dailyUiState = deriveDailyUiState(STATE.currentTodayPlan || null, STATE.latestCheckin || null);
  const cards = Array.from(overviewSection.querySelectorAll(":scope > section.card"));

  cards.forEach(card => {
    let keepVisible =
      card.id === "forecastHero" ||
      card.id === "overviewStatusCard" ||
      card.id === "profileEquipmentCard" ||
      card.id === "weekPlanCard";

    if (stepId === "overview" && dailyUiState === "needs_checkin"){
      keepVisible = card.id === "forecastHero";
    }

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
  setText("readinessLabel", `${tr("common.status_label")}: ${item.readiness_label || tr("common.unknown_lower")}`);
  setText("readinessSuggestion", item.suggestion || "");

  let action = "";
  if ((item.readiness_score ?? 0) >= 7){
    action = tr("plan.suggestion_heavy_or_quality");
  } else if ((item.readiness_score ?? 0) >= 5){
    action = tr("plan.suggestion_normal");
  } else {
    action = tr("plan.suggestion_light");
  }

  setText("readinessAction", action);
}




function formatExerciseCategory(value){
  const x = String(value || "").trim().toLowerCase();
  if (!x) return tr("common.unknown_lower");
  const map = {
    posterior_chain: tr("category.posterior_chain"),
    legs: tr("category.legs"),
    run: tr("session_type.run"),
    mobility: tr("session_type.mobility"),
    push: tr("category.push"),
    pull: tr("category.pull"),
    core: tr("category.core"),
    cardio: tr("session_type.cardio")
  };
  return map[x] || x;
}

function formatExerciseName(exerciseId){
  const mapped = {
    restitution_walk: tr("exercise.recovery_walk"),
    mobility: tr("session_type.mobility"),
    cardio_easy: tr("exercise.cardio_easy"),
    cardio_intervals: tr("exercise.cardio_intervals"),
    cardio_session: tr("session_type.cardio"),
    cardio_base: tr("exercise.cardio_base")
  };
  if (mapped[exerciseId]) return mapped[exerciseId];

  const exerciseMap = new Map((STATE.exercises || []).map(x => [x.id, x.name]));
  return exerciseMap.get(exerciseId) || tr("exercise.planned_session");
}

function formatInputKindLabel(value){
  const x = String(value || "").trim().toLowerCase();
  if (x === "bodyweight_reps") return tr("input_kind.bodyweight_reps");
  if (x === "time" || x === "cardio_time") return "Tid";
  if (x === "load_reps") return tr("input_kind.load_reps");
  return x || tr("common.unknown_lower");
}

function formatProgressFlag(flag){
  const raw = String(flag || "").trim();
  if (!raw) return "";

  if (raw.endsWith("_done")){
    const exerciseId = raw.slice(0, -5);
    return tr("after_training.exercise_completed_label", { value: formatExerciseName(exerciseId) });
  }

  if (raw.endsWith("_failure")){
    const exerciseId = raw.slice(0, -8);
    return `${formatExerciseName(exerciseId)} failure`;
  }

  return raw.replaceAll("_", " ");
}

function formatProgressionDecision(value){
  const x = String(value || "").trim().toLowerCase();
  if (!x) return "";
  if (x === "increase") return tr("progression.increase_next_time");
  if (x === "increase_reps") return tr("progression.increase_next_time");
  if (x === "hold") return tr("progression.hold_today");
  if (x === "use_start_weight") return tr("progression.start_weight");
  if (x === "no_progression") return tr("progression.no_auto_progression");
  if (x === "manual_override") return tr("plan.motor.manual_override");
  if (x === "autoplan_cardio_initial") return tr("decision.autoplan_cardio_initial");
  return tr("decision.generic");
}



function formatProgressionReason(value){
  const x = String(value || "").trim();
  if (!x) return "";
  if (x === "Manuel plan valgt som dagens træning") return tr("plan.reason.manual_plan_selected_today");
  if (x === "Manual plan selected as today's training") return tr("plan.reason.manual_plan_selected_today");
  if (x === "autoplan selected a cardio session based on readiness, recovery, and recent cardio load") {
    return tr("plan.reason.cardio_autoplan_selected_today");
  }
  return tr("plan.reason.generic_today_choice");
}

function formatPlanReason(value){
  const x = String(value || "").trim();
  if (!x) return "";
  if (x === "Manuel plan overstyrer dagens autoplan.") return tr("plan.reason.manual_override_today");
  if (x === "Manual plan overrides today's autoplan.") return tr("plan.reason.manual_override_today");
  return tr("plan.reason.generic_today_choice");
}

function formatFatigueText(value){
  const v = String(value || "").trim().toLowerCase();
  if (!v) return tr("common.unknown_lower");
  if (v === "light") return tr("fatigue.light");
  if (v === "moderate") return tr("fatigue.moderate");
  if (v === "high") return tr("fatigue.high");
  return v;
}

function formatTimingState(value){
  const x = String(value || "").trim();
  if (x === "early") return tr("timing.too_early");
  if (x === "on_time") return "";
  if (x === "late") return tr("timing.too_late");
  return x || "";
}

function formatPlanVariant(value){
  const x = String(value || "").trim();
  if (x === "short_20") return tr("plan_variant.short_20");
  if (x === "short_30") return tr("plan_variant.short_30");
  if (x === "full") return tr("plan_variant.full");
  if (x === "default") return tr("plan_variant.standard");
  if (x === "weekly_goal_cap") return tr("plan.motor.weekly_goal_cap");
  if (x === "manual_override") return tr("plan.motor.manual_override");
  if (x === "completed_today") return "";
  return x || "";
}


function formatTarget(value){
  const v = String(value || "").trim();
  if (!v) return "";

  if (v.endsWith("sek")){
    const num = v.replace(/\s*sek\s*$/, "").trim();
    return `${num} ${tr("unit.seconds")}`;
  }

  if (v.includes("/side")){
    const num = v.split("/")[0].trim();
    return `${num}/${tr("unit.per_side")}`;
  }

  return v;
}

function formatPlanMotor(value){
  const x = String(value || "").trim();
  if (x === "weekly_goal_cap") return tr("plan.motor.weekly_goal_cap");
  return x || "";
}


function formatTimingExplanation(value){
  const x = String(value || "").trim();
  if (x === "early") return tr("timing.explanation_early");
  if (x === "on_time") return "";
  if (x === "late") return tr("timing.explanation_late");
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
  const explicit = Array.isArray(meta?.review_rep_options) && meta.review_rep_options.length
    ? meta.review_rep_options
    : null;
  if (explicit) return explicit;

  const repHint = String(meta?.rep_display_hint || "").trim();
  const repOptions = Array.isArray(meta?.rep_options) ? meta.rep_options : [];

  let minRep = 1;
  let maxRep = 20;

  const candidates = [repHint, ...repOptions.map(x => String(x || ""))].join(" ");
  const nums = [...candidates.matchAll(/\d+/g)].map(m => Number(m[0])).filter(Number.isFinite);

  if (nums.length >= 2){
    minRep = Math.max(1, Math.min(...nums) - 2);
    maxRep = Math.min(30, Math.max(...nums) + 2);
  } else if (nums.length === 1){
    minRep = Math.max(1, nums[0] - 2);
    maxRep = Math.min(30, nums[0] + 4);
  }

  const out = [];
  for (let i = minRep; i <= maxRep; i += 1){
    out.push(String(i));
  }
  return out;
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
        <div class="small" style="margin-bottom:8px">${tr("exercise.set_label", { number: setIdx + 1 })}</div>

        <label>
          Tid
          ${buildReviewValueSelect(`review_set_reps_${idx}_${setIdx}`, getReviewTimeOptions(meta), "", "(Vælg tid)")}
        </label>

        <div class="small" style="margin-top:6px">${tr("exercise.load_bodyweight")}</div>
      </div>
    `;
  }

  if (inputKind === "bodyweight_reps"){
    return `
      <div class="card" style="margin-top:10px; padding:12px">
        <div class="small" style="margin-bottom:8px">${tr("exercise.set_label", { number: setIdx + 1 })}</div>

        <label>
          Reps
          ${buildReviewValueSelect(`review_set_reps_${idx}_${setIdx}`, getReviewRepOptions(meta), "", tr("after_training.select_reps"))}
        </label>

        <div class="small" style="margin-top:6px">${tr("exercise.load_bodyweight")}</div>
      </div>
    `;
  }

  return `
    <div class="card" style="margin-top:10px; padding:12px">
      <div class="small" style="margin-bottom:8px">${tr("exercise.set_label", { number: setIdx + 1 })}</div>

      <label>
        Reps
        ${buildReviewValueSelect(`review_set_reps_${idx}_${setIdx}`, getReviewRepOptions(meta), "", tr("after_training.select_reps"))}
      </label>

      <label>
        ${esc(tr("load.title"))}
        ${buildReviewValueSelect(`review_set_load_${idx}_${setIdx}`, getReviewLoadOptions(meta), currentLoad, meta?.load_optional ? "(Tom = kropsvægt)" : tr("workout.load_placeholder"))}
      </label>

      ${meta?.load_optional && meta?.supports_bodyweight ? `<div class="small" style="margin-top:6px">Tom belastning tolkes som kropsvægt.</div>` : ""}
    </div>
    <div style="margin-top:14px">
      <button type="button" id="reviewDoneBtn">
        ${esc(tr("button.done_for_today"))}
      </button>
    </div>
  `;

  const doneBtn = document.getElementById("reviewDoneBtn");
  if (doneBtn){
    doneBtn.addEventListener("click", () => {
      showWizardStep("overview");
    });
  }
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
      ? tr("review.rpe_selected", { value: normalized, text: RPE_HELP[normalized] || "" })
      : tr("review.rpe_help");
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
  const form = document.getElementById("sessionResultForm");
  if (form){
    form.classList.remove("wizard-step-hidden");
    form.querySelectorAll("input, select, textarea").forEach(el => {
      el.disabled = false;
    });
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn){
      submitBtn.disabled = false;
      submitBtn.style.display = "";
      submitBtn.textContent = tr("after_training.save_session_result");
    }
  }
  if (!root) return;

  if (!item || !Array.isArray(item.entries) || item.entries.length === 0){
    root.innerHTML = `<li><div class="small">${esc(tr("after_training.no_exercises_to_review"))}</div></li>`;
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
            ${tr("exercise.target_colon")} ${entry.target_reps ? esc(entry.target_reps) : tr("session_type.cardio")}
          </div>
          <div class="small" style="margin-bottom:10px">
            ${tr("common.type_label")}: ${tr("session_type.run")}
          </div>
          <label>
            ${esc(tr("after_training.session_note_label"))}
            <input type="text" name="review_notes_${idx}" placeholder="${esc(tr("after_training.short_note_placeholder_cardio"))}">
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
          ${tr("exercise.target_colon")} ${entry.sets ? tr("exercise.sets_count", { count: esc(entry.sets) }) : ""}${entry.target_reps ? ` · ${esc(entry.target_reps)}` : ""}${entry.target_load ? ` · ${esc(entry.target_load)}` : ""}
        </div>

        <div class="small" style="margin-bottom:10px">
          ${tr("common.type_label")}: ${esc(formatInputKindLabel(inputKind))}
        </div>

        ${isTime || isBodyweight ? `<div class="small" style="margin-bottom:10px">${tr("exercise.load_bodyweight")}</div>` : ""}
        ${meta?.rep_display_hint ? `<div class="small" style="margin-bottom:10px">${esc(meta.rep_display_hint)}</div>` : ""}

        ${setFields}

        <label>
          ${esc(tr("after_training.fail_label"))}
          <select name="review_hit_failure_${idx}">
            <option value="false" selected>${esc(tr("common.no"))}</option>
            <option value="true">${esc(tr("common.yes"))}</option>
          </select>
        </label>

        <label>
          ${esc(tr("exercise.note_label"))}
          <input type="text" name="review_notes_${idx}" placeholder="${esc(tr("exercise.note_placeholder_example"))}">
        </label>
      </li>
    `;
  }).join("");
}



function renderReviewSummary(item){
  const root = document.getElementById("reviewPlanSummary");
  if (!root) return;

  if (!item || !Array.isArray(item.entries) || item.entries.length === 0){
    root.innerHTML = `<div class="small">${esc(tr("after_training.no_plan_to_review"))}</div>`;
    return;
  }

  root.innerHTML = `
    <div class="small" style="margin-bottom:6px">
      ${esc(formatSessionType(item.session_type || ""))}${item.time_budget_min ? ` · ${esc(item.time_budget_min)} min` : ""}${item.readiness_score != null ? ` · readiness ${esc(item.readiness_score)}` : ""}
    </div>
    <div class="small">
      ${item.entries.map(entry => {
        const bits = [];
        if (entry.sets) bits.push(tr("exercise.sets_count", { count: esc(entry.sets) }));
        if (entry.target_reps) bits.push(tr("exercise.target_label", { value: formatTarget(entry.target_reps) }));
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

  const sessionType = summary.session_type ? formatSessionType(summary.session_type) : tr("common.unknown_title");
  const sessionTypeKey = String(summary.session_type || "").trim().toLowerCase();
  const fatigue = String(summary.fatigue || "").trim() || tr("common.unknown_lower");
  const fatigueText = formatFatigueText(fatigue);
  const nextStepHint = String(summary.next_step_hint || "").trim();
  const progressFlags = Array.isArray(summary.progress_flags) ? summary.progress_flags : [];

  if (sessionTypeKey === "løb" || sessionTypeKey === "cardio" || sessionTypeKey === "run"){
    const cardioKind = String(summary.cardio_kind || "").trim();
    const distanceKm = Number(summary.distance_km || 0);
    const durationTotalSec = Number(summary.duration_total_sec || 0);
    const paceSecPerKm = Number(summary.pace_sec_per_km || 0);

    const distanceText = distanceKm > 0 ? String(distanceKm) : "-";
    const durationText = durationTotalSec > 0 ? formatDurationFromSeconds(durationTotalSec) : "-";
    const paceText = paceSecPerKm > 0 ? formatPaceFromSeconds(paceSecPerKm) : "-";

    root.innerHTML = `
      <div style="font-weight:700; margin-bottom:10px; color:#4ade80">✔ ${esc(tr("after_training.session_completed_title"))}</div>
      <div class="small" style="margin-bottom:8px">
        ${esc(sessionType)}${cardioKind ? ` · ${esc(formatCardioKindLabel(cardioKind))}` : ""} · ${esc(tr("after_training.fatigue_label"))} ${esc(fatigueText)}
      </div>
      <div class="small" style="margin-bottom:8px">
        ${esc(tr("cardio.review.distance_label"))}: ${esc(distanceText)} km<br>
        ${esc(tr("cardio.review.duration_label"))}: ${esc(durationText)}<br>
        ${esc(tr("cardio.review.actual_pace_label"))}: ${esc(paceText)}
      </div>
      <div class="small" style="margin-bottom:8px">
        ${tr("history.next_step_label")}: ${esc(nextStepHint || tr("common.no_recommendation"))}
      </div>
      <div class="small">
        ${progressFlags.length ? esc(progressFlags.map(formatProgressFlag).join(", ")) : tr("history.no_progress_flags")}
      </div>
    `;
    return;
  }

  const completedExercises = Number(summary.completed_exercises || 0);
  const totalExercises = Number(summary.total_exercises || 0);
  const totalSets = Number(summary.total_sets || 0);
  const totalReps = Number(summary.total_reps || 0);
  const estimatedVolume = Number(summary.estimated_volume || 0);
  const hitFailureCount = Number(summary.hit_failure_count || 0);

  root.innerHTML = `
    <div style="font-weight:700; margin-bottom:10px; color:#4ade80">✔ ${esc(tr("after_training.session_completed_title"))}</div>
    <div class="small" style="margin-bottom:8px">
      ${esc(sessionType)} · ${esc(tr("after_training.fatigue_label"))} ${esc(fatigueText)}
    </div>
    <div class="small" style="margin-bottom:8px">
      ${esc(tr("after_training.completed_exercises_label"))}: ${esc(String(completedExercises))}/${esc(String(totalExercises))}<br>
      Sæt: ${esc(String(totalSets))}<br>
      Reps: ${esc(String(totalReps))}<br>
      Estimeret volumen: ${esc(String(estimatedVolume))}<br>
      Failure-markører: ${esc(String(hitFailureCount))}
    </div>
    <div class="small" style="margin-bottom:8px">
      ${tr("history.next_step_label")}: ${esc(nextStepHint || tr("common.no_recommendation"))}
    </div>
    <div class="small">
      ${progressFlags.length ? esc(progressFlags.map(formatProgressFlag).join(", ")) : tr("history.no_progress_flags")}
    </div>
  `;
}


function formatPlanActionText(entry){
  const decision = String(entry?.progression_decision || "").trim();
  const load = String(entry?.target_load || "").trim();
  const nextTarget = String(entry?.next_target_reps || "").trim();

  if (decision === "increase"){
    return load ? tr("plan.action.use_load_today", { load }) : tr("plan.action.increase_load_today");
  }
  if (decision === "increase_reps"){
    return nextTarget ? `Næste mål: ${nextTarget}` : "Øg reps næste gang";
  }
  if (decision === "hold"){
    return load ? `Hold ${load} i dag` : "Hold nuværende belastning i dag";
  }
  if (decision === "use_start_weight"){
    return load ? tr("plan.action.use_start_weight_with_load", { load }) : tr("plan.action.use_start_weight_today");
  }
  if (decision === "no_progression"){
    return tr("progression.no_automatic_progression");
  }
  return load ? tr("plan.action.use_load_today", { load }) : tr("plan.action.follow_plan_today");
}

function formatPlanProgressionExtra(entry){
  const bits = [];

  if (entry?.substituted_from){
    bits.push(`${tr("exercise.substituted_from")}: ${formatExerciseName(entry.substituted_from)}`);
  }
  if (entry?.recommended_next_load != null){
    bits.push(`${tr("exercise.ideal_next_load")}: ${entry.recommended_next_load} kg`);
  }
  if (entry?.actual_possible_next_load != null){
    bits.push(`${tr("exercise.next_possible_with_equipment")}: ${entry.actual_possible_next_load} kg`);
  }

  return bits;
}



function formatRecoveryState(value){
  const v = String(value || "").trim();
  const map = {
    ready: tr("recovery_state.ready"),
    caution: tr("recovery_state.caution"),
    recover: tr("session_type.recovery")
  };
  return map[v] || (v || tr("common.unknown_title"));
}



function formatFamilyState(value){
  const v = String(value || "").trim();
  const map = {
    fatigued: "Træt",
    stable: "Stabil",
    ready: tr("recovery_state.ready"),
    unknown: tr("common.unknown_title")
  };
  return map[v] || (v || tr("common.unknown_title"));
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
  return map[v] || (v || tr("common.unknown_title"));
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
      imagesEl.innerHTML = `<div class="small">${tr("exercise.no_images")}</div>`;
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
    const exName = exMeta?.name || exId || tr("common.unknown_lower");
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
  const x = String(decisionObj.decision_label || "").trim();
  if (!x) return "";
  if (x === "autoplan_cardio_initial") return tr("decision.autoplan_cardio_initial");
  if (x === "manual_override") return tr("plan.motor.manual_override");
  return tr("decision.generic");
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
              >${esc(tr("button.view_exercise"))}</button>
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

function formatWeeklyStatusText(weeklyStatus){
  const ws = weeklyStatus && typeof weeklyStatus === "object" ? weeklyStatus : {};
  const completed = Number(ws.completed_sessions || 0);
  const target = Number(ws.weekly_target_sessions || 0);
  const remainingCalendarDays = Number(ws.allowed_days_remaining || 0);
  const remainingToGoal = Math.max(target - completed, 0);

  if (!target) return "";

  if (completed >= target){
    return tr("today_plan.week_status_goal_reached", { completed, target });
  }

  return tr("weekplan.status_summary", { completed, target, remaining: remainingToGoal, days: remainingCalendarDays });
}

function renderTodayPlan(item){
  STATE.currentTodayPlan = item || null;
  const root = document.getElementById("todayPlanList");
  if (!root) return;

  if (!item){
    setText("todayPlanMeta", "");
    setText("todayPlanTiming", tr("today_plan.no_timing_yet"));
    setText("todayPlanSummary", tr("today_plan.no_plan_yet_after_checkin"));
    root.innerHTML = `<li><div class="small">${esc(tr("today_plan.no_plan_yet_help"))}</div></li>`;
      renderReviewSummary(null);
      renderSessionReview(null);
      return;
  }

  setText("todayPlanMeta", item.recommended_for || "");
  const variantLabel = formatPlanVariant(item.plan_variant || "");
  const timingLabel = formatTimingState(item.timing_state || "");
  const timingExplanation = formatTimingExplanation(item.timing_state || "");
  const timeLabel = item.time_budget_min ? ` · ${tr("overview.time_today_short", { minutes: item.time_budget_min })}` : "";
  const variantText = variantLabel ? ` · ${tr("plan.variant_label", { value: variantLabel })}` : "";

  setText(
    "todayPlanTiming",
    timingLabel ? tr("plan.timing_label", { value: `${timingLabel}${timingExplanation ? ` · ${timingExplanation}` : ""}` }) : tr("today_plan.no_timing_yet")
  );

  const recovery = item && item.recovery_state && typeof item.recovery_state === "object" ? item.recovery_state : null;
  const recoveryLabel = recovery ? formatRecoveryState(recovery.recovery_state || "") : "";
  const recoveryText = recoveryLabel ? ` · ${tr("today_plan.recovery_label", { value: `${recoveryLabel}${recovery.recovery_score != null ? ` (${recovery.recovery_score})` : ""}` })}` : "";

  const templateMode = String(item?.template_mode || "").trim();
  const planMotorLabel =
    templateMode === "autoplan_v0_1" || templateMode === "autoplan_cardio_v0_1"
      ? tr("plan.motor.autoplan")
      : templateMode === "weekly_goal_cap_v0_1"
        ? formatPlanMotor("weekly_goal_cap")
        : templateMode === "manual_override_v0_1"
          ? tr("plan.motor.manual_override")
          : templateMode === "completed_today_v0_1"
            ? tr("plan.motor.completed_today")
            : tr("plan.motor.fixed_plan");
  const familiesSelectedText = formatFamiliesSelected(item?.families_selected || []);
  const trainingCtx = item?.training_day_context && typeof item.training_day_context === "object" ? item.training_day_context : {};
  const trainingDaysText = formatTrainingDays(trainingCtx.training_days || []);
  const trainingDaySummary = trainingDaysText ? tr("plan.training_days_summary", { value: trainingDaysText }) : "";
  const todayWeekPlanItem = getTodayWeekPlanItem(item);
  const todayWeekKind = String(todayWeekPlanItem?.kind || "").trim().toLowerCase();
  const actualKind = String(item?.session_type || "").trim().toLowerCase();

  let trainingAllowedSummary = "";
  if (todayWeekKind === "rest"){
    trainingAllowedSummary = tr("plan.weekplan_rest_today");
  } else if (todayWeekKind && todayWeekKind !== actualKind){
    const plannedLabel = formatSessionType(todayWeekPlanItem?.kind || todayWeekPlanItem?.kindLabel || "");
    trainingAllowedSummary = tr("plan.weekplan_adjusted_today", { value: plannedLabel });
  } else if (todayWeekKind){
    const plannedLabel = formatSessionType(todayWeekPlanItem?.kind || todayWeekPlanItem?.kindLabel || "");
    trainingAllowedSummary = tr("plan.weekplan_planned_label", { value: plannedLabel });
  }

  const ws = item?.weekly_status || {};
  const weeklyStatusSummary = formatWeeklyStatusText(item?.weekly_status);
  const baseSummary = `${tr("common.type")}: ${formatSessionType(item.session_type || "unknown")} · ${tr("overview.readiness")}: ${item.readiness_score ?? "-"}${timeLabel}${variantText}${recoveryText}`;
  const recoveryDaySummary = String(item?.session_type || "").trim().toLowerCase() === "restitution"
    ? tr("plan.light_movement_today")
    : "";
  const motorSummary = tr("plan.motor_summary", { value: planMotorLabel });
  const familiesSummary = familiesSelectedText ? tr("plan.selected_families", { value: familiesSelectedText }) : "";

  const decisionTrace = item?.decision_trace && typeof item.decision_trace === "object" ? item.decision_trace : null;
  const decisionBits = [];
  if (decisionTrace?.rule_applied) {
    decisionBits.push(tr("decision_trace.rule", { value: decisionTrace.rule_applied }));
  }
  if (decisionTrace?.readiness_bucket) {
    decisionBits.push(tr("decision_trace.readiness_bucket", { value: decisionTrace.readiness_bucket }));
  }
  if (decisionTrace?.fatigue_bucket) {
    decisionBits.push(tr("decision_trace.fatigue_bucket", { value: decisionTrace.fatigue_bucket }));
  }
  if (decisionTrace?.timing) {
    decisionBits.push(tr("decision_trace.timing", { value: decisionTrace.timing }));
  }
  if (decisionTrace?.override) {
    decisionBits.push(tr("decision_trace.override", { value: decisionTrace.override }));
  }
  const decisionTraceSummary = decisionBits.length ? decisionBits.join(" · ") : "";

  setText(
    "todayPlanSummary",
    [
      baseSummary,
      recoveryDaySummary,
      trainingAllowedSummary,
      weeklyStatusSummary
    ]
      .filter(Boolean)
      .join("\n")
  );

  if (!Array.isArray(item.entries) || item.entries.length === 0){
    root.innerHTML = `<li><div class="small">${esc(tr("plan.no_concrete_exercises"))}</div></li>`;
      renderReviewSummary(item);
      renderSessionReview(item);
      return;
  }

  const heroCard = `
  <li>
    <div style="font-weight:700; font-size:1.1rem">${esc(formatSessionType(item.session_type || "unknown"))}</div>
    <div class="small" style="margin-top:6px">
      ${esc([
        variantLabel || "",
        item.time_budget_min ? tr("overview.time_today_short", { minutes: item.time_budget_min }) : ""
      ].filter(Boolean).join(" · "))}
    </div>
    ${item.reason ? `<div class="small" style="margin-top:8px">${esc(formatPlanReason(item.reason || ""))}</div>` : ""}
    <div style="margin-top:12px">
      <button type="button" id="startWorkoutBtn">${esc(tr("button.start_workout"))}</button>
    </div>
  </li>
`;
  
  const recoveryCard = recovery ? `
    <li>
      <div style="font-weight:700">Recovery</div>
      <div style="margin-top:6px; font-size:1.35rem; font-weight:700">${esc(String(recovery.recovery_score ?? "-"))}</div>
      <div class="small" style="margin-top:6px">${tr("common.status_label")}: ${esc(formatRecoveryState(recovery.recovery_state || ""))}</div>
      <div class="small" style="margin-top:6px">${recovery.strain_flag ? tr("recovery.strain_flag_active") : tr("recovery.strain_flag_inactive")}</div>
      ${Array.isArray(recovery.explanation) && recovery.explanation.length ? `<div class="small" style="margin-top:6px">${tr("common.why_label")}: ${esc(recovery.explanation.join(" · "))}</div>` : ""}
    </li>
  ` : "";

  root.innerHTML = heroCard + recoveryCard + item.entries.map(entry => {
      const extras = formatPlanProgressionExtra(entry);
      return `
      <li>
        <div class="row">
          <strong>${esc(formatExerciseName(entry.exercise_id))}</strong>
          <span class="small">${esc(formatProgressionDecision(entry.progression_decision || ""))}</span>
        </div>
        <div style="margin-top:6px; font-weight:600">${esc(formatPlanActionText(entry))}</div>
        <div class="small">
          ${entry.sets ? tr("exercise.sets_count", { count: esc(entry.sets) }) : ""}
          ${entry.target_reps ? ` · ${tr("exercise.target_label", { value: formatTarget(entry.target_reps) })}` : ""}
        </div>
        ${entry.progression_reason ? `<div class="small" style="margin-top:6px">${tr("common.reason_label")}: ${esc(formatProgressionReason(entry.progression_reason))}</div>` : ""}
        ${
          entry.decision && typeof entry.decision === "object" && formatDecisionLabel(entry.decision)
            ? `<div class="small" style="margin-top:6px"><strong>${tr("common.decision_label")}:</strong> ${esc(formatDecisionLabel(entry.decision))}</div>`
            : ""
        }
        ${extras.map(x => `<div class="small" style="margin-top:6px">${esc(x)}</div>`).join("")}
        <div style="margin-top:10px">
          <button type="button" class="secondary" data-exercise-viewer="${esc(entry.exercise_id || "")}" style="width:auto;padding:8px 12px">${esc(tr("button.view_exercise"))}</button>
        </div>
        ${entry.equipment_constraint ? `<div class="small" style="margin-top:6px">Udstyr: næste mulige spring er højere end anbefalet.</div>` : ""}
      </li>
      `;
    }).join("");

  document.getElementById("startWorkoutBtn")?.addEventListener("click", () => {
    showWizardStep("review");
  });

  renderReviewSummary(item);
  renderSessionReview(item);
}

function renderPrograms(programs, exercises){
  const root = document.getElementById("programsRoot");
  if (!root) return;

  const exerciseMap = new Map((Array.isArray(exercises) ? exercises : []).map(x => [x.id, x]));

  if (!Array.isArray(programs) || programs.length === 0){
    root.innerHTML = `<div class="small">Ingen programmer endnu.</div>`;
    setText("programMeta", tr("common.items_count", { count: 0 }));
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
              const name = found.name || formatExerciseName(ex.exercise_id || "") || ex.exercise_id || tr("common.unknown_lower");
              return `
                <li>
                  <div class="row">
                    <strong>${esc(name)}</strong>
                    <span class="small">${tr("exercise.sets_by_reps", { sets: esc(ex.sets ?? ""), reps: esc(ex.reps ?? "") })}</span>
                  </div>
                </li>
              `;
            }).join("")}
          </ul>
        </div>
      `).join("")}
    </div>
  `).join("");

  setText("programMeta", tr("common.items_count", { count: programs.length }));
}

async function refreshAll(){
  const debug = {};
  const [workoutsFile, runs, recoveryFile, programs, exercises, userSettingsApi, workoutsApi, recoveryApi, latestRecoveryApi, todayPlanApi, sessionResultsApi] = await Promise.all([
    getJson(FILES.workouts),
    getJson(FILES.runs),
    getJson(FILES.recovery),
    getJsonOrSeed(FILES.programs, FILES.seed_programs),
    getJsonOrSeed(FILES.exercises, FILES.seed_exercises),
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
  STATE.latestCheckin = latestRecoveryApi.item || null;
  STATE.currentTodayPlan = todayPlanApi.item || null;

  const settings = STATE.userSettings && typeof STATE.userSettings === "object" ? STATE.userSettings : {};
  const preferences = settings.preferences && typeof settings.preferences === "object" ? settings.preferences : {};
  const trainingTypes = preferences.training_types && typeof preferences.training_types === "object"
    ? preferences.training_types
    : {};
  const weeklyTargetSessions = Number(preferences.weekly_target_sessions || 3) || 3;

  const wantsStrength = trainingTypes.strength_weights !== false || trainingTypes.bodyweight !== false;
  const wantsRunning = trainingTypes.running === true;
  const wantsMobility = trainingTypes.mobility === true;

  const filteredPrograms = (STATE.programs || []).filter(p => {
    const kind = String(p?.kind || "").trim().toLowerCase();
    if (wantsStrength && kind === "styrke") return true;
    if (wantsRunning && kind === "løb") return true;
    if (wantsMobility && (kind === "mobilitet" || kind === "restitution")) return true;
    return false;
  });

  const visiblePrograms = filteredPrograms.length ? filteredPrograms : (STATE.programs || []);
  fillSelect("program_id", visiblePrograms, x => x.id, x => x.name, "(Intet program)");

  const programSelectEl = document.getElementById("program_id");
  if (programSelectEl && !programSelectEl.value){
    const ids = new Set(visiblePrograms.map(x => x && x.id).filter(Boolean));
    let preferredProgramId = "";

    const wantsMobilityOnly =
      wantsMobility &&
      !wantsRunning &&
      !wantsStrength;

    if (wantsMobilityOnly && ids.has("mobility_basic")){
      preferredProgramId = "mobility_basic";
    } else if (wantsRunning && !wantsStrength){
      if (weeklyTargetSessions >= 3 && ids.has("base_run_3x")){
        preferredProgramId = "base_run_3x";
      } else if (ids.has("starter_run_2x")){
        preferredProgramId = "starter_run_2x";
      }
    } else if (wantsStrength){
      if (ids.has("starter_strength_2x")){
        preferredProgramId = "starter_strength_2x";
      } else if (ids.has("base_strength_a")){
        preferredProgramId = "base_strength_a";
      }
    } else if (ids.has("starter_strength_2x")){
      preferredProgramId = "starter_strength_2x";
    }

    if (preferredProgramId){
      programSelectEl.value = preferredProgramId;
    }
  }
  fillSelect("entry_exercise_id", STATE.exercises, x => x.id, x => x.name, tr("workout.no_exercise_selected"));
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
  renderWeekPlanPreview(todayPlanApi.item || null);
    renderOverviewStatus(todayPlanApi.item || null, latestRecoveryApi.item || null, workoutsApi.items || []);
  renderProfileEquipmentCard();
    renderTodayPlan(todayPlanApi.item || null);
  renderPrograms(STATE.programs, STATE.exercises);
  renderPendingEntries();

  const dailyUiState = deriveDailyUiState(todayPlanApi.item || null, latestRecoveryApi.item || null);

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
  debug.daily_ui_state = dailyUiState;

  setText("status", "Frontend + API OK");
  document.getElementById("status")?.classList.add("ok");
  setText("debug", JSON.stringify(debug, null, 2));

  return {
    dailyUiState,
    defaultStep: getDefaultWizardStepForDailyState(todayPlanApi.item || null, latestRecoveryApi.item || null)
  };
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
          : tr("manual_workout.bodyweight_no_load_suggestion"));
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
    setText("recoveryFormStatus", tr("status.calculating"));
    statusEl?.classList.remove("warn");
    await apiPost("/api/checkin", payload);
    setText("recoveryFormStatus", tr("status.checkin_saved_updated"));
    statusEl?.classList.add("ok");
    form.reset();
    form.recovery_date.value = new Date().toISOString().slice(0,10);
    form.sleep_score.value = "3";
    form.energy_score.value = "3";
    form.soreness_score.value = "2";
    form.time_budget_min.value = "45";
    await refreshAll();
    advanceWizardAfterCheckin();
  }catch(err){
    setText("recoveryFormStatus", tr("status.error_prefix") + (err?.message || String(err)));
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
    await refreshAll();
    showWizardStep("review");
    renderSessionResultSummary(res?.summary || null);
    setText("sessionResultStatus", "Session-resultat gemt.");
    statusEl?.classList.add("ok");
    form.querySelectorAll("input, select, textarea").forEach(el => {
      el.disabled = true;
    });
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn){
      submitBtn.disabled = true;
      submitBtn.textContent = "Session gemt";
      submitBtn.style.display = "none";
    }
    form.classList.add("wizard-step-hidden");
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

  const username = AUTH_USER?.username || tr("common.unknown");
  bar.innerHTML = `
    <div style="color:#b9b9b9;font-size:.95rem">
      ${esc(tr("auth.logged_in_as"))} <strong style="color:#f3f3f3">${esc(username)}</strong>
    </div>
    <button id="logoutBtn" type="button" style="width:auto;padding:8px 12px">${esc(tr("auth.logout"))}</button>
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
  showAuthMessage(tr("auth.checking_login"));

  let res;
  try{
    res = await fetch(`${AUTH_BASE}/api/auth/me`, {
      method: "GET",
      credentials: "include",
      cache: "no-store"
    });
  }catch(err){
    showAuthMessage(tr("auth.could_not_contact"));
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
    showAuthMessage(tr("auth.must_change_password"));
    location.href = `${AUTH_BASE}/account?return_to=${encodeURIComponent(AUTH_RETURN_TO)}&lang=${encodeURIComponent(getCurrentLang())}`;
    return null;
  }
  showAuthMessage(`${tr("auth.logged_in_as")} ${data.user?.username || tr("auth.user")}. ${tr("auth.loading_app")}`);
  return data.user || null;
}




const WIZARD_STEPS = [
  { id: "overview", labelKey: "wizard.overview" },
  { id: "checkin", labelKey: "wizard.checkin" },
  { id: "plan", labelKey: "wizard.plan" },
  { id: "review", labelKey: "wizard.review" },
  { id: "manual", labelKey: "wizard.manual" },
  { id: "history", labelKey: "wizard.history" },
];

function getWizardStepLabel(step){
  const key = String(step?.labelKey || step?.label || "").trim();
  const translated = key ? tr(key) : "";
  if (translated && translated !== key) return translated;

  const lang = getCurrentLang();
  const fallback = {
    da: {
      "wizard.overview": "Overblik",
      "wizard.checkin": "Check-in",
      "wizard.plan": "Dagens plan",
      "wizard.review": "Efter træning",
      "wizard.manual": "Manuel træning",
      "wizard.history": "Historik"
    },
    en: {
      "wizard.overview": "Overview",
      "wizard.checkin": "Check-in",
      "wizard.plan": "Today's plan",
      "wizard.review": "After training",
      "wizard.manual": "Manual workout",
      "wizard.history": "History"
    }
  };

  return fallback[lang]?.[key] || fallback.da[key] || key;
}

let CURRENT_STEP = "";

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

  const flow = ["checkin", "plan", "review"];
  const currentIndex = flow.indexOf(CURRENT_STEP);

  root.innerHTML = flow.map((stepId, idx) => {
    const step = WIZARD_STEPS.find(x => x.id === stepId);
    const label = getWizardStepLabel(step);

    const stateClass =
      idx < currentIndex ? "is-complete" :
      idx === currentIndex ? "is-active" :
      "is-upcoming";

    return `
      <button
        type="button"
        data-step="${esc(stepId)}"
        class="${stateClass}"
      >
        ${esc(label)}
      </button>
    `;
  }).join("");

  root.querySelectorAll("[data-step]").forEach(btn => {
    btn.addEventListener("click", () => {
      showWizardStep(btn.getAttribute("data-step"));
    });
  });
}

function updateReviewHeadingForStep(stepId){
  const heading = document.getElementById("sessionReviewHeading");
  if (!heading) return;
  heading.textContent = stepId === "review" ? tr("review.session_review") : tr("review.finish_today_plan");
}


function updatePlanHeadingForStep(stepId){
  const heading = document.getElementById("todayPlanHeading");
  const meta = document.getElementById("todayPlanMeta");
  if (heading){
    heading.textContent = stepId === "review" ? tr("wizard.after_training") : tr("today_plan.title");
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
  requestAnimationFrame(() => {
    const groups = getWizardSections();
    const firstNode = (groups[stepId] || []).find(Boolean);
    if (firstNode && typeof firstNode.scrollIntoView === "function"){
      firstNode.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
}

function advanceWizardAfterCheckin(){
  showWizardStep("plan");
}


async function boot(){
  try{
    if (window.I18N){
      await window.I18N.load(localStorage.getItem("ss_lang") || "da");
    }
    applyStaticTranslations();
    renderAuthBar();
    await initLanguageToggle();

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

    await rerenderUiAfterLanguageChange();
    initSystemInfoToggle();
  }catch(err){
    setText("status", "Fejl: " + (err?.message || String(err)));
    setText("debug", String(err?.stack || err));
  }
}

(async () => {
  try{
    const authUser = await ensureAuthOrRedirect();
    if (!authUser) return;
    await boot();
  }catch(err){
    setText("status", "Fejl før opstart: " + (err?.message || String(err)));
    setText("debug", String(err?.stack || err));
  }
})();


function initSystemInfoToggle(){
  const btn = document.getElementById("toggleSystemInfo");
  const content = document.getElementById("systemInfoContent");
  if (!btn || !content) return;

  const saved = localStorage.getItem("systemInfoHidden");
  const hidden = saved === null ? true : saved === "true";

  if (hidden){
    content.style.display = "none";
    btn.textContent = tr("button.show");
  } else {
    content.style.display = "";
    btn.textContent = tr("button.hide");
  }

  if (!btn.dataset.bound){
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      const isHidden = content.style.display === "none";
      if (isHidden){
        content.style.display = "";
        btn.textContent = tr("button.hide");
        localStorage.setItem("systemInfoHidden", "false");
      } else {
        content.style.display = "none";
        btn.textContent = tr("button.show");
        localStorage.setItem("systemInfoHidden", "true");
      }
    });
  }
}




const CHECKIN_SCORE_META = {
  sleep_score: {
    title: "checkin.sleep",
    help: "checkin.sleep_desc",
    options: {
      1: "checkin.scale.very_bad",
      2: "checkin.scale.bad",
      3: "checkin.scale.okay",
      4: "checkin.scale.good",
      5: "checkin.scale.very_good"
    }
  },
  energy_score: {
    title: "checkin.energy",
    help: "checkin.energy_desc",
    options: {
      1: "checkin.energy_scale.empty",
      2: "checkin.energy_scale.low",
      3: "checkin.energy_scale.noticeable",
      4: "checkin.energy_scale.high",
      5: "checkin.energy_scale.very_high"
    }
  },
  soreness_score: {
    title: "checkin.soreness",
    help: "checkin.soreness_desc",
    options: {
      1: "checkin.soreness_scale.none",
      2: "checkin.soreness_scale.light",
      3: "checkin.energy_scale.noticeable",
      4: "checkin.soreness_scale.high",
      5: "checkin.soreness_scale.very_high"
    }
  }
};

function ensureCheckinScoreStyles(){
  if (document.getElementById("checkinScoreStyles")) return;

  const style = document.createElement("style");
  style.id = "checkinScoreStyles";
  style.textContent = `
    .checkin-score-wrap {
      margin-top: 10px;
      margin-bottom: 12px;
    }
    .checkin-score-title {
      font-weight: 600;
      margin-bottom: 6px;
    }
    .checkin-score-help {
      font-size: 0.9rem;
      opacity: 0.85;
      margin-bottom: 8px;
    }
    .checkin-score-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
    }
    .checkin-score-btn {
      min-width: 44px;
      padding: 8px 10px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(255,255,255,0.04);
      color: inherit;
      cursor: pointer;
      font: inherit;
      transition: transform 120ms ease, border-color 120ms ease, background 120ms ease, box-shadow 120ms ease;
    }
    .checkin-score-btn:hover {
      transform: translateY(-1px);
    }
    .checkin-score-btn.score-red {
      background: rgba(220, 70, 70, 0.14);
      border-color: rgba(220, 70, 70, 0.35);
    }
    .checkin-score-btn.score-orange {
      background: rgba(230, 140, 60, 0.14);
      border-color: rgba(230, 140, 60, 0.35);
    }
    .checkin-score-btn.score-yellow {
      background: rgba(220, 185, 70, 0.14);
      border-color: rgba(220, 185, 70, 0.35);
    }
    .checkin-score-btn.score-lightgreen {
      background: rgba(110, 185, 95, 0.14);
      border-color: rgba(110, 185, 95, 0.35);
    }
    .checkin-score-btn.score-green {
      background: rgba(70, 170, 110, 0.16);
      border-color: rgba(70, 170, 110, 0.35);
    }
    .checkin-score-btn.is-active {
      font-weight: 700;
      box-shadow: 0 0 0 2px rgba(255,255,255,0.16) inset;
      border-color: rgba(255,255,255,0.45);
    }
    .checkin-score-value {
      font-size: 0.9rem;
      opacity: 0.9;
      min-height: 1.2em;
    }
    .checkin-score-hidden {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

function enhanceCheckinScoreField(fieldId){
  const meta = CHECKIN_SCORE_META[fieldId];
  const field = document.getElementById(fieldId);
  if (!meta || !field) return;

  if (document.getElementById(`checkin_wrap_${fieldId}`)) return;

  const label = field.closest("label");
  if (!label) return;

  label.classList.add("checkin-score-hidden");

  const wrap = document.createElement("div");
  wrap.className = "checkin-score-wrap";
  wrap.id = `checkin_wrap_${fieldId}`;

  const title = document.createElement("div");
  title.className = "checkin-score-title";
  title.textContent = tr(meta.title);

  const help = document.createElement("div");
  help.className = "checkin-score-help";
  help.textContent = tr(meta.help);

  const row = document.createElement("div");
  row.className = "checkin-score-row";

  const valueLine = document.createElement("div");
  valueLine.className = "checkin-score-value";
  valueLine.id = `checkin_value_${fieldId}`;

  function syncButtons(){
    const current = String(field.value || "").trim();
    row.querySelectorAll("button").forEach(btn => {
      const isActive = btn.dataset.value === current;
      btn.classList.toggle("is-active", isActive);
    });

    const text = meta.options[current] ? tr(meta.options[current]) : "";
    valueLine.textContent = current && text ? tr("checkin.selected_value", { value: current, text }) : "";
  }

  const getScoreClass = (fieldId, value) => {
    const n = Number(value);
    const normal = {
      1: "score-red",
      2: "score-orange",
      3: "score-yellow",
      4: "score-lightgreen",
      5: "score-green"
    };
    const reversed = {
      1: "score-green",
      2: "score-lightgreen",
      3: "score-yellow",
      4: "score-orange",
      5: "score-red"
    };
    const palette = fieldId === "soreness_score" ? reversed : normal;
    return palette[n] || "score-yellow";
  };

  Object.entries(meta.options).forEach(([value, text]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `checkin-score-btn ${getScoreClass(fieldId, value)}`;
    btn.dataset.value = String(value);
    btn.textContent = String(value);
    btn.title = tr(text);

    btn.addEventListener("click", () => {
      field.value = String(value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
      syncButtons();
    });

    row.appendChild(btn);
  });

  field.addEventListener("change", syncButtons);

  wrap.appendChild(title);
  wrap.appendChild(help);
  wrap.appendChild(row);
  wrap.appendChild(valueLine);

  label.insertAdjacentElement("afterend", wrap);
  syncButtons();
}

function initCheckinScoreButtons(){
  ensureCheckinScoreStyles();
  enhanceCheckinScoreField("sleep_score");
  enhanceCheckinScoreField("energy_score");
  enhanceCheckinScoreField("soreness_score");
}




function buildWeeklyPlanPreview(){
  const settings = STATE.userSettings && typeof STATE.userSettings === "object" ? STATE.userSettings : {};
  const preferences = settings.preferences && typeof settings.preferences === "object" ? settings.preferences : {};
  const trainingTypes = preferences.training_types && typeof preferences.training_types === "object"
    ? preferences.training_types
    : {};
  const trainingDays = preferences.training_days && typeof preferences.training_days === "object"
    ? preferences.training_days
    : {};

  const dayOrder = [
    ["mon", "man"],
    ["tue", "tir"],
    ["wed", "ons"],
    ["thu", "tor"],
    ["fri", "fre"],
    ["sat", "lør"],
    ["sun", "søn"]
  ];

  const activeDays = dayOrder
    .filter(([key]) => trainingDays[key] !== false)
    .map(([, label]) => label);

  const selectedTypes = [
    trainingTypes.strength_weights !== false || trainingTypes.bodyweight !== false ? "styrke" : "",
    trainingTypes.running === true ? "løb" : "",
    trainingTypes.mobility === true ? "mobilitet" : ""
  ].filter(Boolean);

  let typeLabel = "træning";
  if (selectedTypes.length === 1){
    typeLabel = selectedTypes[0];
  } else if (selectedTypes.length > 1){
    typeLabel = selectedTypes.join("/");
  }

  if (!activeDays.length){
    return "Ugeplan: ingen faste træningsdage valgt · recovery og fleksibel plan anbefales.";
  }

  return `Ugeplan: ${activeDays.join(", ")} = ${typeLabel} · øvrige dage = hvile eller recovery`;
}




function ensureWeekPlanPreviewStyles(){
  if (document.getElementById("weekPlanPreviewStyles")) return;

  const style = document.createElement("style");
  style.id = "weekPlanPreviewStyles";
  style.textContent = `
    .weekplan-grid {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 10px;
      margin-top: 12px;
    }
    .weekplan-day {
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.04);
      border-radius: 16px;
      padding: 12px;
      min-height: 118px;
    }
    .weekplan-day.is-today {
      border-color: rgba(255,255,255,0.34);
      background: rgba(255,255,255,0.08);
    }
    .weekplan-day.kind-strength { background: rgba(243, 201, 105, 0.08); }
    .weekplan-day.kind-run { background: rgba(127, 209, 255, 0.08); }
    .weekplan-day.kind-mobility { background: rgba(158, 230, 160, 0.08); }
    .weekplan-day.kind-recovery { background: rgba(199, 184, 255, 0.08); }
    .weekplan-day.kind-rest { background: rgba(255, 255, 255, 0.03); }
    .weekplan-day-label {
      font-size: 0.9rem;
      opacity: 0.85;
      margin-bottom: 8px;
    }
    .weekplan-day-kind {
      font-weight: 700;
      margin-bottom: 6px;
    }
    .weekplan-day-note {
      font-size: 0.88rem;
      opacity: 0.88;
      line-height: 1.35;
    }
    .weekplan-day-kind.kind-strength { color: #f3c969; }
    .weekplan-day-kind.kind-run { color: #7fd1ff; }
    .weekplan-day-kind.kind-mobility { color: #9ee6a0; }
    .weekplan-day-kind.kind-recovery { color: #c7b8ff; }
    .weekplan-day-kind.kind-rest { color: #b8b8b8; }

    @media (max-width: 900px){
      .weekplan-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `;
  document.head.appendChild(style);
}

function ensureWeekPlanCardMount(){
  let card = document.getElementById("weekPlanCard");
  if (card) return card;

  const anchor = document.getElementById("overviewStatusCard") || document.getElementById("forecastCard");
  if (!anchor || !anchor.parentNode) return null;

  card = document.createElement("section");
  card.className = "card";
  card.id = "weekPlanCard";
  card.style.gridColumn = "1 / -1";
  card.innerHTML = `
    <div class="row">
      <h2 id="weekPlanTitle">${esc(tr("weekplan.title"))}</h2>
      <div class="small" id="weekPlanMeta"></div>
    </div>
    <div class="small" id="weekPlanIntro"></div>
    <div class="weekplan-grid" id="weekPlanGrid"></div>
  `;

  anchor.parentNode.insertBefore(card, anchor.nextSibling);
  return card;
}

function chooseCombinations(arr, k){
  const out = [];
  const n = Array.isArray(arr) ? arr.length : 0;
  if (!n || k <= 0 || k > n) return out;

  function walk(startIdx, acc){
    if (acc.length === k){
      out.push(acc.slice());
      return;
    }
    for (let i = startIdx; i < n; i += 1){
      acc.push(arr[i]);
      walk(i + 1, acc);
      acc.pop();
    }
  }

  walk(0, []);
  return out;
}

function scoreTrainingSlotCombo(indices, totalDays){
  const days = Math.max(1, Number(totalDays || 7));
  const sorted = [...indices].sort((a, b) => a - b);
  if (!sorted.length) return -Infinity;
  if (sorted.length === 1) return 1000;

  const gaps = [];
  for (let i = 0; i < sorted.length; i += 1){
    const current = sorted[i];
    const next = sorted[(i + 1) % sorted.length];
    const gap = i === sorted.length - 1
      ? (next + days) - current
      : next - current;
    gaps.push(gap);
  }

  const minGap = Math.min(...gaps);
  const maxGap = Math.max(...gaps);
  const adjacentCount = gaps.filter(g => g <= 1).length;
  const tightCount = gaps.filter(g => g <= 2).length;
  const spreadPenalty = maxGap - minGap;

  return (minGap * 100) - (adjacentCount * 1000) - (tightCount * 25) - (spreadPenalty * 10);
}

function pickDistributedIndices(availableIndices, target, totalDays = 7){
  const arr = Array.isArray(availableIndices) ? availableIndices.slice() : [];
  const t = Math.max(0, Math.min(Number(target || 0), arr.length));

  if (!arr.length || !t) return [];
  if (t >= arr.length) return arr.slice().sort((a, b) => a - b);

  const combos = chooseCombinations(arr, t);
  if (!combos.length) return [];

  let best = combos[0];
  let bestScore = scoreTrainingSlotCombo(best, totalDays);

  for (const combo of combos.slice(1)){
    const score = scoreTrainingSlotCombo(combo, totalDays);
    if (score > bestScore){
      best = combo;
      bestScore = score;
    }
  }

  return best.slice().sort((a, b) => a - b);
}

function getWeekPlanTypeSequence(trainingTypes){
  const wantsStrength = trainingTypes.strength_weights !== false || trainingTypes.bodyweight !== false;
  const wantsRunning = trainingTypes.running === true;
  const wantsMobility = trainingTypes.mobility === true;

  if (wantsStrength && wantsRunning) return ["strength", "running"];
  if (wantsStrength) return ["strength"];
  if (wantsRunning) return ["running"];
  if (wantsMobility) return ["mobility"];
  return ["recovery"];
}

function getWeekPlanKindMeta(kind){
  if (kind === "strength"){
    return { label: tr("workout.type.strength"), note: tr("plan.planned_strength_day"), className: "kind-strength" };
  }
  if (kind === "running"){
    return { label: tr("session_type.run"), note: tr("weekplan.note.run"), className: "kind-run" };
  }
  if (kind === "mobility"){
    return { label: tr("session_type.mobility"), note: tr("plan.mobility_note"), className: "kind-mobility" };
  }
  if (kind === "recovery"){
    return { label: tr("session_type.recovery"), note: tr("weekplan.note.recovery"), className: "kind-recovery" };
  }
  return { label: tr("weekplan.label.rest"), note: tr("weekplan.note.rest"), className: "kind-rest" };
}

function buildWeekPlanItems(planItem){
  const settings = STATE.userSettings && typeof STATE.userSettings === "object" ? STATE.userSettings : {};
  const preferences = settings.preferences && typeof settings.preferences === "object" ? settings.preferences : {};
  const trainingTypes = preferences.training_types && typeof preferences.training_types === "object"
    ? preferences.training_types
    : {};
  const trainingDays = preferences.training_days && typeof preferences.training_days === "object"
    ? preferences.training_days
    : {};
  const weeklyTargetSessions = Number(preferences.weekly_target_sessions || 3) || 3;

  const dayOrder = [
    { key: "mon", label: tr("day.mon") },
    { key: "tue", label: tr("day.tue") },
    { key: "wed", label: tr("day.wed") },
    { key: "thu", label: tr("day.thu") },
    { key: "fri", label: tr("day.fri") },
    { key: "sat", label: tr("day.sat") },
    { key: "sun", label: tr("day.sun") }
  ];

  const availableIndices = dayOrder
    .map((day, idx) => ({ idx, allowed: trainingDays[day.key] !== false }))
    .filter(x => x.allowed)
    .map(x => x.idx);

  const trainingSlots = pickDistributedIndices(availableIndices, weeklyTargetSessions, 7);

  const trainingSlotSet = new Set(trainingSlots);
  const sequence = getWeekPlanTypeSequence(trainingTypes);

  let seqIdx = 0;
  const items = dayOrder.map((day, idx) => {
    let kind = "rest";

    if (trainingSlotSet.has(idx)){
      kind = sequence[seqIdx % sequence.length] || "recovery";
      seqIdx += 1;
    } else {
      const prevWasTraining = trainingSlotSet.has(idx - 1);
      const nextIsTraining = trainingSlotSet.has(idx + 1);
      const allowedDay = trainingDays[day.key] !== false;

      if (prevWasTraining && allowedDay){
        kind = trainingTypes.mobility === true ? "mobility" : "recovery";
      } else if (nextIsTraining && allowedDay && trainingTypes.mobility === true){
        kind = "mobility";
      } else {
        kind = "rest";
      }
    }

    const meta = getWeekPlanKindMeta(kind);
    return {
      key: day.key,
      label: day.label,
      kind,
      kindLabel: meta.label,
      note: meta.note,
      className: meta.className
    };
  });

  const todayKey = String(planItem?.training_day_context?.weekday_key || "").trim().toLowerCase();
  if (todayKey){
    items.forEach(item => {
      item.isToday = item.key === todayKey;
    });
  }

  return items;
}

function getTodayWeekPlanItem(planItem){
  const items = buildWeekPlanItems(planItem);
  if (!Array.isArray(items) || !items.length) return null;

  const todayKey = String(planItem?.training_day_context?.weekday_key || "").trim().toLowerCase();
  if (todayKey){
    return items.find(item => item && item.key === todayKey) || null;
  }

  const jsDay = new Date().getDay(); // 0=sun, 1=mon, ...
  const keyMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const fallbackKey = keyMap[jsDay] || "";
  return items.find(item => item && item.key === fallbackKey) || null;
}

function renderWeekPlanPreview(planItem){
  ensureWeekPlanPreviewStyles();
  const card = ensureWeekPlanCardMount();
  if (!card) return;

  const grid = document.getElementById("weekPlanGrid");
  const intro = document.getElementById("weekPlanIntro");
  const meta = document.getElementById("weekPlanMeta");
  const title = document.getElementById("weekPlanTitle");
  if (!grid || !intro || !meta) return;

  if (title) title.textContent = tr("weekplan.title");

  const items = buildWeekPlanItems(planItem);
  const settings = STATE.userSettings && typeof STATE.userSettings === "object" ? STATE.userSettings : {};
  const preferences = settings.preferences && typeof settings.preferences === "object" ? settings.preferences : {};
  const weeklyTargetSessions = Number(preferences.weekly_target_sessions || 3) || 3;

  intro.textContent = tr("weekplan.description");
  meta.textContent = tr("weekplan.sessions", { value: weeklyTargetSessions });

  grid.innerHTML = items.map(item => `
    <div class="weekplan-day ${esc(item.className)}${item.isToday ? ' is-today' : ''}">
      <div class="weekplan-day-label">${esc(item.label)}${item.isToday ? ` · ${esc(tr("common.today"))}` : ''}</div>
      <div class="weekplan-day-kind ${esc(item.className)}">${esc(item.kindLabel)}</div>
      <div class="weekplan-day-note">${esc(item.note)}</div>
    </div>
  `).join("");
}

