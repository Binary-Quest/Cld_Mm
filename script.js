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
        this.currentMonth = new Date().toISOString().substring(0, 7);
        this.archivedMonths = [];
        this.charts = {};
        
        // Auto logout timer
        this.idleTimer = null;
        this.lastActivity = Date.now();
        this.IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
        this.hasShownWelcome = false;
        
        this.init();
    }

    init() {
        this.showSplashScreen();
        this.setupEventListeners();
        this.setupAuthStateListener();
        this.setupIdleTimer();
        
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
            // Don't automatically show auth screen - let setupAuthStateListener handle it
        }, 800);
    }

    // FIXED AUTH STATE LISTENER WITH PERSISTENCE
    setupAuthStateListener() {
        if (!window.firebase) {
            setTimeout(() => this.setupAuthStateListener(), 1000);
            return;
        }
        
        // Set persistence to LOCAL (persist across browser restarts)
        window.firebase.auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL)
            .then(() => {
                console.log('Auth persistence set to LOCAL');
                
                // Now set up the auth state listener
                window.firebase.onAuthStateChanged(window.firebase.auth, async (user) => {
                    console.log('Auth state changed:', user ? 'User logged in' : 'No user');
                    
                    if (user) {
                        this.currentUser = user;
                        await this.setupUserProfile();
                        this.showMainApp();
                        this.resetIdleTimer(); // Reset idle timer on login
                        if (!this.hasShownWelcome) {
                            this.showNotification(`Welcome back, ${user.displayName || user.email}!`, 'success');
                            this.hasShownWelcome = true;
                        }
                    } else {
                        this.currentUser = null;
                        this.showAuthScreen();
                        this.clearIdleTimer(); // Clear idle timer on logout
                        this.hasShownWelcome = false;
                    }
                });
            })
            .catch((error) => {
                console.error('Error setting persistence:', error);
                this.showNotification('Error setting up authentication', 'error');
            });
    }

    // AUTO LOGOUT FUNCTIONALITY
    setupIdleTimer() {
        // Track user activity
        const resetTimer = () => {
            this.lastActivity = Date.now();
            this.resetIdleTimer();
        };

        // Listen for user activity
        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
            document.addEventListener(event, resetTimer, true);
        });

        this.resetIdleTimer();
    }

    resetIdleTimer() {
        if (!this.currentUser) return;

        this.clearIdleTimer();
        
        this.idleTimer = setTimeout(() => {
            this.handleIdleTimeout();
        }, this.IDLE_TIMEOUT);
    }

    clearIdleTimer() {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
    }

    async handleIdleTimeout() {
        if (this.currentUser) {
            this.showNotification('You have been automatically logged out due to inactivity', 'warning');
            await this.logout();
        }
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
            
            // Update UI with user info
            document.getElementById('user-name').textContent = 
                this.currentUser.displayName || this.currentUser.email.split('@')[0];
            
            // Set values in settings
            const settingsEmail = document.getElementById('settings-email');
            const settingsName = document.getElementById('settings-name');
            const settingsJoined = document.getElementById('settings-joined');
            
            if (settingsEmail) settingsEmail.value = this.currentUser.email || '';
            if (settingsName) settingsName.value = this.currentUser.displayName || '';
            if (settingsJoined) settingsJoined.value = new Date(this.currentUser.metadata.creationTime).toLocaleDateString();
            
            // Update budget displays
            const currentBudgetDisplay = document.getElementById('current-budget-display');
            const budgetPeriodDisplay = document.getElementById('budget-period-display');
            const currentPeriodDisplay = document.getElementById('current-period-display');
            
            if (currentBudgetDisplay) currentBudgetDisplay.textContent = this.currentPeriod.budget.toLocaleString();
            if (budgetPeriodDisplay) budgetPeriodDisplay.textContent = `${this.currentPeriod.duration} days`;
            if (currentPeriodDisplay) currentPeriodDisplay.textContent = `${this.currentPeriod.duration} Days`;
            
            // Set user avatar
            const avatar = document.getElementById('user-avatar');
            if (avatar) {
                if (this.currentUser.photoURL) {
                    avatar.innerHTML = `<img src="${this.currentUser.photoURL}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
                } else {
                    avatar.innerHTML = '<i class="fas fa-user"></i>';
                }
            }
        } catch (error) {
            console.error('Error setting up user profile:', error);
            this.showNotification('Error loading user profile', 'error');
        }
    }

    // ENHANCED EVENT LISTENERS
    setupEventListeners() {
        // Auth tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchAuthTab(tab);
            });
        });

        // Auth forms - FIXED EVENT HANDLING
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const googleBtn = document.getElementById('google-login');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister();
            });
        }

        if (googleBtn) {
            googleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleGoogleLogin();
            });
        }

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const section = item.dataset.section;
                this.showSection(section);
                this.setActiveNav(item);
            });
        });

        // Logo click
        const homeBtn = document.getElementById('home-btn');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                this.showSection('dashboard');
                this.setActiveNav(document.querySelector('[data-section="dashboard"]'));
            });
        }

        // Logout buttons
        const logoutBtn = document.getElementById('logout-btn');
        const logoutSettings = document.getElementById('logout-settings');
        
        if (logoutBtn) logoutBtn.addEventListener('click', () => this.logout());
        if (logoutSettings) logoutSettings.addEventListener('click', () => this.logout());

        // Period controls
        const periodSettingsBtn = document.getElementById('period-settings-btn');
        const resetMonthBtn = document.getElementById('reset-month-btn');
        const prevMonthBtn = document.getElementById('prev-month-btn');
        const nextMonthBtn = document.getElementById('next-month-btn');

        if (periodSettingsBtn) periodSettingsBtn.addEventListener('click', () => this.showPeriodModal());
        if (resetMonthBtn) resetMonthBtn.addEventListener('click', () => this.showResetModal());
        if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => this.navigateMonth(-1));
        if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => this.navigateMonth(1));

        // Budget management
        const editBudgetBtn = document.getElementById('edit-budget-btn');
        const cancelBudgetEdit = document.getElementById('cancel-budget-edit');
        const saveBudget = document.getElementById('save-budget');

        if (editBudgetBtn) editBudgetBtn.addEventListener('click', () => this.toggleBudgetEdit());
        if (cancelBudgetEdit) cancelBudgetEdit.addEventListener('click', () => this.toggleBudgetEdit(false));
        if (saveBudget) saveBudget.addEventListener('click', () => this.saveBudgetSettings());

        // Quick actions
        const addExpenseQuick = document.getElementById('add-expense-quick');
        if (addExpenseQuick) {
            addExpenseQuick.addEventListener('click', () => {
                this.showSection('add-expense');
                this.setActiveNav(document.querySelector('[data-section="add-expense"]'));
            });
        }

        // Expense form
        const expenseForm = document.getElementById('expense-form');
        const clearForm = document.getElementById('clear-form');

        if (expenseForm) expenseForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addExpense();
        });
        if (clearForm) clearForm.addEventListener('click', () => this.clearExpenseForm());

        // Quick amount buttons
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const amountInput = document.getElementById('expense-amount');
                if (amountInput) {
                    amountInput.value = btn.dataset.amount;
                    amountInput.focus();
                    amountInput.blur();
                }
            });
        });

        // Export and delete
        const exportData = document.getElementById('export-data');
        const deleteMonthData = document.getElementById('delete-month-data');

        if (exportData) exportData.addEventListener('click', () => this.exportExpenses());
        if (deleteMonthData) deleteMonthData.addEventListener('click', () => this.deleteMonthData());

        // History filters
        const searchExpenses = document.getElementById('search-expenses');
        const filterCategory = document.getElementById('filter-category');
        const filterDateFrom = document.getElementById('filter-date-from');
        const filterDateTo = document.getElementById('filter-date-to');

        if (searchExpenses) searchExpenses.addEventListener('input', () => this.filterExpenses());
        if (filterCategory) filterCategory.addEventListener('change', () => this.filterExpenses());
        if (filterDateFrom) filterDateFrom.addEventListener('change', () => this.filterExpenses());
        if (filterDateTo) filterDateTo.addEventListener('change', () => this.filterExpenses());

        // Analytics period change
        const analyticsPeriod = document.getElementById('analytics-period');
        if (analyticsPeriod) analyticsPeriod.addEventListener('change', () => this.updateAnalytics());

        // Settings
        const savePreferences = document.getElementById('save-preferences');
        if (savePreferences) savePreferences.addEventListener('click', () => this.saveUserPreferences());

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

        // Fix input labels on load
        setTimeout(() => {
            this.fixInputLabels();
        }, 100);
    }

    setupModalHandlers() {
        // Period modal
        const closePeriodModal = document.getElementById('close-period-modal');
        const cancelPeriod = document.getElementById('cancel-period');
        const savePeriod = document.getElementById('save-period');

        if (closePeriodModal) closePeriodModal.addEventListener('click', () => this.closePeriodModal());
        if (cancelPeriod) cancelPeriod.addEventListener('click', () => this.closePeriodModal());
        if (savePeriod) savePeriod.addEventListener('click', () => this.savePeriodSettings());

        // Reset modal
        const closeResetModal = document.getElementById('close-reset-modal');
        const cancelReset = document.getElementById('cancel-reset');
        const confirmReset = document.getElementById('confirm-reset');

        if (closeResetModal) closeResetModal.addEventListener('click', () => this.closeResetModal());
        if (cancelReset) cancelReset.addEventListener('click', () => this.closeResetModal());
        if (confirmReset) confirmReset.addEventListener('click', () => this.resetMonth());

        // Bill modal
        const closeBillModal = document.getElementById('close-bill-modal');
        const cancelBill = document.getElementById('cancel-bill');
        const saveBill = document.getElementById('save-bill');

        if (closeBillModal) closeBillModal.addEventListener('click', () => this.closeBillModal());
        if (cancelBill) cancelBill.addEventListener('click', () => this.closeBillModal());
        if (saveBill) saveBill.addEventListener('click', () => this.saveBill());
    }

    // Fix input labels positioning issue
    fixInputLabels() {
        document.querySelectorAll('.input-group input, .input-group select').forEach(input => {
            const label = input.nextElementSibling;
            if (!label || label.tagName !== 'LABEL') return;

            const updateLabel = () => {
                if (input.value && input.value !== '') {
                    label.style.transform = 'translateY(-40px) scale(0.85)';
                    label.style.color = '#4facfe';
                    label.style.background = 'rgba(0, 0, 0, 0.2)';
                    label.style.backdropFilter = 'blur(10px)';
                    label.style.padding = '4px 12px';
                    label.style.borderRadius = '8px';
                    label.style.left = '24px';
                } else {
                    label.style.transform = 'translateY(0) scale(1)';
                    label.style.color = 'rgba(255, 255, 255, 0.7)';
                    label.style.background = 'transparent';
                    label.style.padding = '0';
                    label.style.left = '56px';
                }
            };

            // Initial update
            updateLabel();

            // Event listeners
            input.addEventListener('focus', updateLabel);
            input.addEventListener('blur', updateLabel);
            input.addEventListener('input', updateLabel);
        });
    }

    switchAuthTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        document.getElementById(`${tab}-form`).classList.add('active');

        // Fix labels after tab switch
        setTimeout(() => this.fixInputLabels(), 100);
    }

    // FIXED LOGIN HANDLING
    async handleLogin() {
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const btn = document.getElementById('login-btn') || document.querySelector('#login-form .auth-btn');
        
        if (!emailInput || !passwordInput) {
            this.showNotification('Login form not found', 'error');
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        if (!email || !password) {
            this.showNotification('Please enter both email and password', 'error');
            return;
        }
        
        try {
            this.setButtonLoading(btn, true);
            console.log('Attempting login with:', email);
            
            const userCredential = await window.firebase.signInWithEmailAndPassword(
                window.firebase.auth, 
                email, 
                password
            );
            
            console.log('Login successful:', userCredential.user.uid);
            // Don't show notification here - it will be shown in auth state listener
        } catch (error) {
            console.error('Login error:', error);
            this.showNotification(this.getFirebaseErrorMessage(error), 'error');
        } finally {
            this.setButtonLoading(btn, false);
        }
    }

    async handleRegister() {
        const nameInput = document.getElementById('register-name');
        const emailInput = document.getElementById('register-email');
        const passwordInput = document.getElementById('register-password');
        const confirmInput = document.getElementById('register-confirm');
        const btn = document.getElementById('register-btn') || document.querySelector('#register-form .auth-btn');
        
        if (!nameInput || !emailInput || !passwordInput || !confirmInput) {
            this.showNotification('Registration form not found', 'error');
            return;
        }

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmInput.value;
        
        if (!name || !email || !password || !confirmPassword) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }
        
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
            console.log('Attempting registration with:', email);
            
            const userCredential = await window.firebase.createUserWithEmailAndPassword(
                window.firebase.auth, 
                email, 
                password
            );
            
            // Update user profile with display name
            await window.firebase.updateProfile(userCredential.user, {
                displayName: name
            });
            
            console.log('Registration successful:', userCredential.user.uid);
            this.showNotification('Account created successfully!', 'success');
        } catch (error) {
            console.error('Registration error:', error);
            this.showNotification(this.getFirebaseErrorMessage(error), 'error');
        } finally {
            this.setButtonLoading(btn, false);
        }
    }

    async handleGoogleLogin() {
        const btn = document.getElementById('google-login');
        
        try {
            this.setButtonLoading(btn, true);
            console.log('Attempting Google login');
            
            const provider = new window.firebase.GoogleAuthProvider();
            provider.addScope('email');
            provider.addScope('profile');
            
            const result = await window.firebase.signInWithPopup(window.firebase.auth, provider);
            console.log('Google login successful:', result.user.uid);
        } catch (error) {
            console.error('Google login error:', error);
            if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
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
            this.clearIdleTimer();
            
            await window.firebase.signOut(window.firebase.auth);
            this.expenses = [];
            this.recurringBills = [];
            this.currentUser = null;
            
            // Clear any stored data
            Object.values(this.charts).forEach(chart => {
                if (chart) chart.destroy();
            });
            this.charts = {};
            
            console.log('Logout successful');
            this.showNotification('Signed out successfully!', 'success');
        } catch (error) {
            console.error('Logout error:', error);
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
        if (activeItem) activeItem.classList.add('active');
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

    async addExpense() {
        if (!this.currentUser) return;
        
        const descriptionInput = document.getElementById('expense-description');
        const amountInput = document.getElementById('expense-amount');
        const categorySelect = document.getElementById('expense-category');
        const dateInput = document.getElementById('expense-date');
        const notesInput = document.getElementById('expense-notes');
        const btn = document.querySelector('#expense-form .primary-btn');
        
        if (!descriptionInput || !amountInput || !categorySelect || !dateInput) {
            this.showNotification('Expense form not found', 'error');
            return;
        }

        const description = descriptionInput.value.trim();
        const amount = parseFloat(amountInput.value);
        const category = categorySelect.value;
        const date = dateInput.value;
        const notes = notesInput ? notesInput.value.trim() : '';
        
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
        const expenseForm = document.getElementById('expense-form');
        if (expenseForm) {
            expenseForm.reset();
            this.setTodaysDate();
            
            // Reset labels
            document.querySelectorAll('#expense-form .input-group label').forEach(label => {
                label.style.transform = 'translateY(0) scale(1)';
                label.style.color = 'rgba(255, 255, 255, 0.6)';
            });
        }
    }

    setTodaysDate() {
        const dateInput = document.getElementById('expense-date');
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
            
            // Animate label
            const label = document.querySelector('label[for="expense-date"]');
            if (label) {
                label.style.transform = 'translateY(-40px) scale(0.85)';
                label.style.color = '#4facfe';
            }
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
        
        // Update dashboard elements
        const elements = {
            'total-spending': totalSpent.toLocaleString(),
            'total-budget': budget.toLocaleString(),
            'remaining-budget': remaining.toLocaleString(),
            'today-spending': todayTotal.toLocaleString(),
            'today-transactions': todayExpenses.length,
            'daily-average': dailyAverage.toFixed(0),
            'days-left': daysLeft
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
        
        // Update progress bar
        const progressBar = document.getElementById('spending-progress');
        if (progressBar) {
            progressBar.style.width = `${progressPercentage}%`;
        }
        
        this.displayRecentActivity();
    }

    showEmptyDashboard() {
        const elements = {
            'total-spending': '0',
            'remaining-budget': this.currentPeriod.budget.toLocaleString(),
            'today-spending': '0',
            'today-transactions': '0',
            'daily-average': '0',
            'days-left': this.currentPeriod.duration
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });

        const progressBar = document.getElementById('spending-progress');
        if (progressBar) progressBar.style.width = '0%';
    }

    displayRecentActivity() {
        const container = document.getElementById('recent-activities');
        if (!container) return;

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
            const addBtn = container.querySelector('[data-section="add-expense"]');
            if (addBtn) {
                addBtn.addEventListener('click', () => {
                    this.showSection('add-expense');
                    this.setActiveNav(document.querySelector('[data-section="add-expense"]'));
                });
            }
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
        const searchInput = document.getElementById('search-expenses');
        const categoryFilter = document.getElementById('filter-category');
        const dateFromInput = document.getElementById('filter-date-from');
        const dateToInput = document.getElementById('filter-date-to');

        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const categoryFilter_value = categoryFilter ? categoryFilter.value : '';
        const dateFrom = dateFromInput ? dateFromInput.value : '';
        const dateTo = dateToInput ? dateToInput.value : '';
        
        let filteredExpenses = this.expenses.filter(expense => {
            const matchesSearch = expense.description.toLowerCase().includes(searchTerm) ||
                                expense.category.toLowerCase().includes(searchTerm);
            const matchesCategory = !categoryFilter_value || expense.category === categoryFilter_value;
            const matchesDateFrom = !dateFrom || expense.date >= dateFrom;
            const matchesDateTo = !dateTo || expense.date <= dateTo;
            
            return matchesSearch && matchesCategory && matchesDateFrom && matchesDateTo;
        });
        
        // Update summary
        const totalAmount = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        const averageAmount = filteredExpenses.length > 0 ? totalAmount / filteredExpenses.length : 0;
        
        const summaryElements = {
            'summary-total': `₹${totalAmount.toLocaleString()}`,
            'summary-count': filteredExpenses.length,
            'summary-average': `₹${averageAmount.toFixed(0)}`
        };

        Object.entries(summaryElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
        
        // Display expenses
        const container = document.getElementById('expenses-list');
        if (!container) return;
        
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

    // Placeholder methods for other functionality
    async loadRecurringBills() {
        // Implementation for loading recurring bills
    }

    async loadArchivedMonths() {
        // Implementation for loading archived months
    }

    showPeriodModal() {
        const modal = document.getElementById('period-modal');
        if (modal) modal.classList.add('show');
    }

    closePeriodModal() {
        const modal = document.getElementById('period-modal');
        if (modal) modal.classList.remove('show');
    }

    showResetModal() {
        const modal = document.getElementById('reset-modal');
        if (modal) modal.classList.add('show');
    }

    closeResetModal() {
        const modal = document.getElementById('reset-modal');
        if (modal) modal.classList.remove('show');
    }

    async savePeriodSettings() {
        // Implementation for saving period settings
    }

    async resetMonth() {
        // Implementation for resetting month
    }

    toggleBudgetEdit(show = null) {
        // Implementation for budget editing
    }

    async saveBudgetSettings() {
        // Implementation for saving budget settings
    }

    navigateMonth(direction) {
        const currentDate = new Date(this.currentMonth + '-01');
        currentDate.setMonth(currentDate.getMonth() + direction);
        
        this.currentMonth = currentDate.toISOString().substring(0, 7);
        this.updateCurrentMonthDisplay();
        this.loadExpenses();
    }

    updateCurrentMonthDisplay() {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        
        const [year, month] = this.currentMonth.split('-');
        const monthName = monthNames[parseInt(month) - 1];
        
        const display = document.getElementById('current-month-display');
        if (display) display.textContent = `${monthName} ${year}`;
    }

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

    async updateAnalytics() {
        // Placeholder for analytics implementation
    }

    async saveUserPreferences() {
        // Placeholder for user preferences implementation
    }

    showBillModal() {
        // Placeholder for bill modal
    }

    closeBillModal() {
        // Placeholder for closing bill modal
    }

    async saveBill() {
        // Placeholder for saving bill
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
        const textNodes = Array.from(syncElement.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
        
        switch (status) {
            case 'syncing':
                if (icon) icon.className = 'fas fa-sync-alt fa-spin';
                if (textNodes.length > 0) textNodes[0].textContent = ' Syncing...';
                break;
            case 'synced':
                if (icon) icon.className = 'fas fa-cloud-upload-alt';
                if (textNodes.length > 0) textNodes[0].textContent = ' Synced';
                break;
            case 'offline':
                if (icon) icon.className = 'fas fa-wifi-slash';
                if (textNodes.length > 0) textNodes[0].textContent = ' Offline';
                break;
        }
    }

    setButtonLoading(button, loading) {
        if (!button) return;
        
        if (loading) {
            button.classList.add('loading');
            button.disabled = true;
        } else {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    getFirebaseErrorMessage(error) {
        console.log('Firebase error code:', error.code);
        
        switch (error.code) {
            case 'auth/user-not-found':
                return 'No account found with this email address.';
            case 'auth/wrong-password':
                return 'Incorrect password. Please try again.';
            case 'auth/email-already-in-use':
                return 'An account with this email already exists.';
            case 'auth/weak-password':
                return 'Password should be at least 6 characters long.';
            case 'auth/invalid-email':
                return 'Please enter a valid email address.';
            case 'auth/user-disabled':
                return 'This account has been disabled.';
            case 'auth/invalid-credential':
                return 'Invalid email or password.';
            case 'auth/network-request-failed':
                return 'Network error. Please check your internet connection.';
            case 'auth/popup-closed-by-user':
                return 'Sign-in cancelled.';
            case 'auth/cancelled-popup-request':
                return 'Sign-in cancelled.';
            case 'auth/popup-blocked':
                return 'Popup blocked. Please allow popups for this site.';
            default:
                return error.message || 'An unexpected error occurred. Please try again.';
        }
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications');
        if (!container) return;
        
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
        }, 4000);
    }
}

// Add CSS for fadeOut animation and loading states
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
    
    .auth-btn.loading,
    .premium-btn.loading {
        pointer-events: none;
        opacity: 0.8;
    }
    
    .auth-btn.loading span,
    .premium-btn.loading span {
        opacity: 0;
    }
    
    .auth-btn.loading::after,
    .premium-btn.loading::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 24px;
        height: 24px;
        border: 3px solid transparent;
        border-top: 3px solid currentColor;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        0% { transform: translate(-50%, -50%) rotate(0deg); }
        100% { transform: translate(-50%, -50%) rotate(360deg); }
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
