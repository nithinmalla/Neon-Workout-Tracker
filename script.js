/**
 * Noveo Workout Tracker
 * Core Javascript Logic
 */

// --- UTILS ---
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}



// --- PROFILE MANAGER ---
class ProfileManager {
    constructor() {
        this.profiles = JSON.parse(localStorage.getItem('neon_profiles')) || [];
        this.currentProfileId = localStorage.getItem('neon_current_profile');
    }

    getProfiles() {
        return this.profiles;
    }

    getCurrentProfile() {
        return this.profiles.find(p => p.id === this.currentProfileId);
    }

    createProfile(name) {
        const newProfile = {
            id: generateId(),
            name: name,
            createdAt: new Date().toISOString()
        };
        this.profiles.push(newProfile);
        this.saveProfiles();
        return newProfile;
    }

    setCurrentProfile(id) {
        if (this.profiles.find(p => p.id === id)) {
            this.currentProfileId = id;
            localStorage.setItem('neon_current_profile', id);
            return true;
        }
        return false;
    }

    saveProfiles() {
        localStorage.setItem('neon_profiles', JSON.stringify(this.profiles));
    }

    deleteProfile(id) {
        // Remove from list
        this.profiles = this.profiles.filter(p => p.id !== id);
        this.saveProfiles();

        // Clean Data
        localStorage.removeItem(`neon_plans_${id}`);
        localStorage.removeItem(`neon_history_${id}`);

        // If current, reset
        if (this.currentProfileId === id) {
            this.currentProfileId = null;
            localStorage.removeItem('neon_current_profile');
        }
    }

    // Migration for legacy users
    migrateLegacyData() {
        const legacyPlans = localStorage.getItem('neon_plans');

        // Only migrate if we have legacy data AND no profiles yet
        if (legacyPlans && this.profiles.length === 0) {
            console.log('Migrating legacy data...');
            const defaultProfile = this.createProfile('Default User');
            this.currentProfileId = defaultProfile.id;
            localStorage.setItem('neon_current_profile', defaultProfile.id);

            // Move Data
            localStorage.setItem(`neon_plans_${defaultProfile.id}`, legacyPlans);

            const legacyHistory = localStorage.getItem('neon_history');
            if (legacyHistory) {
                localStorage.setItem(`neon_history_${defaultProfile.id}`, legacyHistory);
            }

            // Cleanup Legacy
            localStorage.removeItem('neon_plans');
            localStorage.removeItem('neon_history');

            return true;
        }
        return false;
    }
}

// --- DATA STORE ---
class Store {
    constructor(profileId) {
        this.profileId = profileId;
        this.plansKey = `neon_plans_${profileId}`;
        this.historyKey = `neon_history_${profileId}`;
        this.init();
    }

    init() {
        this.plans = JSON.parse(localStorage.getItem(this.plansKey)) || [];
        this.history = JSON.parse(localStorage.getItem(this.historyKey)) || [];
    }

    savePlans() {
        localStorage.setItem(this.plansKey, JSON.stringify(this.plans));
    }

    saveHistory() {
        localStorage.setItem(this.historyKey, JSON.stringify(this.history));
    }

    // --- ACTIVE WORKOUT PERSISTENCE ---
    saveActiveWorkout(data) {
        localStorage.setItem(`neon_active_workout_${this.profileId}`, JSON.stringify(data));
    }

    getActiveWorkout() {
        return JSON.parse(localStorage.getItem(`neon_active_workout_${this.profileId}`));
    }

    clearActiveWorkout() {
        localStorage.removeItem(`neon_active_workout_${this.profileId}`);
    }

    addPlan(plan) {
        this.plans.push(plan);
        this.savePlans();
    }

    updatePlan(updatedPlan) {
        const index = this.plans.findIndex(p => p.id === updatedPlan.id);
        if (index !== -1) {
            this.plans[index] = updatedPlan;
            this.savePlans();
        }
    }

    deletePlan(planId) {
        this.plans = this.plans.filter(p => p.id !== planId);
        this.savePlans();
    }

    addWorkoutLog(log) {
        this.history.unshift(log); // Add to beginning
        this.saveHistory();
    }

    deleteWorkoutLog(id) {
        this.history = this.history.filter(h => h.id !== id);
        this.saveHistory();
    }

    getPlan(id) {
        return this.plans.find(p => p.id === id);
    }

    clearData() {
        this.plans = [];
        this.history = [];
        this.savePlans();
        this.saveHistory();
    }
}

// --- ROUTER ---
class Router {
    constructor() {
        this.routes = {
            'home': document.getElementById('view-home'),
            'plan-editor': document.getElementById('view-plan-editor'),
            'workout': document.getElementById('view-workout'),
            'history': document.getElementById('view-history'),
            'settings': document.getElementById('view-settings'),
            'profile-select': document.getElementById('view-profile-select')
        };
        this.currentRoute = null;
        this.navItems = document.querySelectorAll('.nav-item');
    }

    navigate(routeId) {
        // Validation
        if (!this.routes[routeId]) {
            console.error(`Route ${routeId} not found`);
            return;
        }

        // Hide all views
        Object.values(this.routes).forEach(el => {
            el.classList.remove('active');
        });

        // Show target view
        this.routes[routeId].classList.add('active');
        this.currentRoute = routeId;

        // Update Bottom Nav
        this.navItems.forEach(item => {
            if (item.dataset.target === routeId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Trigger view-specific logic
        document.dispatchEvent(new CustomEvent('routeChanged', { detail: { route: routeId } }));
    }
}

// --- APP CONTROLLER ---
class App {
    constructor() {
        this.profileManager = new ProfileManager();
        this.router = new Router();

        // Check Migration
        this.profileManager.migrateLegacyData();

        this.init();
    }

    init() {
        this.setupCalendar();

        // Determine start state
        if (!this.profileManager.currentProfileId) {
            // No profile selected or none exist
            this.setupProfileView();
            this.router.navigate('profile-select');
        } else {
            this.loadProfile(this.profileManager.currentProfileId);
        }

        this.setupGlobalListeners();
        this.updateDate();
    }

    setupCalendar() {
        this.calendarDate = new Date();

        // Listeners for prev/next
        const prevBtn = document.getElementById('prev-month');
        const nextBtn = document.getElementById('next-month');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.calendarDate.setMonth(this.calendarDate.getMonth() - 1);
                this.renderCalendar();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.calendarDate.setMonth(this.calendarDate.getMonth() + 1);
                this.renderCalendar();
            });
        }
    }

    renderCalendar() {
        const date = this.calendarDate;
        const year = date.getFullYear();
        const month = date.getMonth();

        // Valid workout dates
        const history = this.store ? (this.store.history || []) : [];
        const workoutDates = new Set();
        history.forEach(session => {
            if (!session.date) return;
            const d = new Date(session.date);
            const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            workoutDates.add(dateString);
        });

        // Update Header
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthYearEl = document.getElementById('calendar-month-year');
        if (monthYearEl) monthYearEl.textContent = `${monthNames[month]} ${year}`;

        // Render Grid
        const daysContainer = document.getElementById('calendar-days');
        if (!daysContainer) return;

        daysContainer.innerHTML = '';

        const firstDay = new Date(year, month, 1).getDay(); // 0 is Sun, 6 is Sat
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Map to M=0 ... S=6. native is Sun=0... Sat=6
        const startDayIndex = firstDay === 0 ? 6 : firstDay - 1;

        // Total cells (6 rows * 7 cols = 42)
        const totalCells = 42;

        // Empty slots at start
        for (let i = 0; i < startDayIndex; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day empty';
            daysContainer.appendChild(emptyCell);
        }

        const today = new Date();

        for (let i = 1; i <= daysInMonth; i++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';
            dayCell.textContent = i;

            if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                dayCell.classList.add('today');
            }

            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            if (workoutDates.has(dateString)) {
                dayCell.classList.add('active');
            }

            daysContainer.appendChild(dayCell);
        }

        // Fill remaining cells to complete the grid
        const filledCells = startDayIndex + daysInMonth;
        const remainingCells = totalCells - filledCells;

        for (let i = 0; i < remainingCells; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day empty';
            daysContainer.appendChild(emptyCell);
        }

        this.updateStreak(workoutDates);
    }

    updateStreak(workoutDates) {
        const streakEl = document.getElementById('streak-count');
        if (!streakEl) return;

        if (workoutDates.size === 0) {
            streakEl.textContent = "0 Day Streak";
            return;
        }

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        let streak = 0;
        let checkDate = new Date();

        // If today is not in logs, check from yesterday
        if (!workoutDates.has(todayStr)) {
            checkDate.setDate(checkDate.getDate() - 1);
        }

        while (true) {
            const dStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
            if (workoutDates.has(dStr)) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }

        streakEl.textContent = `${streak} Day Streak`;
    }

    updateDate() {
        const dateEl = document.querySelector('.date-display');
        if (dateEl) {
            const options = { weekday: 'long', month: 'short', day: 'numeric' };
            dateEl.textContent = new Date().toLocaleDateString('en-US', options);
        }
    }

    loadProfile(profileId) {
        this.profileManager.setCurrentProfile(profileId);
        this.store = new Store(profileId);

        // No blocking prompt. Just go home.
        // The renderPlansList will handle showing the active workout.
        this.router.navigate('home');

        console.log(`Loaded Profile: ${profileId}`);
    }

    setupGlobalListeners() {
        // Navigation clicks
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = btn.dataset.target;
                this.router.navigate(target);
            });
        });

        // Route Changes
        document.addEventListener('routeChanged', (e) => {
            console.log(`Navigated to ${e.detail.route}`);
            const route = e.detail.route;

            if (route === 'home') {
                this.renderPlansList();
                this.renderCalendar();
            }
            if (route === 'history') this.renderHistoryList();
            if (route === 'settings') this.renderSettings();
            if (route === 'profile-select') this.renderProfileList();
        });

        // --- PROFILE & SETTINGS LISTENERS ---
        document.getElementById('btn-add-profile')?.addEventListener('click', () => {
            document.getElementById('modal-add-profile').classList.add('active');
            document.getElementById('new-profile-name').focus();
        });

        document.getElementById('btn-cancel-add-profile')?.addEventListener('click', () => {
            document.getElementById('modal-add-profile').classList.remove('active');
            document.getElementById('new-profile-name').value = '';
        });

        document.getElementById('btn-confirm-add-profile')?.addEventListener('click', () => {
            const name = document.getElementById('new-profile-name').value.trim();
            if (name) {
                const newProfile = this.profileManager.createProfile(name);
                document.getElementById('modal-add-profile').classList.remove('active');
                document.getElementById('new-profile-name').value = '';

                // If we are in profile select, reload list. If we were forced there, maybe auto-login?
                // Let's just reload list and let user click
                this.renderProfileList();
            }
        });

        document.getElementById('btn-switch-profile')?.addEventListener('click', () => {
            this.router.navigate('profile-select');
        });

        document.getElementById('btn-clear-data')?.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete all workouts and plans for this profile? This cannot be undone.')) {
                this.store.clearData();
                alert('Data cleared.');
                this.renderPlansList(); // Refresh
            }
        });

        document.getElementById('btn-delete-profile')?.addEventListener('click', () => {
            const currentProfile = this.profileManager.getCurrentProfile();
            if (!currentProfile) return;

            if (confirm(`Are you sure you want to PERMANENTLY DELETE profile "${currentProfile.name}"? This will wipe all data for this user.`)) {
                const check = prompt("Type DELETE to confirm:");
                if (check === 'DELETE') {
                    this.profileManager.deleteProfile(currentProfile.id);
                    // Force reload/reset
                    location.reload();
                }
            }
        });

        // --- PLAN EDITOR LISTENERS ---

        document.getElementById('btn-create-plan')?.addEventListener('click', () => this.openPlanEditor());
        document.getElementById('btn-cancel-plan')?.addEventListener('click', () => this.router.navigate('home'));
        document.getElementById('btn-add-exercise')?.addEventListener('click', () => this.addExerciseToEditor());
        document.getElementById('btn-save-plan')?.addEventListener('click', () => this.saveCurrentPlan());

        // --- WORKOUT LISTENERS ---
        document.getElementById('btn-finish-workout')?.addEventListener('click', () => this.finishWorkout());
        document.getElementById('btn-discard-workout')?.addEventListener('click', () => this.discardWorkout());
        document.getElementById('btn-save-exit')?.addEventListener('click', () => {
            this.router.navigate('home');
        });
    }

    setupProfileView() {
        // Any specific setup for profile view if needed
    }

    renderProfileList() {
        const container = document.getElementById('profiles-list');
        container.innerHTML = '';
        const profiles = this.profileManager.getProfiles();

        if (profiles.length === 0) {
            container.innerHTML = '<p class="text-center" style="color:var(--text-secondary);">No profiles found. Create one to start.</p>';
            return;
        }

        profiles.forEach(p => {
            const el = document.createElement('div');
            el.className = 'card';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.gap = '16px';
            el.style.cursor = 'pointer';
            el.onclick = () => this.loadProfile(p.id);

            el.innerHTML = `
                <div style="width:50px; height:50px; border-radius:50%; background:var(--surface-color-light); display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:20px; color:var(--primary-color); border:1px solid var(--primary-color);">
                    ${p.name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h3 style="margin-bottom:4px;">${p.name}</h3>
                    <div style="font-size:12px; color:var(--text-secondary);">Last active: ${new Date().toLocaleDateString()}</div> 
                </div> 
             `;
            // Note: "Last active" is fake for now, could add real tracking later
            container.appendChild(el);
        });
    }

    renderSettings() {
        const profile = this.profileManager.getCurrentProfile();
        if (profile) {
            document.getElementById('settings-profile-name').textContent = profile.name;
            document.getElementById('settings-avatar-initials').textContent = profile.name.charAt(0).toUpperCase();
        }
    }

    updateDate() {
        const dateEl = document.querySelector('.date-display');
        if (dateEl) {
            const options = { weekday: 'long', month: 'short', day: 'numeric' };
            dateEl.textContent = new Date().toLocaleDateString('en-US', options);
        }
    }

    // --- PLAN MANAGEMENT ---

    renderPlansList() {
        const plansContainer = document.getElementById('plans-list');
        const activeContainer = document.getElementById('active-workout-container');

        if (!plansContainer || !activeContainer) return;
        if (!this.store) return; // Guard

        plansContainer.innerHTML = '';
        activeContainer.innerHTML = '';

        // Check for active workout
        const active = this.store.getActiveWorkout();
        if (active) {
            activeContainer.style.display = 'block';
            const activeCard = document.createElement('div');
            activeCard.className = 'card';
            activeCard.style.border = '1px solid var(--primary-color)';
            activeCard.style.background = 'rgba(0, 240, 255, 0.05)';
            activeCard.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <div>
                        <span style="font-size:10px; text-transform:uppercase; letter-spacing:1px; color:var(--primary-color); font-weight:bold;">Active Session</span>
                        <h3 style="margin-top:4px;">${active.planName}</h3>
                    </div>
                    <div style="width:10px; height:10px; background:var(--primary-color); border-radius:50%; box-shadow:0 0 10px var(--primary-color);"></div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-primary full-width" onclick="app.resumeWorkout(app.store.getActiveWorkout())">Resume</button>
                    <button class="btn btn-secondary full-width" onclick="app.finishActiveWorkoutFromHome()">Finish</button>
                </div>
            `;
            activeContainer.appendChild(activeCard);
        } else {
            activeContainer.style.display = 'none';
        }

        const plans = this.store.plans;

        if (plans.length === 0) {
            plansContainer.innerHTML = `
                <div class="empty-state">
                    <p>No workout plans yet.</p>
                    <button class="btn btn-primary" onclick="app.router.navigate('plan-editor')">Create First Plan</button>
                </div>
            `;
            return;
        }

        plans.forEach(plan => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div class="plan-card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <h3>${plan.name}</h3>
                    <div class="plan-actions">
                         <button class="btn btn-icon" onclick="app.openPlanEditor('${plan.id}')"><i class="ph ph-pencil-simple"></i></button>
                         <button class="btn btn-icon" onclick="app.deletePlan('${plan.id}')"><i class="ph ph-trash"></i></button>
                         <button class="btn btn-primary" style="padding: 8px 16px; font-size: 12px;" onclick="app.startWorkout('${plan.id}')">Start</button>
                    </div>
                </div>
                <p style="color:var(--text-secondary); font-size:14px;">${plan.exercises.length} Exercises</p>
                <div class="plan-preview" style="margin-top:8px; font-size:12px; color:var(--text-secondary);">
                    ${plan.exercises.map(e => e.name).slice(0, 3).join(', ')}${plan.exercises.length > 3 ? '...' : ''}
                </div>
            `;
            plansContainer.appendChild(card);
        });
    }

    openPlanEditor(planId = null) {
        const titleEl = document.querySelector('#view-plan-editor h3'); // We might need to make this ID specific if generic

        document.getElementById('editor-exercises-list').innerHTML = '';

        if (planId) {
            const plan = this.store.getPlan(planId);
            if (plan) {
                document.getElementById('plan-name').value = plan.name;
                document.getElementById('plan-name').dataset.editingId = plan.id; // Store ID

                plan.exercises.forEach(ex => {
                    this.addExerciseToEditor({ name: ex.name, sets: ex.defaultSets });
                });
            }
        } else {
            document.getElementById('plan-name').value = '';
            delete document.getElementById('plan-name').dataset.editingId;
            this.addExerciseToEditor();
        }

        this.router.navigate('plan-editor');
    }

    addExerciseToEditor(data = { name: '', sets: 3 }) {
        const container = document.getElementById('editor-exercises-list');
        const id = generateId();

        const el = document.createElement('div');
        el.className = 'card exercise-editor-item';
        el.dataset.id = id;
        el.innerHTML = `
            <div class="input-group">
                <label>Exercise Name</label>
                <input type="text" class="ex-name" placeholder="e.g. Bench Press" value="${data.name}">
            </div>
            <div class="input-group">
                <label>Default Sets</label>
                <input type="number" class="ex-sets" value="${data.sets}" min="1">
            </div>
            <div style="text-align:right;">
                <button class="btn btn-danger" style="font-size:12px; padding: 6px 12px;" onclick="this.closest('.card').remove()">Remove</button>
            </div>
        `;
        container.appendChild(el);
    }

    saveCurrentPlan() {
        const name = document.getElementById('plan-name').value.trim();
        if (!name) {
            alert('Please name your plan.');
            return;
        }

        const exercises = [];
        document.querySelectorAll('.exercise-editor-item').forEach(el => {
            const exName = el.querySelector('.ex-name').value.trim();
            const exSets = parseInt(el.querySelector('.ex-sets').value) || 3;

            if (exName) {
                exercises.push({
                    id: generateId(),
                    name: exName,
                    defaultSets: exSets
                });
            }
        });

        if (exercises.length === 0) {
            alert('Add at least one exercise.');
            return;
        }

        const editingId = document.getElementById('plan-name').dataset.editingId;

        const newPlan = {
            id: editingId || generateId(),
            name: name,
            exercises: exercises,
            createdAt: new Date().toISOString()
        };

        if (editingId) {
            this.store.updatePlan(newPlan);
        } else {
            this.store.addPlan(newPlan);
        }

        this.router.navigate('home');
    }

    deletePlan(id) {
        if (confirm('Delete this plan?')) {
            this.store.deletePlan(id);
            this.renderPlansList();
        }
    }

    // --- WORKOUT SESSION --

    startWorkout(planId) {
        const plan = this.store.getPlan(planId);
        if (!plan) return;

        // Start fresh
        this.currentWorkout = {
            planId: plan.id,
            startTime: new Date(),
            planName: plan.name,
            exercises: plan.exercises
        };

        // Initial Save
        this.store.saveActiveWorkout(this.currentWorkout);

        this.renderWorkoutView();
    }

    resumeWorkout(savedData) {
        this.currentWorkout = {
            ...savedData,
            startTime: new Date(savedData.startTime) // Restore object
        };
        this.renderWorkoutView();
    }

    redoWorkout(logId) {
        const log = this.store.history.find(l => l.id === logId);
        if (!log) return;

        // Convert history log back to "active workout" structure
        // We need to map the historically performed sets to the "default" values for this session
        // so they appear pre-filled

        const exercises = log.exercises.map(ex => ({
            id: generateId(),
            name: ex.name,
            defaultSets: ex.sets.length,
            // We'll store the exact sets to pre-fill active values
            prefillSets: ex.sets
        }));

        this.currentWorkout = {
            planId: log.planId || 'redo', // Might not exist anymore, fine
            startTime: new Date(),
            planName: log.planName,
            exercises: exercises
        };

        this.store.saveActiveWorkout(this.currentWorkout);
        this.renderWorkoutView();
    }

    finishActiveWorkoutFromHome() {
        const active = this.store.getActiveWorkout();
        if (active) {
            this.currentWorkout = active;
            // Ensure sets are properly formatted if needed, though they should be fine from storage
            // Just assume they are valid or filter empty ones like in finishWorkout
            this.finishWorkout();
        }
    }

    deleteLog(id) {
        if (confirm("Are you sure you want to delete this workout history?")) {
            this.store.deleteWorkoutLog(id);
            this.renderHistoryList();
        }
    }

    renderWorkoutView() {
        const container = document.getElementById('workout-exercises-list');
        document.getElementById('workout-title').textContent = this.currentWorkout.planName;
        document.getElementById('workout-timer').textContent = "00:00";

        container.innerHTML = '';

        this.currentWorkout.exercises.forEach(ex => {
            const card = document.createElement('div');
            card.className = 'card workout-exercise-card';
            card.dataset.id = ex.id;
            card.dataset.name = ex.name;

            let setsHtml = '';
            // Determine sets to render: either from prefill (Redo), saved state (Resume), or default (New)
            const setsToRender = ex.sets || ex.prefillSets || Array(ex.defaultSets || 3).fill({
                weight: '',
                reps: '',
                completed: false
            });

            setsToRender.forEach((set, i) => {
                // Clean up data for display (handle 0s or empty strings)
                const w = (set.weight !== undefined && set.weight !== '') ? set.weight : '';
                const r = (set.reps !== undefined && set.reps !== '') ? set.reps : '';
                const c = (set.completed === true);
                setsHtml += this.generateSetRowHtml(i + 1, w, r, c);
            });

            card.innerHTML = `
                <div class="workout-card-header" style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
                    <h3>${ex.name}</h3>
                </div>
                <div class="sets-container">
                    <div style="display:grid; grid-template-columns: 30px 1fr 1fr 30px 40px; gap:8px; margin-bottom:8px; color:var(--text-secondary); font-size:12px; text-transform:uppercase; text-align:center;">
                        <span>Set</span>
                        <span>kg</span>
                        <span>Reps</span>
                        <span><i class="ph ph-check"></i></span>
                        <span></span>
                    </div>
                    <div class="sets-list">
                        ${setsHtml}
                    </div>
                    <button class="btn btn-outline full-width" style="margin-top:8px; padding:8px; font-size:12px;" onclick="app.addSetToExercise(this)">
                        <i class="ph ph-plus"></i> Add Set
                    </button>
                </div>
            `;
            container.appendChild(card);
        });

        // Attach auto-save listeners
        container.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => this.saveWorkoutState());
        });

        this.router.navigate('workout');
    }

    saveWorkoutState() {
        if (!this.currentWorkout) return;

        // Scrape DOM for current state
        const exercises = [];
        const cards = document.querySelectorAll('.workout-exercise-card');

        cards.forEach(card => {
            const exerciseName = card.dataset.name;
            const id = card.dataset.id;
            const sets = [];

            card.querySelectorAll('.set-row').forEach(row => {
                const weight = row.querySelector('.set-weight').value;
                const reps = row.querySelector('.set-reps').value;
                const completed = row.classList.contains('completed');
                // Save raw values to restore exactly
                sets.push({
                    weight,
                    reps,
                    completed
                });
            });

            exercises.push({
                id: id,
                name: exerciseName,
                sets: sets
            });
        });

        // Update memory
        this.currentWorkout.exercises = exercises;

        // Save to disk
        this.store.saveActiveWorkout(this.currentWorkout);
    }

    generateSetRowHtml(setNumber, weight = '', reps = '', completed = false) {
        const completedClass = completed ? 'completed' : '';
        const btnClass = completed ? 'btn-success' : 'btn-secondary';
        const icon = completed ? 'ph-check-bold' : 'ph-check';

        return `
            <div class="set-row ${completedClass}" style="display:grid; grid-template-columns: 30px 1fr 1fr 30px 40px; gap:8px; margin-bottom:8px; align-items:center;">
                <span class="set-num" style="color:var(--text-secondary); font-weight:600; text-align:center;">${setNumber}</span>
                <input type="number" class="set-weight" placeholder="kg" value="${weight}">
                <input type="number" class="set-reps" placeholder="Reps" value="${reps}">
                <button class="btn ${btnClass} btn-icon btn-sm" style="width:30px; height:30px; padding:0; display:flex; align-items:center; justify-content:center;" onclick="app.toggleSetComplete(this)">
                    <i class="ph ${icon}" style="font-size:16px;"></i>
                </button>
                <button class="btn btn-icon" style="color:var(--danger-color); font-size:20px;" onclick="app.removeSet(this)"><i class="ph ph-x"></i></button>
            </div>
        `;
    }

    toggleSetComplete(btn) {
        const row = btn.closest('.set-row');
        const wasCompleted = row.classList.contains('completed');

        if (wasCompleted) {
            row.classList.remove('completed');
            btn.classList.remove('btn-success');
            btn.classList.add('btn-secondary');
            btn.querySelector('i').classList.replace('ph-check-bold', 'ph-check');
        } else {
            row.classList.add('completed');
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-success');
            btn.querySelector('i').classList.replace('ph-check', 'ph-check-bold');
        }

        // Explicit Save
        this.saveWorkoutState();
    }

    removeSet(btn) {
        btn.closest('.set-row').remove();
        this.saveWorkoutState(); // Trigger save on structural change
    }

    addSetToExercise(btn) {
        const setsList = btn.previousElementSibling;
        const currentSets = setsList.querySelectorAll('.set-row').length;
        const html = this.generateSetRowHtml(currentSets + 1);
        setsList.insertAdjacentHTML('beforeend', html);

        // Attach listener to new inputs
        const newRow = setsList.lastElementChild;
        newRow.querySelectorAll('input').forEach(i => i.addEventListener('input', () => this.saveWorkoutState()));

        this.saveWorkoutState();
    }

    finishWorkout() {
        if (!this.currentWorkout) return;

        const log = {
            id: generateId(),
            planId: this.currentWorkout.planId,
            planName: this.currentWorkout.planName,
            date: new Date().toISOString(),
            duration: Math.round((new Date() - this.currentWorkout.startTime) / 60000), // minutes
            exercises: []
        };

        const cards = document.querySelectorAll('.workout-exercise-card');
        cards.forEach(card => {
            const exerciseName = card.dataset.name;
            const sets = [];

            card.querySelectorAll('.set-row').forEach(row => {
                const weight = parseFloat(row.querySelector('.set-weight').value);
                const reps = parseFloat(row.querySelector('.set-reps').value);

                if (!isNaN(weight) || !isNaN(reps)) {
                    sets.push({ weight: weight || 0, reps: reps || 0 });
                }
            });

            if (sets.length > 0) {
                log.exercises.push({
                    name: exerciseName,
                    sets: sets
                });
            }
        });

        if (log.exercises.length > 0) {
            this.store.addWorkoutLog(log);
            this.store.clearActiveWorkout(); // DONE
            this.currentWorkout = null;

            // Render Calendar to show new dot!
            this.renderCalendar();

            this.router.navigate('home'); // Go to home to see the streak/calendar update!
        } else {
            this.store.clearActiveWorkout();
            this.currentWorkout = null;
            this.router.navigate('home');
        }
    }

    discardWorkout() {
        if (confirm('Discard current workout? Data will be lost.')) {
            this.store.clearActiveWorkout(); // CLEARED
            this.currentWorkout = null;
            this.renderCalendar(); // Just in case
            this.router.navigate('home');
        }
    }

    // --- HISTORY ---

    renderHistoryList() {
        const container = document.getElementById('history-list');
        if (!container) return;
        if (!this.store) return;

        container.innerHTML = '';
        const history = this.store.history;

        if (history.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No completed workouts yet.</p>
                </div>
            `;
            return;
        }

        history.forEach(log => {
            const dateStr = new Date(log.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

            let exercisesHtml = '';
            log.exercises.forEach(ex => {
                const recommendation = this.getRecommendation(ex.name, ex.sets);
                exercisesHtml += `
                    <div class="history-exercise-item" style="margin-top:8px; border-top:1px solid rgba(255,255,255,0.05); padding-top:8px;">
                        <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:4px;">
                            <span style="color:var(--primary-color);">${ex.name}</span>
                            <span>${ex.sets.length} sets</span>
                        </div>
                        <div style="font-size:12px; color:var(--text-secondary);">
                            ${ex.sets.map(s => `${s.weight}kg x ${s.reps}`).join(' | ')}
                        </div>
                        ${recommendation ? `<div style="font-size:11px; color:var(--secondary-color); margin-top:4px;">💡 ${recommendation}</div>` : ''}
                    </div>
                `;
            });

            const card = document.createElement('div');
            card.className = 'card';
            card.onclick = (e) => {
                // Prevent triggering if clicked on inner elements like specific buttons if we had them
                // For now, whole card clickable for "Redo" or just add a button
            };

            card.innerHTML = `
                <div class="history-card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div>
                        <h3>${log.planName}</h3>
                        <span style="font-size:12px; color:var(--text-secondary);">${dateStr}</span>
                    </div>
                    <button class="btn btn-icon" style="color:var(--text-secondary); font-size: 20px;" onclick="event.stopPropagation(); app.deleteLog('${log.id}')"><i class="ph ph-trash"></i></button>
                </div>
                <div class="history-content">
                    ${exercisesHtml}
                </div>
                <div style="margin-top:12px; border-top:1px solid rgba(255,255,255,0.05); padding-top:8px;">
                     <button class="btn btn-outline full-width" style="font-size:12px; padding:8px;" onclick="app.redoWorkout('${log.id}')">
                        <i class="ph ph-arrow-counter-clockwise"></i> Redo this Workout
                     </button>
                </div>
            `;
            container.appendChild(card);
        });
    }

    getRecommendation(exerciseName, currentSets) {
        if (!currentSets || currentSets.length === 0) return null;

        let maxWeight = 0;
        currentSets.forEach(s => {
            if (s.weight > maxWeight) maxWeight = s.weight;
        });

        const maxWeightSet = currentSets.find(s => s.weight === maxWeight);
        if (maxWeightSet && maxWeightSet.reps >= 12) {
            return `Strong! Try ${maxWeight + 2.5}kg next time.`;
        }
        if (maxWeightSet && maxWeightSet.reps < 6) {
            return `Focus on form and build to 8 reps.`;
        }
        return null;
    }
}

// Global App Instance
const app = new App();
