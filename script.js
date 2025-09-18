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
        
        // Auto logout timer - 30 minutes
        this.idleTimer = null;
        this.lastActivity = Date.now();
        this.IDLE_TIMEOUT = 30 * 60 * 1000;
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

            // Fix input labels after setting values
            setTimeout(() => this.fixInputLabels(), 100);
        } catch (error) {
            console.error('Error setting up user profile:', error);
            this.showNotification('Error loading user profile', 'error');
        }
    }

    setupEventListeners() {
        console.log('🎧 Setting up event listeners...');
        
        // Auth tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchAuthTab(tab);
            });
        });

        // Auth forms
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

        // Modal handlers
        this.setupModalHandlers();

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
    }

    // Fix input labels positioning issue - ENHANCED
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

            // Initial update
            updateLabel();

            // Event listeners
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

    // FIXED LOGIN HANDLING
    async handleLogin() {
        console.log('🔐 Handling login...');
        
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const btn = document.getElementById('login-btn');
        
        if (!emailInput || !passwordInput) {
            console.error('❌ Login inputs not found');
            this.showNotification('Login form elements not found', 'error');
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
            console.log('🔑 Attempting login for:', email);
            
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
            this.setButtonLoading(btn, false);
        }
    }

    // FIXED REGISTER HANDLING
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

    // FIXED GOOGLE LOGIN HANDLING
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
