/**
 * TASKFLOW PRO — CORE APPLICATION ENGINE
 * Pure Vanilla JavaScript (ES6+)
 * Features: LocalStorage, Real-time Filtering, Search, Sorting, 
 * Dynamic Stats & Progress, Confetti celebration, Undo Toast, Theme Switching.
 */

(() => {
  'use strict';

  /* ==========================================================================
     1. Constants & Default State
     ========================================================================== */
  const STORAGE_KEY_TASKS = 'taskflow_tasks_v2';
  const STORAGE_KEY_THEME = 'taskflow_theme_pref';

  const DEFAULT_TASKS = [
    {
      id: 'task-init-1',
      title: 'Review project requirements & plan sprint',
      category: 'Work',
      priority: 'high',
      dueDate: getRelativeDateString(1), // Tomorrow
      notes: 'Double check deliverables with the team before kickoff.',
      completed: false,
      starred: true,
      createdAt: Date.now() - 3600000 * 4
    },
    {
      id: 'task-init-2',
      title: '45-minute HIIT workout & hydration goal',
      category: 'Health',
      priority: 'medium',
      dueDate: getRelativeDateString(0), // Today
      notes: 'Focus on core strength and 2L of water.',
      completed: false,
      starred: false,
      createdAt: Date.now() - 3600000 * 2
    },
    {
      id: 'task-init-3',
      title: 'Setup TaskFlow workspace and explore features',
      category: 'Personal',
      priority: 'low',
      dueDate: getRelativeDateString(0),
      notes: 'Enjoy the sleek dark/light mode and productivity tracking!',
      completed: true,
      starred: false,
      createdAt: Date.now() - 3600000 * 8
    }
  ];

  let state = {
    tasks: [],
    filter: 'all',          // 'all' | 'active' | 'completed' | 'starred'
    category: 'all',        // 'all' | 'Work' | 'Personal' etc.
    searchQuery: '',
    sortBy: 'date-desc',    // 'date-desc' | 'date-asc' | 'due-asc' | 'priority-desc' | 'alpha-asc'
    theme: 'dark',
    undoCache: null         // { task, index, timerId }
  };

  /* ==========================================================================
     2. DOM Element Selectors
     ========================================================================== */
  const elements = {
    html: document.documentElement,
    themeToggleBtn: document.getElementById('theme-toggle'),
    greetingText: document.getElementById('greeting-text'),
    currentDateDisplay: document.getElementById('current-date-display'),
    
    // Stats & Progress
    progressCircle: document.getElementById('progress-circle'),
    progressPercentText: document.getElementById('progress-percent-text'),
    linearProgressBar: document.getElementById('linear-progress-bar'),
    progressHeadline: document.getElementById('progress-status-headline'),
    progressSub: document.getElementById('progress-status-sub'),
    statTotal: document.getElementById('stat-total'),
    statActive: document.getElementById('stat-active'),
    statCompleted: document.getElementById('stat-completed'),
    statStarred: document.getElementById('stat-starred'),
    
    // Form Inputs
    taskForm: document.getElementById('task-form'),
    taskTitleInput: document.getElementById('task-title-input'),
    taskCategorySelect: document.getElementById('task-category-select'),
    taskPrioritySelect: document.getElementById('task-priority-select'),
    taskDueDate: document.getElementById('task-due-date'),
    taskNotesInput: document.getElementById('task-notes-input'),
    
    // Search & Sort
    searchInput: document.getElementById('search-input'),
    searchClearBtn: document.getElementById('search-clear'),
    sortSelect: document.getElementById('sort-select'),
    
    // Filters & Category
    filterTabs: document.querySelectorAll('.filter-tab'),
    categoryChipsBar: document.getElementById('category-chips-bar'),
    categoryChips: document.querySelectorAll('.chip'),
    
    // Counts in Tabs
    countAll: document.getElementById('count-all'),
    countActive: document.getElementById('count-active'),
    countCompleted: document.getElementById('count-completed'),
    countStarred: document.getElementById('count-starred'),
    
    // Task List & Actions
    currentViewTitle: document.getElementById('current-view-title'),
    taskList: document.getElementById('task-list'),
    emptyState: document.getElementById('empty-state'),
    emptyTitle: document.getElementById('empty-title'),
    emptyDesc: document.getElementById('empty-desc'),
    emptyActionBtn: document.getElementById('empty-action-btn'),
    
    // Header List Actions
    btnExport: document.getElementById('btn-export'),
    importFileInput: document.getElementById('import-file-input'),
    btnClearCompleted: document.getElementById('btn-clear-completed'),
    
    // Edit Modal
    editModal: document.getElementById('edit-modal'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    modalCancelBtn: document.getElementById('modal-cancel-btn'),
    editForm: document.getElementById('edit-form'),
    editTaskId: document.getElementById('edit-task-id'),
    editTitle: document.getElementById('edit-title'),
    editCategory: document.getElementById('edit-category'),
    editPriority: document.getElementById('edit-priority'),
    editDueDate: document.getElementById('edit-due-date'),
    editNotes: document.getElementById('edit-notes'),

    // Toast Container
    toastContainer: document.getElementById('toast-container'),
    confettiCanvas: document.getElementById('confetti-canvas')
  };

  /* ==========================================================================
     3. Helper Utilities
     ========================================================================== */
  function getRelativeDateString(daysOffset) {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().split('T')[0];
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [year, month, day] = dateStr.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    targetDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((targetDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Overdue (${Math.abs(diffDays)}d ago)`, status: 'overdue' };
    } else if (diffDays === 0) {
      return { text: 'Due Today', status: 'today' };
    } else if (diffDays === 1) {
      return { text: 'Due Tomorrow', status: 'upcoming' };
    } else {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return { text: `Due ${monthNames[targetDate.getMonth()]} ${targetDate.getDate()}`, status: 'normal' };
    }
  }

  function updateGreetingAndDate() {
    const now = new Date();
    const hours = now.getHours();
    let timeGreeting = 'Good day';

    if (hours >= 5 && hours < 12) timeGreeting = 'Good morning';
    else if (hours >= 12 && hours < 17) timeGreeting = 'Good afternoon';
    else if (hours >= 17 && hours < 22) timeGreeting = 'Good evening';
    else timeGreeting = 'Burning the midnight oil';

    elements.greetingText.textContent = `${timeGreeting}, ready to achieve your goals?`;

    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    elements.currentDateDisplay.textContent = now.toLocaleDateString('en-US', options);
  }

  /* ==========================================================================
     4. Storage & State Management
     ========================================================================== */
  function loadState() {
    // Theme
    const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
    if (savedTheme) {
      state.theme = savedTheme;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      state.theme = 'light';
    }
    applyTheme(state.theme);

    // Tasks
    try {
      const savedTasks = localStorage.getItem(STORAGE_KEY_TASKS);
      if (savedTasks) {
        state.tasks = JSON.parse(savedTasks);
      } else {
        state.tasks = [...DEFAULT_TASKS];
        saveTasks();
      }
    } catch (e) {
      console.warn('Failed to parse saved tasks, initializing default list.', e);
      state.tasks = [...DEFAULT_TASKS];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(state.tasks));
    } catch (e) {
      console.error('Could not save tasks to localStorage', e);
      showToast('⚠️ Storage limit reached or localStorage disabled.');
    }
  }

  function applyTheme(theme) {
    state.theme = theme;
    elements.html.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY_THEME, theme);
  }

  function toggleTheme() {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
  }

  /* ==========================================================================
     5. Productivity Metrics & Progress Calculation
     ========================================================================== */
  function updateDashboardMetrics() {
    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.completed).length;
    const active = total - completed;
    const starred = state.tasks.filter(t => t.starred).length;

    // Numerical stats
    elements.statTotal.textContent = total;
    elements.statActive.textContent = active;
    elements.statCompleted.textContent = completed;
    elements.statStarred.textContent = starred;

    // Filter tab counts
    elements.countAll.textContent = total;
    elements.countActive.textContent = active;
    elements.countCompleted.textContent = completed;
    elements.countStarred.textContent = starred;

    // Percentage
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    elements.progressPercentText.textContent = `${percentage}%`;
    elements.linearProgressBar.style.width = `${percentage}%`;

    // SVG Circular Ring Fill (radius 40, circumference 2 * PI * 40 = 251.32)
    const circumference = 251.32;
    const offset = circumference - (circumference * percentage) / 100;
    elements.progressCircle.style.strokeDashoffset = offset;

    // Motivational messaging
    if (total === 0) {
      elements.progressHeadline.textContent = 'Ready for action';
      elements.progressSub.textContent = 'Add your first task below to get started!';
    } else if (percentage === 100) {
      elements.progressHeadline.textContent = 'Outstanding Work! 🎉';
      elements.progressSub.textContent = 'All tasks completed. Enjoy your triumph!';
    } else if (percentage >= 75) {
      elements.progressHeadline.textContent = 'Almost at the finish line! 🚀';
      elements.progressSub.textContent = `Just ${active} task${active > 1 ? 's' : ''} left. Keep the momentum going!`;
    } else if (percentage >= 50) {
      elements.progressHeadline.textContent = 'Halfway accomplished! ⚡';
      elements.progressSub.textContent = `${completed} completed, you\'re on a great streak!`;
    } else if (percentage > 0) {
      elements.progressHeadline.textContent = 'Making Progress 🌱';
      elements.progressSub.textContent = `${active} tasks remaining for today.`;
    } else {
      elements.progressHeadline.textContent = 'Productivity Pulse 🎯';
      elements.progressSub.textContent = `${total} task${total > 1 ? 's' : ''} waiting to be conquered.`;
    }
  }

  /* ==========================================================================
     6. Filtering, Sorting & Rendering Pipeline
     ========================================================================== */
  function getFilteredAndSortedTasks() {
    let result = [...state.tasks];

    // Status Filter (Tabs)
    if (state.filter === 'active') {
      result = result.filter(t => !t.completed);
    } else if (state.filter === 'completed') {
      result = result.filter(t => t.completed);
    } else if (state.filter === 'starred') {
      result = result.filter(t => t.starred);
    }

    // Category Filter
    if (state.category !== 'all') {
      result = result.filter(t => t.category.toLowerCase() === state.category.toLowerCase());
    }

    // Search Query
    if (state.searchQuery.trim() !== '') {
      const q = state.searchQuery.toLowerCase().trim();
      result = result.filter(t => 
        t.title.toLowerCase().includes(q) || 
        (t.notes && t.notes.toLowerCase().includes(q))
      );
    }

    // Sorting
    const priorityWeights = { high: 3, medium: 2, low: 1 };

    result.sort((a, b) => {
      // Always keep starred items at the top unless specifically sorting alphabetically
      if (state.sortBy !== 'alpha-asc') {
        if (a.starred && !b.starred) return -1;
        if (!a.starred && b.starred) return 1;
      }

      switch (state.sortBy) {
        case 'date-asc':
          return a.createdAt - b.createdAt;
        case 'due-asc':
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        case 'priority-desc':
          return (priorityWeights[b.priority] || 0) - (priorityWeights[a.priority] || 0);
        case 'alpha-asc':
          return a.title.localeCompare(b.title);
        case 'date-desc':
        default:
          return b.createdAt - a.createdAt;
      }
    });

    return result;
  }

  function renderTasks() {
    updateDashboardMetrics();
    const visibleTasks = getFilteredAndSortedTasks();

    // Update View Title
    let viewTitle = 'All Tasks';
    if (state.filter === 'active') viewTitle = 'Active Tasks';
    else if (state.filter === 'completed') viewTitle = 'Completed Tasks';
    else if (state.filter === 'starred') viewTitle = 'Starred Tasks';

    if (state.category !== 'all') {
      viewTitle += ` &bull; ${state.category}`;
    }
    elements.currentViewTitle.innerHTML = viewTitle;

    // Render list or empty state
    if (visibleTasks.length === 0) {
      elements.taskList.innerHTML = '';
      elements.emptyState.hidden = false;

      if (state.searchQuery.trim() !== '') {
        elements.emptyTitle.textContent = 'No matching tasks found';
        elements.emptyDesc.textContent = `No results found for "${escapeHTML(state.searchQuery)}". Try another search term.`;
        elements.emptyActionBtn.textContent = 'Clear Search';
        elements.emptyActionBtn.onclick = () => {
          state.searchQuery = '';
          elements.searchInput.value = '';
          elements.searchClearBtn.hidden = true;
          renderTasks();
        };
      } else if (state.filter === 'completed') {
        elements.emptyTitle.textContent = 'No completed tasks yet';
        elements.emptyDesc.textContent = 'Complete some active tasks and they will appear here.';
        elements.emptyActionBtn.textContent = 'View Active Tasks';
        elements.emptyActionBtn.onclick = () => switchFilterTab('active');
      } else if (state.filter === 'starred') {
        elements.emptyTitle.textContent = 'No starred tasks';
        elements.emptyDesc.textContent = 'Star your most critical items to access them quickly.';
        elements.emptyActionBtn.textContent = 'View All Tasks';
        elements.emptyActionBtn.onclick = () => switchFilterTab('all');
      } else {
        elements.emptyTitle.textContent = 'All clear! No tasks here';
        elements.emptyDesc.textContent = 'Enjoy your free time or add a new task above.';
        elements.emptyActionBtn.textContent = 'Create a Task';
        elements.emptyActionBtn.onclick = () => elements.taskTitleInput.focus();
      }
      return;
    }

    elements.emptyState.hidden = true;

    // Build Task Items HTML
    const htmlFragments = visibleTasks.map(task => {
      const isCompleted = task.completed ? 'completed' : '';
      const isStarred = task.starred ? 'starred' : '';
      const dateInfo = formatDisplayDate(task.dueDate);

      const categoryClass = `badge-cat-${task.category.toLowerCase()}`;
      const priorityClass = `badge-priority-${task.priority}`;

      return `
        <li class="task-item ${isCompleted}" data-id="${task.id}">
          <div class="custom-checkbox-wrapper">
            <input 
              type="checkbox" 
              class="checkbox-native task-checkbox" 
              data-id="${task.id}"
              ${task.completed ? 'checked' : ''} 
              aria-label="Mark task as complete"
            >
            <div class="checkbox-visual">
              <svg class="check-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          </div>

          <div class="task-content">
            <div class="task-title-row">
              <span class="task-text">${escapeHTML(task.title)}</span>
              <div class="task-actions">
                <button 
                  class="task-action-btn star-btn ${isStarred}" 
                  data-action="star" 
                  data-id="${task.id}"
                  title="${task.starred ? 'Unstar task' : 'Star task'}"
                  aria-label="Star task"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                  </svg>
                </button>
                <button 
                  class="task-action-btn edit-btn" 
                  data-action="edit" 
                  data-id="${task.id}"
                  title="Edit task"
                  aria-label="Edit task"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                  </svg>
                </button>
                <button 
                  class="task-action-btn delete-btn" 
                  data-action="delete" 
                  data-id="${task.id}"
                  title="Delete task"
                  aria-label="Delete task"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>

            ${task.notes ? `<p class="task-notes">${escapeHTML(task.notes)}</p>` : ''}

            <div class="task-meta-row">
              <span class="badge ${categoryClass}">${getCategoryIcon(task.category)} ${task.category}</span>
              <span class="badge ${priorityClass}">● ${task.priority.toUpperCase()}</span>
              ${dateInfo ? `<span class="badge badge-due-date ${dateInfo.status}">📅 ${dateInfo.text}</span>` : ''}
            </div>
          </div>
        </li>
      `;
    }).join('');

    elements.taskList.innerHTML = htmlFragments;
  }

  function getCategoryIcon(cat) {
    switch (cat) {
      case 'Work': return '💼';
      case 'Personal': return '👤';
      case 'Study': return '📚';
      case 'Health': return '🏃';
      case 'Finance': return '💳';
      case 'Creative': return '🎨';
      default: return '🏷️';
    }
  }

  /* ==========================================================================
     7. Task Actions & Handlers
     ========================================================================== */
  function addTask(title, category, priority, dueDate, notes) {
    if (!title.trim()) return;

    const newTask = {
      id: 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      title: title.trim(),
      category: category || 'Personal',
      priority: priority || 'medium',
      dueDate: dueDate || '',
      notes: notes ? notes.trim() : '',
      completed: false,
      starred: false,
      createdAt: Date.now()
    };

    state.tasks.unshift(newTask);
    saveTasks();
    renderTasks();
    showToast('✨ Task added successfully!');
  }

  function toggleTaskCompletion(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    saveTasks();
    renderTasks();

    if (task.completed) {
      triggerConfetti(false); // subtle burst
      // Check if all are now completed
      const allDone = state.tasks.length > 0 && state.tasks.every(t => t.completed);
      if (allDone) {
        setTimeout(() => triggerConfetti(true), 350); // grand celebration
        showToast('🏆 All tasks completed! You are on fire!');
      }
    }
  }

  function toggleTaskStar(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    task.starred = !task.starred;
    saveTasks();
    renderTasks();
    showToast(task.starred ? '⭐ Task pinned to top' : 'Task unstarred');
  }

  function deleteTask(id) {
    const taskIndex = state.tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return;

    const [deletedTask] = state.tasks.splice(taskIndex, 1);
    saveTasks();
    renderTasks();

    // Setup Undo
    if (state.undoCache && state.undoCache.timerId) {
      clearTimeout(state.undoCache.timerId);
    }

    const timerId = setTimeout(() => {
      state.undoCache = null;
    }, 6000);

    state.undoCache = {
      task: deletedTask,
      index: taskIndex,
      timerId
    };

    showToast(`🗑️ Task "${deletedTask.title.slice(0, 20)}..." deleted`, true);
  }

  function undoDelete() {
    if (!state.undoCache) return;
    clearTimeout(state.undoCache.timerId);

    const { task, index } = state.undoCache;
    state.tasks.splice(index, 0, task);
    state.undoCache = null;

    saveTasks();
    renderTasks();
    showToast('↩️ Task restored!');
  }

  function openEditModal(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    elements.editTaskId.value = task.id;
    elements.editTitle.value = task.title;
    elements.editCategory.value = task.category;
    elements.editPriority.value = task.priority;
    elements.editDueDate.value = task.dueDate || '';
    elements.editNotes.value = task.notes || '';

    elements.editModal.classList.add('active');
    elements.editModal.setAttribute('aria-hidden', 'false');
    elements.editTitle.focus();
  }

  function closeEditModal() {
    elements.editModal.classList.remove('active');
    elements.editModal.setAttribute('aria-hidden', 'true');
  }

  function handleSaveEdit(e) {
    e.preventDefault();
    const id = elements.editTaskId.value;
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    task.title = elements.editTitle.value.trim();
    task.category = elements.editCategory.value;
    task.priority = elements.editPriority.value;
    task.dueDate = elements.editDueDate.value;
    task.notes = elements.editNotes.value.trim();

    saveTasks();
    renderTasks();
    closeEditModal();
    showToast('💾 Task updated!');
  }

  function clearCompletedTasks() {
    const completedCount = state.tasks.filter(t => t.completed).length;
    if (completedCount === 0) {
      showToast('ℹ️ No completed tasks to clear.');
      return;
    }

    if (confirm(`Are you sure you want to remove ${completedCount} completed task${completedCount > 1 ? 's' : ''}?`)) {
      state.tasks = state.tasks.filter(t => !t.completed);
      saveTasks();
      renderTasks();
      showToast(`🧹 Cleared ${completedCount} completed task${completedCount > 1 ? 's' : ''}.`);
    }
  }

  /* ==========================================================================
     8. Filter, Category & Sort Switching
     ========================================================================= */
  function switchFilterTab(tabName) {
    state.filter = tabName;
    elements.filterTabs.forEach(tab => {
      const isActive = tab.dataset.tab === tabName;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    renderTasks();
  }

  function switchCategoryChip(catName) {
    state.category = catName;
    elements.categoryChips.forEach(chip => {
      chip.classList.toggle('active', chip.dataset.category === catName);
    });
    renderTasks();
  }

  /* ==========================================================================
     9. Import & Export Features
     ========================================================================== */
  function exportTasksToJSON() {
    if (state.tasks.length === 0) {
      showToast('ℹ️ No tasks to export.');
      return;
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.tasks, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `taskflow-export-${getRelativeDateString(0)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast('📥 Tasks exported successfully!');
  }

  function importTasksFromJSON(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (!Array.isArray(importedData)) {
          throw new Error('Invalid JSON format: expected an array of tasks.');
        }

        // Validate basic properties
        const sanitizedTasks = importedData.map((item, index) => ({
          id: item.id || `imported-${Date.now()}-${index}`,
          title: item.title ? String(item.title) : 'Untitled Task',
          category: ['Work', 'Personal', 'Study', 'Health', 'Finance', 'Creative'].includes(item.category) ? item.category : 'Personal',
          priority: ['low', 'medium', 'high'].includes(item.priority) ? item.priority : 'medium',
          dueDate: item.dueDate || '',
          notes: item.notes || '',
          completed: Boolean(item.completed),
          starred: Boolean(item.starred),
          createdAt: Number(item.createdAt) || Date.now()
        }));

        state.tasks = sanitizedTasks;
        saveTasks();
        renderTasks();
        showToast(`✅ Successfully imported ${sanitizedTasks.length} tasks!`);
      } catch (err) {
        console.error('Import error:', err);
        showToast('❌ Failed to import: Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  }

  /* ==========================================================================
     10. Toast Notification System
     ========================================================================== */
  function showToast(message, withUndo = false) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <span>${message}</span>
      ${withUndo ? '<button class="toast-undo-btn" id="toast-undo-btn">Undo</button>' : ''}
    `;

    elements.toastContainer.appendChild(toast);

    if (withUndo) {
      const undoBtn = toast.querySelector('#toast-undo-btn');
      if (undoBtn) {
        undoBtn.addEventListener('click', () => {
          undoDelete();
          toast.remove();
        });
      }
    }

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  /* ==========================================================================
     11. High Performance Particle Confetti
     ========================================================================== */
  function triggerConfetti(isGrand = false) {
    const canvas = elements.confettiCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particleCount = isGrand ? 120 : 40;
    const particles = [];
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: isGrand ? canvas.width / 2 + (Math.random() - 0.5) * 400 : Math.random() * canvas.width,
        y: isGrand ? canvas.height / 2 : 0,
        w: Math.random() * 8 + 4,
        h: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * (isGrand ? 12 : 6),
        vy: isGrand ? (Math.random() - 0.7) * 14 : Math.random() * 4 + 2,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1
      });
    }

    let animationFrameId;
    function renderConfetti() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // gravity
        p.rotation += p.rotationSpeed;
        p.opacity -= 0.009;

        if (p.opacity > 0 && p.y < canvas.height) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      });

      if (alive) {
        animationFrameId = requestAnimationFrame(renderConfetti);
      } else {
        cancelAnimationFrame(animationFrameId);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    renderConfetti();
  }

  /* ==========================================================================
     12. Event Listeners Initialization
     ========================================================================== */
  function initEventListeners() {
    // Theme toggle
    elements.themeToggleBtn.addEventListener('click', toggleTheme);

    // Form submit
    elements.taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      addTask(
        elements.taskTitleInput.value,
        elements.taskCategorySelect.value,
        elements.taskPrioritySelect.value,
        elements.taskDueDate.value,
        elements.taskNotesInput.value
      );
      elements.taskTitleInput.value = '';
      elements.taskNotesInput.value = '';
      elements.taskDueDate.value = '';
    });

    // Delegated Task Item clicks (Checkbox, Star, Edit, Delete)
    elements.taskList.addEventListener('click', (e) => {
      const checkbox = e.target.closest('.task-checkbox');
      if (checkbox) {
        toggleTaskCompletion(checkbox.dataset.id);
        return;
      }

      const starBtn = e.target.closest('[data-action="star"]');
      if (starBtn) {
        toggleTaskStar(starBtn.dataset.id);
        return;
      }

      const editBtn = e.target.closest('[data-action="edit"]');
      if (editBtn) {
        openEditModal(editBtn.dataset.id);
        return;
      }

      const deleteBtn = e.target.closest('[data-action="delete"]');
      if (deleteBtn) {
        deleteTask(deleteBtn.dataset.id);
        return;
      }
    });

    // Filter Tabs
    elements.filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        switchFilterTab(tab.dataset.tab);
      });
    });

    // Category Chips
    elements.categoryChips.forEach(chip => {
      chip.addEventListener('click', () => {
        switchCategoryChip(chip.dataset.category);
      });
    });

    // Stat Cards Clicks (quick shortcut to filter tab)
    document.querySelectorAll('.stat-card').forEach(card => {
      card.addEventListener('click', () => {
        const filter = card.dataset.filter;
        if (filter) switchFilterTab(filter);
      });
    });

    // Search input
    elements.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      elements.searchClearBtn.hidden = state.searchQuery.length === 0;
      renderTasks();
    });

    elements.searchClearBtn.addEventListener('click', () => {
      state.searchQuery = '';
      elements.searchInput.value = '';
      elements.searchClearBtn.hidden = true;
      renderTasks();
      elements.searchInput.focus();
    });

    // Sort select
    elements.sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      renderTasks();
    });

    // Modal Events
    elements.editForm.addEventListener('submit', handleSaveEdit);
    elements.modalCloseBtn.addEventListener('click', closeEditModal);
    elements.modalCancelBtn.addEventListener('click', closeEditModal);

    elements.editModal.addEventListener('click', (e) => {
      if (e.target === elements.editModal) {
        closeEditModal();
      }
    });

    // Export & Import
    elements.btnExport.addEventListener('click', exportTasksToJSON);
    elements.importFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        importTasksFromJSON(e.target.files[0]);
        e.target.value = ''; // reset file input
      }
    });

    // Clear completed
    elements.btnClearCompleted.addEventListener('click', clearCompletedTasks);

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Escape closes modal
      if (e.key === 'Escape' && elements.editModal.classList.contains('active')) {
        closeEditModal();
      }
      // '/' focuses search unless already in an input
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        elements.searchInput.focus();
      }
    });

    // Window resize handler for confetti canvas
    window.addEventListener('resize', () => {
      if (elements.confettiCanvas) {
        elements.confettiCanvas.width = window.innerWidth;
        elements.confettiCanvas.height = window.innerHeight;
      }
    });
  }

  /* ==========================================================================
     13. App Bootstrap
     ========================================================================== */
  function init() {
    updateGreetingAndDate();
    loadState();
    initEventListeners();
    renderTasks();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
