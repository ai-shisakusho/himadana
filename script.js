(() => {
  'use strict';

  const STORAGE = {
    activities: 'himanani.activities.v1',
    today: 'himanani.today.v1'
  };

  const DEFAULT_ACTIVITIES = [
    ['ストレッチする', 5],
    ['机の上を片付ける', 5],
    ['筋トレする', 10],
    ['気になっていたことを1つ調べる', 10],
    ['読書する', 15],
    ['勉強する', 15],
    ['散歩する', 20],
    ['部屋を片付ける', 20],
    ['映画・ドラマを1話見る', 30],
    ['趣味の時間にする', 30]
  ];

  const PRESSURE_MESSAGES = {
    calm: [
      'まあ、ちょっとだけやってみる？',
      '暇なら1個くらいやっとこ。',
      'とりあえず、これでどう？',
      '始める理由は「暇だから」で十分。'
    ],
    mid: [
      '考えてる間に始めた方が早い。',
      'あとでやる、って何回目だっけ。',
      'そろそろ決めてもいい頃です。',
      '15秒悩むより、5分やる方が進む。'
    ],
    strong: [
      'そろそろ腹をくくろう。',
      '別のを探しても、たぶん似たようなもんです。',
      '1個だけ。始めれば勝ち。',
      '未来の自分に丸投げするの、そろそろやめとく？'
    ]
  };

  const SKIP_MESSAGES = [
    'まだ探す？',
    'なかなか慎重ですね。',
    '理想の暇つぶし、探してます？'
  ];

  const state = {
    activities: [],
    selectedAvailableMinutes: null,
    currentActivityId: null,
    previousSuggestionId: null,
    skipCount: 0,
    decisionTimerId: null,
    decisionEndsAt: null,
    decisionSecond: 10,
    decisionPhaseMessage: { calm: '', mid: '', strong: '' },
    timerIntervalId: null,
    timerEndsAt: null,
    timerRemainingMs: 0,
    timerPaused: false,
    timerFinished: false
  };

  const el = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    cacheElements();
    loadActivities();
    syncTodayCount();
    bindEvents();
    renderActivities();
    updateTodayCountUI();
    showView('homeView');
  }

  function cacheElements() {
    const ids = [
      'homeView', 'suggestionView', 'timerView', 'completeView', 'manageView',
      'openManageButton', 'closeManageButton', 'pickButton', 'todayCount',
      'backHomeFromSuggestion', 'pressureStage', 'suggestionTitle', 'suggestionMinutes',
      'decisionCountdown', 'pressureMessage', 'skipNudge', 'acceptButton', 'skipButton',
      'timerTitle', 'timerDisplay', 'timerStatus', 'pauseResumeButton', 'completeButton',
      'cancelTimerButton', 'completeActivity', 'completeStats', 'doAgainButton',
      'completeHomeButton', 'activityForm', 'editingId', 'activityNameInput',
      'activityMinutesInput', 'formError', 'saveActivityButton', 'cancelEditButton',
      'activityList', 'resetSamplesButton'
    ];
    ids.forEach((id) => { el[id] = document.getElementById(id); });
    el.timeChips = Array.from(document.querySelectorAll('.time-chip'));
  }

  function bindEvents() {
    el.timeChips.forEach((button) => {
      button.addEventListener('click', () => selectAvailableMinutes(Number(button.dataset.minutes)));
    });

    el.pickButton.addEventListener('click', beginSuggestionCycle);
    el.openManageButton.addEventListener('click', openManage);
    el.closeManageButton.addEventListener('click', () => showView('homeView'));
    el.backHomeFromSuggestion.addEventListener('click', () => {
      stopDecisionCountdown();
      state.skipCount = 0;
      showView('homeView');
    });

    el.acceptButton.addEventListener('click', acceptSuggestion);
    el.skipButton.addEventListener('click', skipSuggestion);
    el.pauseResumeButton.addEventListener('click', togglePauseTimer);
    el.completeButton.addEventListener('click', completeActivity);
    el.cancelTimerButton.addEventListener('click', cancelTimer);
    el.doAgainButton.addEventListener('click', returnForAnother);
    el.completeHomeButton.addEventListener('click', () => showView('homeView'));

    el.activityForm.addEventListener('submit', saveActivityFromForm);
    el.cancelEditButton.addEventListener('click', resetActivityForm);
    el.resetSamplesButton.addEventListener('click', resetSamples);
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `activity_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function createDefaultActivities() {
    return DEFAULT_ACTIVITIES.map(([name, minutes]) => ({
      id: makeId(),
      name,
      minutes,
      enabled: true,
      completedCount: 0
    }));
  }

  function loadActivities() {
    try {
      const raw = localStorage.getItem(STORAGE.activities);
      if (!raw) {
        state.activities = createDefaultActivities();
        persistActivities();
        return;
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('Invalid activities');

      state.activities = parsed
        .filter(isValidStoredActivity)
        .map((activity) => ({
          id: String(activity.id),
          name: String(activity.name).trim().slice(0, 40),
          minutes: Number(activity.minutes),
          enabled: Boolean(activity.enabled),
          completedCount: Math.max(0, Number(activity.completedCount) || 0)
        }));

      if (parsed.length > 0 && state.activities.length === 0) {
        state.activities = createDefaultActivities();
        persistActivities();
      }
    } catch (error) {
      console.warn('行動データを読み込めなかったため初期化しました。', error);
      state.activities = createDefaultActivities();
      persistActivities();
    }
  }

  function isValidStoredActivity(activity) {
    return activity &&
      typeof activity.id !== 'undefined' &&
      typeof activity.name === 'string' &&
      activity.name.trim().length > 0 &&
      Number.isFinite(Number(activity.minutes)) &&
      Number(activity.minutes) > 0;
  }

  function persistActivities() {
    localStorage.setItem(STORAGE.activities, JSON.stringify(state.activities));
  }

  function getLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function syncTodayCount() {
    const today = getLocalDateKey();
    let stats = { date: today, count: 0 };

    try {
      const raw = localStorage.getItem(STORAGE.today);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.date === today) {
          stats = {
            date: today,
            count: Math.max(0, Number(parsed.count) || 0)
          };
        }
      }
    } catch (error) {
      console.warn('今日の達成数を読み込めませんでした。', error);
    }

    localStorage.setItem(STORAGE.today, JSON.stringify(stats));
    return stats;
  }

  function incrementTodayCount() {
    const stats = syncTodayCount();
    stats.count += 1;
    localStorage.setItem(STORAGE.today, JSON.stringify(stats));
    return stats.count;
  }

  function updateTodayCountUI() {
    const stats = syncTodayCount();
    el.todayCount.textContent = String(stats.count);
  }

  function showView(viewId) {
    ['homeView', 'suggestionView', 'timerView', 'completeView', 'manageView'].forEach((id) => {
      el[id].classList.toggle('is-active', id === viewId);
    });

    if (viewId === 'homeView') {
      updateTodayCountUI();
    }

    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function selectAvailableMinutes(minutes) {
    state.selectedAvailableMinutes = minutes;
    el.timeChips.forEach((button) => {
      const selected = Number(button.dataset.minutes) === minutes;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
    el.pickButton.disabled = false;
  }

  function getEligibleActivities() {
    return state.activities.filter((activity) =>
      activity.enabled && activity.minutes <= state.selectedAvailableMinutes
    );
  }

  function beginSuggestionCycle() {
    if (!state.selectedAvailableMinutes) return;

    const eligible = getEligibleActivities();
    if (eligible.length === 0) {
      window.alert('この時間でできることがまだありません。行動を追加するか、長めの時間を選んでみてください。');
      openManage();
      return;
    }

    state.skipCount = 0;
    el.skipNudge.textContent = '';
    pickAndShowSuggestion();
    showView('suggestionView');
  }

  function pickAndShowSuggestion() {
    const eligible = getEligibleActivities();
    if (eligible.length === 0) {
      stopDecisionCountdown();
      window.alert('使える行動がなくなりました。行動管理を確認してください。');
      openManage();
      return;
    }

    let pool = eligible;
    if (eligible.length > 1 && state.previousSuggestionId) {
      const withoutPrevious = eligible.filter((activity) => activity.id !== state.previousSuggestionId);
      if (withoutPrevious.length > 0) pool = withoutPrevious;
    }

    const activity = pool[Math.floor(Math.random() * pool.length)];
    state.currentActivityId = activity.id;
    state.previousSuggestionId = activity.id;

    el.suggestionTitle.textContent = activity.name;
    el.suggestionMinutes.textContent = `${activity.minutes}分だけ`;

    startDecisionCountdown();
  }

  function startDecisionCountdown() {
    stopDecisionCountdown();

    state.decisionPhaseMessage = {
      calm: randomOf(PRESSURE_MESSAGES.calm),
      mid: randomOf(PRESSURE_MESSAGES.mid),
      strong: randomOf(PRESSURE_MESSAGES.strong)
    };

    state.decisionEndsAt = Date.now() + 10000;
    state.decisionSecond = 10;
    updateDecisionCountdown(10);

    state.decisionTimerId = window.setInterval(() => {
      const remaining = Math.max(0, state.decisionEndsAt - Date.now());
      const second = Math.ceil(remaining / 1000);
      if (second !== state.decisionSecond) {
        state.decisionSecond = second;
        updateDecisionCountdown(second);
      }

      if (remaining <= 0) {
        stopDecisionCountdown(false);
        updateDecisionCountdown(0);
      }
    }, 100);
  }

  function stopDecisionCountdown(clearEnd = true) {
    if (state.decisionTimerId !== null) {
      window.clearInterval(state.decisionTimerId);
      state.decisionTimerId = null;
    }
    if (clearEnd) state.decisionEndsAt = null;
  }

  function updateDecisionCountdown(second) {
    el.decisionCountdown.textContent = second > 0 ? String(second) : '…';

    let phase = 'calm';
    if (second === 0) phase = 'done';
    else if (second <= 3) phase = 'strong';
    else if (second <= 6) phase = 'mid';

    el.pressureStage.className = `pressure-stage phase-${phase}`;

    if (phase === 'done') {
      el.pressureMessage.textContent = '時間切れ。でも、決めるのはあなた。';
    } else {
      el.pressureMessage.textContent = state.decisionPhaseMessage[phase];
    }
  }

  function skipSuggestion() {
    state.skipCount += 1;
    updateSkipNudge();
    pickAndShowSuggestion();
  }

  function updateSkipNudge() {
    if (state.skipCount < 3) {
      el.skipNudge.textContent = '';
    } else if (state.skipCount === 3) {
      el.skipNudge.textContent = 'そろそろ1個選んでみない？ 👀';
    } else if (state.skipCount === 5) {
      el.skipNudge.textContent = 'もしかして、やる気あるやつ探してない？';
    } else {
      el.skipNudge.textContent = randomOf(SKIP_MESSAGES);
    }
  }

  function acceptSuggestion() {
    const activity = findActivity(state.currentActivityId);
    if (!activity) return;

    stopDecisionCountdown();
    state.skipCount = 0;
    el.skipNudge.textContent = '';
    startActivityTimer(activity);
  }

  function startActivityTimer(activity) {
    stopActivityTimer();

    state.timerRemainingMs = activity.minutes * 60 * 1000;
    state.timerEndsAt = Date.now() + state.timerRemainingMs;
    state.timerPaused = false;
    state.timerFinished = false;

    el.timerTitle.textContent = activity.name;
    el.timerStatus.textContent = 'いってらっしゃい。';
    el.pauseResumeButton.textContent = '一時停止';
    el.pauseResumeButton.disabled = false;
    renderTimer(state.timerRemainingMs);
    showView('timerView');

    state.timerIntervalId = window.setInterval(tickActivityTimer, 250);
  }

  function tickActivityTimer() {
    if (state.timerPaused || state.timerFinished || !state.timerEndsAt) return;

    const remaining = Math.max(0, state.timerEndsAt - Date.now());
    state.timerRemainingMs = remaining;
    renderTimer(remaining);

    if (remaining <= 0) {
      state.timerFinished = true;
      stopActivityTimer(false);
      el.timerStatus.textContent = '時間です。できたなら、そのまま押してしまおう。';
      el.pauseResumeButton.disabled = true;
    }
  }

  function renderTimer(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    el.timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function togglePauseTimer() {
    if (state.timerFinished) return;

    if (state.timerPaused) {
      state.timerPaused = false;
      state.timerEndsAt = Date.now() + state.timerRemainingMs;
      el.pauseResumeButton.textContent = '一時停止';
      el.timerStatus.textContent = '再開。あとちょっと。';
      if (state.timerIntervalId === null) {
        state.timerIntervalId = window.setInterval(tickActivityTimer, 250);
      }
    } else {
      state.timerRemainingMs = Math.max(0, state.timerEndsAt - Date.now());
      state.timerPaused = true;
      el.pauseResumeButton.textContent = '再開';
      el.timerStatus.textContent = '休憩中。戻る気になったら再開。';
    }

    renderTimer(state.timerRemainingMs);
  }

  function stopActivityTimer(clearState = true) {
    if (state.timerIntervalId !== null) {
      window.clearInterval(state.timerIntervalId);
      state.timerIntervalId = null;
    }
    if (clearState) {
      state.timerEndsAt = null;
      state.timerRemainingMs = 0;
      state.timerPaused = false;
      state.timerFinished = false;
    }
  }

  function completeActivity() {
    const activity = findActivity(state.currentActivityId);
    if (!activity) return;

    stopActivityTimer();
    syncTodayCount();

    activity.completedCount += 1;
    persistActivities();
    const todayCount = incrementTodayCount();

    el.completeActivity.textContent = activity.name;
    el.completeStats.textContent = `これで累計 ${activity.completedCount}回目。今日は ${todayCount}個目。`;
    showView('completeView');
  }

  function cancelTimer() {
    const shouldCancel = window.confirm('今回はやめますか？ 完了回数には入りません。');
    if (!shouldCancel) return;

    stopActivityTimer();
    state.currentActivityId = null;
    showView('homeView');
  }

  function returnForAnother() {
    state.currentActivityId = null;
    state.skipCount = 0;
    if (state.selectedAvailableMinutes) {
      beginSuggestionCycle();
    } else {
      showView('homeView');
    }
  }

  function openManage() {
    stopDecisionCountdown();
    resetActivityForm();
    renderActivities();
    showView('manageView');
  }

  function saveActivityFromForm(event) {
    event.preventDefault();
    el.formError.textContent = '';

    const name = el.activityNameInput.value.trim();
    const minutes = Number(el.activityMinutesInput.value);
    const editingId = el.editingId.value;

    if (!name) {
      el.formError.textContent = 'やることを入力してください。';
      el.activityNameInput.focus();
      return;
    }

    if (name.length > 40) {
      el.formError.textContent = 'やることは40文字以内にしてください。';
      return;
    }

    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 60) {
      el.formError.textContent = '時間を正しく選んでください。';
      return;
    }

    if (editingId) {
      const activity = findActivity(editingId);
      if (!activity) {
        el.formError.textContent = '編集対象が見つかりませんでした。';
        return;
      }
      activity.name = name;
      activity.minutes = minutes;
    } else {
      state.activities.push({
        id: makeId(),
        name,
        minutes,
        enabled: true,
        completedCount: 0
      });
    }

    persistActivities();
    renderActivities();
    resetActivityForm();
  }

  function resetActivityForm() {
    el.activityForm.reset();
    el.activityMinutesInput.value = '5';
    el.editingId.value = '';
    el.formError.textContent = '';
    el.saveActivityButton.textContent = '追加する';
    el.cancelEditButton.classList.add('is-hidden');
  }

  function editActivity(id) {
    const activity = findActivity(id);
    if (!activity) return;

    el.editingId.value = activity.id;
    el.activityNameInput.value = activity.name;
    el.activityMinutesInput.value = String(activity.minutes);
    el.saveActivityButton.textContent = '更新する';
    el.cancelEditButton.classList.remove('is-hidden');
    el.activityNameInput.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function deleteActivity(id) {
    const activity = findActivity(id);
    if (!activity) return;

    const shouldDelete = window.confirm(`「${activity.name}」を削除しますか？`);
    if (!shouldDelete) return;

    state.activities = state.activities.filter((item) => item.id !== id);
    if (state.currentActivityId === id) state.currentActivityId = null;
    if (state.previousSuggestionId === id) state.previousSuggestionId = null;
    persistActivities();
    renderActivities();
    resetActivityForm();
  }

  function toggleActivity(id) {
    const activity = findActivity(id);
    if (!activity) return;
    activity.enabled = !activity.enabled;
    persistActivities();
    renderActivities();
  }

  function renderActivities() {
    el.activityList.replaceChildren();

    if (state.activities.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'subtle';
      empty.textContent = '行動がありません。まず1つ追加してみてください。';
      el.activityList.appendChild(empty);
      return;
    }

    state.activities
      .slice()
      .sort((a, b) => a.minutes - b.minutes || a.name.localeCompare(b.name, 'ja'))
      .forEach((activity) => {
        const row = document.createElement('div');
        row.className = `activity-row${activity.enabled ? '' : ' is-disabled'}`;

        const main = document.createElement('div');
        main.className = 'activity-main';

        const name = document.createElement('div');
        name.className = 'activity-name';
        name.textContent = activity.name;

        const meta = document.createElement('div');
        meta.className = 'activity-meta';
        meta.textContent = `${activity.minutes}分 ・ ${activity.completedCount}回完了`;

        main.append(name, meta);

        const controls = document.createElement('div');
        controls.className = 'activity-controls';

        const toggle = makeSmallButton(activity.enabled ? 'ON' : 'OFF', 'toggle-button');
        toggle.classList.toggle('is-on', activity.enabled);
        toggle.setAttribute('aria-label', `${activity.name}を${activity.enabled ? 'OFF' : 'ON'}にする`);
        toggle.addEventListener('click', () => toggleActivity(activity.id));

        const edit = makeSmallButton('編集');
        edit.setAttribute('aria-label', `${activity.name}を編集`);
        edit.addEventListener('click', () => editActivity(activity.id));

        const del = makeSmallButton('削除');
        del.setAttribute('aria-label', `${activity.name}を削除`);
        del.addEventListener('click', () => deleteActivity(activity.id));

        controls.append(toggle, edit, del);
        row.append(main, controls);
        el.activityList.appendChild(row);
      });
  }

  function makeSmallButton(label, extraClass = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `small-button ${extraClass}`.trim();
    button.textContent = label;
    return button;
  }

  function resetSamples() {
    const shouldReset = window.confirm('登録した行動をすべて削除して、サンプル行動に戻しますか？');
    if (!shouldReset) return;

    state.activities = createDefaultActivities();
    state.currentActivityId = null;
    state.previousSuggestionId = null;
    persistActivities();
    renderActivities();
    resetActivityForm();
  }

  function findActivity(id) {
    return state.activities.find((activity) => activity.id === id) || null;
  }

  function randomOf(list) {
    return list[Math.floor(Math.random() * list.length)];
  }
})();
