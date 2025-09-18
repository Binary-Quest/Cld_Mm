class StudySpendPro {
    constructor() {
        this.currentUser = null;
        this.expenses = [];
        this.recurringBills = [];
        this.unsubscribeExpenses = null;
        this.currentPeriod = {
            duration: 30,
            startDate: new Date().toISOString().split('T')[0],
            budget: 10000
        };
        this.currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
        this.archivedMonths = [];
        this.charts = {};
        
        this.init();
    }

    init() {
        this.showSplashScreen();
        this.setupEventListeners();
        this.setupAuthStateListener();
        
        // Online/offline detection
        window.addEventListener('online', () => this.updateSyncStatus('synced'));
        window.addEventListener('offline', () => this.updateSyncStatus('offline'));
    }

    showSplashScreen() {
        setTimeout(() => {
            this.transitionToAuth();
        }, 3000);
    }

    transitionToAuth() {
        const splash = document.getElementById('splash-screen');
        splash.style.animation = 'fadeOut 0.8s ease-out forwards';
        
        setTimeout(() => {
            splash.classList.add('hidden');
            document.getElementById('auth-screen').classList.remove('hidden');
        }, 800);
    }

    setupAuthStateListener() {
        if (!window.firebase) {
            setTimeout(() => this.setupAuthStateListener(), 1000);
            return;
        }
        
        window.firebase.onAuthStateChanged(window.firebase.auth, async (user) => {
            if (user) {
                this.currentUser = user;
                await this.setupUserProfile();
                this.showMainApp();
                this.showNotification(`Welcome back, ${user.displayName || user.email}!`, 'success');
            } else {
                this.currentUser = null;
                this.showAuthScreen();
            }
        });
    }

    showAuthScreen() {
        document.getElementById('splash-screen').classList.add('hidden');
        document.getElementById('main-app').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('hidden');
    }

    showMainApp() {
        document.getElementById('splash-screen').classList.add('hidden');
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        
        this.loadUserData();
        this.updateDashboard();
        this.updateCurrentMonthDisplay();
    }

    async setupUserProfile() {
        if (!this.currentUser) return;
        
        try {
            const userDocRef = window.firebase.doc(window.firebase.db, 'users', this.currentUser.uid);
            const userDoc = await window.firebase.getDoc(userDocRef);
            
            if (!userDoc.exists()) {
                await window.firebase.setDoc(userDocRef, {
                    email: this.currentUser.email,
                    displayName: this.currentUser.displayName || 'User',
                    createdAt: new Date().toISOString(),
                    settings: {
                        budget: 10000,
                        periodDuration: 30,
                        currency: 'INR',
                        theme: 'default'
                    },
                    currentPeriod: this.currentPeriod
                });
            } else {
                const userData = userDoc.data();
                if (userData.currentPeriod) {
                    this.currentPeriod = userData.currentPeriod;
                }
            }
            
            // Update UI with user info - FIXED EMAIL/NAME DISPLAY
            document.getElementById('user-name').textContent = 
                this.currentUser.displayName || this.currentUser.email.split('@')[0];
            
            // Set values in settings - FIXED
            document.getElementById('settings-email').value = this.currentUser.email || '';
            document.getElementById('settings-name').value = this.currentUser.displayName || '';
            document.getElementById('settings-joined').value = 
                new Date(this.currentUser.metadata.creationTime).toLocaleDateString();
            
            // Update budget displays
            document.getElementById('current-budget-display').textContent = 
                this.currentPeriod.budget.toLocaleString();
            document.getElementById('budget-period-display').textContent = 
                `${this.currentPeriod.duration} days`;
            document.getElementById('current-period-display').textContent = 
                `${this.currentPeriod.duration} Days`;
            
            // Set user avatar
            const avatar = document.getElementById('user-avatar');
            if (this.currentUser.photoURL) {
                avatar.innerHTML = `<img src="${this.currentUser.photoURL}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            } else {
                avatar.innerHTML = '<i class="fas fa-user"></i>';
            }
        } catch (error) {
            console.error('Error setting up user profile:', error);
        }
    }

    setupEventListeners() {
        // Auth tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchAuthTab(tab);
            });
        });

        // Auth forms
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        document.getElementById('google-login').addEventListener('click', () => {
            this.handleGoogleLogin();
        });

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const section = item.dataset.section;
                this.showSection(section);
                this.setActiveNav(item);
            });
        });

        // Logo click
        document.getElementById('home-btn').addEventListener('click', () => {
            this.showSection('dashboard');
            this.setActiveNav(document.querySelector('[data-section="dashboard"]'));
        });

        // Logout buttons
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
        document.getElementById('logout-settings')?.addEventListener('click', () => this.logout());

        // Period controls
        document.getElementById('period-settings-btn').addEventListener('click', () => {
            this.showPeriodModal();
        });

        document.getElementById('reset-month-btn').addEventListener('click', () => {
            this.showResetModal();
        });

        document.getElementById('prev-month-btn').addEventListener('click', () => {
            this.navigateMonth(-1);
        });

        document.getElementById('next-month-btn').addEventListener('click', () => {
            this.navigateMonth(1);
        });

        // Budget management - FIXED BUDGET EDITING
        document.getElementById('edit-budget-btn').addEventListener('click', () => {
            this.toggleBudgetEdit();
        });

        document.getElementById('cancel-budget-edit').addEventListener('click', () => {
            this.toggleBudgetEdit(false);
        });

        document.getElementById('save-budget').addEventListener('click', () => {
            this.saveBudgetSettings();
        });

        // Quick actions
        document.getElementById('add-expense-quick').addEventListener('click', () => {
            this.showSection('add-expense');
            this.setActiveNav(document.querySelector('[data-section="add-expense"]'));
        });

        // Expense form
        document.getElementById('expense-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addExpense();
        });

        document.getElementById('clear-form').addEventListener('click', () => {
            this.clearExpenseForm();
        });

        // Quick amount buttons
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('expense-amount').value = btn.dataset.amount;
                // Trigger label animation
                const input = document.getElementById('expense-amount');
                input.focus();
                input.blur();
            });
        });

        // Bills
        document.getElementById('add-bill-btn').addEventListener('click', () => {
            this.showBillModal();
        });

        document.getElementById('add-first-bill').addEventListener('click', () => {
            this.showBillModal();
        });

        // Export and delete
        document.getElementById('export-data').addEventListener('click', () => {
            this.exportExpenses();
        });

        document.getElementById('delete-month-data').addEventListener('click', () => {
            this.deleteMonthData();
        });

        // History filters
        document.getElementById('search-expenses').addEventListener('input', () => {
            this.filterExpenses();
        });

        document.getElementById('filter-category').addEventListener('change', () => {
            this.filterExpenses();
        });

        document.getElementById('filter-date-from').addEventListener('change', () => {
            this.filterExpenses();
        });

        document.getElementById('filter-date-to').addEventListener('change', () => {
            this.filterExpenses();
        });

        // Analytics period change
        document.getElementById('analytics-period').addEventListener('change', () => {
            this.updateAnalytics();
        });

        // Settings
        document.getElementById('save-preferences').addEventListener('click', () => {
            this.saveUserPreferences();
        });

        // Modal handlers
        this.setupModalHandlers();

        // View all buttons
        document.querySelectorAll('.view-all-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const section = btn.dataset.section || btn.getAttribute('data-section');
                if (section) {
                    this.showSection(section);
                    this.setActiveNav(document.querySelector(`[data-section="${section}"]`));
                }
            });
        });

        // Add first expense buttons
        document.querySelectorAll('[data-section="add-expense"]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.showSection('add-expense');
                this.setActiveNav(document.querySelector('[data-section="add-expense"]'));
            });
        });

        // Set today's date
        this.setTodaysDate();

        // Fix input labels on page load
        this.fixInputLabels();
    }

    setupModalHandlers() {
        // Period modal
        document.getElementById('close-period-modal').addEventListener('click', () => {
            this.closePeriodModal();
        });

        document.getElementById('cancel-period').addEventListener('click', () => {
            this.closePeriodModal();
        });

        document.getElementById('save-period').addEventListener('click', () => {
            this.savePeriodSettings();
        });

        // Reset modal
        document.getElementById('close-reset-modal').addEventListener('click', () => {
            this.closeResetModal();
        });

        document.getElementById('cancel-reset').addEventListener('click', () => {
            this.closeResetModal();
        });

        document.getElementById('confirm-reset').addEventListener('click', () => {
            this.resetMonth();
        });

        // Bill modal
        document.getElementById('close-bill-modal').addEventListener('click', () => {
            this.closeBillModal();
        });

        document.getElementById('cancel-bill').addEventListener('click', () => {
            this.closeBillModal();
        });

        document.getElementById('save-bill').addEventListener('click', () => {
            this.saveBill();
        });
    }

    // Fix input labels positioning issue
    fixInputLabels() {
        document.querySelectorAll('.input-group input, .input-group select').forEach(input => {
            if (input.value && input.value !== '') {
                const label = input.nextElementSibling;
                if (label && label.tagName === 'LABEL') {
                    label.style.transform = 'translateY(-32px) scale(0.85)';
                    label.style.color = '#4facfe';
                }
            }

            // Add event listeners for dynamic label animation
            input.addEventListener('focus', () => {
                const label = input.nextElementSibling;
                if (label && label.tagName === 'LABEL') {
                    label.style.transform = 'translateY(-32px) scale(0.85)';
                    label.style.color = '#4facfe';
                }
            });

            input.addEventListener('blur', () => {
                const label = input.nextElementSibling;
                if (label && label.tagName === 'LABEL' && (!input.value || input.value === '')) {
                    label.style.transform = 'translateY(0) scale(1)';
                    label.style.color = 'rgba(255, 255, 255, 0.6)';
                }
            });

            input.addEventListener('input', () => {
                const label = input.nextElementSibling;
                if (label && label.tagName === 'LABEL') {
                    if (input.value && input.value !== '') {
                        label.style.transform = 'translateY(-32px) scale(0.85)';
                        label.style.color = '#4facfe';
                    }
                }
            });
        });
    }

    switchAuthTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        document.getElementById(`${tab}-form`).classList.add('active');
    }

    async handleLogin() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const btn = document.querySelector('#login-form .auth-btn');
        
        try {
            this.setButtonLoading(btn, true);
            await window.firebase.signInWithEmailAndPassword(window.firebase.auth, email, password);
        } catch (error) {
            this.showNotification(this.getFirebaseErrorMessage(error), 'error');
        } finally {
            this.setButtonLoading(btn, false);
        }
    }

    async handleRegister() {
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm').value;
        const btn = document.querySelector('#register-form .auth-btn');
        
        if (password !== confirmPassword) {
            this.showNotification('Passwords do not match!', 'error');
            return;
        }

        if (password.length < 6) {
            this.showNotification('Password must be at least 6 characters!', 'error');
            return;
        }
        
        try {
            this.setButtonLoading(btn, true);
            const userCredential = await window.firebase.createUserWithEmailAndPassword(window.firebase.auth, email, password);
            
            await window.firebase.updateProfile(userCredential.user, {
                displayName: name
            });
            
            this.showNotification('Account created successfully!', 'success');
        } catch (error) {
            this.showNotification(this.getFirebaseErrorMessage(error), 'error');
        } finally {
            this.setButtonLoading(btn, false);
        }
    }

    async handleGoogleLogin() {
        const btn = document.getElementById('google-login');
        
        try {
            this.setButtonLoading(btn, true);
            const provider = new window.firebase.GoogleAuthProvider();
            await window.firebase.signInWithPopup(window.firebase.auth, provider);
        } catch (error) {
            if (error.code !== 'auth/popup-closed-by-user') {
                this.showNotification(this.getFirebaseErrorMessage(error), 'error');
            }
        } finally {
            this.setButtonLoading(btn, false);
        }
    }

    async logout() {
        try {
            if (this.unsubscribeExpenses) {
                this.unsubscribeExpenses();
            }
            await window.firebase.signOut(window.firebase.auth);
            this.expenses = [];
            this.recurringBills = [];
            this.showNotification('Signed out successfully!', 'success');
        } catch (error) {
            this.showNotification('Error signing out', 'error');
        }
    }

    showSection(sectionId) {
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Load section-specific data
        switch(sectionId) {
            case 'dashboard':
                this.updateDashboard();
                break;
            case 'history':
                this.displayExpenseHistory();
                break;
            case 'analytics':
                this.updateAnalytics();
                break;
            case 'recurring-bills':
                this.loadRecurringBills();
                break;
        }
    }

    setActiveNav(activeItem) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        activeItem.classList.add('active');
    }

    async loadUserData() {
        if (!this.currentUser) return;
        
        // Load current period expenses
        this.loadExpenses();
        
        // Load recurring bills
        this.loadRecurringBills();
        
        // Load archived months
        this.loadArchivedMonths();
    }

    loadExpenses() {
        if (!this.currentUser) return;
        
        if (this.unsubscribeExpenses) {
            this.unsubscribeExpenses();
        }
        
        const expensesRef = window.firebase.collection(
            window.firebase.db, 
            'users', 
            this.currentUser.uid, 
            'months',
            this.currentMonth,
            'expenses'
        );
        const q = window.firebase.query(expensesRef, window.firebase.orderBy('timestamp', 'desc'));
        
        this.updateSyncStatus('syncing');
        
        this.unsubscribeExpenses = window.firebase.onSnapshot(q, (snapshot) => {
            this.expenses = [];
            snapshot.forEach((doc) => {
                this.expenses.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            this.updateDashboard();
            this.displayExpenseHistory();
            this.updateSyncStatus('synced');
        }, (error) => {
            console.error('Error loading expenses:', error);
            this.updateSyncStatus('offline');
        });
    }

    async loadRecurringBills() {
        if (!this.currentUser) return;
        
        try {
            const billsRef = window.firebase.collection(window.firebase.db, 'users', this.currentUser.uid, 'bills');
            const snapshot = await window.firebase.getDocs(billsRef);
            
            this.recurringBills = [];
            snapshot.forEach((doc) => {
                this.recurringBills.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            this.displayRecurringBills();
        } catch (error) {
            console.error('Error loading recurring bills:', error);
        }
    }

    async loadArchivedMonths() {
        if (!this.currentUser) return;
        
        try {
            const monthsRef = window.firebase.collection(window.firebase.db, 'users', this.currentUser.uid, 'months');
            const snapshot = await window.firebase.getDocs(monthsRef);
            
            this.archivedMonths = [];
            snapshot.forEach((doc) => {
                if (doc.id !== this.currentMonth) {
                    this.archivedMonths.push(doc.id);
                }
            });
            
            this.archivedMonths.sort().reverse();
        } catch (error) {
            console.error('Error loading archived months:', error);
        }
    }

    async addExpense() {
        if (!this.currentUser) return;
        
        const description = document.getElementById('expense-description').value;
        const amount = parseFloat(document.getElementById('expense-amount').value);
        const category = document.getElementById('expense-category').value;
        const date = document.getElementById('expense-date').value;
        const notes = document.getElementById('expense-notes').value;
        const btn = document.querySelector('#expense-form .primary-btn');
        
        if (!description || !amount || !category || !date) {
            this.showNotification('Please fill in all required fields!', 'error');
            return;
        }
        
        try {
            this.setButtonLoading(btn, true);
            this.updateSyncStatus('syncing');
            
            const expenseData = {
                description,
                amount,
                category,
                date,
                notes,
                timestamp: new Date(),
                userId: this.currentUser.uid
            };
            
            const expensesRef = window.firebase.collection(
                window.firebase.db, 
                'users', 
                this.currentUser.uid, 
                'months',
                this.currentMonth,
                'expenses'
            );
            await window.firebase.addDoc(expensesRef, expenseData);
            
            this.clearExpenseForm();
            this.showNotification(`Expense of ₹${amount} added successfully!`, 'success');
            this.showSection('dashboard');
            this.setActiveNav(document.querySelector('[data-section="dashboard"]'));
            
        } catch (error) {
            console.error('Error adding expense:', error);
            this.showNotification('Error adding expense. Please try again.', 'error');
        } finally {
            this.setButtonLoading(btn, false);
        }
    }

    clearExpenseForm() {
        document.getElementById('expense-form').reset();
        this.setTodaysDate();
        
        // Reset labels
        document.querySelectorAll('#expense-form .input-group label').forEach(label => {
            label.style.transform = 'translateY(0) scale(1)';
            label.style.color = 'rgba(255, 255, 255, 0.6)';
        });
    }

    setTodaysDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('expense-date').value = today;
        
        // Animate label
        const label = document.querySelector('label[for="expense-date"]');
        if (label) {
            label.style.transform = 'translateY(-32px) scale(0.85)';
            label.style.color = '#4facfe';
        }
    }

    updateDashboard() {
        if (!this.expenses.length) {
            this.showEmptyDashboard();
            return;
        }
        
        const totalSpent = this.expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const budget = this.currentPeriod.budget;
        const remaining = Math.max(0, budget - totalSpent);
        const progressPercentage = Math.min((totalSpent / budget) * 100, 100);
        
        // Today's expenses
        const today = new Date().toISOString().split('T')[0];
        const todayExpenses = this.expenses.filter(expense => expense.date === today);
        const todayTotal = todayExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        
        // Calculate period dates
        const periodStart = new Date(this.currentPeriod.startDate);
        const periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + this.currentPeriod.duration);
        
        const today_date = new Date();
        const daysLeft = Math.max(0, Math.ceil((periodEnd - today_date) / (1000 * 60 * 60 * 24)));
        
        // Daily average
        const daysElapsed = Math.max(1, Math.ceil((today_date - periodStart) / (1000 * 60 * 60 * 24)));
        const dailyAverage = totalSpent / daysElapsed;
        
        // Update dashboard
        document.getElementById('total-spending').textContent = totalSpent.toLocaleString();
        document.getElementById('total-budget').textContent = budget.toLocaleString();
        document.getElementById('remaining-budget').textContent = remaining.toLocaleString();
        document.getElementById('today-spending').textContent = todayTotal.toLocaleString();
        document.getElementById('today-transactions').textContent = todayExpenses.length;
        document.getElementById('daily-average').textContent = dailyAverage.toFixed(0);
        document.getElementById('days-left').textContent = daysLeft;
        
        // Update progress bar
        const progressBar = document.getElementById('spending-progress');
        progressBar.style.width = `${progressPercentage}%`;
        
        this.displayRecentActivity();
    }

    showEmptyDashboard() {
        document.getElementById('total-spending').textContent = '0';
        document.getElementById('remaining-budget').textContent = this.currentPeriod.budget.toLocaleString();
        document.getElementById('today-spending').textContent = '0';
        document.getElementById('today-transactions').textContent = '0';
        document.getElementById('daily-average').textContent = '0';
        document.getElementById('days-left').textContent = this.currentPeriod.duration;
        document.getElementById('spending-progress').style.width = '0%';
    }

    displayRecentActivity() {
        const container = document.getElementById('recent-activities');
        const recent = this.expenses.slice(0, 5);
        
        if (recent.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <h4>No expenses yet</h4>
                    <p>Start tracking your expenses to see them here</p>
                    <button class="premium-btn primary-btn" data-section="add-expense">Add First Expense</button>
                </div>
            `;
            
            // Re-attach event listener
            container.querySelector('[data-section="add-expense"]').addEventListener('click', () => {
                this.showSection('add-expense');
                this.setActiveNav(document.querySelector('[data-section="add-expense"]'));
            });
            return;
        }
        
        container.innerHTML = recent.map(expense => `
            <div class="expense-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--glass-border);">
                <div>
                    <div style="font-weight: 600; margin-bottom: 4px;">${expense.description}</div>
                    <div style="font-size: 0.85rem; opacity: 0.7;">
                        ${this.getCategoryEmoji(expense.category)} ${expense.category} • ${this.formatDate(expense.date)}
                    </div>
                </div>
                <div style="font-weight: 700; font-size: 1.1rem;">₹${expense.amount.toLocaleString()}</div>
            </div>
        `).join('');
    }

    displayExpenseHistory() {
        this.filterExpenses();
    }

    filterExpenses() {
        const searchTerm = document.getElementById('search-expenses').value.toLowerCase();
        const categoryFilter = document.getElementById('filter-category').value;
        const dateFrom = document.getElementById('filter-date-from').value;
        const dateTo = document.getElementById('filter-date-to').value;
        
        let filteredExpenses = this.expenses.filter(expense => {
            const matchesSearch = expense.description.toLowerCase().includes(searchTerm) ||
                                expense.category.toLowerCase().includes(searchTerm);
            const matchesCategory = !categoryFilter || expense.category === categoryFilter;
            const matchesDateFrom = !dateFrom || expense.date >= dateFrom;
            const matchesDateTo = !dateTo || expense.date <= dateTo;
            
            return matchesSearch && matchesCategory && matchesDateFrom && matchesDateTo;
        });
        
        // Update summary
        const totalAmount = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        const averageAmount = filteredExpenses.length > 0 ? totalAmount / filteredExpenses.length : 0;
        
        document.getElementById('summary-total').textContent = `₹${totalAmount.toLocaleString()}`;
        document.getElementById('summary-count').textContent = filteredExpenses.length;
        document.getElementById('summary-average').textContent = `₹${averageAmount.toFixed(0)}`;
        
        // Display expenses
        const container = document.getElementById('expenses-list');
        
        if (filteredExpenses.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <h4>No expenses found</h4>
                    <p>Try adjusting your search filters</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = filteredExpenses.map(expense => `
            <div class="expense-item" style="display: flex; justify-content: space-between; align-items: center; padding: 16px; margin-bottom: 12px; background: var(--glass-bg); border-radius: 12px; border: 1px solid var(--glass-border);">
                <div style="flex: 1;">
                    <div style="font-weight: 600; margin-bottom: 4px;">${expense.description}</div>
                    <div style="font-size: 0.85rem; opacity: 0.7; display: flex; gap: 12px;">
                        <span>${this.getCategoryEmoji(expense.category)} ${expense.category}</span>
                        <span>${this.formatDate(expense.date)}</span>
                        ${expense.notes ? `<span>${expense.notes}</span>` : ''}
                    </div>
                </div>
                <div style="font-weight: 700; font-size: 1.2rem;">₹${expense.amount.toLocaleString()}</div>
            </div>
        `).join('');
    }

    displayRecurringBills() {
        const container = document.getElementById('bills-container');
        
        if (this.recurringBills.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-alt"></i>
                    <h4>No Recurring Bills</h4>
                    <p>Add your monthly subscriptions and bills</p>
                    <button class="premium-btn" id="add-first-bill-inline">Add First Bill</button>
                </div>
            `;
            
            document.getElementById('add-first-bill-inline').addEventListener('click', () => {
                this.showBillModal();
            });
            return;
        }
        
        container.innerHTML = this.recurringBills.map(bill => `
            <div class="bill-item" style="display: flex; justify-content: space-between; align-items: center; padding: 16px; margin-bottom: 12px; background: var(--glass-bg); border-radius: 12px; border: 1px solid var(--glass-border);">
                <div style="flex: 1;">
                    <div style="font-weight: 600; margin-bottom: 4px;">${bill.name}</div>
                    <div style="font-size: 0.85rem; opacity: 0.7;">
                        ${this.capitalizeFirst(bill.frequency)} • Next due: ${this.formatDate(bill.nextDue)}
                    </div>
                </div>
                <div style="font-weight: 700; font-size: 1.2rem;">₹${bill.amount.toLocaleString()}</div>
            </div>
        `).join('');
    }

    // BUDGET MANAGEMENT - FIXED
    toggleBudgetEdit(show = null) {
        const display = document.querySelector('.budget-display');
        const edit = document.getElementById('budget-edit');
        
        if (show === null) {
            show = edit.style.display === 'none';
        }
        
        if (show) {
            display.style.display = 'none';
            edit.style.display = 'block';
            
            // Set current values
            document.getElementById('new-budget-amount').value = this.currentPeriod.budget;
            document.getElementById('new-budget-duration').value = this.currentPeriod.duration;
            
            // Animate labels
            this.fixInputLabels();
        } else {
            display.style.display = 'grid';
            edit.style.display = 'none';
        }
    }

    async saveBudgetSettings() {
        const newBudget = parseInt(document.getElementById('new-budget-amount').value);
        const newDuration = parseInt(document.getElementById('new-budget-duration').value);
        
        if (!newBudget || newBudget < 100) {
            this.showNotification('Budget must be at least ₹100', 'error');
            return;
        }
        
        if (!newDuration || newDuration < 1 || newDuration > 31) {
            this.showNotification('Duration must be between 1 and 31 days', 'error');
            return;
        }
        
        try {
            this.currentPeriod.budget = newBudget;
            this.currentPeriod.duration = newDuration;
            
            // Update Firebase
            const userDocRef = window.firebase.doc(window.firebase.db, 'users', this.currentUser.uid);
            await window.firebase.updateDoc(userDocRef, {
                currentPeriod: this.currentPeriod
            });
            
            // Update UI
            document.getElementById('current-budget-display').textContent = newBudget.toLocaleString();
            document.getElementById('budget-period-display').textContent = `${newDuration} days`;
            document.getElementById('current-period-display').textContent = `${newDuration} Days`;
            
            this.toggleBudgetEdit(false);
            this.updateDashboard();
            this.showNotification('Budget settings updated successfully!', 'success');
        } catch (error) {
            console.error('Error updating budget:', error);
            this.showNotification('Error updating budget settings', 'error');
        }
    }

    // PERIOD MODAL
    showPeriodModal() {
        const modal = document.getElementById('period-modal');
        modal.classList.add('show');
        
        // Set current values
        document.getElementById('period-duration').value = this.currentPeriod.duration;
        document.getElementById('period-start-date').value = this.currentPeriod.startDate;
        
        this.fixInputLabels();
    }

    closePeriodModal() {
        document.getElementById('period-modal').classList.remove('show');
    }

    async savePeriodSettings() {
        const duration = parseInt(document.getElementById('period-duration').value);
        const startDate = document.getElementById('period-start-date').value;
        
        if (!duration || duration < 1 || duration > 31) {
            this.showNotification('Duration must be between 1 and 31 days', 'error');
            return;
        }
        
        if (!startDate) {
            this.showNotification('Please select a start date', 'error');
            return;
        }
        
        try {
            this.currentPeriod.duration = duration;
            this.currentPeriod.startDate = startDate;
            
            // Update Firebase
            const userDocRef = window.firebase.doc(window.firebase.db, 'users', this.currentUser.uid);
            await window.firebase.updateDoc(userDocRef, {
                currentPeriod: this.currentPeriod
            });
            
            // Update UI
            document.getElementById('current-period-display').textContent = `${duration} Days`;
            
            this.closePeriodModal();
            this.updateDashboard();
            this.showNotification('Period settings updated successfully!', 'success');
        } catch (error) {
            console.error('Error updating period:', error);
            this.showNotification('Error updating period settings', 'error');
        }
    }

    // RESET MONTH FUNCTIONALITY
    showResetModal() {
        document.getElementById('reset-modal').classList.add('show');
    }

    closeResetModal() {
        document.getElementById('reset-modal').classList.remove('show');
    }

    async resetMonth() {
        const archiveData = document.getElementById('archive-data').checked;
        
        try {
            if (archiveData && this.expenses.length > 0) {
                // Archive current month data
                const archiveRef = window.firebase.doc(
                    window.firebase.db,
                    'users',
                    this.currentUser.uid,
                    'archives',
                    this.currentMonth
                );
                
                await window.firebase.setDoc(archiveRef, {
                    expenses: this.expenses,
                    totalAmount: this.expenses.reduce((sum, exp) => sum + exp.amount, 0),
                    totalCount: this.expenses.length,
                    archivedAt: new Date().toISOString(),
                    period: this.currentPeriod
                });
            }
            
            // Delete current month expenses
            const expensesRef = window.firebase.collection(
                window.firebase.db,
                'users',
                this.currentUser.uid,
                'months',
                this.currentMonth,
                'expenses'
            );
            
            const snapshot = await window.firebase.getDocs(expensesRef);
            const deletePromises = snapshot.docs.map(doc => window.firebase.deleteDoc(doc.ref));
            await Promise.all(deletePromises);
            
            // Reset period start date to today
            this.currentPeriod.startDate = new Date().toISOString().split('T')[0];
            
            const userDocRef = window.firebase.doc(window.firebase.db, 'users', this.currentUser.uid);
            await window.firebase.updateDoc(userDocRef, {
                currentPeriod: this.currentPeriod
            });
            
            this.closeResetModal();
            this.showNotification('Month reset successfully!', 'success');
            
            // Reload data
            this.loadUserData();
        } catch (error) {
            console.error('Error resetting month:', error);
            this.showNotification('Error resetting month', 'error');
        }
    }

    // MONTH NAVIGATION
    updateCurrentMonthDisplay() {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        
        const [year, month] = this.currentMonth.split('-');
        const monthName = monthNames[parseInt(month) - 1];
        
        document.getElementById('current-month-display').textContent = `${monthName} ${year}`;
    }

    navigateMonth(direction) {
        const currentDate = new Date(this.currentMonth + '-01');
        currentDate.setMonth(currentDate.getMonth() + direction);
        
        this.currentMonth = currentDate.toISOString().substring(0, 7);
        this.updateCurrentMonthDisplay();
        this.loadExpenses();
    }

    // DELETE MONTH DATA
    async deleteMonthData() {
        if (!confirm(`Are you sure you want to delete all data for ${this.currentMonth}? This action cannot be undone.`)) {
            return;
        }
        
        try {
            const expensesRef = window.firebase.collection(
                window.firebase.db,
                'users',
                this.currentUser.uid,
                'months',
                this.currentMonth,
                'expenses'
            );
            
            const snapshot = await window.firebase.getDocs(expensesRef);
            const deletePromises = snapshot.docs.map(doc => window.firebase.deleteDoc(doc.ref));
            await Promise.all(deletePromises);
            
            this.showNotification('Month data deleted successfully!', 'success');
            this.loadExpenses();
        } catch (error) {
            console.error('Error deleting month data:', error);
            this.showNotification('Error deleting month data', 'error');
        }
    }

    // ANALYTICS WITH CHARTS
    async updateAnalytics() {
        const period = document.getElementById('analytics-period').value;
        
        try {
            let analyticsData = [];
            
            switch(period) {
                case 'daily':
                    analyticsData = await this.getDailyAnalytics();
                    break;
                case 'monthly':
                    analyticsData = await this.getMonthlyAnalytics();
                    break;
                case '6months':
                    analyticsData = await this.get6MonthAnalytics();
                    break;
                case 'yearly':
                    analyticsData = await this.getYearlyAnalytics();
                    break;
                case 'total':
                    analyticsData = await this.getTotalAnalytics();
                    break;
            }
            
            this.renderCharts(analyticsData, period);
            this.generateInsights(analyticsData, period);
        } catch (error) {
            console.error('Error updating analytics:', error);
        }
    }

    async getDailyAnalytics() {
        // Get last 30 days of current month
        const last30Days = [];
        const today = new Date();
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const dayExpenses = this.expenses.filter(exp => exp.date === dateStr);
            const dayTotal = dayExpenses.reduce((sum, exp) => sum + exp.amount, 0);
            
            last30Days.push({
                date: dateStr,
                amount: dayTotal,
                count: dayExpenses.length
            });
        }
        
        return { daily: last30Days, expenses: this.expenses };
    }

    async getMonthlyAnalytics() {
        return { monthly: [{ month: this.currentMonth, expenses: this.expenses }] };
    }

    async get6MonthAnalytics() {
        const last6Months = [];
        const today = new Date();
        
        for (let i = 5; i >= 0; i--) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthStr = date.toISOString().substring(0, 7);
            
            // Load expenses for this month
            const monthExpenses = await this.getMonthExpenses(monthStr);
            last6Months.push({
                month: monthStr,
                expenses: monthExpenses,
                total: monthExpenses.reduce((sum, exp) => sum + exp.amount, 0)
            });
        }
        
        return { months: last6Months };
    }

    async getYearlyAnalytics() {
        const currentYear = new Date().getFullYear();
        const yearlyData = [];
        
        for (let month = 1; month <= 12; month++) {
            const monthStr = `${currentYear}-${month.toString().padStart(2, '0')}`;
            const monthExpenses = await this.getMonthExpenses(monthStr);
            
            yearlyData.push({
                month: monthStr,
                expenses: monthExpenses,
                total: monthExpenses.reduce((sum, exp) => sum + exp.amount, 0)
            });
        }
        
        return { yearly: yearlyData };
    }

    async getTotalAnalytics() {
        // Get all archived months + current month
        const allData = [];
        
        // Add current month
        allData.push({
            month: this.currentMonth,
            expenses: this.expenses,
            total: this.expenses.reduce((sum, exp) => sum + exp.amount, 0)
        });
        
        // Add archived months
        for (const monthStr of this.archivedMonths) {
            const monthExpenses = await this.getMonthExpenses(monthStr);
            allData.push({
                month: monthStr,
                expenses: monthExpenses,
                total: monthExpenses.reduce((sum, exp) => sum + exp.amount, 0)
            });
        }
        
        return { total: allData };
    }

    async getMonthExpenses(monthStr) {
        if (monthStr === this.currentMonth) {
            return this.expenses;
        }
        
        try {
            const expensesRef = window.firebase.collection(
                window.firebase.db,
                'users',
                this.currentUser.uid,
                'months',
                monthStr,
                'expenses'
            );
            
            const snapshot = await window.firebase.getDocs(expensesRef);
            const expenses = [];
            
            snapshot.forEach(doc => {
                expenses.push({ id: doc.id, ...doc.data() });
            });
            
            return expenses;
        } catch (error) {
            console.error(`Error loading expenses for ${monthStr}:`, error);
            return [];
        }
    }

    renderCharts(data, period) {
        // Destroy existing charts
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};
        
        // Render based on period
        switch(period) {
            case 'daily':
                this.renderDailyCharts(data.daily, data.expenses);
                break;
            case 'monthly':
                this.renderMonthlyCharts(data.monthly[0].expenses);
                break;
            case '6months':
                this.render6MonthCharts(data.months);
                break;
            case 'yearly':
                this.renderYearlyCharts(data.yearly);
                break;
            case 'total':
                this.renderTotalCharts(data.total);
                break;
        }
    }

    renderDailyCharts(dailyData, expenses) {
        // Trends Chart
        const trendsCtx = document.getElementById('trendsChart').getContext('2d');
        this.charts.trends = new Chart(trendsCtx, {
            type: 'line',
            data: {
                labels: dailyData.map(d => new Date(d.date).toLocaleDateString()),
                datasets: [{
                    label: 'Daily Spending',
                    data: dailyData.map(d => d.amount),
                    borderColor: '#4facfe',
                    backgroundColor: 'rgba(79, 172, 254, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
        
        // Category Chart
        const categoryData = this.getCategoryBreakdown(expenses);
        const categoryCtx = document.getElementById('categoryChart').getContext('2d');
        this.charts.category = new Chart(categoryCtx, {
            type: 'doughnut',
            data: {
                labels: categoryData.labels,
                datasets: [{
                    data: categoryData.values,
                    backgroundColor: [
                        '#4facfe', '#00f2fe', '#fa709a', '#fee140',
                        '#a8edea', '#fed6e3', '#ff9a9e', '#fecfef'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
        
        // Daily breakdown
        const dailyCtx = document.getElementById('dailyChart').getContext('2d');
        this.charts.daily = new Chart(dailyCtx, {
            type: 'bar',
            data: {
                labels: dailyData.slice(-7).map(d => new Date(d.date).toLocaleDateString()),
                datasets: [{
                    label: 'Amount',
                    data: dailyData.slice(-7).map(d => d.amount),
                    backgroundColor: '#4facfe'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
        });
        
        // Empty comparison chart for daily view
        const comparisonCtx = document.getElementById('comparisonChart').getContext('2d');
        this.charts.comparison = new Chart(comparisonCtx, {
            type: 'bar',
            data: {
                labels: ['This Week', 'Last Week'],
                datasets: [{
                    label: 'Weekly Comparison',
                    data: [0, 0],
                    backgroundColor: ['#4facfe', '#a8edea']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    renderMonthlyCharts(expenses) {
        // Similar implementation for monthly view
        const categoryData = this.getCategoryBreakdown(expenses);
        
        const categoryCtx = document.getElementById('categoryChart').getContext('2d');
        this.charts.category = new Chart(categoryCtx, {
            type: 'pie',
            data: {
                labels: categoryData.labels,
                datasets: [{
                    data: categoryData.values,
                    backgroundColor: [
                        '#4facfe', '#00f2fe', '#fa709a', '#fee140',
                        '#a8edea', '#fed6e3', '#ff9a9e', '#fecfef'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' }
                }
            }
        });
        
        // Add other monthly charts...
    }

    render6MonthCharts(monthsData) {
        // Monthly comparison chart
        const comparisonCtx = document.getElementById('comparisonChart').getContext('2d');
        this.charts.comparison = new Chart(comparisonCtx, {
            type: 'bar',
            data: {
                labels: monthsData.map(m => {
                    const date = new Date(m.month + '-01');
                    return date.toLocaleDateString('en-US', { month: 'short' });
                }),
                datasets: [{
                    label: 'Monthly Spending',
                    data: monthsData.map(m => m.total),
                    backgroundColor: '#4facfe'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
        
        // Add other 6-month charts...
    }

    renderYearlyCharts(yearlyData) {
        // Implementation for yearly charts
    }

    renderTotalCharts(totalData) {
        // Implementation for total/all-time charts
    }

    getCategoryBreakdown(expenses) {
        const categories = {};
        
        expenses.forEach(expense => {
            if (categories[expense.category]) {
                categories[expense.category] += expense.amount;
            } else {
                categories[expense.category] = expense.amount;
            }
        });
        
        return {
            labels: Object.keys(categories),
            values: Object.values(categories)
        };
    }

    generateInsights(data, period) {
        const container = document.getElementById('insights-container');
        const insights = [];
        
        // Generate insights based on period and data
        switch(period) {
            case 'daily':
                if (data.daily.length > 0) {
                    const avgDaily = data.daily.reduce((sum, d) => sum + d.amount, 0) / data.daily.length;
                    insights.push(`Your average daily spending is ₹${avgDaily.toFixed(0)}`);
                    
                    const maxDay = data.daily.reduce((max, d) => d.amount > max.amount ? d : max);
                    insights.push(`Highest spending day: ${this.formatDate(maxDay.date)} (₹${maxDay.amount})`);
                }
                break;
            case 'monthly':
                if (data.monthly[0].expenses.length > 0) {
                    const topCategory = this.getTopCategory(data.monthly[0].expenses);
                    insights.push(`Your top spending category is ${topCategory.name} (₹${topCategory.amount})`);
                }
                break;
        }
        
        if (insights.length === 0) {
            insights.push('Add more expenses to get personalized insights!');
        }
        
        container.innerHTML = insights.map(insight => `
            <div class="insight-card">
                <i class="fas fa-lightbulb"></i>
                <p>${insight}</p>
            </div>
        `).join('');
    }

    getTopCategory(expenses) {
        const categories = this.getCategoryBreakdown(expenses);
        let topCategory = { name: '', amount: 0 };
        
        categories.labels.forEach((label, index) => {
            if (categories.values[index] > topCategory.amount) {
                topCategory = { name: label, amount: categories.values[index] };
            }
        });
        
        return topCategory;
    }

    // BILL MODAL
    showBillModal() {
        document.getElementById('bill-modal').classList.add('show');
        document.getElementById('bill-form').reset();
        this.fixInputLabels();
    }

    closeBillModal() {
        document.getElementById('bill-modal').classList.remove('show');
    }

    async saveBill() {
        const name = document.getElementById('bill-name').value;
        const amount = parseFloat(document.getElementById('bill-amount').value);
        const frequency = document.getElementById('bill-frequency').value;
        const nextDue = document.getElementById('bill-next-due').value;
        
        if (!name || !amount || !frequency || !nextDue) {
            this.showNotification('Please fill in all fields!', 'error');
            return;
        }
        
        try {
            const billData = {
                name,
                amount,
                frequency,
                nextDue,
                createdAt: new Date().toISOString(),
                userId: this.currentUser.uid
            };
            
            const billsRef = window.firebase.collection(window.firebase.db, 'users', this.currentUser.uid, 'bills');
            await window.firebase.addDoc(billsRef, billData);
            
            this.closeBillModal();
            this.showNotification(`Bill "${name}" added successfully!`, 'success');
            this.loadRecurringBills();
        } catch (error) {
            console.error('Error adding bill:', error);
            this.showNotification('Error adding bill', 'error');
        }
    }

    // PREFERENCES
    async saveUserPreferences() {
        const currency = document.getElementById('currency-setting').value;
        const theme = document.getElementById('theme-setting').value;
        
        try {
            const userDocRef = window.firebase.doc(window.firebase.db, 'users', this.currentUser.uid);
            await window.firebase.updateDoc(userDocRef, {
                'settings.currency': currency,
                'settings.theme': theme
            });
            
            this.showNotification('Preferences saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving preferences:', error);
            this.showNotification('Error saving preferences', 'error');
        }
    }

    // EXPORT
    exportExpenses() {
        if (this.expenses.length === 0) {
            this.showNotification('No expenses to export!', 'warning');
            return;
        }
        
        const exportData = this.expenses.map(expense => ({
            Date: expense.date,
            Description: expense.description,
            Category: expense.category,
            Amount: expense.amount,
            Notes: expense.notes || ''
        }));
        
        const csvContent = this.convertToCSV(exportData);
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `studyspend-expenses-${this.currentMonth}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        this.showNotification('Expenses exported successfully!', 'success');
    }

    convertToCSV(data) {
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(row => Object.values(row).map(value => `"${value}"`).join(','));
        return [headers, ...rows].join('\n');
    }

    // UTILITY METHODS
    getCategoryEmoji(category) {
        const emojis = {
            'Food': '🍽️',
            'Transport': '🚌',
            'Education': '📚',
            'Entertainment': '🎬',
            'Health': '💊',
            'Shopping': '🛍️',
            'Personal': '👤',
            'Emergency': '🚨',
            'Other': '📋'
        };
        return emojis[category] || '📋';
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
        });
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    updateSyncStatus(status) {
        const syncElement = document.getElementById('sync-status');
        if (!syncElement) return;
        
        const icon = syncElement.querySelector('i');
        const text = syncElement.childNodes[2];
        
        switch (status) {
            case 'syncing':
                icon.className = 'fas fa-sync-alt fa-spin';
                if (text) text.textContent = ' Syncing...';
                break;
            case 'synced':
                icon.className = 'fas fa-cloud-upload-alt';
                if (text) text.textContent = ' Synced';
                break;
            case 'offline':
                icon.className = 'fas fa-wifi-slash';
                if (text) text.textContent = ' Offline';
                break;
        }
    }

    setButtonLoading(button, loading) {
        if (loading) {
            button.disabled = true;
            button.style.opacity = '0.7';
            const originalText = button.innerHTML;
            button.dataset.originalText = originalText;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        } else {
            button.disabled = false;
            button.style.opacity = '1';
            if (button.dataset.originalText) {
                button.innerHTML = button.dataset.originalText;
            }
        }
    }

    getFirebaseErrorMessage(error) {
        switch (error.code) {
            case 'auth/user-not-found':
                return 'No account found with this email.';
            case 'auth/wrong-password':
                return 'Incorrect password.';
            case 'auth/email-already-in-use':
                return 'An account with this email already exists.';
            case 'auth/weak-password':
                return 'Password is too weak. Please choose a stronger password.';
            case 'auth/invalid-email':
                return 'Please enter a valid email address.';
            case 'auth/popup-closed-by-user':
                return 'Google sign-in was cancelled.';
            default:
                return error.message || 'An error occurred. Please try again.';
        }
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        container.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (container.contains(notification)) {
                    container.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Add CSS for fadeOut animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    
    .modal.show {
        opacity: 1;
        visibility: visible;
    }
    
    .modal {
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
    }
`;
document.head.appendChild(style);

// Initialize app
let app;
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        app = new StudySpendPro();
        window.app = app;
    }, 500);
});
