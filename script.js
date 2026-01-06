// ===== Application State =====
let appState = {
    currentMonth: '',
    theme: 'light',
    habits: [],
    marks: {},
    streaks: {},
    editingHabitId: null
};

let charts = {
    line: null,
    bar: null,
    donut: null
};

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    attachEventListeners();
});

function initApp() {
    loadFromLocalStorage();
    setCurrentMonth();
    applyTheme();
    renderTrackerGrid();
    updateAllUI();
}

function setCurrentMonth() {
    if (!appState.currentMonth) {
        const now = new Date();
        appState.currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    document.getElementById('monthSelect').value = appState.currentMonth;
}

// ===== Event Listeners =====
function attachEventListeners() {
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // Month selector
    document.getElementById('monthSelect').addEventListener('change', (e) => {
        appState.currentMonth = e.target.value;
        renderTrackerGrid();
        updateAllUI();
        saveToLocalStorage();
    });

    // Tab navigation
    document.getElementById('trackerTab').addEventListener('click', () => switchTab('tracker'));
    document.getElementById('dashboardTab').addEventListener('click', () => switchTab('dashboard'));

    // Habit controls
    document.getElementById('addHabitBtn').addEventListener('click', openAddHabitModal);

    // Modal controls
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelHabitBtn').addEventListener('click', closeModal);
    document.getElementById('saveHabitBtn').addEventListener('click', saveHabit);

    // Export PDF
    document.getElementById('exportPdfBtn').addEventListener('click', generatePDF);

    // Close modal on outside click
    document.getElementById('habitModal').addEventListener('click', (e) => {
        if (e.target.id === 'habitModal') closeModal();
    });

    // Enter key in modal
    document.getElementById('habitNameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveHabit();
    });
}

// ===== Theme Management =====
function toggleTheme() {
    appState.theme = appState.theme === 'light' ? 'dark' : 'light';
    applyTheme();
    saveToLocalStorage();
}

function applyTheme() {
    const icon = document.querySelector('.theme-icon');
    if (appState.theme === 'dark') {
        document.body.classList.add('dark-theme');
        icon.textContent = '☀️';
    } else {
        document.body.classList.remove('dark-theme');
        icon.textContent = '🌙';
    }

    // Update charts with new theme
    if (document.getElementById('dashboardView').classList.contains('active')) {
        updateCharts();
    }
}

// ===== Tab Switching =====
function switchTab(tab) {
    const trackerView = document.getElementById('trackerView');
    const dashboardView = document.getElementById('dashboardView');
    const trackerTab = document.getElementById('trackerTab');
    const dashboardTab = document.getElementById('dashboardTab');

    if (tab === 'tracker') {
        trackerView.classList.add('active');
        dashboardView.classList.remove('active');
        trackerTab.classList.add('active');
        dashboardTab.classList.remove('active');
    } else {
        trackerView.classList.remove('active');
        dashboardView.classList.add('active');
        trackerTab.classList.remove('active');
        dashboardTab.classList.add('active');
        renderDashboard();
    }
}

// ===== Context Menu for Habits =====
let activeContextMenu = null;

function showHabitContextMenu(event, habitId) {
    event.preventDefault();
    event.stopPropagation();

    // Remove any existing context menu
    closeContextMenu();

    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'habit-context-menu';
    menu.innerHTML = `
        <div class="context-menu-item" onclick="openEditHabitModal('${habitId}'); closeContextMenu();">
            <span class="context-menu-icon">✏️</span>
            <span>Edit Habit</span>
        </div>
        <div class="context-menu-item" onclick="showEmojiPicker('${habitId}'); closeContextMenu();">
            <span class="context-menu-icon">😊</span>
            <span>Add Emoji</span>
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item danger" onclick="deleteHabit('${habitId}'); closeContextMenu();">
            <span class="context-menu-icon">🗑️</span>
            <span>Delete Habit</span>
        </div>
    `;

    // Position the menu
    const rect = event.currentTarget.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = rect.bottom + 5 + 'px';
    menu.style.left = rect.left + 'px';

    document.body.appendChild(menu);
    activeContextMenu = menu;

    // Add click outside to close
    setTimeout(() => {
        document.addEventListener('click', closeContextMenu);
    }, 0);
}

function closeContextMenu() {
    if (activeContextMenu) {
        activeContextMenu.remove();
        activeContextMenu = null;
        document.removeEventListener('click', closeContextMenu);
    }
}

function showEmojiPicker(habitId) {
    const emojis = ['😊', '💪', '🎯', '⚡', '🔥', '⭐', '✨', '🌟', '💯', '🎉', '🏆', '📚', '☕', '🍎', '🧘', '🏃', '💻', '🎨'];

    // Close context menu first
    closeContextMenu();

    // Find the habit
    const habit = appState.habits.find(h => h.id === habitId);
    if (!habit) return;

    // Show emoji picker dialog
    const picker = document.createElement('div');
    picker.className = 'emoji-picker-modal';
    picker.innerHTML = `
        <div class="emoji-picker-content">
            <div class="emoji-picker-header">
                <h4>Choose an Emoji</h4>
                <button class="emoji-picker-close" onclick="this.closest('.emoji-picker-modal').remove()">&times;</button>
            </div>
            <div class="emoji-grid">
                ${emojis.map(emoji => `
                    <button class="emoji-option" onclick="addEmojiToHabit('${habitId}', '${emoji}'); this.closest('.emoji-picker-modal').remove();">
                        ${emoji}
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    document.body.appendChild(picker);
}

function addEmojiToHabit(habitId, emoji) {
    const habit = appState.habits.find(h => h.id === habitId);
    if (!habit) return;

    // Add emoji to habit name if not already present
    if (!habit.name.startsWith(emoji)) {
        habit.name = emoji + ' ' + habit.name;
        saveToLocalStorage();
        renderTrackerGrid();
    }
}

// ===== Drag and Drop for Reordering =====
let draggedElement = null;
let draggedHabitId = null;

function handleDragStart(e) {
    draggedElement = e.currentTarget;
    draggedHabitId = draggedElement.dataset.habitId;
    draggedElement.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', draggedElement.innerHTML);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';

    const targetRow = e.currentTarget;
    if (targetRow === draggedElement) return;

    // Add visual feedback
    const rect = targetRow.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;

    if (e.clientY < midpoint) {
        targetRow.classList.add('drag-over-top');
        targetRow.classList.remove('drag-over-bottom');
    } else {
        targetRow.classList.add('drag-over-bottom');
        targetRow.classList.remove('drag-over-top');
    }

    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    e.preventDefault();

    const targetRow = e.currentTarget;
    if (draggedElement === targetRow) return false;

    const targetHabitId = targetRow.dataset.habitId;

    // Find indices
    const draggedIndex = appState.habits.findIndex(h => h.id === draggedHabitId);
    const targetIndex = appState.habits.findIndex(h => h.id === targetHabitId);

    if (draggedIndex === -1 || targetIndex === -1) return false;

    // Reorder the habits array
    const [removed] = appState.habits.splice(draggedIndex, 1);
    appState.habits.splice(targetIndex, 0, removed);

    // Update order values
    appState.habits.forEach((habit, idx) => {
        habit.order = idx;
    });

    // Save and re-render
    saveToLocalStorage();
    renderTrackerGrid();

    return false;
}

function handleDragEnd(e) {
    // Remove all drag-related classes
    document.querySelectorAll('.habit-row').forEach(row => {
        row.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
    });
    draggedElement = null;
    draggedHabitId = null;
}

// ===== Habit Management =====
function openAddHabitModal() {
    if (appState.habits.length >= 25) {
        alert('Maximum 25 habits allowed!');
        return;
    }

    appState.editingHabitId = null;
    document.getElementById('modalTitle').textContent = 'Add New Habit';
    document.getElementById('habitNameInput').value = '';
    document.getElementById('habitTimeInput').value = '';
    document.getElementById('habitModal').classList.add('active');
    document.getElementById('habitNameInput').focus();
}

function openEditHabitModal(habitId) {
    const habit = appState.habits.find(h => h.id === habitId);
    if (!habit) return;

    appState.editingHabitId = habitId;
    document.getElementById('modalTitle').textContent = 'Edit Habit';
    document.getElementById('habitNameInput').value = habit.name;
    document.getElementById('habitTimeInput').value = habit.timeAllocation || '';
    document.getElementById('habitModal').classList.add('active');
    document.getElementById('habitNameInput').focus();
}

function closeModal() {
    document.getElementById('habitModal').classList.remove('active');
    appState.editingHabitId = null;
}

function saveHabit() {
    const name = document.getElementById('habitNameInput').value.trim();
    const timeAllocation = document.getElementById('habitTimeInput').value.trim();

    if (!name) {
        alert('Please enter a habit name');
        return;
    }

    if (appState.editingHabitId) {
        // Edit existing habit
        const habit = appState.habits.find(h => h.id === appState.editingHabitId);
        if (habit) {
            habit.name = name;
            habit.timeAllocation = timeAllocation;
        }
    } else {
        // Add new habit
        const newHabit = {
            id: generateId(),
            name: name,
            timeAllocation: timeAllocation,
            order: appState.habits.length
        };
        appState.habits.push(newHabit);

        // Initialize streak
        appState.streaks[newHabit.id] = {
            current: 0,
            longest: 0
        };
    }

    closeModal();
    renderTrackerGrid();
    updateAllUI();
    saveToLocalStorage();
}

function deleteHabit(habitId) {
    if (!confirm('Are you sure you want to delete this habit?')) return;

    appState.habits = appState.habits.filter(h => h.id !== habitId);

    // Remove associated data
    if (appState.marks[appState.currentMonth]) {
        delete appState.marks[appState.currentMonth][habitId];
    }
    delete appState.streaks[habitId];

    // Reorder remaining habits
    appState.habits.forEach((habit, index) => {
        habit.order = index;
    });

    renderTrackerGrid();
    updateAllUI();
    saveToLocalStorage();
}

function reorderHabit(habitId, direction) {
    const index = appState.habits.findIndex(h => h.id === habitId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;

    if (newIndex < 0 || newIndex >= appState.habits.length) return;

    // Swap habits
    [appState.habits[index], appState.habits[newIndex]] =
        [appState.habits[newIndex], appState.habits[index]];

    // Update order values
    appState.habits.forEach((habit, idx) => {
        habit.order = idx;
    });

    renderTrackerGrid();
    saveToLocalStorage();
}

function generateId() {
    return 'habit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ===== Tracker Grid Rendering =====
function renderTrackerGrid() {
    const table = document.getElementById('trackerTable');
    const tbody = document.getElementById('trackerBody');
    const thead = table.querySelector('thead tr');

    // Clear existing content
    thead.innerHTML = '<th class="time-header">Time</th><th class="habit-header">Habits</th>';
    tbody.innerHTML = '';

    // Get days in month
    const daysInMonth = getDaysInMonth(appState.currentMonth);
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    // Create day headers
    for (let day = 1; day <= daysInMonth; day++) {
        const th = document.createElement('th');
        th.textContent = day;
        thead.appendChild(th);
    }

    // Create habit rows
    if (appState.habits.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td colspan="${daysInMonth + 1}" class="empty-state">
                <h4>No habits yet</h4>
                <p>Click "Add Habit" to get started!</p>
            </td>
        `;
        tbody.appendChild(tr);
        updateHabitCount();
        return;
    }

    appState.habits.forEach(habit => {
        const tr = document.createElement('tr');

        // Make row draggable
        tr.setAttribute('draggable', 'true');
        tr.dataset.habitId = habit.id;
        tr.classList.add('habit-row');

        // Time allocation cell
        const timeCell = document.createElement('td');
        timeCell.className = 'time-cell';
        timeCell.textContent = habit.timeAllocation || '-';
        tr.appendChild(timeCell);

        // Habit name cell
        const habitCell = document.createElement('td');
        habitCell.className = 'habit-cell';

        const streak = calculateStreak(habit.id);
        const streakData = appState.streaks[habit.id] || { current: 0, longest: 0 };

        habitCell.innerHTML = `
            <div class="habit-info" data-habit-id="${habit.id}">
                <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
                <div class="habit-name-wrapper" onclick="showHabitContextMenu(event, '${habit.id}')" style="cursor: pointer;">
                    <span class="habit-name" title="Click for options">${escapeHtml(habit.name)}</span>
                </div>
            </div>
        `;

        // Add drag event listeners
        tr.addEventListener('dragstart', handleDragStart);
        tr.addEventListener('dragover', handleDragOver);
        tr.addEventListener('drop', handleDrop);
        tr.addEventListener('dragend', handleDragEnd);
        tr.appendChild(habitCell);

        // Day cells
        for (let day = 1; day <= daysInMonth; day++) {
            const dayCell = document.createElement('td');
            dayCell.className = 'day-cell';

            // Check if this is today
            if (appState.currentMonth === currentMonthStr && day === currentDay) {
                dayCell.classList.add('today');
            }

            const mark = getMark(habit.id, day);
            if (mark === 'complete') {
                dayCell.textContent = '✔';
                dayCell.classList.add('complete');
            } else if (mark === 'incomplete') {
                dayCell.textContent = '✖';
                dayCell.classList.add('incomplete');
            }

            dayCell.addEventListener('click', () => toggleMark(habit.id, day));
            tr.appendChild(dayCell);
        }

        tbody.appendChild(tr);
    });

    updateHabitCount();
    updateDailyProgress();
}

function getDaysInMonth(monthStr) {
    const [year, month] = monthStr.split('-').map(Number);
    return new Date(year, month, 0).getDate();
}

// ===== Mark Management =====
function getMark(habitId, day) {
    if (!appState.marks[appState.currentMonth]) return null;
    if (!appState.marks[appState.currentMonth][habitId]) return null;
    return appState.marks[appState.currentMonth][habitId][day] || null;
}

function setMark(habitId, day, value) {
    if (!appState.marks[appState.currentMonth]) {
        appState.marks[appState.currentMonth] = {};
    }
    if (!appState.marks[appState.currentMonth][habitId]) {
        appState.marks[appState.currentMonth][habitId] = {};
    }

    if (value === null) {
        delete appState.marks[appState.currentMonth][habitId][day];
    } else {
        appState.marks[appState.currentMonth][habitId][day] = value;
    }
}

function toggleMark(habitId, day) {
    const currentMark = getMark(habitId, day);
    let newMark;

    // Cycle: empty -> complete -> incomplete -> empty
    if (currentMark === null) {
        newMark = 'complete';
    } else if (currentMark === 'complete') {
        newMark = 'incomplete';
    } else {
        newMark = null;
    }

    setMark(habitId, day, newMark);

    // Update streak
    const streak = calculateStreak(habitId);
    updateStreakData(habitId, streak);

    renderTrackerGrid();
    updateDailyProgress();
    saveToLocalStorage();
}

// ===== Streak Calculation =====
function calculateStreak(habitId) {
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    // Only calculate streak for current month
    if (appState.currentMonth !== currentMonthStr) {
        return 0;
    }

    const currentDay = today.getDate();
    let streak = 0;

    // Count backwards from today
    for (let day = currentDay; day >= 1; day--) {
        const mark = getMark(habitId, day);
        if (mark === 'complete') {
            streak++;
        } else {
            break; // Streak broken
        }
    }

    return streak;
}

function updateStreakData(habitId, currentStreak) {
    if (!appState.streaks[habitId]) {
        appState.streaks[habitId] = { current: 0, longest: 0 };
    }

    appState.streaks[habitId].current = currentStreak;

    if (currentStreak > appState.streaks[habitId].longest) {
        appState.streaks[habitId].longest = currentStreak;
    }
}

// ===== Daily Progress =====
function updateDailyProgress() {
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    if (appState.currentMonth !== currentMonthStr) {
        document.getElementById('totalHabitsToday').textContent = '0';
        document.getElementById('completedToday').textContent = '0';
        document.getElementById('remainingToday').textContent = '0';
        document.getElementById('progressBar').style.width = '0%';
        return;
    }

    const currentDay = today.getDate();
    const totalHabits = appState.habits.length;
    let completed = 0;

    appState.habits.forEach(habit => {
        const mark = getMark(habit.id, currentDay);
        if (mark === 'complete') completed++;
    });

    const remaining = totalHabits - completed;
    const percentage = totalHabits > 0 ? (completed / totalHabits) * 100 : 0;

    document.getElementById('totalHabitsToday').textContent = totalHabits;
    document.getElementById('completedToday').textContent = completed;
    document.getElementById('remainingToday').textContent = remaining;
    document.getElementById('progressBar').style.width = percentage + '%';
}

function updateHabitCount() {
    document.getElementById('habitCountDisplay').textContent = appState.habits.length;
}

// ===== Dashboard =====
function renderDashboard() {
    calculateMonthlyStats();
    renderAnalyticsTable();
    updateCharts();
}

function calculateMonthlyStats() {
    const totalHabits = appState.habits.length;
    let totalCheckmarks = 0;
    let totalPossible = 0;
    const habitCompletions = {};

    const daysInMonth = getDaysInMonth(appState.currentMonth);

    appState.habits.forEach(habit => {
        let completed = 0;
        for (let day = 1; day <= daysInMonth; day++) {
            const mark = getMark(habit.id, day);
            if (mark === 'complete') {
                completed++;
                totalCheckmarks++;
            }
            totalPossible++;
        }
        habitCompletions[habit.id] = completed;
    });

    const completionRate = totalPossible > 0 ? ((totalCheckmarks / totalPossible) * 100).toFixed(1) : 0;

    // Find most and least completed
    let mostCompleted = '-';
    let leastCompleted = '-';

    if (appState.habits.length > 0) {
        const sortedHabits = Object.entries(habitCompletions).sort((a, b) => b[1] - a[1]);
        const mostHabit = appState.habits.find(h => h.id === sortedHabits[0][0]);
        const leastHabit = appState.habits.find(h => h.id === sortedHabits[sortedHabits.length - 1][0]);

        mostCompleted = mostHabit ? `${mostHabit.name} (${sortedHabits[0][1]} days)` : '-';
        leastCompleted = leastHabit ? `${leastHabit.name} (${sortedHabits[sortedHabits.length - 1][1]} days)` : '-';
    }

    // Update UI
    document.getElementById('statTotalHabits').textContent = totalHabits;
    document.getElementById('statTotalChecks').textContent = totalCheckmarks;
    document.getElementById('statCompletionRate').textContent = completionRate + '%';
    document.getElementById('statMostCompleted').textContent = mostCompleted;
    document.getElementById('statLeastCompleted').textContent = leastCompleted;
}

function renderAnalyticsTable() {
    const tbody = document.getElementById('analyticsBody');
    tbody.innerHTML = '';

    if (appState.habits.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <p>No habits to analyze</p>
                </td>
            </tr>
        `;
        return;
    }

    const daysInMonth = getDaysInMonth(appState.currentMonth);

    appState.habits.forEach(habit => {
        let completed = 0;
        let missed = 0;

        for (let day = 1; day <= daysInMonth; day++) {
            const mark = getMark(habit.id, day);
            if (mark === 'complete') completed++;
            else if (mark === 'incomplete') missed++;
        }

        const completionPercent = daysInMonth > 0 ? ((completed / daysInMonth) * 100).toFixed(1) : 0;
        const streakData = appState.streaks[habit.id] || { current: 0, longest: 0 };

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHtml(habit.name)}</strong></td>
            <td>${completionPercent}%</td>
            <td>${completed}</td>
            <td>${missed}</td>
            <td>${streakData.current}</td>
            <td>${streakData.longest}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ===== Charts =====
function updateCharts() {
    createLineChart();
    createBarChart();
    createDonutChart();
}

function getChartColors() {
    const isDark = appState.theme === 'dark';
    return {
        primary: '#6366f1',
        secondary: '#8b5cf6',
        success: '#10b981',
        danger: '#ef4444',
        text: isDark ? '#f1f5f9' : '#212529',
        grid: isDark ? '#334155' : '#dee2e6'
    };
}

function createLineChart() {
    const ctx = document.getElementById('lineChart');
    if (!ctx) return;

    if (charts.line) {
        charts.line.destroy();
    }

    const daysInMonth = getDaysInMonth(appState.currentMonth);
    const labels = [];
    const data = [];

    for (let day = 1; day <= daysInMonth; day++) {
        labels.push(day.toString());
        let completedCount = 0;

        appState.habits.forEach(habit => {
            const mark = getMark(habit.id, day);
            if (mark === 'complete') completedCount++;
        });

        data.push(completedCount);
    }

    const colors = getChartColors();

    charts.line = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Habits Completed',
                data: data,
                borderColor: colors.primary,
                backgroundColor: colors.primary + '20',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: { color: colors.text }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: colors.text,
                        stepSize: 1
                    },
                    grid: { color: colors.grid }
                },
                x: {
                    ticks: { color: colors.text },
                    grid: { color: colors.grid }
                }
            }
        }
    });
}

function createBarChart() {
    const ctx = document.getElementById('barChart');
    if (!ctx) return;

    if (charts.bar) {
        charts.bar.destroy();
    }

    const labels = [];
    const data = [];
    const daysInMonth = getDaysInMonth(appState.currentMonth);

    appState.habits.forEach(habit => {
        labels.push(habit.name.length > 15 ? habit.name.substring(0, 15) + '...' : habit.name);

        let completed = 0;
        for (let day = 1; day <= daysInMonth; day++) {
            const mark = getMark(habit.id, day);
            if (mark === 'complete') completed++;
        }

        const percentage = daysInMonth > 0 ? (completed / daysInMonth) * 100 : 0;
        data.push(percentage.toFixed(1));
    });

    const colors = getChartColors();

    charts.bar = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Completion %',
                data: data,
                backgroundColor: colors.secondary,
                borderColor: colors.secondary,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: { color: colors.text }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        color: colors.text,
                        callback: function (value) {
                            return value + '%';
                        }
                    },
                    grid: { color: colors.grid }
                },
                x: {
                    ticks: { color: colors.text },
                    grid: { color: colors.grid }
                }
            }
        }
    });
}

function createDonutChart() {
    const ctx = document.getElementById('donutChart');
    if (!ctx) return;

    if (charts.donut) {
        charts.donut.destroy();
    }

    let totalCompleted = 0;
    let totalMissed = 0;
    const daysInMonth = getDaysInMonth(appState.currentMonth);

    appState.habits.forEach(habit => {
        for (let day = 1; day <= daysInMonth; day++) {
            const mark = getMark(habit.id, day);
            if (mark === 'complete') totalCompleted++;
            else if (mark === 'incomplete') totalMissed++;
        }
    });

    const totalEmpty = (appState.habits.length * daysInMonth) - totalCompleted - totalMissed;
    const colors = getChartColors();

    charts.donut = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Completed ✔', 'Missed ✖', 'Not Marked'],
            datasets: [{
                data: [totalCompleted, totalMissed, totalEmpty],
                backgroundColor: [colors.success, colors.danger, colors.grid],
                borderWidth: 2,
                borderColor: appState.theme === 'dark' ? '#1e293b' : '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: { color: colors.text },
                    position: 'bottom'
                }
            }
        }
    });
}

// ===== PDF Export =====
async function generatePDF() {
    const exportBtn = document.getElementById('exportPdfBtn');
    exportBtn.textContent = '⏳ Generating...';
    exportBtn.disabled = true;

    try {
        // First ensure we're on dashboard so stats are available
        const isDashboardActive = document.getElementById('dashboardView').classList.contains('active');
        if (!isDashboardActive) {
            alert('Please switch to Dashboard tab before exporting PDF');
            exportBtn.textContent = '📄 Export PDF';
            exportBtn.disabled = false;
            return;
        }

        // Wait a moment to ensure charts are fully rendered
        await new Promise(resolve => setTimeout(resolve, 500));

        // Create main PDF container
        const pdfContainer = document.createElement('div');
        pdfContainer.style.padding = '15px';
        pdfContainer.style.backgroundColor = '#ffffff';
        pdfContainer.style.color = '#000000';
        pdfContainer.style.fontFamily = 'Arial, sans-serif';
        pdfContainer.style.maxWidth = '1200px';

        // Title
        const monthName = getMonthName(appState.currentMonth);
        const titleHtml = `
            <div style="text-align: center; margin-bottom: 20px;">
                <h1 style="color: #6366f1; font-size: 22px; margin: 0 0 10px 0;">Monthly Habit Tracker</h1>
                <h2 style="color: #333; font-size: 16px; margin: 0;">${monthName}</h2>
            </div>
        `;
        pdfContainer.innerHTML = titleHtml;

        // Get and clone tracker table (need to temporarily show it)
        const trackerView = document.getElementById('trackerView');
        const trackerTable = document.getElementById('trackerTable');

        if (!trackerTable) {
            throw new Error('Tracker table not found');
        }

        // Temporarily show tracker to clone it
        const wasHidden = !trackerView.classList.contains('active');
        if (wasHidden) {
            trackerView.style.display = 'block';
            trackerView.style.visibility = 'visible';
        }

        // Clone the table
        const tableClone = trackerTable.cloneNode(true);

        // Hide tracker again
        if (wasHidden) {
            trackerView.style.display = 'none';
            trackerView.style.visibility = 'hidden';
        }

        // Style the cloned table
        tableClone.style.width = '100%';
        tableClone.style.fontSize = '6px';
        tableClone.style.borderCollapse = 'collapse';
        tableClone.style.marginBottom = '15px';

        // Style all cells
        const allCells = tableClone.querySelectorAll('th, td');
        allCells.forEach(cell => {
            cell.style.border = '1px solid #ccc';
            cell.style.padding = '2px';
            cell.style.color = '#000';
            cell.style.fontSize = '6px';
            cell.style.textAlign = 'center';
        });

        // Style headers
        const headers = tableClone.querySelectorAll('th');
        headers.forEach(th => {
            th.style.backgroundColor = '#6366f1';
            th.style.color = '#fff';
            th.style.fontWeight = 'bold';
            th.style.padding = '3px';
        });

        // Style habit cells
        const habitCells = tableClone.querySelectorAll('.habit-cell');
        habitCells.forEach(cell => {
            cell.style.textAlign = 'left';
            cell.style.fontSize = '7px';
            cell.style.padding = '3px';
        });

        // Remove action buttons
        tableClone.querySelectorAll('.habit-actions').forEach(el => el.remove());

        // Simplify habit names
        tableClone.querySelectorAll('.habit-info').forEach(div => {
            const name = div.querySelector('.habit-name');
            if (name) {
                div.innerHTML = name.textContent;
            }
        });

        // Add table section
        const tableSection = document.createElement('div');
        tableSection.innerHTML = '<h3 style="color: #6366f1; font-size: 12px; margin: 10px 0;">Monthly Tracker</h3>';
        tableSection.appendChild(tableClone);
        pdfContainer.appendChild(tableSection);

        // Add page break
        const pageBreak1 = document.createElement('div');
        pageBreak1.style.pageBreakAfter = 'always';
        pageBreak1.style.height = '20px';
        pdfContainer.appendChild(pageBreak1);

        // Statistics
        const statsSection = document.createElement('div');
        statsSection.style.marginTop = '15px';
        statsSection.style.padding = '10px';
        statsSection.style.backgroundColor = '#f5f5f5';
        statsSection.style.borderRadius = '5px';
        statsSection.innerHTML = `
            <h3 style="color: #6366f1; font-size: 14px; margin: 0 0 10px 0;">Monthly Statistics</h3>
            <table style="width: 100%; font-size: 11px;">
                <tr>
                    <td><strong>Total Habits:</strong> ${document.getElementById('statTotalHabits').textContent}</td>
                    <td><strong>Total Checkmarks:</strong> ${document.getElementById('statTotalChecks').textContent}</td>
                </tr>
                <tr>
                    <td><strong>Completion Rate:</strong> ${document.getElementById('statCompletionRate').textContent}</td>
                    <td></td>
                </tr>
                <tr>
                    <td colspan="2"><strong>Most Completed:</strong> ${document.getElementById('statMostCompleted').textContent}</td>
                </tr>
                <tr>
                    <td colspan="2"><strong>Least Completed:</strong> ${document.getElementById('statLeastCompleted').textContent}</td>
                </tr>
            </table>
        `;
        pdfContainer.appendChild(statsSection);

        // Charts section
        const chartsHeader = document.createElement('h3');
        chartsHeader.textContent = 'Visual Analytics';
        chartsHeader.style.color = '#6366f1';
        chartsHeader.style.fontSize = '14px';
        chartsHeader.style.marginTop = '20px';
        chartsHeader.style.marginBottom = '15px';
        pdfContainer.appendChild(chartsHeader);

        // Line Chart
        const lineCanvas = document.getElementById('lineChart');
        if (lineCanvas && charts.line) {
            const lineTitle = document.createElement('h4');
            lineTitle.textContent = 'Daily Completion Trend';
            lineTitle.style.fontSize = '12px';
            lineTitle.style.textAlign = 'center';
            lineTitle.style.margin = '10px 0 5px 0';
            lineTitle.style.color = '#333';
            pdfContainer.appendChild(lineTitle);

            const lineImg = document.createElement('img');
            lineImg.src = lineCanvas.toDataURL('image/png', 1.0);
            lineImg.style.width = '100%';
            lineImg.style.maxWidth = '650px';
            lineImg.style.display = 'block';
            lineImg.style.margin = '0 auto 15px auto';
            pdfContainer.appendChild(lineImg);
        }

        // Bar Chart
        const barCanvas = document.getElementById('barChart');
        if (barCanvas && charts.bar) {
            const barTitle = document.createElement('h4');
            barTitle.textContent = 'Habit Completion Rates';
            barTitle.style.fontSize = '12px';
            barTitle.style.textAlign = 'center';
            barTitle.style.margin = '10px 0 5px 0';
            barTitle.style.color = '#333';
            pdfContainer.appendChild(barTitle);

            const barImg = document.createElement('img');
            barImg.src = barCanvas.toDataURL('image/png', 1.0);
            barImg.style.width = '100%';
            barImg.style.maxWidth = '650px';
            barImg.style.display = 'block';
            barImg.style.margin = '0 auto 15px auto';
            pdfContainer.appendChild(barImg);
        }

        // Donut Chart
        const donutCanvas = document.getElementById('donutChart');
        if (donutCanvas && charts.donut) {
            const donutTitle = document.createElement('h4');
            donutTitle.textContent = 'Overall Progress';
            donutTitle.style.fontSize = '12px';
            donutTitle.style.textAlign = 'center';
            donutTitle.style.margin = '10px 0 5px 0';
            donutTitle.style.color = '#333';
            pdfContainer.appendChild(donutTitle);

            const donutImg = document.createElement('img');
            donutImg.src = donutCanvas.toDataURL('image/png', 1.0);
            donutImg.style.width = '100%';
            donutImg.style.maxWidth = '400px';
            donutImg.style.display = 'block';
            donutImg.style.margin = '0 auto 15px auto';
            pdfContainer.appendChild(donutImg);
        }

        // Generate PDF
        const pdfOptions = {
            margin: 8,
            filename: `habit-tracker-${appState.currentMonth}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'landscape'
            }
        };

        await html2pdf().from(pdfContainer).set(pdfOptions).save();

    } catch (error) {
        console.error('PDF Export Error:', error);
        alert('Error creating PDF: ' + error.message + '\n\nPlease ensure you are on the Dashboard tab and have some habits added.');
    } finally {
        exportBtn.textContent = '📄 Export PDF';
        exportBtn.disabled = false;
    }
}

function getMonthName(monthStr) {
    const [year, month] = monthStr.split('-');
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ===== Local Storage =====
function saveToLocalStorage() {
    try {
        localStorage.setItem('habitTrackerState', JSON.stringify(appState));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('habitTrackerState');
        if (saved) {
            const loaded = JSON.parse(saved);
            appState = { ...appState, ...loaded };
        }
    } catch (error) {
        console.error('Error loading from localStorage:', error);
    }
}

// ===== Utility Functions =====
function updateAllUI() {
    updateHabitCount();
    updateDailyProgress();
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
