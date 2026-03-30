// ═══════════════════════════════════════════════════════════════
// v11.0.5: SAVE TO IDENTITY - SMART USER FACT DETECTION
// ═══════════════════════════════════════════════════════════════

/**
 * v11.0.5: Detect personal facts shared in user messages
 * Returns array of detected facts that could be saved to Identity
 */
function detectPersonalFacts(userMessage) {
  var facts = [];
  var text = userMessage.toLowerCase();
  
  // Health-related patterns
  var healthPatterns = [
    { pattern: /i (?:have|suffer from|was diagnosed with|deal with) (.+?)(?:\.|,|$)/i, category: 'health', type: 'condition' },
    { pattern: /i(?:'m| am) (?:on|taking) (.+?) (?:medication|medicine|pills)/i, category: 'health', type: 'medication' },
    { pattern: /i(?:'m| am) (vegetarian|vegan|pescatarian|gluten[- ]free|lactose intolerant|diabetic)/i, category: 'health', type: 'dietary' },
    { pattern: /i(?:'m| am) allergic to (.+?)(?:\.|,|$)/i, category: 'health', type: 'allergy' },
    { pattern: /i can(?:'t|not) eat (.+?)(?:\.|,|$)/i, category: 'health', type: 'dietary' }
  ];
  
  // Family/relationship patterns
  var familyPatterns = [
    { pattern: /i have (\d+) (?:kids?|children)/i, category: 'family', type: 'children' },
    { pattern: /my (?:wife|husband|partner|spouse)(?:'s name is| is) (\w+)/i, category: 'family', type: 'partner' },
    { pattern: /i(?:'m| am) (married|single|divorced|engaged)/i, category: 'family', type: 'status' },
    { pattern: /my (?:dog|cat|pet)(?:'s name is| is named) (\w+)/i, category: 'family', type: 'pet' }
  ];
  
  // Work/career patterns  
  var workPatterns = [
    { pattern: /i(?:'m| am) (?:a |an )?(.+?) (?:at|for|working at)/i, category: 'work', type: 'role' },
    { pattern: /i (?:work|run|own|founded|started) (?:a |an |my own )?(.+?)(?:\.|,| called| named|$)/i, category: 'work', type: 'business' },
    { pattern: /my business is (?:a |an )?(.+?)(?:\.|,|$)/i, category: 'work', type: 'business' }
  ];
  
  // Personal trait patterns
  var traitPatterns = [
    { pattern: /i(?:'m| am) (\d+)(?: years old)?/i, category: 'personal', type: 'age' },
    { pattern: /i live in (.+?)(?:\.|,|$)/i, category: 'personal', type: 'location' },
    { pattern: /i(?:'m| am) (?:a |an )?(morning person|night owl|introvert|extrovert)/i, category: 'personal', type: 'trait' },
    { pattern: /i have (adhd|add|autism|anxiety|depression)/i, category: 'personal', type: 'neurodivergent' }
  ];
  
  // Tax/financial patterns
  var taxPatterns = [
    { pattern: /my (?:business|company) is (?:a |an )?(llc|s[- ]?corp|c[- ]?corp|sole prop)/i, category: 'tax', type: 'entity' },
    { pattern: /i (?:file|am) (married filing jointly|married filing separately|head of household|single)/i, category: 'tax', type: 'filing' },
    { pattern: /i have (?:a )?(home office|rental propert|side business|crypto)/i, category: 'tax', type: 'deduction' }
  ];
  
  var allPatterns = healthPatterns.concat(familyPatterns, workPatterns, traitPatterns, taxPatterns);
  
  allPatterns.forEach(function(p) {
    var match = userMessage.match(p.pattern);
    if (match && match[1]) {
      facts.push({
        category: p.category,
        type: p.type,
        value: match[1].trim(),
        original: match[0]
      });
    }
  });
  
  return facts;
}

/**
 * v11.0.5: Show "Save to Identity" prompt for detected facts
 */
function showSaveToIdentityPrompt(facts, messageElement) {
  if (!facts || facts.length === 0) return;
  
  // Only show once per conversation for same facts
  var factKey = 'roweos_identity_shown_' + facts.map(function(f) { return f.value; }).join('_').substring(0, 50);
  if (sessionStorage.getItem(factKey)) return;
  sessionStorage.setItem(factKey, 'true');
  
  // Build prompt UI
  var promptHtml = '<div class="identity-save-prompt" style="margin-top: var(--space-3); padding: var(--space-3); background: var(--life-accent-10, rgba(34, 197, 94, 0.1)); border: 1px solid var(--life-accent-30, rgba(34, 197, 94, 0.3)); border-radius: var(--radius-md);">';
  promptHtml += '<div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2);">';
  promptHtml += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--life-accent)" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 3a3 3 0 1 1-3 3 3 3 0 0 1 3-3zm0 14.2a7.2 7.2 0 0 1-6-3.22c.03-2 4-3.08 6-3.08s5.97 1.1 6 3.08a7.2 7.2 0 0 1-6 3.22z"/></svg>';
  promptHtml += '<span style="font-weight: 600; color: var(--life-accent);">Save to Identity?</span>';
  promptHtml += '</div>';
  promptHtml += '<div style="font-size: var(--text-base); color: var(--text-secondary); margin-bottom: 10px;">I noticed you shared some personal info. Save it so I remember next time?</div>';
  
  facts.forEach(function(fact, idx) {
    var categoryLabels = { health: 'Health', family: 'Family', work: 'Work', personal: 'Personal', tax: 'Tax' };
    promptHtml += '<label style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: 6px; cursor: pointer;">';
    promptHtml += '<input type="checkbox" checked data-fact-idx="' + idx + '" style="accent-color: var(--life-accent);">';
    promptHtml += '<span style="font-size: var(--text-base);"><strong>' + (categoryLabels[fact.category] || fact.category) + ':</strong> ' + escapeHtml(fact.value) + '</span>';
    promptHtml += '</label>';
  });
  
  promptHtml += '<div style="display: flex; gap: var(--space-2); margin-top: 10px;">';
  promptHtml += '<button class="btn btn-small" onclick="saveFactsToIdentity(this)" style="background: var(--life-accent); border-color: var(--life-accent);">Save Selected</button>';
  promptHtml += '<button class="btn btn-secondary btn-small" onclick="this.closest(\'.identity-save-prompt\').remove()">Dismiss</button>';
  promptHtml += '</div>';
  promptHtml += '</div>';
  
  // Store facts for save function
  window._pendingIdentityFacts = facts;
  
  // Append to message
  if (messageElement) {
    messageElement.insertAdjacentHTML('beforeend', promptHtml);
  }
}

/**
 * v11.0.5: Save selected facts to Identity profile
 */
function saveFactsToIdentity(btn) {
  var container = btn.closest('.identity-save-prompt');
  var checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
  var facts = window._pendingIdentityFacts || [];
  
  if (checkboxes.length === 0) {
    container.remove();
    return;
  }
  
  var profiles = getLifeProfiles();
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  var profile = profiles[currentIdx];
  
  if (!profile) {
    showToast('No profile found', 'error');
    return;
  }
  
  // Initialize structured fields if needed
  if (!profile.identityData) profile.identityData = {};
  
  var savedCount = 0;
  checkboxes.forEach(function(cb) {
    var idx = parseInt(cb.dataset.factIdx);
    var fact = facts[idx];
    if (fact) {
      // Organize by category
      if (!profile.identityData[fact.category]) {
        profile.identityData[fact.category] = [];
      }
      
      // Check for duplicates
      var exists = profile.identityData[fact.category].some(function(f) {
        return f.value.toLowerCase() === fact.value.toLowerCase();
      });
      
      if (!exists) {
        profile.identityData[fact.category].push({
          type: fact.type,
          value: fact.value,
          addedAt: new Date().toISOString()
        });
        savedCount++;
      }
    }
  });
  
  if (savedCount > 0) {
    saveLifeProfiles(profiles);
    showToast(savedCount + ' item' + (savedCount > 1 ? 's' : '') + ' saved to Identity', 'success');
  }
  
  // Update button state
  container.innerHTML = '<div style="display: flex; align-items: center; gap: var(--space-2); color: var(--life-accent);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Saved to Identity</div>';
  
  setTimeout(function() { container.remove(); }, 2000);
}

// ═══════════════════════════════════════════════════════════════
// PULSE 2.0 - JOURNAL & ANALYTICS FUNCTIONS
// ═══════════════════════════════════════════════════════════════

var pulse2JournalEntries = JSON.parse(localStorage.getItem('roweos_pulse2_entries') || '[]');
var pulse2CurrentDateOffset = 0; // Days from today (0 = today, -1 = yesterday)

/**
 * v10.5.25: Initialize Pulse 2.0 view
 */
function initPulse2() {
  pulse2CurrentDateOffset = 0;
  initPulse3(); // v10.6: Initialize goals first
  renderPulse2Journal();
  renderPulse2Activity();
  renderPulse2Overview();
  renderPulse2FocusSessions();
  // v13.2: Mood chart and mood selector removed, replaced by tags
  checkPulseSuggestionsStale(); // v13.2: Auto-refresh suggestions if stale
}

/**
 * v10.5.25: Navigate journal date
 */
function pulseNavigateDate(direction) {
  pulse2CurrentDateOffset += direction;
  if (pulse2CurrentDateOffset > 0) pulse2CurrentDateOffset = 0; // Can't go to future
  renderPulse2Journal();
}

/**
 * v10.5.25: Get date from offset
 */
function getPulse2Date() {
  var date = new Date();
  date.setDate(date.getDate() + pulse2CurrentDateOffset);
  return date;
}

/**
 * v10.5.25: Render journal section
 */
function renderPulse2Journal() {
  var dateEl = document.getElementById('pulse2CurrentDate');
  var listEl = document.getElementById('pulse2EntriesList');
  
  var targetDate = getPulse2Date();
  var targetDateStr = targetDate.toISOString().slice(0, 10);
  
  // Update date label
  if (dateEl) {
    if (pulse2CurrentDateOffset === 0) {
      dateEl.textContent = 'Today';
    } else if (pulse2CurrentDateOffset === -1) {
      dateEl.textContent = 'Yesterday';
    } else {
      dateEl.textContent = targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }
  
  if (!listEl) return;
  
  // Get entries for this date
  var dayEntries = pulse2JournalEntries.filter(function(e) {
    return e.date === targetDateStr;
  }).reverse();
  
  if (dayEntries.length === 0) {
    listEl.innerHTML = '<div class="pulse-2-entry-empty"><p>No journal entries for this day.</p></div>';
    return;
  }
  
  var html = dayEntries.map(function(entry) {
    // v13.2: Show tag badge instead of mood, show subject as heading
    var tagLabel = entry.tag || entry.mood || '';
    var tagColors = { reflection: '#60a5fa', progress: '#22c55e', challenge: '#f59e0b', idea: '#a78bfa', win: '#34d399', great: '#22c55e', good: '#60a5fa', okay: '#f59e0b', challenging: '#ef4444' };
    var tagColor = tagColors[tagLabel] || 'var(--text-muted)';
    var time = formatDateTimeDisplay(new Date(entry.timestamp));
    var subjectHtml = entry.subject ? '<div class="pulse-2-entry-item-subject" style="font-weight: 600; font-size: var(--text-base); color: var(--text-primary); margin-bottom: 4px;">' + escapeHtml(entry.subject) + '</div>' : '';
    var tagHtml = tagLabel ? '<div style="font-size: var(--text-xs); padding: 2px 8px; background: ' + tagColor + '22; color: ' + tagColor + '; border-radius: var(--radius-xs); font-weight: 600;">' + tagLabel.charAt(0).toUpperCase() + tagLabel.slice(1) + '</div>' : '';

    return '<div class="pulse-2-entry-item">' +
      '<div class="pulse-2-entry-item-header">' +
        '<div class="pulse-2-entry-item-date">' + time + '</div>' +
        tagHtml +
      '</div>' +
      subjectHtml +
      '<div class="pulse-2-entry-item-text">' + escapeHtml(entry.text) + '</div>' +
    '</div>';
  }).join('');

  // v13.2: Pull today's Focus notes into journal view
  try {
    var focusNotes = localStorage.getItem('roweos_focus_notes_' + targetDateStr);
    if (focusNotes && focusNotes.trim()) {
      html += '<div class="pulse-2-focus-notes" style="margin-top: var(--space-4); padding: var(--space-3); background: var(--bg-tertiary); border-radius: var(--radius-md); border-left: 3px solid var(--accent);">' +
        '<div style="font-size: var(--text-sm); font-weight: 600; color: var(--accent); margin-bottom: 4px;"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px; margin-right: 4px;"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>Focus Notes</div>' +
        '<div style="font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.5;">' + escapeHtml(focusNotes) + '</div>' +
      '</div>';
    }
  } catch(e) {}

  listEl.innerHTML = html;
}

/**
 * v10.5.25: Initialize mood selector
 */
function initPulse2MoodSelector() {
  var buttons = document.querySelectorAll('.pulse-2-mood-btn');
  buttons.forEach(function(btn) {
    btn.onclick = function() {
      buttons.forEach(function(b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
    };
  });
}

/**
 * v10.5.25: Save journal entry
 */
function savePulse2Entry() {
  var input = document.getElementById('pulse2EntryInput');
  var subjectInput = document.getElementById('pulse2EntrySubject');
  // v13.2: Get selected tag instead of mood
  var selectedTag = document.querySelector('.pulse-2-tag-btn.selected');

  if (!input || !input.value.trim()) {
    showToast('Please write something first', 'warning');
    return;
  }

  var entry = {
    id: Date.now(),
    date: new Date().toISOString().slice(0, 10),
    timestamp: new Date().toISOString(),
    text: input.value.trim(),
    subject: subjectInput ? subjectInput.value.trim() : '',
    tag: selectedTag ? selectedTag.getAttribute('data-tag') : '',
    mood: selectedTag ? selectedTag.getAttribute('data-tag') : 'okay'  // backward compat
  };

  pulse2JournalEntries.push(entry);
  localStorage.setItem('roweos_pulse2_entries', JSON.stringify(pulse2JournalEntries));

  // v13.9: Sync to Focus journal
  if (typeof window.journalEntries !== 'undefined') {
    var focusEntry = {
      id: entry.id,
      date: new Date().toISOString(),
      dateFormatted: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      content: (entry.subject ? entry.subject + ': ' : '') + entry.text,
      mode: (localStorage.getItem('roweos_app_mode') || 'brand') === 'life' ? 'life' : 'brand',
      source: 'pulse'
    };
    if (!window.journalEntries) window.journalEntries = [];
    window.journalEntries.unshift(focusEntry);
    saveJournal();
  }

  input.value = '';
  if (subjectInput) subjectInput.value = '';
  var tagBtns = document.querySelectorAll('.pulse-2-tag-btn');
  tagBtns.forEach(function(b) { b.classList.remove('selected'); });

  pulse2CurrentDateOffset = 0;
  renderPulse2Journal();
  renderPulse2Activity();
  showToast('Entry saved', 'success');
}

/**
 * v13.2: Toggle tag selection on journal entry
 */
function togglePulse2Tag(btn) {
  var siblings = btn.parentElement.querySelectorAll('.pulse-2-tag-btn');
  var wasSelected = btn.classList.contains('selected');
  siblings.forEach(function(b) { b.classList.remove('selected'); });
  if (!wasSelected) btn.classList.add('selected');
}

/**
 * v10.5.25: Render activity feed
 */
function renderPulse2Activity() {
  var container = document.getElementById('pulse2ActivityList');
  if (!container) return;
  
  var activities = [];
  
  // Recent completed tasks
  var completedTasks = todos.filter(function(t) { return t.completed && t.completedAt; })
    .sort(function(a, b) { return new Date(b.completedAt) - new Date(a.completedAt); })
    .slice(0, 5);
  
  completedTasks.forEach(function(t) {
    activities.push({
      type: 'task',
      title: 'Completed: ' + t.text.substring(0, 30) + (t.text.length > 30 ? '...' : ''),
      time: new Date(t.completedAt),
      icon: '✓'
    });
  });
  
  // Recent journal entries
  pulse2JournalEntries.slice(-3).reverse().forEach(function(e) {
    activities.push({
      type: 'journal',
      title: 'Journal entry',
      time: new Date(e.timestamp),
      icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'
    });
  });
  
  // Sort by time
  activities.sort(function(a, b) { return b.time - a.time; });
  activities = activities.slice(0, 8);
  
  if (activities.length === 0) {
    container.innerHTML = '<div class="pulse-2-entry-empty"><p>No recent activity</p></div>';
    return;
  }
  
  var html = activities.map(function(a) {
    var timeStr = formatTimeAgo(a.time);
    return '<div class="pulse-2-activity-item">' +
      '<div class="pulse-2-activity-icon ' + a.type + '">' + a.icon + '</div>' +
      '<div class="pulse-2-activity-info">' +
        '<div class="pulse-2-activity-title">' + escapeHtml(a.title) + '</div>' +
        '<div class="pulse-2-activity-time">' + timeStr + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
  
  container.innerHTML = html;
}

// v12.0.0: formatTimeAgo moved to utils.timeAgo (alias at top of JS section)

// v21.0: Calculate consecutive-day usage streak
function calculateStreak() {
  try {
    var streak = 0;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    for (var d = 0; d < 365; d++) {
      var checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - d);
      var dayStart = checkDate.getTime();
      var dayEnd = dayStart + 86400000;
      var hadActivity = false;
      // Check runs
      if (typeof runs !== 'undefined' && runs && runs.length) {
        for (var r = 0; r < runs.length; r++) {
          var rt = new Date(runs[r].timestamp).getTime();
          if (rt >= dayStart && rt < dayEnd) { hadActivity = true; break; }
        }
      }
      // Check completed todos
      if (!hadActivity && typeof todos !== 'undefined' && todos && todos.length) {
        for (var t = 0; t < todos.length; t++) {
          if (todos[t].completedAt) {
            var tt = new Date(todos[t].completedAt).getTime();
            if (tt >= dayStart && tt < dayEnd) { hadActivity = true; break; }
          }
        }
      }
      if (hadActivity) {
        streak++;
      } else if (d > 0) {
        break; // Streak broken
      }
    }
    return streak;
  } catch (e) {
    return 0;
  }
}

/**
 * v10.5.25: Render weekly overview
 */
function renderPulse2Overview() {
  var weekTasksEl = document.getElementById('pulse2WeekTasks');
  var weekContentEl = document.getElementById('pulse2WeekContent');
  var weekStreakEl = document.getElementById('pulse2WeekStreak');
  var chartEl = document.getElementById('pulse2WeekChart');
  
  var weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  // Tasks done this week
  var weekTasks = todos.filter(function(t) {
    return t.completed && t.completedAt && new Date(t.completedAt) > weekAgo;
  }).length;
  
  // Content this week (runs)
  var weekContent = runs.filter(function(r) {
    return new Date(r.timestamp) > weekAgo;
  }).length;
  
  if (weekTasksEl) weekTasksEl.textContent = weekTasks;
  if (weekContentEl) weekContentEl.textContent = weekContent;
  if (weekStreakEl) weekStreakEl.textContent = calculateStreak();
  
  // Render mini chart
  if (chartEl) {
    var html = '';
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var dateStr = d.toISOString().slice(0, 10);
      
      var dayTasks = todos.filter(function(t) {
        return t.completed && t.completedAt && t.completedAt.slice(0, 10) === dateStr;
      }).length;
      
      var height = Math.min(dayTasks * 15, 100);
      html += '<div class="pulse-2-week-bar' + (dayTasks > 0 ? ' active' : '') + '" style="height: ' + Math.max(height, 8) + '%;"></div>';
    }
    chartEl.innerHTML = html;
  }
}

/**
 * v10.5.25: Render mood chart
 */
function renderPulse2MoodChart() {
  var chartEl = document.getElementById('pulse2MoodChart');
  var summaryEl = document.getElementById('pulse2MoodSummary');
  if (!chartEl) return;
  
  var moodColors = { great: '#22c55e', good: '#60a5fa', okay: '#f59e0b', challenging: '#ef4444' };
  var moodLabels = { great: 'Great', good: 'Good', okay: 'Okay', challenging: 'Hard' };
  var moodCounts = { great: 0, good: 0, okay: 0, challenging: 0 };
  
  var html = '';
  for (var i = 6; i >= 0; i--) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    var dateStr = d.toISOString().slice(0, 10);
    
    var dayEntries = pulse2JournalEntries.filter(function(e) { return e.date === dateStr; });
    var mood = dayEntries.length > 0 ? dayEntries[dayEntries.length - 1].mood : null;
    
    if (mood) moodCounts[mood]++;
    
    html += '<div class="pulse-2-mood-day" style="width: 24px; height: 24px; border-radius: 50%; background: ' + (mood ? moodColors[mood] : 'var(--bg-tertiary)') + ';"></div>';
  }
  chartEl.innerHTML = html;
  
  // Find most common mood
  var maxMood = 'good';
  var maxCount = 0;
  for (var m in moodCounts) {
    if (moodCounts[m] > maxCount) {
      maxCount = moodCounts[m];
      maxMood = m;
    }
  }
  
  if (summaryEl) {
    summaryEl.textContent = maxCount > 0 ? 'This week: mostly ' + maxMood : 'Track your mood daily';
  }
}

/**
 * v10.5.25: Render focus sessions from Focus notes
 */
function renderPulse2FocusSessions() {
  var container = document.getElementById('pulse2FocusList');
  if (!container) return;

  // v13.4: Read actual per-date focus notes from localStorage
  var notes = [];
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf('roweos_focus_notes_') === 0) {
        var dateStr = key.replace('roweos_focus_notes_', '');
        var text = localStorage.getItem(key);
        if (text && text.trim()) {
          notes.push({ date: dateStr, text: text.trim() });
        }
      }
    }
  } catch(e) {}
  // Sort by date descending, take last 5
  notes.sort(function(a, b) { return b.date.localeCompare(a.date); });
  var recent = notes.slice(0, 5);

  if (recent.length === 0) {
    // v13.4: Also check task completion stats
    var completedToday = todos.filter(function(t) {
      return t.completed && t.completedAt && t.completedAt.slice(0, 10) === new Date().toISOString().slice(0, 10);
    }).length;
    if (completedToday > 0) {
      container.innerHTML = '<div class="pulse-2-focus-item"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg> ' + completedToday + ' task' + (completedToday > 1 ? 's' : '') + ' completed today</div>';
    } else {
      container.innerHTML = '<div class="pulse-2-focus-item" style="color:var(--text-muted);font-size:var(--text-sm);">No focus sessions recorded yet. Notes from Focus will appear here.</div>';
    }
    return;
  }

  var html = recent.map(function(note) {
    var preview = note.text.length > 80 ? note.text.substring(0, 80) + '...' : note.text;
    var d = new Date(note.date + 'T12:00:00');
    return '<div class="pulse-2-focus-item">' +
      '<div style="font-size:var(--text-sm);color:var(--text-secondary);">' + escapeHtml(preview) + '</div>' +
      '<div class="pulse-2-focus-item-date">' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '</div>' +
    '</div>';
  }).join('');

  container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════
// v13.2: SMART SUGGESTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * v13.2: Refresh AI-driven smart suggestions
 */
function refreshPulseSuggestions() {
  var container = document.getElementById('pulse3SuggestionsList');
  var wrapper = document.getElementById('pulse3Suggestions');
  if (!container) return;

  var isLifeMode = (localStorage.getItem('roweos_app_mode') || 'brand') === 'life';
  var mode = isLifeMode ? 'life' : 'brand';

  // Build context
  var activeGoals = (pulseGoals || []).filter(function(g) { return !g.archived && !g.completed; });
  var goalSummary = activeGoals.slice(0, 3).map(function(g) {
    var items = (g.items || []);
    if (g.sections) g.sections.forEach(function(s) { items = items.concat(s.items || []); });
    var done = items.filter(function(i) { return i.completed; }).length;
    return g.title + ' (' + done + '/' + items.length + ')';
  }).join('; ');

  var pendingTodos = (todos || []).filter(function(t) { return !t.completed; });
  var overdueTodos = pendingTodos.filter(function(t) {
    return t.date && t.date < new Date().toISOString().slice(0, 10);
  });

  var recentTags = [];
  pulse2JournalEntries.slice(-5).forEach(function(e) {
    if (e.tag) recentTags.push(e.tag);
  });

  // Generate suggestions locally (no API call needed)
  var suggestions = [];

  if (overdueTodos.length > 0) {
    suggestions.push({ text: 'You have ' + overdueTodos.length + ' overdue tasks. Consider rescheduling or completing them today.', actionType: 'task', category: 'focus' });
  }

  if (activeGoals.length === 0) {
    suggestions.push({ text: 'No active goals yet. Create a goal to track your progress.', actionType: 'goal', category: 'pulse' });
  } else {
    var lowestGoal = activeGoals.reduce(function(low, g) {
      var items = (g.items || []);
      if (g.sections) g.sections.forEach(function(s) { items = items.concat(s.items || []); });
      var pct = items.length > 0 ? (items.filter(function(i) { return i.completed; }).length / items.length) : 1;
      var lowItems = (low.items || []);
      if (low.sections) low.sections.forEach(function(s) { lowItems = lowItems.concat(s.items || []); });
      var lowPct = lowItems.length > 0 ? (lowItems.filter(function(i) { return i.completed; }).length / lowItems.length) : 1;
      return pct < lowPct ? g : low;
    }, activeGoals[0]);
    suggestions.push({ text: 'Focus on "' + lowestGoal.title + '" -- it has the most room for progress.', actionType: 'dismiss', category: 'pulse' });
  }

  if (recentTags.indexOf('challenge') !== -1) {
    suggestions.push({ text: 'You recently logged a challenge. Break it into smaller actionable tasks.', actionType: 'task', category: 'focus' });
  }

  if (pendingTodos.length > 10) {
    suggestions.push({ text: 'You have ' + pendingTodos.length + ' pending tasks. Consider grouping related ones into a Pulse goal.', actionType: 'goal', category: 'focus' });
  }

  var todayStr = new Date().toISOString().slice(0, 10);
  var todayEntries = pulse2JournalEntries.filter(function(e) { return e.date === todayStr; });
  if (todayEntries.length === 0) {
    suggestions.push({ text: 'Take a moment to journal today. Quick reflections build self-awareness.', actionType: 'dismiss', category: 'journal' });
  }

  suggestions = suggestions.slice(0, 5);

  // Cache suggestions
  var cache = { suggestions: suggestions, timestamp: Date.now(), mode: mode };
  localStorage.setItem('roweos_pulse_suggestions', JSON.stringify(cache));

  renderPulseSuggestions();
}

/**
 * v13.2: Render cached suggestions
 */
function renderPulseSuggestions() {
  var container = document.getElementById('pulse3SuggestionsList');
  var wrapper = document.getElementById('pulse3Suggestions');
  var timeEl = document.getElementById('pulse3SuggestionsTime');
  if (!container) return;

  try {
    var cache = JSON.parse(localStorage.getItem('roweos_pulse_suggestions') || 'null');
    if (!cache || !cache.suggestions || cache.suggestions.length === 0) {
      if (wrapper) wrapper.style.display = 'none';
      return;
    }

    if (wrapper) wrapper.style.display = 'block';

    // Show time since last refresh
    if (timeEl) {
      var mins = Math.round((Date.now() - cache.timestamp) / 60000);
      timeEl.textContent = mins < 1 ? 'Just now' : mins + 'm ago';
    }

    var actionIcons = {
      goal: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
      task: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>',
      dismiss: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 01-1 1H9a1 1 0 01-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"/></svg>'
    };

    var html = cache.suggestions.map(function(s, idx) {
      var actionBtn = '';
      if (s.actionType === 'goal') {
        actionBtn = '<button class="pulse-3-btn pulse-3-btn-secondary" onclick="pulseSuggestionAction(' + idx + ', \'goal\')" style="font-size: var(--text-xs); padding: 4px 8px;">Add as Goal</button>';
      } else if (s.actionType === 'task') {
        actionBtn = '<button class="pulse-3-btn pulse-3-btn-secondary" onclick="pulseSuggestionAction(' + idx + ', \'task\')" style="font-size: var(--text-xs); padding: 4px 8px;">Add as Task</button>';
      }
      return '<div class="pulse-3-suggestion-card" style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); background: var(--bg-tertiary); border-radius: var(--radius-md); margin-bottom: var(--space-2);">' +
        '<div style="flex-shrink: 0; color: var(--accent);">' + (actionIcons[s.actionType] || actionIcons.dismiss) + '</div>' +
        '<div style="flex: 1; font-size: var(--text-sm); color: var(--text-primary);">' + escapeHtml(s.text) + '</div>' +
        actionBtn +
        '<button style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px;" onclick="dismissPulseSuggestion(' + idx + ')" title="Dismiss"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' +
      '</div>';
    }).join('');

    container.innerHTML = html;
  } catch(e) {
    if (wrapper) wrapper.style.display = 'none';
  }
}

/**
 * v13.2: Handle suggestion action (add as goal or task)
 */
function pulseSuggestionAction(idx, type) {
  try {
    var cache = JSON.parse(localStorage.getItem('roweos_pulse_suggestions') || '{}');
    var suggestion = cache.suggestions && cache.suggestions[idx];
    if (!suggestion) return;

    if (type === 'goal') {
      var isLifeMode = (localStorage.getItem('roweos_app_mode') || 'brand') === 'life';
      var newGoal = {
        id: 'goal_' + Date.now(),
        title: suggestion.text.substring(0, 60),
        items: [{ id: 'item_' + Date.now(), text: suggestion.text, completed: false }],
        createdAt: new Date().toISOString(),
        source: isLifeMode ? 'lifeai' : 'brandai'
      };
      pulseGoals.unshift(newGoal);
      savePulseGoals();
      if (typeof renderPulse3Checklists === 'function') renderPulse3Checklists();
      showToast('Goal created from suggestion', 'success');
    } else if (type === 'task') {
      var newTodo = {
        id: Date.now(),
        text: suggestion.text,
        completed: false,
        date: new Date().toISOString().slice(0, 10),
        brand: (localStorage.getItem('roweos_app_mode') || 'brand') === 'life' ? '_life' : (localStorage.getItem('selectedBrand') || '0'),
        category: ''
      };
      todos.push(newTodo);
      saveTodos();
      showToast('Task created from suggestion', 'success');
    }

    dismissPulseSuggestion(idx);
  } catch(e) {}
}

/**
 * v13.2: Dismiss a suggestion
 */
function dismissPulseSuggestion(idx) {
  try {
    var cache = JSON.parse(localStorage.getItem('roweos_pulse_suggestions') || '{}');
    if (cache.suggestions) {
      cache.suggestions.splice(idx, 1);
      localStorage.setItem('roweos_pulse_suggestions', JSON.stringify(cache));
      renderPulseSuggestions();
    }
  } catch(e) {}
}

/**
 * v13.2: Check if suggestions are stale and auto-refresh
 */
function checkPulseSuggestionsStale() {
  try {
    var cache = JSON.parse(localStorage.getItem('roweos_pulse_suggestions') || 'null');
    if (!cache || (Date.now() - cache.timestamp) > 3600000) {
      refreshPulseSuggestions();
    } else {
      renderPulseSuggestions();
    }
  } catch(e) {
    refreshPulseSuggestions();
  }
}

/**
 * v10.5.25: Generate AI insights
 */
function generatePulse2Insights() {
  var container = document.getElementById('pulse2InsightsList');
  if (!container) return;

  // v11.0.5: SVG icons instead of emojis
  var icons = {
    target: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    strength: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M6 8H5a4 4 0 000 8h1"/><path d="M8 8h8v9a3 3 0 01-3 3h-2a3 3 0 01-3-3V8z"/></svg>',
    journal: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>',
    lightbulb: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 01-1 1H9a1 1 0 01-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v1m0 16v1m-7.071-2.929l.707-.707m12.728 0l.707.707M3 12h1m16 0h1M5.636 5.636l.707.707m12.728 12.728l-.707-.707"/><path d="M12 8l1.5 3 3.5.5-2.5 2.5.5 3.5L12 16l-3 1.5.5-3.5L7 11.5l3.5-.5z"/></svg>',
    chart: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>'
  };

  var insights = [];

  // v13.2: Goal-aware insights - reference specific goals by name and progress
  var activeGoals = (pulseGoals || []).filter(function(g) { return !g.archived && !g.completed; });
  if (activeGoals.length > 0) {
    var topGoal = activeGoals[0];
    var allItems = (topGoal.items || []);
    if (topGoal.sections) {
      topGoal.sections.forEach(function(s) { allItems = allItems.concat(s.items || []); });
    }
    var totalItems = allItems.length;
    var doneItems = allItems.filter(function(i) { return i.completed; }).length;
    var goalPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
    if (goalPct === 100) {
      insights.push({ icon: icons.target, text: '"' + topGoal.title + '" is 100% complete! Mark it as done and start your next goal.' });
    } else if (goalPct > 50) {
      insights.push({ icon: icons.target, text: '"' + topGoal.title + '" is ' + goalPct + '% complete. Keep pushing -- you\'re over halfway!' });
    } else {
      var nextItem = allItems.filter(function(i) { return !i.completed; })[0];
      var nextText = nextItem ? ' Next step: ' + nextItem.text : '';
      insights.push({ icon: icons.arrow, text: '"' + topGoal.title + '" is at ' + goalPct + '%.' + nextText });
    }
  }

  // v13.2: Recent journal tag analysis
  var recentEntries = pulse2JournalEntries.filter(function(e) {
    return new Date(e.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  });
  var tagCounts = {};
  recentEntries.forEach(function(e) {
    var t = e.tag || e.mood || '';
    if (t) tagCounts[t] = (tagCounts[t] || 0) + 1;
  });
  var topTag = '';
  var topTagCount = 0;
  for (var tk in tagCounts) {
    if (tagCounts[tk] > topTagCount) { topTag = tk; topTagCount = tagCounts[tk]; }
  }
  if (topTag === 'challenge' && topTagCount >= 2) {
    insights.push({ icon: icons.strength, text: 'You\'ve logged ' + topTagCount + ' challenges this week. Consider breaking blockers into smaller tasks.' });
  } else if (topTag === 'win' && topTagCount >= 2) {
    insights.push({ icon: icons.sparkle, text: topTagCount + ' wins this week! You\'re on a roll. Keep the momentum going.' });
  } else if (recentEntries.length === 0) {
    insights.push({ icon: icons.lightbulb, text: 'No journal entries this week. A quick daily reflection helps track progress.' });
  } else {
    insights.push({ icon: icons.journal, text: recentEntries.length + ' journal entries this week. Consistent reflection builds momentum.' });
  }

  // Task completion check
  var totalTasks = todos.length;
  var completedTasks = todos.filter(function(t) { return t.completed; }).length;
  var rate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  if (rate > 80) {
    insights.push({ icon: icons.chart, text: rate + '% task completion rate. Outstanding productivity!' });
  } else if (rate < 30 && totalTasks > 5) {
    insights.push({ icon: icons.strength, text: 'Task completion at ' + rate + '%. Try completing just 3 tasks today to build momentum.' });
  }

  // Content creation
  var recentRuns = (typeof runs !== 'undefined' ? runs : []).filter(function(r) {
    return new Date(r.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }).length;
  if (recentRuns > 0) {
    insights.push({ icon: icons.chart, text: recentRuns + ' Studio operations this week. Your content pipeline is active.' });
  }

  // Limit to 4 insights
  insights = insights.slice(0, 4);

  var html = insights.map(function(i) {
    return '<div class="pulse-2-insight">' +
      '<div class="pulse-2-insight-icon">' + i.icon + '</div>' +
      '<div class="pulse-2-insight-text">' + i.text + '</div>' +
    '</div>';
  }).join('');

  container.innerHTML = html;
  showToast('Insights updated', 'success');
}

// Pulse View Functions (Legacy)
// Pulse - Brand Health Dashboard Functions
var pulseInsights = JSON.parse(localStorage.getItem('roweos_pulse_insights') || '[]');

function refreshPulseMetrics() {
  showToast('Calculating metrics...', 'info');
  renderPulseBrandCards();
  renderPulseMetrics();
  renderPulseUpcoming();
  renderPulseContentGaps();
  showToast('Dashboard updated', 'success');
}

function renderPulseBrandCards() {
  var container = document.getElementById('pulseBrandCards');
  if (!container) return;
  
  var html = brands.map(function(brand, idx) {
    var health = calculateBrandHealth(idx);
    var filledDots = Math.floor(health.score / 20);
    var halfDot = (health.score % 20) >= 10;
    
    var dotsHtml = '';
    for (var i = 0; i < 5; i++) {
      if (i < filledDots) {
        dotsHtml += '<span class="pulse-dot filled"></span>';
      } else if (i === filledDots && halfDot) {
        dotsHtml += '<span class="pulse-dot half"></span>';
      } else {
        dotsHtml += '<span class="pulse-dot"></span>';
      }
    }
    
    return '<div class="pulse-brand-card" onclick="selectPulseBrand(' + idx + ')">' +
      '<div class="pulse-brand-name">' + brand.name + '</div>' +
      '<div class="pulse-brand-score">' + health.score + '%</div>' +
      '<div class="pulse-brand-dots">' + dotsHtml + '</div>' +
      '</div>';
  }).join('');
  
  container.innerHTML = html;
}

function calculateBrandHealth(brandIdx) {
  var brand = brands[brandIdx];
  var score = 0;
  var factors = {};
  
  // Content Freshness (25%) - when was last output for this brand?
  var brandRuns = runs.filter(function(r) { return r.brand === brand.name; });
  if (brandRuns.length > 0) {
    var lastRun = new Date(brandRuns[brandRuns.length - 1].timestamp);
    var daysSince = Math.floor((new Date() - lastRun) / (1000 * 60 * 60 * 24));
    if (daysSince <= 7) factors.freshness = 25;
    else if (daysSince <= 14) factors.freshness = 20;
    else if (daysSince <= 30) factors.freshness = 10;
    else factors.freshness = 5;
  } else {
    factors.freshness = 0;
  }
  
  // Voice Consistency (25%) - Tuning good/bad ratio
  var brandTuning = runs.filter(function(r) { 
    return r.brand === brand.name && r.rating; 
  });
  if (brandTuning.length > 0) {
    var goodCount = brandTuning.filter(function(r) { return r.rating === 'good'; }).length;
    var ratio = goodCount / brandTuning.length;
    factors.voice = Math.round(ratio * 25);
  } else {
    factors.voice = 12; // Neutral if no ratings
  }
  
  // Library Inventory (20%) - do they have saved content?
  var brandLibrary = fileLibrary[brand.name] || { items: [] };
  var itemCount = brandLibrary.items ? brandLibrary.items.length : 0;
  if (itemCount >= 10) factors.library = 20;
  else if (itemCount >= 5) factors.library = 15;
  else if (itemCount >= 1) factors.library = 10;
  else factors.library = 0;
  
  // Rhythm Activity (15%) - scheduled items
  var brandCalendar = todos.filter(function(c) { return c.brand === brand.name && c.date; });
  var futureItems = brandCalendar.filter(function(c) {
    return new Date(c.date) >= new Date() && !c.completed;
  }).length;
  if (futureItems >= 5) factors.rhythm = 15;
  else if (futureItems >= 2) factors.rhythm = 10;
  else if (futureItems >= 1) factors.rhythm = 5;
  else factors.rhythm = 0;
  
  // Memory Completeness (15%) - is brand knowledge filled?
  var knowledge = brandKnowledgeData[brand.name.toLowerCase().replace(/\s+/g, '-')] || {};
  var filledFields = 0;
  if (knowledge.essence && knowledge.essence.length > 20) filledFields++;
  if (knowledge.voice && knowledge.voice.length > 20) filledFields++;
  if (knowledge.audience && knowledge.audience.length > 20) filledFields++;
  if (knowledge.messaging && knowledge.messaging.length > 20) filledFields++;
  factors.memory = Math.round((filledFields / 4) * 15);
  
  score = factors.freshness + factors.voice + factors.library + factors.rhythm + factors.memory;
  
  return { score: score, factors: factors };
}

function renderPulseMetrics() {
  // Content Velocity
  var now = new Date();
  var thisMonth = runs.filter(function(r) {
    var d = new Date(r.timestamp);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  var lastMonth = runs.filter(function(r) {
    var d = new Date(r.timestamp);
    var lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  });
  
  document.getElementById('pulseContentCount').textContent = thisMonth.length;
  
  // Velocity trend
  var trendEl = document.getElementById('pulseVelocityTrend');
  if (lastMonth.length > 0) {
    var change = Math.round(((thisMonth.length - lastMonth.length) / lastMonth.length) * 100);
    if (change > 0) {
      trendEl.innerHTML = '<span class="trend-arrow up">↑</span><span class="trend-text">' + change + '% vs last month</span>';
    } else if (change < 0) {
      trendEl.innerHTML = '<span class="trend-arrow down">↓</span><span class="trend-text">' + Math.abs(change) + '% vs last month</span>';
    } else {
      trendEl.innerHTML = '<span class="trend-arrow">-</span><span class="trend-text">Same as last month</span>';
    }
  }
  
  // Velocity chart (last 12 weeks)
  var chartEl = document.getElementById('pulseVelocityChart');
  var weekData = [];
  for (var w = 11; w >= 0; w--) {
    var weekStart = new Date(now.getTime() - (w * 7 * 24 * 60 * 60 * 1000));
    var weekEnd = new Date(weekStart.getTime() + (7 * 24 * 60 * 60 * 1000));
    var count = runs.filter(function(r) {
      var d = new Date(r.timestamp);
      return d >= weekStart && d < weekEnd;
    }).length;
    weekData.push(count);
  }
  var maxCount = Math.max.apply(null, weekData) || 1;
  chartEl.innerHTML = weekData.map(function(c) {
    var height = Math.max(4, (c / maxCount) * 40);
    return '<div class="pulse-chart-bar" style="height: ' + height + 'px;" title="' + c + ' outputs"></div>';
  }).join('');
  
  // Voice Consistency
  var rated = runs.filter(function(r) { return r.rating; });
  var goodRated = rated.filter(function(r) { return r.rating === 'good'; });
  var badRated = rated.filter(function(r) { return r.rating === 'bad'; });
  
  var voiceScore = rated.length > 0 ? Math.round((goodRated.length / rated.length) * 100) : 0;
  document.getElementById('pulseVoiceScore').textContent = voiceScore + '%';
  document.getElementById('pulseVoiceBar').style.width = voiceScore + '%';
  document.getElementById('pulseGoodCount').textContent = 'Good: ' + goodRated.length;
  document.getElementById('pulseBadCount').textContent = 'Bad: ' + badRated.length;
  
  // Training Data Quality
  var withFeedback = runs.filter(function(r) { return r.rating && r.feedback && r.feedback.length > 0; });
  var needsReview = runs.filter(function(r) { return !r.rating; });
  
  document.getElementById('pulseTrainingReady').textContent = rated.length;
  document.getElementById('pulseWithFeedback').textContent = withFeedback.length;
  document.getElementById('pulseNeedsReview').textContent = needsReview.length;
  
  // Library Health
  var totalItems = 0;
  var recentItems = 0;
  var staleItems = 0;
  var sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  var thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  
  Object.keys(fileLibrary).forEach(function(key) {
    var lib = fileLibrary[key];
    if (lib.items) {
      lib.items.forEach(function(item) {
        totalItems++;
        var itemDate = new Date(item.savedAt || item.timestamp || 0);
        if (itemDate >= sevenDaysAgo) recentItems++;
        if (itemDate < thirtyDaysAgo) staleItems++;
      });
    }
  });
  
  document.getElementById('pulseLibraryCount').textContent = totalItems;
  document.getElementById('pulseRecentItems').textContent = recentItems;
  document.getElementById('pulseStaleItems').textContent = staleItems;
}

function renderPulseUpcoming() {
  var container = document.getElementById('pulseUpcoming');
  if (!container) return;
  
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  
  var upcoming = todos.filter(function(item) {
    if (!item.date) return false;
    var itemDate = new Date(item.date);
    return itemDate >= today && !item.completed;
  }).sort(function(a, b) {
    return new Date(a.date) - new Date(b.date);
  }).slice(0, 5);
  
  if (upcoming.length === 0) {
    container.innerHTML = '<div class="pulse-empty-state">No upcoming items in Rhythm</div>';
    return;
  }
  
  container.innerHTML = upcoming.map(function(item) {
    var d = new Date(item.date);
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '<div class="pulse-upcoming-item">' +
      '<div class="pulse-upcoming-date">' +
        '<div class="pulse-upcoming-day">' + d.getDate() + '</div>' +
        '<div class="pulse-upcoming-month">' + months[d.getMonth()] + '</div>' +
      '</div>' +
      '<div class="pulse-upcoming-info">' +
        '<div class="pulse-upcoming-title">' + escapeHtml(item.text || item.title || 'Untitled') + '</div>' +
        '<div class="pulse-upcoming-brand">' + escapeHtml(item.brand || '') + '</div>' +
      '</div>' +
      '</div>';
  }).join('');
}

function renderPulseContentGaps() {
  var container = document.getElementById('pulseContentGaps');
  if (!container) return;
  
  var now = new Date();
  var gaps = [];
  
  brands.forEach(function(brand) {
    var brandRuns = runs.filter(function(r) { return r.brand === brand.name; });
    if (brandRuns.length === 0) {
      gaps.push({ brand: brand.name, days: 999, label: 'No content yet' });
    } else {
      var lastRun = new Date(brandRuns[brandRuns.length - 1].timestamp);
      var daysSince = Math.floor((now - lastRun) / (1000 * 60 * 60 * 24));
      if (daysSince > 7) {
        gaps.push({ brand: brand.name, days: daysSince, label: daysSince + ' days ago' });
      }
    }
  });
  
  gaps.sort(function(a, b) { return b.days - a.days; });
  
  if (gaps.length === 0) {
    container.innerHTML = '<div class="pulse-empty-state">All brands active within 7 days</div>';
    return;
  }
  
  container.innerHTML = gaps.map(function(gap) {
    var className = gap.days > 30 ? 'danger' : (gap.days > 14 ? 'warning' : '');
    return '<div class="pulse-gap-item">' +
      '<span class="pulse-gap-brand">' + escapeHtml(gap.brand) + '</span>' +
      '<span class="pulse-gap-days ' + className + '">' + gap.label + '</span>' +
      '</div>';
  }).join('');
}

function generatePulseInsights() {
  showToast('Generating AI insights...', 'info');
  
  // Build context from current data
  var context = {
    totalOutputs: runs.length,
    thisMonthOutputs: runs.filter(function(r) {
      var d = new Date(r.timestamp);
      var now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length,
    voiceScore: 0,
    brandStats: []
  };
  
  var rated = runs.filter(function(r) { return r.rating; });
  var goodRated = rated.filter(function(r) { return r.rating === 'good'; });
  context.voiceScore = rated.length > 0 ? Math.round((goodRated.length / rated.length) * 100) : 0;
  
  brands.forEach(function(brand, idx) {
    var health = calculateBrandHealth(idx);
    context.brandStats.push({ name: brand.name, score: health.score });
  });
  
  // Generate insights based on data
  var insights = [];
  var now = new Date();
  
  // Voice consistency insight
  if (context.voiceScore >= 80) {
    insights.push({
      type: 'success',
      icon: '◈',
      text: 'Voice consistency is strong at ' + context.voiceScore + '%. Your brand messaging is staying on-point.',
      date: now.toISOString()
    });
  } else if (context.voiceScore > 0 && context.voiceScore < 60) {
    insights.push({
      type: 'warning',
      icon: '◇',
      text: 'Voice consistency is at ' + context.voiceScore + '%. Consider reviewing recent outputs and updating your brand guidelines in Memory.',
      date: now.toISOString()
    });
  }
  
  // Content velocity insight
  if (context.thisMonthOutputs === 0) {
    insights.push({
      type: 'alert',
      icon: '✦',
      text: 'No content generated this month yet. Head to Studio to create some fresh content for your brands.',
      date: now.toISOString()
    });
  } else if (context.thisMonthOutputs >= 10) {
    insights.push({
      type: 'success',
      icon: '◈',
      text: 'Great momentum! ' + context.thisMonthOutputs + ' outputs created this month. Keep the content flowing.',
      date: now.toISOString()
    });
  }
  
  // Brand health insights
  var lowScoreBrands = context.brandStats.filter(function(b) { return b.score < 50; });
  if (lowScoreBrands.length > 0) {
    insights.push({
      type: 'recommendation',
      icon: '▣',
      text: lowScoreBrands.map(function(b) { return b.name; }).join(', ') + ' could use attention. Consider creating content or updating brand Memory.',
      date: now.toISOString()
    });
  }
  
  // Seasonal insight (simple date-based)
  var month = now.getMonth();
  if (month === 11) { // December
    insights.push({
      type: 'opportunity',
      icon: '✦',
      text: 'Holiday season is here! Consider creating end-of-year content, holiday promotions, or New Year messaging.',
      date: now.toISOString()
    });
  } else if (month === 0) { // January
    insights.push({
      type: 'opportunity',
      icon: '✦',
      text: 'New year, fresh start! Great time for goal-setting content, especially for Solo Training.',
      date: now.toISOString()
    });
  }
  
  // Save and render
  pulseInsights = insights;
  localStorage.setItem('roweos_pulse_insights', JSON.stringify(pulseInsights));
  renderPulseIntelFeed();
  showToast('Insights generated', 'success');
}

function renderPulseIntelFeed() {
  var container = document.getElementById('pulseIntelFeed');
  if (!container) return;
  
  if (pulseInsights.length === 0) {
    container.innerHTML = '<div class="pulse-intel-empty"><p>Click "Generate Insights" to get AI-powered recommendations based on your brand activity.</p></div>';
    return;
  }
  
  container.innerHTML = pulseInsights.map(function(insight) {
    var d = new Date(insight.date);
    var dateStr = d.toLocaleDateString();
    return '<div class="pulse-intel-item">' +
      '<div class="pulse-intel-item-header">' +
        '<span class="pulse-intel-icon">' + insight.icon + '</span>' +
        '<span class="pulse-intel-type">' + insight.type + '</span>' +
        '<span class="pulse-intel-date">' + dateStr + '</span>' +
      '</div>' +
      '<div class="pulse-intel-text">' + escapeHtml(insight.text) + '</div>' +
      '</div>';
  }).join('');
}

function askPulseAI() {
  // Build a prompt for BrandAI based on current Pulse data
  var prompt = 'Based on my brand portfolio status, can you provide strategic recommendations?\n\n';
  prompt += 'Here\'s my current situation:\n';
  
  brands.forEach(function(brand, idx) {
    var health = calculateBrandHealth(idx);
    prompt += '- ' + brand.name + ': ' + health.score + '% health score\n';
  });
  
  var rated = runs.filter(function(r) { return r.rating; });
  var goodRated = rated.filter(function(r) { return r.rating === 'good'; });
  var voiceScore = rated.length > 0 ? Math.round((goodRated.length / rated.length) * 100) : 0;
  
  prompt += '\nVoice consistency: ' + voiceScore + '%\n';
  prompt += 'Total content pieces: ' + runs.length + '\n\n';
  prompt += 'What should I focus on next to improve my brand health?';
  
  // Navigate to BrandAI with this prompt
  showView('agent');
  setTimeout(function() {
    var inputField = document.getElementById('agentCommand');
    if (inputField) {
      inputField.value = prompt;
      inputField.focus();
    }
  }, 100);
}

function selectPulseBrand(idx) {
  // Highlight selected brand card
  var cards = document.querySelectorAll('.pulse-brand-card');
  cards.forEach(function(card, i) {
    card.classList.toggle('active', i === idx);
  });
  
  // Show detailed breakdown modal
  showPulseBrandDetail(idx);
}

function showPulseBrandDetail(brandIdx) {
  var brand = brands[brandIdx];
  var health = calculateBrandHealth(brandIdx);
  
  document.getElementById('pulseBrandDetailTitle').textContent = brand.name + ' Health Breakdown';
  
  // Calculate details for display
  var brandRuns = runs.filter(function(r) { return r.brand === brand.name; });
  var lastRunDate = brandRuns.length > 0 ? new Date(brandRuns[brandRuns.length - 1].timestamp).toLocaleDateString() : 'Never';
  var daysSince = brandRuns.length > 0 ? Math.floor((new Date() - new Date(brandRuns[brandRuns.length - 1].timestamp)) / (1000 * 60 * 60 * 24)) : '∞';
  
  var brandTuning = runs.filter(function(r) { return r.brand === brand.name && r.rating; });
  var goodCount = brandTuning.filter(function(r) { return r.rating === 'good'; }).length;
  var badCount = brandTuning.filter(function(r) { return r.rating === 'bad'; }).length;
  
  var brandLibrary = fileLibrary[brand.name] || {};
  var fileCount = brandLibrary.files ? brandLibrary.files.length : 0;
  
  var brandCalendar = todos.filter(function(c) { return c.brand === brand.name && c.date && !c.completed; });
  var futureItems = brandCalendar.filter(function(c) { return new Date(c.date) >= new Date(); }).length;
  
  var knowledge = brandKnowledgeData[brand.name.toLowerCase().replace(/\s+/g, '-')] || {};
  var filledFields = 0;
  if (knowledge.essence && knowledge.essence.length > 20) filledFields++;
  if (knowledge.voice && knowledge.voice.length > 20) filledFields++;
  if (knowledge.audience && knowledge.audience.length > 20) filledFields++;
  if (knowledge.messaging && knowledge.messaging.length > 20) filledFields++;
  
  var html = '<div class="pulse-detail-grid">';
  
  // Overall Score
  html += '<div class="pulse-detail-header">';
  html += '<div class="pulse-detail-score">' + health.score + '%</div>';
  html += '<div class="pulse-detail-label">Overall Health Score</div>';
  html += '</div>';
  
  // Factor breakdown
  html += '<div class="pulse-detail-factors">';
  
  // Content Freshness (25%)
  html += '<div class="pulse-detail-factor">';
  html += '<div class="factor-header"><span>Content Freshness</span><span class="factor-score">' + health.factors.freshness + '/25</span></div>';
  html += '<div class="factor-bar"><div class="factor-bar-fill" style="width: ' + (health.factors.freshness/25*100) + '%"></div></div>';
  html += '<div class="factor-detail">Last output: ' + lastRunDate + ' (' + daysSince + ' days ago)</div>';
  html += '<div class="factor-calc">Calculation: ≤7 days = 25pts, ≤14 days = 20pts, ≤30 days = 10pts, >30 days = 5pts</div>';
  html += '</div>';
  
  // Voice Consistency (25%)
  html += '<div class="pulse-detail-factor">';
  html += '<div class="factor-header"><span>Voice Consistency</span><span class="factor-score">' + health.factors.voice + '/25</span></div>';
  html += '<div class="factor-bar"><div class="factor-bar-fill" style="width: ' + (health.factors.voice/25*100) + '%"></div></div>';
  html += '<div class="factor-detail">Ratings: ' + goodCount + ' good, ' + badCount + ' bad (' + brandTuning.length + ' total)</div>';
  html += '<div class="factor-calc">Calculation: (good / total) × 25 points</div>';
  html += '</div>';
  
  // Library Inventory (20%)
  html += '<div class="pulse-detail-factor">';
  html += '<div class="factor-header"><span>Library Inventory</span><span class="factor-score">' + health.factors.library + '/20</span></div>';
  html += '<div class="factor-bar"><div class="factor-bar-fill" style="width: ' + (health.factors.library/20*100) + '%"></div></div>';
  html += '<div class="factor-detail">Saved files: ' + fileCount + '</div>';
  html += '<div class="factor-calc">Calculation: ≥10 files = 20pts, ≥5 files = 15pts, ≥1 file = 10pts</div>';
  html += '</div>';
  
  // Rhythm Activity (15%)
  html += '<div class="pulse-detail-factor">';
  html += '<div class="factor-header"><span>Rhythm Activity</span><span class="factor-score">' + health.factors.rhythm + '/15</span></div>';
  html += '<div class="factor-bar"><div class="factor-bar-fill" style="width: ' + (health.factors.rhythm/15*100) + '%"></div></div>';
  html += '<div class="factor-detail">Future scheduled items: ' + futureItems + '</div>';
  html += '<div class="factor-calc">Calculation: ≥5 items = 15pts, ≥2 items = 10pts, ≥1 item = 5pts</div>';
  html += '</div>';
  
  // Memory Completeness (15%)
  html += '<div class="pulse-detail-factor">';
  html += '<div class="factor-header"><span>Memory Completeness</span><span class="factor-score">' + health.factors.memory + '/15</span></div>';
  html += '<div class="factor-bar"><div class="factor-bar-fill" style="width: ' + (health.factors.memory/15*100) + '%"></div></div>';
  html += '<div class="factor-detail">Knowledge fields filled: ' + filledFields + '/4</div>';
  html += '<div class="factor-calc">Calculation: (filled fields / 4) × 15 points</div>';
  html += '</div>';
  
  html += '</div>'; // end factors
  
  // Log Content Activity button
  html += '<div style="margin-top: var(--space-5); padding-top: var(--space-4); border-top: 1px solid var(--border-color);">';
  html += '<button class="btn btn-small" onclick="logContentActivity(' + brandIdx + ')">+ Log Content Activity</button>';
  html += '<span style="margin-left: var(--space-3); color: var(--text-muted); font-size: var(--text-sm);">Record a social post or content publish</span>';
  html += '</div>';
  
  html += '</div>'; // end grid
  
  document.getElementById('pulseBrandDetailContent').innerHTML = html;
  document.getElementById('pulseBrandDetailModal').classList.add('show');
}

function closePulseBrandDetail() {
  document.getElementById('pulseBrandDetailModal').classList.remove('show');
}

function logContentActivity(brandIdx) {
  var brand = brands[brandIdx];
  
  // Create a run entry to track content activity
  var activity = {
    id: Date.now(),
    brand: brand.name,
    operation: 'Content Published',
    timestamp: new Date().toISOString(),
    content: 'Manual content activity logged',
    source: 'manual'
  };
  
  runs.push(activity);
  saveRuns();
  
  // Refresh the pulse view
  renderPulseBrandCards();
  renderPulseMetrics();
  showPulseBrandDetail(brandIdx); // Refresh the detail view
  
  showToast('Content activity logged for ' + brand.name, 'success');
}

// Content Activity Log Modal
function openContentActivityModal() {
  renderContentActivityList();
  document.getElementById('contentActivityModal').classList.add('show');
}

function closeContentActivityModal() {
  document.getElementById('contentActivityModal').classList.remove('show');
}

function renderContentActivityList() {
  var container = document.getElementById('contentActivityList');
  if (!container) return;
  
  // Get all content activities (runs with source='manual' or all runs sorted by date)
  var activities = runs.filter(function(r) {
    return r.timestamp;
  }).sort(function(a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
  
  if (activities.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">No content activities yet. Click "+ Add Activity" to log your first content publish.</div>';
    return;
  }
  
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  var html = activities.map(function(activity) {
    var d = new Date(activity.timestamp);
    var isManual = activity.source === 'manual';
    
    return '<div class="activity-item" data-id="' + activity.id + '">' +
      '<div class="activity-date">' +
        '<div class="activity-date-day">' + d.getDate() + '</div>' +
        '<div class="activity-date-month">' + months[d.getMonth()] + '</div>' +
      '</div>' +
      '<div class="activity-info">' +
        '<div class="activity-title">' + escapeHtml(activity.operation || 'Content Activity') + '</div>' +
        '<div class="activity-brand">' + escapeHtml(activity.brand || 'Unknown') + (isManual ? ' • Manual' : ' • Studio') + '</div>' +
      '</div>' +
      '<div class="activity-actions">' +
        '<button class="activity-btn" onclick="editContentActivity(' + activity.id + ')">Edit</button>' +
        '<button class="activity-btn danger" onclick="deleteContentActivity(' + activity.id + ')">Delete</button>' +
      '</div>' +
    '</div>';
  }).join('');
  
  container.innerHTML = html;
}

function addContentActivity() {
  var brandName = prompt('Brand name (e.g., Acme Corp):');
  if (!brandName) return;
  
  var description = prompt('Activity description (e.g., Instagram Post, Blog Article):');
  if (!description) return;
  
  var activity = {
    id: Date.now(),
    brand: brandName,
    operation: description,
    timestamp: new Date().toISOString(),
    content: 'Manual content activity',
    source: 'manual'
  };
  
  runs.push(activity);
  saveRuns();
  renderContentActivityList();
  renderPulseBrandCards();
  renderPulseMetrics();
  showToast('Activity added', 'success');
}

function editContentActivity(id) {
  var activity = runs.find(function(r) { return r.id === id; });
  if (!activity) return;
  
  var newDesc = prompt('Edit activity description:', activity.operation);
  if (newDesc === null) return;
  
  var newBrand = prompt('Edit brand:', activity.brand);
  if (newBrand === null) return;
  
  activity.operation = newDesc;
  activity.brand = newBrand;
  saveRuns();
  renderContentActivityList();
  renderPulseBrandCards();
  renderPulseMetrics();
  showToast('Activity updated', 'success');
}

function deleteContentActivity(id) {
  if (!confirm('Delete this activity?')) return;
  
  runs = runs.filter(function(r) { return r.id !== id; });
  saveRuns();
  renderContentActivityList();
  renderPulseBrandCards();
  renderPulseMetrics();
  showToast('Activity deleted', 'success');
}

// Delete Library File
// v9.1.14: Delete Library File - updated to use preview system
function deleteLibraryFile() {
  // Use preview modal variables
  if (!libraryPreviewFileId || libraryPreviewBrandIdx === null) {
    // Fallback to old system for compatibility
    if (selectedLibraryItem) {
      pendingDeleteType = 'file';
      pendingDeleteId = selectedLibraryItem.id;
      document.getElementById('deleteConfirmMessage').textContent = 'Are you sure you want to delete "' + selectedLibraryItem.name + '"?';
      document.getElementById('deleteConfirmModal').classList.add('show');
      return;
    }
    showToast('No file selected', 'error');
    return;
  }
  
  if (!confirm('Are you sure you want to delete this file?')) return;
  
  // v10.5.25: Mode-aware delete
  var lib = getLibraryForBrandIndex(libraryPreviewBrandIdx);
  if (!lib || !lib.files) return;
  
  var idx = lib.files.findIndex(function(f) { return f.id === libraryPreviewFileId; });
  if (idx === -1) return;
  
  // v9.1.14: Capture brand and folder BEFORE closing preview (which nullifies them)
  var brandIdxToRefresh = libraryPreviewBrandIdx;
  var folderToRefresh = libraryCurrentFolder;
  
  lib.files.splice(idx, 1);
  saveLibraryForBrandIndex(brandIdxToRefresh);
  
  closeLibraryPreview();
  
  // Refresh the files view using captured values
  if (brandIdxToRefresh === -1) {
    // v10.5.25: LifeAI mode refresh
    if (folderToRefresh) {
      renderLifeFilesForFolder(folderToRefresh);
    } else {
      renderLifeLibrary();
    }
  } else if (folderToRefresh) {
    renderLibraryFilesForBrand(brandIdxToRefresh, folderToRefresh);
  } else {
    renderLibraryBrandCards();
  }
  
  showToast('File deleted', 'success');
}

// Delete Folder
function deleteLibraryFolder(folderId, brandIdx) {
  pendingDeleteType = 'folder';
  pendingDeleteId = folderId;
  pendingDeleteBrandIdx = brandIdx;
  
  var lib = getLibraryForBrandIndex(brandIdx);
  var folder = lib.folders.find(function(f) { return f.id === folderId; });
  var folderName = folder ? folder.name : 'this folder';
  
  document.getElementById('deleteConfirmMessage').textContent = 'Are you sure you want to delete the folder "' + folderName + '"? Files in this folder will be moved to root.';
  document.getElementById('deleteConfirmModal').classList.add('show');
}

var pendingDeleteType = null;
var pendingDeleteId = null;
var pendingDeleteBrandIdx = null;

function closeDeleteConfirmModal() {
  document.getElementById('deleteConfirmModal').classList.remove('show');
  pendingDeleteType = null;
  pendingDeleteId = null;
  pendingDeleteBrandIdx = null;
}

function confirmDelete() {
  if (pendingDeleteType === 'file') {
    // Delete file from library
    for (var i = 0; i < 5; i++) {
      var lib = getLibraryForBrandIndex(i);
      if (lib && lib.files) {
        var fileIdx = lib.files.findIndex(function(f) { return f.id === pendingDeleteId; });
        if (fileIdx !== -1) {
          lib.files.splice(fileIdx, 1);
          saveLibrary();
          closeDeleteConfirmModal();
          closeFilePreview();
          renderLibraryView();
          showToast('File deleted', 'success');
          return;
        }
      }
    }
  } else if (pendingDeleteType === 'folder') {
    var lib = getLibraryForBrandIndex(pendingDeleteBrandIdx);
    if (lib && lib.folders) {
      // Move files in this folder to root
      if (lib.files) {
        lib.files.forEach(function(file) {
          if (file.folderId === pendingDeleteId) {
            file.folderId = 'root';
          }
        });
      }
      
      // Remove folder
      lib.folders = lib.folders.filter(function(f) { return f.id !== pendingDeleteId; });
      saveLibrary();
      closeDeleteConfirmModal();
      renderLibraryView();
      showToast('Folder deleted', 'success');
    }
  }
}

function dismissPulseItem(btn) {
  var item = btn.closest('.pulse-item');
  if (item) {
    item.style.opacity = '0';
    setTimeout(function() {
      item.remove();
    }, 300);
  }
}

var originalInit = init;
init = function() {
  originalInit();
  // v18.5: Restore saved brand to mobile selector (was hardcoded to '0')
  var mobileBrandEl = document.getElementById('mobileBrand');
  if (mobileBrandEl) {
    var _savedBrand = localStorage.getItem('roweos_selected_brand') || '0';
    mobileBrandEl.value = _savedBrand;
  }
  
  // Load saved theme
  loadTheme();
  
  // v10.5.25: Re-apply accent color AFTER theme is loaded
  // (initLifeAccentColor runs before loadTheme, so it doesn't know the correct theme)
  if (typeof applyCurrentModeAccent === 'function') {
    applyCurrentModeAccent();
  }
  
  // v10.5.25: Load saved RoweOS mode (BrandAI/LifeAI)
  loadRoweOSMode();
  
  // Initialize brand settings (provider/model per brand)
  initBrandSettings();
  
  // Check API connection
  checkApiConnection();
  
  // Load identity config
  loadIdentityConfig();
  loadPromptLibrary();
  loadGuardrails();
  loadBrandMemory();
};

// Mobile Sidebar Toggle Functions
function toggleSidebar() {
  var sidebar = document.querySelector('.sidebar');
  var overlay = document.getElementById('sidebarOverlay');
  
  if (sidebar && overlay) {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
  }
}

function closeSidebar() {
  var sidebar = document.querySelector('.sidebar');
  var overlay = document.getElementById('sidebarOverlay');
  
  if (sidebar && overlay) {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  }
}

// Close sidebar when clicking a nav item on mobile
document.addEventListener('DOMContentLoaded', function() {
  var navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(function(item) {
    item.addEventListener('click', function() {
      if (window.innerWidth <= 768) {
        closeSidebar();
      }
    });
  });

  // v15.22: Attach image paste listeners to chat inputs
  var agentCmd = document.getElementById('agentCommand');
  if (agentCmd) agentCmd.addEventListener('paste', handleChatPaste);
  var followupCmd = document.getElementById('followupCommand');
  if (followupCmd) followupCmd.addEventListener('paste', handleChatPaste);
});


// ═══════════════════════════════════════════════════════════════
// ONBOARDING SYSTEM - v2.0.0
// ═══════════════════════════════════════════════════════════════

var onboardingData = {
  brandName: '',
  tagline: '',
  location: '',
  email: '',
  voice: [],
  audienceValues: [],
  audience: '',
  promise: '',
  positioning: '',
  selectedModel: 'claude-sonnet-4-6',
  generatedBrand: null,
  demoMode: false
};

// Launch template onboarding (doesn't create demo brand)
// v14.2: Added missing step IDs
function hideAllOnboardingSteps() {
  var stepIds = ['onboardingStep0', 'onboardingStep1', 'onboardingBrandName', 'onboardingBrandOwnership', 'onboardingStep2', 'onboardingTemplateSelection', 'onboardingTemplateBranding', 'onboardingStep3', 'onboardingStep4', 'onboardingStep5', 'onboardingStepMode', 'onboardingStepName', 'onboardingStepProvider', 'onboardingStepLogo', 'onboardingStepFirebase', 'onboardingStepSync', 'onboardingWebsiteImport', 'onboardingDocumentUpload', 'onboardingStyleStep'];
  stepIds.forEach(function(id) {
    var stepEl = document.getElementById(id);
    if (stepEl) {
      stepEl.style.display = 'none';
      stepEl.classList.add('hidden');
      stepEl.style.visibility = 'hidden';  // Match goToOnboardingStep pattern
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   v9.1.14: Website Import & Document Upload Onboarding Functions
   ═══════════════════════════════════════════════════════════════ */

/**
 * Show brand name step (new flow)
 */
function showBrandNameStep() {
  console.log('[Onboarding] Showing brand name step...');
  hideAllOnboardingSteps();
  
  var step = document.getElementById('onboardingBrandName');
  if (step) {
    step.classList.remove('hidden');
    step.style.display = 'flex';
    step.style.visibility = 'visible';
    step.style.opacity = '1';
    
    // Focus the input
    setTimeout(function() {
      var input = document.getElementById('onboardingBrandNameInput');
      if (input) input.focus();
    }, 100);
  } else {
    console.error('[Onboarding] onboardingBrandName element not found!');
  }
}

/**
 * Proceed from brand name step to brand ownership step
 */
function proceedFromBrandName() {
  var brandNameInput = document.getElementById('onboardingBrandNameInput');
  var brandName = brandNameInput ? brandNameInput.value.trim() : '';

  if (!brandName) {
    showToast('Please enter your brand name', 'error');
    return;
  }

  // Store brand name for later use
  window.onboardingBrandName = brandName;
  console.log('[Onboarding] Brand name set:', brandName);

  // v14.0: Go to brand ownership step
  goToOnboardingStep('ownership');

  // Display brand name in ownership step header
  var brandDisplay = document.getElementById('ownershipBrandNameDisplay');
  if (brandDisplay) brandDisplay.textContent = brandName;
}

// v14.0: Brand ownership step functions
function selectOwnershipRole(role) {
  window.onboardingOwnershipRole = role;
  var ownerBtn = document.getElementById('ownershipBtnOwner');
  var employeeBtn = document.getElementById('ownershipBtnEmployee');
  var ownerFields = document.getElementById('ownershipOwnerFields');
  var employeeFields = document.getElementById('ownershipEmployeeFields');
  var continueBtn = document.getElementById('ownershipContinueBtn');

  // Reset both buttons
  if (ownerBtn) {
    ownerBtn.style.borderColor = 'var(--border-color)';
    ownerBtn.style.background = 'rgba(255,255,255,0.02)';
  }
  if (employeeBtn) {
    employeeBtn.style.borderColor = 'var(--border-color)';
    employeeBtn.style.background = 'rgba(255,255,255,0.02)';
  }

  // Highlight selected + show fields
  if (role === 'owner') {
    if (ownerBtn) {
      ownerBtn.style.borderColor = 'var(--accent)';
      ownerBtn.style.background = 'rgba(212,175,55,0.08)';
    }
    if (ownerFields) ownerFields.style.display = 'block';
    if (employeeFields) employeeFields.style.display = 'none';
  } else {
    if (employeeBtn) {
      employeeBtn.style.borderColor = '#6496dc';
      employeeBtn.style.background = 'rgba(100,150,220,0.08)';
    }
    if (ownerFields) ownerFields.style.display = 'none';
    if (employeeFields) employeeFields.style.display = 'block';
  }

  // Show continue button
  if (continueBtn) continueBtn.style.display = '';
}

function proceedFromOwnership() {
  var role = window.onboardingOwnershipRole;
  if (!role) {
    showToast('Please select your relationship with the brand', 'error');
    return;
  }

  // Collect ownership data
  var ownershipData = { role: role };

  if (role === 'owner') {
    var yearEl = document.getElementById('ownershipFoundingYear');
    var structureEl = document.getElementById('ownershipStructure');
    var industryEl = document.getElementById('ownershipIndustry');
    ownershipData.foundingYear = yearEl ? yearEl.value.trim() : '';
    ownershipData.companyStructure = structureEl ? structureEl.value : '';
    ownershipData.industry = industryEl ? industryEl.value.trim() : '';
  } else {
    var titleEl = document.getElementById('ownershipJobTitle');
    var websiteEl = document.getElementById('ownershipCompanyWebsite');
    var respEl = document.getElementById('ownershipResponsibilities');
    var jdEl = document.getElementById('ownershipJobDescription');
    ownershipData.jobTitle = titleEl ? titleEl.value.trim() : '';
    ownershipData.companyWebsite = websiteEl ? websiteEl.value.trim() : '';
    ownershipData.responsibilities = respEl ? respEl.value.trim() : '';
    ownershipData.jobDescription = jdEl ? jdEl.value.trim() : '';
  }

  // Store for later save to brand identityData
  window.onboardingOwnershipData = ownershipData;
  console.log('[Onboarding] Ownership data:', ownershipData);

  // v26.5: Continue to website import fork (Step 2) before provider selection
  goToOnboardingStep(2);
}

/**
 * Show website import step
 */
function showWebsiteImportStep() {
  console.log('[Onboarding] Showing website import step...');
  hideAllOnboardingSteps();
  
  var step = document.getElementById('onboardingWebsiteImport');
  if (step) {
    step.classList.remove('hidden');
    step.style.display = 'flex';
    step.style.flexDirection = 'column';
    step.style.visibility = 'visible';
    step.style.opacity = '1';
  }
  
  // Reset state
  document.getElementById('websiteParseStatus').style.display = 'none';
  document.getElementById('websiteExtractedData').style.display = 'none';
  document.getElementById('websiteContinueBtn').style.display = 'none';
  document.getElementById('websiteImportUrl').value = '';
}

/**
 * Show document upload step
 */
function showDocumentUploadStep() {
  console.log('[Onboarding] Showing document upload step...');
  hideAllOnboardingSteps();
  
  var step = document.getElementById('onboardingDocumentUpload');
  if (step) {
    step.classList.remove('hidden');
    step.style.display = 'flex';
    step.style.flexDirection = 'column';
    step.style.visibility = 'visible';
    step.style.opacity = '1';
  }
  
  // Reset state
  document.getElementById('onboardingDocStatus').style.display = 'none';
  document.getElementById('docExtractedData').style.display = 'none';
  document.getElementById('docContinueBtn').style.display = 'none';
  document.getElementById('onboardingDocsList').innerHTML = '';
  window.onboardingUploadedDocs = [];
}

/**
 * Go back to onboarding choice screen
 */
function backToOnboardingChoice() {
  console.log('[Onboarding] Going back to choice screen...');
  hideAllOnboardingSteps();
  
  var step = document.getElementById('onboardingStep2');
  if (step) {
    step.classList.remove('hidden');
    step.style.display = 'flex';
    step.style.flexDirection = 'column';
    step.style.visibility = 'visible';
    step.style.opacity = '1';
  }
}

/**
 * Parse website URL for brand information
 */
// v24.26: Analyze website from Brand Basics step — fills in all fields
async function analyzeWebsiteForBrandBasics() {
  var urlInput = document.getElementById('wizardBrandWebsite');
  var url = urlInput ? urlInput.value.trim() : '';
  if (!url) { showToast('Enter a website URL first', 'error'); return; }
  // v24.26: Auto-prepend https:// if missing
  if (!url.match(/^https?:\/\//i)) url = 'https://' + url;
  if (urlInput) urlInput.value = url;
  var btn = document.getElementById('analyzeBrandBtn');
  var status = document.getElementById('analyzeWebsiteStatus');
  if (btn) { btn.disabled = true; btn.textContent = 'Analyzing...'; }
  if (status) { status.style.display = 'block'; status.textContent = 'Fetching website data...'; }
  try {
    var resp = await fetch('/api/fetch-site-meta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url }) });
    if (!resp.ok) throw new Error('Fetch failed: ' + resp.status);
    var meta = await resp.json();
    if (status) status.textContent = 'Extracting brand identity with AI...';
    // v24.26: Include URL itself as context for AI extraction
    var content = 'Website URL: ' + url + '\n' + (meta.title ? 'Title: ' + meta.title + '\n' : '') + (meta.description ? 'Description: ' + meta.description + '\n' : '') + (meta.content || '');
    if (content.length > 30 && typeof extractBrandInfoWithAI === 'function') {
      var aiData = await extractBrandInfoWithAI(content, url);
      if (aiData) {
        // v24.26: Fill Brand Basics (step 7)
        if (aiData.name) { var n = document.getElementById('wizardBrandName'); if (n && !n.value) n.value = aiData.name; }
        if (aiData.tagline) { var t = document.getElementById('wizardBrandTagline'); if (t) t.value = aiData.tagline; }
        if (aiData.location) { var l = document.getElementById('wizardBrandLocation'); if (l && !l.value) l.value = aiData.location; }
        if (aiData.essence || aiData.description) { var d = document.getElementById('wizardBrandDescription'); if (d) d.value = aiData.essence || aiData.description || ''; }
        // v24.26: Pre-fill Voice & Tone (step 8) — auto-select matching voice cards
        if (aiData.voice) {
          window._analyzedBrandVoice = aiData.voice;
          var voiceLower = aiData.voice.toLowerCase();
          var voiceCards = document.querySelectorAll('#onboardingStep8 .onboarding-voice-card');
          for (var vi = 0; vi < voiceCards.length; vi++) {
            var attr = voiceCards[vi].getAttribute('onclick') || '';
            var match = attr.match(/'([^']+)'/);
            if (match && voiceLower.indexOf(match[1]) !== -1) {
              voiceCards[vi].classList.add('selected');
            }
          }
        }
        // v24.26: Pre-fill Audience & Values (step 9)
        if (aiData.audience) { var aud = document.getElementById('wizardBrandAudience'); if (aud) aud.value = aiData.audience; }
        if (aiData.products) { var prod = document.getElementById('wizardBrandProblem'); if (prod) prod.value = aiData.products; }
        // v24.26: Store full AI data for later use
        window._analyzedBrandData = aiData;
        showToast('Website analyzed - all steps populated', 'success');
      }
    } else {
      if (meta.title) { var n2 = document.getElementById('wizardBrandName'); if (n2 && !n2.value) n2.value = meta.title; }
      if (meta.description) { var d2 = document.getElementById('wizardBrandDescription'); if (d2 && !d2.value) d2.value = meta.description; }
      showToast('Basic info extracted from website', 'success');
    }
  } catch(e) { console.error('[Analyze]', e); showToast('Could not analyze website', 'error'); }
  if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>Analyze'; }
  if (status) status.style.display = 'none';
}

// v26.5: Save website URL and continue to API key step (crawl starts after key validation)
function saveWebsiteUrlAndContinue() {
  var urlInput = document.getElementById('websiteImportUrl');
  if (!urlInput) return;
  var url = urlInput.value.trim();
  if (!url) { showToast('Please enter a website URL', 'warning'); return; }
  if (url.indexOf('.') === -1) { showToast('Please enter a valid domain', 'warning'); return; }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  window._pendingWebSearchUrl = url;
  localStorage.setItem('roweos_pending_web_search_url', url);
  goToOnboardingStep(3);
}

// v26.5: Start web search after API key is validated
async function startOnboardingWebSearch() {
  var url = window._pendingWebSearchUrl || localStorage.getItem('roweos_pending_web_search_url');
  if (!url) return;
  // Use the onboarding provider variable, or fall back to any brand's settings, or localStorage
  var provider = (typeof onboardingSelectedProvider !== 'undefined' && onboardingSelectedProvider)
    ? onboardingSelectedProvider
    : (localStorage.getItem('roweos_provider') || 'anthropic');
  // Find model from any existing brandSettings entry for this provider
  var model = '';
  if (typeof brandSettings !== 'undefined') {
    for (var bsk in brandSettings) {
      if (brandSettings[bsk] && brandSettings[bsk].provider === provider && brandSettings[bsk].model) {
        model = brandSettings[bsk].model;
        break;
      }
    }
  }
  if (!model) {
    if (provider === 'anthropic') model = 'claude-sonnet-4-6';
    else if (provider === 'openai') model = 'gpt-5.4';
    else model = 'gemini-3.1-pro-preview';
  }
  // Use the proper getApiKey function (handles both new and old storage formats)
  var apiKey = '';
  try { apiKey = await getApiKey(provider); } catch(e) {}
  if (!apiKey) { console.warn('[WebSearch] No API key found for', provider, '- skipping web search'); return; }
  var brandName = localStorage.getItem('roweos_brand_name') || '';
  var isLife = document.documentElement.classList.contains('life-mode');
  startWebSearch(url, provider, apiKey, model, brandName, isLife ? 'life' : 'brand', {
    onProgress: function(state, msg) {
      renderFloatingIndicator(state);
      console.log('[WebSearch]', msg);
    },
    onComplete: function(results) {
      renderFloatingIndicator(_webSearchState);
      console.log('[WebSearch] Complete:', results);
      var reviewStep = document.getElementById('onboardingWebSearchReview');
      if (reviewStep && reviewStep.style.display !== 'none') {
        _showWebSearchResults();
      }
    },
    onError: function(err) {
      renderFloatingIndicator(_webSearchState);
      console.error('[WebSearch] Error:', err);
      showToast('Web search encountered an issue. You can fill in details manually.', 'warning');
    }
  });
}

// v26.5: Show web search results on the review step
function _showWebSearchResults() {
  var state = getWebSearchState();
  var takeover = document.getElementById('webSearchTakeover');
  var canvas = document.getElementById('wsGraphCanvas');
  var cardsContainer = document.getElementById('wsCardsContainer');
  var subtitle = document.getElementById('wsReviewSubtitle');
  var continueBtn = document.getElementById('wsReviewContinueBtn');

  if (takeover) takeover.classList.add('active');
  if (canvas) renderNetworkGraph(canvas, state);
  if (cardsContainer) renderIdentityCards(cardsContainer, state);

  if (state.status === 'complete' && state.finalResults) {
    if (subtitle) subtitle.textContent = 'Your brand identity has been built and saved to Identity.';
    if (continueBtn) continueBtn.style.display = '';
    // Stagger card fills
    if (cardsContainer) {
      var cards = cardsContainer.querySelectorAll('.ws-identity-card');
      for (var ci = 0; ci < cards.length; ci++) {
        (function(card, delay) {
          setTimeout(function() {
            card.classList.remove('analyzing');
            card.classList.add('filled');
          }, delay);
        })(cards[ci], ci * 150);
      }
    }
    // Collapse graph nodes to center, then replace with summary
    var graphPanel = canvas ? canvas.parentElement : null;
    collapseNetworkGraph(canvas, state, function() {
      // Replace graph canvas with a text summary
      if (graphPanel) {
        var pagesFound = state.pages ? state.pages.filter(function(p) { return p.status === 'done' && !p.isExternal; }).length : 0;
        var extSearches = state.pages ? state.pages.filter(function(p) { return p.isExternal; }).length : 0;
        var sectionsFound = 0;
        var sectionKeys = state.mode === 'brand'
          ? ['essence', 'voice', 'audience', 'messaging', 'products', 'visual', 'competitive']
          : ['role', 'skills', 'communication', 'interests', 'goals', 'routine', 'personality'];
        for (var sk = 0; sk < sectionKeys.length; sk++) {
          if (state.finalResults[sectionKeys[sk]]) sectionsFound++;
        }
        var summaryHtml = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;opacity:0;transition:opacity 0.6s ease;">'
          + '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#a89878" stroke-width="1.5" style="opacity:0.8;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
          + '<div style="font-size:18px;font-weight:600;color:var(--text-primary);">Analysis Complete</div>'
          + '<div style="display:flex;gap:24px;margin-top:4px;">'
          + '<div style="text-align:center;"><div style="font-size:24px;font-weight:700;color:var(--accent, #a89878);">' + pagesFound + '</div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Pages Scanned</div></div>'
          + '<div style="text-align:center;"><div style="font-size:24px;font-weight:700;color:var(--accent, #a89878);">' + extSearches + '</div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Web Searches</div></div>'
          + '<div style="text-align:center;"><div style="font-size:24px;font-weight:700;color:var(--accent, #a89878);">' + sectionsFound + '</div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Sections Built</div></div>'
          + '</div></div>';
        graphPanel.innerHTML = summaryHtml;
        // Fade in
        setTimeout(function() {
          var summaryDiv = graphPanel.querySelector('div');
          if (summaryDiv) summaryDiv.style.opacity = '1';
        }, 50);
      }
    });
  } else if (state.status === 'error') {
    if (subtitle) subtitle.textContent = 'We had trouble analyzing the website. You can fill in the details manually.';
    if (continueBtn) continueBtn.style.display = '';
  } else {
    if (subtitle) subtitle.textContent = 'Analyzing your website and the web...';
    var checkInterval = setInterval(function() {
      var s = getWebSearchState();
      if (cardsContainer) renderIdentityCards(cardsContainer, s);
      if (canvas) renderNetworkGraph(canvas, s);
      if (s.status === 'complete' || s.status === 'error') {
        clearInterval(checkInterval);
        _showWebSearchResults();
      }
    }, 1000);
  }
}

// ============================================================
// v27.0: Research View
// ============================================================

var _researchHistory = [];
var _researchCurrentResult = null;

function renderResearchView() {
  loadResearchHistory();
  renderResearchHistory();
  if (window._researchPrefill) {
    var urlInput = document.getElementById('researchUrlInput');
    if (urlInput && window._researchPrefill.url) {
      urlInput.value = window._researchPrefill.url.replace(/^https?:\/\//, '');
    }
    window._researchPrefill = null;
  }
  var vis = document.getElementById('researchVisualContainer');
  var actions = document.getElementById('researchActionsBar');
  var sources = document.getElementById('researchSourcesList');
  var summary = document.getElementById('researchSummaryBar');
  if (vis) vis.style.display = 'none';
  if (actions) actions.style.display = 'none';
  if (sources) sources.style.display = 'none';
  if (summary) summary.style.display = 'none';
  var histSection = document.getElementById('researchHistorySection');
  if (histSection) histSection.style.display = '';
  // v27.0: First-visit tour prompt
  if (localStorage.getItem('roweos_tour_research') !== 'true') {
    var _existingPrompt = document.getElementById('researchTourPrompt');
    if (!_existingPrompt) {
      var histSection = document.getElementById('researchHistorySection');
      if (histSection) {
        var tourPrompt = document.createElement('div');
        tourPrompt.id = 'researchTourPrompt';
        tourPrompt.style.cssText = 'text-align:center;padding:20px;margin-top:var(--space-4);background:rgba(168,152,120,0.06);border:1px solid rgba(168,152,120,0.15);border-radius:var(--radius-md);';
        tourPrompt.innerHTML = '<p style="margin:0 0 12px;color:var(--text-secondary);font-size:var(--text-sm);">First time here? Take a quick tour of Research.</p>' +
          '<div style="display:flex;gap:8px;justify-content:center;">' +
          '<button class="btn btn-primary" onclick="localStorage.setItem(\'roweos_tour_research\',\'true\');document.getElementById(\'researchTourPrompt\').remove();if(typeof startGuidedTour===\'function\')startGuidedTour(\'research\')" style="padding:8px 20px;font-size:var(--text-sm);">Start Tour</button>' +
          '<button class="btn btn-secondary" onclick="localStorage.setItem(\'roweos_tour_research\',\'true\');document.getElementById(\'researchTourPrompt\').remove()" style="padding:8px 16px;font-size:var(--text-sm);">Dismiss</button>' +
          '</div>';
        histSection.parentNode.insertBefore(tourPrompt, histSection);
      }
    }
  }
}

function switchResearchTab(tabId) {
  if (tabId === 'search') {
    var urlInput = document.getElementById('researchUrlInput');
    if (urlInput) urlInput.focus();
  } else if (tabId === 'history') {
    renderResearchHistory();
  }
}

function startResearchFromView() {
  var urlInput = document.getElementById('researchUrlInput');
  if (!urlInput) return;
  var url = urlInput.value.trim();
  if (!url) { showToast('Please enter a URL', 'warning'); return; }
  if (url.indexOf('.') === -1) { showToast('Please enter a valid domain', 'warning'); return; }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  var currentMode = localStorage.getItem('roweos_app_mode') || 'brand';
  var provider = 'anthropic';
  var model = 'claude-sonnet-4-6';
  if (currentMode === 'brand' && typeof brandSettings !== 'undefined' && typeof selectedBrand !== 'undefined') {
    var bs = brandSettings[selectedBrand];
    var _validProviders = ['anthropic', 'openai', 'google'];
    if (bs && bs.provider && _validProviders.indexOf(bs.provider) !== -1) provider = bs.provider;
  }
  // v27.0: Force valid model names -- always use the primary model per provider
  if (provider === 'anthropic') model = 'claude-sonnet-4-6';
  else if (provider === 'openai') model = 'gpt-5.4';
  else if (provider === 'google') model = 'gemini-3.1-pro-preview';

  // Get research context if provided
  var contextInput = document.getElementById('researchContextInput');
  var researchContext = contextInput ? contextInput.value.trim() : '';

  (async function() {
    var apiKey = '';
    try { apiKey = await getApiKey(provider); } catch(e) {}
    // Fallback: try other providers if primary fails
    if (!apiKey) {
      var _fallbacks = ['anthropic', 'openai', 'google'].filter(function(p) { return p !== provider; });
      for (var _fi = 0; _fi < _fallbacks.length; _fi++) {
        try { apiKey = await getApiKey(_fallbacks[_fi]); } catch(e) {}
        if (apiKey) { provider = _fallbacks[_fi]; break; }
      }
    }
    if (!apiKey) {
      showToast('No API key found. Add one in Settings > API Keys.', 'error');
      return;
    }

    var vis = document.getElementById('researchVisualContainer');
    var histSection = document.getElementById('researchHistorySection');
    var cancelBtn = document.getElementById('researchCancelBtn');
    var goBtn = document.getElementById('researchGoBtn');
    if (vis) vis.style.display = '';
    if (histSection) histSection.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = '';
    if (goBtn) goBtn.style.display = 'none';

    var summaryEl = document.getElementById('researchSummaryBar');
    var actionsEl = document.getElementById('researchActionsBar');
    var sourcesEl = document.getElementById('researchSourcesList');
    if (summaryEl) summaryEl.style.display = 'none';
    if (actionsEl) actionsEl.style.display = 'none';
    if (sourcesEl) sourcesEl.style.display = 'none';

    var brandName = '';
    if (currentMode === 'brand' && typeof brands !== 'undefined' && typeof selectedBrand !== 'undefined' && brands[selectedBrand]) {
      brandName = brands[selectedBrand].name || '';
    }

    var startTime = Date.now();

    startWebSearch(url, provider, apiKey, model, brandName, currentMode, {
      onProgress: function(state, msg) {
        renderFloatingIndicator(state);
        var canvas = document.getElementById('researchGraphCanvas');
        var cardsEl = document.getElementById('researchCardsContainer');
        if (canvas && typeof renderNetworkGraph === 'function') renderNetworkGraph(canvas, state);
        if (cardsEl && typeof renderIdentityCards === 'function') renderIdentityCards(cardsEl, state);
      },
      onComplete: function(results) {
        renderFloatingIndicator(_webSearchState);
        _researchCurrentResult = {
          url: url,
          state: JSON.parse(JSON.stringify(_webSearchState)),
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime
        };
        showResearchResults(_researchCurrentResult);
        saveResearchToHistory(_researchCurrentResult);
        var cancelBtn2 = document.getElementById('researchCancelBtn');
        var goBtn2 = document.getElementById('researchGoBtn');
        if (cancelBtn2) cancelBtn2.style.display = 'none';
        if (goBtn2) { goBtn2.style.display = ''; goBtn2.textContent = 'New Search'; }
      },
      onError: function(err) {
        renderFloatingIndicator(_webSearchState);
        var errMsg = (err && err.message) ? err.message : String(err);
        console.error('[Research] Pipeline error:', errMsg);
        showToast('Research failed: ' + errMsg.substring(0, 100), 'error', 8000);
        // Show error details in the summary bar
        var summaryEl = document.getElementById('researchSummaryBar');
        if (summaryEl) {
          summaryEl.style.display = '';
          summaryEl.innerHTML = '<span style="color:#ef4444;font-weight:600;">Error</span> &nbsp; ' + escapeHtml(errMsg.substring(0, 200)) +
            '<br><span style="font-size:11px;color:var(--text-muted);margin-top:4px;display:inline-block;">Check browser console for details. Common fixes: verify API key in Settings, try a different provider.</span>';
        }
        var cancelBtn3 = document.getElementById('researchCancelBtn');
        var goBtn3 = document.getElementById('researchGoBtn');
        if (cancelBtn3) cancelBtn3.style.display = 'none';
        if (goBtn3) { goBtn3.style.display = ''; goBtn3.textContent = 'Retry'; }
      }
    }, researchContext);
  })();
}

function cancelResearch() {
  if (typeof _webSearchState !== 'undefined') _webSearchState._aborted = true;
  var cancelBtn = document.getElementById('researchCancelBtn');
  var goBtn = document.getElementById('researchGoBtn');
  if (cancelBtn) cancelBtn.style.display = 'none';
  if (goBtn) { goBtn.style.display = ''; goBtn.textContent = 'Research'; }
  showToast('Research cancelled', 'info');
}

function showResearchResults(result) {
  var state = result.state;
  var pages = state.pages || [];
  var donePages = pages.filter(function(p) { return p.status === 'done'; });
  var externalPages = pages.filter(function(p) { return p.isExternal; });
  var durationSec = Math.round((result.durationMs || 0) / 1000);

  // Summary bar
  var summary = document.getElementById('researchSummaryBar');
  if (summary) {
    summary.style.display = '';
    summary.innerHTML = '<span style="font-weight:600;color:var(--text-primary);">Complete</span> &nbsp; ' +
      donePages.length + ' pages scanned &bull; ' +
      externalPages.length + ' web sources &bull; ' +
      durationSec + 's';
  }

  // Network graph
  var canvas = document.getElementById('researchGraphCanvas');
  if (canvas && typeof renderNetworkGraph === 'function') renderNetworkGraph(canvas, state);

  // v27.0: Render expandable identity cards (not the truncated onboarding version)
  var cardsEl = document.getElementById('researchCardsContainer');
  if (cardsEl && state.finalResults) {
    var isBrand = state.mode === 'brand';
    var sections = isBrand
      ? [
          { key: 'essence', label: 'Brand Essence', icon: '\u2726' },
          { key: 'voice', label: 'Voice & Tone', icon: '\u25CE' },
          { key: 'audience', label: 'Target Audience', icon: '\u25C7' },
          { key: 'messaging', label: 'Key Messaging', icon: '\u25C6' },
          { key: 'products', label: 'Products & Services', icon: '\u25A3' },
          { key: 'visual', label: 'Visual Identity', icon: '\u2727' },
          { key: 'competitive', label: 'Competitive Positioning', icon: '\u2B21' }
        ]
      : [
          { key: 'role', label: 'Role & Profession', icon: '\u25CE' },
          { key: 'skills', label: 'Skills & Expertise', icon: '\u2726' },
          { key: 'communication', label: 'Communication Style', icon: '\u25C7' },
          { key: 'interests', label: 'Interests & Passions', icon: '\u25C6' },
          { key: 'goals', label: 'Goals', icon: '\u25A3' },
          { key: 'routine', label: 'Daily Routine', icon: '\u2727' },
          { key: 'personality', label: 'Personality Traits', icon: '\u2B21' }
        ];

    var chtml = '';
    for (var ci = 0; ci < sections.length; ci++) {
      var s = sections[ci];
      var content = state.finalResults[s.key] || '';
      var preview = content.length > 150 ? content.substring(0, 150) + '...' : content;
      var hasMore = content.length > 150;
      chtml += '<div class="ws-identity-card filled" data-section="' + s.key + '" style="cursor:' + (hasMore ? 'pointer' : 'default') + ';" onclick="toggleResearchCard(this)">';
      chtml += '<div class="ws-card-label" style="display:flex;align-items:center;justify-content:space-between;">';
      chtml += '<span>' + s.icon + ' ' + s.label + '</span>';
      if (hasMore) chtml += '<svg class="research-card-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="transition:transform 0.2s;flex-shrink:0;"><polyline points="6 9 12 15 18 9"/></svg>';
      chtml += '</div>';
      chtml += '<div class="ws-card-content research-card-preview">' + escapeHtml(preview) + '</div>';
      chtml += '<div class="ws-card-content research-card-full" style="display:none;white-space:pre-wrap;line-height:1.6;">' + escapeHtml(content) + '</div>';
      chtml += '</div>';
    }
    cardsEl.innerHTML = chtml;
  } else if (cardsEl) {
    // Still loading -- use the standard renderer
    if (typeof renderIdentityCards === 'function') renderIdentityCards(cardsEl, state);
  }

  // Action buttons
  var actions = document.getElementById('researchActionsBar');
  if (actions) actions.style.display = 'flex';

  // v27.0: Collapsible sources list
  var sourcesList = document.getElementById('researchSourcesList');
  if (sourcesList) {
    sourcesList.style.display = '';
    var sourceCount = 0;
    for (var si = 0; si < pages.length; si++) {
      if (pages[si].status === 'done' || pages[si].isExternal) sourceCount++;
    }
    var shtml = '<div onclick="toggleResearchSources()" style="display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;">';
    shtml += '<svg id="researchSourcesChevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="transition:transform 0.2s;"><polyline points="6 9 12 15 18 9"/></svg>';
    shtml += '<h4 style="font-size:var(--text-sm);font-weight:600;color:var(--text-secondary);margin:0;">Sources Used (' + sourceCount + ')</h4>';
    shtml += '</div>';
    shtml += '<div id="researchSourcesBody" style="display:none;margin-top:8px;display:flex;flex-direction:column;gap:4px;">';
    for (var i = 0; i < pages.length; i++) {
      if (pages[i].status !== 'done' && !pages[i].isExternal) continue;
      var depthLabel = pages[i].depth === 0 ? 'main' : pages[i].isExternal ? 'web' : 'depth ' + pages[i].depth;
      shtml += '<div style="font-size:var(--text-xs);color:var(--text-muted);display:flex;gap:8px;align-items:baseline;">';
      shtml += '<span style="color:var(--accent);min-width:36px;">' + depthLabel + '</span>';
      shtml += '<a href="' + escapeHtml(pages[i].url) + '" target="_blank" rel="noopener" style="color:var(--text-secondary);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(pages[i].url) + '</a>';
      shtml += '</div>';
    }
    shtml += '</div>';
    sourcesList.innerHTML = shtml;
  }
}

function toggleResearchCard(cardEl) {
  var preview = cardEl.querySelector('.research-card-preview');
  var full = cardEl.querySelector('.research-card-full');
  var chevron = cardEl.querySelector('.research-card-chevron');
  if (!preview || !full) return;
  var isExpanded = full.style.display !== 'none';
  preview.style.display = isExpanded ? '' : 'none';
  full.style.display = isExpanded ? 'none' : '';
  if (chevron) chevron.style.transform = isExpanded ? '' : 'rotate(180deg)';
}
window.toggleResearchCard = toggleResearchCard;

function toggleResearchSources() {
  var body = document.getElementById('researchSourcesBody');
  var chevron = document.getElementById('researchSourcesChevron');
  if (!body) return;
  var isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'flex';
  if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
}
window.toggleResearchSources = toggleResearchSources;

function loadResearchHistory() {
  try {
    _researchHistory = JSON.parse(localStorage.getItem('roweos_research_history') || '[]');
  } catch(e) { _researchHistory = []; }
}

function saveResearchHistoryToStorage() {
  localStorage.setItem('roweos_research_history', JSON.stringify(_researchHistory));
  if (typeof writeDB === 'function' && typeof firebaseUser !== 'undefined' && firebaseUser) {
    writeDB('profile/researchHistory', { items: _researchHistory });
  }
}

function saveResearchToHistory(result) {
  var state = result.state;
  var domain = '';
  try { domain = new URL(result.url).hostname; } catch(e) { domain = result.url; }
  var pages = state.pages || [];
  var sections = {};
  if (state.finalResults) {
    Object.keys(state.finalResults).forEach(function(k) {
      sections[k] = (state.finalResults[k] || '').substring(0, 100);
    });
  }

  var entry = {
    id: 'research_' + Date.now(),
    url: result.url,
    domain: domain,
    mode: state.mode || (localStorage.getItem('roweos_app_mode') || 'brand'),
    brandName: state.brandName || null,
    profileName: (state.mode === 'life' && typeof getCurrentLifeProfile === 'function') ? (getCurrentLifeProfile() || {}).name || null : null,
    status: state.status === 'complete' ? 'complete' : 'error',
    completedAt: result.completedAt,
    pageCount: pages.filter(function(p) { return p.status === 'done'; }).length,
    sourceCount: pages.filter(function(p) { return p.isExternal; }).length,
    durationMs: result.durationMs,
    sections: sections,
    fullResults: state.finalResults || {},
    pages: pages.map(function(p) { return { url: p.url, title: p.title || '', depth: p.depth, isExternal: !!p.isExternal }; })
  };

  _researchHistory.unshift(entry);
  if (_researchHistory.length > 20) _researchHistory = _researchHistory.slice(0, 20);
  saveResearchHistoryToStorage();
  renderResearchHistory();
}

function renderResearchHistory() {
  var grid = document.getElementById('researchHistoryGrid');
  var empty = document.getElementById('researchHistoryEmpty');
  if (!grid) return;

  var currentMode = localStorage.getItem('roweos_app_mode') || 'brand';
  var filtered = _researchHistory.filter(function(h) { return h.mode === currentMode; });

  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  var html = '';
  for (var i = 0; i < filtered.length; i++) {
    var h = filtered[i];
    var dateStr = '';
    try { dateStr = new Date(h.completedAt).toLocaleDateString(); } catch(e) {}
    html += '<div class="research-history-card" onclick="loadResearchFromHistory(\'' + escapeHtml(h.id) + '\')">';
    html += '<div class="research-card-domain">' + escapeHtml(h.domain) + '</div>';
    html += '<div class="research-card-meta">' + (h.pageCount || 0) + ' pages &bull; ' + dateStr + '</div>';
    if (h.brandName) html += '<div class="research-card-brand">' + escapeHtml(h.brandName) + '</div>';
    if (h.profileName) html += '<div class="research-card-brand">' + escapeHtml(h.profileName) + '</div>';
    html += '</div>';
  }
  grid.innerHTML = html;
}

function loadResearchFromHistory(id) {
  var entry = _researchHistory.find(function(h) { return h.id === id; });
  if (!entry) { showToast('Research not found', 'error'); return; }

  var vis = document.getElementById('researchVisualContainer');
  var histSection = document.getElementById('researchHistorySection');
  if (vis) vis.style.display = '';
  if (histSection) histSection.style.display = 'none';

  var urlInput = document.getElementById('researchUrlInput');
  if (urlInput) urlInput.value = entry.url.replace(/^https?:\/\//, '');

  var fakeState = {
    status: 'complete',
    url: entry.url,
    mode: entry.mode,
    brandName: entry.brandName || '',
    pages: entry.pages || [],
    finalResults: entry.fullResults || {},
    gapAnalysis: {},
    externalResults: ''
  };

  _researchCurrentResult = {
    url: entry.url,
    state: fakeState,
    completedAt: entry.completedAt,
    durationMs: entry.durationMs
  };

  showResearchResults(_researchCurrentResult);
}

function clearResearchHistory() {
  if (!confirm('Clear all research history?')) return;
  _researchHistory = [];
  saveResearchHistoryToStorage();
  renderResearchHistory();
  showToast('Research history cleared', 'success');
}

function saveResearchToIdentity() {
  if (!_researchCurrentResult || !_researchCurrentResult.state.finalResults) {
    showToast('No research results to save', 'warning');
    return;
  }
  var currentMode = localStorage.getItem('roweos_app_mode') || 'brand';
  var results = _researchCurrentResult.state.finalResults;

  if (currentMode === 'brand') {
    var brandIdx = (typeof selectedBrand !== 'undefined') ? selectedBrand : 0;
    if (!brands || !brands[brandIdx]) { showToast('No brand selected', 'error'); return; }
    var brand = brands[brandIdx];
    if (!brand.identityData) brand.identityData = {};
    var bSections = ['essence', 'voice', 'audience', 'messaging', 'products', 'visual', 'competitive'];
    for (var i = 0; i < bSections.length; i++) {
      if (results[bSections[i]]) {
        if (!brand.identityData[bSections[i]]) brand.identityData[bSections[i]] = {};
        brand.identityData[bSections[i]].ai = results[bSections[i]];
      }
    }
    if (results.essence && !brand.positioning) brand.positioning = results.essence.substring(0, 300);
    if (results.voice && !brand.voice) brand.voice = results.voice.substring(0, 200);
    if (results.audience && !brand.audience) brand.audience = results.audience.substring(0, 300);
    if (results.products && !brand.products) brand.products = results.products.substring(0, 300);
    brand.website = brand.website || _researchCurrentResult.url;
    saveBrands();
    showToast('Research saved to ' + (brand.shortName || brand.name) + "'s identity", 'success');
  } else {
    var profiles = typeof getLifeProfiles === 'function' ? getLifeProfiles() : [];
    var profileIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
    var profile = profiles[profileIdx];
    if (!profile) { showToast('No life profile found', 'error'); return; }
    if (!profile.identityData) profile.identityData = {};
    if (results.role) {
      if (!profile.identityData.work) profile.identityData.work = [];
      profile.identityData.work.push({ type: 'role', value: results.role, source: 'research', addedAt: new Date().toISOString() });
    }
    if (results.skills) {
      if (!profile.identityData.work) profile.identityData.work = [];
      profile.identityData.work.push({ type: 'skills', value: results.skills, source: 'research', addedAt: new Date().toISOString() });
    }
    if (results.interests) {
      if (!profile.identityData.personal) profile.identityData.personal = [];
      profile.identityData.personal.push({ type: 'interests', value: results.interests, source: 'research', addedAt: new Date().toISOString() });
    }
    if (results.personality) {
      if (!profile.identityData.personal) profile.identityData.personal = [];
      profile.identityData.personal.push({ type: 'trait', value: results.personality, source: 'research', addedAt: new Date().toISOString() });
    }
    if (results.communication) {
      if (!profile.preferences) profile.preferences = {};
      profile.preferences.communicationStyle = results.communication;
    }
    if (typeof saveLifeProfiles === 'function') saveLifeProfiles(profiles);
    showToast('Research saved to ' + (profile.name || 'life profile'), 'success');
  }
}

function sendResearchToChat() {
  if (!_researchCurrentResult || !_researchCurrentResult.state.finalResults) {
    showToast('No research results to send', 'warning');
    return;
  }
  var results = _researchCurrentResult.state.finalResults;
  var pages = _researchCurrentResult.state.pages || [];
  var text = 'Here is research from ' + _researchCurrentResult.url + ':\n\n';
  Object.keys(results).forEach(function(key) {
    if (results[key]) {
      text += '## ' + key.charAt(0).toUpperCase() + key.slice(1) + '\n' + results[key] + '\n\n';
    }
  });
  text += '## Sources\n';
  pages.forEach(function(p) {
    if (p.status === 'done' || p.isExternal) text += '- ' + p.url + '\n';
  });

  if (typeof currentConversation !== 'undefined') {
    currentConversation.push({ role: 'user', content: text });
  }
  showView('agent');
  showToast('Research sent to chat', 'success');
}

function saveResearchToLibrary() {
  if (!_researchCurrentResult || !_researchCurrentResult.state.finalResults) {
    showToast('No research results to save', 'warning');
    return;
  }
  var results = _researchCurrentResult.state.finalResults;
  var pages = _researchCurrentResult.state.pages || [];
  var domain = '';
  try { domain = new URL(_researchCurrentResult.url).hostname; } catch(e) { domain = _researchCurrentResult.url; }
  var dateStr = new Date().toLocaleDateString();

  var md = '# Research: ' + domain + '\nDate: ' + dateStr + '\nURL: ' + _researchCurrentResult.url + '\n\n';
  Object.keys(results).forEach(function(key) {
    if (results[key]) {
      md += '## ' + key.charAt(0).toUpperCase() + key.slice(1) + '\n' + results[key] + '\n\n';
    }
  });
  md += '## Sources\n';
  pages.forEach(function(p) {
    if (p.status === 'done' || p.isExternal) md += '- ' + p.url + '\n';
  });

  var currentMode = localStorage.getItem('roweos_app_mode') || 'brand';
  var key = currentMode === 'life' ? '_life' : (brands && brands[selectedBrand] ? (brands[selectedBrand].shortName || brands[selectedBrand].name) : 'default');
  if (!fileLibrary[key]) fileLibrary[key] = { folders: [{ id: 'root', name: 'Root', parentId: null }], files: [] };
  fileLibrary[key].files.push({
    id: 'file_' + Date.now(),
    name: 'Research - ' + domain + ' - ' + dateStr,
    type: 'text/markdown',
    content: md,
    folderId: 'root',
    createdAt: new Date().toISOString(),
    metadata: { source: 'research', url: _researchCurrentResult.url, pageCount: (pages.filter(function(p) { return p.status === 'done'; })).length }
  });
  localStorage.setItem('roweos_file_library', JSON.stringify(fileLibrary));
  if (typeof writeDB === 'function') writeDB('library/brand', { data: JSON.stringify(fileLibrary) });
  showToast('Research saved to Library', 'success');
}

function saveResearchToFolio() {
  if (!_researchCurrentResult || !_researchCurrentResult.state.finalResults) {
    showToast('No research results to save', 'warning');
    return;
  }
  var results = _researchCurrentResult.state.finalResults;
  var domain = '';
  try { domain = new URL(_researchCurrentResult.url).hostname; } catch(e) { domain = _researchCurrentResult.url; }

  var html = '<!DOCTYPE html><html><head><style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#e0d6c8;background:#1a1a1a;}h1{color:#a89878;}h2{color:#c4b69c;border-bottom:1px solid #333;padding-bottom:8px;}a{color:#a89878;}</style></head><body>';
  html += '<h1>Research: ' + escapeHtml(domain) + '</h1>';
  html += '<p style="color:#888;">URL: <a href="' + escapeHtml(_researchCurrentResult.url) + '">' + escapeHtml(_researchCurrentResult.url) + '</a></p>';
  Object.keys(results).forEach(function(key) {
    if (results[key]) {
      html += '<h2>' + escapeHtml(key.charAt(0).toUpperCase() + key.slice(1)) + '</h2>';
      html += '<p>' + escapeHtml(results[key]).replace(/\n/g, '<br>') + '</p>';
    }
  });
  html += '</body></html>';

  var now = new Date().toISOString();
  var brandName = '';
  var brandIdx = 0;
  if (typeof brands !== 'undefined' && typeof selectedBrand !== 'undefined' && brands[selectedBrand]) {
    brandName = brands[selectedBrand].shortName || brands[selectedBrand].name;
    brandIdx = selectedBrand;
  }

  var item = {
    id: 'folio_' + Date.now(),
    title: 'Research: ' + domain,
    html: html,
    thumbnail: null,
    versions: [{ id: 'v_' + Date.now(), html: html, description: 'Web research', timestamp: now, source: 'research' }],
    comments: [],
    conversation: [],
    branchedFrom: null,
    brand: brandName,
    brandIdx: brandIdx,
    createdAt: now,
    updatedAt: now,
    pinned: false
  };

  if (typeof saveFolioItem === 'function' && saveFolioItem(item) !== false) {
    showToast('Research added to Folio', 'success');
  } else {
    showToast('Could not save to Folio', 'error');
  }
}

// v28.4: Add research results as a new client
function addResearchToClient() {
  if (!_researchCurrentResult || !_researchCurrentResult.state.finalResults) {
    showToast('No research results to add', 'warning');
    return;
  }
  var results = _researchCurrentResult.state.finalResults;
  var url = _researchCurrentResult.url || '';
  // Extract company/brand name from essence or URL
  var companyName = '';
  if (results.essence) {
    // Try to extract brand name from first sentence of essence
    var firstLine = results.essence.split('\n')[0].substring(0, 100);
    companyName = firstLine;
  }
  if (!companyName && url) {
    try { companyName = new URL(url).hostname.replace('www.', ''); } catch(e) {}
  }
  // Build notes from research sections
  var notes = '';
  var sections = ['essence', 'voice', 'audience', 'messaging', 'products', 'visual', 'competitive'];
  for (var i = 0; i < sections.length; i++) {
    if (results[sections[i]]) {
      notes += sections[i].charAt(0).toUpperCase() + sections[i].slice(1) + ':\n' + results[sections[i]] + '\n\n';
    }
  }
  // Open client modal with pre-filled data
  if (typeof openClientModal === 'function') openClientModal();
  setTimeout(function() {
    var companyEl = document.getElementById('clientCompany');
    var notesEl = document.getElementById('clientNotes');
    var websiteEl = document.getElementById('clientWebsite');
    if (companyEl) companyEl.value = companyName;
    if (notesEl) notesEl.value = notes.trim();
    if (websiteEl) websiteEl.value = url;
    showToast('Research loaded into client form', 'success');
  }, 200);
}

function copyResearchResults() {
  if (!_researchCurrentResult || !_researchCurrentResult.state.finalResults) {
    showToast('No research results to copy', 'warning');
    return;
  }
  var results = _researchCurrentResult.state.finalResults;
  var pages = _researchCurrentResult.state.pages || [];
  var domain = '';
  try { domain = new URL(_researchCurrentResult.url).hostname; } catch(e) { domain = _researchCurrentResult.url; }

  var md = '# Research: ' + domain + '\nDate: ' + new Date().toLocaleDateString() + '\n\n';
  Object.keys(results).forEach(function(key) {
    if (results[key]) {
      md += '## ' + key.charAt(0).toUpperCase() + key.slice(1) + '\n' + results[key] + '\n\n';
    }
  });
  md += '## Sources\n';
  pages.forEach(function(p) {
    if (p.status === 'done' || p.isExternal) md += '- ' + p.url + '\n';
  });

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(md).then(function() {
      showToast('Research copied to clipboard', 'success');
    });
  } else {
    showToast('Copy not supported in this browser', 'warning');
  }
}

function launchResearch(url, brandIdx) {
  window._researchPrefill = { url: url || '', brandIdx: brandIdx };
  window._skipPageLanding = true;
  showView('research');
  if (url) {
    var urlInput = document.getElementById('researchUrlInput');
    if (urlInput) urlInput.value = url.replace(/^https?:\/\//, '');
  }
}

window.startResearchFromView = startResearchFromView;
window.cancelResearch = cancelResearch;
window.loadResearchFromHistory = loadResearchFromHistory;
window.clearResearchHistory = clearResearchHistory;
window.saveResearchToIdentity = saveResearchToIdentity;
window.sendResearchToChat = sendResearchToChat;
window.saveResearchToLibrary = saveResearchToLibrary;
window.saveResearchToFolio = saveResearchToFolio;
window.copyResearchResults = copyResearchResults;
window.launchResearch = launchResearch;
window.switchResearchTab = switchResearchTab;

// v26.5: Save web search results to brand identity
function saveWebSearchResults() {
  var state = getWebSearchState();
  var isBrand = state.mode === 'brand';
  if (isBrand) {
    var sections = ['essence', 'voice', 'audience', 'messaging', 'products', 'visual', 'competitive'];
    // Use the in-memory brands array (global var) so saveBrands() persists correctly
    var brandIdx = (typeof selectedBrand !== 'undefined' && selectedBrand >= 0) ? selectedBrand : parseInt(localStorage.getItem('roweos_selected_brand') || '0');
    var brand = (typeof brands !== 'undefined' && brands[brandIdx]) ? brands[brandIdx] : null;

    // If no brand exists yet (web search path skips completeBrandSetup), create one
    if (!brand) {
      var brandName = state.brandName || localStorage.getItem('roweos_brand_name') || 'My Brand';
      var selectedProvider = (typeof onboardingSelectedProvider !== 'undefined' && onboardingSelectedProvider) ? onboardingSelectedProvider : 'anthropic';
      var providerModels = { anthropic: 'claude-sonnet-4-6', openai: 'gpt-5.4', google: 'gemini-3.1-pro-preview' };
      brand = {
        id: 'brand_' + Date.now(),
        _modifiedAt: Date.now(),
        _createdAt: Date.now(),
        name: brandName,
        tagline: '',
        voice: 'professional, warm, thoughtful',
        positioning: '',
        products: '',
        audience: '',
        location: '',
        website: state.url || '',
        vocabDo: '',
        vocabDont: '',
        mission: '',
        brandColor: '#a89878',
        brandColorLight: '#a89878',
        importMethod: 'web-search',
        identityData: {}
      };
      if (typeof brands !== 'undefined') {
        brands.push(brand);
        brandIdx = brands.length - 1;
        selectedBrand = brandIdx;
        try { localStorage.setItem('roweos_selected_brand', String(brandIdx)); } catch(e) {}
        if (typeof brandSettings !== 'undefined') {
          brandSettings[brandIdx] = { provider: selectedProvider, model: providerModels[selectedProvider] || 'claude-sonnet-4-6' };
          try { localStorage.setItem(USER_DATA_KEYS.brandSettings, JSON.stringify(brandSettings)); } catch(e) {}
        }
      }
      // Merge ownership data if available
      if (window.onboardingOwnershipData) {
        brand.identityData.role = window.onboardingOwnershipData;
      }
    }

    if (!brand.identityData) brand.identityData = {};
    for (var i = 0; i < sections.length; i++) {
      var value = (state.finalResults && state.finalResults[sections[i]]) || '';
      if (value) {
        if (!brand.identityData[sections[i]]) brand.identityData[sections[i]] = {};
        brand.identityData[sections[i]].ai = value;
      }
    }
    // Also populate top-level brand fields from identity data
    if (state.finalResults) {
      if (state.finalResults.essence && !brand.positioning) brand.positioning = state.finalResults.essence.substring(0, 300);
      if (state.finalResults.voice && !brand.voice) brand.voice = state.finalResults.voice.substring(0, 200);
      if (state.finalResults.audience && !brand.audience) brand.audience = state.finalResults.audience.substring(0, 300);
      if (state.finalResults.products && !brand.products) brand.products = state.finalResults.products.substring(0, 300);
    }
    if (typeof saveBrands === 'function') saveBrands();
    if (typeof updateBrandSelectors === 'function') updateBrandSelectors();
    if (typeof queueBackgroundSync === 'function') queueBackgroundSync();
  } else {
    var profiles = typeof getLifeProfiles === 'function' ? getLifeProfiles() : [];
    var profileIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
    var profile = profiles[profileIdx];
    if (profile && state.finalResults) {
      if (!profile.identityData) profile.identityData = {};
      if (state.finalResults.role) {
        if (!profile.identityData.work) profile.identityData.work = [];
        profile.identityData.work.push({ type: 'role', value: state.finalResults.role, source: 'web-import', addedAt: new Date().toISOString() });
      }
      if (state.finalResults.skills) {
        if (!profile.identityData.work) profile.identityData.work = [];
        profile.identityData.work.push({ type: 'skills', value: state.finalResults.skills, source: 'web-import', addedAt: new Date().toISOString() });
      }
      if (state.finalResults.communication) {
        if (!profile.preferences) profile.preferences = {};
        profile.preferences.communicationStyle = state.finalResults.communication;
      }
      if (state.finalResults.interests) {
        if (!profile.identityData.personal) profile.identityData.personal = [];
        profile.identityData.personal.push({ type: 'interests', value: state.finalResults.interests, source: 'web-import', addedAt: new Date().toISOString() });
      }
      if (state.finalResults.personality) {
        if (!profile.identityData.personal) profile.identityData.personal = [];
        profile.identityData.personal.push({ type: 'trait', value: state.finalResults.personality, source: 'web-import', addedAt: new Date().toISOString() });
      }
      if (state.finalResults.goals) profile.aboutMe = (profile.aboutMe || '') + '\n\nGoals: ' + state.finalResults.goals;
      if (typeof saveLifeProfiles === 'function') saveLifeProfiles(profiles);
    }
  }
  // Also save website URL and description to brand basics
  if (isBrand && state.url && brand) {
    brand.website = state.url;
    if (state.finalResults && state.finalResults.products) {
      brand.description = state.finalResults.products.substring(0, 500);
    }
    if (typeof saveBrands === 'function') saveBrands();
  }
  window._pendingWebSearchUrl = null;
  localStorage.removeItem('roweos_pending_web_search_url');
  stopNetworkGraph();
  showToast('Brand identity saved!', 'success');
  // Skip Brand Basics (7), Voice & Tone (8), Audience & Values (9) -- already populated by web search
  // Skip Step 10 (Building) since brand already exists -- go straight to Step 11 (Ready)
  var wsIdx = (typeof selectedBrand !== 'undefined' && selectedBrand >= 0) ? selectedBrand : 0;
  var wsBrand = (typeof brands !== 'undefined' && brands[wsIdx]) ? brands[wsIdx] : null;
  if (wsBrand) populateStep11(wsBrand);
  goToOnboardingStep(11);
}

// v26.5: Populate Step 11 from brand identityData (web search) or brand fields (manual)
function populateStep11(brand) {
  if (!brand) return;
  var subtitle = document.getElementById('brandReadySubtitle');
  if (subtitle) subtitle.textContent = 'Meet ' + (brand.name || 'your brand') + ', your intelligent brand assistant powered by unique brand intelligence';

  var sections = ['essence', 'voice', 'audience', 'messaging', 'products', 'visual', 'competitive'];
  for (var i = 0; i < sections.length; i++) {
    var el = document.getElementById('s11_' + sections[i]);
    if (!el) continue;
    var value = '';
    // Try identityData.section.ai first (web search), then identityData.section.owner (manual)
    if (brand.identityData && brand.identityData[sections[i]]) {
      value = brand.identityData[sections[i]].ai || brand.identityData[sections[i]].owner || '';
    }
    // Fallback to brand top-level fields
    if (!value) {
      if (sections[i] === 'essence') value = brand.positioning || brand.description || '';
      else if (sections[i] === 'voice') value = brand.voice || '';
      else if (sections[i] === 'audience') value = brand.audience || '';
      else if (sections[i] === 'products') value = brand.products || '';
      else if (sections[i] === 'messaging') value = brand.tagline || '';
    }
    // Store full text, truncate for display
    var card = el.parentElement;
    if (card) card.setAttribute('data-full-text', value || '');
    if (value && value.length > 200) value = value.substring(0, 200) + '...';
    el.textContent = value || 'Will be set up in Identity';
  }
  // Add click-to-expand handlers
  var idCards = document.querySelectorAll('.step11-id-card');
  for (var ci = 0; ci < idCards.length; ci++) {
    idCards[ci].onclick = function() {
      var isExpanded = this.classList.contains('expanded');
      var valEl = this.querySelector('.step11-id-value');
      var fullText = this.getAttribute('data-full-text');
      if (isExpanded) {
        this.classList.remove('expanded');
        if (valEl && fullText && fullText.length > 200) valEl.textContent = fullText.substring(0, 200) + '...';
      } else {
        this.classList.add('expanded');
        if (valEl && fullText) valEl.textContent = fullText;
      }
    };
  }
}

async function parseWebsiteForBrand() {
  var urlInput = document.getElementById('websiteImportUrl');
  var url = urlInput.value.trim();
  
  if (!url) {
    showToast('Please enter a website URL', 'error');
    return;
  }
  
  // Add protocol if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  // Validate URL
  try {
    new URL(url);
  } catch (e) {
    showToast('Please enter a valid URL', 'error');
    return;
  }
  
  // Show parsing status
  var statusEl = document.getElementById('websiteParseStatus');
  var statusTextEl = document.getElementById('websiteParseStatusText');
  var extractedDataEl = document.getElementById('websiteExtractedData');
  var continueBtnEl = document.getElementById('websiteContinueBtn');
  
  statusEl.style.display = 'block';
  statusTextEl.textContent = 'Fetching website...';
  extractedDataEl.style.display = 'none';
  continueBtnEl.style.display = 'none';
  
  try {
    // v22.49: Use own fetch-site-meta endpoint instead of third-party proxy
    statusTextEl.textContent = 'Downloading page content...';

    // First fetch meta for basic extraction
    var metaResp = await fetch(window.location.origin + '/api/fetch-site-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url })
    });
    if (!metaResp.ok) {
      var metaErr = '';
      try { metaErr = (await metaResp.json()).error || ''; } catch(e) {}
      throw new Error(metaErr || 'Failed to fetch website');
    }
    var metaData = await metaResp.json();

    // Then fetch content for AI analysis
    var contentResp = await fetch(window.location.origin + '/api/fetch-site-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url, mode: 'content' })
    });
    var bodyText = '';
    if (contentResp.ok) {
      var contentData = await contentResp.json();
      bodyText = contentData.content || '';
    }

    statusTextEl.textContent = 'Extracting brand information...';

    // Basic extraction from meta tags
    var basicExtracted = {
      name: (metaData.title || '').split('|')[0].split('-')[0].trim(),
      tagline: metaData.description || '',
      essence: '',
      products: ''
    };

    // v22.49: Check all API key sources (new format roweos_api_keys)
    var aiApiKeys = {};
    try { aiApiKeys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}'); } catch(e) {}
    var hasAiKey = aiApiKeys.anthropic || aiApiKeys.openai || aiApiKeys.google;
    var extracted = basicExtracted;

    if (hasAiKey && bodyText.length > 100) {
      statusTextEl.textContent = 'Analyzing with AI...';
      
      try {
        var aiExtracted = await extractBrandInfoWithAI(
          'Website URL: ' + url + '\n\n' +
          'Page Title: ' + (basicExtracted.name || 'N/A') + '\n' +
          'Meta Description: ' + (basicExtracted.tagline || 'N/A') + '\n\n' +
          'Page Content:\n' + bodyText
        );
        
        // Merge AI extraction with basic extraction (AI takes priority)
        extracted = {
          name: aiExtracted.name || basicExtracted.name || '',
          tagline: aiExtracted.tagline || basicExtracted.tagline || '',
          essence: aiExtracted.essence || basicExtracted.essence || '',
          voice: aiExtracted.voice || '',
          audience: aiExtracted.audience || '',
          messaging: aiExtracted.messaging || '',
          products: aiExtracted.products || basicExtracted.products || '',
          visual: aiExtracted.visual || '',
          competitive: aiExtracted.competitive || ''
        };
      } catch (aiError) {
        console.error('[parseWebsiteForBrand] AI extraction error:', aiError);
        // Fall back to basic extraction
      }
    }
    
    // Fill in all extracted data fields
    document.getElementById('extractedBrandName').value = extracted.name || '';
    document.getElementById('extractedTagline').value = extracted.tagline || '';
    document.getElementById('extractedEssence').value = extracted.essence || '';
    document.getElementById('extractedVoice').value = extracted.voice || '';
    document.getElementById('extractedAudience').value = extracted.audience || '';
    document.getElementById('extractedMessaging').value = extracted.messaging || '';
    document.getElementById('extractedProducts').value = extracted.products || '';
    document.getElementById('extractedVisual').value = extracted.visual || '';
    document.getElementById('extractedCompetitive').value = extracted.competitive || '';
    
    // Store extracted data for later
    window.websiteExtractedData = extracted;
    window.websiteSourceUrl = url;
    
    // Show results
    statusEl.style.display = 'none';
    extractedDataEl.style.display = 'block';
    continueBtnEl.style.display = 'inline-flex';
    
    // Auto-scroll to the extracted data section
    setTimeout(function() {
      extractedDataEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    
    showToast('Website parsed successfully!', 'success');
    
  } catch (error) {
    console.error('[parseWebsiteForBrand] Error:', error);
    statusEl.style.display = 'none';
    showToast('Error fetching website: ' + error.message, 'error');
  }
}

/**
 * Continue with website extracted data
 */
function continueWithWebsiteData() {
  // Get values from extracted fields (user may have edited)
  var brandName = document.getElementById('extractedBrandName').value;
  var tagline = document.getElementById('extractedTagline').value;
  var essence = document.getElementById('extractedEssence').value;
  var voice = document.getElementById('extractedVoice').value;
  var audience = document.getElementById('extractedAudience').value;
  var messaging = document.getElementById('extractedMessaging').value;
  var products = document.getElementById('extractedProducts').value;
  var visual = document.getElementById('extractedVisual').value;
  var competitive = document.getElementById('extractedCompetitive').value;
  
  if (!brandName) {
    showToast('Please enter a brand name', 'error');
    return;
  }
  
  // v9.1.14: Store all identity fields for use in brand creation
  window.onboardingPrefillData = {
    brandName: brandName,
    tagline: tagline,
    essence: essence,
    voice: voice,
    audience: audience,
    messaging: messaging,
    products: products,
    visual: visual,
    competitive: competitive,
    sourceUrl: window.websiteSourceUrl,
    importMethod: 'website'
  };
  
  // Also update the stored brand name
  window.onboardingBrandName = brandName;
  
  console.log('[Onboarding] Website data stored with all identity fields, going to Brand Basics (step 7)');
  
  // Go directly to Brand Basics (step 7) - skip API since already done
  goToOnboardingStep(7);
}

/**
 * Handle document drop in onboarding
 */
function handleOnboardingDocDrop(event) {
  event.preventDefault();
  var files = event.dataTransfer.files;
  if (files && files.length > 0) {
    processOnboardingDocs(Array.from(files));
  }
}

/**
 * Handle document upload in onboarding
 */
function handleOnboardingDocUpload(event) {
  var files = event.target.files;
  if (files && files.length > 0) {
    processOnboardingDocs(Array.from(files));
  }
  event.target.value = '';
}

// Store uploaded docs for onboarding
window.onboardingUploadedDocs = [];

/**
 * Process uploaded documents for onboarding
 */
async function processOnboardingDocs(files) {
  var listEl = document.getElementById('onboardingDocsList');
  var statusEl = document.getElementById('onboardingDocStatus');
  var statusTextEl = document.getElementById('onboardingDocStatusText');
  
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    
    // Add to list
    window.onboardingUploadedDocs.push({
      name: file.name,
      size: file.size,
      file: file
    });
    
    // Update list UI
    renderOnboardingDocsList();
  }
  
  // Process all docs with AI
  if (window.onboardingUploadedDocs.length > 0) {
    await extractBrandFromDocs();
  }
}

/**
 * Render uploaded docs list
 */
function renderOnboardingDocsList() {
  var listEl = document.getElementById('onboardingDocsList');
  if (!listEl) return;
  
  listEl.innerHTML = window.onboardingUploadedDocs.map(function(doc, i) {
    return '<div class="identity-doc-item">' +
      '<div class="identity-doc-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg></div>' +
      '<div class="identity-doc-info">' +
        '<div class="identity-doc-name">' + escapeHtml(doc.name) + '</div>' +
        '<div class="identity-doc-meta">' + (doc.size / 1024).toFixed(1) + 'KB</div>' +
      '</div>' +
      '<button class="identity-doc-remove" onclick="removeOnboardingDoc(' + i + ')">' +
        icon('close', {size: 14}) +
      '</button>' +
    '</div>';
  }).join('');
}

/**
 * Remove onboarding doc
 */
function removeOnboardingDoc(index) {
  window.onboardingUploadedDocs.splice(index, 1);
  renderOnboardingDocsList();
  
  // Hide extracted data if no docs
  if (window.onboardingUploadedDocs.length === 0) {
    document.getElementById('docExtractedData').style.display = 'none';
    document.getElementById('docContinueBtn').style.display = 'none';
  }
}

/**
 * Extract brand info from uploaded documents using AI
 */
async function extractBrandFromDocs() {
  var statusEl = document.getElementById('onboardingDocStatus');
  var statusTextEl = document.getElementById('onboardingDocStatusText');
  var extractedEl = document.getElementById('docExtractedData');
  var continueBtn = document.getElementById('docContinueBtn');
  
  statusEl.style.display = 'block';
  statusTextEl.textContent = 'Reading documents...';
  
  try {
    // Read all document contents
    var allContent = '';
    
    for (var i = 0; i < window.onboardingUploadedDocs.length; i++) {
      var doc = window.onboardingUploadedDocs[i];
      statusTextEl.textContent = 'Reading ' + doc.name + '...';
      
      var content = await readFileContent(doc.file);
      allContent += '\n\n--- ' + doc.name + ' ---\n' + content;
    }
    
    statusTextEl.textContent = 'Analyzing with AI...';
    
    // v14.3.1: Fix API key lookup to use roweos_api_keys
    var docApiKeys = {};
    try { docApiKeys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}'); } catch(e) {}
    var apiKey = docApiKeys.anthropic || docApiKeys.openai || docApiKeys.google;

    // Use brand name from previous step
    var savedBrandName = window.onboardingBrandName || '';

    if (apiKey) {
      // Use AI to extract brand info - v9.1.14: all 7 identity fields
      var extracted = await extractBrandInfoWithAI(allContent);
      
      // Fill all identity fields - use saved brand name from earlier step
      document.getElementById('docExtractedBrandName').value = savedBrandName || extracted.name || '';
      document.getElementById('docExtractedTagline').value = extracted.tagline || '';
      document.getElementById('docExtractedEssence').value = extracted.essence || '';
      document.getElementById('docExtractedVoice').value = extracted.voice || '';
      document.getElementById('docExtractedAudience').value = extracted.audience || '';
      document.getElementById('docExtractedMessaging').value = extracted.messaging || '';
      document.getElementById('docExtractedProducts').value = extracted.products || '';
      document.getElementById('docExtractedVisual').value = extracted.visual || '';
      document.getElementById('docExtractedCompetitive').value = extracted.competitive || '';
      
      window.docExtractedData = extracted;

      // v14.3.1: Populate onboardingPrefillData for completeBrandSetup()
      window.onboardingPrefillData = {
        brandName: savedBrandName || extracted.name,
        tagline: extracted.tagline,
        essence: extracted.essence,
        voice: extracted.voice,
        audience: extracted.audience,
        messaging: extracted.messaging,
        products: extracted.products,
        visual: extracted.visual,
        competitive: extracted.competitive
      };

    } else {
      // No API key - just show basic extraction
      statusTextEl.textContent = 'No API key found - using basic extraction';
      
      // Try to extract brand name from content
      var nameMatch = allContent.match(/(?:brand|company|business)(?:\s+name)?[:\s]+([A-Z][a-zA-Z0-9\s]+)/i);
      
      document.getElementById('docExtractedBrandName').value = savedBrandName || (nameMatch ? nameMatch[1].trim() : '');
      document.getElementById('docExtractedTagline').value = '';
      document.getElementById('docExtractedEssence').value = allContent.substring(0, 500);
      document.getElementById('docExtractedVoice').value = '';
      document.getElementById('docExtractedAudience').value = '';
      document.getElementById('docExtractedMessaging').value = '';
      document.getElementById('docExtractedProducts').value = '';
      document.getElementById('docExtractedVisual').value = '';
      document.getElementById('docExtractedCompetitive').value = '';
      
      window.docExtractedData = {
        name: savedBrandName || (nameMatch ? nameMatch[1].trim() : ''),
        rawContent: allContent
      };
    }
    
    statusEl.style.display = 'none';
    extractedEl.style.display = 'block';
    continueBtn.style.display = 'inline-flex';
    
    showToast('Documents processed!', 'success');
    
  } catch (error) {
    console.error('[extractBrandFromDocs] Error:', error);
    statusEl.style.display = 'none';
    showToast('Error processing documents: ' + error.message, 'error');
  }
}

/**
 * Extract brand info using AI
 */
// v14.3.1: Multi-provider support, fixed API key lookup, ES5 compliant
async function extractBrandInfoWithAI(content) {
  var emptyResult = { name: '', tagline: '', essence: '', voice: '', audience: '', messaging: '', products: '', visual: '', competitive: '' };
  var aiApiKeys = {};
  try { aiApiKeys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}'); } catch(e) {}
  var anthropicKey = aiApiKeys.anthropic;
  var openaiKey = aiApiKeys.openai;
  var googleKey = aiApiKeys.google;

  if (!anthropicKey && !openaiKey && !googleKey) {
    return emptyResult;
  }

  // v24.27: Write from the brand's first-person perspective, not analytical third person
  var promptText = 'You are building a brand AI identity from this website content. Write ALL descriptions from the FIRST PERSON perspective of the brand (use "we", "our", "I") — as if the brand owner is describing their own business. Do NOT write in third person or analytical tone.\n\nReturn ONLY a JSON object with these keys:\n' +
    '{\n' +
    '  "name": "Brand/company name",\n' +
    '  "tagline": "Brand tagline or slogan (create one if not found)",\n' +
    '  "location": "City, State if mentioned on the site",\n' +
    '  "essence": "Write as the brand: who we are, what we do, our mission and values. First person, confident, authentic. (4-6 sentences)",\n' +
    '  "voice": "Brand voice and tone description. How the brand sounds when it communicates. (4-6 sentences)",\n' +
    '  "audience": "Who we serve — our ideal customers, their needs, demographics, and why they come to us. First person. (4-6 sentences)",\n' +
    '  "messaging": "Our key messages, value propositions, and what makes us different. First person. (4-6 sentences)",\n' +
    '  "products": "What we offer — our products, services, and unique features. First person. (4-6 sentences)",\n' +
    '  "visual": "Visual identity — colors, typography, imagery style, design direction. (4-6 sentences)",\n' +
    '  "competitive": "How we stand apart — our unique positioning and competitive advantages. First person. (4-6 sentences)"\n' +
    '}\n\n' +
    'Be thorough. If information is not on the site, make educated inferences based on what IS there. Leave fields empty only if truly impossible to determine.\n\n' +
    'Website content:\n' + content.substring(0, 50000);

  try {
    var response, data, text;

    if (anthropicKey) {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: localStorage.getItem('claudeModel') || 'claude-sonnet-4-6',
          max_tokens: 4000,
          messages: [{ role: 'user', content: promptText }]
        })
      });
      data = await response.json();
      text = (data.content && data.content[0] && data.content[0].text) || '';
    } else if (openaiKey) {
      response = await fetch('https://api.openai.com/v1/responses', { // v22.18: Responses API
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + openaiKey
        },
        body: JSON.stringify({
          model: 'gpt-5.4',
          max_output_tokens: 4000,
          input: [{ role: 'user', content: promptText }],
          store: false
        })
      });
      data = await response.json();
      text = data.output_text || ''; // v22.18: Responses API
    } else if (googleKey) {
      response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + googleKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        })
      });
      data = await response.json();
      text = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts ? extractGeminiResponseText(data.candidates[0].content.parts) : '') || '';
    }

    // Parse JSON from response
    var jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('[extractBrandInfoWithAI] Error:', error);
  }

  return emptyResult;
}

/**
 * Continue with document extracted data
 */
function continueWithDocData() {
  var brandName = document.getElementById('docExtractedBrandName').value;
  var tagline = document.getElementById('docExtractedTagline').value;
  var essence = document.getElementById('docExtractedEssence').value;
  var voice = document.getElementById('docExtractedVoice').value;
  var audience = document.getElementById('docExtractedAudience').value;
  var messaging = document.getElementById('docExtractedMessaging').value;
  var products = document.getElementById('docExtractedProducts').value;
  var visual = document.getElementById('docExtractedVisual').value;
  var competitive = document.getElementById('docExtractedCompetitive').value;
  
  if (!brandName) {
    showToast('Please enter a brand name', 'error');
    return;
  }
  
  // v9.1.14: Store all identity fields for use in brand creation
  window.onboardingPrefillData = {
    brandName: brandName,
    tagline: tagline,
    essence: essence,
    voice: voice,
    audience: audience,
    messaging: messaging,
    products: products,
    visual: visual,
    competitive: competitive,
    importMethod: 'document'
  };
  
  // Also update the stored brand name
  window.onboardingBrandName = brandName;
  
  console.log('[Onboarding] Document data stored with all identity fields, going to Brand Basics (step 7)');
  
  // Go directly to Brand Basics (step 7) - skip API since already done
  goToOnboardingStep(7);
}

/**
 * Go to step 3 with imported data pre-filled
 */
function goToOnboardingStep3WithData() {
  var data = window.importedBrandData;
  if (!data) {
    nextOnboardingStep(3);
    return;
  }
  
  console.log('[Onboarding] Going to step 3 with imported data:', data);
  
  // Pre-fill onboarding fields
  var nameInput = document.getElementById('onboardingBrandName');
  var taglineInput = document.getElementById('onboardingTagline');
  
  if (nameInput) nameInput.value = data.name || '';
  if (taglineInput) taglineInput.value = data.tagline || '';
  
  // Store additional data for later steps
  window.onboardingImportedData = data;
  
  // Navigate to step 3
  nextOnboardingStep(3);
}

function launchTemplateOnboarding() {
  console.log('[Onboarding] Launching template selection...');
  
  // Hide all onboarding steps first
  hideAllOnboardingSteps();
  
  // Show template selection screen
  var templateStep = document.getElementById('onboardingTemplateSelection');
  if (templateStep) {
    console.log('[Onboarding] Showing template selection div');
    templateStep.classList.remove('hidden');
    templateStep.style.display = 'flex'; // Use flex like other onboarding steps
    templateStep.style.flexDirection = 'column';
    templateStep.style.visibility = 'visible'; // CRITICAL: Clear the visibility:hidden
    templateStep.style.opacity = '1';
  } else {
    console.error('[Onboarding] Template selection div not found!');
  }
  
  // Show modal with .active class
  var modal = document.getElementById('onboardingModal');
  if (modal) {
    console.log('[Onboarding] Activating onboarding modal');
    modal.classList.add('show');
  } else {
    console.error('[Onboarding] Onboarding modal not found!');
  }
}

// Store selected template
var selectedTemplate = null;

function selectBrandTemplate(templateType, event) {
  if (event) event.stopPropagation();
  
  console.log('[Template] Selecting template:', templateType);
  
  // Expanded template library with 9+ industry categories
  var templates = {
    'luxury-goods': {
      displayName: 'Luxury Goods',
      philosophy: 'True luxury lives in thoughtful details, timeless craftsmanship, and the quiet confidence of quality that speaks for itself.',
      voice: 'sophisticated, warm, refined, timeless',
      positioning: 'Premium artisan goods brand delivering exceptional quality through heritage techniques',
      audience: 'Discerning clientele seeking heirloom-quality products with modern sensibility',
      promise: 'Objects of enduring beauty, crafted with care',
      cta: 'Explore Collection',
      tone: 'Elegant, confident prose. Clean sentences. No hype.',
      vocabDo: 'curated, bespoke, refined, heritage, artisan, timeless, exceptional, distinguished',
      vocabDont: 'cheap, basic, trendy, mass-produced, rushed, generic',
      constraints: 'Never compromise on quality. Always maintain premium positioning. Quiet competence.'
    },
    'premium-services': {
      displayName: 'Premium Services',
      philosophy: 'Anticipation is the heart of service. We deliver what you need before you know you need it.',
      voice: 'professional, warm, precise, attentive',
      positioning: 'White-glove concierge services for those who value time and precision',
      audience: 'High-net-worth individuals and families seeking seamless life management',
      promise: 'Life, simplified. Experience, elevated.',
      cta: 'Request Service',
      tone: 'Professional confidence. Warm precision. No fluff.',
      vocabDo: 'seamless, precision, curated, exclusive, personalized, distinguished, excellence',
      vocabDont: 'cheap, basic, ordinary, rushed, generic, simple',
      constraints: 'Always professional. Never pushy. Demonstrate competence through action.'
    },
    'hospitality': {
      displayName: 'Hospitality',
      philosophy: 'Every space tells a story. Every stay becomes a memory. We curate destinations, not just accommodations.',
      voice: 'sophisticated, inviting, curated, experiential',
      positioning: 'Curated experiences for travelers seeking authentic connections and exceptional service',
      audience: 'Discerning travelers who value unique properties and local connections',
      promise: 'Not where you stay. How you experience.',
      cta: 'Browse Destinations',
      tone: 'Inviting sophistication. Vivid but restrained. Show, don\'t tell.',
      vocabDo: 'curated, authentic, elevated, bespoke, refined, distinguished, thoughtful, memorable',
      vocabDont: 'cheap, basic, cookie-cutter, generic, touristy, ordinary',
      constraints: 'Emphasize experience over amenities. Quality over quantity. Character over convenience.'
    },
    'ecommerce': {
      displayName: 'E-commerce',
      philosophy: 'Shopping should be effortless, intuitive, and delightful. We connect people with what they love.',
      voice: 'friendly, modern, accessible, energetic',
      positioning: 'Direct-to-consumer brand making quality products accessible through seamless online experiences',
      audience: 'Digital-native consumers who value convenience, quality, and authentic brand connections',
      promise: 'What you want, when you need it.',
      cta: 'Shop Now',
      tone: 'Clear, conversational, benefits-focused. Active voice. Brief paragraphs.',
      vocabDo: 'fast, easy, quality, discover, curated, exclusive, free shipping, handpicked, modern',
      vocabDont: 'complicated, slow, confusing, outdated, hassle, wait',
      constraints: 'Always transparent about shipping and returns. Mobile-first mindset. Visual storytelling.'
    },
    'medical': {
      displayName: 'Medical Practice',
      philosophy: 'Health is personal. Care should be too. We listen first, treat with expertise, and partner in your wellness journey.',
      voice: 'caring, professional, trusted, compassionate',
      positioning: 'Healthcare provider combining clinical excellence with personalized, compassionate patient care',
      audience: 'Individuals and families seeking comprehensive, patient-centered medical care',
      promise: 'Care that puts you first.',
      cta: 'Schedule Appointment',
      tone: 'Warm professionalism. Clear explanations. Empathetic. Evidence-based.',
      vocabDo: 'comprehensive, personalized, expert, trusted, caring, evidence-based, wellness, patient-centered',
      vocabDont: 'rushed, impersonal, confusing, clinical (overly), intimidating',
      constraints: 'HIPAA-compliant language. Never make medical promises. Always empathetic.'
    },
    'blog': {
      displayName: 'Blog & Content',
      philosophy: 'Authentic voices create connection. We share insights, spark conversations, and build community through honest storytelling.',
      voice: 'authentic, engaging, insightful, conversational',
      positioning: 'Thought leader creating valuable content that educates, inspires, and builds community',
      audience: 'Curious readers seeking authentic perspectives and actionable insights',
      promise: 'Real stories. Real value.',
      cta: 'Read More',
      tone: 'Conversational but polished. Personal anecdotes welcome. Clear takeaways.',
      vocabDo: 'authentic, honest, insights, practical, actionable, real, community, conversation',
      vocabDont: 'clickbait, exaggerated, vague, salesy, corporate-speak',
      constraints: 'Always provide value. Cite sources. Be authentic. Avoid clickbait.'
    },
    'retail': {
      displayName: 'Retail Store',
      philosophy: 'Shopping is an experience, not a transaction. We create spaces where discovery happens and relationships flourish.',
      voice: 'welcoming, knowledgeable, friendly, local',
      positioning: 'Neighborhood retailer offering curated selection and personalized service',
      audience: 'Local community members seeking quality products and personal shopping experiences',
      promise: 'Your neighborhood. Our passion.',
      cta: 'Visit Us',
      tone: 'Warm, approachable. Community-focused. Pride in curation.',
      vocabDo: 'locally-owned, curated, community, handpicked, quality, expert staff, neighborhood',
      vocabDont: 'mass-market, corporate, impersonal, chain, generic',
      constraints: 'Emphasize local community. Highlight curation. Personal service focus.'
    },
    'restaurant': {
      displayName: 'Restaurant & Food',
      philosophy: 'Food brings people together. Every dish tells a story. We create moments worth savoring.',
      voice: 'inviting, flavorful, warm, passionate',
      positioning: 'Culinary experience combining fresh ingredients, expert preparation, and memorable hospitality',
      audience: 'Food enthusiasts seeking authentic flavors and memorable dining experiences',
      promise: 'Flavor. Freshness. Fellowship.',
      cta: 'Make Reservation',
      tone: 'Sensory language. Inviting descriptions. Warm hospitality.',
      vocabDo: 'fresh, seasonal, locally-sourced, handcrafted, authentic, flavorful, memorable',
      vocabDont: 'pre-made, frozen, generic, boring, mass-produced',
      constraints: 'Highlight ingredients and preparation. Sensory descriptions. Hospitality focus.'
    },
    'professional': {
      displayName: 'Professional Services',
      philosophy: 'Expertise meets partnership. We solve complex challenges with clear thinking, proven methods, and genuine collaboration.',
      voice: 'expert, reliable, professional, collaborative',
      positioning: 'Trusted advisors delivering strategic solutions through deep expertise and client partnership',
      audience: 'Business leaders and organizations seeking expert guidance and measurable results',
      promise: 'Expertise you can trust. Results you can measure.',
      cta: 'Schedule Consultation',
      tone: 'Professional confidence. Clear language. Results-focused. Data-driven.',
      vocabDo: 'strategic, proven, expert, partnership, results, tailored, comprehensive, data-driven',
      vocabDont: 'jargon-heavy, vague, generic, one-size-fits-all, theoretical',
      constraints: 'Focus on results and ROI. Use case studies. Clear processes. Professional tone.'
    }
  };
  
  var template = templates[templateType];
  if (!template) {
    console.error('[Template] Template not found:', templateType);
    return;
  }
  
  // Store selected template for later use
  selectedTemplate = {
    type: templateType,
    data: template
  };
  
  console.log('[Template] Template selected:', template.displayName);
  
  // Show template name in Brand Basics step
  var templateNameEl = document.getElementById('selectedTemplateName');
  if (templateNameEl) {
    templateNameEl.textContent = template.displayName;
  }
  
  // Go to Brand Basics customization step
  hideAllOnboardingSteps();
  var brandingStep = document.getElementById('onboardingTemplateBranding');
  if (brandingStep) {
    brandingStep.classList.remove('hidden');
    brandingStep.style.display = 'flex';
    brandingStep.style.flexDirection = 'column';
    brandingStep.style.visibility = 'visible';
    brandingStep.style.opacity = '1';
  }
}

function backToTemplateSelection() {
  console.log('[Template] Going back to template selection');
  selectedTemplate = null;
  launchTemplateOnboarding();
}

function generateBrandFromTemplate() {
  if (!selectedTemplate) {
    showToast('No template selected', 'error');
    return;
  }
  
  // Get custom inputs
  var brandName = document.getElementById('templateBrandName').value.trim();
  var tagline = document.getElementById('templateTagline').value.trim();
  var location = document.getElementById('templateLocation').value.trim();
  var contact = document.getElementById('templateContact').value.trim();
  
  // Validate required fields
  if (!brandName) {
    showToast('Please enter your brand name', 'warning');
    document.getElementById('templateBrandName').focus();
    return;
  }
  
  if (!tagline) {
    showToast('Please enter your tagline', 'warning');
    document.getElementById('templateTagline').focus();
    return;
  }
  
  console.log('[Template] Generating brand:', brandName, 'from', selectedTemplate.data.displayName);
  
  // v14.2: Replace [Brand Name] placeholders with actual brand name
  function fillBrandName(str) {
    if (!str) return str;
    return str.replace(/\[Brand Name\]/g, brandName);
  }

  // Create brand object combining template + custom inputs
  var newBrand = {
    id: 'brand_' + Date.now(),
    _modifiedAt: Date.now(),
    _createdAt: Date.now(),
    name: brandName,
    tagline: tagline,
    philosophy: fillBrandName(selectedTemplate.data.philosophy),
    voice: selectedTemplate.data.voice,
    positioning: fillBrandName(selectedTemplate.data.positioning),
    audience: fillBrandName(selectedTemplate.data.audience),
    promise: fillBrandName(selectedTemplate.data.promise),
    cta: selectedTemplate.data.cta,
    tone: selectedTemplate.data.tone,
    vocabDo: selectedTemplate.data.vocabDo,
    vocabDont: selectedTemplate.data.vocabDont,
    constraints: fillBrandName(selectedTemplate.data.constraints),
    location: location || '',
    contacts: contact || ''
  };
  
  // Add brand to array
  brands.push(newBrand);
  var newBrandIdx = brands.length - 1;
  selectedBrandIdx = newBrandIdx;
  
  localStorage.setItem(USER_DATA_KEYS.brands, JSON.stringify(brands));
  console.log('[Template] Brand saved, total brands:', brands.length);
  
  // Show generation animation/loading
  showBrandGenerationAnimation(brandName, selectedTemplate.data.displayName);
}

function showBrandGenerationAnimation(brandName, templateName) {
  // Hide current step
  hideAllOnboardingSteps();
  
  // Show "generating" animation (we'll create this div next)
  var generatingDiv = document.createElement('div');
  generatingDiv.id = 'brandGenerating';
  generatingDiv.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; text-align: center;';
  
  // v14.2: ES5 compliant
  generatingDiv.innerHTML = '<div style="width: 80px; height: 80px; border: 3px solid rgba(212, 175, 55, 0.2); border-top-color: var(--accent); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 32px;"></div>' +
    '<h2 style="font-size: var(--text-3xl); font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-3);">Generating Your Brand Profile</h2>' +
    '<p style="font-size: var(--text-lg); color: var(--text-secondary); max-width: 500px;">Creating <strong style="color: var(--accent);">' + escapeHtml(brandName) + '</strong> based on the <strong style="color: var(--accent);">' + escapeHtml(templateName) + '</strong> template...</p>';
  
  var wizard = document.querySelector('.onboarding-wizard');
  if (wizard) {
    wizard.appendChild(generatingDiv);
  }
  
  // Simulate generation (2 seconds), then show success screen
  setTimeout(function() {
    showTemplateSuccessScreen(brandName, templateName);
  }, 2000);
}

function showTemplateSuccessScreen(brandName, templateName) {
  // Remove generating div
  var generating = document.getElementById('brandGenerating');
  if (generating) generating.remove();
  
  // Create success screen
  var successDiv = document.createElement('div');
  successDiv.id = 'brandTemplateSuccess';
  successDiv.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; text-align: center; padding: 40px;';
  
  successDiv.innerHTML = `
    <div style="width: 80px; height: 80px; background: rgba(74, 222, 128, 0.1); border: 2px solid #4ade80; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 32px;">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </div>
    
    <h2 style="font-size: var(--text-4xl); font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-4);">✓ Brand Profile Created!</h2>
    
    <p style="font-size: var(--text-lg); color: var(--text-secondary); max-width: 600px; margin-bottom: 32px; line-height: 1.6;">
      We've created <strong style="color: var(--accent);">${brandName}</strong> using the <strong style="color: var(--accent);">${templateName}</strong> template as a foundation.
    </p>
    
    <div style="background: rgba(212, 175, 55, 0.1); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: var(--radius-lg); padding: var(--space-6); max-width: 600px; text-align: left; margin-bottom: 32px;">
      <div style="font-size: var(--text-base); font-weight: 600; color: var(--accent); margin-bottom: var(--space-3);">✦ Next Steps</div>
      <div style="font-size: var(--text-base); color: var(--text-secondary); line-height: 1.6;">
        This is a starting point. You can customize every aspect of your brand profile in the <strong>Intelligence</strong> section:
        <br/><br/>
        • <strong>Identity:</strong> Refine your brand voice, positioning, and philosophy<br/>
        • <strong>Signal:</strong> Add brand guidelines and vocabulary rules<br/>
        • <strong>Memory:</strong> Train your BrandAI with examples and context
      </div>
    </div>
    
    <button class="onboarding-btn onboarding-btn-primary" onclick="completeTemplateOnboarding()" style="font-size: var(--text-lg); padding: 14px 32px;">
      Get Started →
    </button>
  `;
  
  var wizard = document.querySelector('.onboarding-wizard');
  if (wizard) {
    wizard.appendChild(successDiv);
  }
}

function completeTemplateOnboarding() {
  // Remove success screen
  var success = document.getElementById('brandTemplateSuccess');
  if (success) success.remove();
  
  // Close onboarding modal
  var onboardingModal = document.getElementById('onboardingModal');
  if (onboardingModal) {
    onboardingModal.classList.remove('active');
    document.body.style.overflow = '';
  }
  
  // Complete onboarding
  completeOnboarding();
  
  // Navigate to Identity view with toast
  setTimeout(function() {
    showView('identity');
    renderIdentityView();
    showToast('✓ Brand profile ready! Customize it in Intelligence → Identity', 'success');
  }, 300);
}

function startCustomBrandCreation() {
  console.log('[Custom Brand] Starting custom brand creation flow');
  
  // Navigate to provider selection (step 3)
  goToOnboardingStep(3);
}


function startOnboardingDemo() {
  // Create a rich demo brand with comprehensive data
  var demoBrand = {
    name: 'Demo Luxury Co.',
    tagline: 'Experience Elevated',
    philosophy: 'We believe true luxury lies in thoughtful details, timeless craftsmanship, and personalized service that anticipates your needs.',
    voice: 'sophisticated, warm, exclusive, premium',
    positioning: 'Premium luxury brand delivering exceptional experiences through meticulous attention to detail',
    audience: 'Discerning clientele seeking uncompromising quality and refined experiences',
    promise: 'Elevate every moment through timeless elegance',
    cta: 'Discover More',
    tone: 'Elegant prose with confident assertions. Short, impactful statements.',
    vocabDo: 'elevated, curated, bespoke, refined, exceptional, distinguished, timeless, artisan, heritage',
    vocabDont: 'cheap, basic, ordinary, generic, rushed, mass-produced, trendy',
    constraints: 'Never compromise on quality. Always maintain premium positioning. No hype or desperation.',
    location: 'New York, NY',
    contacts: 'hello@demoluxury.co'
  };
  
  // Add demo brand to brands array
  brands.push(demoBrand);
  var demoIdx = brands.length - 1;
  selectedBrandIdx = demoIdx;
  
  // Create comprehensive demo memory
  var demoMemory = {
    name: 'Demo Luxury Co.',
    tagline: 'Experience Elevated',
    essence: 'Timeless sophistication meets modern luxury. We craft experiences that transcend the ordinary.',
    voice: 'Sophisticated, warm, exclusive',
    audience: 'High-net-worth individuals seeking exceptional, personalized experiences',
    positioning: 'Leading luxury lifestyle brand known for meticulous craftsmanship and personalized service',
    promise: 'We elevate every moment through our unwavering commitment to excellence, attention to detail, and timeless elegance'
  };
  
  // Save demo brand to localStorage
  localStorage.setItem(USER_DATA_KEYS.brands, JSON.stringify(brands));
  
  // Save demo brand memory
  var brandMemory = JSON.parse(localStorage.getItem('roweos_brand_memory') || '{}');
  brandMemory[demoIdx] = demoMemory;
  localStorage.setItem('roweos_brand_memory', JSON.stringify(brandMemory));
  
  // Configure default AI model for demo brand
  var brandSettings = JSON.parse(localStorage.getItem(USER_DATA_KEYS.brandSettings) || '{}');
  if (!brandSettings[demoIdx]) {
    brandSettings[demoIdx] = {};
  }
  brandSettings[demoIdx].provider = 'anthropic';
  brandSettings[demoIdx].model = 'claude-sonnet-4-6';
  localStorage.setItem(USER_DATA_KEYS.brandSettings, JSON.stringify(brandSettings));
  
  // Sync UI
  syncBrandDropdowns();
  onBrandChange();
  renderMemoryBrandPills();
  
  // Navigate to Identity view to show the demo brand
  showView('identity');
  
  // Show success message
  showToast('Demo Mode Activated! Demo brand "Demo Luxury Co." created with sample data. Explore the platform!', 'success');
}

function showOnboardingStep(step) {
  console.log('=== RoweOS v3.6: showOnboardingStep called with step:', step);
  
  // Ensure parent modal is visible
  var modal = document.getElementById('onboardingModal');
  if (modal) {
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.classList.add('show');
  }
  
  // Ensure parent wizard container is visible
  var wizard = document.querySelector('.onboarding-wizard');
  if (wizard) {
    wizard.style.display = 'flex';
    wizard.style.flexDirection = 'column';
    wizard.style.visibility = 'visible';
    wizard.style.opacity = '1';
  }
  
  // Hide ALL steps first (including step 1-9, special steps, and import steps)
  var allStepIds = ['onboardingStep1', 'onboardingStep2', 'onboardingTemplateSelection', 'onboardingTemplateBranding', 'onboardingStep3', 'onboardingStep4', 'onboardingStep5', 'onboardingStep6', 'onboardingStep7', 'onboardingStep8', 'onboardingStep9', 'onboardingWebsiteImport', 'onboardingDocumentUpload'];
  allStepIds.forEach(function(id) {
    var stepEl = document.getElementById(id);
    if (stepEl) {
      stepEl.classList.add('hidden');
      stepEl.style.display = 'none';
      stepEl.style.visibility = 'hidden';
    }
  });
  
  // Show target step - FORCE VISIBILITY
  var targetStep = document.getElementById('onboardingStep' + step);
  if (targetStep) {
    // Remove hidden class
    targetStep.classList.remove('hidden');
    // Force display with inline styles (these override CSS rules)
    targetStep.style.display = 'flex';
    targetStep.style.flexDirection = 'column';
    targetStep.style.visibility = 'visible';
    targetStep.style.opacity = '1';
    targetStep.style.position = 'relative';
    console.log('✓ Step', step, 'shown');
  } else {
    console.error('✗ Step', step, 'element not found in DOM!');
  }
  
  // Scroll modal content to top
  if (wizard) wizard.scrollTop = 0;
}

function nextOnboardingStep(step) {
  // Validate current step before proceeding
  // Note: Step 2 is just a choice screen (Template vs Create), no validation needed
  // Step 3 is provider selection, no validation needed
  // Validation starts at Step 4+ when we have actual forms
  
  if (step === 4) {
    // Validate Step 3 (Voice)
    if (onboardingData.voice.length < 2) {
      showToast('Please select at least 2 voice attributes', 'error');
      return;
    }
  }
  
  if (step === 5) {
    // Collect Step 4 (Audience)
    onboardingData.audience = document.getElementById('onboardingAudience').value.trim();
    onboardingData.promise = document.getElementById('onboardingPromise').value.trim();
    var checkboxes = document.querySelectorAll('.onboarding-checkbox input:checked');
    onboardingData.audienceValues = Array.from(checkboxes).map(function(cb) { return cb.value; });
  }
  
  if (step === 6) {
    // Collect Step 5 (Positioning)
    var posAud = document.getElementById('positioningAudience').value.trim();
    var posAct = document.getElementById('positioningAction').value.trim();
    var posHow = document.getElementById('positioningHow').value.trim();
    onboardingData.positioning = 'We help ' + posAud + ' to ' + posAct + ' by ' + posHow;
  }
  
  if (step === 7) {
    // Start AI bootstrap
    runBrandBootstrap();
  }
  
  showOnboardingStep(step);
}

function previousOnboardingStep(step) {
  showOnboardingStep(step);
}

function skipOnboarding() {
  // Check if there's already a brand
  if (brands.length === 0) {
    // Create a minimal brand with default values
    var newBrand = {
      id: 'brand_' + Date.now(),
      _modifiedAt: Date.now(),
      _createdAt: Date.now(),
      name: 'My Brand',
      tagline: 'Brand tagline here',
      philosophy: 'Your brand philosophy',
      voice: 'professional, friendly',
      positioning: 'We help our audience achieve their goals',
      audience: 'Your target audience',
      promise: 'Deliver exceptional value',
      cta: 'Learn More',
      tone: '',
      vocabDo: '',
      vocabDont: '',
      constraints: '',
      location: '',
      contacts: ''
    };
    
    brands.push(newBrand);
    selectedBrandIdx = 0;
    saveToLocalStorage('brands', brands);
    
    // Create minimal memory for the brand
    var brandKey = 'brand_0';
    var memoryData = {
      name: 'My Brand',
      tagline: 'Brand tagline here',
      essence: '',
      voice: 'professional, friendly',
      audience: 'Your target audience',
      positioning: 'We help our audience achieve their goals',
      promise: 'Deliver exceptional value'
    };
    saveToLocalStorage(brandKey, memoryData);
  }
  
  // Mark onboarding as complete
  localStorage.setItem('hasCompletedOnboarding', 'true');

  // v14.0: Clean up onboarding temp state
  window._onboardingLogo = null;
  window.onboardingOwnershipData = null;
  window.onboardingOwnershipRole = null;

  // v14.0: Sync mode state (same as launchToView)
  if (typeof launchMode !== 'undefined' && launchMode === 'life') {
    localStorage.setItem('roweos_life_mode', 'true');
    localStorage.setItem('roweos_app_mode', 'life');
    localStorage.setItem('roweos_mode', 'life');
  } else {
    localStorage.setItem('roweos_life_mode', 'false');
    localStorage.setItem('roweos_app_mode', 'brand');
    localStorage.setItem('roweos_mode', 'brand');
  }

  // v14.0: Update UI for the selected mode
  if (typeof updateModeUI === 'function') {
    updateModeUI(typeof launchMode !== 'undefined' ? launchMode : 'brand');
  }
  if (typeof updateMobileModeLabel === 'function') {
    updateMobileModeLabel();
  }

  // Check if we're in launch screen or onboarding modal
  var launchScreen = document.getElementById('launchScreen');
  var onboardingModal = document.getElementById('onboardingModal');

  if (launchScreen && launchScreen.style.display !== 'none') {
    // We're in the initial launch screen
    launchScreen.style.display = 'none';
    document.getElementById('appContainer').style.display = 'flex';
  } else if (onboardingModal && onboardingModal.classList.contains('active')) {
    // We're in the onboarding modal - properly close it
    hideOnboarding();
    document.body.style.overflow = '';
  }

  // Sync all UI
  syncBrandDropdowns();
  onBrandChange();

  // Show Identity view so user can complete their brand setup
  showView('identity');

  // Show helpful message
  showToast('Onboarding skipped - set up your brand in Intelligence', 'info');
}

// v14.0: Exit Setup confirmation modal
function showExitSetupModal() {
  var modal = document.getElementById('exitSetupModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeExitSetupModal() {
  var modal = document.getElementById('exitSetupModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function confirmExitSetup() {
  closeExitSetupModal();
  skipOnboarding();
}

// v14.0: Multi-API key setup
function showMultiApiSetup() {
  var option = document.getElementById('multiApiOption');
  var providers = document.getElementById('multiApiProviders');
  if (option) option.style.display = 'none';
  if (providers) providers.style.display = 'block';

  // Disable already-configured providers
  try {
    var keys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}');
    if (keys.anthropic) {
      var btn = document.getElementById('multiApiAnthropic');
      if (btn) { btn.disabled = true; btn.textContent = 'Anthropic (Connected)'; btn.style.opacity = '0.5'; }
    }
    if (keys.openai) {
      var btn = document.getElementById('multiApiOpenai');
      if (btn) { btn.disabled = true; btn.textContent = 'OpenAI (Connected)'; btn.style.opacity = '0.5'; }
    }
    if (keys.google) {
      var btn = document.getElementById('multiApiGoogle');
      if (btn) { btn.disabled = true; btn.textContent = 'Google (Connected)'; btn.style.opacity = '0.5'; }
    }
  } catch (e) {}
}

function setupAdditionalProvider(provider) {
  // Store that we want to come back to step 5 after
  window._multiApiReturnToStep5 = true;
  // Set the selected provider and go to step 4
  if (typeof selectOnboardingProvider === 'function') {
    // Simulate provider selection
    window.onboardingSelectedProvider = provider;
    var providerNames = { anthropic: 'Anthropic, Claude', openai: 'OpenAI', google: 'Google AI' };
    var providerLinks = { anthropic: 'https://console.anthropic.com', openai: 'https://platform.openai.com', google: 'https://aistudio.google.com' };
    var nameEl = document.getElementById('onboardingProviderName');
    var linkEl = document.getElementById('onboardingProviderLink');
    if (nameEl) nameEl.textContent = providerNames[provider] || provider;
    if (linkEl) {
      linkEl.href = providerLinks[provider] || '#';
      linkEl.textContent = providerLinks[provider] || '';
    }
    goToOnboardingStep(4);
  }
}

function toggleVoiceAttribute(card, voice) {
  card.classList.toggle('selected');
  var idx = onboardingData.voice.indexOf(voice);
  if (idx === -1) {
    if (onboardingData.voice.length < 3) {
      onboardingData.voice.push(voice);
    } else {
      showToast('Maximum 3 voice attributes', 'warning');
      card.classList.remove('selected');
    }
  } else {
    onboardingData.voice.splice(idx, 1);
  }
}

function updatePositioningPreview() {
  var aud = document.getElementById('positioningAudience').value.trim() || '[audience]';
  var act = document.getElementById('positioningAction').value.trim() || '[action]';
  var how = document.getElementById('positioningHow').value.trim() || '[approach]';
  document.getElementById('positioningPreview').textContent = 'We help ' + aud + ' to ' + act + ' by ' + how;
}

function runBrandBootstrap() {
  var statusEl = document.getElementById('bootstrapStatus');
  var logEl = document.getElementById('bootstrapLog');
  
  var statuses = [
    'Analyzing your brand voice...',
    'Generating content strategies...',
    'Building knowledge base...',
    'Creating custom operations...',
    'Establishing success criteria...',
    'Finalizing brand intelligence...'
  ];
  
  var currentStatus = 0;
  
  function updateStatus() {
    if (currentStatus < statuses.length) {
      statusEl.textContent = statuses[currentStatus];
      logEl.innerHTML += '<div style="color: var(--accent);">✓ ' + statuses[currentStatus] + '</div>';
      logEl.scrollTop = logEl.scrollHeight;
      currentStatus++;
      setTimeout(updateStatus, 3000);
    } else {
      // Bootstrap complete - generate brand data
      generateBrandFromOnboarding();
    }
  }
  
  updateStatus();
}

// Helper function to retrieve API key from storage
async function getApiKey(provider) {
  try {
    console.log('[getApiKey] Retrieving key for provider:', provider);
    
    // CRITICAL: In desktop mode, API keys are in secure storage (Electron), NOT localStorage!
    if (isDesktopApp && window.roweosAPI && window.roweosAPI.getApiKey) {
      console.log('[getApiKey] Desktop mode - checking Electron secure storage');
      try {
        var result = await window.roweosAPI.getApiKey(provider);
        console.log('[getApiKey] Electron result:', result);
        
        if (result && result.success && result.key) {
          console.log('[getApiKey] ✓ Retrieved', provider, 'key from Electron secure storage');
          return result.key;
        } else {
          console.warn('[getApiKey] ⚠ No', provider, 'key in Electron secure storage');
        }
      } catch (electronError) {
        console.error('[getApiKey] Electron IPC error:', electronError);
      }
    }
    
    // Fallback to localStorage (browser mode or if Electron lookup failed)
    console.log('[getApiKey] Checking localStorage...');
    
    // Try new structure first
    var storedKeys = localStorage.getItem('roweos_api_keys');
    if (storedKeys) {
      var apiKeys = JSON.parse(storedKeys);
      var key = apiKeys[provider] || apiKeys[provider.toLowerCase()] || apiKeys[provider.charAt(0).toUpperCase() + provider.slice(1)];
      if (key) {
        console.log('[getApiKey] ✓ Retrieved', provider, 'key from localStorage');
        return key;
      }
    }
    
    // Fallback: try old individual key storage
    var oldKey = localStorage.getItem(provider + 'ApiKey');
    if (oldKey) {
      console.log('[getApiKey] ✓ Retrieved', provider, 'key from old localStorage format');
      return oldKey;
    }
    
    console.warn('[getApiKey] ✗ No', provider, 'API key found in any storage location');
    return '';
  } catch (error) {
    console.error('[getApiKey] ✗ Error retrieving API key:', error);
    return '';
  }
}

async function generateBrandFromOnboarding() {
  try {
    // Build prompt for AI
    var prompt = `You are building a brand intelligence system. Based on this information, generate a complete brand profile.

INPUT:
- Brand Name: ${onboardingData.brandName}
- Tagline: ${onboardingData.tagline || 'Not provided'}
- Voice Attributes: ${onboardingData.voice.join(', ')}
- Target Audience: ${onboardingData.audience}
- What They Value: ${onboardingData.audienceValues.join(', ')}
- Brand Promise: ${onboardingData.promise}
- Products: ${onboardingData.positioning}
- Location: ${onboardingData.location || 'Not specified'}
- Contact: ${onboardingData.email}

GENERATE:
Return a JSON object with these fields:
{
  "philosophy": "2-3 sentence brand philosophy",
  "tone": "Writing style guidance (1 sentence)",
  "vocabDo": "20 comma-separated words this brand should use",
  "vocabDont": "15 comma-separated words to avoid",
  "constraints": "3-4 sentences of brand rules and guidelines",
  "contentPillars": ["Pillar 1", "Pillar 2", "Pillar 3"],
  "customOperations": [
    {"name": "Operation Name", "desc": "Description", "category": "marketing"}
  ],
  "successCriteria": ["Criterion 1", "Criterion 2", "Criterion 3"]
}

Return ONLY valid JSON, no markdown, no explanation.`;

    // Call API
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': getApiKey('anthropic'),
        'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: onboardingData.selectedModel,
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    var data = await response.json();
    
    // Track API usage
    if (data.usage) {
      trackAPIUsage('claude', onboardingData.selectedModel, 
        data.usage.input_tokens, data.usage.output_tokens, false);
    }
    
    var content = data.content[0].text;
    
    // Parse JSON response
    var generated = JSON.parse(content);
    
    // Build complete brand object
    onboardingData.generatedBrand = {
      name: onboardingData.brandName,
      tagline: onboardingData.tagline,
      voice: onboardingData.voice.join(', '),
      tone: generated.tone,
      positioning: onboardingData.positioning,
      audience: onboardingData.audience,
      promise: onboardingData.promise,
      philosophy: generated.philosophy,
      vocabDo: generated.vocabDo,
      vocabDont: generated.vocabDont,
      constraints: generated.constraints,
      location: onboardingData.location,
      contacts: onboardingData.email,
      preferredModel: onboardingData.selectedModel,
      contentPillars: generated.contentPillars || [],
      successCriteria: generated.successCriteria || [],
      customOperations: generated.customOperations || [],
      goldenExamples: [],
      successPatterns: [],
      avoidPatterns: []
    };
    
    // Populate BrandAI reveal screen
    populateRevealScreen();
    
    // Show success step
    showOnboardingStep(8);
    
  } catch (error) {
    console.error('========================================');
    console.error('Bootstrap error:', error);
    console.error('Demo Mode status:', onboardingData.demoMode);
    console.error('========================================');
    
    var modeText = onboardingData.demoMode === true ? '(demo mode)' : '(using fallback data)';
    console.log('Mode text set to:', modeText);
    
    document.getElementById('bootstrapStatus').textContent = 'Generation complete ' + modeText;
    document.getElementById('bootstrapLog').innerHTML += '<div style="color: var(--warning);">⚠ Using fallback data</div>';
    
    // Create fallback brand
    onboardingData.generatedBrand = {
      name: onboardingData.brandName,
      tagline: onboardingData.tagline,
      voice: onboardingData.voice.join(', '),
      tone: 'Clear, concise, and actionable with a friendly yet professional approach',
      positioning: onboardingData.positioning,
      audience: onboardingData.audience,
      promise: onboardingData.promise,
      philosophy: 'We believe in making complex things simple and accessible to everyone.',
      vocabDo: 'simple, clear, accessible, practical, effective, modern, streamlined, intuitive',
      vocabDont: 'complicated, confusing, technical jargon, overwhelming',
      constraints: 'Always provide actionable next steps. Avoid overwhelming detail. Keep language accessible.',
      location: onboardingData.location,
      contacts: onboardingData.email,
      preferredModel: onboardingData.selectedModel,
      contentPillars: ['Education', 'Practical Tips', 'Success Stories'],
      successCriteria: ['Clear next steps', 'Accessible language', 'Actionable advice'],
      customOperations: [],
      goldenExamples: [],
      successPatterns: [],
      avoidPatterns: []
    };
    
    console.log('========================================');
    console.log('FALLBACK DATA PATH - Step 8 transition');
    console.log('Demo Mode:', onboardingData.demoMode);
    console.log('========================================');
    
    // CRITICAL: Show Step 8 FIRST before trying to populate it!
    console.log('STEP 1: Showing Step 8 first...');
    
    // Make sure onboarding view is visible
    var onboardingView = document.getElementById('onboardingView');
    if (onboardingView) {
      onboardingView.classList.remove('hidden');
      console.log('✓ Onboarding view is visible');
    }
    
    // Hide ALL steps first
    var allSteps = document.querySelectorAll('.onboarding-step');
    console.log('Found', allSteps.length, 'onboarding steps');
    allSteps.forEach(function(step, index) {
      step.classList.add('hidden');
    });
    
    // Force show Step 8 with maximum aggression
    var step8 = document.getElementById('onboardingStep8');
    if (step8) {
      // Remove hidden class
      step8.classList.remove('hidden');
      
      // Force inline styles
      step8.setAttribute('style', 'display: block !important; visibility: visible !important; opacity: 1 !important;');
      
      console.log('✓ STEP 8 IS NOW VISIBLE');
      
    } else {
      console.error('✗ CRITICAL ERROR: Step 8 element not found!');
      alert('Error: Cannot show results screen. Please refresh and try again.');
      return;
    }
    
    // STEP 2: NOW populate the reveal screen (elements exist now!)
    console.log('STEP 2: Populating reveal screen...');
    try {
      populateRevealScreen();
      console.log('✓ Reveal screen populated successfully');
    } catch (populateError) {
      console.error('✗ Error populating reveal screen:', populateError);
    }
    
    // Scroll to top
    window.scrollTo(0, 0);
    
    // Show continue button as backup
    setTimeout(function() {
      var continueBtn = document.getElementById('loadingContinueBtn');
      if (continueBtn) {
        continueBtn.classList.remove('hidden');
        console.log('Continue button shown as backup');
      }
    }, 2000);
  }
}

function forceShowStep8() {
  console.log('Force showing Step 8...');
  
  // Hide loading button
  var continueBtn = document.getElementById('loadingContinueBtn');
  if (continueBtn) continueBtn.classList.add('hidden');
  
  // Hide all steps
  var allSteps = document.querySelectorAll('.onboarding-step');
  allSteps.forEach(function(step) {
    step.classList.add('hidden');
  });
  
  // Show Step 8
  var step8 = document.getElementById('onboardingStep8');
  if (step8) {
    step8.classList.remove('hidden');
    console.log('Step 8 is now visible');
  } else {
    console.error('Step 8 element not found!');
  }
}

function toggleRevealSection(element) {
  element.classList.toggle('collapsed');
}


// Cache for brand selector updates (prevents redundant rebuilds)
var brandSelectorCache = {
  lastBrandCount: -1,
  lastBrandNames: '',
  updateInProgress: false
};

function updateBrandSelectors(force) {
  // Skip if update already in progress (debouncing)
  if (brandSelectorCache.updateInProgress && !force) {
    console.log('⏭️ Skipping redundant brand selector update');
    return;
  }
  
  // Cache check: Skip if brands haven't changed
  var currentBrandNames = brands.map(function(b) { return b.name; }).join(',');
  if (!force && 
      brandSelectorCache.lastBrandCount === brands.length && 
      brandSelectorCache.lastBrandNames === currentBrandNames) {
    console.log('⏭️ Skipping update - brands unchanged (cached)');
    return;
  }
  
  brandSelectorCache.updateInProgress = true;
  
  console.log('=== UPDATE BRAND SELECTORS ===');
  console.log('Current brands array:', brands.length, 'brands');
  if (brands.length > 0) {
    console.log('Brand names:', brands.map(function(b) { return b.name; }).join(', '));
  }
  
  // Performance optimization: Use DocumentFragment for batch DOM updates
  function buildOptionsFragment(useIndex) {
    var fragment = document.createDocumentFragment();
    brands.forEach(function(b, idx) {
      var opt = document.createElement('option');
      opt.value = useIndex ? idx : b.name;
      opt.textContent = b.name;
      fragment.appendChild(opt);
    });
    return fragment;
  }
  
  // Core brand dropdowns (using index values) - OPTIMIZED
  // v19.0: Use selectedBrand as authority for main brand selectors (prevents sync race condition resetting to 0)
  var coreSelectors = ['brand', 'agentBrand', 'studioBrand', 'mobileBrand', 'cloneSourceBrand'];
  var authorityBrandIdx = (typeof selectedBrand === 'number' && !isNaN(selectedBrand) && selectedBrand >= 0 && selectedBrand < brands.length)
    ? String(selectedBrand) : String(parseInt(localStorage.getItem('roweos_selected_brand') || '0'));
  var savedValues = {};
  coreSelectors.forEach(function(id) {
    var sel = document.getElementById(id);
    // Use selectedBrand as authority for main brand selectors, DOM value for others (like cloneSourceBrand)
    if (sel) savedValues[id] = (id === 'cloneSourceBrand') ? sel.value : authorityBrandIdx;
  });

  var coreFragment = buildOptionsFragment(true);
  coreSelectors.forEach(function(id) {
    var sel = document.getElementById(id);
    if (sel) {
      sel.innerHTML = '';
      sel.appendChild(coreFragment.cloneNode(true));
      // v15.14: Restore previously selected value
      if (savedValues[id] !== undefined) sel.value = savedValues[id];
      console.log('✓ Updated core selector:', id, '('+brands.length+' options, value:', sel.value, ')');
    } else {
      console.warn('✗ Core selector not found:', id);
    }
  });
  
  // Name-based brand dropdowns (using brand name as value) - OPTIMIZED
  var nameBasedSelectors = ['addItemBrand', 'scheduledPromptBrand', 'calItemBrand', 'rhythmAddBrand'];
  var selectorsWithPlaceholder = ['rhythmAddBrand']; // Selectors that need "Select Brand" placeholder
  var nameFragment = buildOptionsFragment(false);
  nameBasedSelectors.forEach(function(id) {
    var sel = document.getElementById(id);
    if (sel) {
      sel.innerHTML = '';
      // Add placeholder for certain selectors
      if (selectorsWithPlaceholder.indexOf(id) !== -1) {
        var placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Select Brand';
        sel.appendChild(placeholder);
      }
      sel.appendChild(nameFragment.cloneNode(true));
      console.log('✓ Updated name-based selector:', id, '('+brands.length+' options)');
    }
  });
  
  // Generic data-brand-selector attribute (finds all dynamically)
  var genericSelectors = document.querySelectorAll('[data-brand-selector="true"]');
  genericSelectors.forEach(function(sel) {
    // Skip if already handled above
    if (coreSelectors.indexOf(sel.id) === -1 && nameBasedSelectors.indexOf(sel.id) === -1) {
      sel.innerHTML = '';
      sel.appendChild(nameFragment.cloneNode(true));
      console.log('✓ Updated generic selector:', sel.id || 'unnamed', '('+brands.length+' options)');
    }
  });
  
  // Update multi-model configuration list in settings
  if (typeof renderModelConfigList === 'function') {
    renderModelConfigList();
  }
  
  // v15.14: Re-sync Studio brand name after selector rebuild
  if (typeof updateStudioBrandName === 'function') {
    updateStudioBrandName();
  }

  // Update cache
  brandSelectorCache.lastBrandCount = brands.length;
  brandSelectorCache.lastBrandNames = currentBrandNames;
  brandSelectorCache.updateInProgress = false;

  console.log('=== BRAND SELECTORS UPDATED (OPTIMIZED) ===');
}


