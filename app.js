const TICK_INTERVAL_MS = 250;
const MAX_TUITION = 999_999_999.99;
const MAX_TOTAL_LESSONS = 10_000;
const MAX_LESSON_DURATION = 480;

const elements = {
  form: document.querySelector("#setup-form"),
  basicsView: document.querySelector("#basics-view"),
  durationView: document.querySelector("#duration-view"),
  timerView: document.querySelector("#timer-view"),
  pageTabs: [...document.querySelectorAll("[data-view-target]")],
  brandHome: document.querySelector("#brand-home"),
  editSettings: document.querySelector("#edit-settings"),
  backBasics: document.querySelector("#back-basics"),
  startSession: document.querySelector("#start-session"),
  tuition: document.querySelector("#tuition"),
  totalLessons: document.querySelector("#total-lessons"),
  lessonDuration: document.querySelector("#lesson-duration"),
  tuitionError: document.querySelector("#tuition-error"),
  lessonsError: document.querySelector("#lessons-error"),
  durationError: document.querySelector("#duration-error"),
  lessonCost: document.querySelector("#lesson-cost"),
  previewTuition: document.querySelector("#preview-tuition"),
  previewLessons: document.querySelector("#preview-lessons"),
  durationRange: document.querySelector("#duration-range"),
  durationMinus: document.querySelector("#duration-minus"),
  durationPlus: document.querySelector("#duration-plus"),
  durationCurrent: document.querySelector("#duration-current"),
  durationMinuteCost: document.querySelector("#duration-minute-cost"),
  durationLessonCost: document.querySelector("#duration-lesson-cost"),
  summaryLessons: document.querySelector("#summary-lessons"),
  summaryDuration: document.querySelector("#summary-duration"),
  minuteCost: document.querySelector("#minute-cost"),
  amountSpent: document.querySelector("#amount-spent"),
  amountRemaining: document.querySelector("#amount-remaining"),
  spentMeta: document.querySelector("#spent-meta"),
  remainingMeta: document.querySelector("#remaining-meta"),
  timerCard: document.querySelector(".timer-card"),
  timerValue: document.querySelector("#timer-value"),
  timerTotal: document.querySelector("#timer-total"),
  progressTrack: document.querySelector("#progress-track"),
  progressFill: document.querySelector("#progress-fill"),
  progressKnob: document.querySelector("#progress-knob"),
  progressPercent: document.querySelector("#progress-percent"),
  statusText: document.querySelector("#status-text"),
  toggleTimer: document.querySelector("#toggle-timer"),
  toggleLabel: document.querySelector("#toggle-label"),
  resetTimer: document.querySelector("#reset-timer"),
  tenMinuteCost: document.querySelector("#ten-minute-cost"),
};

const state = {
  isRunning: false,
  elapsedMs: 0,
  startedAt: null,
  lastRenderedSecond: -1,
  lastRenderedProgress: -1,
  calculated: {
    lessonCost: 0,
    minuteCost: 0,
    durationSeconds: 0,
  },
};

let tickHandle = null;
let previousDuration = Number(elements.lessonDuration.value) || 120;

const moneyFormatter = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const minuteMoneyFormatter = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

function formatMoney(value) {
  return `¥ ${moneyFormatter.format(Math.max(0, value))}`;
}

function formatMinuteMoney(value) {
  return `¥ ${minuteMoneyFormatter.format(Math.max(0, value))}`;
}

function formatClock(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return [hours, minutes, remainingSeconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function parsePositiveNumber(input, integerOnly = false) {
  const value = Number(input.value);
  const isValid =
    Number.isFinite(value) &&
    value > 0 &&
    (!integerOnly || Number.isInteger(value));

  return isValid ? value : null;
}

function validateBasics() {
  const tuition = parsePositiveNumber(elements.tuition);
  const totalLessons = parsePositiveNumber(elements.totalLessons, true);

  elements.tuitionError.textContent =
    tuition === null
      ? "请输入大于 0 的学费金额"
      : tuition > MAX_TUITION
        ? "学费金额超出允许范围"
        : "";
  elements.lessonsError.textContent =
    totalLessons === null
      ? "课次需要是大于 0 的整数"
      : totalLessons > MAX_TOTAL_LESSONS
        ? "总课次不能超过 10,000 节"
        : "";

  if (
    tuition === null ||
    totalLessons === null ||
    tuition > MAX_TUITION ||
    totalLessons > MAX_TOTAL_LESSONS
  ) {
    return null;
  }

  return { tuition, totalLessons };
}

function validateDuration() {
  const lessonDuration = parsePositiveNumber(elements.lessonDuration, true);
  const durationIsInRange =
    lessonDuration !== null && lessonDuration <= MAX_LESSON_DURATION;

  elements.durationError.textContent =
    lessonDuration === null
      ? "请输入有效时长"
      : lessonDuration > MAX_LESSON_DURATION
        ? "单节课时长不能超过 480 分钟"
        : "";

  if (lessonDuration === null || !durationIsInRange) {
    return null;
  }

  return { lessonDuration };
}

function validateSettings() {
  const basics = validateBasics();
  const duration = validateDuration();

  if (!basics || !duration) {
    return null;
  }

  return { ...basics, ...duration };
}

function focusFirstInvalid(inputs) {
  const firstInvalid = inputs.find(
    (input) => !input.checkValidity() || Number(input.value) <= 0,
  );
  firstInvalid?.focus();
}

function getElapsedMs() {
  if (!state.isRunning || state.startedAt === null) {
    return state.elapsedMs;
  }

  return state.elapsedMs + (performance.now() - state.startedAt);
}

function updateCalculatedValues(settings) {
  const lessonCost = settings.tuition / settings.totalLessons;
  const minuteCost = lessonCost / settings.lessonDuration;

  state.calculated = {
    lessonCost,
    minuteCost,
    durationSeconds: settings.lessonDuration * 60,
  };

  elements.lessonCost.textContent = formatMoney(lessonCost);
  elements.previewTuition.textContent = formatMoney(settings.tuition);
  elements.previewLessons.textContent = `${settings.totalLessons} 节`;
  elements.durationRange.value = String(settings.lessonDuration);
  elements.durationRange.style.setProperty(
    "--range-progress",
    `${((settings.lessonDuration - 1) / 479) * 100}%`,
  );
  elements.durationRange.setAttribute(
    "aria-valuetext",
    `${settings.lessonDuration} 分钟`,
  );
  elements.durationCurrent.textContent = String(settings.lessonDuration);
  elements.durationMinuteCost.textContent = formatMinuteMoney(minuteCost);
  elements.durationLessonCost.textContent = formatMoney(lessonCost);
  elements.summaryLessons.textContent = `${settings.totalLessons} 节课`;
  elements.summaryDuration.textContent = `每节 ${settings.lessonDuration} 分钟`;
  elements.minuteCost.textContent = formatMinuteMoney(minuteCost);
  elements.tenMinuteCost.textContent = formatMoney(minuteCost * 10);

}

function renderTimer(force = false) {
  const elapsedMs = Math.min(
    getElapsedMs(),
    state.calculated.durationSeconds * 1000,
  );
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const progress =
    state.calculated.durationSeconds > 0
      ? (elapsedMs / (state.calculated.durationSeconds * 1000)) * 100
      : 0;
  const progressRounded = Math.min(100, Math.floor(progress * 10) / 10);
  const spent = Math.min(
    state.calculated.lessonCost,
    state.calculated.minuteCost * (elapsedMs / 60000),
  );
  const remaining = Math.max(0, state.calculated.lessonCost - spent);

  if (force || elapsedSeconds !== state.lastRenderedSecond) {
    elements.timerValue.textContent = formatClock(elapsedSeconds);
    elements.timerTotal.textContent = `/ ${formatClock(state.calculated.durationSeconds)}`;
    elements.amountSpent.textContent = formatMoney(spent);
    elements.amountRemaining.textContent = formatMoney(remaining);

    state.lastRenderedSecond = elapsedSeconds;
  }

  if (force || progressRounded !== state.lastRenderedProgress) {
    const visualProgress = Math.min(100, progress);
    const visualRatio = visualProgress / 100;
    elements.progressFill.style.width = `calc((100% - 6px) * ${visualRatio})`;
    elements.progressKnob.style.left = `calc(3px + (100% - 6px) * ${visualRatio})`;
    elements.progressPercent.textContent = String(Math.min(100, Math.floor(progress)));
    elements.progressTrack.style.setProperty(
      "--progress",
      `${Math.max(0, Math.min(100, progress))}%`,
    );
    elements.progressTrack.setAttribute(
      "aria-valuenow",
      String(Math.min(100, Math.floor(progress))),
    );
    state.lastRenderedProgress = progressRounded;
  }

  const hasStarted = elapsedMs > 0;
  const isComplete = progress >= 100;

  if (isComplete && state.isRunning) {
    state.elapsedMs = state.calculated.durationSeconds * 1000;
    state.startedAt = null;
    state.isRunning = false;
    stopTicker();
  }

  elements.timerCard.classList.toggle("is-running", state.isRunning && !isComplete);
  elements.timerCard.classList.toggle("is-complete", isComplete);

  if (isComplete) {
    elements.statusText.textContent = "本节课已完成";
    elements.toggleLabel.textContent = "已完成";
    elements.toggleTimer.disabled = true;
    elements.spentMeta.textContent = "完整课时价值";
    elements.remainingMeta.textContent = "目标时长已达成";
  } else if (state.isRunning) {
    elements.statusText.textContent = "正在上课";
    elements.toggleLabel.textContent = "暂停计时";
    elements.toggleTimer.disabled = false;
    elements.spentMeta.textContent = `已上课 ${(elapsedMs / 60000).toFixed(1)} 分钟`;
    elements.remainingMeta.textContent = `还剩 ${(
      (state.calculated.durationSeconds * 1000 - elapsedMs) /
      60000
    ).toFixed(1)} 分钟`;
  } else if (hasStarted) {
    elements.statusText.textContent = "计时已暂停";
    elements.toggleLabel.textContent = "继续上课";
    elements.toggleTimer.disabled = false;
    elements.spentMeta.textContent = `已暂停在 ${(elapsedMs / 60000).toFixed(1)} 分钟`;
    elements.remainingMeta.textContent = `还剩 ${(
      (state.calculated.durationSeconds * 1000 - elapsedMs) /
      60000
    ).toFixed(1)} 分钟`;
  } else {
    elements.statusText.textContent = "准备上课";
    elements.toggleLabel.textContent = "开始上课";
    elements.toggleTimer.disabled = false;
    elements.spentMeta.textContent = "等待开始";
    elements.remainingMeta.textContent = "尚未开始";
  }
}

function startTicker() {
  stopTicker();
  tickHandle = window.setInterval(() => renderTimer(), TICK_INTERVAL_MS);
}

function stopTicker() {
  if (tickHandle !== null) {
    window.clearInterval(tickHandle);
    tickHandle = null;
  }
}

function pauseTimer() {
  if (!state.isRunning) {
    return;
  }

  state.elapsedMs = getElapsedMs();
  state.startedAt = null;
  state.isRunning = false;
  stopTicker();
  renderTimer(true);
}

function toggleTimer() {
  if (state.isRunning) {
    pauseTimer();
    return;
  } else {
    if (state.calculated.durationSeconds <= 0) {
      return;
    }
    state.startedAt = performance.now();
    state.isRunning = true;
    startTicker();
  }

  renderTimer(true);
}

function resetTimer() {
  stopTicker();
  state.isRunning = false;
  state.elapsedMs = 0;
  state.startedAt = null;
  state.lastRenderedSecond = -1;
  state.lastRenderedProgress = -1;
  renderTimer(true);
}

function setLessonDuration(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return;
  }

  const duration = Math.min(
    MAX_LESSON_DURATION,
    Math.max(1, Math.round(parsed)),
  );
  elements.lessonDuration.value = String(duration);
  handleSettingsChange({ reset: true });
}

function handleSettingsChange({ reset = false } = {}) {
  const settings = validateSettings();

  if (!settings) {
    return;
  }

  updateCalculatedValues(settings);

  if (reset) {
    resetTimer();
    return;
  }

  const durationChanged = settings.lessonDuration !== previousDuration;
  previousDuration = settings.lessonDuration;

  if (durationChanged && state.elapsedMs >= settings.lessonDuration * 60 * 1000) {
    resetTimer();
    return;
  }

  renderTimer(true);
}

function showView(viewName, { updateUrl = true } = {}) {
  if (viewName === "duration" && !validateBasics()) {
    viewName = "basics";
    focusFirstInvalid([elements.tuition, elements.totalLessons]);
  }

  if (viewName === "timer") {
    const basics = validateBasics();
    const duration = validateDuration();
    if (!basics || !duration) {
      if (!basics) {
        viewName = "basics";
        focusFirstInvalid([elements.tuition, elements.totalLessons]);
      } else {
        viewName = "duration";
        focusFirstInvalid([elements.lessonDuration]);
      }
    }
  }

  if (!elements.timerView.hidden && viewName !== "timer") {
    pauseTimer();
  }

  elements.basicsView.hidden = viewName !== "basics";
  elements.durationView.hidden = viewName !== "duration";
  elements.timerView.hidden = viewName !== "timer";

  elements.pageTabs.forEach((tab) => {
    if (tab.dataset.viewTarget === viewName) {
      tab.setAttribute("aria-current", "page");
    } else {
      tab.removeAttribute("aria-current");
    }
  });

  const pageTitles = {
    basics: "学费与课次 · 课值",
    duration: "选择课时长 · 课值",
    timer: "上课计时 · 课值",
  };
  document.title = pageTitles[viewName];

  if (updateUrl) {
    try {
      history.replaceState(null, "", `#${viewName}`);
    } catch {
      // Hash navigation is optional and should not block page switching.
    }
  }

  if (viewName === "timer") {
    renderTimer(true);
  }

  window.scrollTo({
    top: 0,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
}

[
  elements.tuition,
  elements.totalLessons,
  elements.lessonDuration,
].forEach((input) => {
  input.addEventListener("input", () => handleSettingsChange());
});

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!validateBasics()) {
    focusFirstInvalid([elements.tuition, elements.totalLessons]);
    return;
  }

  handleSettingsChange();
  showView("duration");
});

elements.durationRange.addEventListener("input", () => {
  setLessonDuration(elements.durationRange.value);
});

elements.durationMinus.addEventListener("click", () => {
  const current = Number(elements.lessonDuration.value) || 1;
  setLessonDuration(current - 1);
});

elements.durationPlus.addEventListener("click", () => {
  const current = Number(elements.lessonDuration.value) || 0;
  setLessonDuration(current + 1);
});

elements.startSession.addEventListener("click", () => {
  const settings = validateSettings();
  if (!settings) {
    focusFirstInvalid([elements.lessonDuration]);
    return;
  }

  updateCalculatedValues(settings);
  resetTimer();
  showView("timer");
});

elements.toggleTimer.addEventListener("click", toggleTimer);
elements.resetTimer.addEventListener("click", resetTimer);

elements.pageTabs.forEach((tab) => {
  tab.addEventListener("click", () => showView(tab.dataset.viewTarget));
});

elements.brandHome.addEventListener("click", (event) => {
  event.preventDefault();
  showView("basics");
});

elements.backBasics.addEventListener("click", () => showView("basics"));
elements.editSettings.addEventListener("click", () => showView("duration"));

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    renderTimer(true);
  }
});

handleSettingsChange({ reset: true });
showView("basics");
