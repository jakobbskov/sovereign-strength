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
  customWorkouts: [],
  workouts: [],
  sessionResults: [],
  recoveryHistory: [],
  workoutInProgress: false,
  currentWorkoutEntryIndex: 0,
  currentWorkoutSetIndex: 0,
  workoutRestTimerActive: false,
  workoutRestTimerEndsAt: 0,
  workoutRestTimerDurationSec: 90,
  manualWorkoutActsAsTodayOverride: false,
  workoutRestTargetKind: "",
  workoutRestNextEntryIndex: -1,
  editingCheckinId: null,
  pendingRecoveryEditId: null,
  lastFocusedRecoveryId: null,
  editingSessionResultId: null,
  lastAutoLoad: "",
  firstRunSetupStep: "basic_profile"
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
        setText("status", tr("status.language_switch_error_prefix") + (err?.message || String(err)));
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
        setText("status", tr("status.language_switch_error_prefix") + (err?.message || String(err)));
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

function hasCompletedSessionToday(sessionResults){
  const today = new Date().toISOString().slice(0,10);
  const items = Array.isArray(sessionResults) ? sessionResults : [];
  return items.some(item =>
    item &&
    typeof item === "object" &&
    String(item.date || "").slice(0,10) === today &&
    item.completed === true
  );
}

function getCompletedSessionToday(sessionResults){
  const today = new Date().toISOString().slice(0,10);
  const items = Array.isArray(sessionResults) ? sessionResults : [];
  const matches = items.filter(item =>
    item &&
    typeof item === "object" &&
    String(item.date || "").slice(0,10) === today &&
    item.completed === true
  );
  if (!matches.length) return null;
  matches.sort((a, b) => String(b.created_at || b.date || "").localeCompare(String(a.created_at || a.date || "")));
  return matches[0] || null;
}

function buildSessionResultSummaryFromStoredItem(item){
  if (!item || typeof item !== "object") return null;

  const sessionTypeKey = String(item.session_type || "").trim().toLowerCase();
  const results = Array.isArray(item.results) ? item.results : [];
  const nextStepHint = String(item.next_step_hint || "").trim();
  const progressFlags = Array.isArray(item.progress_flags) ? item.progress_flags : [];
  const fatigue = String(item.fatigue || "").trim();

  if (sessionTypeKey === "løb" || sessionTypeKey === "cardio" || sessionTypeKey === "run"){
    const distanceKm = Number(item.distance_km || 0);
    const durationTotalSec = Number(item.duration_total_sec || 0);
    const paceSecPerKm = distanceKm > 0 && durationTotalSec > 0
      ? Math.round(durationTotalSec / distanceKm)
      : 0;

    return {
      session_type: item.session_type || "",
      cardio_kind: item.cardio_kind || "",
      fatigue,
      distance_km: distanceKm || 0,
      duration_total_sec: durationTotalSec || 0,
      pace_sec_per_km: paceSecPerKm || 0,
      next_step_hint: nextStepHint,
      progress_flags: progressFlags
    };
  }

  const totalExercises = results.length;
  const completedExercises = results.filter(x => x && x.completed !== false).length;
  const totalSets = results.reduce((acc, result) => {
    const sets = Array.isArray(result?.sets) ? result.sets : [];
    return acc + sets.length;
  }, 0);
  const totalReps = results.reduce((acc, result) => {
    const sets = Array.isArray(result?.sets) ? result.sets : [];
    return acc + sets.reduce((inner, s) => inner + (Number(s?.reps || 0) || 0), 0);
  }, 0);
  const estimatedVolume = results.reduce((acc, result) => {
    const sets = Array.isArray(result?.sets) ? result.sets : [];
    return acc + sets.reduce((inner, s) => {
      const reps = Number(s?.reps || 0) || 0;
      const load = Number(String(s?.load || "").replace(",", ".").replace(/[^0-9.\-]/g, "")) || 0;
      return inner + (reps * load);
    }, 0);
  }, 0);
  const hitFailureCount = results.reduce((acc, result) => acc + (result?.hit_failure ? 1 : 0), 0);

  return {
    session_type: item.session_type || "",
    fatigue,
    completed_exercises: completedExercises,
    total_exercises: totalExercises,
    total_sets: totalSets,
    total_reps: totalReps,
    estimated_volume: Math.round(estimatedVolume),
    hit_failure_count: hitFailureCount,
    next_step_hint: nextStepHint,
    progress_flags: progressFlags
  };
}

function isPlannedRestDayPlan(planItem){
  if (!planItem || typeof planItem !== "object") return false;
  const weekItem = getTodayWeekPlanItem(planItem);
  return String(weekItem?.kind || "").trim().toLowerCase() === "rest";
}

function getAcknowledgedRestDayCheckin(latestCheckin, planItem){
  const item = latestCheckin && typeof latestCheckin === "object" ? latestCheckin : null;
  if (!item) return null;

  const today = new Date().toISOString().slice(0,10);
  const itemDate = String(item.date || "").slice(0,10);
  if (itemDate !== today) return null;
  if (item.rest_day_acknowledged !== true) return null;
  if (!isPlannedRestDayPlan(planItem)) return null;

  return item;
}

function getTodayCheckin(checkins, latestCheckin, planItem){
  const items = Array.isArray(checkins) ? checkins : [];
  const today = String(planItem?.date || planItem?.recommended_for || new Date().toISOString().slice(0,10)).slice(0,10);

  const matches = items.filter(item =>
    item &&
    typeof item === "object" &&
    String(item.date || "").slice(0,10) === today
  );

  if (matches.length){
    const sorted = matches
      .slice()
      .sort((a, b) => String(b.created_at || b.date || "").localeCompare(String(a.created_at || a.date || "")));

    const acknowledged = sorted.find(item => item && item.rest_day_acknowledged === true);
    return acknowledged || sorted[0];
  }

  const latest = latestCheckin && typeof latestCheckin === "object" ? latestCheckin : null;
  if (latest && String(latest.date || "").slice(0,10) === today){
    return latest;
  }

  return null;
}

function isFirstRunUser(planItem, latestCheckin, sessionResults){
  const hasPlan = !!(planItem && typeof planItem === "object");
  const hasLatestCheckin = !!(latestCheckin && typeof latestCheckin === "object" && String(latestCheckin.date || "").trim());
  const hasSessions = Array.isArray(sessionResults) && sessionResults.length > 0;
  const checklistState = buildInitialSetupChecklist(STATE.userSettings || {});
  const setupReady = !!checklistState?.readyForRecommendation;
  return !setupReady && !hasPlan && !hasLatestCheckin && !hasSessions;
}

function deriveDailyUiState(planItem, latestCheckin, sessionResults){
  const today = new Date().toISOString().slice(0,10);
  const latestDate = String(latestCheckin?.date || "").slice(0,10);
  const hasCheckinToday = latestDate === today;
  const hasPlan = !!(planItem && typeof planItem === "object");
  const completedToday = hasCompletedSessionToday(sessionResults);
  const acknowledgedRestDay = Boolean(getAcknowledgedRestDayCheckin(latestCheckin, planItem));
  const plannedRestToday = isPlannedRestDayPlan(planItem);

  if (isFirstRunUser(planItem, latestCheckin, sessionResults)) return "first_run_onboarding";
  if (!hasCheckinToday) return "no_checkin_yet";
  if (completedToday) return "completed_session_today";
  if (acknowledgedRestDay) return "completed_rest_day_today";
  if (plannedRestToday) return "planned_rest_today";
  if (hasPlan) return "plan_ready";
  return "overview";
}

function getDefaultWizardStepForDailyState(planItem, latestCheckin, sessionResults){
  const dailyState = deriveDailyUiState(planItem, latestCheckin, sessionResults);
  if (dailyState === "first_run_onboarding") return "overview";
  if (dailyState === "no_checkin_yet") return "checkin";
  if (dailyState === "planned_rest_today") return "plan";
  if (dailyState === "plan_ready") return "plan";
  if (dailyState === "completed_session_today") return "overview";
  if (dailyState === "completed_rest_day_today") return "overview";
  return "overview";
}

function resolveNavigationIntent(uiState){
  const editCheckinId = String(getEditCheckinIdFromUrl() || "").trim();
  if (editCheckinId){
    return {
      kind: "edit_checkin",
      targetStep: "checkin",
      entityId: editCheckinId
    };
  }

  const editSessionId = String(getEditSessionIdFromUrl() || "").trim();
  if (editSessionId){
    return {
      kind: "edit_session",
      targetStep: "review",
      entityId: editSessionId
    };
  }

  return {
    kind: "daily_state",
    targetStep: uiState?.defaultStep || "overview",
    entityId: ""
  };
}

async function applyNavigationIntent(intent){
  const kind = String(intent?.kind || "").trim();
  const targetStep = String(intent?.targetStep || "overview").trim() || "overview";

  showWizardStep(targetStep);

  if (kind === "edit_checkin"){
    return await loadDedicatedCheckinEditFromUrl();
  }

  if (kind === "edit_session"){
    return await loadSessionEditFromUrl();
  }

  return true;
}

async function rerenderUiAfterLanguageChange(){
  applyStaticTranslations();
  resetEnhancedCheckinUi();
  if (typeof initCheckinScoreButtons === "function") initCheckinScoreButtons();
  renderWizardNav();
  renderAuthBar();
  const uiState = await refreshAll();
  updateMenstruationCheckinVisibility();
  updateCheckinEditMenstruationVisibility();
  const intent = resolveNavigationIntent(uiState);
  await applyNavigationIntent(intent);
}

function setText(id, text){
  const el = document.getElementById(id);
  if (el) el.textContent = String(text);
}

function applyBootFailureFallbacks(message){
  [
    "profileBodyLine",
    "profileTrainingTypesLine",
    "profileTrainingDaysLine",
    "profileEquipmentLine",
    "profileIncrementLine",
    "profileAccountLine",
    "forecastSummary",
    "forecastReason",
    "todayPlanSummary"
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(message || "");
  });
}

function applyBootState(state, message){
  const statusEl = document.getElementById("status");
  const wizardNav = document.getElementById("wizardNav");

  try{
    document.body?.setAttribute("data-boot-state", String(state || ""));
  }catch(err){}

  if (statusEl){
    statusEl.textContent = String(message || "");
    statusEl.classList.remove("ok", "warn");
    if (state === "ready"){
      statusEl.classList.add("ok");
    } else if (state && state !== "loading"){
      statusEl.classList.add("warn");
    }
  }

  if (wizardNav){
    wizardNav.classList.toggle("wizard-step-hidden", state !== "ready");
  }
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
  const normalized = String(exerciseId || "").trim();
  return (STATE.exercises || []).find(
    x => String(x.id || "").trim() === normalized
  ) || null;
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
    const placeholder = loadOptional ? tr("workout.load_optional_placeholder") : tr("workout.load_placeholder");
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
      `<option value="${idx}">${esc(getProgramDayDisplayLabel(day) || `${tr("common.day")} ${idx+1}`)}</option>`
    ).join("");
}


function auditExerciseCatalogMetadata(exercises, seedExercises){
  const liveItems = Array.isArray(exercises) ? exercises : [];
  const seedItems = Array.isArray(seedExercises) ? seedExercises : [];
  const liveById = new Map(
    liveItems
      .filter(item => item && typeof item === "object" && String(item.id || "").trim())
      .map(item => [String(item.id || "").trim(), item])
  );

  const affected = [];
  let missingExerciseCount = 0;
  let missingCueCount = 0;
  let missingImageMetadataCount = 0;

  seedItems.forEach(seedItem => {
    if (!seedItem || typeof seedItem !== "object") return;

    const id = String(seedItem.id || "").trim();
    if (!id) return;

    const liveItem = liveById.get(id);
    if (!liveItem){
      missingExerciseCount += 1;
      affected.push({ id, missing: ["exercise"] });
      return;
    }

    const seedHasFormCues =
      (Array.isArray(seedItem.form_cues) && seedItem.form_cues.length > 0) ||
      (Array.isArray(seedItem.form_cues_en) && seedItem.form_cues_en.length > 0);
    const liveHasFormCues =
      (Array.isArray(liveItem.form_cues) && liveItem.form_cues.length > 0) ||
      (Array.isArray(liveItem.form_cues_en) && liveItem.form_cues_en.length > 0);

    const seedHasImageMetadata =
      Boolean(String(seedItem.image_folder || "").trim()) ||
      (Array.isArray(seedItem.external_images) && seedItem.external_images.length > 0);
    const liveHasImageMetadata =
      Boolean(String(liveItem.image_folder || "").trim()) ||
      (Array.isArray(liveItem.external_images) && liveItem.external_images.length > 0);

    const missing = [];
    if (seedHasFormCues && !liveHasFormCues){
      missing.push("form_cues");
      missingCueCount += 1;
    }
    if (seedHasImageMetadata && !liveHasImageMetadata){
      missing.push("image_metadata");
      missingImageMetadataCount += 1;
    }

    if (missing.length){
      affected.push({ id, missing });
    }
  });

  const affectedIds = affected.map(x => x.id);
  const staleSuspected = affected.length > 0;

  return {
    ok: !staleSuspected,
    stale_suspected: staleSuspected,
    live_checked_count: liveItems.length,
    seed_checked_count: seedItems.length,
    affected_count: affected.length,
    missing_exercise_count: missingExerciseCount,
    missing_form_cues_count: missingCueCount,
    missing_image_metadata_count: missingImageMetadataCount,
    affected_ids_sample: affectedIds.slice(0, 12),
    affected_sample: affected.slice(0, 12),
    recovery_hint: staleSuspected
      ? "Live data/exercises.json appears older than app/data/seed/exercises.json for viewer metadata. Safe-sync catalog support data from app/data/seed/exercises.json; do not overwrite user-generated runtime data."
      : ""
  };
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

const MANUAL_TEMPLATE_STORAGE_KEY = "ss_manual_workout_templates";

function readManualWorkoutTemplates(){
  try{
    const raw = localStorage.getItem(MANUAL_TEMPLATE_STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(item =>
      item &&
      typeof item === "object" &&
      String(item.name || "").trim() &&
      Array.isArray(item.entries)
    );
  }catch(err){
    console.error(err);
    return [];
  }
}

function writeManualWorkoutTemplates(items){
  const clean = Array.isArray(items) ? items : [];
  localStorage.setItem(MANUAL_TEMPLATE_STORAGE_KEY, JSON.stringify(clean));
}

function renderCustomWorkoutOptions(){
  const selectEl = document.getElementById("customWorkoutSelect");
  if (!selectEl) return;

  const items = Array.isArray(STATE.customWorkouts) ? STATE.customWorkouts : [];
  const options = [
    `<option value="">${esc(tr("custom_workout.none_saved"))}</option>`,
    ...items.map(item => `<option value="${esc(String(item.id || ""))}">${esc(String(item.name || "").trim())}</option>`)
  ];
  selectEl.innerHTML = options.join("");
}

async function handleSaveCustomWorkout(){
  const statusEl = document.getElementById("customWorkoutStatus");

  if (!Array.isArray(STATE.pendingEntries) || STATE.pendingEntries.length === 0){
    setText("customWorkoutStatus", tr("custom_workout.save_requires_entries"));
    statusEl?.classList.add("warn");
    return;
  }

  const rawName = window.prompt(tr("custom_workout.prompt_name"), "");
  const name = String(rawName || "").trim();
  if (!name){
    setText("customWorkoutStatus", tr("custom_workout.save_cancelled"));
    statusEl?.classList.remove("warn");
    return;
  }

  try{
    const form = document.getElementById("workoutForm");
    const sessionType = String(form?.type?.value || "styrke").trim().toLowerCase();
    const notes = String(form?.notes?.value || "").trim();

    const res = await apiPost("/api/custom-workouts", {
      name,
      session_type: sessionType,
      notes,
      entries: STATE.pendingEntries,
    });

    const item = res && res.item && typeof res.item === "object" ? res.item : null;
    if (!item){
      throw new Error("missing custom workout item");
    }

    STATE.customWorkouts = [item, ...(Array.isArray(STATE.customWorkouts) ? STATE.customWorkouts : [])];
    renderCustomWorkoutOptions();

    const selectEl = document.getElementById("customWorkoutSelect");
    if (selectEl) selectEl.value = String(item.id || "");

    statusEl?.classList.remove("warn");
    setText("customWorkoutStatus", tr("custom_workout.saved", { name }));
  }catch(err){
    statusEl?.classList.add("warn");
    setText("customWorkoutStatus", tr("status.error_prefix") + (err?.message || String(err)));
  }
}

function handleLoadCustomWorkout(){
  const selectEl = document.getElementById("customWorkoutSelect");
  const statusEl = document.getElementById("customWorkoutStatus");
  const workoutId = String(selectEl?.value || "").trim();

  if (!workoutId){
    setText("customWorkoutStatus", tr("custom_workout.select_first"));
    statusEl?.classList.add("warn");
    return;
  }

  const items = Array.isArray(STATE.customWorkouts) ? STATE.customWorkouts : [];
  const found = items.find(item => String(item.id || "").trim() === workoutId);

  if (!found){
    setText("customWorkoutStatus", tr("custom_workout.not_found"));
    statusEl?.classList.add("warn");
    return;
  }

  STATE.pendingEntries = JSON.parse(JSON.stringify(Array.isArray(found.entries) ? found.entries : []));
  renderPendingEntries();

  const form = document.getElementById("workoutForm");
  if (form){
    resetEntryInputs(form);
    if (form.type) form.type.value = String(found.session_type || "styrke");
    if (form.notes) form.notes.value = String(found.notes || "");
    setText("progressionHint", tr("workout.no_load_suggestion"));
  }

  statusEl?.classList.remove("warn");
  setText("customWorkoutStatus", tr("custom_workout.loaded", { name: found.name }));
}

function renderManualTemplateOptions(){
  const selectEl = document.getElementById("manualTemplateSelect");
  if (!selectEl) return;

  const templates = readManualWorkoutTemplates();
  const options = [
    `<option value="">${esc(tr("manual_template.none_saved"))}</option>`,
    ...templates.map(item => `<option value="${esc(String(item.id || ""))}">${esc(String(item.name || "").trim())}</option>`)
  ];
  selectEl.innerHTML = options.join("");
}

function handleSaveManualTemplate(){
  const statusEl = document.getElementById("manualTemplateStatus");
  if (!Array.isArray(STATE.pendingEntries) || STATE.pendingEntries.length === 0){
    setText("manualTemplateStatus", tr("manual_template.save_requires_entries"));
    statusEl?.classList.add("warn");
    return;
  }

  const rawName = window.prompt(tr("manual_template.prompt_name"), "");
  const name = String(rawName || "").trim();
  if (!name){
    setText("manualTemplateStatus", tr("manual_template.save_cancelled"));
    statusEl?.classList.remove("warn");
    return;
  }

  const templates = readManualWorkoutTemplates();
  const item = {
    id: `tpl_${Date.now()}`,
    name,
    entries: JSON.parse(JSON.stringify(STATE.pendingEntries))
  };

  templates.push(item);
  writeManualWorkoutTemplates(templates);
  renderManualTemplateOptions();
  const selectEl = document.getElementById("manualTemplateSelect");
  if (selectEl) selectEl.value = item.id;

  statusEl?.classList.remove("warn");
  setText("manualTemplateStatus", tr("manual_template.saved", { name }));
}

function handleLoadManualTemplate(){
  const selectEl = document.getElementById("manualTemplateSelect");
  const statusEl = document.getElementById("manualTemplateStatus");
  const templateId = String(selectEl?.value || "").trim();

  if (!templateId){
    setText("manualTemplateStatus", tr("manual_template.select_first"));
    statusEl?.classList.add("warn");
    return;
  }

  const templates = readManualWorkoutTemplates();
  const found = templates.find(item => String(item.id || "").trim() === templateId);
  if (!found){
    setText("manualTemplateStatus", tr("manual_template.not_found"));
    statusEl?.classList.add("warn");
    return;
  }

  STATE.pendingEntries = JSON.parse(JSON.stringify(Array.isArray(found.entries) ? found.entries : []));
  renderPendingEntries();

  const form = document.getElementById("workoutForm");
  if (form){
    resetEntryInputs(form);
    setText("progressionHint", tr("workout.no_load_suggestion"));
  }

  statusEl?.classList.remove("warn");
  setText("manualTemplateStatus", tr("manual_template.loaded", { name: found.name }));
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

  const sorted = [...items]
    .sort((a,b) => String(b.created_at || b.date).localeCompare(String(a.created_at || a.date)))
    .slice(0, 5);

  root.innerHTML = sorted.map(item => {
    const rawEntries = Array.isArray(item.entries) ? item.entries : [];
    const isCardio = String(item?.session_type || "").trim().toLowerCase() === "løb";
    const cardioMeta = buildCardioHistoryMeta(item);
    const totalSets = rawEntries.reduce((sum, entry) => sum + (Number(entry?.sets || 0) || 0), 0);

    const entriesHtml = isCardio
      ? ""
      : rawEntries.length
      ? `
          <div style="margin-top:8px">
            ${rawEntries.map(entry => {
              const setCount = Number(entry?.sets || 0) || 0;
              const repsText = String(entry?.reps || "").trim();
              const achievedText = String(entry?.achieved_reps || "").trim();
              const loadText = String(entry?.load || "").trim();

              return `
                <div class="small">
                  • ${esc(formatExerciseName(entry.exercise_id))}
                  ${setCount ? ` · ${tr("exercise.sets_count", { count: esc(String(setCount)) })}` : ""}
                  ${repsText ? ` · ${tr("exercise.target_label", { value: formatTarget(repsText) })}` : ""}
                  ${achievedText ? ` · ${tr("exercise.achieved_label", { value: esc(achievedText) })}` : ""}
                  ${loadText ? ` · load ${esc(loadText)}` : ""}
                </div>
              `;
            }).join("")}
          </div>
        `
      : "";

    return `
      <li data-workout-id="${esc(String(item.id || ""))}">
        <div class="row">
          <strong>${esc(formatSessionType(item.session_type || tr("common.unknown_lower")))}</strong>
          <span class="small">${esc(item.date || "")}</span>
        </div>
        <div class="small">
          ${isCardio
            ? esc(cardioMeta || "")
            : `${totalSets ? tr("exercise.sets_count", { count: esc(String(totalSets)) }) : ""}`}
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

    if (result.hit_failure){
      hitFailureCount += 1;
      progressFlags.push(`${result.exercise_id || "exercise"}_failure`);
    } else if (result.completed){
      progressFlags.push(`${result.exercise_id || "exercise"}_done`);
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

function getEditSessionIdFromUrl(){
  try{
    const url = new URL(window.location.href);
    return String(url.searchParams.get("edit_session") || "").trim();
  }catch(err){
    return "";
  }
}

function clearEditSessionIdFromUrl(){
  try{
    const url = new URL(window.location.href);
    url.searchParams.delete("edit_session");
    window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "") + url.hash);
  }catch(err){}
}

function buildSessionPlanFromHistoryItem(item){
  const results = Array.isArray(item?.results) ? item.results : [];
  return {
    date: item?.date || new Date().toISOString().slice(0,10),
    session_type: item?.session_type || "strength",
    timing_state: item?.timing_state || "",
    readiness_score: item?.readiness_score ?? null,
    entries: results.map(result => {
      const sets = Array.isArray(result?.sets) ? result.sets : [];
      return {
        exercise_id: result?.exercise_id || "",
        sets: Math.max(1, sets.length || 1),
        target_reps: result?.target_reps || "",
        target_load: result?.load || "",
        _existing_result: {
          achieved_reps: result?.achieved_reps || "",
          hit_failure: Boolean(result?.hit_failure),
          notes: result?.notes || "",
          sets: sets
        }
      };
    })
  };
}

function prefillSessionReviewFormFromHistoryItem(item){
  const form = document.getElementById("sessionResultForm");
  if (!form || !item || typeof item !== "object") return;

  form.session_completed.value = item.completed ? "true" : "false";
  form.session_notes.value = String(item.notes || "");

  if (form.cardio_kind) form.cardio_kind.value = String(item.cardio_kind || "");
  if (form.avg_rpe) form.avg_rpe.value = item.avg_rpe == null ? "" : String(item.avg_rpe);

  const distance = Number(item.distance_km || 0);
  const kmWhole = Math.floor(distance);
  const kmPart = Math.round((distance - kmWhole) * 1000);
  if (form.cardio_distance_km_whole) form.cardio_distance_km_whole.value = String(kmWhole || 0);
  if (form.cardio_distance_km_part) form.cardio_distance_km_part.value = String(kmPart || 0);

  const totalSec = Number(item.duration_total_sec || 0);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (form.cardio_duration_min) form.cardio_duration_min.value = totalSec ? String(min) : "";
  if (form.cardio_duration_sec) form.cardio_duration_sec.value = String(sec || 0);

  if (typeof updateCardioPacePreview === "function") updateCardioPacePreview();
}

async function loadSessionEditFromUrl(){
  const sessionId = getEditSessionIdFromUrl();
  if (!sessionId) return false;

  const statusEl = document.getElementById("sessionResultStatus");
  try{
    setText("sessionResultStatus", tr("status.opening_session_for_edit"));
    statusEl?.classList.remove("warn");
    const data = await apiJsonRequest("GET", `/api/session-results/${encodeURIComponent(sessionId)}`);
    const item = data?.item;
    if (!item) return false;

    STATE.editingSessionResultId = String(item.id || "").trim() || null;
    STATE.currentTodayPlan = buildSessionPlanFromHistoryItem(item);
    renderReviewSummary(STATE.currentTodayPlan);
    renderSessionReview(STATE.currentTodayPlan);
    prefillSessionReviewFormFromHistoryItem(item);

    const submitBtn = document.querySelector('#sessionResultForm button[type="submit"]');
    if (submitBtn) submitBtn.textContent = tr("button.save_changes");
    const deleteBtn = document.getElementById("deleteSessionResultBtn");
    if (deleteBtn) deleteBtn.classList.remove("wizard-step-hidden");

    document.getElementById("todayPlanSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }catch(err){
    setText("sessionResultStatus", tr("status.error_prefix") + (err?.message || String(err)));
    statusEl?.classList.add("warn");
  }
  return false;
}

async function handleSessionDelete(){
  const sessionId = String(STATE.editingSessionResultId || "").trim();
  const statusEl = document.getElementById("sessionResultStatus");
  if (!sessionId) return;

  if (!window.confirm("Er du sikker på at du vil slette denne session? Dette kan påvirke historik, progression og anbefalinger.")){
    return;
  }

  try{
    setText("sessionResultStatus", "Sletter session...");
    statusEl?.classList.remove("warn");
    await apiJsonRequest("DELETE", `/api/session-results/${encodeURIComponent(sessionId)}`);
    STATE.editingSessionResultId = null;
    clearEditSessionIdFromUrl();
    await refreshAll();
    renderSessionResultSummary(null);
    showWizardStep("history");
    setText("sessionResultStatus", "Session slettet.");
    statusEl?.classList.add("ok");
  }catch(err){
    setText("sessionResultStatus", tr("status.error_prefix") + (err?.message || String(err)));
    statusEl?.classList.add("warn");
  }
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
        <div class="small card-section-gap">
          ${isCardio
            ? esc(cardioMeta || tr("history.cardio_none"))
            : `${tr("history.session_totals", { sets: esc(String(totalSets)), reps: esc(String(totalReps)), tut_part: totalTUT ? ` · TUT: ${esc(String(totalTUT))} ${tr("unit.seconds")}` : "", volume: esc(String(estimatedVolume)) })}`}
        </div>
        <div class="small card-section-gap">
          ${tr("review.next_progression_label")}: ${esc(nextStepHint || tr("common.no_recommendation"))}
        </div>
        <div class="small card-section-gap">
          ${progressFlags.length ? esc(progressFlags.map(formatProgressFlag).join(", ")) : tr("history.no_progress_flags")}
        </div>
        ${notes ? `<div class="small card-section-gap-md">${esc(notes)}</div>` : ""}
        <div class="btn-row card-action-row">
          <a href="/?edit_session=${encodeURIComponent(String(item?.id || ""))}" class="button-link">${esc(tr("button.open_edit"))}</a>
        </div>
      </li>
    `;
  }).join("");

  setText("sessionResultsMeta", tr("common.items_count", { count: sorted.length }));
}




function getStartOfIsoWeek(dateStr){
  const raw = String(dateStr || "").trim();
  if (!raw) return "";
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (Number.isNaN(d.getTime())) return "";
  const weekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (weekday - 1));
  return d.toISOString().slice(0, 10);
}

function buildWeeklyRhythmSummary(sessionResults, planItem){
  const items = Array.isArray(sessionResults) ? sessionResults : [];
  const settings = STATE.userSettings && typeof STATE.userSettings === "object" ? STATE.userSettings : {};
  const preferences = settings.preferences && typeof settings.preferences === "object" ? settings.preferences : {};
  const weeklyTargetSessions = Math.max(1, Number(preferences.weekly_target_sessions || 3) || 3);
  const baseDate = String(planItem?.date || planItem?.recommended_for || "").trim();
  const todayIso = /^\d{4}-\d{2}-\d{2}$/.test(baseDate) ? baseDate : new Date().toISOString().slice(0, 10);
  const weekStart = getStartOfIsoWeek(todayIso);
  const thisWeek = items
    .filter(item => {
      const itemDate = String(item?.date || "").slice(0, 10);
      return itemDate && itemDate >= weekStart && itemDate <= todayIso;
    })
    .sort((a, b) => String(b?.created_at || b?.date || "").localeCompare(String(a?.created_at || a?.date || "")));

  const completedCount = thisWeek.length;
  const latest = thisWeek[0] || null;

  const completedTypes = [...new Set(
    thisWeek
      .map(item => formatSessionType(item?.session_type || ""))
      .filter(Boolean)
  )];

  const nextInfo = getNextPlannedSessionInfo(planItem);
  return {
    weekStart,
    completedCount,
    weeklyTargetSessions,
    latest,
    completedTypes,
    nextTraining: nextInfo?.nextTraining || null
  };
}

function ensureWeeklyRhythmMount(){
  let root = document.getElementById("weeklyRhythmCard");
  if (root) return root;

  const workoutsList = document.getElementById("workoutsList");
  const workoutsCard = workoutsList?.closest(".card");
  const historyTop = document.getElementById("historyTopSection");
  const historyBottom = document.getElementById("historyBottomSection");
  const parent = workoutsCard?.parentNode || historyTop?.parentNode || historyBottom?.parentNode;
  if (!parent) return null;

  const card = document.createElement("div");
  card.className = "card";
  card.id = "weeklyRhythmCard";
  card.classList.add("card-stack-gap");
  card.innerHTML = `
    <div class="row">
      <h2>${esc(tr("history.weekly_rhythm_title"))}</h2>
      <div class="small" id="weeklyRhythmMeta"></div>
    </div>
    <div id="weeklyRhythmBody" class="small"></div>
  `;

  if (workoutsCard && workoutsCard.parentNode){
    workoutsCard.parentNode.insertBefore(card, workoutsCard);
  } else if (historyTop && historyTop.parentNode){
    historyTop.parentNode.insertBefore(card, historyTop);
  } else {
    parent.appendChild(card);
  }

  return card;
}

function renderWeeklyRhythmSegments(completedCount, weeklyTargetSessions){
  const target = Math.max(1, Number(weeklyTargetSessions || 0) || 1);
  const completed = Math.max(0, Number(completedCount || 0) || 0);
  const filled = Math.min(completed, target);

  return `<div aria-hidden="true" style="display:flex; gap:6px; margin:8px 0 4px 0;">${
    Array.from({ length: target }, (_, idx) => {
      const isFilled = idx < filled;
      return `<span style="flex:1 1 0; min-width:0; height:14px; border-radius:999px; border:1px solid ${isFilled ? 'rgba(59,130,246,0.95)' : 'rgba(148,163,184,0.45)'}; background:${isFilled ? 'linear-gradient(90deg, rgba(59,130,246,0.95), rgba(37,99,235,0.95))' : 'rgba(148,163,184,0.12)'};"></span>`;
    }).join("")
  }</div>`;
}

function renderWeeklyRhythmCard(sessionResults, planItem){
  const card = ensureWeeklyRhythmMount();
  const body = document.getElementById("weeklyRhythmBody");
  const meta = document.getElementById("weeklyRhythmMeta");
  if (!card || !body) return;

  const summary = buildWeeklyRhythmSummary(sessionResults, planItem);
  const latest = summary.latest;
  const completedTypesLine = summary.completedTypes.length
    ? summary.completedTypes.join(" · ")
    : tr("history.weekly_rhythm_no_completed_types");
  const latestLine = latest
    ? `${String(latest.date || "")} · ${formatSessionType(latest.session_type || "")}`
    : tr("history.weekly_rhythm_none_completed");
  const nextLine = summary.nextTraining
    ? `${summary.nextTraining.kindLabel || ""} · ${summary.nextTraining.dateLabel || summary.nextTraining.date || ""}`
    : tr("common.no_recommendation");
  const rhythmSummaryLine = `${String(summary.completedCount)} / ${String(summary.weeklyTargetSessions)}`;

  body.innerHTML = `
    <div class="small"><strong>${esc(tr("history.weekly_rhythm_completed_label"))}:</strong> ${esc(rhythmSummaryLine)}</div>
    ${renderWeeklyRhythmSegments(summary.completedCount, summary.weeklyTargetSessions)}
    <div class="small card-section-gap"><strong>${esc(tr("history.weekly_rhythm_types_label"))}:</strong> ${esc(completedTypesLine)}</div>
    <div class="small card-section-gap"><strong>${esc(tr("history.weekly_rhythm_latest_label"))}:</strong> ${esc(latestLine)}</div>
    <div class="small card-section-gap"><strong>${esc(tr("history.weekly_rhythm_next_label"))}:</strong> ${esc(nextLine)}</div>
  `;

  if (meta){
    meta.textContent = summary.weekStart
      ? tr("history.weekly_rhythm_meta", { value: formatIsoDateForUi(summary.weekStart) })
      : "";
  }
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
  card.classList.add("card-stack-gap");
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
      ${rs.strain_flag ? `<div class="small card-section-gap"><strong>${tr("recovery.strain_flag_label")}:</strong> ${tr("common.active")}</div>` : `<div class="small card-section-gap"><strong>${tr("recovery.strain_flag_label")}:</strong> ${tr("common.inactive")}</div>`}
      ${Array.isArray(rs.explanation) && rs.explanation.length ? `<div class="small card-section-gap">${esc(rs.explanation.join(" · "))}</div>` : ""}
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
    ${dailyRows ? `<div class="card-muted-block">${dailyRows}</div>` : ""}
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

  const sorted = [...items].sort((a, b) => {
    const aCopy = getExerciseDisplayCopy(a);
    const bCopy = getExerciseDisplayCopy(b);
    return String(aCopy.name || "").localeCompare(
      String(bCopy.name || ""),
      getCurrentLang() === "en" ? "en" : "da"
    );
  });

  root.innerHTML = sorted.map(item => {
    const display = getExerciseDisplayCopy(item);
    const name = display.name || tr("common.unknown_lower");
    const notes = display.notes;
    return `
    <li data-recovery-id="${esc(String(item.id || ""))}">
      <div class="row">
        <strong>${esc(name)}</strong>
        <span class="small">${esc(item.default_unit || "")}</span>
      </div>
      <div class="pill">${esc(formatExerciseCategory(item.category || tr("common.unknown_lower")))}</div>
      ${notes ? `<div class="small" style="margin-top:8px">${esc(notes)}</div>` : ""}
    </li>
  `;
  }).join("");

  setText("exerciseMeta", tr("common.items_count", { count: sorted.length }));
}

function getEditCheckinIdFromUrl(){
  try{
    const url = new URL(window.location.href);
    return String(url.searchParams.get("edit_checkin") || "").trim();
  }catch(err){
    return "";
  }
}


function clearEditCheckinIdFromUrl(){
  try{
    const url = new URL(window.location.href);
    url.searchParams.delete("edit_checkin");
    window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "") + url.hash);
  }catch(err){}
}

async function loadRecoveryEditFromUrl(){
  const recoveryId = String(STATE.pendingRecoveryEditId || getEditCheckinIdFromUrl() || "").trim();
  if (!recoveryId) return false;

  const statusEl = document.getElementById("recoveryFormStatus");
  try{
    setText("recoveryFormStatus", "Åbner check-in til redigering...");
    statusEl?.classList.remove("warn");
    const data = await apiJsonRequest("GET", `/api/checkins/${encodeURIComponent(recoveryId)}`);
    if (data?.item){
      setRecoveryEditMode(data.item);
      STATE.pendingRecoveryEditId = null;
      clearEditCheckinIdFromUrl();
      document.getElementById("checkinSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    }
  }catch(err){
    setText("recoveryFormStatus", tr("status.error_prefix") + (err?.message || String(err)));
    statusEl?.classList.add("warn");
  }
  return false;
}

async function apiJsonRequest(method, path, payload){
  const options = {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "same-origin"
  };
  if (payload !== undefined){
    options.body = JSON.stringify(payload);
  }

  const res = await fetch(path, options);
  let data = null;
  try{
    data = await res.json();
  }catch(err){
    data = null;
  }

  if (!res.ok || !data?.ok){
    const message = data?.message || data?.error || `${method} ${path} failed`;
    throw new Error(message);
  }
  return data;
}

async function resolveLocalAdjustmentVariant(entry, direction){
  const payload = {
    entry: {
      exercise_id: entry?.exercise_id || "",
      sets: entry?.sets || "",
      target_reps: entry?.target_reps || "",
      target_load: entry?.target_load || ""
    },
    direction
  };
  return apiJsonRequest("POST", "/api/resolve-local-adjustment", payload);
}

function resetRecoveryFormLocalSignals(form){
  ["knee", "low_back", "shoulder", "elbow", "hip", "ankle_calf", "wrist"].forEach((region) => {
    if (form[`local_signal_${region}`]) form[`local_signal_${region}`].value = "";
  });
}

function applyRecoveryLocalSignals(form, localSignals){
  resetRecoveryFormLocalSignals(form);
  const items = Array.isArray(localSignals) ? localSignals : [];
  items.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const region = String(item.region || "").trim();
    const signal = String(item.signal || "").trim();
    if (!region || !signal) return;
    const field = form[`local_signal_${region}`];
    if (field) field.value = signal;
  });
}


function setRecoveryEditMode(item){
  const form = document.getElementById("recoveryForm");
  const statusEl = document.getElementById("recoveryFormStatus");
  const cancelBtn = document.getElementById("cancelRecoveryEditBtn");
  const deleteBtn = document.getElementById("deleteRecoveryBtn");
  const submitBtn = form?.querySelector('button[type="submit"]');

  if (!form || !item || typeof item !== "object") return;

  STATE.editingCheckinId = String(item.id || "").trim() || null;

  form.recovery_date.value = String(item.date || "").slice(0,10);
  form.sleep_score.value = String(item.sleep_score ?? "3");
  form.energy_score.value = String(item.energy_score ?? "3");
  form.soreness_score.value = String(item.soreness_score ?? "2");
  form.time_budget_min.value = String(item.time_budget_min ?? "45");
  form.recovery_notes.value = String(item.notes || "");
  if (form.menstruation_today) form.menstruation_today.checked = item.menstruation_today === true;
  if (form.menstrual_pain) form.menstrual_pain.value = String(item.menstrual_pain || "none");
  applyRecoveryLocalSignals(form, item.local_signals || []);

  if (submitBtn) submitBtn.textContent = "Gem ændringer";
  if (cancelBtn) cancelBtn.classList.remove("wizard-step-hidden");
  if (deleteBtn) deleteBtn.classList.remove("wizard-step-hidden");
  if (statusEl){
    statusEl.textContent = "Redigerer eksisterende check-in.";
    statusEl.classList.remove("warn");
    statusEl.classList.add("ok");
  }

  document.getElementById("checkinSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetRecoveryEditMode(){
  const form = document.getElementById("recoveryForm");
  const statusEl = document.getElementById("recoveryFormStatus");
  const cancelBtn = document.getElementById("cancelRecoveryEditBtn");
  const deleteBtn = document.getElementById("deleteRecoveryBtn");
  const submitBtn = form?.querySelector('button[type="submit"]');

  STATE.editingCheckinId = null;

  if (submitBtn) submitBtn.textContent = tr("button.calculate_today_plan");
  if (cancelBtn) cancelBtn.classList.add("wizard-step-hidden");
  if (deleteBtn) deleteBtn.classList.add("wizard-step-hidden");

  if (!form) return;

  form.reset();
  form.recovery_date.value = new Date().toISOString().slice(0,10);
  form.sleep_score.value = "3";
  form.energy_score.value = "3";
  form.soreness_score.value = "2";
  form.time_budget_min.value = "45";
  if (form.menstruation_today) form.menstruation_today.checked = false;
  if (form.menstrual_pain) form.menstrual_pain.value = "none";
  resetRecoveryFormLocalSignals(form);

  updateMenstruationCheckinVisibility();

  if (statusEl){
    statusEl.textContent = tr("status.ready");
    statusEl.classList.remove("ok", "warn");
  }
}

async function handleRecoveryDelete(){
  const recoveryId = String(STATE.editingCheckinId || "").trim();
  const statusEl = document.getElementById("recoveryFormStatus");

  if (!recoveryId) return;
  if (!window.confirm("Er du sikker på at du vil slette denne check-in? Dette kan påvirke anbefalinger, historik og progression.")){
    return;
  }

  try{
    setText("recoveryFormStatus", "Sletter check-in...");
    statusEl?.classList.remove("warn");
    await apiJsonRequest("DELETE", `/api/checkins/${encodeURIComponent(recoveryId)}`);
    clearEditCheckinIdFromUrl();
    resetRecoveryEditMode();
    await refreshAll();
    setText("recoveryFormStatus", "Check-in slettet.");
    statusEl?.classList.add("ok");
  }catch(err){
    setText("recoveryFormStatus", tr("status.error_prefix") + (err?.message || String(err)));
    statusEl?.classList.remove("ok");
    statusEl?.classList.add("warn");
  }
}

function focusRecoveryHistoryItem(recoveryId){
  const id = String(recoveryId || "").trim();
  if (!id) return false;

  const root = document.getElementById("recoveryList");
  if (!root) return false;

  const target = root.querySelector(`[data-recovery-id="${id}"]`);
  if (!target) return false;

  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.style.outline = "2px solid rgba(255,255,255,0.85)";
  target.style.outlineOffset = "4px";
  target.style.background = "rgba(255,255,255,0.08)";
  setTimeout(() => {
    target.style.outline = "";
    target.style.outlineOffset = "";
    target.style.background = "";
  }, 1800);
  return true;
}

function renderRecovery(items){
  const root = document.getElementById("recoveryList");
  if (!root) return;

  if (!Array.isArray(items) || items.length === 0){
    STATE.recoveryHistory = [];
    root.innerHTML = `<li><div class="small">${esc(tr("recovery.none_yet"))}</div></li>`;
    setText("recoveryMeta", tr("common.items_count", { count: 0 }));
    return;
  }

  const sorted = [...items].sort((a,b) => String(b.created_at || b.date).localeCompare(String(a.created_at || a.date)));
  STATE.recoveryHistory = sorted;

  root.innerHTML = sorted.map(item => `
    <li data-recovery-id="${esc(String(item.id || ""))}">
      <div class="row">
        <strong>${esc(item.date || "")}</strong>
        <span class="small">${tr("history.recovery_scores", { sleep: esc(item.sleep_score), energy: esc(item.energy_score), soreness: esc(item.soreness_score) })}</span>
      </div>
      <div class="pill">${tr("overview.readiness_label")} ${esc(item.readiness_score ?? "-")}</div>
      <div class="pill">${esc(formatOverviewReadinessLabel(item.readiness_score))}</div>
      ${item.suggestion ? `<div class="small" style="margin-top:8px">${esc(item.suggestion)}</div>` : ""}
      ${item.notes ? `<div style="margin-top:8px">${esc(item.notes)}</div>` : ""}
      <div class="btn-row card-action-row">
        <a class="edit-recovery-btn button-link" data-recovery-id="${esc(item.id || "")}" href="/?edit_checkin=${encodeURIComponent(String(item.id || ""))}">${esc(tr("button.open_edit"))}</a>
      </div>
    </li>
  `).join("");

  setText("recoveryMeta", tr("common.items_count", { count: sorted.length }));

  const pendingId = String(STATE.lastFocusedRecoveryId || "").trim();
  if (pendingId){
    requestAnimationFrame(() => {
      if (focusRecoveryHistoryItem(pendingId)){
        STATE.lastFocusedRecoveryId = null;
      }
    });
  }
}




function formatSessionType(value){
  const x = String(value || "").trim().toLowerCase();
  if (x === "styrke" || x === "strength") return tr("workout.type.strength");
  if (x === "cardio") return tr("session_type.cardio");
  if (x === "restitution" || x === "recovery" || x === "rest") return tr("session_type.recovery");
  if (x === "løb" || x === "run") return tr("session_type.run");
  if (x === "mobilitet" || x === "mobility") return tr("session_type.mobility");
  return x || tr("plan.none");
}



function buildForecastLeadText(planItem){
  if (!planItem || typeof planItem !== "object"){
    return tr("today_plan.no_plan_yet_short");
  }

  const sessionType = String(planItem.session_type || "").trim().toLowerCase();
  const entries = getSessionEntries(planItem);
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
        ? tr("forecast.intervals_with_target", { value: targetReps })
        : tr("forecast.intervals_default");
    }
    if (firstExercise.includes("tempo")){
      return targetReps
        ? tr("forecast.tempo_with_target", { value: targetReps })
        : tr("forecast.tempo_default");
    }
    if (firstExercise.includes("base")){
      return targetReps
        ? tr("forecast.base_with_target", { value: targetReps })
        : tr("forecast.base_default");
    }
    return targetReps
        ? tr("forecast.run_with_target", { value: targetReps })
        : tr("forecast.run_default");
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

  const dailyUiState = deriveDailyUiState(planItem || null, latestCheckin || null, STATE.sessionResults || []);
  const completedToday = dailyUiState === "completed_session_today";
  const completedRestDayToday = dailyUiState === "completed_rest_day_today";
  const plannedRestToday = isPlannedRestDayPlan(planItem);

  if (!planItem){
    setText("forecastType", "");
    const isFirstRun = dailyUiState === "first_run_onboarding";
    setText(
      "forecastSummary",
      isFirstRun
        ? tr("onboarding.first_run.soft_landing")
        : tr("forecast.welcome_no_history")
    );
    setText(
      "forecastReason",
      isFirstRun
        ? tr("onboarding.first_run.setup_reason")
        : (latestCheckin
            ? tr("forecast.latest_readiness", { value: latestCheckin.readiness_score ?? "-" })
            : tr("forecast.no_readiness_data"))
    );
    const btn = document.getElementById("forecastPrimaryBtn");
    if (btn){
      if (isFirstRun){
        btn.textContent = tr("onboarding.first_run.open_setup");
        btn.onclick = () => {
          showWizardStep("overview");
          requestAnimationFrame(() => {
            const profileCard = document.getElementById("profileEquipmentCard");
            if (profileCard && typeof profileCard.scrollIntoView === "function"){
              profileCard.scrollIntoView({ behavior: "smooth", block: "start" });
            }
            setEquipmentEditorOpen(true);
          });
        };
      } else {
        btn.textContent = tr("overview.go_to_checkin");
        btn.onclick = () => showWizardStep("checkin");
      }
    }
    return;
  }

  const missingTrainingTypes = String(planItem?.plan_variant || "").trim() === "missing_training_types";

  if (missingTrainingTypes){
    setText("forecastType", tr("forecast.missing_training_types_title"));
    setText("forecastSummary", tr("forecast.missing_training_types_summary"));
    setText("forecastReason", tr("forecast.missing_training_types_reason"));

    const btn = document.getElementById("forecastPrimaryBtn");
    if (btn){
      btn.textContent = tr("forecast.missing_training_types_cta");
      btn.onclick = () => {
        showWizardStep("overview");
        requestAnimationFrame(() => {
          const profileCard = document.getElementById("profileEquipmentCard");
          if (profileCard && typeof profileCard.scrollIntoView === "function"){
            profileCard.scrollIntoView({ behavior: "smooth", block: "start" });
          }
          setEquipmentEditorOpen(true);
        });
      };
    }
    return;
  }

  if (completedToday || completedRestDayToday){
    setText("forecastType", tr("forecast.completed_today"));
    setText(
      "forecastSummary",
      completedRestDayToday ? tr("today_plan.rest_day_acknowledged_saved") : tr("forecast.session_saved_today")
    );

    const bits = [];
    if (completedRestDayToday) {
      bits.push(tr("today_plan.rest_day_logged_title"));
    } else {
      if (planItem?.session_type) bits.push(formatSessionType(planItem.session_type));
      if (planItem?.time_budget_min) bits.push(tr("forecast.time_label", { minutes: planItem.time_budget_min }));
      if (planItem?.recovery_state && typeof planItem.recovery_state === "object"){
        bits.push(tr("forecast.recovery_label", { value: `${formatRecoveryState(planItem.recovery_state.recovery_state || "")}${planItem.recovery_state.recovery_score != null ? ` (${planItem.recovery_state.recovery_score})` : ""}` }));
      }
    }

    let nextGuidanceMessage = getNextPlannedSessionOverviewText(planItem || null) || "";
    if (!nextGuidanceMessage){
      const rawNextGuidanceMessage = String(planItem?.next_guidance?.message || "").trim();
      const loweredNextGuidance = rawNextGuidanceMessage.toLowerCase();
      if (
        !loweredNextGuidance.includes("there is no next training day yet") &&
        !loweredNextGuidance.includes("no next training day yet")
      ){
        nextGuidanceMessage = rawNextGuidanceMessage;
      }
    }

    const forecastReasonEl = document.getElementById("forecastReason");
    if (forecastReasonEl){
      forecastReasonEl.textContent = [bits.join(" · "), nextGuidanceMessage].filter(Boolean).join("\n");
      forecastReasonEl.style.whiteSpace = "pre-line";
    }

    const btn = document.getElementById("forecastPrimaryBtn");
    if (btn){
      btn.textContent = tr("button.view_status");
      btn.onclick = () => showWizardStep(completedRestDayToday ? "overview" : "review");
    }
    return;
  }

  setText("forecastType", plannedRestToday ? tr("session_type.rest_day") : getForecastTypeLabel(planItem));

  const leadText = plannedRestToday
    ? tr("today_plan.rest_day_planned_today")
    : buildForecastLeadText(planItem);

  const bits = [];
  if (planItem.readiness_score != null) bits.push(tr("forecast.readiness_label", { value: planItem.readiness_score }));
  if (planItem.time_budget_min) bits.push(tr("forecast.time_label", { minutes: planItem.time_budget_min }));
  const timingLabel = formatTimingState(planItem.timing_state);
  if (timingLabel) bits.push(tr("forecast.timing_label", { value: timingLabel }));
  const planVariantLabel = formatPlanVariant(planItem.plan_variant || "");
  if (planVariantLabel && !plannedRestToday) bits.push(tr("forecast.plan_label", { value: formatPlanMotor(planVariantLabel) }));
  if (planItem.recovery_state && typeof planItem.recovery_state === "object") bits.push(tr("forecast.recovery_label", { value: `${formatRecoveryState(planItem.recovery_state.recovery_state || "")}${planItem.recovery_state.recovery_score != null ? ` (${planItem.recovery_state.recovery_score})` : ""}` }));

  let nextGuidanceMessage = String(planItem?.next_guidance?.message || "").trim();
  if (plannedRestToday){
    const lowered = nextGuidanceMessage.toLowerCase();
    if (
      lowered.includes("i dag er restitution") ||
      lowered.includes("today is recovery") ||
      lowered.includes("today is restitution")
    ){
      nextGuidanceMessage = "";
    }
  }

  const reasonParts = [bits.join(" · "), formatPlanReason(planItem.reason || "")].filter(Boolean);
  const localProtectionExplanation = String(planItem?.local_protection_explanation || "").trim();
    const forecastReasonText = [
      reasonParts.join(" · "),
      localProtectionExplanation ? `${tr("today_plan.local_protection_label")}: ${localProtectionExplanation}` : "",
      nextGuidanceMessage
    ].filter(Boolean).join("\n");

  setText("forecastSummary", leadText);
  const forecastReasonEl = document.getElementById("forecastReason");
  if (forecastReasonEl){
    forecastReasonEl.textContent = forecastReasonText;
    forecastReasonEl.style.whiteSpace = "pre-line";
  }

  const btn = document.getElementById("forecastPrimaryBtn");
  if (btn){
    btn.textContent = plannedRestToday ? tr("button.view_rest_day") : tr("button.view_today_plan");
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
  const card = document.getElementById("overviewStatusCard");
  const readinessValue = document.getElementById("overviewReadinessValue");
  const latestCheckinLine = document.getElementById("overviewLatestCheckinLine");
  const overviewTimeLine = document.getElementById("overviewTimeLine");
  const overviewWorkoutLine = document.getElementById("overviewWorkoutLine");

  const sessionCount = Array.isArray(STATE.sessionResults) ? STATE.sessionResults.length : 0;
  const isFirstTime = !planItem && !latestCheckin && sessionCount === 0;
  const dailyUiState = deriveDailyUiState(planItem || null, latestCheckin || null, STATE.sessionResults || []);

  if (card){
    const hideForFirstRun = dailyUiState === "first_run_onboarding";
    card.classList.toggle("overview-metric-hidden", hideForFirstRun);
    card.style.display = hideForFirstRun ? "none" : "";
  }

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
    } else if (dailyUiState === "no_checkin_yet"){
      latestCheckinLine.textContent = tr("overview.no_checkin_yet");
    } else if (dailyUiState === "completed_rest_day_today"){
      latestCheckinLine.textContent = latestCheckin?.date
        ? tr("overview.latest_checkin", { value: latestCheckin.date })
        : tr("today_plan.rest_day_acknowledged_saved");
    } else if (dailyUiState === "completed_session_today"){
      latestCheckinLine.textContent = latestCheckin?.date
        ? tr("overview.latest_checkin", { value: latestCheckin.date })
        : tr("overview.completed_today_status");
    } else if (latestCheckin?.date){
      latestCheckinLine.textContent = tr("overview.latest_checkin", { value: latestCheckin.date });
    } else {
      latestCheckinLine.textContent = tr("overview.no_checkin_yet");
    }
  }

  if (overviewTimeLine){
    if (isFirstTime || dailyUiState === "no_checkin_yet"){
      overviewTimeLine.textContent = tr("overview.start_with_checkin");
    } else if (dailyUiState === "planned_rest_today"){
      overviewTimeLine.textContent = tr("today_plan.rest_day_planned_today");
    } else if (dailyUiState === "completed_rest_day_today"){
      overviewTimeLine.textContent = tr("today_plan.rest_day_logged_text");
    } else if (planItem?.time_budget_min){
      overviewTimeLine.textContent = tr("overview.time_today", { minutes: planItem.time_budget_min });
    } else if (latestCheckin?.time_budget_min){
      overviewTimeLine.textContent = tr("overview.latest_time_budget", { minutes: latestCheckin.time_budget_min });
    } else {
      overviewTimeLine.textContent = tr("overview.no_time_estimate_yet");
    }
  }

  if (overviewWorkoutLine){
    overviewWorkoutLine.style.whiteSpace = "";
    if (isFirstTime){
      overviewWorkoutLine.textContent = tr("overview.no_history_first_point");
    } else if (dailyUiState === "no_checkin_yet"){
      overviewWorkoutLine.textContent = tr("overview.go_to_checkin");
    } else if (dailyUiState === "plan_ready"){
      overviewWorkoutLine.textContent = tr("button.start_workout");
    } else if (dailyUiState === "planned_rest_today"){
      overviewWorkoutLine.textContent = tr("today_plan.acknowledge_rest_day");
    } else if (dailyUiState === "completed_rest_day_today"){
      const nextOverviewText = getNextPlannedSessionOverviewText(planItem || null);
      overviewWorkoutLine.textContent = nextOverviewText || tr("today_plan.rest_day_logged_title");
      overviewWorkoutLine.style.whiteSpace = nextOverviewText ? "pre-line" : "";
    } else if (dailyUiState === "completed_session_today"){
      const nextOverviewText = getNextPlannedSessionOverviewText(planItem || null);
      overviewWorkoutLine.textContent = nextOverviewText || tr("overview.completed_today_review_hint");
      overviewWorkoutLine.style.whiteSpace = nextOverviewText ? "pre-line" : "";
    } else if (sessionCount > 0){
      overviewWorkoutLine.textContent = tr("overview.logged_sessions_count", { count: sessionCount });
    } else {
      overviewWorkoutLine.textContent = tr("overview.no_history_yet");
    }
  }

  renderFirstRunOnboardingCard({
    planItem: planItem || null,
    latestCheckin: latestCheckin || null,
    sessionResults: STATE.sessionResults || []
  });
}

function buildInitialSetupChecklist(userSettings){
  const settings = userSettings && typeof userSettings === "object" ? userSettings : {};
  const profile = settings.profile && typeof settings.profile === "object" ? settings.profile : {};
  const preferences = settings.preferences && typeof settings.preferences === "object" ? settings.preferences : {};
  const trainingTypes = preferences.training_types && typeof preferences.training_types === "object" ? preferences.training_types : {};
  const trainingDays = preferences.training_days && typeof preferences.training_days === "object" ? preferences.training_days : {};
  const availableEquipment = settings.available_equipment && typeof settings.available_equipment === "object" ? settings.available_equipment : {};

  const hasHeight = profile.height_cm != null && String(profile.height_cm).trim() !== "";
  const hasBodyweight = profile.bodyweight_kg != null && String(profile.bodyweight_kg).trim() !== "";
  const hasTrainingType = Object.values(trainingTypes).some(Boolean);
  const hasTrainingDays = Object.values(trainingDays).some(Boolean);

  const equipmentKeys = ["barbell", "dumbbell", "bodyweight", "bench", "machine", "cable"];
  const hasAnyEquipmentValue = equipmentKeys.some(key => typeof availableEquipment[key] === "boolean");
  const hasEquipment = hasAnyEquipmentValue && equipmentKeys.some(key => availableEquipment[key] === true);

  const menstruationConfigured = preferences.menstruation_support_enabled === true;

  const items = [
    {
      key: "profile",
      done: hasHeight && hasBodyweight,
      optional: false,
      label: tr("onboarding.first_run.checklist.profile"),
      help: tr("onboarding.first_run.checklist.profile_help")
    },
    {
      key: "training_types",
      done: hasTrainingType,
      optional: false,
      label: tr("onboarding.first_run.checklist.training_types"),
      help: tr("onboarding.first_run.checklist.training_types_help")
    },
    {
      key: "equipment",
      done: hasEquipment,
      optional: false,
      label: tr("onboarding.first_run.checklist.equipment"),
      help: tr("onboarding.first_run.checklist.equipment_help")
    },
    {
      key: "planning",
      done: hasTrainingDays,
      optional: false,
      label: tr("onboarding.first_run.checklist.planning"),
      help: tr("onboarding.first_run.checklist.planning_help")
    },
    {
      key: "physiology",
      done: menstruationConfigured,
      optional: true,
      label: tr("onboarding.first_run.checklist.physiology"),
      help: tr("onboarding.first_run.checklist.physiology_help")
    }
  ];

  const requiredDone = items.filter(x => !x.optional && x.done).length;
  const requiredTotal = items.filter(x => !x.optional).length;
  const readyForRecommendation = requiredDone >= requiredTotal;

  return {
    items,
    requiredDone,
    requiredTotal,
    readyForRecommendation
  };
}

const FIRST_RUN_SETUP_STEPS = [
  "basic_profile",
  "training_types",
  "equipment",
  "planning",
  "physiology",
  "finish"
];

function isFirstRunSetupFlowActive(){
  const dailyUiState = deriveDailyUiState(
    STATE.currentTodayPlan || null,
    STATE.latestCheckin || null,
    STATE.sessionResults || []
  );
  return dailyUiState === "first_run_onboarding";
}

function getFirstRunSetupCurrentStep(){
  const value = String(STATE.firstRunSetupStep || "").trim();
  return FIRST_RUN_SETUP_STEPS.includes(value) ? value : FIRST_RUN_SETUP_STEPS[0];
}

function setFirstRunSetupCurrentStep(step){
  const next = String(step || "").trim();
  STATE.firstRunSetupStep = FIRST_RUN_SETUP_STEPS.includes(next)
    ? next
    : FIRST_RUN_SETUP_STEPS[0];
}

function getFirstRunSetupStepIndex(step){
  return FIRST_RUN_SETUP_STEPS.indexOf(String(step || "").trim());
}

function getNextFirstRunSetupStep(step){
  const idx = getFirstRunSetupStepIndex(step);
  if (idx === -1 || idx >= FIRST_RUN_SETUP_STEPS.length - 1) return FIRST_RUN_SETUP_STEPS[FIRST_RUN_SETUP_STEPS.length - 1];
  return FIRST_RUN_SETUP_STEPS[idx + 1];
}

function getPreviousFirstRunSetupStep(step){
  const idx = getFirstRunSetupStepIndex(step);
  if (idx <= 0) return FIRST_RUN_SETUP_STEPS[0];
  return FIRST_RUN_SETUP_STEPS[idx - 1];
}

function renderFirstRunOnboardingCard({ planItem, latestCheckin, sessionResults } = {}){
  const card = document.getElementById("firstRunOnboardingCard");
  const openSetupBtn = document.getElementById("openInitialSetupBtn");
  const continueBtn = document.getElementById("continueToCheckinBtn");
  const setupStatus = document.getElementById("firstRunSetupStatus");
  const checklist = document.getElementById("firstRunChecklist");
  if (!card) return;

  const firstRun = isFirstRunUser(planItem || null, latestCheckin || null, sessionResults || []);
  card.classList.toggle("wizard-step-hidden", !firstRun);
  card.style.display = firstRun ? "" : "none";

  if (!firstRun){
    if (openSetupBtn){
      openSetupBtn.onclick = null;
      openSetupBtn.disabled = false;
    }
    if (continueBtn){
      continueBtn.onclick = null;
      continueBtn.disabled = false;
      continueBtn.style.display = "none";
    }
    return;
  }

  const checklistState = buildInitialSetupChecklist(getInitialSetupChecklistSourceSettings());
  const missingRequired = checklistState.items.filter(item => !item.optional && !item.done);
  const nextRecommendedKey = missingRequired.length ? missingRequired[0].key : "planning";

  if (setupStatus){
    const headline = checklistState.readyForRecommendation
      ? tr("onboarding.first_run.ready")
      : tr("onboarding.first_run.missing_setup", { done: checklistState.requiredDone, total: checklistState.requiredTotal });

    const nextStepText = checklistState.readyForRecommendation
      ? tr("onboarding.first_run.next_step_ready")
      : tr("onboarding.first_run.next_step_missing", {
          step: tr(`onboarding.first_run.checklist.${nextRecommendedKey}`)
        });

    setupStatus.textContent = `${headline} · ${nextStepText}`;
  }

  if (checklist){
    checklist.classList.add("onboarding-checklist");
    checklist.innerHTML = checklistState.items.map(item => {
      const stateKey = item.done
        ? "ready"
        : (item.optional ? "optional" : "missing");
      const stateLabel = item.done
        ? tr("onboarding.first_run.status_done")
        : (item.optional
          ? tr("onboarding.first_run.status_optional")
          : tr("onboarding.first_run.status_missing"));
      return `
        <div class="onboarding-checklist-item is-${esc(stateKey)}">
          <span class="onboarding-state-badge is-${esc(stateKey)}">${esc(stateLabel)}</span>
          <strong>${esc(item.label)}</strong>
          <span class="small">${esc(item.help)}</span>
        </div>
      `;
    }).join("");
  }

  if (openSetupBtn){
    openSetupBtn.textContent = checklistState.readyForRecommendation
      ? tr("onboarding.first_run.review_setup")
      : tr("onboarding.first_run.open_setup");

    openSetupBtn.onclick = (ev) => {
      ev.preventDefault();
      const mappedStep = nextRecommendedKey === "profile" ? "basic_profile" : nextRecommendedKey;
      setFirstRunSetupCurrentStep(mappedStep);
      showWizardStep("overview");
      requestAnimationFrame(() => {
        const profileCard = document.getElementById("profileEquipmentCard");
        if (profileCard && typeof profileCard.scrollIntoView === "function"){
          profileCard.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        setEquipmentEditorOpen(true);
      });
    };
  }

  if (continueBtn){
    continueBtn.style.display = "";
    continueBtn.disabled = !checklistState.readyForRecommendation;
    continueBtn.textContent = checklistState.readyForRecommendation
      ? tr("onboarding.first_run.continue_to_checkin")
      : tr("onboarding.first_run.complete_setup_first");

    continueBtn.onclick = (ev) => {
      ev.preventDefault();
      if (!checklistState.readyForRecommendation){
        if (openSetupBtn && typeof openSetupBtn.click === "function"){
          openSetupBtn.click();
        }
        return;
      }
      showWizardStep("checkin");
    };
  }

}



function renderProfileEquipmentCard(){
  const displayNameEl = document.getElementById("profileDisplayName");
  const bodyLineEl = document.getElementById("profileBodyLine");
  const trainingTypesLineEl = document.getElementById("profileTrainingTypesLine");
  const trainingDaysLineEl = document.getElementById("profileTrainingDaysLine");
  const activeProgramsLineEl = document.getElementById("profileActiveProgramsLine");
  const profileActiveProgramCardsWrapEl = document.getElementById("profileActiveProgramCardsWrap");
  const profileStrengthProgramCardEl = document.getElementById("profileStrengthProgramCard");
  const profileStrengthProgramSummaryEl = document.getElementById("profileStrengthProgramSummary");
  const profileStrengthProgramWhyEl = document.getElementById("profileStrengthProgramWhy");
  const profileRunProgramCardEl = document.getElementById("profileRunProgramCard");
  const profileRunProgramSummaryEl = document.getElementById("profileRunProgramSummary");
  const profileRunProgramWhyEl = document.getElementById("profileRunProgramWhy");
  const profileSectionDisplayNameEl = document.getElementById("profileSectionDisplayName");
  const profileSectionBodyLineEl = document.getElementById("profileSectionBodyLine");
  const profileSectionTrainingTypesLineEl = document.getElementById("profileSectionTrainingTypesLine");
  const profileSectionTrainingDaysLineEl = document.getElementById("profileSectionTrainingDaysLine");
  const equipmentLineEl = document.getElementById("profileEquipmentLine");
  const profileSectionEquipmentLineEl = document.getElementById("profileSectionEquipmentLine");
  const strengthProgramControlWrapEl = document.getElementById("profileStrengthProgramControlWrap");
  const strengthProgramSelectEl = document.getElementById("profileStrengthProgramSelect");
  const runProgramControlWrapEl = document.getElementById("profileRunProgramControlWrap");
  const runProgramSelectEl = document.getElementById("profileRunProgramSelect");
  const saveProfileProgramsBtn = document.getElementById("saveProfileProgramsBtn");
  const recommendedProgramWrapEl = document.getElementById("profileRecommendedProgramWrap");
  const recommendedCurrentStrengthLineEl = document.getElementById("profileRecommendedCurrentStrengthLine");
  const recommendedStrengthLineEl = document.getElementById("profileRecommendedStrengthLine");
  const recommendedStrengthReasonEl = document.getElementById("profileRecommendedStrengthReason");
  const profileProgramActionStatusEl = document.getElementById("profileProgramActionStatus");
  const applyRecommendedStrengthProgramBtn = document.getElementById("applyRecommendedStrengthProgramBtn");
  const strengthProgramControlWrapProfileEl = document.getElementById("profileStrengthProgramControlWrapProfile");
  const strengthProgramSelectProfileEl = document.getElementById("profileStrengthProgramSelectProfile");
  const runProgramControlWrapProfileEl = document.getElementById("profileRunProgramControlWrapProfile");
  const runProgramSelectProfileEl = document.getElementById("profileRunProgramSelectProfile");
  const saveProfileProgramsBtnProfile = document.getElementById("saveProfileProgramsBtnProfile");
  const recommendedProgramWrapProfileEl = document.getElementById("profileRecommendedProgramWrapProfile");
  const recommendedCurrentStrengthLineProfileEl = document.getElementById("profileRecommendedCurrentStrengthLineProfile");
  const recommendedStrengthLineProfileEl = document.getElementById("profileRecommendedStrengthLineProfile");
  const recommendedStrengthReasonProfileEl = document.getElementById("profileRecommendedStrengthReasonProfile");
  const profileProgramActionStatusProfileEl = document.getElementById("profileProgramActionStatusProfile");
  const applyRecommendedStrengthProgramBtnProfile = document.getElementById("applyRecommendedStrengthProgramBtnProfile");
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
  const activeProgramOverrides = preferences.active_program_overrides && typeof preferences.active_program_overrides === "object"
    ? preferences.active_program_overrides
    : {};
  const menstruationSupportEnabled = preferences.menstruation_support_enabled === true;
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
  const activeProgramsByDomain = settings.active_programs_by_domain && typeof settings.active_programs_by_domain === "object"
    ? settings.active_programs_by_domain
    : {};
  const activeProgramStatusByDomain = settings.active_program_status_by_domain && typeof settings.active_program_status_by_domain === "object"
    ? settings.active_program_status_by_domain
    : {};
  const nextGuidance = STATE.currentTodayPlan?.next_guidance && typeof STATE.currentTodayPlan.next_guidance === "object"
    ? STATE.currentTodayPlan.next_guidance
    : null;
  const recommendedStrengthProgramId = nextGuidance?.kind === "program_switch_recommendation"
    ? String(nextGuidance?.recommended_program_id || "").trim()
    : "";
  const recommendedStrengthReason = String(nextGuidance?.switch_reason || nextGuidance?.message || "").trim();

  const enabledEquipment = Object.entries(available)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => key);

  const incrementEntries = Object.entries(increments)
    .filter(([key, value]) => key !== "bodyweight" && value !== "" && value != null && !Number.isNaN(Number(value)));

  if (displayNameEl){
    displayNameEl.textContent = username;
  }
  if (profileSectionDisplayNameEl){
    profileSectionDisplayNameEl.textContent = username;
  }

  const getProgramById = (programId) => {
    const id = String(programId || "").trim();
    if (!id) return null;
    return Array.isArray(STATE.programs)
      ? (STATE.programs.find(program => String(program?.id || "").trim() === id) || null)
      : null;
  };

  const getProgramNameById = (programId) => {
    const found = getProgramById(programId);
    return found ? getProgramDisplayName(found) : (String(programId || "").trim() || null);
  };

  const recommendedStrengthProgramName = getProgramNameById(recommendedStrengthProgramId);

  const fillProgramOverrideSelect = (selectEl, kind, selectedValue) => {
    if (!selectEl) return;
    const normalizedKind = String(kind || "").trim().toLowerCase();
    const programs = Array.isArray(STATE.programs)
      ? STATE.programs.filter(program => {
          const x = String(program?.kind || "").trim().toLowerCase();
          if (normalizedKind === "strength") return x === "strength" || x === "styrke";
          if (normalizedKind === "run") return x === "run" || x === "løb" || x === "running";
          return false;
        })
      : [];

    const options = [
      `<option value="">${esc(tr("profile.active_program_auto"))}</option>`,
      ...programs.map(program => `<option value="${esc(String(program.id || ""))}">${esc(getProgramDisplayName(program))}</option>`)
    ];

    selectEl.innerHTML = options.join("");
    selectEl.value = String(selectedValue || "").trim();
    if (selectEl.value !== String(selectedValue || "").trim()){
      selectEl.value = "";
    }
  };

  const profileBits = [];
  if (profile.height_cm != null && profile.height_cm !== "") profileBits.push(tr("profile.height_value", { value: `${profile.height_cm} cm` }));
  if (profile.bodyweight_kg != null && profile.bodyweight_kg !== "") profileBits.push(tr("profile.bodyweight_value", { value: `${profile.bodyweight_kg} kg` }));

  const formatProgramSelectionSource = (source) => {
    const normalized = String(source || "").trim().toLowerCase();
    if (normalized === "manual_override") return tr("profile.active_program_selected_by_user");
    if (normalized === "accepted_recommendation") return tr("profile.active_program_accepted_recommendation");
    if (normalized === "auto_assigned") return tr("profile.active_program_auto_assigned");
    if (normalized === "automatic" || normalized === "automatic_recommendation") return tr("profile.active_program_selected_automatically");
    return "";
  };

  const getEquipmentReasonText = () => {
    const hasBarbell = available.barbell !== false;
    const hasBench = available.bench !== false;
    const hasDumbbell = available.dumbbell !== false;
    const hasBodyweight = available.bodyweight !== false;
    if (hasBarbell && hasBench) return tr("profile.program_why_equipment_barbell_bench");
    if (hasDumbbell) return tr("profile.program_why_equipment_dumbbell");
    if (hasBodyweight) return tr("profile.program_why_equipment_bodyweight");
    return tr("profile.program_why_equipment_basic");
  };

  const getStartingProfileLabel = (domain) => {
    if (String(domain) === "strength"){
      const value = String(preferences.strength_starting_profile || "beginner").trim() || "beginner";
      if (value === "conservative_beginner") return tr("profile.strength_starting_profile_conservative");
      if (value === "novice") return tr("profile.strength_starting_profile_novice");
      if (value === "intermediate") return tr("profile.strength_starting_profile_intermediate");
      return tr("profile.strength_starting_profile_beginner");
    }
    const value = String(preferences.run_starting_profile || "beginner").trim() || "beginner";
    if (value === "conservative_beginner") return tr("profile.run_starting_profile_conservative");
    if (value === "novice") return tr("profile.run_starting_profile_novice");
    return tr("profile.run_starting_profile_beginner");
  };

  const buildProgramWhyReason = (domain) => {
    const selectionSource = String(activeProgramStatusByDomain?.[domain]?.selection_source || "").trim().toLowerCase();
    if (!selectionSource || selectionSource === "manual_override") return "";

    const weekGoal = tr("profile.program_why_week_goal", { count: weeklyTargetSessions });
    const startLevel = tr("profile.program_why_starting_level", { value: getStartingProfileLabel(domain) });

    if (domain === "strength"){
      return tr("profile.program_why_strength", {
        week_goal: weekGoal,
        equipment: getEquipmentReasonText(),
        starting_level: startLevel
      });
    }

    return tr("profile.program_why_run", {
      week_goal: weekGoal,
      starting_level: startLevel
    });
  };

  const strengthTrainingEnabled = Boolean(trainingTypes.strength_weights) || Boolean(trainingTypes.bodyweight);
  const runTrainingEnabled = Boolean(trainingTypes.running);

  const activeProgramBits = [];
  const activeStrengthProgram = getProgramById(activeProgramsByDomain.strength);
  const activeStrengthProgramName = activeStrengthProgram ? getProgramDisplayName(activeStrengthProgram) : getProgramNameById(activeProgramsByDomain.strength);
  const activeStrengthIdentity = activeStrengthProgram ? getProgramIdentityLabel(activeStrengthProgram) : "";
  const activeStrengthSource = formatProgramSelectionSource(activeProgramStatusByDomain?.strength?.selection_source);
  if (strengthTrainingEnabled && activeStrengthProgramName){
    const strengthLabel = tr("profile.active_program_strength_value", { value: activeStrengthProgramName });
    activeProgramBits.push([strengthLabel, activeStrengthIdentity, activeStrengthSource].filter(Boolean).join(" · "));
  }
  const activeEnduranceProgram = getProgramById(activeProgramsByDomain.run);
  const activeEnduranceProgramName = activeEnduranceProgram ? getProgramDisplayName(activeEnduranceProgram) : getProgramNameById(activeProgramsByDomain.run);
  const activeEnduranceIdentity = activeEnduranceProgram ? getProgramIdentityLabel(activeEnduranceProgram) : "";
  const activeEnduranceSource = formatProgramSelectionSource(activeProgramStatusByDomain?.run?.selection_source);
  if (runTrainingEnabled && activeEnduranceProgramName){
    const enduranceLabel = tr("profile.active_program_endurance_value", { value: activeEnduranceProgramName });
    activeProgramBits.push([enduranceLabel, activeEnduranceIdentity, activeEnduranceSource].filter(Boolean).join(" · "));
  }

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

  const profileBodyText = profileBits.length
    ? profileBits.join(" · ")
    : tr("profile.no_body_metrics_yet");

  if (bodyLineEl){
    bodyLineEl.textContent = profileBodyText;
  }
  if (profileSectionBodyLineEl){
    profileSectionBodyLineEl.textContent = profileBodyText;
  }

  const trainingTypesText = selectedTraining.length
    ? tr("profile.training_types_value", { value: selectedTraining.join(", ") })
    : tr("profile.training_types_none");

  if (trainingTypesLineEl){
    trainingTypesLineEl.textContent = trainingTypesText;
  }
  if (profileSectionTrainingTypesLineEl){
    profileSectionTrainingTypesLineEl.textContent = trainingTypesText;
  }

  const trainingDaysText = (() => {
    const dayText = selectedDays.length
      ? tr("profile.training_days_value", { value: selectedDays.join(", ") })
      : tr("checkin.possible_days_none");
    return `${dayText} · ${tr("profile.week_goal_value", { count: weeklyTargetSessions })}`;
  })();

  if (trainingDaysLineEl){
    trainingDaysLineEl.textContent = trainingDaysText;
  }
  if (profileSectionTrainingDaysLineEl){
    profileSectionTrainingDaysLineEl.textContent = trainingDaysText;
  }

  if (activeProgramsLineEl){
    activeProgramsLineEl.textContent = activeProgramBits.length
      ? tr("profile.active_programs_value", { value: activeProgramBits.join(" · ") })
      : tr("profile.active_programs_none");
    activeProgramsLineEl.style.display = activeProgramBits.length ? "none" : "";
  }

  const strengthJourney = strengthTrainingEnabled && activeStrengthProgram
    ? getStrengthJourneyCopy(activeStrengthProgram)
    : "";
  const strengthWhy = strengthTrainingEnabled && activeStrengthProgramName
    ? [strengthJourney, buildProgramWhyReason("strength")].filter(Boolean).join(" ")
    : "";
  const runningJourney = runTrainingEnabled && activeEnduranceProgram
    ? getRunningJourneyCopy(activeEnduranceProgram)
    : "";
  const runWhy = runTrainingEnabled && activeEnduranceProgramName
    ? [runningJourney, buildProgramWhyReason("run")].filter(Boolean).join(" ")
    : "";

  if (profileStrengthProgramSummaryEl){
    profileStrengthProgramSummaryEl.textContent = activeStrengthProgramName
      ? [activeStrengthProgramName, activeStrengthSource].filter(Boolean).join(" · ")
      : "";
  }
  if (profileStrengthProgramWhyEl){
    profileStrengthProgramWhyEl.textContent = strengthWhy;
    profileStrengthProgramWhyEl.style.display = strengthWhy ? "" : "none";
  }
  if (profileStrengthProgramCardEl){
    profileStrengthProgramCardEl.style.display = strengthTrainingEnabled && activeStrengthProgramName ? "" : "none";
  }

  if (profileRunProgramSummaryEl){
    profileRunProgramSummaryEl.textContent = activeEnduranceProgramName
      ? [activeEnduranceProgramName, activeEnduranceSource].filter(Boolean).join(" · ")
      : "";
  }
  if (profileRunProgramWhyEl){
    profileRunProgramWhyEl.textContent = runWhy;
    profileRunProgramWhyEl.style.display = runWhy ? "" : "none";
  }
  if (profileRunProgramCardEl){
    profileRunProgramCardEl.style.display = runTrainingEnabled && activeEnduranceProgramName ? "" : "none";
  }

  if (profileActiveProgramCardsWrapEl){
    const hasCards = (strengthTrainingEnabled && activeStrengthProgramName) || (runTrainingEnabled && activeEnduranceProgramName);
    profileActiveProgramCardsWrapEl.style.display = hasCards ? "" : "none";
  }

  const applyProgramStatusState = (statusEl) => {
    if (!statusEl) return;
    statusEl.classList.remove("ok", "warn");
    if (PROFILE_PROGRAM_SWITCH_STATUS && PROFILE_PROGRAM_SWITCH_STATUS.kind === "ok"){
      statusEl.textContent = PROFILE_PROGRAM_SWITCH_STATUS.message || "";
      statusEl.style.display = PROFILE_PROGRAM_SWITCH_STATUS.message ? "" : "none";
      statusEl.classList.add("ok");
      requestAnimationFrame(() => {
        statusEl.style.opacity = PROFILE_PROGRAM_SWITCH_STATUS.message ? "1" : "0";
      });
    } else {
      statusEl.textContent = "";
      statusEl.style.opacity = "0";
      statusEl.style.display = "none";
    }
  };

  applyProgramStatusState(profileProgramActionStatusEl);
  applyProgramStatusState(profileProgramActionStatusProfileEl);

  const hasRecommendation = strengthTrainingEnabled
    && Boolean(recommendedStrengthProgramId && recommendedStrengthProgramName)
    && recommendedStrengthProgramId !== String(activeProgramsByDomain.strength || "").trim();

  const applyRecommendationState = (wrapEl, currentEl, lineEl, reasonEl, buttonEl) => {
    if (!wrapEl || !lineEl || !reasonEl) return;

    wrapEl.classList.toggle("wizard-step-hidden", !hasRecommendation);
    wrapEl.style.display = hasRecommendation ? "" : "none";

    if (buttonEl){
      buttonEl.dataset.recommendedProgramId = hasRecommendation ? recommendedStrengthProgramId : "";
    }

    if (hasRecommendation){
      if (currentEl){
        currentEl.textContent = activeStrengthProgramName
          ? tr("profile.recommended_current_strength_program_value", { value: activeStrengthProgramName })
          : tr("profile.recommended_current_strength_program_missing");
      }
      lineEl.textContent = tr("profile.recommended_strength_program_value", {
        value: recommendedStrengthProgramName
      });
      reasonEl.textContent = recommendedStrengthReason || tr("profile.recommended_strength_program_default_reason");
    } else {
      if (currentEl){
        currentEl.textContent = "";
      }
      lineEl.textContent = "";
      reasonEl.textContent = "";
    }
  };

  applyRecommendationState(
    recommendedProgramWrapEl,
    recommendedCurrentStrengthLineEl,
    recommendedStrengthLineEl,
    recommendedStrengthReasonEl,
    applyRecommendedStrengthProgramBtn
  );
  applyRecommendationState(
    recommendedProgramWrapProfileEl,
    recommendedCurrentStrengthLineProfileEl,
    recommendedStrengthLineProfileEl,
    recommendedStrengthReasonProfileEl,
    applyRecommendedStrengthProgramBtnProfile
  );

  if (strengthProgramControlWrapEl){
    strengthProgramControlWrapEl.style.display = strengthTrainingEnabled ? "" : "none";
  }
  if (strengthProgramControlWrapProfileEl){
    strengthProgramControlWrapProfileEl.style.display = strengthTrainingEnabled ? "" : "none";
  }
  if (runProgramControlWrapEl){
    runProgramControlWrapEl.style.display = runTrainingEnabled ? "" : "none";
  }
  if (runProgramControlWrapProfileEl){
    runProgramControlWrapProfileEl.style.display = runTrainingEnabled ? "" : "none";
  }
  if (saveProfileProgramsBtn){
    saveProfileProgramsBtn.style.display = (strengthTrainingEnabled || runTrainingEnabled) ? "" : "none";
  }
  if (saveProfileProgramsBtnProfile){
    saveProfileProgramsBtnProfile.style.display = (strengthTrainingEnabled || runTrainingEnabled) ? "" : "none";
  }
  const overrideHelpEl = document.getElementById("profileProgramOverrideHelp");
  if (overrideHelpEl){
    overrideHelpEl.style.display = (strengthTrainingEnabled || runTrainingEnabled) ? "" : "none";
  }

  if (strengthTrainingEnabled){
    fillProgramOverrideSelect(strengthProgramSelectEl, "strength", activeProgramOverrides.strength);
    fillProgramOverrideSelect(strengthProgramSelectProfileEl, "strength", activeProgramOverrides.strength);
  } else {
    if (strengthProgramSelectEl) strengthProgramSelectEl.value = "";
    if (strengthProgramSelectProfileEl) strengthProgramSelectProfileEl.value = "";
  }

  if (runTrainingEnabled){
    fillProgramOverrideSelect(runProgramSelectEl, "run", activeProgramOverrides.run);
    fillProgramOverrideSelect(runProgramSelectProfileEl, "run", activeProgramOverrides.run);
  } else {
    if (runProgramSelectEl) runProgramSelectEl.value = "";
    if (runProgramSelectProfileEl) runProgramSelectProfileEl.value = "";
  }

  if (applyRecommendedStrengthProgramBtn && !applyRecommendedStrengthProgramBtn.dataset.bound){
    applyRecommendedStrengthProgramBtn.dataset.bound = "1";
    applyRecommendedStrengthProgramBtn.addEventListener("click", async () => {
      const recommendedProgramId = String(applyRecommendedStrengthProgramBtn.dataset.recommendedProgramId || "").trim();
      if (!recommendedProgramId || !strengthProgramSelectEl) return;

      const recommendedProgramName = getProgramNameById(recommendedProgramId) || recommendedProgramId;

      PROFILE_PROGRAM_SWITCH_STATUS = {
        kind: "ok",
        message: tr("profile.recommended_program_switch_success", { value: recommendedProgramName })
      };
      PROFILE_ACCEPTED_RECOMMENDATION_PENDING = {
        domain: "strength",
        program_id: recommendedProgramId
      };

      if (PROFILE_PROGRAM_SWITCH_STATUS_TIMEOUT){
        clearTimeout(PROFILE_PROGRAM_SWITCH_STATUS_TIMEOUT);
        PROFILE_PROGRAM_SWITCH_STATUS_TIMEOUT = null;
      }

      strengthProgramSelectEl.value = recommendedProgramId;
      saveProfileProgramsBtn?.click();

      PROFILE_PROGRAM_SWITCH_STATUS_TIMEOUT = setTimeout(() => {
        const statusEl = document.getElementById("profileProgramActionStatus");
        if (statusEl){
          statusEl.style.opacity = "0";
        }
        setTimeout(() => {
          PROFILE_PROGRAM_SWITCH_STATUS = null;
          PROFILE_PROGRAM_SWITCH_STATUS_TIMEOUT = null;
          renderProfileEquipmentCard();
        }, 260);
      }, 2200);
    });
  }

  if (saveProfileProgramsBtn && !saveProfileProgramsBtn.dataset.bound){
    saveProfileProgramsBtn.dataset.bound = "1";
    saveProfileProgramsBtn.addEventListener("click", async () => {
      const currentSettings = STATE.userSettings && typeof STATE.userSettings === "object" ? STATE.userSettings : {};
      const currentPreferences = currentSettings.preferences && typeof currentSettings.preferences === "object"
        ? currentSettings.preferences
        : {};
      const nextOverrides = {};
      const selectedStrength = String(strengthProgramSelectEl?.value || "").trim();
      const selectedRun = String(runProgramSelectEl?.value || "").trim();

      if (selectedStrength) nextOverrides.strength = selectedStrength;
      if (selectedRun) nextOverrides.run = selectedRun;

      const nextPreferences = { ...currentPreferences };
      if (Object.keys(nextOverrides).length){
        nextPreferences.active_program_overrides = nextOverrides;
      } else {
        delete nextPreferences.active_program_overrides;
      }

      const currentAcceptedRecommendations = currentPreferences.accepted_program_recommendations
        && typeof currentPreferences.accepted_program_recommendations === "object"
          ? currentPreferences.accepted_program_recommendations
          : {};
      const nextAcceptedRecommendations = { ...currentAcceptedRecommendations };

      if (
        PROFILE_ACCEPTED_RECOMMENDATION_PENDING
        && PROFILE_ACCEPTED_RECOMMENDATION_PENDING.domain === "strength"
        && PROFILE_ACCEPTED_RECOMMENDATION_PENDING.program_id
        && PROFILE_ACCEPTED_RECOMMENDATION_PENDING.program_id === selectedStrength
      ){
        nextAcceptedRecommendations.strength = selectedStrength;
      } else {
        delete nextAcceptedRecommendations.strength;
      }

      if (
        PROFILE_ACCEPTED_RECOMMENDATION_PENDING
        && PROFILE_ACCEPTED_RECOMMENDATION_PENDING.domain === "run"
        && PROFILE_ACCEPTED_RECOMMENDATION_PENDING.program_id
        && PROFILE_ACCEPTED_RECOMMENDATION_PENDING.program_id === selectedRun
      ){
        nextAcceptedRecommendations.run = selectedRun;
      } else {
        delete nextAcceptedRecommendations.run;
      }

      if (Object.keys(nextAcceptedRecommendations).length){
        nextPreferences.accepted_program_recommendations = nextAcceptedRecommendations;
      } else {
        delete nextPreferences.accepted_program_recommendations;
      }

      const payload = {
        ...currentSettings,
        preferences: nextPreferences
      };

      const res = await apiPost("/api/user-settings", payload);
      STATE.userSettings = res?.item && typeof res.item === "object" ? res.item : payload;
      PROFILE_ACCEPTED_RECOMMENDATION_PENDING = null;

      const todayPlanRes = await apiGet("/api/today-plan");
      STATE.currentTodayPlan = todayPlanRes?.item || null;

      renderProfileEquipmentCard();
      renderTodayPlan(STATE.currentTodayPlan || null);
    });
  }

    const equipmentText = enabledEquipment.length
    ? tr("profile.available_equipment_value", { value: formatEquipmentList(enabledEquipment) })
    : tr("profile.no_equipment_yet");

  if (equipmentLineEl){
    equipmentLineEl.textContent = equipmentText;
  }
  if (profileSectionEquipmentLineEl){
    profileSectionEquipmentLineEl.textContent = equipmentText;
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

function mountEquipmentEditorInline(){
  return;
}


const LOCAL_PROTECTION_HOLD_REGIONS = ["ankle_calf", "knee", "hip", "low_back", "shoulder", "elbow", "wrist"];

function readLocalProtectionHoldsFromForm(){
  const out = {};
  LOCAL_PROTECTION_HOLD_REGIONS.forEach(region => {
    const value = String(document.getElementById(`local_hold_${region}`)?.value || "").trim();
    if (value === "caution" || value === "protect"){
      out[region] = value;
    }
  });
  return out;
}

function populateLocalProtectionHolds(settings){
  const holds = settings && settings.local_protection_holds && typeof settings.local_protection_holds === "object"
    ? settings.local_protection_holds
    : {};
  LOCAL_PROTECTION_HOLD_REGIONS.forEach(region => {
    const el = document.getElementById(`local_hold_${region}`);
    if (!el) return;
    const value = String(holds[region] || "").trim();
    el.value = value === "caution" || value === "protect" ? value : "";
  });
}

function getInitialSetupSettingsSnapshot(){
  const settings = STATE.userSettings && typeof STATE.userSettings === "object" ? STATE.userSettings : {};
  const profile = settings.profile && typeof settings.profile === "object" ? { ...settings.profile } : {};
  const preferences = settings.preferences && typeof settings.preferences === "object" ? { ...settings.preferences } : {};
  const availableEquipment = settings.available_equipment && typeof settings.available_equipment === "object"
    ? { ...settings.available_equipment }
    : {};
  const equipmentIncrements = settings.equipment_increments && typeof settings.equipment_increments === "object"
    ? { ...settings.equipment_increments }
    : {};

  const localProtectionHolds = settings.local_protection_holds && typeof settings.local_protection_holds === "object"
    ? { ...settings.local_protection_holds }
    : {};

  return {
    profile,
    preferences: {
      ...preferences,
      training_types: preferences.training_types && typeof preferences.training_types === "object"
        ? { ...preferences.training_types }
        : {},
      training_days: preferences.training_days && typeof preferences.training_days === "object"
        ? { ...preferences.training_days }
        : {}
    },
    available_equipment: availableEquipment,
    equipment_increments: equipmentIncrements,
    local_protection_holds: localProtectionHolds
  };
}

function getInitialSetupChecklistSourceSettings(){
  const snapshot = getInitialSetupSettingsSnapshot();
  const form = document.getElementById("equipmentSettingsForm");
  if (!form || !isFirstRunSetupFlowActive()){
    return snapshot;
  }

  const readChecked = (id) => Boolean(document.getElementById(id)?.checked);
  const readSelectBool = (id) => document.getElementById(id)?.value === "true";
  const readOptionalNumber = (id) => {
    const raw = String(document.getElementById(id)?.value ?? "").trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const readNumber = (id, fallback = 0) => {
    const raw = String(document.getElementById(id)?.value ?? "").trim();
    if (!raw) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  snapshot.profile.height_cm = readOptionalNumber("profile_height_cm");
  snapshot.profile.bodyweight_kg = readOptionalNumber("profile_bodyweight_kg");

  snapshot.preferences.training_types = {
    running: readChecked("pref_running"),
    strength_weights: readChecked("pref_strength_weights"),
    bodyweight: readChecked("pref_bodyweight"),
    mobility: readChecked("pref_mobility")
  };
  snapshot.preferences.training_days = {
    mon: readChecked("day_mon"),
    tue: readChecked("day_tue"),
    wed: readChecked("day_wed"),
    thu: readChecked("day_thu"),
    fri: readChecked("day_fri"),
    sat: readChecked("day_sat"),
    sun: readChecked("day_sun")
  };
  snapshot.preferences.menstruation_support_enabled = readChecked("pref_menstruation_support_enabled");
  snapshot.preferences.weekly_target_sessions = readNumber("weekly_target_sessions", 3);

  snapshot.available_equipment = {
    barbell: readSelectBool("eq_barbell_enabled"),
    dumbbell: readSelectBool("eq_dumbbell_enabled"),
    bodyweight: readSelectBool("eq_bodyweight_enabled"),
    bench: readSelectBool("eq_bench_enabled"),
    machine: readSelectBool("eq_machine_enabled"),
    cable: readSelectBool("eq_cable_enabled")
  };
  snapshot.equipment_increments = {
    ...snapshot.equipment_increments,
    barbell: readNumber("eq_barbell_increment", 10),
    dumbbell: readNumber("eq_dumbbell_increment", 5)
  };

  return snapshot;
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
  const menstruationSupportEnabled = preferences.menstruation_support_enabled === true;
  const trainingDays = preferences.training_days && typeof preferences.training_days === "object"
    ? preferences.training_days
    : {};
  const weeklyTargetSessions = Number(preferences.weekly_target_sessions || 3) || 3;
  const starterCapacityProfile = String(preferences.starter_capacity_profile || "general_beginner").trim() || "general_beginner";
  const strengthStartingProfile = String(preferences.strength_starting_profile || "beginner").trim() || "beginner";
  const runStartingProfile = String(preferences.run_starting_profile || "beginner").trim() || "beginner";
  const trainingGoal = String(preferences.training_goal || "general_health").trim() || "general_health";
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
  setChecked("pref_menstruation_support_enabled", menstruationSupportEnabled);

  setChecked("day_mon", trainingDays.mon !== false);
  setChecked("day_tue", trainingDays.tue !== false);
  setChecked("day_wed", trainingDays.wed !== false);
  setChecked("day_thu", trainingDays.thu !== false);
  setChecked("day_fri", trainingDays.fri !== false);
  setChecked("day_sat", trainingDays.sat !== false);
  setChecked("day_sun", trainingDays.sun !== false);
  setVal("weekly_target_sessions", weeklyTargetSessions);
  setVal("starter_capacity_profile", starterCapacityProfile);
  setVal("strength_starting_profile", strengthStartingProfile);
  setVal("run_starting_profile", runStartingProfile);
  setVal("training_goal", trainingGoal);

  setVal("eq_barbell_enabled", available.barbell === false ? "false" : "true");
  setVal("eq_dumbbell_enabled", available.dumbbell === false ? "false" : "true");
  setVal("eq_bodyweight_enabled", available.bodyweight === false ? "false" : "true");
  setVal("eq_bench_enabled", available.bench === false ? "false" : "true");
  setVal("eq_machine_enabled", available.machine === false ? "false" : "true");
  setVal("eq_cable_enabled", available.cable === false ? "false" : "true");

  setVal("eq_barbell_increment", increments.barbell ?? 10);
  setVal("eq_dumbbell_increment", increments.dumbbell ?? 5);
  populateLocalProtectionHolds(settings);
}

function renderFirstRunSetupEditorState(){
  const intro = document.getElementById("firstRunSetupIntro");
  const nav = document.getElementById("firstRunSetupNav");
  const backBtn = document.getElementById("firstRunSetupBackBtn");
  const nextBtn = document.getElementById("firstRunSetupNextBtn");
  const saveBtn = document.getElementById("saveEquipmentSettingsBtn");
  const cancelBtn = document.getElementById("cancelEquipmentSettingsBtn");
  const resetExercisesBtn = document.getElementById("resetExercisesCatalogFromSeedBtn");
  const resetCatalogBtn = document.getElementById("resetCatalogFromSeedBtn");
  const finishText = document.getElementById("firstRunSetupFinishText");
  const sections = Array.from(document.querySelectorAll(".first-run-setup-section[data-first-run-step]"));

  const firstRunActive = isFirstRunSetupFlowActive();
  const currentStep = getFirstRunSetupCurrentStep();
  const currentIndex = getFirstRunSetupStepIndex(currentStep);
  const isLastStep = currentStep === "finish";

  sections.forEach(section => {
    const step = String(section.getAttribute("data-first-run-step") || "").trim();
    const visible = !firstRunActive || step === currentStep;
    section.classList.toggle("wizard-step-hidden", !visible);
    section.style.display = visible ? "" : "none";
  });

  if (intro){
    if (firstRunActive){
      intro.classList.remove("wizard-step-hidden");
      intro.style.display = "";
      intro.textContent = tr("onboarding.first_run.step_progress", { current: Math.max(currentIndex + 1, 1), total: FIRST_RUN_SETUP_STEPS.length });
    } else {
      intro.classList.add("wizard-step-hidden");
      intro.style.display = "none";
      intro.textContent = "";
    }
  }

  if (nav){
    nav.classList.toggle("wizard-step-hidden", !firstRunActive);
    nav.style.display = firstRunActive ? "" : "none";
  }

  if (backBtn){
    backBtn.style.display = firstRunActive ? "" : "none";
    backBtn.disabled = !firstRunActive || currentIndex <= 0;
  }

  if (nextBtn){
    nextBtn.style.display = firstRunActive && !isLastStep ? "" : "none";
    nextBtn.disabled = !firstRunActive || isLastStep;
  }

  if (saveBtn){
    saveBtn.textContent = firstRunActive
      ? (isLastStep ? tr("onboarding.first_run.save_setup") : tr("onboarding.first_run.save_progress"))
      : tr("button.save_profile_equipment");
  }

  if (cancelBtn){
    cancelBtn.style.display = firstRunActive ? "none" : "";
  }

  [resetExercisesBtn, resetCatalogBtn].forEach(btn => {
    if (!btn) return;
    btn.style.display = firstRunActive ? "none" : "";
  });

  if (finishText){
    const checklistState = buildInitialSetupChecklist(STATE.userSettings || {});
    finishText.textContent = checklistState.readyForRecommendation
      ? tr("onboarding.first_run.finish_ready")
      : tr("onboarding.first_run.finish_missing", { count: checklistState.requiredTotal - checklistState.requiredDone });
  }
}

function bindFirstRunSetupNavigation(){
  const backBtn = document.getElementById("firstRunSetupBackBtn");
  const nextBtn = document.getElementById("firstRunSetupNextBtn");

  if (backBtn && !backBtn.dataset.bound){
    backBtn.dataset.bound = "1";
    backBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      setFirstRunSetupCurrentStep(getPreviousFirstRunSetupStep(getFirstRunSetupCurrentStep()));
      renderFirstRunSetupEditorState();
    });
  }

  if (nextBtn && !nextBtn.dataset.bound){
    nextBtn.dataset.bound = "1";
    nextBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      setFirstRunSetupCurrentStep(getNextFirstRunSetupStep(getFirstRunSetupCurrentStep()));
      renderFirstRunSetupEditorState();
    });
  }
}

function setEquipmentEditorOpen(isOpen){
  const section = document.getElementById("profileEquipmentEditorSection");
  if (section){
    section.classList.toggle("wizard-step-hidden", !isOpen);
    section.style.display = isOpen ? "" : "none";
  }

  if (isOpen){
    populateEquipmentEditor();
    bindFirstRunSetupNavigation();
    renderFirstRunSetupEditorState();
    const status = document.getElementById("equipmentSettingsStatus");
    if (status) status.textContent = tr("profile.edit_and_save_when_ready");
    requestAnimationFrame(() => {
      const firstField =
        document.querySelector('.first-run-setup-section[data-first-run-step]:not([style*="display: none"]) input, .first-run-setup-section[data-first-run-step]:not([style*="display: none"]) select')
        || document.getElementById("profile_height_cm");
      if (firstField && typeof firstField.focus === "function") firstField.focus();
      if (section && typeof section.scrollIntoView === "function"){
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  } else {
    renderFirstRunSetupEditorState();
  }
}

async function handleEquipmentSettingsSubmit(ev){
  ev.preventDefault();

  const statusEl = document.getElementById("equipmentSettingsStatus");
  const wasFirstRunActive = isFirstRunSetupFlowActive();

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
      menstruation_support_enabled: readChecked("pref_menstruation_support_enabled"),
      training_days: {
        mon: readChecked("day_mon"),
        tue: readChecked("day_tue"),
        wed: readChecked("day_wed"),
        thu: readChecked("day_thu"),
        fri: readChecked("day_fri"),
        sat: readChecked("day_sat"),
        sun: readChecked("day_sun"),
      },
      weekly_target_sessions: Number(document.getElementById("weekly_target_sessions")?.value || 3),
      starter_capacity_profile: String(document.getElementById("starter_capacity_profile")?.value || "general_beginner").trim() || "general_beginner",
      strength_starting_profile: String(document.getElementById("strength_starting_profile")?.value || "beginner").trim() || "beginner",
      run_starting_profile: String(document.getElementById("run_starting_profile")?.value || "beginner").trim() || "beginner",
      training_goal: String(document.getElementById("training_goal")?.value || "general_health").trim() || "general_health"
    },
    available_equipment: {
      barbell: readBool("eq_barbell_enabled"),
      dumbbell: readBool("eq_dumbbell_enabled"),
      bodyweight: readBool("eq_bodyweight_enabled"),
      bench: readBool("eq_bench_enabled"),
      machine: readBool("eq_machine_enabled"),
      cable: readBool("eq_cable_enabled"),
    },
    equipment_increments: {
      barbell: readNum("eq_barbell_increment", 10),
      dumbbell: readNum("eq_dumbbell_increment", 5),
      bodyweight: 0,
    },
    local_protection_holds: readLocalProtectionHoldsFromForm()
  };

  try{
    if (statusEl) statusEl.textContent = tr("status.saving_equipment");
    const res = await apiPost("/api/user-settings", payload);
    STATE.userSettings = res?.item && typeof res.item === "object" ? res.item : payload;
    await refreshAll();
    updateMenstruationCheckinVisibility();
    setEquipmentEditorOpen(false);

    const checklistState = buildInitialSetupChecklist(STATE.userSettings || {});
    const shouldSendToFirstCheckin = wasFirstRunActive && !!checklistState?.readyForRecommendation;

    if (shouldSendToFirstCheckin){
      showWizardStep("checkin");
      requestAnimationFrame(() => {
        const checkinCard = document.getElementById("checkinSection") || document.getElementById("checkinForm");
        if (checkinCard && typeof checkinCard.scrollIntoView === "function"){
          checkinCard.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }

    if (statusEl) statusEl.textContent = tr("status.equipment_saved");
  }catch(err){
    console.error("equipment save error", err);
    if (statusEl) statusEl.textContent = tr("status.error_prefix") + (err?.message || String(err));
  }
}

async function handleResetExercisesCatalogFromSeed(){
  const statusEl = document.getElementById("equipmentSettingsStatus");
  const btn = document.getElementById("resetExercisesCatalogFromSeedBtn");
  try{
    if (btn) btn.disabled = true;
    if (statusEl) statusEl.textContent = tr("status.resetting_exercises_catalog");
    await apiPost("/api/admin/reset-exercises-catalog", {});
    await refreshAll();
    if (statusEl) statusEl.textContent = tr("status.exercises_catalog_reset_done");
  }catch(err){
    if (statusEl) statusEl.textContent = tr("status.error_prefix") + (err?.message || String(err));
  }finally{
    if (btn) btn.disabled = false;
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
    if (statusEl) statusEl.textContent = tr("status.error_prefix") + (err?.message || String(err));
  }finally{
    if (btn) btn.disabled = false;
  }
}

function bindEquipmentEditor(){
  const form = document.getElementById("equipmentSettingsForm");
  const openBtn = document.getElementById("openEquipmentSettingsBtn");
  const saveBtn = document.getElementById("saveEquipmentSettingsBtn");
  const cancelBtn = document.getElementById("cancelEquipmentSettingsBtn");
  const resetExercisesBtn = document.getElementById("resetExercisesCatalogFromSeedBtn");
  const resetBtn = document.getElementById("resetCatalogFromSeedBtn");
  const statusEl = document.getElementById("equipmentSettingsStatus");

  if (form){
    form.onsubmit = handleEquipmentSettingsSubmit;
  }

  if (openBtn && !openBtn.dataset.bound){
    openBtn.dataset.bound = "1";
    openBtn.onclick = (ev) => {
      ev.preventDefault();
      showWizardStep("profile");
    };
  }

  if (saveBtn){
    saveBtn.onclick = (ev) => {
      ev.preventDefault();
      if (statusEl) statusEl.textContent = tr("status.ready_to_save_equipment");
      if (form?.requestSubmit){
        form.requestSubmit();
      } else if (form){
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }
    };
  }

  const openProfileBtn = document.getElementById("openEquipmentSettingsBtnProfile");
  if (openProfileBtn && !openProfileBtn.dataset.bound){
    openProfileBtn.dataset.bound = "1";
    openProfileBtn.onclick = (ev) => {
      ev.preventDefault();
      setEquipmentEditorOpen(true);
    };
  }

  const openAccountProfileBtn = document.getElementById("openAccountSettingsBtnProfile");
  if (openAccountProfileBtn && !openAccountProfileBtn.dataset.bound){
    openAccountProfileBtn.dataset.bound = "1";
    openAccountProfileBtn.onclick = (ev) => {
      ev.preventDefault();
      accountBtn2?.click();
    };
  }

  if (cancelBtn){
    cancelBtn.onclick = (ev) => {
      ev.preventDefault();
      setEquipmentEditorOpen(false);
    };
  }

  if (resetExercisesBtn && !resetExercisesBtn.dataset.bound){
    resetExercisesBtn.dataset.bound = "1";
    resetExercisesBtn.onclick = () => handleResetExercisesCatalogFromSeed();
  }

  if (resetBtn && !resetBtn.dataset.bound){
    resetBtn.dataset.bound = "1";
    resetBtn.onclick = () => handleResetCatalogFromSeed();
  }
}

function updateOverviewLayoutForStep(stepId){
  const overviewSection = document.getElementById("overviewSection");
  if (!overviewSection) return;

  const dailyUiState = deriveDailyUiState(STATE.currentTodayPlan || null, STATE.latestCheckin || null, STATE.sessionResults || []);
  const cards = Array.from(overviewSection.querySelectorAll(":scope > section.card"));

  cards.forEach(card => {
    let keepVisible =
      card.id === "forecastHero" ||
      card.id === "firstRunOnboardingCard" ||
      card.id === "overviewStatusCard" ||
      card.id === "profileEquipmentCard";

    if (stepId === "overview" && dailyUiState === "first_run_onboarding"){
      keepVisible =
        card.id === "firstRunOnboardingCard" ||
        card.id === "profileEquipmentCard" ||
        card.id === "forecastHero";

      if (card.id === "overviewStatusCard"){
        keepVisible = false;
      }
    } else if (stepId === "overview" && dailyUiState === "no_checkin_yet"){
      keepVisible =
        card.id === "forecastHero" ||
        card.id === "profileEquipmentCard";
    }

    card.classList.toggle(
      "overview-metric-hidden",
      stepId === "overview" && !keepVisible
    );
  });

  if (stepId === "overview" && dailyUiState === "first_run_onboarding"){
    const card = document.getElementById("firstRunOnboardingCard");
    if (card){
      card.classList.remove("overview-metric-hidden");
    }
  }
}


function renderReadiness(item){
  if (!item){
    setText("readinessScore", "-");
    setText("readinessLabel", tr("common.no_data_yet"));
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




function getProgramDisplayName(program){
  const item = program && typeof program === "object" ? program : {};
  const isEnglish = getCurrentLang() === "en";
  return String(
    (isEnglish ? item.name_en : item.name) ||
    item.name ||
    item.name_en ||
    tr("common.unknown_title")
  ).trim();
}

function getProgramKindDisplayLabel(value){
  const x = String(value || "").trim().toLowerCase();
  if (!x) return "";
  if (x === "styrke" || x === "strength") return tr("workout.type.strength");
  if (x === "løb" || x === "run" || x === "running") return tr("session_type.run");
  if (x === "mobilitet" || x === "mobility") return tr("session_type.mobility");
  if (x === "restitution" || x === "recovery") return tr("session_type.mobility");
  return x;
}

function getProgramDayDisplayLabel(day){
  const item = day && typeof day === "object" ? day : {};
  const isEnglish = getCurrentLang() === "en";
  const raw = String(
    (isEnglish ? item.label_en : item.label) ||
    item.label ||
    item.label_en ||
    tr("common.day")
  ).trim();
  if (isEnglish){
    const m = raw.match(/^Dag\s+([A-Z0-9]+)$/i);
    if (m) return `Day ${m[1].toUpperCase()}`;
  }
  return raw;
}

function getExerciseDisplayCopy(item){
  const entry = item && typeof item === "object" ? item : {};
  const isEnglish = getCurrentLang() === "en";

  const name = String(
    (isEnglish ? entry.name_en : entry.name) ||
    entry.name ||
    entry.name_en ||
    ""
  ).trim();

  const notes = String(
    (isEnglish ? entry.notes_en : entry.notes) ||
    entry.notes ||
    entry.notes_en ||
    ""
  ).trim();

  return { name, notes };
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

function formatUnknownExerciseName(exerciseId){
  const id = String(exerciseId || "").trim();
  return id ? `${tr("common.unknown_lower")}: ${id}` : tr("common.unknown_lower");
}

function formatExerciseName(exerciseId){
  const id = String(exerciseId || "").trim();
  const mapped = {
    restitution_walk: tr("exercise.recovery_walk"),
    mobility: tr("session_type.mobility"),
    cardio_easy: tr("exercise.cardio_easy"),
    cardio_intervals: tr("exercise.cardio_intervals"),
    cardio_session: tr("session_type.cardio"),
    cardio_base: tr("exercise.cardio_base")
  };
  if (mapped[id]) return mapped[id];

  const exerciseMap = new Map((STATE.exercises || []).map(x => [String(x.id || "").trim(), x.name]));
  return exerciseMap.get(id) || formatUnknownExerciseName(id);
}

function formatInputKindLabel(value){
  const x = String(value || "").trim().toLowerCase();
  if (x === "bodyweight_reps") return tr("input_kind.bodyweight_reps");
  if (x === "time" || x === "cardio_time") return tr("input_kind.time");
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
    return tr("progress_flag.exercise_failure", { exercise: formatExerciseName(exerciseId) });
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
  const raw = String(value || "").trim();
  if (!raw) return "";

  const map = {
    "Manuel plan overstyrer dagens autoplan.": tr("plan.reason.manual_override_today"),
    "Manual plan overrides today's autoplan.": tr("plan.reason.manual_override_today"),
    "Rolig løbetur valgt ud fra din status, restitution og den seneste cardio-belastning.": tr("plan.reason.cardio_autoplan_selected_today"),
    "An easy run was selected based on your status, recovery, and recent cardio load.": tr("plan.reason.cardio_autoplan_selected_today"),
    "dagen er ikke valgt som mulig træningsdag": tr("plan.reason.day_not_selected_as_training_day"),
    "day is not selected as a possible training day": tr("plan.reason.day_not_selected_as_training_day"),
    "ikke planlagt styrkedag": tr("plan.reason.not_planned_strength_day"),
    "not a planned strength day": tr("plan.reason.not_planned_strength_day"),
    "cardio-autoplan aktiv": tr("plan.reason.cardio_autoplan_active"),
    "cardio autoplan active": tr("plan.reason.cardio_autoplan_active")
  };

  if (map[raw]) return map[raw];

  const parts = raw.split("·").map(x => String(x || "").trim()).filter(Boolean);
  if (parts.length > 1){
    return parts.map(part => map[part] || part).join(" · ");
  }

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

function formatSavedSummaryMessage(value){
  const x = String(value || "").trim().toLowerCase();
  if (!x) return "";
  const map = {
    "today's session has been saved.": tr("review.saved_summary.session_saved"),
    "dagens session er gemt.": tr("review.saved_summary.session_saved"),
    "today's recovery has been logged.": tr("review.saved_summary.recovery_logged"),
    "dagens restitution er registreret.": tr("review.saved_summary.recovery_logged"),
    "today's cardio session has been saved.": tr("review.saved_summary.cardio_saved"),
    "dagens cardiopas er gemt.": tr("review.saved_summary.cardio_saved"),
    "great work today.": tr("review.saved_summary.great_work"),
    "godt arbejde i dag.": tr("review.saved_summary.great_work")
  };
  return map[x] || value;
}

function formatSavedSummaryNextStep(value){
  const x = String(value || "").trim().toLowerCase();
  if (!x) return "";
  const map = {
    "you can probably progress next time.": tr("review.saved_summary.progress_next_time"),
    "du kan sandsynligvis progrediere næste gang.": tr("review.saved_summary.progress_next_time"),
    "hold this level next time.": tr("review.saved_summary.hold_next_time"),
    "hold dette niveau næste gang.": tr("review.saved_summary.hold_next_time"),
    "keep progression conservative next session.": tr("review.saved_summary.keep_progression_conservative"),
    "hold progressionen konservativ næste session.": tr("review.saved_summary.keep_progression_conservative"),
    "keep the next recovery session easy and unforced.": tr("review.saved_summary.cardio_recovery_keep_easy"),
    "take the next run easier so recovery work stays restorative.": tr("review.saved_summary.cardio_recovery_take_easier"),
    "repeat a similar controlled effort next time.": tr("review.saved_summary.cardio_base_repeat_controlled"),
    "keep the next base run slightly easier so it stays aerobic.": tr("review.saved_summary.cardio_base_easier"),
    "take the next base session easier and keep the pace under control.": tr("review.saved_summary.cardio_base_take_easier"),
    "the next tempo session can be a little more committed if recovery is good.": tr("review.saved_summary.cardio_tempo_more_committed"),
    "recover well, then keep the next tempo session controlled but purposeful.": tr("review.saved_summary.cardio_tempo_controlled"),
    "take the next quality run slightly easier so tempo work stays repeatable.": tr("review.saved_summary.cardio_tempo_easier"),
    "recover before the next hard run and keep easy days easy.": tr("review.saved_summary.cardio_intervals_recover"),
    "make the next interval session more clearly structured or slightly harder if appropriate.": tr("review.saved_summary.cardio_intervals_clearer"),
    "log duration, distance, and effort next time for a more useful running review.": tr("review.saved_summary.cardio_log_more_data"),
    "log the cardio type and effort more clearly next time.": tr("review.saved_summary.cardio_log_intent"),
    "recovery run matched the intended easy effort.": tr("review.saved_summary.cardio_recovery_matched"),
    "recovery run was harder than intended.": tr("review.saved_summary.cardio_recovery_too_hard"),
    "base run broadly matched the intended steady effort.": tr("review.saved_summary.cardio_base_matched"),
    "base run drifted a bit harder than intended.": tr("review.saved_summary.cardio_base_slightly_hard"),
    "base run was too hard for its intended purpose.": tr("review.saved_summary.cardio_base_too_hard"),
    "tempo run broadly matched the intended sustained hard effort.": tr("review.saved_summary.cardio_tempo_matched"),
    "tempo run looked easier than intended.": tr("review.saved_summary.cardio_tempo_too_easy"),
    "tempo run was harder than intended.": tr("review.saved_summary.cardio_tempo_too_hard"),
    "interval session broadly matched the intended hard structured effort.": tr("review.saved_summary.cardio_intervals_matched"),
    "interval session looked easier than intended.": tr("review.saved_summary.cardio_intervals_too_easy")
  };
  return map[x] || value;
}

function formatSavedSummaryExplanationBit(value){
  const normalizedRecovery = formatRecoveryExplanationBit(value);
  if (normalizedRecovery !== value) return normalizedRecovery;

  const raw = String(value || "").trim();
  const x = raw.toLowerCase();
  if (!x) return "";

  const map = {
    "light overall load recorded.": tr("review.saved_summary.light_load_recorded"),
    "lav samlet belastning registreret.": tr("review.saved_summary.light_load_recorded"),
    "moderate overall load recorded.": tr("review.saved_summary.moderate_load_recorded"),
    "moderat samlet belastning registreret.": tr("review.saved_summary.moderate_load_recorded"),
    "high overall load recorded.": tr("review.saved_summary.high_load_recorded"),
    "høj samlet belastning registreret.": tr("review.saved_summary.high_load_recorded"),
    "stable overall load recorded.": tr("review.saved_summary.stable_load_recorded"),
    "stabil samlet belastning registreret.": tr("review.saved_summary.stable_load_recorded"),
    "you can probably progress next time.": tr("review.saved_summary.progress_next_time"),
    "du kan sandsynligvis progrediere næste gang.": tr("review.saved_summary.progress_next_time"),
    "keep progression conservative next session.": tr("review.saved_summary.keep_progression_conservative"),
    "hold progressionen konservativ næste session.": tr("review.saved_summary.keep_progression_conservative"),
    "failure markers: 1": tr("review.saved_summary.failure_markers_count", { count: 1 }),
    "plank failure": tr("review.saved_summary.plank_failure"),
    "recovery run matched the intended easy effort.": tr("review.saved_summary.cardio_recovery_matched"),
    "recovery run was harder than intended.": tr("review.saved_summary.cardio_recovery_too_hard"),
    "base run broadly matched the intended steady effort.": tr("review.saved_summary.cardio_base_matched"),
    "base run drifted a bit harder than intended.": tr("review.saved_summary.cardio_base_slightly_hard"),
    "base run was too hard for its intended purpose.": tr("review.saved_summary.cardio_base_too_hard"),
    "tempo run broadly matched the intended sustained hard effort.": tr("review.saved_summary.cardio_tempo_matched"),
    "tempo run looked easier than intended.": tr("review.saved_summary.cardio_tempo_too_easy"),
    "tempo run was harder than intended.": tr("review.saved_summary.cardio_tempo_too_hard"),
    "interval session broadly matched the intended hard structured effort.": tr("review.saved_summary.cardio_intervals_matched"),
    "interval session looked easier than intended.": tr("review.saved_summary.cardio_intervals_too_easy"),
    "cardio session saved, but there was not enough data to assess the run.": tr("review.saved_summary.cardio_not_enough_data"),
    "not enough cardio data was available for a running-specific review.": tr("review.saved_summary.cardio_not_enough_data_detail"),
    "effort stayed low enough for recovery work.": tr("review.saved_summary.cardio_recovery_detail_easy"),
    "rpe 3 fits a controlled base run.": tr("review.saved_summary.cardio_base_detail_rpe_fit", { value: "3" }),
    "rpe 4 fits a controlled base run.": tr("review.saved_summary.cardio_base_detail_rpe_fit", { value: "4" }),
    "rpe 5 fits a controlled base run.": tr("review.saved_summary.cardio_base_detail_rpe_fit", { value: "5" }),
    "rpe 6 fits a controlled base run.": tr("review.saved_summary.cardio_base_detail_rpe_fit", { value: "6" }),
    "the effort looks a little high for base work.": tr("review.saved_summary.cardio_base_detail_high"),
    "the effort looks closer to base than tempo work.": tr("review.saved_summary.cardio_tempo_detail_easy"),
    "the effort does not clearly stand out from an easier steady run.": tr("review.saved_summary.cardio_intervals_detail_easy")
  };

  if (map[x]) return map[x];
  if (x.startsWith("distance logged: ")) return tr("review.saved_summary.cardio_distance_logged_prefix", { value: raw.slice(17) });
  if (x.startsWith("duration logged: ")) return tr("review.saved_summary.cardio_duration_logged_prefix", { value: raw.slice(17) });
  if (x.startsWith("average pace: ")) return tr("review.saved_summary.cardio_average_pace_prefix", { value: raw.slice(14) });
  if (x.startsWith("rpe ") && x.endsWith(" was recorded.")) return tr("review.saved_summary.cardio_rpe_recorded", { value: raw.slice(4, -14) });

  return value;
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
  if (x === "consistency_fallback") return tr("session_type.recovery");
  if (x === "local_protection_override") return tr("plan.motor.autoplan");
  if (x === "menstruation_support_override") return tr("plan.motor.autoplan");
  if (x === "reentry_strength") return tr("workout.type.strength");
  if (x === "calendar_rest") return "";
  if (x === "completed_today") return "";
  return "";
}


function formatTarget(value){
  const v = String(value || "").trim();
  if (!v) return "";

  const mappedTargets = {
    "30 min roligt løb i snakketempo": tr("cardio.target.base_30_talk"),
    "30 min easy run at conversational pace": tr("cardio.target.base_30_talk"),
    "20 min rolig gang eller meget let jog": tr("cardio.target.easy_walk_or_jog_20"),
    "20 min easy walk or very light jog": tr("cardio.target.easy_walk_or_jog_20")
  };
  if (mappedTargets[v]) return mappedTargets[v];

  const easyRunMatch = v.match(/^(\d+)\s*min\s*roligt løb i snakketempo$/i);
  if (easyRunMatch){
    return tr("cardio.target.base_talk_variable", { minutes: easyRunMatch[1] });
  }

  const easyWalkMatch = v.match(/^(\d+)\s*min\s*rolig gang eller meget let jog$/i);
  if (easyWalkMatch){
    return tr("cardio.target.easy_walk_or_jog_variable", { minutes: easyWalkMatch[1] });
  }

  if (v.endsWith("sek") || v.endsWith("sec")){
    const num = v.replace(/\s*(sek|sec)\s*$/, "").trim();
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
  const raw = Array.isArray(options) ? options : [];
  const selected = String(selectedValue ?? "").trim();
  const arr = selected && !raw.some(x => String(x ?? "").trim() === selected)
    ? [selected, ...raw]
    : raw;
  const first = placeholder ? `<option value="">${esc(placeholder)}</option>` : `<option value=""></option>`;
  return `
      <select name="${esc(name)}">
        ${first}
        ${arr.map(x => {
          const value = String(x ?? "").trim();
          const isSelected = selected === value ? ' selected' : '';
          return `<option value="${esc(value)}"${isSelected}>${esc(value)}</option>`;
        }).join("")}
      </select>
    `;
}

function getReviewExerciseMeta(exerciseId){
  return getExerciseMeta(exerciseId) || {};
}

function buildWorkoutRepChoiceButtons(name, choices, selectedValue){
  const arr = Array.isArray(choices) ? choices : [];
  const selected = String(selectedValue ?? "").trim();

  return `
    <input type="hidden" name="${esc(name)}" value="${esc(selected)}">
    <div class="btn-row" data-workout-rep-buttons="${esc(name)}" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px">
      ${arr.map(choice => {
        const value = String(choice ?? "").trim();
        const isActive = selected === value;
        return `<button type="button" class="${isActive ? "" : "secondary"}" data-workout-rep-value="${esc(value)}" style="width:auto; min-width:48px; padding:10px 12px; ${isActive ? "box-shadow:0 0 0 2px rgba(255,255,255,0.12) inset;" : ""}">${esc(value)}</button>`;
      }).join("")}
    </div>
  `;
}

function wireWorkoutRepChoiceButtons(scope){
  const root = scope || document;
  root.querySelectorAll("[data-workout-rep-buttons]").forEach(group => {
    const inputName = String(group.getAttribute("data-workout-rep-buttons") || "").trim();
    if (!inputName) return;

    const hidden = root.querySelector(`input[type="hidden"][name="${inputName}"]`);
    if (!hidden) return;

    group.querySelectorAll("[data-workout-rep-value]").forEach(btn => {
      btn.addEventListener("click", () => {
        const nextValue = String(btn.getAttribute("data-workout-rep-value") || "").trim();
        hidden.value = nextValue;

        group.querySelectorAll("[data-workout-rep-value]").forEach(other => {
          const isActive = other === btn;
          other.classList.toggle("secondary", !isActive);
          if (isActive){
            other.style.boxShadow = "0 0 0 2px rgba(255,255,255,0.12) inset";
          } else {
            other.style.boxShadow = "";
          }
        });
      });
    });
  });
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
  const options = Array.isArray(meta?.time_options) && meta.time_options.length
    ? meta.time_options
    : ["20 sec", "30 sec", "40 sec", "45 sec", "60 sec"];
  return options.map(x => formatTarget(String(x || "").trim()));
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
  const existingResult = entry?._existing_result && typeof entry._existing_result === "object" ? entry._existing_result : {};
  const existingSets = Array.isArray(existingResult.sets) ? existingResult.sets : [];
  const existingSet = existingSets[setIdx] && typeof existingSets[setIdx] === "object" ? existingSets[setIdx] : {};
  const existingReps = String(existingSet.reps || (setIdx === 0 ? existingResult.achieved_reps || "" : "")).trim();
  const existingLoad = String(existingSet.load || "").trim();
  const timedTargetSec = Number(String(entry?.target_reps || "").match(/\d+/)?.[0] || 0);
  const timedActualSec = Number(String(existingReps || "").match(/\d+/)?.[0] || 0);
  const derivedTimedFailure = (inputKind === "time" || inputKind === "cardio_time")
    && timedTargetSec > 0
    && timedActualSec > 0
    && timedActualSec < timedTargetSec;
  const existingSetFailure = Boolean(existingSet.hit_failure || derivedTimedFailure);

  const failureField = `
    <label style="margin-top:10px; margin-bottom:0">
      ${esc(tr("after_training.fail_label"))}
      <select name="review_set_hit_failure_${idx}_${setIdx}">
        <option value="false" ${existingSetFailure ? "" : "selected"}>${esc(tr("common.no"))}</option>
        <option value="true" ${existingSetFailure ? "selected" : ""}>${esc(tr("common.yes"))}</option>
      </select>
    </label>
  `;

  if (inputKind === "time" || inputKind === "cardio_time"){
    return `
      <div class="card" style="margin-top:10px; padding:12px">
        <div class="small" style="margin-bottom:8px">${tr("exercise.set_label", { number: setIdx + 1 })}</div>

        <label>
          ${tr("input_kind.time")}
          ${buildReviewValueSelect(`review_set_reps_${idx}_${setIdx}`, getReviewTimeOptions(meta), existingReps, tr("after_training.select_time"))}
        </label>
        <div class="small" style="margin-top:6px">${tr("exercise.load_bodyweight")}</div>
        ${failureField}
      </div>
    `;
  }

  if (inputKind === "bodyweight_reps"){
    return `
      <div class="card" style="margin-top:10px; padding:12px">
        <div class="small" style="margin-bottom:8px">${tr("exercise.set_label", { number: setIdx + 1 })}</div>

        <label>
          Reps
          ${buildReviewValueSelect(`review_set_reps_${idx}_${setIdx}`, getReviewRepOptions(meta), existingReps, tr("after_training.select_reps"))}
        </label>
        <div class="small" style="margin-top:6px">${tr("exercise.load_bodyweight")}</div>
        ${failureField}
      </div>
    `;
  }

  return `
    <div class="card" style="margin-top:10px; padding:12px">
      <div class="small" style="margin-bottom:8px">${tr("exercise.set_label", { number: setIdx + 1 })}</div>

      <label>
        Reps
        ${buildReviewValueSelect(`review_set_reps_${idx}_${setIdx}`, getReviewRepOptions(meta), existingReps, tr("after_training.select_reps"))}
      </label>

      <label>
        ${esc(tr("load.title"))}
        ${buildReviewValueSelect(`review_set_load_${idx}_${setIdx}`, getReviewLoadOptions(meta), existingLoad || currentLoad, meta?.load_optional ? tr("workout.load_optional_placeholder") : tr("workout.load_placeholder"))}
      </label>

      ${meta?.load_optional && meta?.supports_bodyweight ? `<div class="small" style="margin-top:6px">${esc(tr("review.bodyweight_empty_means"))}</div>` : ""}
      ${failureField}
    </div>
  `;
}

function buildWorkoutSetFields(entry, idx, setIdx){
  const meta = getReviewExerciseMeta(entry?.exercise_id);
  const inputKind = String(meta?.input_kind || "");
  const workoutRepChoices = getWorkoutRepChoicesForEntry(entry);
  const currentLoad = String(entry?.target_load || "").trim();
  const existingResult = entry?._existing_result && typeof entry._existing_result === "object" ? entry._existing_result : {};
  const existingSets = Array.isArray(existingResult.sets) ? existingResult.sets : [];
  const existingSet = existingSets[setIdx] && typeof existingSets[setIdx] === "object" ? existingSets[setIdx] : {};
  const existingReps = String(existingSet.reps || (setIdx === 0 ? existingResult.achieved_reps || "" : "")).trim();
  const existingLoad = String(existingSet.load || "").trim();

  if (inputKind === "time"){
    const prepRemainingSec = getTimedHoldPrepRemainingSeconds(entry);
    const remainingSec = getTimedHoldRemainingSeconds(entry);
    const targetSec = Number(entry?._active_hold_timer_target_sec || getTimedHoldTargetSeconds(entry) || 0);
    const existingSeconds = getTimedHoldExistingSeconds(entry);
    const isPrepTimer = prepRemainingSec > 0;
    const isActiveTimer = remainingSec > 0;
    const displaySeconds = isPrepTimer ? prepRemainingSec : (isActiveTimer ? remainingSec : (existingSeconds || targetSec || 0));
    const statusLabel = isPrepTimer
      ? tr("workout.hold_get_ready")
      : (isActiveTimer ? tr("button.start_set") : tr("input_kind.time"));
    const prepLeadHtml = isPrepTimer
      ? `<div class="small" style="margin-bottom:6px; opacity:0.82; text-transform:uppercase; letter-spacing:0.08em">${esc(tr("workout.hold_get_ready"))}</div>`
      : "";
    const activeLeadHtml = isActiveTimer
      ? `<div class="small" style="margin-bottom:6px; opacity:0.86; text-transform:uppercase; letter-spacing:0.08em">${esc(tr("button.start_set"))}</div>`
      : "";
    const timerTone = isPrepTimer ? "color:#f3c96b;" : (isActiveTimer ? "color:#8ff0a4;" : "color:#bcd3ff;");
    const cardTone = isActiveTimer
      ? "background:rgba(74,222,128,0.08); border:1px solid rgba(74,222,128,0.22);"
      : "background:rgba(255,255,255,0.03);";

    const timedModeHeader = `${tr("workout.timed_mode_label")} · ${tr("exercise.set_label", { number: setIdx + 1 })}`;

    return `
      <div class="card" style="margin-top:8px; padding:10px 12px; border-radius:18px; ${cardTone}">
        <div class="small" style="margin-bottom:8px; opacity:0.82; text-transform:uppercase; letter-spacing:0.08em">${esc(timedModeHeader)}</div>
        ${prepLeadHtml}
        ${activeLeadHtml}
        <div class="small" style="margin-bottom:8px; opacity:0.78">${esc(statusLabel)}</div>
        <div class="small" style="margin-bottom:6px; opacity:0.72">${esc(tr("workout.timed_target_label", { seconds: String(targetSec || displaySeconds || 0) }))}</div>
        <input type="hidden" name="review_set_reps_${idx}_${setIdx}" value="${esc(String(existingSeconds || targetSec || ""))}">
        <div style="font-size:2.2rem; font-weight:800; line-height:1; margin:8px 0 12px 0; ${timerTone}">${esc(String(displaySeconds))}<span style="font-size:1rem; font-weight:700; opacity:0.78"> s</span></div>
        <div class="small" style="margin-top:6px; opacity:0.72">${tr("exercise.load_bodyweight")}</div>
        <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap">
          ${(!isPrepTimer && !isActiveTimer) ? `<button type="button" class="secondary" data-start-hold-timer="${esc(String(idx))}" style="width:100%; padding:12px 14px; font-weight:700">${esc(tr("button.start_set"))}</button>` : ""}
          ${isPrepTimer ? `<button type="button" class="secondary" disabled style="width:100%; padding:12px 14px; font-weight:700; opacity:0.9">${esc(tr("workout.hold_get_ready"))}</button>` : ""}
          ${isActiveTimer ? `<button type="button" data-stop-hold-timer="${esc(String(idx))}" style="width:100%; padding:12px 14px; font-weight:700">${esc(tr("button.finish_set"))}</button>` : ""}
        </div>
      </div>
    `;
  }

  if (inputKind === "cardio_time"){
    return `
      <div class="card" style="margin-top:8px; padding:10px 12px; border-radius:18px; background:rgba(255,255,255,0.03)">
        <div class="small" style="margin-bottom:8px; opacity:0.82">${tr("exercise.set_label", { number: setIdx + 1 })}</div>
        <label style="margin-bottom:0">
          ${tr("input_kind.time")}
          ${Array.isArray(meta?.workout_rep_choices) && meta.workout_rep_choices.length
            ? buildWorkoutRepChoiceButtons(`review_set_reps_${idx}_${setIdx}`, meta.workout_rep_choices, existingReps)
            : buildReviewValueSelect(`review_set_reps_${idx}_${setIdx}`, getReviewTimeOptions(meta), existingReps, tr("after_training.select_time"))}
        </label>
        <div class="small" style="margin-top:6px; opacity:0.72">${tr("exercise.load_bodyweight")}</div>
      </div>
    `;
  }

  if (inputKind === "bodyweight_reps"){
    return `
      <div class="card" style="margin-top:8px; padding:10px 12px; border-radius:18px; background:rgba(255,255,255,0.03)">
        <div class="small" style="margin-bottom:8px; opacity:0.82">${tr("exercise.set_label", { number: setIdx + 1 })}</div>
        <label style="margin-bottom:0">
          Reps
          ${workoutRepChoices.length
            ? buildWorkoutRepChoiceButtons(`review_set_reps_${idx}_${setIdx}`, workoutRepChoices, existingReps)
            : buildReviewValueSelect(`review_set_reps_${idx}_${setIdx}`, getReviewRepOptions(meta), existingReps, tr("after_training.select_reps"))}
        </label>
        <div class="small" style="margin-top:6px; opacity:0.72">${tr("exercise.load_bodyweight")}</div>
      </div>
    `;
  }

  return `
    <div class="card" style="margin-top:8px; padding:10px 12px; border-radius:18px; background:rgba(255,255,255,0.03)">
      <div class="small" style="margin-bottom:8px; opacity:0.82">${tr("exercise.set_label", { number: setIdx + 1 })}</div>
      <label style="margin-bottom:10px">
        Reps
        ${workoutRepChoices.length
          ? buildWorkoutRepChoiceButtons(`review_set_reps_${idx}_${setIdx}`, workoutRepChoices, existingReps)
          : buildReviewValueSelect(`review_set_reps_${idx}_${setIdx}`, getReviewRepOptions(meta), existingReps, tr("after_training.select_reps"))}
      </label>
      <label style="margin-bottom:0">
        ${esc(tr("load.title"))}
        ${buildReviewValueSelect(`review_set_load_${idx}_${setIdx}`, getReviewLoadOptions(meta), existingLoad || currentLoad, meta?.load_optional ? tr("workout.load_optional_placeholder") : tr("workout.load_placeholder"))}
      </label>
      ${meta?.load_optional && meta?.supports_bodyweight ? `<div class="small" style="margin-top:6px; opacity:0.72">${esc(tr("review.bodyweight_empty_means"))}</div>` : ""}
    </div>
  `;
}

const RPE_HELP = {
  "1": "review.rpe.1",
  "2": "review.rpe.2",
  "3": "review.rpe.3",
  "4": "review.rpe.4",
  "5": "review.rpe.5",
  "6": "review.rpe.6",
  "7": "review.rpe.7",
  "8": "review.rpe.8",
  "9": "review.rpe.9",
  "10": "review.rpe.10"
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
      ? tr("review.rpe_selected", { value: normalized, text: tr(RPE_HELP[normalized] || "") })
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
    previewEl.textContent = tr("cardio.preview.calculated_pace", { value: formatPaceFromSeconds(pace) });
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

  const sessionEntries = getSessionEntries(item);
  const firstEntry = sessionEntries.length ? sessionEntries[0] : null;
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

function markUnsavedWorkoutReviewHandoff(item){
  if (item && typeof item === "object"){
    item._unsaved_workout_review_handoff = true;
  }
}

function hasUnsavedWorkoutReviewHandoff(item){
  return Boolean(item && typeof item === "object" && item._unsaved_workout_review_handoff === true);
}

function clearUnsavedWorkoutReviewHandoff(item){
  if (item && typeof item === "object"){
    delete item._unsaved_workout_review_handoff;
  }
}

function renderSessionReview(item){
  if (STATE.restDayReviewLocked !== true) {
    STATE.restDayReviewLocked = false;
  }
  const root = document.getElementById("sessionReviewList");
  const form = document.getElementById("sessionResultForm");
  const hasUnsavedReviewHandoff = hasUnsavedWorkoutReviewHandoff(item);
  const completedTodayItem = !STATE.editingSessionResultId && !hasUnsavedReviewHandoff ? getCompletedSessionToday(STATE.sessionResults || []) : null;
  const todayCheckin = !STATE.editingSessionResultId && !hasUnsavedReviewHandoff ? getTodayCheckin(STATE.checkins || [], STATE.latestCheckin || null, STATE.currentTodayPlan || null) : null;
  const acknowledgedRestDayItem = !STATE.editingSessionResultId && !hasUnsavedReviewHandoff ? getAcknowledgedRestDayCheckin(todayCheckin, STATE.currentTodayPlan || null) : null;
  const isClosedDay = Boolean(completedTodayItem || acknowledgedRestDayItem);

  if (form){
    if (isClosedDay){
      form.classList.add("wizard-step-hidden");
      form.querySelectorAll("input, select, textarea").forEach(el => {
        el.disabled = true;
      });
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn){
        submitBtn.disabled = true;
        submitBtn.style.display = "none";
        submitBtn.textContent = tr("review.session_saved_button");
      }
      const deleteBtn = document.getElementById("deleteSessionResultBtn");
      if (deleteBtn){
        deleteBtn.classList.add("wizard-step-hidden");
      }
    } else {
      form.classList.remove("wizard-step-hidden");
      form.querySelectorAll("input, select, textarea").forEach(el => {
        el.disabled = false;
      });
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn){
        submitBtn.disabled = false;
        submitBtn.style.display = "";
        submitBtn.textContent = STATE.editingSessionResultId ? "Gem ændringer" : tr("after_training.save_session_result");
      }
      const deleteBtn = document.getElementById("deleteSessionResultBtn");
      if (deleteBtn){
        deleteBtn.classList.toggle("wizard-step-hidden", !STATE.editingSessionResultId);
      }
    }
  }
  if (!root) return;

  if (completedTodayItem){
    const storedSummary = completedTodayItem.summary && typeof completedTodayItem.summary === "object"
      ? completedTodayItem.summary
      : buildSessionResultSummaryFromStoredItem(completedTodayItem);
    root.innerHTML = `<li><div class="small">${esc("Dagens session er allerede gemt. Brug historik, hvis du vil redigere den.")}</div></li>`;
    toggleCardioReviewFields(null);
    setText("sessionResultStatus", "");
    renderSessionResultSummary(storedSummary);
    return;
  }

  if (acknowledgedRestDayItem){
    root.innerHTML = `<li><div class="small">${esc(tr("today_plan.rest_day_acknowledged_saved"))}</div></li>`;
    toggleCardioReviewFields(null);
    setText("sessionResultStatus", "");
    renderRestDayAcknowledgedSummary(acknowledgedRestDayItem, STATE.currentTodayPlan || null);
    return;
  }

  const sessionEntries = getSessionEntries(item);
  if (!item || sessionEntries.length === 0){
    root.innerHTML = `<li><div class="small">${esc(tr("after_training.no_exercises_to_review"))}</div></li>`;
    toggleCardioReviewFields(null);
    return;
  }

  toggleCardioReviewFields(item);

  root.innerHTML = sessionEntries.map((entry, idx) => {
    const setCount = Math.max(1, Number(entry.sets || 1));
    const meta = getReviewExerciseMeta(entry.exercise_id);
    const inputKind = String(meta?.input_kind || "");
    const isTime = inputKind === "time" || inputKind === "cardio_time";
    const isBodyweight = inputKind === "bodyweight_reps";
    const isCardioEntry = String(item?.session_type || "").trim().toLowerCase() === "løb"
      || String(entry?.exercise_id || "").trim().toLowerCase().startsWith("cardio_");

    if (isCardioEntry){
      return `
        <li class="card" style="padding:14px; margin-top:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08)">
          <div style="font-weight:700; margin-bottom:8px">${esc(formatExerciseName(entry.exercise_id))}</div>
          <div class="small" style="margin-bottom:8px; line-height:1.5">
            ${tr("exercise.target_colon")} ${entry.target_reps ? esc(formatTarget(entry.target_reps)) : tr("session_type.cardio")}
          </div>
          <div class="small" style="margin-bottom:12px; opacity:0.82">
            ${tr("common.type_label")}: ${tr("session_type.run")}
          </div>
          <label>
            ${esc(tr("after_training.session_note_label"))}
            <input type="text" name="review_notes_${idx}" value="${esc(String(entry?._existing_result?.notes || ""))}" placeholder="${esc(tr("after_training.short_note_placeholder_cardio"))}">
          </label>
        </li>
      `;
    }

      const setFields = Array.from({length: setCount}, (_, setIdx) =>
        buildReviewSetFields(entry, idx, setIdx)
      ).join("");

      const existingResult = entry?._existing_result && typeof entry._existing_result === "object" ? entry._existing_result : {};
      const existingSets = Array.isArray(existingResult.sets) ? existingResult.sets : [];
      const actualReps = existingSets.map(x => String(x?.reps || "").trim()).filter(Boolean);
      const actualLoads = existingSets.map(x => String(x?.load || "").trim()).filter(Boolean);
      const actualBits = [];
      if (entry.sets) actualBits.push(tr("exercise.sets_count", { count: esc(entry.sets) }));
      if (actualReps.length) actualBits.push(actualReps.join(" / "));
      else if (entry.target_reps) actualBits.push(esc(formatTarget(entry.target_reps)));
      if (actualLoads.length) actualBits.push(actualLoads.join(" / "));
      else if (entry.target_load) actualBits.push(esc(entry.target_load));

      return `
        <li class="card" style="padding:14px; margin-top:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08)">
          <div style="font-weight:700; margin-bottom:8px">${esc(formatExerciseName(entry.exercise_id))}</div>
          <div class="small" style="margin-bottom:8px; line-height:1.5">
            ${tr("exercise.target_colon")} ${actualBits.join(" · ")}
          </div>
          <div class="small" style="margin-bottom:10px; opacity:0.82">
            ${tr("common.type_label")}: ${esc(formatInputKindLabel(inputKind))}
          </div>
          ${isTime || isBodyweight ? `<div class="small" style="margin-bottom:10px; opacity:0.8">${tr("exercise.load_bodyweight")}</div>` : ""}
          ${meta?.rep_display_hint ? `<div class="small" style="margin-bottom:10px; opacity:0.8">${esc(meta.rep_display_hint)}</div>` : ""}
          <div style="margin-top:12px">
            ${setFields}
          </div>
          <div style="margin-top:10px">
            <label>
              ${esc(tr("exercise.note_label"))}
              <input type="text" name="review_notes_${idx}" value="${esc(String(entry?._existing_result?.notes || ""))}" placeholder="${esc(tr("exercise.note_placeholder_example"))}">
            </label>
          </div>
        </li>
    `;
  }).join("");
}



function renderReviewSummary(item){
  const root = document.getElementById("reviewPlanSummary");
  if (!root) return;

  const sessionEntries = getSessionEntries(item);
  if (!item || sessionEntries.length === 0){
    root.innerHTML = `<div class="small">${esc(tr("after_training.no_plan_to_review"))}</div>`;
    return;
  }

  const sessionType = formatSessionType(item.session_type || "");
  const completionSummaryText = getWorkoutCompletionSummaryText(STATE.workoutCompletionContext || {});
  const sessionBlocks = getSessionBlocks(item);
  const metaBits = [];
  if (sessionType) metaBits.push(sessionType);
  if (item.time_budget_min) metaBits.push(`${esc(item.time_budget_min)} min`);
  if (item.readiness_score != null) metaBits.push(`${esc(tr("overview.readiness"))}: ${esc(String(item.readiness_score))}`);
  if (sessionBlocks.length > 1) metaBits.push(tr("session.blocks_count", { count: String(sessionBlocks.length) }));
  metaBits.push(`${esc(String(sessionEntries.length))} ${esc(sessionEntries.length === 1 ? tr("common.exercise_singular") : tr("common.exercise_plural"))}`);

  root.innerHTML = `
    <div class="review-summary-card">
      <div class="review-summary-title">${esc(tr("review.finish_title"))}</div>
      <div class="review-summary-lead">${esc(tr("review.finish_lead"))}</div>
      <div class="review-summary-meta">
        <div class="review-summary-pill small">${esc(tr("review.summary_closure_label"))}</div>
        ${metaBits.map(bit => `<div class="review-summary-pill small">${esc(bit)}</div>`).join("")}
      </div>
      ${completionSummaryText ? `<div class="small review-summary-outcome">${esc(completionSummaryText)}</div>` : ""}
      <div class="small review-summary-outcome">${esc(tr("review.summary_session_label"))}</div>
      <div class="small review-summary-list">
        ${sessionEntries.map(entry => {
          const bits = [];
          if (entry.sets) bits.push(tr("exercise.sets_count", { count: esc(entry.sets) }));
          if (entry.target_reps) bits.push(tr("exercise.target_label", { value: formatTarget(entry.target_reps) }));
          if (entry.target_load) bits.push(esc(entry.target_load));
          return `${esc(formatExerciseName(entry.exercise_id))}${bits.length ? ` · ${bits.join(" · ")}` : ""}`;
        }).join("<br>")}
      </div>
    </div>
  `;
}

function buildFeedbackFooterHtml(){
  return `
    <div style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap">
      <button type="button" id="finishFeedbackBtn" class="secondary">${tr("button.back_to_overview")}</button>
    </div>
  `;
}

function wireFeedbackFooterActions(){
  document.getElementById("finishFeedbackBtn")?.addEventListener("click", () => {
    showWizardStep("overview");
  });
}





function renderRestDayAcknowledgedSummary(checkinItem, planItem){
  const root = document.getElementById("reviewPlanSummary");
  if (!root) return;

  const item = checkinItem && typeof checkinItem === "object" ? checkinItem : {};
  const bits = [];

  if (item.readiness_score != null){
    bits.push(`${tr("overview.readiness")}: ${esc(String(item.readiness_score))}`);
  }
  if (item.time_budget_min){
    bits.push(tr("overview.time_today_short", { minutes: item.time_budget_min }));
  }

  root.innerHTML = `
    <div style="font-weight:700; margin-bottom:10px; color:#4ade80">✔ ${esc(tr("today_plan.rest_day_logged_title"))}</div>
    <div class="small" style="margin-bottom:8px">${esc(tr("today_plan.rest_day_logged_text"))}</div>
    ${bits.length ? `<div class="small" style="margin-bottom:8px">${bits.map(x => esc(x)).join(" · ")}</div>` : ""}
    ${buildNextPlannedSessionHtml(planItem || null)}
    ${buildFeedbackFooterHtml()}
  `;
  wireFeedbackFooterActions();
}

function renderSessionResultSummary(summary, fallbackResults = null){
  const root = document.getElementById("reviewPlanSummary");
  if (!root) return;
  if (!summary || typeof summary !== "object"){
    return;
  }

  const sessionType = summary.session_type ? formatSessionType(summary.session_type) : tr("common.unknown_title");
  const sessionTypeKey = String(summary.session_type || "").trim().toLowerCase();
  const fatigue = String(summary.fatigue || "").trim();
  const fatigueText = formatFatigueText(fatigue);
  const fatigueLine = fatigue ? ` · ${esc(tr("after_training.fatigue_label"))} ${esc(fatigueText)}` : "";
  const nextStepHint = formatSavedSummaryNextStep(String(summary.progression_summary || summary.next_step_hint || "").trim());
  const postWorkoutMessage = formatSavedSummaryMessage(String(summary.post_workout_message || "").trim());
  const explanationBits = Array.isArray(summary.explanation_bits)
    ? summary.explanation_bits.map(formatSavedSummaryExplanationBit).filter(Boolean)
    : [];
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
      <div class="review-summary-card">
        <div class="review-summary-title">✔ ${esc(tr("after_training.session_completed_title"))}</div>
        <div class="small review-summary-lead">
          ${esc(postWorkoutMessage || tr("after_training.session_completed_title"))}
        </div>
        <div class="small review-summary-outcome">
          ${esc(sessionType)}${cardioKind ? ` · ${esc(formatCardioKindLabel(cardioKind))}` : ""}${fatigueLine}
        </div>
        <div class="small review-summary-outcome">
          ${esc(tr("cardio.review.distance_label"))}: ${esc(distanceText)} km<br>
          ${esc(tr("cardio.review.duration_label"))}: ${esc(durationText)}<br>
          ${esc(tr("cardio.review.actual_pace_label"))}: ${esc(paceText)}
        </div>
        <div class="small review-summary-outcome">
          ${esc(tr("review.saved_next_label"))}: ${esc(nextStepHint || tr("common.no_recommendation"))}
        </div>
        ${explanationBits.length ? `<div class="small review-summary-outcome">${esc(explanationBits.join(" · "))}</div>` : ""}
        <div class="small review-summary-outcome">
          ${progressFlags.length ? esc(progressFlags.map(formatProgressFlag).join(", ")) : tr("history.no_progress_flags")}
        </div>
        ${buildNextPlannedSessionHtml(STATE.currentTodayPlan || null)}
      </div>
      ${buildFeedbackFooterHtml()}
    `;
    wireFeedbackFooterActions();
    return;
  }

  const completedExercises = Number(summary.completed_exercises || 0);
  const totalExercises = Number(summary.total_exercises || 0);
  const totalSets = Number(summary.total_sets || 0);
  const totalReps = Number(summary.total_reps || 0);
  const estimatedVolume = Number(summary.estimated_volume || 0);
  const hitFailureCount = Number(summary.hit_failure_count || 0);
  const summaryResults = Array.isArray(summary.results) ? summary.results : [];
  const explicitFallbackResults = Array.isArray(fallbackResults) ? fallbackResults : [];
  const fallbackPlanResults = Array.isArray(STATE.currentTodayPlan?.entries) ? STATE.currentTodayPlan.entries : [];
  const timedSummaryCandidates = summaryResults.length
    ? summaryResults
    : (explicitFallbackResults.length ? explicitFallbackResults : fallbackPlanResults);
  const timedStrengthResults = timedSummaryCandidates.filter(result => {
    const exId = String(result?.exercise_id || result?._base_exercise_id || "").trim();
    const meta = getReviewExerciseMeta(exId);
    return String(meta?.input_kind || "").trim() === "time";
  });
  const timedSetSeconds = timedStrengthResults.flatMap(result => {
    const directSets = Array.isArray(result?.sets) ? result.sets : [];
    if (directSets.length){
      return directSets
        .map(setItem => Number(String(setItem?.reps || "").match(/\d+/)?.[0] || 0))
        .filter(x => x > 0);
    }
    const existingSets = Array.isArray(result?._existing_result?.sets) ? result._existing_result.sets : [];
    return existingSets
      .map(setItem => Number(String(setItem?.reps || "").match(/\d+/)?.[0] || 0))
      .filter(x => x > 0);
  });
  const summaryTotalTimedSeconds = Number(summary.total_time_under_tension_sec || 0);
  const totalTimedSeconds = summaryTotalTimedSeconds > 0 ? summaryTotalTimedSeconds : timedSetSeconds.reduce((sum, x) => sum + x, 0);
  const timedCandidateCount = timedSummaryCandidates.length;
  const hasTimedOnlyPlan = timedCandidateCount > 0 && timedStrengthResults.length === timedCandidateCount;
  const hasMixedRepAndTimedWork = totalReps > 0 && totalTimedSeconds > 0;
  const hasTimedOnlyWork = totalTimedSeconds > 0 && totalReps === 0;
  const shouldUseTimedSummary = hasTimedOnlyWork || hasTimedOnlyPlan;

  const normalizedNextStepHint = String(nextStepHint || "").trim().toLowerCase();

  const visibleExplanationBits = (shouldUseTimedSummary ? explanationBits.filter(bit => {
    const x = String(bit || "").trim().toLowerCase();
    return x && !x.startsWith("failure-markører:") && !x.startsWith("failure markers:");
  }) : explanationBits).filter(bit => {
    const x = String(bit || "").trim().toLowerCase();
    return x && x != normalizedNextStepHint;
  });

  const visibleProgressFlags = shouldUseTimedSummary
    ? progressFlags.filter(flag => {
        const raw = String(flag || "").trim().toLowerCase();
        return raw && !raw.endsWith("_done") && !raw.endsWith("_failure");
      })
    : progressFlags;

  const resultListHtml = summaryResults.length
    ? `<div class="small review-summary-list">${summaryResults.map(result => {
        const exerciseName = formatExerciseName(result?.exercise_id || "");
        const substitutedFrom = String(result?.substituted_from || "").trim();
        const substitutionBit = substitutedFrom
          ? ` · ${tr("exercise.substituted_from")}: ${formatExerciseName(substitutedFrom)}`
          : "";
        return `${esc(exerciseName)}${esc(substitutionBit)}`;
      }).join("<br>")}</div>`
    : "";

  const timedHoldTimesText = timedSetSeconds.length ? timedSetSeconds.join(" / ") : "-";
  const timedPerformanceBlock = `${esc(tr("after_training.completed_exercises_label"))}: ${esc(String(completedExercises))}/${esc(String(totalExercises))}<br>
      ${esc(tr("review.summary_sets_label"))}: ${esc(String(totalSets))}<br>
      ${esc(tr("review.summary_hold_times_label"))}: ${esc(timedHoldTimesText)} sek<br>
      ${esc(tr("review.summary_total_hold_time_label"))}: ${esc(String(totalTimedSeconds))} sek<br>
      ${esc(tr("review.summary_failure_markers_label"))}: ${esc(String(hitFailureCount))}`;

  const standardPerformanceBlock = `${esc(tr("after_training.completed_exercises_label"))}: ${esc(String(completedExercises))}/${esc(String(totalExercises))}<br>
      ${esc(tr("review.summary_sets_label"))}: ${esc(String(totalSets))}<br>
      ${esc(tr("review.summary_reps_label"))}: ${esc(String(totalReps))}<br>
      ${esc(tr("review.summary_volume_label"))}: ${esc(String(estimatedVolume))}<br>
      ${esc(tr("review.summary_failure_markers_label"))}: ${esc(String(hitFailureCount))}`;

  const mixedPerformanceBlock = `${esc(tr("after_training.completed_exercises_label"))}: ${esc(String(completedExercises))}/${esc(String(totalExercises))}<br>
      ${esc(tr("review.summary_sets_label"))}: ${esc(String(totalSets))}<br>
      ${esc(tr("review.summary_reps_label"))}: ${esc(String(totalReps))}<br>
      ${esc(tr("review.summary_volume_label"))}: ${esc(String(estimatedVolume))}<br>
      ${esc(tr("review.summary_hold_times_label"))}: ${esc(timedHoldTimesText)} sek<br>
      ${esc(tr("review.summary_total_hold_time_label"))}: ${esc(String(totalTimedSeconds))} sek<br>
      ${esc(tr("review.summary_failure_markers_label"))}: ${esc(String(hitFailureCount))}`;

  const performanceBlock = hasMixedRepAndTimedWork
    ? mixedPerformanceBlock
    : (shouldUseTimedSummary ? timedPerformanceBlock : standardPerformanceBlock);

  root.innerHTML = `
    <div class="review-summary-card">
      <div class="review-summary-title">✔ ${esc(tr("after_training.session_completed_title"))}</div>
      <div class="small review-summary-lead">
        ${esc(postWorkoutMessage || tr("after_training.session_completed_title"))}
      </div>
      <div class="small review-summary-outcome">
        ${esc(sessionType)}${fatigueLine}
      </div>
      <div class="small review-summary-outcome">
        ${performanceBlock}
      </div>
      <div class="small review-summary-outcome">
        ${esc(tr("review.saved_next_label"))}: ${esc(nextStepHint || tr("common.no_recommendation"))}
      </div>
      ${resultListHtml}
      ${visibleExplanationBits.length ? `<div class="small review-summary-outcome">${esc(visibleExplanationBits.join(" · "))}</div>` : ""}
      ${visibleProgressFlags.length ? `<div class="small review-summary-outcome">${esc(visibleProgressFlags.map(formatProgressFlag).join(", "))}</div>` : ""}
      ${buildNextPlannedSessionHtml(STATE.currentTodayPlan || null)}
    </div>
    ${buildFeedbackFooterHtml()}
  `;
  wireFeedbackFooterActions();
}


function formatPlanActionText(entry){
  const localAdjustment = String(entry?.manual_intensity_adjustment || "").trim();
  const load = String(entry?.target_load || "").trim();
  const nextTarget = String(entry?.next_target_reps || "").trim();
  const exerciseId = String(entry?.exercise_id || "").trim().toLowerCase();
  const isCardio = exerciseId.startsWith("cardio_") || exerciseId === "cardio_session";

  if (localAdjustment){
    if (entry?.substituted_from){
      return `${tr(localAdjustment === "easier" ? "workout.adjustment.easier" : "workout.adjustment.harder")} · ${tr("exercise.substituted_from")}: ${formatExerciseName(entry.substituted_from)}`;
    }
    if (load){
      return tr("plan.action.use_load_today", { load });
    }
    if (entry?.target_reps){
      return tr("exercise.target_label", { value: formatTarget(entry.target_reps) });
    }
    return tr(localAdjustment === "easier" ? "workout.adjustment.easier" : "workout.adjustment.harder");
  }

  const decision = String(entry?.progression_decision || "").trim();
  if (isCardio){
    if (decision === "autoplan_cardio_initial") return tr("plan.action.cardio_easy_today");
    if (decision === "hold") return tr("plan.action.cardio_hold_today");
    return tr("plan.action.cardio_follow_today");
  }

  if (decision === "increase"){
    return load ? tr("plan.action.use_load_today", { load }) : tr("plan.action.increase_load_today");
  }
  if (decision === "increase_reps"){
    return nextTarget ? tr("progression.next_target", { value: nextTarget }) : tr("progression.increase_reps_next_time");
  }
  if (decision === "hold"){
    return load ? tr("progression.hold_load_today", { load }) : tr("progression.hold_current_load_today");
  }
  if (decision === "use_start_weight"){
    return load ? tr("plan.action.use_start_weight_with_load", { load }) : tr("plan.action.use_start_weight_today");
  }
  if (decision === "no_progression"){
    return tr("progression.no_automatic_progression");
  }
  return load ? tr("plan.action.use_load_today", { load }) : tr("plan.action.follow_plan_today");
}

function formatPlanEntryBadge(entry){
  const localAdjustment = String(entry?.manual_intensity_adjustment || "").trim();
  if (localAdjustment === "easier") return tr("button.make_easier");
  if (localAdjustment === "harder") return tr("button.make_harder");
  return formatProgressionDecision(entry?.progression_decision || "");
}

function getTargetNumberSignature(target){
  const nums = [...String(target || "").matchAll(/\d+/g)].map(m => Number(m[0])).filter(Number.isFinite);
  if (!nums.length) return 0;
  return Math.max(...nums);
}

function getVariantDirectionFromBaseline(entry){
  const baseId = String(entry?._base_exercise_id || "").trim().toLowerCase();
  const currentId = String(entry?.exercise_id || "").trim().toLowerCase();
  if (!baseId || !currentId || baseId === currentId) return 0;
  if (getExerciseVariantSwap(baseId, "harder") === currentId) return 1;
  if (getExerciseVariantSwap(baseId, "easier") === currentId) return -1;
  return 0;
}

function getPlanEntryTone(entry){
  if (!entry || typeof entry !== "object") return { style: "", level: 0, direction: 0 };

  const currentLoad = parseKgNumber(entry.target_load);
  const baseLoad = parseKgNumber(entry._base_target_load);
  const currentRepSig = getTargetNumberSignature(entry.target_reps);
  const baseRepSig = getTargetNumberSignature(entry._base_target_reps);
  const currentSets = Math.max(1, Number(entry.sets || 1) || 1);
  const hasBaseSets = entry._base_sets != null && entry._base_sets !== "";
  const baseSets = hasBaseSets ? Math.max(1, Number(entry._base_sets || 1) || 1) : currentSets;

  const hasLoadVolumeBaseline =
    currentLoad != null &&
    baseLoad != null &&
    currentRepSig > 0 &&
    baseRepSig > 0;

  const currentVolume = hasLoadVolumeBaseline
    ? currentLoad * currentRepSig * currentSets
    : 0;
  const baseVolume = hasLoadVolumeBaseline
    ? baseLoad * baseRepSig * baseSets
    : 0;

  const variantDirection = getVariantDirectionFromBaseline(entry);
  const signedScore = hasLoadVolumeBaseline
    ? currentVolume - baseVolume
    : (
        (currentRepSig && baseRepSig ? Math.round((currentRepSig - baseRepSig) / 2) : 0) +
        (currentSets - baseSets) +
        (variantDirection * 2)
      );

  const absScore = Math.abs(signedScore);

  let level = 0;
  if (hasLoadVolumeBaseline){
    if (absScore >= Math.max(1, baseVolume * 0.10)) level = 1;
    if (absScore >= Math.max(1, baseVolume * 0.25)) level = 2;
    if (absScore >= Math.max(1, baseVolume * 0.45)) level = 3;
  } else {
    if (absScore >= 1) level = 1;
    if (absScore >= 3) level = 2;
    if (absScore >= 5) level = 3;
  }

  const direction = signedScore > 0 ? 1 : signedScore < 0 ? -1 : 0;

  const styles = {
    neutral: "background:#141414; border:1px solid rgba(255,255,255,0.08);",
    easier1: "background:rgba(34,197,94,0.10); border:1px solid rgba(34,197,94,0.35);",
    easier2: "background:rgba(34,197,94,0.16); border:1px solid rgba(34,197,94,0.50);",
    easier3: "background:rgba(34,197,94,0.22); border:1px solid rgba(34,197,94,0.65);",
    harder1: "background:rgba(249,115,22,0.12); border:1px solid rgba(249,115,22,0.38);",
    harder2: "background:rgba(234,88,12,0.16); border:1px solid rgba(234,88,12,0.52);",
    harder3: "background:rgba(220,38,38,0.18); border:1px solid rgba(220,38,38,0.62);",
  };

  let style = styles.neutral;
  if (direction < 0 && level > 0) style = styles[`easier${level}`];
  if (direction > 0 && level > 0) style = styles[`harder${level}`];

  return { style, level, direction };
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

function parseKgNumber(value){
  const str = String(value || "").trim();
  const m = str.match(/\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(String(m[0]).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function formatKgLabel(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const rounded = Number.isInteger(n) ? n : Math.round(n * 10) / 10;
  return `${rounded} kg`;
}

function getEntryLoadStep(entry){
  const exerciseId = String(entry?.exercise_id || "").trim().toLowerCase();
  const settings = STATE.userSettings && typeof STATE.userSettings === "object" ? STATE.userSettings : {};
  const increments = settings.equipment_increments && typeof settings.equipment_increments === "object"
    ? settings.equipment_increments
    : {};

  if (["squat", "bench_press", "barbell_row"].includes(exerciseId)){
    return Number(increments.barbell || 10) || 10;
  }
  if (["dumbbell_row"].includes(exerciseId)){
    return Number(increments.dumbbell || 5) || 5;
  }
  return 0;
}

function getProgressionLadderForExercise(exerciseId){
  const id = String(exerciseId || "").trim().toLowerCase();
  if (!id) return [];

  const allExercises = Array.isArray(STATE.exercises) ? STATE.exercises : [];
  const existingIds = new Set(allExercises.map(item => String(item?.id || "").trim().toLowerCase()).filter(Boolean));
  const cleanLadder = (ladder) => {
    return (Array.isArray(ladder) ? ladder : [])
      .map(x => String(x || "").trim())
      .filter(Boolean)
      .filter(candidateId => existingIds.has(candidateId.toLowerCase()));
  };

  const ownMeta = getExerciseMeta(id) || {};
  const ownLadder = cleanLadder(ownMeta.progression_ladder);
  if (ownLadder.map(x => x.toLowerCase()).includes(id)){
    return ownLadder;
  }

  for (const item of allExercises){
    const ladder = cleanLadder(item?.progression_ladder);
    const normalized = ladder.map(x => x.toLowerCase());
    if (normalized.includes(id)){
      return ladder;
    }
  }

  return [];
}

function getExerciseVariantSwap(exerciseId, direction){
  const id = String(exerciseId || "").trim().toLowerCase();
  const dir = String(direction || "").trim().toLowerCase();
  if (!id || !dir) return "";

  const ladder = getProgressionLadderForExercise(id);
  if (ladder.length){
    const normalized = ladder.map(x => String(x || "").trim().toLowerCase());
    const currentIdx = normalized.indexOf(id);
    if (currentIdx !== -1){
      if (dir === "easier" && currentIdx > 0) return ladder[currentIdx - 1] || "";
      if (dir === "harder" && currentIdx < ladder.length - 1) return ladder[currentIdx + 1] || "";
    }
  }

  const lighter = {
    "push_ups": "incline_push_ups",
    "split_squat": "step_ups",
  };
  const harder = {
    "incline_push_ups": "push_ups",
    "step_ups": "split_squat",
  };

  if (dir === "easier") return lighter[id] || "";
  if (dir === "harder") return harder[id] || "";
  return "";
}

function parseTargetPattern(target){
  const str = String(target || "").trim();
  if (!str) return null;

  let m = str.match(/^(\d+)\s*-\s*(\d+)$/);
  if (m){
    return {
      kind: "range",
      a: Number(m[1]),
      b: Number(m[2]),
      suffix: ""
    };
  }

  m = str.match(/^(\d+)$/);
  if (m){
    return {
      kind: "single",
      value: Number(m[1]),
      suffix: ""
    };
  }

  m = str.match(/^(\d+)\s*\/\s*(side|leg)$/i);
  if (m){
    return {
      kind: "per_side",
      value: Number(m[1]),
      suffix: `/${String(m[2] || "side").toLowerCase()}`
    };
  }

  m = str.match(/^(\d+)\s*(sek|sec)$/i);
  if (m){
    return {
      kind: "time",
      value: Number(m[1]),
      suffix: String(m[2] || "sec").toLowerCase()
    };
  }

  return null;
}

function formatTargetPattern(pattern){
  if (!pattern || typeof pattern !== "object") return "";
  if (pattern.kind === "range"){
    return `${pattern.a}-${pattern.b}`;
  }
  if (pattern.kind === "single"){
    return String(pattern.value);
  }
  if (pattern.kind === "per_side"){
    return `${pattern.value}${pattern.suffix || "/side"}`;
  }
  if (pattern.kind === "time"){
    return `${pattern.value} ${pattern.suffix || "sec"}`;
  }
  return "";
}

function getNumericOptions(list){
  const arr = Array.isArray(list) ? list : [];
  return [...new Set(
    arr
      .map(value => parseNumericToken(value))
      .filter(value => Number.isFinite(value) && value > 0)
  )].sort((a, b) => a - b);
}

function isLoadFirstProgressionExercise(entry){
  const exerciseId = String(entry?.exercise_id || "").trim().toLowerCase();
  return [
    "squat",
    "bench_press",
    "overhead_press",
    "barbell_row",
    "romanian_deadlift",
    "dumbbell_row"
  ].includes(exerciseId);
}

function getEntryLoadBounds(entry){
  const exerciseId = String(entry?.exercise_id || "").trim().toLowerCase();
  const meta = getExerciseMeta(exerciseId) || {};
  const loadOptions = getNumericOptions(meta.load_options);

  const bounds = {
    "squat": { min: 20, max: 200 },
    "bench_press": { min: 20, max: 160 },
    "overhead_press": { min: 20, max: 120 },
    "barbell_row": { min: 20, max: 160 },
    "romanian_deadlift": { min: 20, max: 220 },
    "dumbbell_row": { min: 2, max: 40 },
  };
  const fallback = bounds[exerciseId] || { min: 1, max: 200 };

  if (loadOptions.length){
    if (isLoadFirstProgressionExercise(entry)){
      return {
        min: Math.max(fallback.min, loadOptions[0]),
        max: fallback.max,
        options: loadOptions
      };
    }
    return {
      min: loadOptions[0],
      max: loadOptions[loadOptions.length - 1],
      options: loadOptions
    };
  }

  return { ...fallback, options: [] };
}

function getEntrySetBounds(entry){
  const meta = getExerciseMeta(entry?.exercise_id) || {};
  const rawOptions = Array.isArray(meta.set_options) ? meta.set_options : [];
  const currentSets = Math.max(1, Number(entry?.sets || 1) || 1);

  const options = [...new Set(
    [...rawOptions, currentSets]
      .map(value => Number(value))
      .filter(Number.isFinite)
      .map(value => Math.max(1, Math.trunc(value)))
  )].sort((a, b) => a - b);

  return {
    min: options[0] || currentSets,
    max: options[options.length - 1] || currentSets,
    options: options.length ? options : [currentSets]
  };
}

function getWorkoutRepChoicesForEntry(entry){
  const target = String(entry?.target_reps || "").trim();
  const nums = [...target.matchAll(/\d+/g)]
    .map(m => Number(m[0]))
    .filter(Number.isFinite)
    .map(n => Math.max(0, Math.trunc(n)));

  if (nums.length){
    const max = Math.max(...nums);
    return Array.from({ length: max + 1 }, (_, i) => String(i));
  }

  const repBounds = getEntryRepBounds(entry);
  if (repBounds.kind === "reps" && Array.isArray(repBounds.options) && repBounds.options.length){
    return repBounds.options.map(String);
  }

  return [];
}

function getEntryRepBounds(entry){
  const exerciseId = String(entry?.exercise_id || "").trim().toLowerCase();
  const meta = getExerciseMeta(exerciseId) || {};
  const inputKind = String(meta.input_kind || "").trim().toLowerCase();

  if (inputKind === "time" || inputKind === "cardio_time"){
    const timeOptions = getNumericOptions(meta.time_options);
    if (timeOptions.length){
      return {
        min: timeOptions[0],
        max: timeOptions[timeOptions.length - 1],
        kind: "time",
        options: timeOptions
      };
    }
  } else {
    const workoutChoices = getNumericOptions(meta.workout_rep_choices);
    const repOptions = getNumericOptions(meta.rep_options);
    const options = workoutChoices.length ? workoutChoices : repOptions;
    if (options.length){
      return {
        min: options[0],
        max: options[options.length - 1],
        kind: "reps",
        options
      };
    }
  }

  const bounds = {
    "push_ups": { min: 4, max: 20 },
    "incline_push_ups": { min: 4, max: 20 },
    "dead_bug": { min: 4, max: 16 },
    "plank": { min: 10, max: 90, kind: "time" },
    "split_squat": { min: 4, max: 16 },
    "step_ups": { min: 4, max: 16 },
  };
  const fallback = bounds[exerciseId] || { min: 1, max: 20 };
  return { ...fallback, options: [] };
}

function clampTargetRepsString(target, entry){
  const str = String(target || "").trim();
  if (!str) return str;

  const bounds = getEntryRepBounds(entry);
  const min = Number(bounds.min || 1);
  const max = Number(bounds.max || 20);
  const parsed = parseTargetPattern(str);
  if (!parsed) return str;

  if (parsed.kind === "range"){
    const width = Math.max(0, parsed.b - parsed.a);
    let a = Math.max(min, Math.min(max, parsed.a));
    let b = Math.max(a, Math.min(max, a + width));
    if (b > max){
      b = max;
      a = Math.max(min, b - width);
    }
    return `${a}-${b}`;
  }

  if (parsed.kind === "single"){
    return String(Math.max(min, Math.min(max, parsed.value)));
  }

  if (parsed.kind === "per_side"){
    const value = Math.max(min, Math.min(max, parsed.value));
    return `${value}${parsed.suffix || "/side"}`;
  }

  if (parsed.kind === "time"){
    const value = Math.max(min, Math.min(max, parsed.value));
    return `${value} ${parsed.suffix || "sec"}`;
  }

  return str;
}

function targetRepsAtBound(target, entry, which){
  const normalized = clampTargetRepsString(target, entry);
  const bounds = getEntryRepBounds(entry);
  const min = Number(bounds.min || 1);
  const max = Number(bounds.max || 20);
  const str = String(normalized || "").trim();

  const nums = [...str.matchAll(/\d+/g)].map(m => Number(m[0])).filter(Number.isFinite);
  if (!nums.length) return false;
  if (which === "min") return Math.min(...nums) <= min;
  if (which === "max") return Math.max(...nums) >= max;
  return false;
}

function getAdjacentNumericOption(options, currentValue, direction){
  const values = Array.isArray(options) ? options : [];
  const current = Number(currentValue);
  if (!Number.isFinite(current) || !values.length) return null;

  if (direction === "harder"){
    return values.find(value => value > current) ?? null;
  }
  if (direction === "easier"){
    for (let i = values.length - 1; i >= 0; i -= 1){
      if (values[i] < current) return values[i];
    }
  }
  return null;
}

function getLoadFirstSetsAfterLoadStep(currentSets, setBounds, direction){
  const bounds = setBounds && typeof setBounds === "object" ? setBounds : {};
  const minSets = Math.max(1, Number(bounds.min || 1) || 1);
  const maxSets = Math.max(minSets, Number(bounds.max || currentSets || minSets) || minSets);
  const sets = Math.max(minSets, Math.min(maxSets, Number(currentSets || minSets) || minSets));

  if (direction === "harder"){
    return Math.max(minSets, sets - 1);
  }

  if (direction === "easier"){
    return Math.min(maxSets, sets + 1);
  }

  return sets;
}

function shiftTargetPatternOneStep(target, entry, direction){
  const parsed = parseTargetPattern(target);
  if (!parsed) return "";

  const bounds = getEntryRepBounds(entry);
  const min = Number(bounds.min || 1);
  const max = Number(bounds.max || 20);
  const options = Array.isArray(bounds.options) ? bounds.options : [];

  if (parsed.kind === "range"){
    const width = Math.max(0, parsed.b - parsed.a);
    let nextA = direction === "harder" ? parsed.a + 1 : parsed.a - 1;
    let nextB = direction === "harder" ? parsed.b + 1 : parsed.b - 1;

    if (nextA < min){
      nextA = min;
      nextB = Math.min(max, min + width);
    }
    if (nextB > max){
      nextB = max;
      nextA = Math.max(min, max - width);
    }

    const nextText = `${nextA}-${nextB}`;
    return nextText === String(target || "").trim() ? "" : nextText;
  }

  if (parsed.kind === "single" || parsed.kind === "per_side" || parsed.kind === "time"){
    const currentValue = Number(parsed.value || 0);
    const stepped = getAdjacentNumericOption(options, currentValue, direction);
    let nextValue = stepped;

    if (nextValue == null){
      const delta = parsed.kind === "time" ? (direction === "harder" ? 5 : -5) : (direction === "harder" ? 1 : -1);
      nextValue = currentValue + delta;
    }

    nextValue = Math.max(min, Math.min(max, nextValue));
    if (nextValue === currentValue) return "";

    const nextPattern = { ...parsed, value: nextValue };
    return formatTargetPattern(nextPattern);
  }

  return "";
}

function buildBoundaryTargetFromCurrentShape(entry, which){
  const current = String(entry?.target_reps || "").trim();
  const parsed = parseTargetPattern(current);
  const bounds = getEntryRepBounds(entry);
  const min = Number(bounds.min || 1);
  const max = Number(bounds.max || 20);

  if (!parsed){
    if (bounds.kind === "time"){
      return `${which === "min" ? min : max} sec`;
    }
    return String(which === "min" ? min : max);
  }

  if (parsed.kind === "range"){
    const width = Math.max(0, parsed.b - parsed.a);
    if (which === "min"){
      const a = min;
      const b = Math.min(max, a + width);
      return `${a}-${b}`;
    }
    const b = max;
    const a = Math.max(min, b - width);
    return `${a}-${b}`;
  }

  if (parsed.kind === "single"){
    return String(which === "min" ? min : max);
  }

  if (parsed.kind === "per_side"){
    return `${which === "min" ? min : max}${parsed.suffix || "/side"}`;
  }

  if (parsed.kind === "time"){
    return `${which === "min" ? min : max} ${parsed.suffix || "sec"}`;
  }

  return current;
}

async function applyVariantSwap(entry, direction){
  const currentExerciseId = String(entry?.exercise_id || "").trim();
  if (!currentExerciseId) return false;

  try{
    const resolved = await resolveLocalAdjustmentVariant(entry, direction);
    if (resolved?.changed && resolved?.exercise_id){
      const nextExerciseId = String(resolved.exercise_id || "").trim();

      entry.substituted_from = resolved.substituted_from || currentExerciseId;
      entry.exercise_id = nextExerciseId;
      entry.local_regression_reason = resolved.reason || "";
      entry.manual_adjustment_reason = direction === "harder"
        ? "variant_step_up_backend"
        : "variant_step_down_backend";

      const setBounds = getEntrySetBounds(entry);
      entry.sets = direction === "harder" ? setBounds.min : setBounds.max;

      const meta = getExerciseMeta(nextExerciseId) || {};
      const inputKind = String(meta.input_kind || "").trim().toLowerCase();
      if (entry.target_reps){
        entry.target_reps = buildBoundaryTargetFromCurrentShape(
          entry,
          direction === "harder" ? "min" : "max"
        );
      } else if (
        inputKind === "time" ||
        inputKind === "cardio_time" ||
        inputKind === "bodyweight_reps" ||
        inputKind === "load_reps"
      ){
        entry.target_reps = buildBoundaryTargetFromCurrentShape(
          entry,
          direction === "harder" ? "min" : "max"
        );
      }

      if (meta.supports_load !== true){
        entry.target_load = "";
      }

      return true;
    }
  }catch(err){
  }

  const nextExerciseId = getExerciseVariantSwap(currentExerciseId, direction);
  if (!nextExerciseId) return false;

  entry.substituted_from = currentExerciseId;
  entry.exercise_id = nextExerciseId;
  entry.manual_adjustment_reason = direction === "harder"
    ? "variant_step_up_frontend_fallback"
    : "variant_step_down_frontend_fallback";

  const setBounds = getEntrySetBounds(entry);
  entry.sets = direction === "harder" ? setBounds.min : setBounds.max;

  const meta = getExerciseMeta(nextExerciseId) || {};
  const inputKind = String(meta.input_kind || "").trim().toLowerCase();
  if (entry.target_reps){
    entry.target_reps = buildBoundaryTargetFromCurrentShape(
      entry,
      direction === "harder" ? "min" : "max"
    );
  } else if (
    inputKind === "time" ||
    inputKind === "cardio_time" ||
    inputKind === "bodyweight_reps" ||
    inputKind === "load_reps"
  ){
    entry.target_reps = buildBoundaryTargetFromCurrentShape(
      entry,
      direction === "harder" ? "min" : "max"
    );
  }

  if (meta.supports_load !== true){
    entry.target_load = "";
  }

  return true;
}

function removePlanEntryByIndex(item, idx){
  const entries = getSessionEntries(item);
  if (idx < 0 || idx >= entries.length) return;

  entries.splice(idx, 1);
  renderTodayPlan(item);
}

async function adjustPlanEntryAtIndex(item, idx, direction){
  const entries = Array.isArray(item?.entries) ? item.entries : [];
  if (idx < 0 || idx >= entries.length) return;

  const entry = entries[idx];
  if (!entry || typeof entry !== "object") return;

  const dir = String(direction || "").trim().toLowerCase();
  if (dir !== "easier" && dir !== "harder") return;

  entry.manual_intensity_adjustment = dir;

  if (entry._base_exercise_id == null) entry._base_exercise_id = entry.exercise_id || "";
  if (entry._base_target_reps == null) entry._base_target_reps = entry.target_reps || "";
  if (entry._base_target_load == null) entry._base_target_load = entry.target_load || "";
  if (entry._base_sets == null) entry._base_sets = entry.sets || "";

  const setBounds = getEntrySetBounds(entry);
  const currentSets = Math.max(1, Number(entry.sets || setBounds.min || 1) || 1);
  const currentTarget = String(entry.target_reps || "").trim();
  const currentLoad = parseKgNumber(entry.target_load);
  const loadBounds = getEntryLoadBounds(entry);
  const loadOptions = Array.isArray(loadBounds.options) ? loadBounds.options : [];
  const hasLoadChannel = currentLoad != null && (
    loadOptions.length > 0 ||
    getEntryLoadStep(entry) > 0
  );
  const currentTargetAtMin = targetRepsAtBound(currentTarget, entry, "min");
  const currentTargetAtMax = targetRepsAtBound(currentTarget, entry, "max");

  let changed = false;

  const tryTargetStep = () => {
    if (!currentTarget) return false;

    const nextTarget = clampTargetRepsString(
      shiftTargetPatternOneStep(currentTarget, entry, dir),
      entry
    );
    if (!nextTarget || nextTarget === currentTarget) return false;

    entry.target_reps = nextTarget;
    entry.manual_adjustment_reason = dir === "harder"
      ? "target_step_up"
      : "target_step_down";
    return true;
  };

  const trySetStep = () => {
    const nextSets = getAdjacentNumericOption(setBounds.options, currentSets, dir);
    if (nextSets == null || nextSets === currentSets) return false;

    entry.sets = nextSets;
    entry.manual_adjustment_reason = dir === "harder"
      ? "set_step_up"
      : "set_step_down";
    return true;
  };

  const tryLoadStep = () => {
    if (!hasLoadChannel) return false;

    let nextLoad = null;
    if (loadOptions.length){
      nextLoad = getAdjacentNumericOption(loadOptions, currentLoad, dir);
    }

    if (nextLoad == null){
      const step = getEntryLoadStep(entry);
      if (!step || currentLoad == null) return false;

      nextLoad = dir === "harder"
        ? currentLoad + step
        : currentLoad - step;
    }

    if (nextLoad < loadBounds.min || nextLoad > loadBounds.max) return false;
    if (nextLoad === currentLoad) return false;

    entry.target_load = formatKgLabel(nextLoad);

    if (isLoadFirstProgressionExercise(entry)){
      entry.sets = getLoadFirstSetsAfterLoadStep(currentSets, setBounds, dir);
    } else {
      entry.sets = dir === "harder" ? setBounds.min : setBounds.max;
    }

    if (currentTarget){
      entry.target_reps = buildBoundaryTargetFromCurrentShape(
        entry,
        dir === "harder" ? "min" : "max"
      );
    }

    entry.manual_adjustment_reason = isLoadFirstProgressionExercise(entry)
      ? (
          dir === "harder"
            ? "load_step_up_and_modest_reset"
            : "load_step_down_and_modest_reset"
        )
      : (
          dir === "harder"
            ? "load_step_up_and_reset"
            : "load_step_down_and_reset"
        );
    return true;
  };

  const tryVolumeCycleSetStep = () => {
    if (!isLoadFirstProgressionExercise(entry)) return false;

    const nextSets = getAdjacentNumericOption(setBounds.options, currentSets, dir);
    if (nextSets == null || nextSets === currentSets) return false;

    entry.sets = nextSets;
    if (currentTarget){
      entry.target_reps = buildBoundaryTargetFromCurrentShape(
        entry,
        dir === "harder" ? "min" : "max"
      );
    }

    entry.manual_adjustment_reason = dir === "harder"
      ? "set_step_up_and_reset_target"
      : "set_step_down_and_expand_target";
    return true;
  };

  if (isLoadFirstProgressionExercise(entry)){
    if (dir === "harder"){
      changed =
        (!currentTargetAtMax && tryTargetStep()) ||
        (currentTargetAtMax && tryVolumeCycleSetStep()) ||
        tryLoadStep() ||
        await applyVariantSwap(entry, "harder");
    } else {
      changed =
        (!currentTargetAtMin && tryTargetStep()) ||
        (currentTargetAtMin && currentSets > setBounds.min && tryVolumeCycleSetStep()) ||
        tryLoadStep() ||
        await applyVariantSwap(entry, "easier");
    }
  } else if (dir === "harder"){
    changed =
      tryTargetStep() ||
      trySetStep() ||
      tryLoadStep() ||
      await applyVariantSwap(entry, "harder");
  } else {
    changed =
      tryTargetStep() ||
      trySetStep() ||
      tryLoadStep() ||
      await applyVariantSwap(entry, "easier");
  }

  if (!changed){
    entry.manual_adjustment_reason = "no_local_adjustment_available";
  }

  renderTodayPlan(item);
}

function formatRecoveryExplanationBit(value){
  const x = String(value || "").trim().toLowerCase();
  if (!x) return "";

  const map = {
    "god søvn": tr("recovery.explanation.good_sleep"),
    "god energi": tr("recovery.explanation.good_energy"),
    "lav ømhed": tr("recovery.explanation.low_soreness"),
    "høj ømhed": tr("recovery.explanation.high_soreness"),
    "belastning er lav": tr("recovery.explanation.load_is_low"),
    "belastning er i spike": tr("recovery.explanation.load_is_spike"),
    "du har haft lidt afstand til sidste styrkepas": tr("recovery.explanation.distance_since_last_strength"),
    "good sleep": tr("recovery.explanation.good_sleep"),
    "good energy": tr("recovery.explanation.good_energy"),
    "low soreness": tr("recovery.explanation.low_soreness"),
    "high soreness": tr("recovery.explanation.high_soreness"),
    "load is low": tr("recovery.explanation.load_is_low"),
    "load is in spike": tr("recovery.explanation.load_is_spike"),
    "some distance since last strength session": tr("recovery.explanation.distance_since_last_strength")
  };

  return map[x] || value;
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
  const imageFolder = String(meta?.image_folder || "").trim();
  return images
    .filter(Boolean)
    .map(src => {
      const value = String(src || "").trim();
      if (!value) return "";
      if (value.startsWith("/images/")){
        const filename = value.split("/").pop();
        if (imageFolder && filename){
          return `/assets/exercise-db/${imageFolder}/${filename}`;
        }
      }
      if (value.startsWith("/")) return value;
      return `/assets/exercise-db/${value}`;
    })
    .filter(Boolean);
}

function getExerciseViewerCopy(meta){
  const item = meta && typeof meta === "object" ? meta : {};
  const lang = getCurrentLang();
  const isEnglish = lang === "en";

  const name = String(
    (isEnglish ? item.name_en : item.name) ||
    item.name ||
    item.name_en ||
    ""
  ).trim();

  const notes = String(
    (isEnglish ? item.notes_en : item.notes) ||
    item.notes ||
    item.notes_en ||
    ""
  ).trim();

  const preferredCues = isEnglish ? item.form_cues_en : item.form_cues;
  const fallbackCues = isEnglish ? item.form_cues : item.form_cues_en;
  const formCues = Array.isArray(preferredCues) && preferredCues.length
    ? preferredCues
    : (Array.isArray(fallbackCues) ? fallbackCues : []);

  return { name, notes, formCues };
}

function openExerciseViewer(exerciseId, options = {}){
  try {
    const modal = document.getElementById("exerciseViewerModal");
    const titleEl = document.getElementById("exerciseViewerTitle");
    const metaEl = document.getElementById("exerciseViewerMeta");
    const imagesEl = document.getElementById("exerciseViewerImages");

    if (!modal || !titleEl || !metaEl || !imagesEl){
      return;
    }

    const meta = getExerciseMeta(exerciseId) || {};
    const viewerCopy = getExerciseViewerCopy(meta);
    const isWorkoutMode = options?.mode === "workout";
    const name = viewerCopy.name || exerciseId || tr("exercise.viewer_title");
    const allImages = getExerciseImages(exerciseId);
    const images = isWorkoutMode ? allImages.slice(0, 1) : allImages;
    const notes = viewerCopy.notes;
    const category = String(meta.category || "").trim();
    const formCues = Array.isArray(viewerCopy.formCues) ? viewerCopy.formCues.filter(Boolean).map(x => String(x).trim()).filter(Boolean) : [];
    const visibleFormCues = isWorkoutMode ? formCues.slice(0, 2) : formCues;

    titleEl.textContent = name;

    const metaParts = [];
    if (isWorkoutMode){
      metaParts.push(tr("exercise.viewer_short_guide"));
    }
    if (images.length){
      metaParts.push(`${images.length} billede${images.length === 1 ? "" : "r"}`);
    }
    if (category){
      metaParts.push(`Kategori: ${category}`);
    }

    metaEl.textContent = metaParts.join(" · ");

    const shouldShowNotes = Boolean(notes) && (!isWorkoutMode || !visibleFormCues.length);
    const notesHtml = shouldShowNotes ? `
      <div style="margin-top:14px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08)">
        <div style="font-weight:700;margin-bottom:8px">${esc(tr("exercise.viewer_short_guide"))}</div>
        <div class="small" style="line-height:1.5">${esc(notes)}</div>
      </div>
    ` : "";

    const cuesHtml = visibleFormCues.length ? `
      <div style="margin-top:14px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08)">
        <div style="font-weight:700;margin-bottom:8px">${esc(tr("exercise.viewer_technique_focus"))}</div>
        <ul style="margin:0;padding-left:18px">
          ${visibleFormCues.map(cue => `<li style="margin-bottom:6px">${esc(cue)}</li>`).join("")}
        </ul>
      </div>
    ` : "";

    if (!images.length){
      imagesEl.innerHTML = `<div class="small">${tr("exercise.no_images")}</div>${notesHtml}${cuesHtml}`;
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
      `).join("") + notesHtml + cuesHtml;
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
    const isWorkoutMode = Boolean(STATE.workoutInProgress);
    openExerciseViewer(openBtn.getAttribute("data-exercise-viewer"), {
      mode: isWorkoutMode ? "workout" : "default",
    });
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



function getSessionBlocks(item){
  if (!item || typeof item !== "object") return [];
  if (Array.isArray(item.session_blocks) && item.session_blocks.length){
    return item.session_blocks.filter(block => block && typeof block === "object");
  }

  const entries = getSessionEntries(item);
  if (!entries.length) return [];
  return [{
    id: "main",
    label: "",
    kind: "default",
    entries,
  }];
}

function getSessionEntries(item){
  if (!item || typeof item !== "object") return [];
  if (Array.isArray(item.entries)) return item.entries;

  const blocks = Array.isArray(item.session_blocks) ? item.session_blocks : [];
  const flattened = [];
  for (const block of blocks){
    if (!block || typeof block !== "object") continue;
    const blockEntries = Array.isArray(block.entries) ? block.entries : [];
    for (const entry of blockEntries){
      if (entry && typeof entry === "object") flattened.push(entry);
    }
  }
  return flattened;
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


function getExerciseLibraryCardCopy(item){
  const entry = item && typeof item === "object" ? item : {};
  const lang = getCurrentLang();
  const isEnglish = lang === "en";

  const name = String(
    (isEnglish ? entry.name_en : entry.name) ||
    entry.name ||
    entry.name_en ||
    ""
  ).trim();

  const notes = String(
    (isEnglish ? entry.notes_en : entry.notes) ||
    entry.notes ||
    entry.notes_en ||
    ""
  ).trim();

  return { name, notes };
}

function renderExerciseLibrary(){
  const root = document.getElementById("exerciseLibrary");
  const searchInput = document.getElementById("libraryExerciseSearchInput");
  if (!root) return;

  if (searchInput && searchInput.dataset.boundSearch !== "true"){
    searchInput.dataset.boundSearch = "true";
    searchInput.addEventListener("input", () => {
      CURRENT_LIBRARY_EXERCISE_QUERY = String(searchInput.value || "").trim();
      renderExerciseLibrary();
    });
  }

  if (searchInput && searchInput.value !== CURRENT_LIBRARY_EXERCISE_QUERY){
    searchInput.value = CURRENT_LIBRARY_EXERCISE_QUERY;
  }

  const items = Array.isArray(STATE.exercises) ? STATE.exercises.slice() : [];
  if (!items.length){
    root.innerHTML = `<div class="small">${esc(tr("exercise.none_loaded_yet"))}</div>`;
    setText("exerciseMeta", tr("common.items_count", { count: 0 }));
    return;
  }

  const query = String(CURRENT_LIBRARY_EXERCISE_QUERY || "").trim().toLowerCase();
  const filteredItems = items.filter(item => {
    if (!item || typeof item !== "object") return false;
    if (!query) return true;
    const copy = getExerciseLibraryCardCopy(item);
    const haystack = [
      String(item.id || ""),
      String(copy.name || ""),
      String(copy.notes || ""),
      String(item.category || "")
    ].join(" ").toLowerCase();
    return haystack.includes(query);
  });

  if (!filteredItems.length){
    root.innerHTML = `<div class="small">${esc(tr("library.exercise_search_empty"))}</div>`;
    setText("exerciseMeta", tr("common.items_count", { count: 0 }));
    return;
  }

  const grouped = {};
  for (const item of filteredItems){
    const category = String(item.category || "andet").trim() || "andet";
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(item);
  }

  const order = Object.keys(grouped).sort((a, b) => a.localeCompare(b, "da"));

  root.innerHTML = order.map(category => {
    const rows = grouped[category]
      .slice()
      .sort((a, b) => {
        const aCopy = getExerciseLibraryCardCopy(a);
        const bCopy = getExerciseLibraryCardCopy(b);
        return String(aCopy.name || "").localeCompare(String(bCopy.name || ""), getCurrentLang() === "en" ? "en" : "da");
      })
      .map(item => {
        const exId = String(item.id || "").trim();
        const cardCopy = getExerciseLibraryCardCopy(item);
        const name = String(cardCopy.name || exId || tr("common.unknown_title")).trim();
        const notes = String(cardCopy.notes || "").trim();
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

  setText("exerciseMeta", tr("common.items_count", { count: filteredItems.length }));
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


function getCurrentWorkoutSetIndex(entry){
  const plannedSets = Math.max(1, Number(entry?.sets || 1));
  const current = Math.max(0, Number(STATE.currentWorkoutSetIndex || 0));
  return Math.min(current, plannedSets - 1);
}

function getWorkoutPlannedSetCount(entry){
  return Math.max(1, Number(entry?.sets || 1));
}

function hasMoreWorkoutSets(entry){
  return getCurrentWorkoutSetIndex(entry) < (getWorkoutPlannedSetCount(entry) - 1);
}

function isTimedHoldWorkoutEntry(entry){
  const meta = getReviewExerciseMeta(entry?.exercise_id);
  return String(meta?.input_kind || "").trim() === "time";
}

function getTimedHoldTargetSeconds(entry){
  const meta = getReviewExerciseMeta(entry?.exercise_id);
  const raw = String(entry?.target_reps || "").trim();
  const match = raw.match(/(\d+)/);
  if (match) return Number(match[1]) || 0;
  const options = Array.isArray(meta?.time_options) ? meta.time_options : [];
  for (const option of options){
    const m = String(option || "").match(/(\d+)/);
    if (m) return Number(m[1]) || 0;
  }
  return 0;
}

function getTimedHoldExistingSeconds(entry){
  const setIdx = getCurrentWorkoutSetIndex(entry);
  const existing = entry?._existing_result && typeof entry._existing_result === "object" ? entry._existing_result : {};
  const sets = Array.isArray(existing.sets) ? existing.sets : [];
  const setItem = sets[setIdx] && typeof sets[setIdx] === "object" ? sets[setIdx] : {};
  const raw = String(setItem.reps || "").trim();
  const match = raw.match(/(\d+)/);
  return match ? (Number(match[1]) || 0) : 0;
}

function getTimedHoldRemainingSeconds(entry){
  const endsAt = Number(entry?._active_hold_timer_ends_at || 0);
  if (!endsAt) return 0;
  const remainingMs = endsAt - Date.now();
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

function getTimedHoldPrepRemainingSeconds(entry){
  const endsAt = Number(entry?._active_hold_prep_ends_at || 0);
  if (!endsAt) return 0;
  const remainingMs = endsAt - Date.now();
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

function clearTimedHoldPrep(entry){
  if (!entry || typeof entry !== "object") return;
  delete entry._active_hold_prep_ends_at;
  delete entry._active_hold_prep_duration_sec;
}

function startTimedHoldPrep(entry, durationSec = 5){
  if (!entry || typeof entry !== "object") return 0;
  const prepSec = Math.max(1, Number(durationSec || 5));
  entry._active_hold_prep_duration_sec = prepSec;
  entry._active_hold_prep_ends_at = Date.now() + (prepSec * 1000);
  return prepSec;
}

function clearTimedHoldTimer(entry){
  if (!entry || typeof entry !== "object") return;
  delete entry._active_hold_timer_ends_at;
  delete entry._active_hold_timer_target_sec;
  clearTimedHoldPrep(entry);
}

function startTimedHoldTimer(entry){
  if (!entry || typeof entry !== "object") return 0;
  const targetSec = Math.max(1, getTimedHoldTargetSeconds(entry));
  entry._active_hold_timer_target_sec = targetSec;
  entry._active_hold_timer_ends_at = Date.now() + (targetSec * 1000);
  return targetSec;
}

function getTimedHoldRuntimeState(entry){
  const prepEndsAt = Number(entry?._active_hold_prep_ends_at || 0);
  const timerEndsAt = Number(entry?._active_hold_timer_ends_at || 0);
  const prepRemainingSec = getTimedHoldPrepRemainingSeconds(entry);
  const remainingSec = getTimedHoldRemainingSeconds(entry);

  return {
    hasPrep: prepEndsAt > 0,
    hasActiveTimer: timerEndsAt > 0,
    prepRemainingSec,
    remainingSec,
    isPrepRunning: prepRemainingSec > 0,
    isActiveRunning: timerEndsAt > 0 && remainingSec > 0,
    isReadyToStartActive: prepEndsAt > 0 && remainingSec <= 0,
    isReadyToComplete: timerEndsAt > 0 && remainingSec <= 0,
  };
}

function ensureTimedHoldTick(item){
  window.clearTimeout(window.__ssWorkoutActiveHoldTick || 0);
  const runtimeNonce = Number(STATE.workoutRuntimeNonce || 0);
  const active = getActiveWorkoutEntry(item);
  const entry = active?.entry;
  if (!entry || !isTimedHoldWorkoutEntry(entry)) return;

  const holdState = getTimedHoldRuntimeState(entry);
  if (holdState.isPrepRunning){
    window.__ssWorkoutActiveHoldTick = window.setTimeout(() => {
      if (Number(STATE.workoutRuntimeNonce || 0) !== runtimeNonce) return;
      renderTodayPlan(item);
    }, 1000);
    return;
  }

  if (holdState.isReadyToStartActive){
    clearTimedHoldPrep(entry);
    startTimedHoldTimer(entry);
    window.__ssWorkoutActiveHoldTick = window.setTimeout(() => {
      if (Number(STATE.workoutRuntimeNonce || 0) !== runtimeNonce) return;
      renderTodayPlan(item);
    }, 50);
    return;
  }

  if (holdState.isReadyToComplete){
    completeTimedHoldSet(item);
    return;
  }

  window.__ssWorkoutActiveHoldTick = window.setTimeout(() => {
    if (Number(STATE.workoutRuntimeNonce || 0) !== runtimeNonce) return;
    renderTodayPlan(item);
  }, 1000);
}

function clearTimedHoldTick(){
  window.clearTimeout(window.__ssWorkoutActiveHoldTick || 0);
}

function completeTimedHoldSet(item){
  const active = getActiveWorkoutEntry(item);
  if (!active || !active.entry) return false;

  STATE.workoutTimedTransitionState = "hold_completed";

  const entry = active.entry;
  if (!isTimedHoldWorkoutEntry(entry)) return false;

  const idx = active.index;
  const hasMoreSetsRemaining = hasMoreWorkoutSets(entry);
  const currentSetIndex = getCurrentWorkoutSetIndex(entry);

  const root = document.getElementById("todayPlanList");
  const hidden = root?.querySelector(`[name="review_set_reps_${idx}_${currentSetIndex}"]`);
  const failSelect = root?.querySelector(`[name="review_set_hit_failure_${idx}_${currentSetIndex}"]`);
  const targetSec = Number(entry?._active_hold_timer_target_sec || getTimedHoldTargetSeconds(entry) || 0);
  if (hidden) hidden.value = String(targetSec);
  if (failSelect) failSelect.value = "false";

  clearTimedHoldTimer(entry);
  clearTimedHoldTick();
  saveActiveWorkoutEntryProgress(item);

  advanceActiveWorkoutAfterCompletedSet(item, idx, currentSetIndex, hasMoreSetsRemaining);
  return true;
}

function clearWorkoutRestTimer(){
  STATE.workoutRestTimerActive = false;
  STATE.workoutRestTimerEndsAt = 0;
  STATE.workoutRestTargetKind = "";
  STATE.workoutRestNextEntryIndex = -1;
  window.clearTimeout(window.__ssWorkoutRestTick || 0);
}

function clearWorkoutRuntimeArtifacts(item){
  clearWorkoutRestTimer();
  clearTimedHoldTick();

  const entries = Array.isArray(item?.entries) ? item.entries : [];
  for (const entry of entries){
    if (!entry || typeof entry !== "object") continue;
    clearTimedHoldTimer(entry);
  }
}

function setWorkoutCompletionContext(context = {}){
  STATE.workoutCompletionContext = {
    outcome: String(context?.outcome || "").trim(),
    source: String(context?.source || "").trim(),
  };
}

function getWorkoutCompletionStatusText(context = {}){
  const outcome = String(context?.outcome || "").trim();

  if (outcome === "completed"){
    return "Workout fuldført. Klar til review.";
  }

  if (outcome === "partial"){
    return "Workout blev afsluttet delvist. Klar til review.";
  }

  if (outcome === "ended_early"){
    return "Workout blev afsluttet før tid. Klar til review.";
  }

  return "";
}


function getWorkoutCompletionSummaryText(context = {}){
  const outcome = String(context?.outcome || "").trim();

  if (outcome === "completed"){
    return "Session blev fuldført i workout playeren.";
  }

  if (outcome === "partial"){
    return "Session blev afsluttet delvist i workout playeren.";
  }

  if (outcome === "ended_early"){
    return "Session blev afsluttet før tid i workout playeren.";
  }

  return "";
}

function finishActiveWorkoutAndOpenReview(item, completionContext = {}){
  setWorkoutCompletionContext(completionContext);
  const completionStatusText = getWorkoutCompletionStatusText(completionContext);
  if (completionStatusText){
    setText("sessionResultStatus", completionStatusText);
  }
  STATE.workoutInProgress = false;
  STATE.currentWorkoutEntryIndex = 0;
  STATE.currentWorkoutSetIndex = 0;
  clearWorkoutRuntimeArtifacts(item);
  markUnsavedWorkoutReviewHandoff(item);
  renderReviewSummary(item);
  renderSessionReview(item);
  showWizardStep("review");
}

function advanceActiveWorkoutAfterCompletedSet(item, idx, currentSetIndex, hasMoreSetsRemaining){
  if (hasMoreSetsRemaining){
    STATE.currentWorkoutSetIndex = currentSetIndex + 1;
    startWorkoutRestTimer(undefined, {
      targetKind: "next_set",
      nextEntryIndex: idx,
    });
    renderTodayPlan(item);
    return;
  }

  STATE.currentWorkoutSetIndex = 0;

  const entries = Array.isArray(item?.entries) ? item.entries : [];
  const isLast = idx >= entries.length - 1;
  if (isLast){
    finishActiveWorkoutAndOpenReview(item, { outcome: "completed", source: "advance_after_completed_set" });
    return;
  }

  STATE.currentWorkoutEntryIndex = idx + 1;
  startWorkoutRestTimer(undefined, {
    targetKind: "next_exercise",
    nextEntryIndex: idx + 1,
  });
  renderTodayPlan(item);
}

function startWorkoutRestTimer(durationSec, options = {}){
  const seconds = Math.max(5, Number(durationSec || STATE.workoutRestTimerDurationSec || 90));
  STATE.workoutRestTimerDurationSec = seconds;
  STATE.workoutRestTimerEndsAt = Date.now() + (seconds * 1000);
  STATE.workoutRestTimerActive = true;
  STATE.workoutRestTargetKind = String(options?.targetKind || "").trim();
  STATE.workoutRestNextEntryIndex = Number.isInteger(options?.nextEntryIndex) ? options.nextEntryIndex : -1;
}

function getRemainingWorkoutRestSeconds(){
  if (!STATE.workoutRestTimerActive || !STATE.workoutRestTimerEndsAt) return 0;
  const remainingMs = Number(STATE.workoutRestTimerEndsAt) - Date.now();
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

function isWorkoutRestTimerRunning(){
  return getRemainingWorkoutRestSeconds() > 0;
}

function isWorkoutRestState(){
  if (!STATE.workoutInProgress || !STATE.workoutRestTimerActive) return false;

  const hasRunningTimer = getRemainingWorkoutRestSeconds() > 0;
  const hasResolvedTarget = Boolean(
    String(STATE.workoutRestTargetKind || "").trim() ||
    Number(STATE.workoutRestNextEntryIndex) >= 0
  );

  return hasRunningTimer || hasResolvedTarget;
}

function getActiveWorkoutEntry(item){
  const entries = Array.isArray(item?.entries) ? item.entries : [];
  if (!entries.length) return null;
  const idx = Math.max(0, Math.min(Number(STATE.currentWorkoutEntryIndex || 0), entries.length - 1));
  return {
    entry: entries[idx],
    index: idx,
    total: entries.length,
  };
}

function getActiveWorkoutProgressState(item){
  const active = getActiveWorkoutEntry(item);
  if (!active || !active.entry) return null;

  const entry = active.entry;
  const idx = active.index;
  const total = active.total;
  const plannedSetCount = getWorkoutPlannedSetCount(entry);
  const currentSetIndex = getCurrentWorkoutSetIndex(entry);

  return {
    active,
    entry,
    idx,
    total,
    isLast: idx >= total - 1,
    plannedSetCount,
    currentSetIndex,
    hasMoreSetsRemaining: currentSetIndex < (plannedSetCount - 1),
  };
}

function removeCurrentWorkoutEntry(item){
  const entries = Array.isArray(item?.entries) ? item.entries : [];
  if (!entries.length) return;

  const idx = Math.max(0, Math.min(Number(STATE.currentWorkoutEntryIndex || 0), entries.length - 1));
  entries.splice(idx, 1);

  if (!entries.length){
    const completionContext = { outcome: "partial", source: "remove_current_workout_entry" };
    setWorkoutCompletionContext(completionContext);
    const completionStatusText = getWorkoutCompletionStatusText(completionContext);
    if (completionStatusText){
      setText("sessionResultStatus", completionStatusText);
    }
    STATE.workoutInProgress = false;
    STATE.currentWorkoutEntryIndex = 0;
    renderTodayPlan(item);
    showWizardStep("review");
    return;
  }

  if (idx >= entries.length){
    STATE.currentWorkoutEntryIndex = entries.length - 1;
  }

  renderTodayPlan(item);
}

function adjustCurrentWorkoutEntry(item, direction){
  const active = getActiveWorkoutEntry(item);
  if (!active || !active.entry) return;

  const nextDirection = String(direction || "").trim();
  active.entry.manual_intensity_adjustment = nextDirection;
  renderTodayPlan(item);
}

function saveActiveWorkoutEntryProgress(item){
  const active = getActiveWorkoutEntry(item);
  if (!active || !active.entry) return;

  const entry = active.entry;
  const idx = active.index;
  const setCount = Math.max(1, Number(entry.sets || 1));

  const currentSetIndex = getCurrentWorkoutSetIndex(entry);
  const existing = entry._existing_result && typeof entry._existing_result === "object"
    ? entry._existing_result
    : {};
  const existingSets = Array.isArray(existing.sets)
    ? existing.sets.slice(0, setCount).map(setItem => ({
        reps: String(setItem?.reps || "").trim(),
        load: String(setItem?.load || "").trim(),
      }))
    : [];
  const scope = document.getElementById("todayPlanList") || document;

  const meta = getReviewExerciseMeta(entry.exercise_id);
  const inputKind = String(meta?.input_kind || "");
  const isTime = inputKind === "time" || inputKind === "cardio_time";
  const isBodyweight = inputKind === "bodyweight_reps";
  const isCardioEntry = String(item?.session_type || "").trim().toLowerCase() === "løb"
    || String(entry?.exercise_id || "").trim().toLowerCase().startsWith("cardio_");

  if (isCardioEntry){
    entry._existing_result = {
      ...existing,
      notes: scope.querySelector(`[name="review_notes_${idx}"]`)?.value?.trim() || "",
      sets: [],
      achieved_reps: "",
    };
    return;
  }

  while (existingSets.length < setCount){
    existingSets.push({ reps: "", load: "" });
  }

  const repsVal = scope.querySelector(`[name="review_set_reps_${idx}_${currentSetIndex}"]`)?.value?.trim() || "";
  let loadVal = scope.querySelector(`[name="review_set_load_${idx}_${currentSetIndex}"]`)?.value?.trim() || "";
  if (isTime || isBodyweight){
    loadVal = "";
  }

  existingSets[currentSetIndex] = {
    reps: repsVal,
    load: loadVal,
  };

  const nonEmptySets = existingSets.filter(x => x.reps || x.load);
  entry._existing_result = {
    ...existing,
    achieved_reps: nonEmptySets[0]?.reps || "",
    sets: existingSets,
    hit_failure: String(scope.querySelector(`[name="review_hit_failure_${idx}"]`)?.value || "false") === "true",
    notes: scope.querySelector(`[name="review_notes_${idx}"]`)?.value?.trim() || "",
  };
}

function getGuidedWorkoutPlayerLabels({ idx, total, exerciseName, actionText, setProgressLabel }){
  return {
    progressLabel: tr("workout.active_progress", { current: String(idx + 1), total: String(total) }),
    exerciseName: exerciseName || "",
    actionText: actionText || "",
    setProgressLabel: setProgressLabel || "",
  };
}

function getGuidedWorkoutPlayerPrimaryActionLabel({ mode, restDone = false, isNextExerciseRest = false, hasMoreSetsRemaining = false, isLast = false }){
  if (mode === "rest"){
    if (!restDone) return tr("button.skip_rest");
    return tr(isNextExerciseRest ? "button.start_next_exercise" : "button.start_next_set");
  }

  if (mode === "active"){
    if (hasMoreSetsRemaining) return tr("button.next_set");
    return tr(isLast ? "button.finish_workout" : "button.next_exercise");
  }

  return "";
}


function getGuidedWorkoutPlayerPhaseLabel({ mode, restDone = false }){
  if (mode === "rest"){
    return restDone ? tr("common.ready") : tr("workout.rest.resting");
  }

  if (mode === "active"){
    return tr("button.start_workout");
  }

  return "";
}

function renderWorkoutRestState(item, active){
  const root = document.getElementById("todayPlanList");
  if (!root) return;

  const entry = active.entry;
  const idx = active.index;
  const total = active.total;
  const entries = Array.isArray(item?.entries) ? item.entries : [];
  const remainingSec = getRemainingWorkoutRestSeconds();
  const restDone = remainingSec <= 0;
  const targetKind = String(STATE.workoutRestTargetKind || "").trim();
  const nextEntryIndex = Number(STATE.workoutRestNextEntryIndex);
  const nextEntry = nextEntryIndex >= 0 && nextEntryIndex < entries.length ? entries[nextEntryIndex] : null;
  const isNextExerciseRest = targetKind === "next_exercise";

  const statusLabel = restDone
    ? tr(isNextExerciseRest ? "workout.rest.ready_next_exercise" : "workout.rest.ready_next_set")
    : tr("workout.rest.resting");
  const phaseLabel = getGuidedWorkoutPlayerPhaseLabel({
    mode: "rest",
    restDone,
  });

  const primaryActionLabel = getGuidedWorkoutPlayerPrimaryActionLabel({
    mode: "rest",
    restDone,
    isNextExerciseRest,
  });

  const nextExerciseLabel = isNextExerciseRest && nextEntry
    ? `<div class="small" style="margin-bottom:8px">${esc(tr("workout.rest.next_exercise_label"))}</div>`
    : "";
  const nextAfterRestLabel = isNextExerciseRest
    ? tr("workout.rest.after_rest_next_exercise")
    : tr("workout.rest.after_rest_next_set");
  const timedTransitionLabel = STATE.workoutTimedTransitionState === "hold_completed"
    ? tr("workout.timed_transition_label")
    : "";

  const setProgressLabel = isNextExerciseRest && nextEntry
    ? tr("workout.set_progress", { current: "1", total: String(getWorkoutPlannedSetCount(nextEntry)) })
    : tr("workout.set_progress", { current: String(getCurrentWorkoutSetIndex(entry) + 1), total: String(getWorkoutPlannedSetCount(entry)) });

  const exerciseName = isNextExerciseRest && nextEntry
    ? formatExerciseName(nextEntry.exercise_id)
    : formatExerciseName(entry.exercise_id);

  const actionText = isNextExerciseRest && nextEntry
    ? formatPlanActionText(nextEntry)
    : formatPlanActionText(entry);

  const playerLabels = getGuidedWorkoutPlayerLabels({
    idx,
    total,
    exerciseName,
    actionText,
    setProgressLabel,
  });

    const shellBackground = restDone ? "#0f1f14" : "#1c1710";
    const shellBorder = restDone ? "1px solid rgba(87, 214, 116, 0.32)" : "1px solid rgba(224, 170, 73, 0.26)";
    const statusColor = restDone ? "#8ff0a4" : "#f3c96b";
    const timerColor = restDone ? "#b8ffcb" : "#ffd88a";
    const progressOpacity = restDone ? "0.86" : "0.8";
  root.innerHTML = `
      <li style="padding:20px 16px 28px 16px; min-height:62vh; display:flex; flex-direction:column; justify-content:center; border-radius:20px; background:${shellBackground}; border:${shellBorder}; box-shadow:0 18px 48px rgba(0,0,0,0.28)">
        <div style="font-size:0.82rem; opacity:${progressOpacity}; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.08em">${esc(phaseLabel)}</div>\n        <div style="font-size:0.95rem; opacity:${progressOpacity}; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.04em">\n        ${esc(playerLabels.progressLabel)}\n      </div>
      ${nextExerciseLabel}
      <div style="font-size:1.05rem; font-weight:700; margin-bottom:10px">${esc(playerLabels.setProgressLabel)}</div>
      ${timedTransitionLabel ? `<div class="small" style="margin-bottom:8px; opacity:0.86">${esc(timedTransitionLabel)}</div>` : ""}
      <div class="small" style="margin-bottom:8px; opacity:0.8">${esc(nextAfterRestLabel)}</div>
      <div style="font-weight:800; font-size:2rem; line-height:1.1; margin-bottom:12px">${esc(playerLabels.exerciseName)}</div>
        <div style="font-weight:700; font-size:1.05rem; margin-bottom:12px; color:${statusColor}">${esc(statusLabel)}</div>
        <div style="font-size:3.2rem; line-height:1; font-weight:800; color:${timerColor}; margin:8px 0 18px 0">${esc(String(remainingSec))}<span style="font-size:1.2rem; font-weight:700; opacity:0.78"> s</span></div>
      <div class="small" style="line-height:1.5; margin-bottom:18px; opacity:0.78">
        ${esc(playerLabels.actionText)}
      </div>
      <div style="margin-top:auto; display:flex; gap:10px; flex-wrap:wrap">
        <button type="button" id="resumeWorkoutRestBtn" style="padding:16px 18px; font-size:1.05rem; font-weight:700; width:100%">${esc(primaryActionLabel)}</button>\n        ${!restDone ? `<button type="button" id="addWorkoutRestBtn" class="secondary" style="width:100%; padding:14px 16px; font-size:0.98rem">${esc(tr("button.add_extra_rest"))}</button>` : ""}
      </div>
    </li>
  `;

  document.getElementById("resumeWorkoutRestBtn")?.addEventListener("click", () => {
    clearWorkoutRestTimer();
    STATE.workoutTimedTransitionState = "";
    if (isNextExerciseRest && nextEntryIndex >= 0){
      STATE.currentWorkoutEntryIndex = nextEntryIndex;
      STATE.currentWorkoutSetIndex = 0;
    }
    renderTodayPlan(item);
  });

  document.getElementById("addWorkoutRestBtn")?.addEventListener("click", () => {
    if (restDone) return;
    STATE.workoutRestTimerEndsAt = Number(STATE.workoutRestTimerEndsAt || 0) + (30 * 1000);
    renderTodayPlan(item);
  });

  if (restDone && STATE.workoutTimedTransitionState === "hold_completed"){
    STATE.workoutTimedTransitionState = "";
  }

  if (STATE.workoutRestTimerActive){
    const runtimeNonce = Number(STATE.workoutRuntimeNonce || 0);
    window.clearTimeout(window.__ssWorkoutRestTick || 0);
    if (!restDone){
      window.__ssWorkoutRestTick = window.setTimeout(() => {
        if (Number(STATE.workoutRuntimeNonce || 0) !== runtimeNonce) return;
        renderTodayPlan(item);
      }, 1000);
    }
  }
}

function getIntervalProtocolRuntimeState(entry){
  const protocol = entry?.protocol && typeof entry.protocol === "object" ? entry.protocol : {};
  const prepEndsAt = Number(entry?._protocol_prep_ends_at || 0);
  const workEndsAt = Number(entry?._protocol_work_ends_at || 0);
  const restEndsAt = Number(entry?._protocol_rest_ends_at || 0);
  const prepRemainingSec = prepEndsAt ? Math.max(0, Math.ceil((prepEndsAt - Date.now()) / 1000)) : 0;
  const workRemainingSec = workEndsAt ? Math.max(0, Math.ceil((workEndsAt - Date.now()) / 1000)) : 0;
  const restRemainingSec = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000)) : 0;
  const rounds = Math.max(1, Number(protocol.rounds || 1));
  const currentRound = Math.max(1, Number(entry?._protocol_current_round || 1));

  return {
    rounds,
    currentRound: Math.min(currentRound, rounds),
    workSec: Math.max(0, Number(protocol.work_sec || 0)),
    restSec: Math.max(0, Number(protocol.rest_sec || 0)),
    prepRemainingSec,
    workRemainingSec,
    restRemainingSec,
    isPrepRunning: prepRemainingSec > 0,
    isWorkRunning: workRemainingSec > 0,
    isRestRunning: restRemainingSec > 0,
    isReadyToStartWork: prepEndsAt > 0 && prepRemainingSec <= 0 && workEndsAt <= 0,
    isReadyToCompleteWork: workEndsAt > 0 && workRemainingSec <= 0,
    isReadyToAdvanceRound: restEndsAt > 0 && restRemainingSec <= 0,
  };
}

function startIntervalProtocolPrep(entry, durationSec = 5){
  if (!entry || typeof entry !== "object") return 0;
  const prepSec = Math.max(1, Number(durationSec || 5));
  delete entry._protocol_work_ends_at;
  delete entry._protocol_rest_ends_at;
  entry._protocol_current_round = Math.max(1, Number(entry?._protocol_current_round || 1));
  entry._protocol_prep_ends_at = Date.now() + (prepSec * 1000);
  return prepSec;
}

function startIntervalProtocolWork(entry){
  if (!entry || typeof entry !== "object") return 0;
  const protocol = entry?.protocol && typeof entry.protocol === "object" ? entry.protocol : {};
  const workSec = Math.max(1, Number(protocol.work_sec || 1));
  delete entry._protocol_prep_ends_at;
  delete entry._protocol_rest_ends_at;
  entry._protocol_work_ends_at = Date.now() + (workSec * 1000);
  return workSec;
}

function startIntervalProtocolRest(entry){
  if (!entry || typeof entry !== "object") return 0;
  const protocol = entry?.protocol && typeof entry.protocol === "object" ? entry.protocol : {};
  const restSec = Math.max(1, Number(protocol.rest_sec || 1));
  delete entry._protocol_work_ends_at;
  entry._protocol_rest_ends_at = Date.now() + (restSec * 1000);
  return restSec;
}


function clearIntervalProtocolRuntime(entry){
  if (!entry || typeof entry !== "object") return;
  delete entry._protocol_prep_ends_at;
  delete entry._protocol_work_ends_at;
  delete entry._protocol_rest_ends_at;
  delete entry._protocol_current_round;
}

function ensureIntervalProtocolTick(item){
  window.clearTimeout(window.__ssWorkoutProtocolTick || 0);
  const runtimeNonce = Number(STATE.workoutRuntimeNonce || 0);
  const active = getActiveWorkoutEntry(item);
  const entry = active?.entry;
  if (!entry || String(entry?.protocol_mode || "").trim() !== "interval") return;

  const protocolState = getIntervalProtocolRuntimeState(entry);
  if (protocolState.isPrepRunning || protocolState.isWorkRunning || protocolState.isRestRunning){
    window.__ssWorkoutProtocolTick = window.setTimeout(() => {
      if (Number(STATE.workoutRuntimeNonce || 0) !== runtimeNonce) return;
      renderTodayPlan(item);
    }, 1000);
    return;
  }

  if (protocolState.isReadyToStartWork){
    startIntervalProtocolWork(entry);
    window.__ssWorkoutProtocolTick = window.setTimeout(() => {
      if (Number(STATE.workoutRuntimeNonce || 0) !== runtimeNonce) return;
      renderTodayPlan(item);
    }, 50);
    return;
  }

  if (protocolState.isReadyToCompleteWork){
    if (protocolState.currentRound >= protocolState.rounds){
      clearIntervalProtocolRuntime(entry);
      finishActiveWorkoutAndOpenReview(item, { outcome: "completed", source: "interval_protocol_complete" });
      setText("sessionResultStatus", tr("workout.protocol_complete_status"));
      return;
    }
    startIntervalProtocolRest(entry);
    window.__ssWorkoutProtocolTick = window.setTimeout(() => {
      if (Number(STATE.workoutRuntimeNonce || 0) !== runtimeNonce) return;
      renderTodayPlan(item);
    }, 50);
    return;
  }

  if (protocolState.isReadyToAdvanceRound){
    delete entry._protocol_rest_ends_at;
    entry._protocol_current_round = Math.min(protocolState.rounds, protocolState.currentRound + 1);
    startIntervalProtocolWork(entry);
    window.__ssWorkoutProtocolTick = window.setTimeout(() => {
      if (Number(STATE.workoutRuntimeNonce || 0) !== runtimeNonce) return;
      renderTodayPlan(item);
    }, 50);
  }
}

function renderIntervalProtocolPlaceholder(item, progress){
  const root = document.getElementById("todayPlanList");
  if (!root || !progress || !progress.entry) return;

  const entry = progress.entry;
  const protocolState = getIntervalProtocolRuntimeState(entry);
  const rounds = protocolState.rounds;
  const currentRound = protocolState.currentRound;
  const workSec = protocolState.workSec;
  const restSec = protocolState.restSec;
  const exerciseName = formatExerciseName(entry.exercise_id || "");
  const protocolVariant = String(entry?.protocol_variant || "").trim().toLowerCase();
  const protocolVariantLabel = protocolVariant === "on_off" ? tr("workout.protocol_variant_on_off") : "";
  const currentPhaseLabel = protocolState.isWorkRunning
    ? tr("workout.protocol_phase_work")
    : (protocolState.isRestRunning ? tr("workout.protocol_phase_rest") : tr("workout.hold_get_ready"));
  const displaySeconds = protocolState.isWorkRunning
    ? protocolState.workRemainingSec
    : (protocolState.isRestRunning ? protocolState.restRemainingSec : (protocolState.isPrepRunning ? protocolState.prepRemainingSec : 5));
  const timerColor = protocolState.isWorkRunning ? "#8ff0a4;" : (protocolState.isRestRunning ? "#ffd88a;" : "#ffd88a;");
  const protocolSummary = [
    tr("workout.protocol_round_progress_label", { current: String(currentRound), total: String(rounds) }),
    workSec > 0 ? tr("workout.protocol_work_label", { value: String(workSec) }) : "",
    restSec > 0 ? tr("workout.protocol_rest_label", { value: String(restSec) }) : "",
  ].filter(Boolean).join(" · ");

  root.innerHTML = `
    <li style="padding:20px 16px 28px 16px; min-height:62vh; display:flex; flex-direction:column; justify-content:center; border-radius:20px; background:#101722; border:1px solid rgba(86, 145, 255, 0.28); box-shadow:0 18px 48px rgba(0,0,0,0.28)">
      <div style="font-size:0.82rem; opacity:0.82; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.08em">${esc(tr("workout.protocol_mode_label"))}</div>
      <div style="font-size:0.95rem; opacity:0.82; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.04em">${esc(tr("workout.protocol_placeholder_title"))}</div>
      <div style="font-weight:800; font-size:2rem; line-height:1.1; margin-bottom:12px">${esc(exerciseName)}</div>
      ${protocolVariantLabel ? `<div class="small" style="margin-bottom:10px; opacity:0.74">${esc(protocolVariantLabel)}</div>` : ""}
      ${protocolSummary ? `<div class="small" style="margin-bottom:12px; line-height:1.45; opacity:0.8">${esc(protocolSummary)}</div>` : ""}
      <div class="small" style="margin-bottom:8px; opacity:0.82; text-transform:uppercase; letter-spacing:0.08em">${esc(currentPhaseLabel)}</div>
      <div style="font-size:3.2rem; line-height:1; font-weight:800; color:${timerColor.replace(";", "")}; margin:8px 0 14px 0">${esc(String(displaySeconds))}<span style="font-size:1.2rem; font-weight:700; opacity:0.78"> s</span></div>
      <div class="small" style="line-height:1.5; margin-bottom:18px; opacity:0.78">${esc(protocolState.isWorkRunning ? tr("workout.protocol_next_phase_rest") : (protocolState.isRestRunning ? tr("workout.protocol_next_phase_work") : tr("workout.protocol_next_phase_work")))}</div>
      <div style="margin-top:auto; display:flex; gap:10px; flex-wrap:wrap">
        ${(!protocolState.isPrepRunning && !protocolState.isWorkRunning && !protocolState.isRestRunning) ? `<button type="button" id="startProtocolPlaceholderBtn" class="secondary" style="width:100%; padding:14px 16px; font-size:0.98rem">${esc(tr("button.start_workout"))}</button>` : ""}
      </div>
    </li>
  `;

  document.getElementById("startProtocolPlaceholderBtn")?.addEventListener("click", () => {
    entry._protocol_current_round = 1;
    startIntervalProtocolPrep(entry, 5);
    renderTodayPlan(item);
  });

  ensureIntervalProtocolTick(item);
}

function renderActiveWorkoutCard(item){
  const root = document.getElementById("todayPlanList");
  if (!root) return;

  const progress = getActiveWorkoutProgressState(item);
  if (!progress || !progress.entry){
    STATE.workoutInProgress = false;
    STATE.currentWorkoutEntryIndex = 0;
    showWizardStep("review");
    return;
  }

  if (isWorkoutRestState()){
    renderWorkoutRestState(item, progress.active);
    return;
  }

  const { active, entry, idx, total, isLast, plannedSetCount, currentSetIndex, hasMoreSetsRemaining } = progress;
  if (String(entry?.protocol_mode || "").trim() === "interval"){
    renderIntervalProtocolPlaceholder(item, progress);
    return;
  }
  const extras = formatPlanProgressionExtra(entry);
  const meta = getReviewExerciseMeta(entry.exercise_id);
  const inputKind = String(meta?.input_kind || "");
  const isTime = inputKind === "time" || inputKind === "cardio_time";
  const isBodyweight = inputKind === "bodyweight_reps";
  const isCardioEntry = String(item?.session_type || "").trim().toLowerCase() === "løb"
    || String(entry?.exercise_id || "").trim().toLowerCase().startsWith("cardio_");

  let loggingHtml = "";
  if (isCardioEntry){
    loggingHtml = `
      <label style="display:block; margin-top:12px">
        ${esc(tr("after_training.session_note_label"))}
        <input type="text" name="review_notes_${idx}" value="${esc(String(entry?._existing_result?.notes || ""))}" placeholder="${esc(tr("after_training.short_note_placeholder_cardio"))}">
      </label>
    `;
  } else {
      const existingSets = Array.isArray(entry?._existing_result?.sets) ? entry._existing_result.sets : [];
    const setFields = Array.from({length: plannedSetCount}, (_, setIdx) => {
      const completed = Boolean(existingSets[setIdx]?.reps || existingSets[setIdx]?.load);
      if (setIdx < currentSetIndex){
        const summaryBits = [];
        if (isTime){
          if (existingSets[setIdx]?.reps) summaryBits.push(`${tr("input_kind.time")}: ${esc(existingSets[setIdx].reps)} sek`);
        } else {
          if (existingSets[setIdx]?.reps) summaryBits.push(`${tr("exercise.target_label", { value: esc(existingSets[setIdx].reps) })}`);
          if (existingSets[setIdx]?.load) summaryBits.push(esc(existingSets[setIdx].load));
        }
        return `
          <div class="card" style="margin-top:8px; padding:10px 12px; border-radius:18px; background:rgba(74,222,128,0.08); border:1px solid rgba(74,222,128,0.22)">
            <div class="small" style="margin-bottom:6px; opacity:0.82">${tr("exercise.set_label", { number: setIdx + 1 })}</div>
            <div style="font-weight:700">${esc(tr("common.done"))}</div>
            ${summaryBits.length ? `<div class="small" style="margin-top:6px; opacity:0.8">${summaryBits.join(" · ")}</div>` : ""}
          </div>
        `;
      }
      if (setIdx > currentSetIndex){
        return `
          <div class="card" style="margin-top:8px; padding:10px 12px; border-radius:18px; background:rgba(255,255,255,0.03)">
            <div class="small" style="margin-bottom:6px; opacity:0.82">${tr("exercise.set_label", { number: setIdx + 1 })}</div>
            <div class="small" style="opacity:0.72">${esc(tr("workout.waiting_for_previous_set"))}</div>
          </div>
        `;
      }
      return buildWorkoutSetFields(entry, idx, setIdx);
    }).join("");
    loggingHtml = `
      <div style="margin-top:12px">
        ${setFields}
      </div>
      <label>
        ${esc(tr("exercise.note_label"))}
        <input type="text" name="review_notes_${idx}" value="${esc(String(entry?._existing_result?.notes || ""))}" placeholder="${esc(tr("exercise.note_placeholder_example"))}">
      </label>
    `;
  }

    const nextActionLabel = getGuidedWorkoutPlayerPrimaryActionLabel({
      mode: "active",
      hasMoreSetsRemaining,
      isLast,
    });

    const playerLabels = getGuidedWorkoutPlayerLabels({
      idx,
      total,
      exerciseName: formatExerciseName(entry.exercise_id),
      actionText: formatPlanActionText(entry),
      setProgressLabel: !isCardioEntry
        ? tr("workout.set_progress", { current: String(currentSetIndex + 1), total: String(plannedSetCount) })
        : "",
    });
  const phaseLabel = getGuidedWorkoutPlayerPhaseLabel({
    mode: "active",
  });
  const activeShellBackground = "#101722";
      const activeShellBorder = "1px solid rgba(86, 145, 255, 0.28)";
      const actionColor = "#bcd3ff";
    root.innerHTML = `
        <li style="padding:20px 16px 28px 16px; min-height:62vh; display:flex; flex-direction:column; justify-content:flex-start; border-radius:20px; background:${activeShellBackground}; border:${activeShellBorder}; box-shadow:0 18px 48px rgba(0,0,0,0.28)">
          <div style="font-size:0.82rem; opacity:0.82; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.08em">${esc(phaseLabel)}</div>
          <div style="font-size:0.95rem; opacity:0.82; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.04em">
          ${esc(playerLabels.progressLabel)}
        </div>
        ${!isCardioEntry ? `<div style="font-size:1.05rem; font-weight:700; margin-bottom:10px">${esc(playerLabels.setProgressLabel)}</div>` : ""}
        <div style="font-weight:800; font-size:2rem; line-height:1.1; margin-bottom:12px">
          ${esc(playerLabels.exerciseName)}
        </div>
          <div style="font-weight:700; font-size:1.05rem; margin-bottom:12px; color:${actionColor}">
          ${esc(playerLabels.actionText)}
        </div>
          <div class="small" style="line-height:1.5; margin-bottom:14px; opacity:0.8">
          ${entry.sets ? tr("exercise.sets_count", { count: esc(entry.sets) }) : ""}
          ${entry.target_reps ? `${entry.sets ? " · " : ""}${tr("exercise.target_label", { value: formatTarget(entry.target_reps) })}` : ""}
          ${entry.target_load ? ` · ${esc(entry.target_load)}` : ""}
        </div>
          ${extras.length ? `<div class="small" style="margin-bottom:14px; line-height:1.45; opacity:0.74">${extras.map(x => esc(x)).join("<br>")}</div>` : ""}
          ${entry.equipment_constraint ? `<div class="small" style="margin-bottom:14px; opacity:0.74">${esc(tr("today_plan.equipment_constraint_note"))}</div>` : ""}
        <div style="margin-bottom:18px">${loggingHtml}</div>
        <div style="margin-top:auto; display:flex; gap:10px; flex-wrap:wrap">
          <button type="button" id="nextWorkoutEntryBtn" style="padding:18px 18px; font-size:1.1rem; font-weight:800; width:100%">${esc(nextActionLabel)}</button>
          <button type="button" id="finishWorkoutEarlyBtn" class="secondary" style="width:100%; padding:14px 16px; font-size:0.98rem">${esc(tr("button.finish_workout"))}</button>
          <button type="button" class="secondary" data-exercise-viewer="${esc(entry.exercise_id || "")}" style="width:100%; padding:14px 16px; font-size:0.98rem">${esc(tr("button.view_exercise"))}</button>
        </div>
      </li>
    `;
      wireWorkoutRepChoiceButtons(root);

      root.querySelector('[data-start-hold-timer]')?.addEventListener("click", (ev) => {
        ev.preventDefault();
        if (isTimedHoldWorkoutEntry(entry) && getTimedHoldRemainingSeconds(entry) <= 0 && getTimedHoldPrepRemainingSeconds(entry) <= 0){
          startTimedHoldPrep(entry, 5);
          renderTodayPlan(item);
        }
      });

      root.querySelector('[data-stop-hold-timer]')?.addEventListener("click", (ev) => {
        ev.preventDefault();
        if (isTimedHoldWorkoutEntry(entry)){
          const hidden = root.querySelector(`[name="review_set_reps_${idx}_${currentSetIndex}"]`);
          const failSelect = root.querySelector(`[name="review_set_hit_failure_${idx}_${currentSetIndex}"]`);
          const targetSec = Number(entry?._active_hold_timer_target_sec || getTimedHoldTargetSeconds(entry) || 0);
          const remainingSec = getTimedHoldRemainingSeconds(entry);
          const completedSec = remainingSec > 0 ? Math.max(1, targetSec - remainingSec) : targetSec;
          const hitFailure = completedSec < targetSec;
          if (hidden) hidden.value = String(completedSec);
          if (failSelect) failSelect.value = hitFailure ? "true" : "false";
          clearTimedHoldTimer(entry);
          clearTimedHoldTick();
          saveActiveWorkoutEntryProgress(item);

          advanceActiveWorkoutAfterCompletedSet(item, idx, currentSetIndex, hasMoreSetsRemaining);
        }
      });

      ensureTimedHoldTick(item);

      document.getElementById("nextWorkoutEntryBtn")?.addEventListener("click", () => {
        if (isTimedHoldWorkoutEntry(entry) && (getTimedHoldRemainingSeconds(entry) > 0 || getTimedHoldPrepRemainingSeconds(entry) > 0)){
          return;
        }

        saveActiveWorkoutEntryProgress(item);

        advanceActiveWorkoutAfterCompletedSet(item, idx, currentSetIndex, hasMoreSetsRemaining && !isCardioEntry);
      });

      document.getElementById("finishWorkoutEarlyBtn")?.addEventListener("click", () => {
        if (isTimedHoldWorkoutEntry(entry) && (getTimedHoldRemainingSeconds(entry) > 0 || getTimedHoldPrepRemainingSeconds(entry) > 0)){
          return;
        }

        saveActiveWorkoutEntryProgress(item);
        finishActiveWorkoutAndOpenReview(item, { outcome: "ended_early", source: "finish_workout_early_button" });
      });
}

async function applyRecommendedStrengthProgram(programId){
  const recommendedProgramId = String(programId || "").trim();
  if (!recommendedProgramId) return;

  const currentSettings = STATE.userSettings && typeof STATE.userSettings === "object" ? STATE.userSettings : {};
  const currentPreferences = currentSettings.preferences && typeof currentSettings.preferences === "object"
    ? currentSettings.preferences
    : {};
  const currentOverrides = currentPreferences.active_program_overrides && typeof currentPreferences.active_program_overrides === "object"
    ? currentPreferences.active_program_overrides
    : {};

  const nextPreferences = {
    ...currentPreferences,
    active_program_overrides: {
      ...currentOverrides,
      strength: recommendedProgramId,
    },
  };

  const payload = {
    ...currentSettings,
    preferences: nextPreferences,
  };

  const res = await apiPost("/api/user-settings", payload);
  STATE.userSettings = res?.item && typeof res.item === "object" ? res.item : payload;

  const todayPlanRes = await apiGet("/api/today-plan");
  STATE.currentTodayPlan = todayPlanRes?.item || null;

  renderProfileEquipmentCard();
  renderTodayPlan(STATE.currentTodayPlan || null);
}

function resetWorkoutRuntimeState(item){
  STATE.workoutRuntimeNonce = Number(STATE.workoutRuntimeNonce || 0) + 1;
  STATE.currentWorkoutEntryIndex = 0;
  STATE.currentWorkoutSetIndex = 0;
  clearWorkoutRuntimeArtifacts(item);
}

function wireTodayPlanActions(item){
  document.getElementById("startWorkoutBtn")?.addEventListener("click", () => {
    resetWorkoutRuntimeState(item);
    STATE.workoutInProgress = true;
    renderTodayPlan(item);
    showWizardStep("plan");
  });

  document.getElementById("startRestitutionBtn")?.addEventListener("click", () => {
    resetWorkoutRuntimeState(item);
    STATE.workoutInProgress = true;
    renderTodayPlan(item);
    showWizardStep("plan");
  });

  document.getElementById("acknowledgeRestDayBtn")?.addEventListener("click", handleRestDayAcknowledge);
  document.getElementById("openManualTrainingBtn")?.addEventListener("click", () => {
    STATE.manualWorkoutActsAsTodayOverride = true;
    showWizardStep("manual");
  });

  document.getElementById("returnToAutoplanBtn")?.addEventListener("click", async () => {
    const todayDate = String(STATE.latestCheckin?.date || item?.date || "").trim();
    if (!todayDate) return;
    if (!window.confirm(tr("today_plan.return_to_autoplan_confirm"))){
      return;
    }

    const overrideWorkoutIds = (Array.isArray(STATE.workouts) ? STATE.workouts : [])
      .filter(workout =>
        workout
        && String(workout.date || "").trim() === todayDate
        && workout.is_manual_override === true
      )
      .map(workout => String(workout.id || "").trim())
      .filter(Boolean);

    for (const workoutId of overrideWorkoutIds){
      await apiJsonRequest("DELETE", `/api/workouts/${encodeURIComponent(workoutId)}`);
    }

    STATE.manualWorkoutActsAsTodayOverride = false;
    await refreshAll();
    showWizardStep("plan");
  });

  document.querySelectorAll("[data-apply-recommended-strength-program]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const programId = String(btn.getAttribute("data-apply-recommended-strength-program") || "").trim();
      if (!programId) return;
      await applyRecommendedStrengthProgram(programId);
    });
  });

  document.querySelectorAll("[data-plan-entry-easier]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = Number(btn.getAttribute("data-plan-entry-easier"));
      await adjustPlanEntryAtIndex(item, idx, "easier");
    });
  });

  document.querySelectorAll("[data-plan-entry-harder]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = Number(btn.getAttribute("data-plan-entry-harder"));
      await adjustPlanEntryAtIndex(item, idx, "harder");
    });
  });

  document.querySelectorAll("[data-plan-entry-remove]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-plan-entry-remove"));
      if (!window.confirm(tr("workout.remove_current_confirm"))){
        return;
      }
      removePlanEntryByIndex(item, idx);
    });
  });
}

function buildTodayPlanEntryCardsHtml(item, isPlannedRestDay){
  if (isPlannedRestDay){
    return `
      <li>
        <div class="small" style="line-height:1.5">
          ${esc(tr("today_plan.rest_day_entries_hidden"))}
        </div>
      </li>
    `;
  }

  return item.entries.map((entry, index) => {
    const extras = formatPlanProgressionExtra(entry);
    const tone = getPlanEntryTone(entry);
    return `
      <li style="padding:12px; border-radius:14px; ${tone.style}">
        <div class="row">
          <strong>${esc(formatExerciseName(entry.exercise_id))}</strong>
          <span class="small">${esc(formatPlanEntryBadge(entry))}</span>
        </div>
        <div style="margin-top:6px; font-weight:600">${esc(formatPlanActionText(entry))}</div>
        <div class="small">
          ${!(String(entry.exercise_id || "").trim().toLowerCase().startsWith("cardio_") || String(entry.exercise_id || "").trim().toLowerCase() === "cardio_session") && entry.sets ? tr("exercise.sets_count", { count: esc(entry.sets) }) : ""}
          ${entry.target_reps ? `${!(String(entry.exercise_id || "").trim().toLowerCase().startsWith("cardio_") || String(entry.exercise_id || "").trim().toLowerCase() === "cardio_session") && entry.sets ? " · " : ""}${tr("exercise.target_label", { value: formatTarget(entry.target_reps) })}` : ""}
        </div>
        ${extras.map(x => `<div class="small" style="margin-top:6px">${esc(x)}</div>`).join("")}
        <div class="small" style="margin-top:8px; opacity:0.78">${esc(tr("today_plan.local_adjustment_scope_help"))}</div>
        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap">
          <button type="button" class="secondary" data-exercise-viewer="${esc(entry.exercise_id || "")}" style="width:auto;padding:8px 12px">${esc(tr("button.view_exercise"))}</button>
          <button type="button" class="secondary" data-plan-entry-easier="${esc(String(index))}" style="width:auto;padding:8px 12px">${esc(tr("button.make_easier"))}</button>
          <button type="button" class="secondary" data-plan-entry-harder="${esc(String(index))}" style="width:auto;padding:8px 12px">${esc(tr("button.make_harder"))}</button>
          <button type="button" class="secondary" data-plan-entry-remove="${esc(String(index))}" style="width:auto;padding:8px 12px">${esc(tr("button.remove_exercise"))}</button>
        </div>
        ${entry.equipment_constraint ? `<div class="small" style="margin-top:6px">${esc(tr("today_plan.equipment_constraint_note"))}</div>` : ""}
      </li>
    `;
  }).join("");
}

function buildTodayPlanProgramRecommendationCardHtml(item){
  const guidance = item?.next_guidance && typeof item.next_guidance === "object"
    ? item.next_guidance
    : null;
  if (!guidance || guidance.kind !== "program_switch_recommendation") return "";

  const recommendedProgramId = String(guidance.recommended_program_id || "").trim();
  if (!recommendedProgramId) return "";

  const found = Array.isArray(STATE.programs)
    ? STATE.programs.find(program => String(program?.id || "").trim() === recommendedProgramId)
    : null;
  const recommendedProgramName = found ? getProgramDisplayName(found) : recommendedProgramId;
  const reason = String(guidance.switch_reason || guidance.message || "").trim();

  return `
    <li>
      <div style="font-weight:700">${esc(tr("today_plan.recommended_program_title"))}</div>
      <div class="small" style="margin-top:8px; line-height:1.45">
        ${esc(tr("today_plan.recommended_strength_program_value", { value: recommendedProgramName }))}
      </div>
      ${reason ? `<div class="small" style="margin-top:8px; line-height:1.45">${esc(reason)}</div>` : ""}
      <div style="margin-top:10px">
        <button type="button" class="secondary" data-apply-recommended-strength-program="${esc(recommendedProgramId)}">
          ${esc(tr("button.switch_to_recommended_program"))}
        </button>
      </div>
    </li>
  `;
}

function buildTodayPlanRecoveryCardHtml(recovery){
  if (!recovery) return "";

  return `
    <li>
      <div class="small" style="font-weight:700">${tr("today_plan.recovery_label", { value: `${formatRecoveryState(recovery.recovery_state || "")}${recovery.recovery_score != null ? ` (${recovery.recovery_score})` : ""}` })}</div>
      ${Array.isArray(recovery.explanation) && recovery.explanation.length ? `<div class="small" style="margin-top:6px; line-height:1.45">${esc(recovery.explanation.map(formatRecoveryExplanationBit).join(" · "))}</div>` : ""}
    </li>
  `;
}

function buildTodayPlanHeroActionsHtml({
  showPlannedRestChoiceCard,
  showRestitutionChoice,
  manualOverrideWorkoutId,
}){
  return showPlannedRestChoiceCard
    ? `
      <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap">
        <button type="button" id="acknowledgeRestDayBtn">${esc(tr("today_plan.acknowledge_rest_day"))}</button>
        ${showRestitutionChoice ? `<button type="button" id="startRestitutionBtn">${esc(tr("button.start_workout"))}</button>` : ""}
        <button type="button" class="secondary" id="openManualTrainingBtn">${esc(tr("wizard.manual"))}</button>
      </div>
    `
    : `
      <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap">
        <button type="button" id="startWorkoutBtn">${esc(tr("button.start_workout"))}</button>
        ${manualOverrideWorkoutId ? `<button type="button" class="secondary" id="returnToAutoplanBtn">${esc(tr("today_plan.return_to_autoplan"))}</button>` : ""}
      </div>
    `;
}

function buildTodayPlanHeroCardHtml({
  heroTitle,
  heroLead,
  heroActions,
  isPlannedRestDay,
  variantLabel,
  timeBudgetMin,
  planContextBits,
  localProtectionExplanation,
}){
  const metaBits = [
    !isPlannedRestDay ? (variantLabel || "") : "",
    timeBudgetMin ? tr("overview.time_today_short", { minutes: timeBudgetMin }) : ""
  ].filter(Boolean);

  const recoveryBit = planContextBits[0] || "";
  const secondaryBits = planContextBits.slice(1);
  const localProtectionText = String(localProtectionExplanation || "").trim();

  return `
    <li>
      <div class="today-plan-hero-title">${esc(heroTitle)}</div>
      ${metaBits.length ? `
        <div class="today-plan-hero-meta">
          ${metaBits.map(bit => `<div class="today-plan-hero-pill small">${esc(bit)}</div>`).join("")}
        </div>
      ` : ""}
      ${heroLead ? `<div class="small today-plan-hero-lead">${esc(heroLead)}</div>` : ""}
      ${recoveryBit ? `<div class="small today-plan-hero-context">${esc(recoveryBit)}</div>` : ""}
      ${secondaryBits.map(bit => `<div class="small today-plan-hero-context">${esc(bit)}</div>`).join("")}
      ${localProtectionText ? `<div class="small today-plan-hero-context" style="margin-top:10px; padding:10px 12px; border-radius:12px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08)"><strong>${esc(tr("today_plan.local_protection_label"))}:</strong> ${esc(localProtectionText)}</div>` : ""}
      ${heroActions}
    </li>
  `;
}

function deriveTodayPlanDisplayState(item){
  const variantLabel = formatPlanVariant(item?.plan_variant || "");
  const recovery = item && item.recovery_state && typeof item.recovery_state === "object" ? item.recovery_state : null;

  const familiesSelectedText = formatFamiliesSelected(item?.families_selected || []);
  const familiesSummary = familiesSelectedText ? tr("plan.selected_families", { value: familiesSelectedText }) : "";

  const todayWeekPlanItem = getTodayWeekPlanItem(item);
  const todayWeekKind = String(todayWeekPlanItem?.kind || "").trim().toLowerCase();
  const actualKind = String(item?.session_type || "").trim().toLowerCase();
  const isManualOverridePlan = String(item?.plan_variant || "").trim() === "manual_override"
    || String(item?.source || "").trim() === "manual_override";
  const isPlannedRestDay = todayWeekKind === "rest" && !isManualOverridePlan;

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

  let nextGuidanceMessage = String(item?.next_guidance?.message || "").trim();
  if (isPlannedRestDay && nextGuidanceMessage){
    const lowered = nextGuidanceMessage.toLowerCase();
    if (
      lowered.includes("i dag er styrke") ||
      lowered.includes("today is strength") ||
      lowered.includes("i dag er restitution") ||
      lowered.includes("today is recovery") ||
      lowered.includes("today is restitution")
    ){
      nextGuidanceMessage = "";
    }
  }

  const shouldSuppressTrainingAllowedSummary =
    Boolean(nextGuidanceMessage) &&
    (
      (todayWeekKind === "rest" && String(item?.session_type || "").trim().toLowerCase() === "restitution") ||
      trainingAllowedSummary === nextGuidanceMessage
    );

  if (shouldSuppressTrainingAllowedSummary){
    trainingAllowedSummary = "";
  }

  const recoveryDaySummary = isPlannedRestDay
    ? tr("plan.rest_day_default_summary")
    : String(item?.session_type || "").trim().toLowerCase() === "restitution"
      ? tr("plan.light_movement_today")
      : "";

  const recoverySummaryText = recovery
    ? tr("today_plan.recovery_label", { value: `${formatRecoveryState(recovery.recovery_state || "")}${recovery.recovery_score != null ? ` (${recovery.recovery_score})` : ""}` })
    : "";
  const recoveryExplanationText = Array.isArray(recovery?.explanation) && recovery.explanation.length
    ? recovery.explanation.map(formatRecoveryExplanationBit).join(" · ")
    : "";

  const decisionTrace = item?.decision_trace && typeof item.decision_trace === "object" ? item.decision_trace : null;
  const planVariantKey = String(item?.plan_variant || "").trim();
  const hasHighImpactOverride = Boolean(
    decisionTrace?.override ||
    planVariantKey === "local_protection_override" ||
    planVariantKey === "menstruation_support_override" ||
    planVariantKey === "reentry_strength"
  );

  const rawReason = String(item?.reason || "").trim();
  const overrideReasonText = rawReason ? formatPlanReason(rawReason) : "";
  const planContextBits = [
    recoverySummaryText,
    recoveryExplanationText,
    ...(hasHighImpactOverride
      ? [
          overrideReasonText ? `${tr("common.why_label")}: ${overrideReasonText}` : "",
          familiesSummary,
        ]
      : [])
  ].filter(Boolean);

  return {
    variantLabel,
    recovery,
    isPlannedRestDay,
    trainingAllowedSummary,
    recoveryDaySummary,
    planContextBits,
  };
}

function renderEmptyTodayPlan(root){
  setText("todayPlanMeta", "");
  setText("todayPlanTiming", tr("today_plan.no_timing_yet"));
  setText("todayPlanSummary", tr("today_plan.no_plan_yet_after_checkin"));
  root.innerHTML = `<li><div class="small">${esc(tr("today_plan.no_plan_yet_help"))}</div></li>`;
  renderReviewSummary(null);
  renderSessionReview(null);
}

function renderInProgressTodayPlan(item){
  setText("todayPlanTiming", "");
  setText("todayPlanSummary", "");
  renderActiveWorkoutCard(item);
  renderReviewSummary(item);
  renderSessionReview(item);
}

function wireTodayPlanSetupAction(){
  document.getElementById("todayPlanOpenSetupBtn")?.addEventListener("click", () => {
    showWizardStep("overview");
    requestAnimationFrame(() => {
      const profileCard = document.getElementById("profileEquipmentCard");
      if (profileCard && typeof profileCard.scrollIntoView === "function"){
        profileCard.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setEquipmentEditorOpen(true);
    });
  });
}

function renderStandardTodayPlan(item, root, displayState){
  const {
    variantLabel,
    isPlannedRestDay,
    trainingAllowedSummary,
    recoveryDaySummary,
    planContextBits,
  } = displayState;

  const isManualOverridePlan = String(item?.plan_variant || "").trim() === "manual_override"
    || String(item?.source || "").trim() === "manual_override";
  const compactSummaryLead = isManualOverridePlan
    ? ""
    : (trainingAllowedSummary || recoveryDaySummary || "");
  setText(
    "todayPlanSummary",
    compactSummaryLead
  );

  const sessionBlocks = getSessionBlocks(item);
  if (sessionBlocks.length > 1){
    setText("todayPlanMeta", tr("session.blocks_count", { count: String(sessionBlocks.length) }));
  }

  const sessionEntries = getSessionEntries(item);
  const hasEntries = sessionEntries.length > 0;
  const isRestitutionPlan = String(item?.session_type || "").trim().toLowerCase() === "restitution";
  const missingTrainingTypes = String(item?.plan_variant || "").trim() === "missing_training_types";
  const showPlannedRestChoiceCard = isPlannedRestDay && !missingTrainingTypes;
  const showRestitutionChoice = showPlannedRestChoiceCard && hasEntries && isRestitutionPlan;

  const heroTitle = missingTrainingTypes
    ? tr("today_plan.missing_training_types_title")
    : showPlannedRestChoiceCard
      ? tr("today_plan.rest_day_title")
      : formatSessionType(item.session_type || "unknown");
  const heroLead = missingTrainingTypes
    ? tr("today_plan.missing_training_types_lead")
    : showPlannedRestChoiceCard
      ? tr("today_plan.rest_day_lead")
      : "";

  const heroActions = missingTrainingTypes
    ? `<div class="btn-row" style="margin-top:10px"><button type="button" id="todayPlanOpenSetupBtn">${esc(tr("today_plan.missing_training_types_cta"))}</button></div>`
    : buildTodayPlanHeroActionsHtml({
        showPlannedRestChoiceCard,
        showRestitutionChoice,
        manualOverrideWorkoutId: String(item?.manual_override_workout_id || "").trim(),
      });

  const heroCard = buildTodayPlanHeroCardHtml({
    heroTitle,
    heroLead,
    heroActions,
    isPlannedRestDay,
    variantLabel,
    timeBudgetMin: item.time_budget_min,
    planContextBits,
    localProtectionExplanation: item?.local_protection_explanation || "",
  });

  const recoveryCard = "";
  const recommendationCard = buildTodayPlanProgramRecommendationCardHtml(item);
  const entryCards = buildTodayPlanEntryCardsHtml(item, isPlannedRestDay);

  root.innerHTML = heroCard + recoveryCard + recommendationCard + entryCards;

  if (missingTrainingTypes){
    wireTodayPlanSetupAction();
  }

  wireTodayPlanActions(item);
}

function renderTodayPlan(item){
  STATE.currentTodayPlan = item || null;
  const root = document.getElementById("todayPlanList");
  if (!root) return;

  if (!item){
    renderEmptyTodayPlan(root);
    return;
  }

    setText("todayPlanMeta", "");
    setText(
      "todayPlanTiming",
      ""
    );

    const displayState = deriveTodayPlanDisplayState(item);

    if (STATE.workoutInProgress){
      renderInProgressTodayPlan(item);
      return;
    }

    renderStandardTodayPlan(item, root, displayState);

  renderReviewSummary(item);
  renderSessionReview(item);
}

function getRunningJourneyCopy(program){
  const item = program && typeof program === "object" ? program : {};
  const pid = String(item.id || "").trim().toLowerCase();
  const kind = String(item.kind || "").trim().toLowerCase();
  const style = String(item.training_style || "").trim().toLowerCase();
  const family = String(item.program_family || "").trim().toLowerCase();
  const tags = Array.isArray(item.tags) ? item.tags.map(x => String(x || "").trim().toLowerCase()) : [];
  const sessions = Array.isArray(item.supported_weekly_sessions) ? item.supported_weekly_sessions.map(x => Number(x) || 0) : [];

  if (pid === "reentry_run_2x") return tr("running_journey.reentry");
  if (pid === "starter_run_2x" || pid === "starter_run_3x_beginner") return tr("running_journey.beginner_start");
  if ((family === "base_run" || style === "base_run_progression") && sessions.includes(3)) return tr("running_journey.base_5k_10k");
  if ((family === "base_run" || style === "base_run_progression") && sessions.includes(4)) return tr("running_journey.base_10k_half");
  if (kind === "hybrid" || kind === "mixed" || style === "hybrid_run_first" || tags.includes("hybrid")) return tr("running_journey.hybrid");

  return "";
}

function getStrengthJourneyCopy(program){
  const item = program && typeof program === "object" ? program : {};
  const role = String(item.program_role || "").trim().toLowerCase();
  const style = String(item.training_style || "").trim().toLowerCase();
  const tags = Array.isArray(item.tags) ? item.tags.map(x => String(x || "").trim().toLowerCase()) : [];
  const equipmentProfiles = Array.isArray(item.equipment_profiles) ? item.equipment_profiles.map(x => String(x || "").trim().toLowerCase()) : [];

  if (role === "reentry") return tr("strength_journey.reentry");
  if (role === "minimal_dose") return tr("strength_journey.minimal_dose");
  if (role === "starter" && equipmentProfiles.includes("minimal_home")) return tr("strength_journey.beginner_home");
  if (role === "starter" && equipmentProfiles.includes("dumbbell_home")) return tr("strength_journey.beginner_home");
  if (role === "starter" && (equipmentProfiles.includes("gym_basic") || equipmentProfiles.includes("full_gym"))) return tr("strength_journey.beginner_gym");
  if (style === "full_body_base" && equipmentProfiles.includes("dumbbell_home")) return tr("strength_journey.base_home");
  if (style === "full_body_base" && (equipmentProfiles.includes("gym_basic") || equipmentProfiles.includes("full_gym"))) return tr("strength_journey.base_gym");
  if (style === "upper_lower_split") return tr("strength_journey.upper_lower");
  if (style === "hybrid_run_first" || tags.includes("run_first")) return tr("strength_journey.hybrid_support");

  return "";
}

function getProgramPathLabels(program){
  const item = program && typeof program === "object" ? program : {};
  const kind = String(item.kind || "").trim().toLowerCase();
  const role = String(item.program_role || "").trim().toLowerCase();
  const levels = Array.isArray(item.recommended_levels) ? item.recommended_levels.map(x => String(x || "").trim().toLowerCase()) : [];
  const equipmentProfiles = Array.isArray(item.equipment_profiles) ? item.equipment_profiles.map(x => String(x || "").trim().toLowerCase()) : [];
  const tags = Array.isArray(item.tags) ? item.tags.map(x => String(x || "").trim().toLowerCase()) : [];
  const labels = [];

  const add = (key) => {
    const value = tr(key);
    if (!value || value === key || labels.includes(value)) return;
    labels.push(value);
  };

  if (kind === "mobility" || kind === "mobilitet") add("program.path_mobility");
  if (kind === "recovery" || kind === "restitution" || kind === "rest") add("program.path_recovery");
  if (kind === "hybrid" || kind === "mixed") add("program.path_hybrid");

  if (equipmentProfiles.includes("minimal_home") || equipmentProfiles.includes("dumbbell_home") || equipmentProfiles.includes("hybrid_home") || tags.includes("home")) {
    add("program.path_home_friendly");
  }

  if (equipmentProfiles.includes("minimal_home") || tags.includes("low_barrier") || tags.includes("minimalist")) {
    add("program.path_low_equipment");
  }

  if (levels.includes("beginner") || role === "starter" || tags.includes("beginner")) {
    add("program.path_beginner_friendly");
  }

  if (role === "reentry" || item.good_for_reentry === true || tags.includes("reentry")) {
    add("program.path_reentry");
  }

  if (tags.includes("simple") || tags.includes("low_barrier") || role === "starter") {
    add("program.path_simple_start");
  }

  return labels.slice(0, 4);
}

function getProgramIdentityLabel(program){
  const item = program && typeof program === "object" ? program : {};
  const role = String(item.program_role || "").trim().toLowerCase();
  const style = String(item.training_style || "").trim().toLowerCase();
  const kind = String(item.kind || "").trim().toLowerCase();

  if (role === "reentry") return tr("program.identity_reentry");
  if (role === "starter" && (kind === "strength" || kind === "styrke")) return tr("program.identity_beginner_entry");
  if (role === "minimal_dose") return tr("program.identity_low_dose");

  if (style === "hybrid_run_first") return tr("program.identity_run_first_hybrid");
  if (style === "full_body_base") return tr("program.identity_base_builder");
  if (style === "full_body_foundation") return tr("program.identity_foundation");
  if (style === "upper_lower_split") return tr("program.identity_upper_lower");
  if (style === "base_run_progression") return tr("program.identity_base_running");
  if (style === "reentry_full_body") return tr("program.identity_reentry");

  return "";
}

function renderPrograms(programs, exercises){
  const root = document.getElementById("programsRoot");
  const searchInput = document.getElementById("libraryProgramSearchInput");
  if (!root) return;

  const exerciseMap = new Map((Array.isArray(exercises) ? exercises : []).map(x => [x.id, x]));

  if (searchInput && searchInput.dataset.boundSearch !== "true"){
    searchInput.dataset.boundSearch = "true";
    searchInput.addEventListener("input", () => {
      CURRENT_LIBRARY_PROGRAM_QUERY = String(searchInput.value || "").trim();
      renderPrograms(programs, exercises);
    });
  }

  if (searchInput && searchInput.value !== CURRENT_LIBRARY_PROGRAM_QUERY){
    searchInput.value = CURRENT_LIBRARY_PROGRAM_QUERY;
  }

  if (!Array.isArray(programs) || programs.length === 0){
    root.innerHTML = `<div class="small">${esc(tr("program.none_yet"))}</div>`;
    setText("programMeta", tr("common.items_count", { count: 0 }));
    return;
  }

  const query = String(CURRENT_LIBRARY_PROGRAM_QUERY || "").trim().toLowerCase();
  const filteredPrograms = programs.filter(program => {
    if (!program || typeof program !== "object") return false;
    if (!query) return true;

    const dayBits = Array.isArray(program.days) ? program.days.flatMap(day => {
      const dayLabel = String(getProgramDayDisplayLabel(day) || "");
      const exerciseBits = Array.isArray(day?.exercises) ? day.exercises.map(ex => {
        const found = exerciseMap.get(ex.exercise_id) || {};
        const display = getExerciseDisplayCopy(found);
        return display.name || formatExerciseName(ex.exercise_id || "") || ex.exercise_id || "";
      }) : [];
      return [dayLabel, ...exerciseBits];
    }) : [];

    const haystack = [
      String(program.id || ""),
      String(getProgramDisplayName(program) || ""),
      String(getProgramKindDisplayLabel(program.kind || "") || ""),
      ...dayBits
    ].join(" ").toLowerCase();

    return haystack.includes(query);
  });

  if (!filteredPrograms.length){
    root.innerHTML = `<div class="small">${esc(tr("library.program_search_empty"))}</div>`;
    setText("programMeta", tr("common.items_count", { count: 0 }));
    return;
  }

  root.innerHTML = filteredPrograms.map(program => {
    const identityLabel = getProgramIdentityLabel(program);
    const pathLabels = getProgramPathLabels(program);
    return `
    <div class="card" style="margin-top:12px; background:#141414">
      <div class="row">
        <h3>${esc(getProgramDisplayName(program) || "Program")}</h3>
        <span class="pill">${esc(getProgramKindDisplayLabel(program.kind || ""))}</span>
      </div>
      ${identityLabel ? `<div class="small" style="margin-top:6px">${esc(identityLabel)}</div>` : ""}
      ${pathLabels.length ? `<div class="row" style="gap:8px; margin-top:8px; flex-wrap:wrap;">${pathLabels.map(label => `<span class="pill">${esc(label)}</span>`).join("")}</div>` : ""}
      ${(program.days || []).map(day => `
        <div class="program-day">
          <strong>${esc(getProgramDayDisplayLabel(day))}</strong>
          <ul style="margin-top:10px">
            ${(day.exercises || []).map(ex => {
              const found = exerciseMap.get(ex.exercise_id) || {};
              const display = getExerciseDisplayCopy(found);
              const name = display.name || formatExerciseName(ex.exercise_id || "") || ex.exercise_id || tr("common.unknown_lower");
              return `
                <li>
                  <div class="row">
                    <strong>${esc(name)}</strong>
                    <span class="small">${tr("exercise.sets_by_reps", { sets: esc(ex.sets ?? ""), reps: esc(formatTarget(String(ex.reps ?? ""))) })}</span>
                  </div>
                </li>
              `;
            }).join("")}
          </ul>
        </div>
      `).join("")}
    </div>
  `;
  }).join("");

  setText("programMeta", tr("common.items_count", { count: filteredPrograms.length }));
}

async function refreshAll(){
  const debug = {};
  const [workoutsFile, runs, recoveryFile, programs, exercises, seedExercises, userSettingsApi, workoutsApi, customWorkoutsApi, recoveryApi, latestRecoveryApi, todayPlanApi, sessionResultsApi] = await Promise.all([
    getJson(FILES.workouts),
    getJson(FILES.runs),
    getJson(FILES.recovery),
    getJsonOrSeed(FILES.programs, FILES.seed_programs),
    getJsonOrSeed(FILES.exercises, FILES.seed_exercises),
    getJson(FILES.seed_exercises).catch(() => []),
    apiGet("/api/user-settings"),
    apiGet("/api/workouts"),
    apiGet("/api/custom-workouts"),
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
  STATE.checkins = Array.isArray(recoveryApi && recoveryApi.items) ? recoveryApi.items : [];
  STATE.workouts = Array.isArray(workoutsApi && workoutsApi.items) ? workoutsApi.items : [];
  STATE.customWorkouts = Array.isArray(customWorkoutsApi && customWorkoutsApi.items) ? customWorkoutsApi.items : [];
  STATE.sessionResults = Array.isArray(sessionResultsApi && sessionResultsApi.items) ? sessionResultsApi.items : [];
  STATE.latestCheckin = latestRecoveryApi.item || null;
  STATE.currentTodayPlan = todayPlanApi.item || null;

  const exerciseCatalogMetadataAudit = auditExerciseCatalogMetadata(STATE.exercises, seedExercises);
  if (exerciseCatalogMetadataAudit.stale_suspected){
    console.warn("Exercise catalog metadata may be stale", exerciseCatalogMetadataAudit);
  }

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
  fillSelect("program_id", visiblePrograms, x => x.id, x => getProgramDisplayName(x), tr("workout.no_program_selected"));

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
  renderExerciseLibrary();
  renderRecovery(recoveryApi.items || []);
  renderReadiness(latestRecoveryApi.item || null);
  renderForecastHero(todayPlanApi.item || null, latestRecoveryApi.item || null);
  renderWeekPlanPreview(todayPlanApi.item || null);
  renderWeeklyRhythmCard(sessionResultsApi.items || [], todayPlanApi.item || null);
  renderOverviewStatus(todayPlanApi.item || null, latestRecoveryApi.item || null, workoutsApi.items || []);
  renderProfileEquipmentCard();
    renderTodayPlan(todayPlanApi.item || null);
  renderPrograms(STATE.programs, STATE.exercises);
  renderLibraryTabs();
  renderManualTemplateOptions();
  renderCustomWorkoutOptions();
  renderPendingEntries();

  const dailyUiState = deriveDailyUiState(todayPlanApi.item || null, latestRecoveryApi.item || null, sessionResultsApi.items || []);

  debug.pendingEntries = STATE.pendingEntries;
  debug.workouts_file = workoutsFile;
  debug.workouts_api = workoutsApi;
  debug.custom_workouts_api = customWorkoutsApi;
  debug.recovery_file = recoveryFile;
  debug.recovery_api = recoveryApi;
  debug.latest_recovery_api = latestRecoveryApi;
  debug.today_plan_api = todayPlanApi;
  debug.session_results_api = sessionResultsApi;
  debug.load_metrics = sessionResultsApi && sessionResultsApi.load_metrics ? sessionResultsApi.load_metrics : null;
  debug.runs = runs;
  debug.programs = programs;
  debug.exercises = exercises;
    debug.exercise_catalog_metadata = exerciseCatalogMetadataAudit;
  debug.user_settings = userSettingsApi && userSettingsApi.item ? userSettingsApi.item : {};
  debug.daily_ui_state = dailyUiState;

  applyBootState("ready", tr("status.frontend_api_ok"));
  setText("debug", JSON.stringify(debug, null, 2));

  return {
    dailyUiState,
    defaultStep: getDefaultWizardStepForDailyState(todayPlanApi.item || null, latestRecoveryApi.item || null, sessionResultsApi.items || [])
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
    setText("progressionHint", tr("workout.no_load_suggestion"));
    return;
  }

  try{
      const meta = getExerciseMeta(exerciseId) || {};
      if (String(meta.input_kind || "") !== "load_reps"){
        setText("progressionHint", meta.input_kind === "time"
          ? tr("manual_workout.time_fixed_choices")
          : tr("manual_workout.bodyweight_no_load_suggestion"));
        return;
      }

      const data = await apiGetProgression(exerciseId);
      if (!data || data.next_load == null){
        setText("progressionHint", tr("workout.no_progression_available"));
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
    setText("progressionHint", tr("workout.progression_fetch_failed"));
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
    setText("entryStatus", tr("workout.select_exercise_first"));
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

function collectLocalCheckinSignals(form){
  if (!form) return [];

  const regionMap = [
    "knee",
    "low_back",
    "shoulder",
    "elbow",
    "hip",
    "ankle_calf",
    "wrist",
  ];

  const signals = [];
  for (const region of regionMap){
    const raw = form[`local_signal_${region}`]?.value;
    const signal = String(raw || "").trim().toLowerCase();
    if (!signal) continue;
    signals.push({ region, signal });
  }
  return signals;
}

async function handleLoadProgramDay(){
  const program = getSelectedProgram();
  const daySelect = document.getElementById("program_day_idx");
  const statusEl = document.getElementById("programLoadStatus");

  if (!program){
    setText("programLoadStatus", tr("workout.select_program_first"));
    statusEl?.classList.add("warn");
    return;
  }

  const idx = Number(daySelect?.value);
  if (!Number.isInteger(idx) || idx < 0 || !Array.isArray(program.days) || !program.days[idx]){
    setText("programLoadStatus", tr("workout.select_program_day_first"));
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
    setText("progressionHint", tr("workout.no_load_suggestion"));
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
    is_manual_override: STATE.manualWorkoutActsAsTodayOverride === true,
    entries: [...STATE.pendingEntries]
  };

  try{
    setText("formStatus", tr("status.saving_generic"));
    statusEl?.classList.remove("warn");
    await apiPost("/api/workouts", payload);
    setText("formStatus", tr("workout.saved"));
    statusEl?.classList.add("ok");
    STATE.pendingEntries = [];
    STATE.manualWorkoutActsAsTodayOverride = false;
    form.reset();
    form.date.value = new Date().toISOString().slice(0,10);
    form.duration_min.value = 45;
    form.type.value = "styrke";
    refreshProgramDaySelect();
    renderPendingEntries();
    setText("programLoadStatus", tr("workout.no_program_loaded"));
    await refreshAll();
    advanceWizardAfterCheckin();
  }catch(err){
    const rawMessage = String(err?.message || err || "").trim();
    const normalizedMessage = rawMessage === "empty_workout"
      ? tr("workout.empty_workout_error")
      : rawMessage;
    setText("formStatus", tr("status.error_prefix") + normalizedMessage);
    statusEl?.classList.remove("ok");
    statusEl?.classList.add("warn");
  }
}

function updateCheckinEditMenstruationVisibility(){
  const prefs = STATE.userSettings && typeof STATE.userSettings === "object" && STATE.userSettings.preferences && typeof STATE.userSettings.preferences === "object"
    ? STATE.userSettings.preferences
    : {};
  const enabled = prefs.menstruation_support_enabled === true;
  const block = document.getElementById("editMenstruationCheckinFields");
  if (block){
    block.classList.toggle("wizard-step-hidden", !enabled);
  }
}

function resetCheckinEditForm(form){
  if (!form) return;
  form.reset();
  form.recovery_date.value = new Date().toISOString().slice(0,10);
  form.sleep_score.value = "3";
  form.energy_score.value = "3";
  form.soreness_score.value = "2";
  form.time_budget_min.value = "45";
  if (form.menstruation_today) form.menstruation_today.checked = false;
  if (form.menstrual_pain) form.menstrual_pain.value = "none";
  ["knee", "low_back", "shoulder", "elbow", "hip", "ankle_calf", "wrist"].forEach((region) => {
    if (form[`local_signal_${region}`]) form[`local_signal_${region}`].value = "";
  });
}

function applyCheckinEditItem(item){
  const form = document.getElementById("checkinEditForm");
  const section = document.getElementById("checkinEditSection");
  if (!form || !section || !item || typeof item !== "object") return;

  STATE.editingCheckinId = String(item.id || "").trim() || null;

  form.recovery_date.value = String(item.date || "").slice(0,10);
  form.sleep_score.value = String(item.sleep_score ?? "3");
  form.energy_score.value = String(item.energy_score ?? "3");
  form.soreness_score.value = String(item.soreness_score ?? "2");
  form.time_budget_min.value = String(item.time_budget_min ?? "45");
  form.recovery_notes.value = String(item.notes || "");
  if (form.menstruation_today) form.menstruation_today.checked = item.menstruation_today === true;
  if (form.menstrual_pain) form.menstrual_pain.value = String(item.menstrual_pain || "none");

  ["knee", "low_back", "shoulder", "elbow", "hip", "ankle_calf", "wrist"].forEach((region) => {
    if (form[`local_signal_${region}`]) form[`local_signal_${region}`].value = "";
  });
  const localSignals = Array.isArray(item.local_signals) ? item.local_signals : [];
  localSignals.forEach((signalItem) => {
    if (!signalItem || typeof signalItem !== "object") return;
    const region = String(signalItem.region || "").trim();
    const signal = String(signalItem.signal || "").trim();
    if (!region || !signal) return;
    if (form[`local_signal_${region}`]) form[`local_signal_${region}`].value = signal;
  });

  updateCheckinEditMenstruationVisibility();
  section.classList.remove("wizard-step-hidden");
  section.scrollIntoView({ behavior: "smooth", block: "start" });
  setText("checkinEditStatus", "Redigerer eksisterende check-in.");
}

function closeCheckinEditSection(){
  const section = document.getElementById("checkinEditSection");
  const form = document.getElementById("checkinEditForm");
  STATE.editingCheckinId = null;
  if (section) section.classList.add("wizard-step-hidden");
  if (form) resetCheckinEditForm(form);
  clearEditCheckinIdFromUrl();
  setText("checkinEditStatus", "Klar.");
}

async function loadDedicatedCheckinEditFromUrl(){
  const recoveryId = String(getEditCheckinIdFromUrl() || "").trim();
  if (!recoveryId) return false;

  try{
    setText("checkinEditStatus", "Åbner check-in til redigering...");
    const data = await apiJsonRequest("GET", `/api/checkins/${encodeURIComponent(recoveryId)}`);
    if (data?.item){
      applyCheckinEditItem(data.item);
      return true;
    }
  }catch(err){
    setText("checkinEditStatus", tr("status.error_prefix") + (err?.message || String(err)));
  }
  return false;
}

async function handleDedicatedCheckinEditSubmit(ev){
  ev.preventDefault();
  const form = ev.currentTarget;
  const recoveryId = String(STATE.editingCheckinId || "").trim();
  if (!recoveryId){
    setText("checkinEditStatus", "Ingen check-in valgt til redigering.");
    return;
  }

  const prefs = STATE.userSettings && typeof STATE.userSettings === "object" && STATE.userSettings.preferences && typeof STATE.userSettings.preferences === "object"
    ? STATE.userSettings.preferences
    : {};
  const menstruationEnabled = prefs.menstruation_support_enabled === true;

  const payload = {
    date: form.recovery_date.value,
    sleep_score: Number(form.sleep_score.value),
    energy_score: Number(form.energy_score.value),
    soreness_score: Number(form.soreness_score.value),
    time_budget_min: Number(form.time_budget_min.value || 45),
    notes: form.recovery_notes.value.trim(),
    local_signals: collectLocalCheckinSignals(form),
    menstruation_today: menstruationEnabled ? Boolean(form.menstruation_today?.checked) : null,
    menstrual_pain: menstruationEnabled ? String(form.menstrual_pain?.value || "none") : "none"
  };

  try{
    setText("checkinEditStatus", "Gemmer ændringer...");
    await apiJsonRequest("PUT", `/api/checkins/${encodeURIComponent(recoveryId)}`, payload);
    await refreshAll();
    closeCheckinEditSection();
    showWizardStep("history");
    setTimeout(() => {
      focusRecoveryHistoryItem(recoveryId);
    }, 120);
    setText("recoveryFormStatus", "Historisk check-in opdateret. Se den i historik.");
  }catch(err){
    setText("checkinEditStatus", tr("status.error_prefix") + (err?.message || String(err)));
  }
}

async function handleDedicatedCheckinDelete(){
  const recoveryId = String(STATE.editingCheckinId || "").trim();
  if (!recoveryId){
    setText("checkinEditStatus", "Ingen check-in valgt til sletning.");
    return;
  }
  if (!window.confirm("Er du sikker på at du vil slette denne check-in? Dette kan påvirke anbefalinger, historik og progression.")){
    return;
  }

  try{
    setText("checkinEditStatus", "Sletter check-in...");
    await apiJsonRequest("DELETE", `/api/checkins/${encodeURIComponent(recoveryId)}`);
    closeCheckinEditSection();
    await refreshAll();
    setText("checkinEditStatus", "Check-in slettet.");
  }catch(err){
    setText("checkinEditStatus", tr("status.error_prefix") + (err?.message || String(err)));
  }
}

function updateMenstruationCheckinVisibility(){
  const prefs = STATE.userSettings && typeof STATE.userSettings === "object" && STATE.userSettings.preferences && typeof STATE.userSettings.preferences === "object"
    ? STATE.userSettings.preferences
    : {};
  const enabled = prefs.menstruation_support_enabled === true;
  const block = document.getElementById("menstruationCheckinFields");
  if (block){
    block.classList.toggle("wizard-step-hidden", !enabled);
  }
}


async function handleRestDayAcknowledge(){
  const plan = STATE.currentTodayPlan && typeof STATE.currentTodayPlan === "object" ? STATE.currentTodayPlan : null;
  const todayCheckin = getTodayCheckin(STATE.checkins || [], STATE.latestCheckin || null, plan || null);
  const statusEl = document.getElementById("sessionResultStatus");


  const checkinId = String(todayCheckin?.id || "").trim();
  const checkinDate = String(todayCheckin?.date || plan?.date || plan?.recommended_for || "").trim();

  if (!checkinId || !checkinDate){
    setText("sessionResultStatus", tr("today_plan.rest_day_checkin_required"));
    statusEl?.classList.remove("ok");
    statusEl?.classList.add("warn");
    return;
  }

  const payload = {
    date: checkinDate,
    sleep_score: Number(todayCheckin.sleep_score || 0),
    energy_score: Number(todayCheckin.energy_score || 0),
    soreness_score: Number(todayCheckin.soreness_score || 0),
    time_budget_min: Number(todayCheckin.time_budget_min || 45),
    notes: String(todayCheckin.notes || "").trim(),
    local_signals: Array.isArray(todayCheckin.local_signals) ? todayCheckin.local_signals : [],
    menstruation_today: todayCheckin.menstruation_today ?? null,
    menstrual_pain: String(todayCheckin.menstrual_pain || "none"),
    rest_day_acknowledged: true
  };

  try{
    setText("sessionResultStatus", tr("today_plan.rest_day_acknowledging"));
    statusEl?.classList.remove("warn");

    const res = await apiJsonRequest("PUT", `/api/checkins/${encodeURIComponent(checkinId)}`, payload);

    const acknowledgedCheckin = res?.item && typeof res.item === "object"
      ? { ...res.item, rest_day_acknowledged: true }
      : { ...todayCheckin, ...payload, rest_day_acknowledged: true };

    STATE.latestCheckin = { ...(STATE.latestCheckin || {}), ...acknowledgedCheckin, rest_day_acknowledged: true };

    const todayKey = String(acknowledgedCheckin?.date || checkinDate || "").slice(0,10);
    const existingCheckins = Array.isArray(STATE.checkins) ? STATE.checkins.slice() : [];
    let replaced = false;
    STATE.checkins = existingCheckins.map(item => {
      const sameId = String(item?.id || "").trim() === String(acknowledgedCheckin?.id || "").trim();
      const sameDate = String(item?.date || "").slice(0,10) === todayKey;
      if (!replaced && (sameId || sameDate)) {
        replaced = true;
        return { ...item, ...acknowledgedCheckin, rest_day_acknowledged: true };
      }
      return item;
    });
    if (!replaced) {
      STATE.checkins.unshift({ ...acknowledgedCheckin, rest_day_acknowledged: true });
    }

    statusEl?.classList.add("ok");
    setText("sessionResultStatus", tr("today_plan.rest_day_acknowledged_saved"));
    renderSessionReview(STATE.currentTodayPlan || null);
    showWizardStep("review");

    STATE.restDayReviewLocked = true;
  }catch(err){
    setText("sessionResultStatus", tr("status.error_prefix") + (err?.message || String(err)));
    statusEl?.classList.remove("ok");
    statusEl?.classList.add("warn");
  }
}

async function handleRecoverySubmit(ev){
  ev.preventDefault();

  const form = ev.currentTarget;
  const statusEl = document.getElementById("recoveryFormStatus");

  const menstruationEnabled = STATE.userSettings && typeof STATE.userSettings === "object" && STATE.userSettings.preferences && typeof STATE.userSettings.preferences === "object"
    ? STATE.userSettings.preferences.menstruation_support_enabled === true
    : false;

  const payload = {
    date: form.recovery_date.value,
    sleep_score: Number(form.sleep_score.value),
    energy_score: Number(form.energy_score.value),
    soreness_score: Number(form.soreness_score.value),
    time_budget_min: Number(form.time_budget_min.value || 45),
    notes: form.recovery_notes.value.trim(),
    local_signals: collectLocalCheckinSignals(form),
    menstruation_today: menstruationEnabled ? Boolean(form.menstruation_today?.checked) : null,
    menstrual_pain: menstruationEnabled ? String(form.menstrual_pain?.value || "none") : "none"
  };

  const editingCheckinId = String(STATE.editingCheckinId || "").trim();
  const isEditing = Boolean(editingCheckinId);

  try{
    setText("recoveryFormStatus", isEditing ? "Gemmer ændringer..." : tr("status.calculating"));
    statusEl?.classList.remove("warn");

    if (isEditing){
      await apiJsonRequest("PUT", `/api/checkins/${encodeURIComponent(editingCheckinId)}`, payload);
      clearEditCheckinIdFromUrl();
      setText("recoveryFormStatus", "Check-in opdateret.");
    } else {
      await apiPost("/api/checkin", payload);
      setText("recoveryFormStatus", tr("status.checkin_saved_updated"));
    }

    statusEl?.classList.add("ok");
    resetRecoveryEditMode();
    await refreshAll();
    updateMenstruationCheckinVisibility();

    if (!isEditing){
      advanceWizardAfterCheckin();
    }
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
    setText("sessionResultStatus", tr("session_result.no_plan_yet"));
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
      || (Array.isArray(plan.entries) && plan.entries.some(e => String(e.exercise_id||"").includes("cardio")) ? "run" : "strength"),

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

      const existingResult = entry?._existing_result && typeof entry._existing_result === "object"
        ? entry._existing_result
        : {};

      const existingSets = Array.isArray(existingResult.sets) ? existingResult.sets : [];
      const sets = Array.from({length: setCount}, (_, setIdx) => {
        const existingSet = existingSets[setIdx] && typeof existingSets[setIdx] === "object" ? existingSets[setIdx] : {};
        const repsVal = form[`review_set_reps_${idx}_${setIdx}`]?.value?.trim() || String(existingSet.reps || "").trim();
        let loadVal = form[`review_set_load_${idx}_${setIdx}`]?.value?.trim() || String(existingSet.load || "").trim();

        if (isTime || isBodyweight){
          loadVal = "";
        }

        const setFailed = String(
          form[`review_set_hit_failure_${idx}_${setIdx}`]?.value
          || String(Boolean(existingSet.hit_failure))
        ) === "true";

        return {
          reps: repsVal,
          load: loadVal,
          hit_failure: setFailed
        };
      });

      const nonEmptySets = sets.filter(x => x.reps || x.load || x.hit_failure);
      let firstLoad = nonEmptySets[0]?.load || "";
      if (!firstLoad && existingResult.load){
        firstLoad = String(existingResult.load || "").trim();
      }

      if (isTime || isBodyweight){
        firstLoad = "";
      }

      return {
        exercise_id: entry.exercise_id || "",
        substituted_from: entry.substituted_from || "",
        completed: String(form.session_completed.value) === "true",
        target_reps: entry.target_reps || "",
        achieved_reps: nonEmptySets[0]?.reps || String(existingResult.achieved_reps || "").trim(),
        load: firstLoad,
        sets: nonEmptySets,
        hit_failure: nonEmptySets.some(x => x.hit_failure),
        notes: form[`review_notes_${idx}`]?.value?.trim() || String(existingResult.notes || "").trim()
      };
    }) : []
  };

  try{
    setText("sessionResultStatus", JSON.stringify(payload.results || []));
    statusEl?.classList.remove("warn");
    const editingSessionResultId = String(STATE.editingSessionResultId || "").trim();
    const isEditingSession = Boolean(editingSessionResultId);

    const res = isEditingSession
      ? await apiJsonRequest("PUT", `/api/session-results/${encodeURIComponent(editingSessionResultId)}`, payload)
      : await apiPost("/api/session-result", payload);

    try {
      const summaryDebug = JSON.stringify(res?.summary || null);
      setText("sessionResultStatus", summaryDebug);
    } catch (err) {
      setText("sessionResultStatus", "summary_debug_error: " + (err?.message || String(err)));
    }

    clearUnsavedWorkoutReviewHandoff(plan);
    form.reset();
    form.session_completed.value = "true";
    await refreshAll();
    showWizardStep("review");
    renderSessionResultSummary(res?.summary || null, payload.results || []);
    setText("sessionResultStatus", isEditingSession ? "Session opdateret." : tr("review.session_result_saved"));
    statusEl?.classList.add("ok");

    form.querySelectorAll("input, select, textarea").forEach(el => {
      el.disabled = true;
    });
    STATE.editingSessionResultId = null;
    clearEditSessionIdFromUrl();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn){
      submitBtn.disabled = true;
      submitBtn.textContent = tr("review.session_saved_button");
      submitBtn.style.display = "none";
    }
    form.classList.add("wizard-step-hidden");
  }catch(err){
    setText("sessionResultStatus", tr("status.error_prefix") + (err?.message || String(err)));
    statusEl?.classList.remove("ok");
    statusEl?.classList.add("warn");
  }
}



const AUTH_BASE = "https://auth.innosocia.dk";
const AUTH_RETURN_TO = "https://strength.innosocia.dk";
let AUTH_USER = null;
let PROFILE_PROGRAM_SWITCH_STATUS = null;
let PROFILE_PROGRAM_SWITCH_STATUS_TIMEOUT = null;
let PROFILE_ACCEPTED_RECOMMENDATION_PENDING = null;

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
  { id: "library", labelKey: "wizard.library" },
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
      "wizard.history": "Historik",
      "wizard.library": "Bibliotek"
    },
    en: {
      "wizard.overview": "Overview",
      "wizard.checkin": "Check-in",
      "wizard.plan": "Today's plan",
      "wizard.review": "After training",
      "wizard.manual": "Manual workout",
      "wizard.history": "History",
      "wizard.library": "Library"
    }
  };

  return fallback[lang]?.[key] || fallback.da[key] || key;
}

let CURRENT_STEP = "";
let CURRENT_LIBRARY_TAB = "exercises";
let CURRENT_LIBRARY_EXERCISE_QUERY = "";
let CURRENT_LIBRARY_PROGRAM_QUERY = "";

function renderLibraryTabs(){
  const exercisesBtn = document.getElementById("libraryTabExercises");
  const programsBtn = document.getElementById("libraryTabPrograms");
  const exercisesPanel = document.getElementById("libraryExercisesPanel");
  const programsPanel = document.getElementById("libraryProgramsPanel");

  if (!exercisesBtn || !programsBtn || !exercisesPanel || !programsPanel) return;

  const activeTab = CURRENT_LIBRARY_TAB === "programs" ? "programs" : "exercises";
  exercisesPanel.style.display = activeTab === "exercises" ? "" : "none";
  programsPanel.style.display = activeTab === "programs" ? "" : "none";

  exercisesBtn.classList.toggle("secondary", activeTab !== "exercises");
  programsBtn.classList.toggle("secondary", activeTab !== "programs");
  exercisesBtn.disabled = activeTab === "exercises";
  programsBtn.disabled = activeTab === "programs";

  if (exercisesBtn.dataset.tabsBound !== "true"){
    exercisesBtn.dataset.tabsBound = "true";
    exercisesBtn.addEventListener("click", () => {
      CURRENT_LIBRARY_TAB = "exercises";
      renderLibraryTabs();
    });
  }

  if (programsBtn.dataset.tabsBound !== "true"){
    programsBtn.dataset.tabsBound = "true";
    programsBtn.addEventListener("click", () => {
      CURRENT_LIBRARY_TAB = "programs";
      renderLibraryTabs();
    });
  }
}



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
    profile: [
      document.getElementById("profileSection"),
    ],
    library: [
      document.getElementById("librarySection"),
    ],
  };
}

function renderUtilityNav(){
  const root = document.getElementById("utilityNav");
  if (!root) return;

  const items = [
    { id: "overview", label: getWizardStepLabel({ labelKey: "wizard.overview" }) },
    { id: "profile", label: tr("overview.profile_equipment") },
    { id: "manual", label: getWizardStepLabel({ labelKey: "wizard.manual" }) },
    { id: "history", label: getWizardStepLabel({ labelKey: "wizard.history" }) },
    { id: "library", label: getWizardStepLabel({ labelKey: "wizard.library" }) },
  ];

  root.innerHTML = items.map(item => `
      <button type="button" data-utility-step="${esc(item.id)}">
        ${esc(item.label)}
      </button>
    `).join("");

  root.querySelectorAll("[data-utility-step]").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = String(btn.getAttribute("data-utility-step") || "").trim();
      showWizardStep(target);
    });
  });
}

function renderWizardNav(){
  const root = document.getElementById("wizardNav");
  if (!root) return;

  const flow = ["checkin", "plan", "review"];
  const currentIndex = flow.indexOf(CURRENT_STEP);
  const dailyUiState = deriveDailyUiState(STATE.currentTodayPlan || null, STATE.latestCheckin || null, STATE.sessionResults || []);

  const clickableByState = {
    first_run_onboarding: new Set(["checkin"]),
    no_checkin_yet: new Set(["checkin"]),
    plan_ready: new Set(["checkin", "plan"]),
    planned_rest_today: new Set(["checkin", "plan"]),
    completed_session_today: new Set([]),
    completed_rest_day_today: new Set([]),
    overview: new Set(["checkin", "plan", "review"])
  };
  const clickableSteps = clickableByState[dailyUiState] || new Set(["checkin", "plan", "review"]);

  root.innerHTML = flow.map((stepId, idx) => {
    const step = WIZARD_STEPS.find(x => x.id === stepId);
    const label = getWizardStepLabel(step);
    const isClickable = clickableSteps.has(stepId);

    const stateClass =
      idx < currentIndex ? "is-complete" :
      idx === currentIndex ? "is-active" :
      "is-upcoming";

    return `
      <button
        type="button"
        data-step="${esc(stepId)}"
        class="${stateClass}${isClickable ? "" : " is-disabled"}"
        ${isClickable ? "" : 'disabled aria-disabled="true"'}
      >
        ${esc(label)}
      </button>
    `;
  }).join("");

  root.querySelectorAll("[data-step]").forEach(btn => {
    if (btn.disabled) return;
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


function isGuidedWorkoutPlayerStep(stepId){
  return stepId === "plan" && STATE.workoutInProgress === true;
}

function applyGuidedWorkoutPlayerShell(isActive){
  const todayPlanSection = document.getElementById("todayPlanSection");
  if (todayPlanSection){
    todayPlanSection.classList.toggle("workout-mode-active", isActive);

    if (isActive){
      todayPlanSection.style.maxWidth = "none";
      todayPlanSection.style.width = "100%";
      todayPlanSection.style.background = "#050505";
      todayPlanSection.style.border = "1px solid rgba(255,255,255,0.06)";
      todayPlanSection.style.borderRadius = "24px";
      todayPlanSection.style.padding = "12px";
      todayPlanSection.style.boxShadow = "0 18px 48px rgba(0,0,0,0.35)";
    } else {
      todayPlanSection.style.maxWidth = "";
      todayPlanSection.style.width = "";
      todayPlanSection.style.background = "";
      todayPlanSection.style.border = "";
      todayPlanSection.style.borderRadius = "";
      todayPlanSection.style.padding = "";
      todayPlanSection.style.boxShadow = "";
    }
  }

  document.body.classList.toggle("workout-mode-active", isActive);

  [
    "overviewStatusCard",
    "systemStatusCard",
    "authBar",
    "appHeaderBar",
    "appTagline",
    "wizardNav",
    "utilityNav",
  ].forEach(id => {
    const node = document.getElementById(id);
    if (node){
      node.classList.toggle("wizard-step-hidden", isActive);
    }
  });
}


function applyGuidedWorkoutPlayerContentVisibility(stepId){
  const isWorkoutPlanStep = isGuidedWorkoutPlayerStep(stepId);
  const todayPlanList = document.getElementById("todayPlanList");
  const todayPlanTiming = document.getElementById("todayPlanTiming");
  const todayPlanSummary = document.getElementById("todayPlanSummary");
  const reviewSummary = document.getElementById("reviewPlanSummary");
  const sessionResultForm = document.getElementById("sessionResultForm");
  const reviewWrap = sessionResultForm ? sessionResultForm.closest(".card") : null;

  if (todayPlanList){
    todayPlanList.classList.toggle("wizard-step-hidden", stepId === "review");
  }

  if (todayPlanTiming){
    todayPlanTiming.classList.toggle("wizard-step-hidden", stepId === "review" || isWorkoutPlanStep);
  }

  if (todayPlanSummary){
    todayPlanSummary.classList.toggle("wizard-step-hidden", stepId === "review" || isWorkoutPlanStep);
  }

  if (reviewSummary){
    reviewSummary.classList.toggle("wizard-step-hidden", stepId !== "review");
  }

  if (reviewWrap){
    reviewWrap.classList.toggle("wizard-step-hidden", stepId !== "review");
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

  const todayPlanSection = document.getElementById("todayPlanSection");
  const isWorkoutPlanStep = isGuidedWorkoutPlayerStep(stepId);

  if (todayPlanSection){
    todayPlanSection.classList.toggle("wizard-step-hidden", !(stepId === "plan" || stepId === "review"));
  }

  applyGuidedWorkoutPlayerShell(isWorkoutPlanStep);
  applyGuidedWorkoutPlayerContentVisibility(stepId);

  if (stepId === "plan"){
    renderTodayPlan(STATE.currentTodayPlan || null);
  } else if (stepId === "review"){
    renderReviewSummary(STATE.currentTodayPlan || null);
    renderSessionReview(STATE.currentTodayPlan || null);
  }


  updatePlanHeadingForStep(stepId);
  updateReviewHeadingForStep(stepId);
  updateOverviewLayoutForStep(stepId);
  renderWizardNav();
  renderUtilityNav();
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

    const checkinEditForm = document.getElementById("checkinEditForm");
    if (checkinEditForm){
      checkinEditForm.addEventListener("submit", handleDedicatedCheckinEditSubmit);
      resetCheckinEditForm(checkinEditForm);
    }
    document.getElementById("cancelCheckinEditSectionBtn")?.addEventListener("click", closeCheckinEditSection);
    document.getElementById("deleteCheckinEditSectionBtn")?.addEventListener("click", handleDedicatedCheckinDelete);
    document.getElementById("cancelRecoveryEditBtn")?.addEventListener("click", () => {
      resetRecoveryEditMode();
    });
    document.getElementById("deleteRecoveryBtn")?.addEventListener("click", handleRecoveryDelete);

    const sessionResultForm = document.getElementById("sessionResultForm");
    if (sessionResultForm){
      sessionResultForm.addEventListener("submit", handleSessionResultSubmit);
      document.getElementById("deleteSessionResultBtn")?.addEventListener("click", handleSessionDelete);

      document.getElementById("cardio_distance_km_whole")?.addEventListener("change", updateCardioPacePreview);
      document.getElementById("cardio_distance_km_part")?.addEventListener("change", updateCardioPacePreview);
      document.getElementById("cardio_duration_min")?.addEventListener("change", updateCardioPacePreview);
      document.getElementById("cardio_duration_sec")?.addEventListener("change", updateCardioPacePreview);
    }

    document.getElementById("addEntryBtn")?.addEventListener("click", handleAddEntry);
    document.getElementById("clearEntriesBtn")?.addEventListener("click", handleClearEntries);
    document.getElementById("loadProgramDayBtn")?.addEventListener("click", handleLoadProgramDay);
    document.getElementById("saveManualTemplateBtn")?.addEventListener("click", handleSaveManualTemplate);
    document.getElementById("loadManualTemplateBtn")?.addEventListener("click", handleLoadManualTemplate);
    document.getElementById("saveCustomWorkoutBtn")?.addEventListener("click", handleSaveCustomWorkout);
    document.getElementById("loadCustomWorkoutBtn")?.addEventListener("click", handleLoadCustomWorkout);
    document.getElementById("program_id")?.addEventListener("change", refreshProgramDaySelect);
    document.getElementById("entry_exercise_id")?.addEventListener("change", handleExerciseChange);
    mountEquipmentEditorInline();
    bindEquipmentEditor();
    bindRpePicker();

    await rerenderUiAfterLanguageChange();
    initSystemInfoToggle();
  }catch(err){
    applyBootFailureFallbacks(tr("status.boot_data_unavailable"));
    applyBootState("boot_data_failed", tr("status.boot_data_failed_prefix") + (err?.message || String(err)));
    setText("debug", String(err?.stack || err));
  }
}

(async () => {
  try{
    applyBootState("loading", tr("status.boot_loading"));
    const authUser = await ensureAuthOrRedirect();
    if (!authUser) return;
    await boot();
  }catch(err){
    applyBootFailureFallbacks(tr("status.boot_auth_unavailable"));
    applyBootState("boot_auth_failed", tr("status.boot_auth_failed_prefix") + (err?.message || String(err)));
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
  updateMenstruationCheckinVisibility();
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
    trainingTypes.strength_weights !== false || trainingTypes.bodyweight !== false ? tr("workout.type.strength") : "",
    trainingTypes.running === true ? tr("session_type.run") : "",
    trainingTypes.mobility === true ? tr("session_type.mobility") : ""
  ].filter(Boolean);

  let typeLabel = tr("common.training_lower");
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

function formatIsoDateForUi(dateStr){
  const raw = String(dateStr || "").trim();
  if (!raw) return "";

  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return raw;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (Number.isNaN(d.getTime())) return raw;

  const weekdayIndex = d.getUTCDay(); // 0=sun
  const lang = String(getCurrentLang() || "").trim().toLowerCase();
  const isEnglish = lang === "en" || lang.startsWith("en-") || lang.startsWith("en_");

  const weekdayNames = isEnglish
    ? ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    : ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];

  const monthNames = isEnglish
    ? ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    : ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"];

  return `${weekdayNames[weekdayIndex]} ${day}. ${monthNames[month - 1]}`;
}

function getNextPlannedSessionInfo(planItem){
  const items = buildWeekPlanItems(planItem);
  if (!Array.isArray(items) || !items.length) return null;

  const todayKey = String(planItem?.training_day_context?.weekday_key || "").trim().toLowerCase();
  const todayIdx = items.findIndex(item => item && item.key === todayKey);
  if (todayIdx < 0) return null;

  const baseDate = String(planItem?.date || planItem?.recommended_for || "").trim();
  if (!baseDate) return null;

  const nextDay = items[(todayIdx + 1) % items.length] || null;
  let nextTraining = null;

  for (let offset = 1; offset <= items.length; offset += 1){
    const candidate = items[(todayIdx + offset) % items.length];
    if (!candidate) continue;
    if (candidate.kind !== "rest" && candidate.key !== todayKey){
      nextTraining = { ...candidate, offsetDays: offset };
      break;
    }
  }

  const out = {};
  if (nextDay){
    const d = new Date(`${baseDate}T12:00:00`);
    d.setDate(d.getDate() + 1);
    out.tomorrow = {
      ...nextDay,
      date: d.toISOString().slice(0,10),
      dateLabel: formatIsoDateForUi(d.toISOString().slice(0,10))
    };
  }

  if (nextTraining){
    const d = new Date(`${baseDate}T12:00:00`);
    d.setDate(d.getDate() + Number(nextTraining.offsetDays || 0));
    out.nextTraining = {
      ...nextTraining,
      date: d.toISOString().slice(0,10),
      dateLabel: formatIsoDateForUi(d.toISOString().slice(0,10))
    };
  }

  return out;
}

function buildNextPlannedSessionHtml(planItem){
  const info = getNextPlannedSessionInfo(planItem);
  if (!info || !info.nextTraining) return "";

  const tomorrow = info.tomorrow;
  const nextTraining = info.nextTraining;
  const nextDateText = String(nextTraining.dateLabel || nextTraining.date || "").trim();
  const nextLikelyLine = [
    tr("review.next_likely_session_label"),
    nextTraining.kindLabel || "",
    nextDateText,
  ].filter(Boolean).join(" · ");

  const tomorrowLine = tomorrow && tomorrow.kind === "rest"
    ? `<div class="small" style="margin-bottom:6px">${esc(tr("review.tomorrow_rest_label"))} · ${esc(tomorrow.dateLabel || "")}</div>`
    : "";

  return `
    <div class="small" style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.08)">
      <div style="font-weight:700; margin-bottom:6px">${esc(tr("review.saved_next_label"))}</div>
      ${tomorrowLine}
      <div style="font-weight:600">${esc(nextLikelyLine)}</div>
      ${nextTraining.note ? `<div class="small" style="margin-top:4px">${esc(nextTraining.note)}</div>` : ""}
    </div>
  `;
}

function getNextPlannedSessionOverviewText(planItem){
  const info = getNextPlannedSessionInfo(planItem);
  if (!info || !info.nextTraining) return "";

  const tomorrow = info.tomorrow;
  const nextTraining = info.nextTraining;

  const lines = [];

  if (tomorrow && tomorrow.kind === "rest"){
    lines.push(`${tr("review.tomorrow_rest_label")} · ${tomorrow.dateLabel || ""}`);
  }

  const nextBits = [
    tr("review.next_planned_session_label"),
    nextTraining.kindLabel || "",
    nextTraining.dateLabel || nextTraining.date || "",
  ].filter(Boolean);

  if (nextBits.length){
    lines.push(nextBits.join(": ").replace(": ", ": ").replace(/: ([^:]+): /, ": $1 · "));
  }

    return lines.filter(Boolean).join("\n");
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

