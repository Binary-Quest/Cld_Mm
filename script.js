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
        this.authInitialized = false;
        
        console.log('🚀 StudySpendPro initialized');
        this.init();
    }

    init() {
        console.log('📱 Starting app initialization...');
        this.showSplashScreen();
        this.setupEventListeners();
        this.waitForFirebaseAndSetupAuth();
        this.setupIdleTimer();
        
        // Online/offline detection
        window.addEventListener('online', () => this.updateSyncStatus('synced'));
        window.addEventListener('offline', () => this.updateSyncStatus('offline'));
    }

    showSplashScreen() {
        console.log('✨ Showing splash screen');
        setTimeout(() => {
            console.log('⏰ Transitioning to auth...');
            this.transitionToAuth();
        }, 3000);
    }

    transitionToAuth() {
        console.log('🔄 Transitioning from splash to auth...');
        
        const splash = document.getElementById('splash-screen');
        const authScreen = document.getElementById('auth-screen');
        
        if (!splash || !authScreen) {
            console.error('❌ Required elements not found');
            alert('Error: Missing HTML elements. Check your index.html file.');
            return;
        }
        
        splash.style.animation = 'fadeOut 0.8s ease-out forwards';
        
        setTimeout(() => {
            splash.classList.add('hidden');
            authScreen.classList.remove('hidden');
            console.log('✅ Auth screen shown');
        }, 800);
    }

    waitForFirebaseAndSetupAuth() {
        console.log('🔥 Checking for Firebase...');
        
        if (typeof firebase === 'undefined' || !firebase.auth) {
            console.log('⏳ Firebase not ready, retrying in 1 second...');
            setTimeout(() => this.waitForFirebaseAndSetupAuth(), 1000);
            return;
        }
        
        console.log('✅ Firebase detected, setting up auth...');
        this.setupAuthListener();
    }

    setupAuthListener() {
        console.log('👂 Setting up Firebase auth listener...');
        
        try {
            firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
                .then(() => {
                    console.log('✅ Auth persistence set to LOCAL');
                    
                    firebase.auth().onAuthStateChanged((user) => {
                        console.log('🔄 Auth state changed:', user ? `User: ${user.email}` : 'No user');
                        
                        this.authInitialized = true;
                        
                        if (user) {
                            this.currentUser = user;
                            this.setupUserProfile().then(() => {
                                this.showMainApp();
                                this.resetIdleTimer();
                                if (!this.hasShownWelcome) {
                                    this.showNotification(`Welcome back, ${user.displayName || user.email}!`, 'success');
                                    this.hasShownWelcome = true;
                                }
                            });
                        } else {
                            this.currentUser = null;
                            this.clearIdleTimer();
                            this.hasShownWelcome = false;
                            console.log('👤 No user logged in');
                        }
                    });
                })
                .catch((error) => {
                    console.error('❌ Error setting auth persistence:', error);
                    this.showNotification('Error setting up authentication', 'error');
                });
                
        } catch (error) {
            console.error('❌ Critical error setting up auth:', error);
            this.showNotification('Failed to initialize Firebase Auth', 'error');
        }
    }

    // AUTO LOGOUT FUNCTIONALITY
    setupIdleTimer() {
        const resetTimer = () => {
            this.lastActivity = Date.now();
            this.resetIdleTimer();
        };

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
            console.log('⏰ User idle timeout - logging out');
            this.showNotification('You have been automatically logged out due to inactivity', 'warning');
            await this.logout();
        }
    }

    showMainApp() {
        console.log('🏠 Showing main app...');
        
        const splash = document.getElementById('splash-screen');
        const authScreen = document.getElementById('auth-screen');
        const mainApp = document.getElementById('main-app');
        
        if (splash) splash.classList.add('hidden');
        if (authScreen) authScreen.classList.add('hidden');
        if (mainApp) mainApp.classList.remove('hidden');
        
        this.loadUserData();
        this.updateDashboard();
        this.updateCurrentMonthDisplay();
        console.log('✅ Main app displayed');
    }

    async setupUserProfile() {
        if (!this.currentUser) return;
        
        try {
            const userDocRef = firebase.firestore().collection('users').doc(this.currentUser.uid);
            const userDoc = await userDocRef.get();
            
            if (!userDoc.exists) {
                await userDocRef.set({
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
            const userNameEl = document.getElementById('user-name');
            if (userNameEl) {
                userNameEl.textContent = this.currentUser.displayName || this.currentUser.email.split('@')[0];
            }
            
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

            setTimeout(() => this.fixInputLabels(), 100);
        } catch (error) {
            console.error('Error setting up user profile:', error);
            this.showNotification('Error loading user profile', 'error');
        }
    }

    // FIXED EVENT LISTENERS WITH PROPER BUTTON BINDING
    setupEventListeners() {
        console.log('🎧 Setting up event listeners...');
        
        // Auth tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchAuthTab(tab);
            });
        });

        // ENHANCED LOGIN FORM BINDING - Multiple methods to ensure it works
        const loginForm = document.getElementById('login-form');
        const loginBtn = document.getElementById('login-btn');
        
        // Method 1: Form submit event
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('🔐 Login form submitted');
                this.handleLogin();
            });
            console.log('✅ Login form event bound');
        } else {
            console.error('❌ Login form not found');
        }
        
        // Method 2: Button click event (backup)
        if (loginBtn) {
            loginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🔐 Login button clicked');
                this.handleLogin();
            });
            console.log('✅ Login button event bound');
        } else {
            console.error('❌ Login button not found');
        }

        // Register form - same dual binding approach
        const registerForm = document.getElementById('register-form');
        const registerBtn = document.getElementById('register-btn');
        
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('📝 Register form submitted');
                this.handleRegister();
            });
        }
        
        if (registerBtn) {
            registerBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('📝 Register button clicked');
                this.handleRegister();
            });
        }

        // Google login
        const googleBtn = document.getElementById('google-login');
        if (googleBtn) {
            googleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🔍 Google login clicked');
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
                    this.fixInputLabels();
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

        if (searchExpenses) searchExpenses.addEventListener('input', () => this.filterExpenses());
        if (filterCategory) filterCategory.addEventListener('change', () => this.filterExpenses());

        // Analytics
        const analyticsPeriod = document.getElementById('analytics-period');
        if (analyticsPeriod) analyticsPeriod.addEventListener('change', () => this.updateAnalytics());

        // View all buttons
        document.querySelectorAll('.view-all-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const section = btn.dataset.section;
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
        setTimeout(() => this.fixInputLabels(), 100);
        
        console.log('✅ Event listeners setup complete');
    }

    // ENHANCED INPUT LABEL FIXING
    fixInputLabels() {
        document.querySelectorAll('.input-group').forEach(group => {
            const input = group.querySelector('input, select, textarea');
            const label = group.querySelector('label');
            
            if (!input || !label) return;

            const updateLabel = () => {
                const hasValue = input.value && input.value !== '';
                const isFocused = document.activeElement === input;
                
                if (hasValue || isFocused) {
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

            updateLabel();
            input.addEventListener('focus', updateLabel);
            input.addEventListener('blur', updateLabel);
            input.addEventListener('input', updateLabel);
        });
    }

    switchAuthTab(tab) {
        console.log('📑 Switching to tab:', tab);
        
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
        
        const tabBtn = document.querySelector(`[data-tab="${tab}"]`);
        const form = document.getElementById(`${tab}-form`);
        
        if (tabBtn) tabBtn.classList.add('active');
        if (form) form.classList.add('active');

        setTimeout(() => this.fixInputLabels(), 100);
    }

    // ENHANCED LOGIN HANDLER WITH COMPREHENSIVE ERROR HANDLING
    async handleLogin() {
        console.log('🔐 handleLogin() called');
        
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const loginBtn = document.getElementById('login-btn');
        
        console.log('🔍 Elements check:', {
            emailInput: !!emailInput,
            passwordInput: !!passwordInput,
            loginBtn: !!loginBtn
        });
        
        if (!emailInput || !passwordInput) {
            console.error('❌ Login inputs not found');
            this.showNotification('Login form elements not found', 'error');
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        console.log('📧 Email:', email);
        console.log('🔒 Password length:', password.length);
        
        if (!email || !password) {
            console.warn('⚠️ Missing email or password');
            this.showNotification('Please enter both email and password', 'error');
            return;
        }
        
        try {
            this.setButtonLoading(loginBtn, true);
            console.log('🔑 Attempting Firebase login...');
            
            // Check if Firebase is available
            if (typeof firebase === 'undefined') {
                throw new Error('Firebase not loaded');
            }
            
            if (!firebase.auth) {
                throw new Error('Firebase Auth not available');
            }
            
            await firebase.auth().signInWithEmailAndPassword(email, password);
            console.log('✅ Login successful');
            
            // Clear form
            emailInput.value = '';
            passwordInput.value = '';
            this.fixInputLabels();
            
        } catch (error) {
            console.error('❌ Login error:', error);
            this.showNotification(this.getFirebaseErrorMessage(error), 'error');
        } finally {
            this.setButtonLoading(loginBtn, false);
        }
    }

    // ENHANCED REGISTER HANDLER
    async handleRegister() {
        console.log('📝 Handling registration...');
        
        const nameInput = document.getElementById('register-name');
        const emailInput = document.getElementById('register-email');
        const passwordInput = document.getElementById('register-password');
        const confirmInput = document.getElementById('register-confirm');
        const btn = document.getElementById('register-btn');
        
        if (!nameInput || !emailInput || !passwordInput || !confirmInput) {
            console.error('❌ Register inputs not found');
            this.showNotification('Registration form elements not found', 'error');
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
            console.log('📋 Creating account for:', email);
            
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            
            await userCredential.user.updateProfile({
                displayName: name
            });
            
            console.log('✅ Registration successful');
            this.showNotification('Account created successfully!', 'success');
            
            // Clear form
            nameInput.value = '';
            emailInput.value = '';
            passwordInput.value = '';
            confirmInput.value = '';
            this.fixInputLabels();
            
        } catch (error) {
            console.error('❌ Registration error:', error);
            this.showNotification(this.getFirebaseErrorMessage(error), 'error');
        } finally {
            this.setButtonLoading(btn, false);
        }
    }

    // ENHANCED GOOGLE LOGIN HANDLER
    async handleGoogleLogin() {
        console.log('🔍 Handling Google login...');
        
        const btn = document.getElementById('google-login');
        
        try {
            this.setButtonLoading(btn, true);
            
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('email');
            provider.addScope('profile');
            
            await firebase.auth().signInWithPopup(provider);
            
            console.log('✅ Google login successful');
            
        } catch (error) {
            console.error('❌ Google login error:', error);
            if (error.code !== 'auth/popup-closed-by-user' && 
                error.code !== 'auth/cancelled-popup-request') {
                this.showNotification(this.getFirebaseErrorMessage(error), 'error');
            }
        } finally {
            this.setButtonLoading(btn, false);
        }
    }

    async logout() {
        console.log('🚪 Logging out user');
        
        try {
            if (this.unsubscribeExpenses) {
                this.unsubscribeExpenses();
                this.unsubscribeExpenses = null;
            }
            
            this.clearIdleTimer();
            
            this.expenses = [];
            this.recurringBills = [];
            this.currentUser = null;
            
            Object.values(this.charts).forEach(chart => {
                if (chart && typeof chart.destroy === 'function') {
                    chart.destroy();
                }
            });
            this.charts = {};
            
            await firebase.auth().signOut();
            
            console.log('✅ Logout successful');
            this.showNotification('Signed out successfully!', 'success');
            
        } catch (error) {
            console.error('❌ Logout error:', error);
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
        
        this.loadExpenses();
        this.loadRecurringBills();
        this.loadArchivedMonths();
    }

    loadExpenses() {
        if (!this.currentUser) return;
        
        if (this.unsubscribeExpenses) {
            this.unsubscribeExpenses();
        }
        
        const expensesRef = firebase.firestore()
            .collection('users')
            .doc(this.currentUser.uid)
            .collection('months')
            .doc(this.currentMonth)
            .collection('expenses');
        
        const q = expensesRef.orderBy('timestamp', 'desc');
        
        this.updateSyncStatus('syncing');
        
        this.unsubscribeExpenses = q.onSnapshot((snapshot) => {
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
            
            const expensesRef = firebase.firestore()
                .collection('users')
                .doc(this.currentUser.uid)
                .collection('months')
                .doc(this.currentMonth)
                .collection('expenses');
            
            await expensesRef.add(expenseData);
            
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
        
        const today = new Date().toISOString().split('T')[0];
        const todayExpenses = this.expenses.filter(expense => expense.date === today);
        const todayTotal = todayExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        
        const periodStart = new Date(this.currentPeriod.startDate);
        const periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + this.currentPeriod.duration);
        
        const today_date = new Date();
        const daysLeft = Math.max(0, Math.ceil((periodEnd - today_date) / (1000 * 60 * 60 * 24)));
        
        const daysElapsed = Math.max(1, Math.ceil((today_date - periodStart) / (1000 * 60 * 60 * 24)));
        const dailyAverage = totalSpent / daysElapsed;
        
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

        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const categoryFilter_value = categoryFilter ? categoryFilter.value : '';
        
        let filteredExpenses = this.expenses.filter(expense => {
            const matchesSearch = expense.description.toLowerCase().includes(searchTerm) ||
                                expense.category.toLowerCase().includes(searchTerm);
            const matchesCategory = !categoryFilter_value || expense.category === categoryFilter_value;
            
            return matchesSearch && matchesCategory;
        });
        
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
            const expensesRef = firebase.firestore()
                .collection('users')
                .doc(this.currentUser.uid)
                .collection('months')
                .doc(this.currentMonth)
                .collection('expenses');
            
            const snapshot = await expensesRef.get();
            const batch = firebase.firestore().batch();
            
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            
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
            button.style.opacity = '0.7';
            
            // Store original content
            if (!button.dataset.originalContent) {
                button.dataset.originalContent = button.innerHTML;
            }
            
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        } else {
            button.classList.remove('loading');
            button.disabled = false;
            button.style.opacity = '1';
            
            // Restore original content
            if (button.dataset.originalContent) {
                button.innerHTML = button.dataset.originalContent;
            }
        }
    }

    getFirebaseErrorMessage(error) {
        console.log('🔍 Firebase error code:', error.code);
        
        const errorMessages = {
            'auth/user-not-found': 'No account found with this email address.',
            'auth/wrong-password': 'Incorrect password. Please try again.',
            'auth/email-already-in-use': 'An account with this email already exists.',
            'auth/weak-password': 'Password should be at least 6 characters long.',
            'auth/invalid-email': 'Please enter a valid email address.',
            'auth/user-disabled': 'This account has been disabled.',
            'auth/invalid-credential': 'Invalid email or password.',
            'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
            'auth/network-request-failed': 'Network error. Please check your internet connection.',
            'auth/popup-closed-by-user': 'Sign-in cancelled.',
            'auth/cancelled-popup-request': 'Sign-in cancelled.',
            'auth/popup-blocked': 'Popup blocked. Please allow popups for this site.',
            'auth/internal-error': 'Internal error. Please try again.',
            'auth/invalid-api-key': 'Invalid Firebase configuration.',
            'auth/app-deleted': 'Firebase app has been deleted.'
        };
        
        return errorMessages[error.code] || error.message || 'An unexpected error occurred. Please try again.';
    }

    showNotification(message, type = 'info') {
        console.log(`📢 ${type.toUpperCase()}: ${message}`);
        
        const container = document.getElementById('notifications') || document.body;
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#ff6b6b' : type === 'success' ? '#51cf66' : type === 'warning' ? '#ffa726' : '#339af0'};
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            max-width: 350px;
            font-family: 'Inter', sans-serif;
        `;
        notification.textContent = message;
        
        container.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 4000);
    }
}

// Add essential CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    
    .hidden { 
        display: none !important; 
    }
    
    .fa-spinner {
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .auth-btn.loading,
    .premium-btn.loading {
        pointer-events: none !important;
        opacity: 0.8 !important;
        cursor: not-allowed !important;
    }
`;
document.head.appendChild(style);

// Initialize app with comprehensive error handling
console.log('🌟 Starting StudySpend Pro...');

document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM Content Loaded');
    
    // Check if required elements exist
    const requiredElements = ['splash-screen', 'auth-screen', 'main-app'];
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    
    if (missingElements.length > 0) {
        console.error('❌ Missing HTML elements:', missingElements);
        alert(`Missing required HTML elements: ${missingElements.join(', ')}\n\nPlease check your index.html file.`);
        return;
    }
    
    setTimeout(() => {
        try {
            window.app = new StudySpendPro();
            console.log('✅ App initialized successfully');
        } catch (error) {
            console.error('❌ App initialization failed:', error);
            alert('App failed to initialize. Check console for details.');
        }
    }, 500);
});

// Global error handlers
window.addEventListener('error', (event) => {
    console.error('🚨 Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 Unhandled promise rejection:', event.reason);
});

console.log('✅ Script file loaded completely');
