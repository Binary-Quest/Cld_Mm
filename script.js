class StudySpendPro {
    constructor() {
        this.currentUser = null;
        this.expenses = [];
        this.unsubscribeExpenses = null;
        this.isOnline = navigator.onLine;
        
        this.init();
    }

    init() {
        this.showSplashScreen();
        this.setupEventListeners();
        this.setupAuthStateListener();
        
        // Online/offline detection
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateSyncStatus('synced');
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.updateSyncStatus('offline');
        });
    }

    showSplashScreen() {
        // Show splash for 3 seconds then transition to auth
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
            // Fallback if Firebase not loaded
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
                if (!document.getElementById('auth-screen').classList.contains('hidden')) {
                    // Already showing auth screen
                    return;
                }
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
        
        this.loadUserExpenses();
        this.updateDashboard();
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
                        currency: 'INR'
                    }
                });
            }
            
            // Update UI
            document.getElementById('user-name').textContent = 
                this.currentUser.displayName || this.currentUser.email.split('@')[0];
            document.getElementById('user-email').value = this.currentUser.email;
            document.getElementById('user-display-name').value = this.currentUser.displayName || '';
            
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
            });
        });

        // Export data
        document.getElementById('export-data').addEventListener('click', () => {
            this.exportExpenses();
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

        if (sectionId === 'dashboard') {
            this.updateDashboard();
        } else if (sectionId === 'history') {
            this.displayExpenseHistory();
        }
    }

    setActiveNav(activeItem) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        activeItem.classList.add('active');
    }

    loadUserExpenses() {
        if (!this.currentUser) return;
        
        if (this.unsubscribeExpenses) {
            this.unsubscribeExpenses();
        }
        
        const expensesRef = window.firebase.collection(window.firebase.db, 'users', this.currentUser.uid, 'expenses');
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
            
            const expensesRef = window.firebase.collection(window.firebase.db, 'users', this.currentUser.uid, 'expenses');
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
    }

    setTodaysDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('expense-date').value = today;
    }

    updateDashboard() {
        if (!this.expenses.length) {
            this.showEmptyDashboard();
            return;
        }
        
        const totalSpent = this.expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const budget = 10000;
        const remaining = Math.max(0, budget - totalSpent);
        const progressPercentage = Math.min((totalSpent / budget) * 100, 100);
        
        // Today's expenses
        const today = new Date().toISOString().split('T')[0];
        const todayExpenses = this.expenses.filter(expense => expense.date === today);
        const todayTotal = todayExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        
        // This week's expenses
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekExpenses = this.expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate >= weekStart;
        });
        const weekTotal = weekExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        const dailyAvg = weekExpenses.length > 0 ? weekTotal / 7 : 0;
        
        // Update dashboard
        document.getElementById('total-spending').textContent = totalSpent.toFixed(0);
        document.getElementById('total-budget').textContent = budget.toFixed(0);
        document.getElementById('remaining-budget').textContent = remaining.toFixed(0);
        document.getElementById('today-spending').textContent = todayTotal.toFixed(0);
        document.getElementById('today-transactions').textContent = todayExpenses.length;
        document.getElementById('week-spending').textContent = weekTotal.toFixed(0);
        document.getElementById('daily-avg').textContent = dailyAvg.toFixed(0);
        
        // Update progress bar
        const progressBar = document.getElementById('spending-progress');
        progressBar.style.width = `${progressPercentage}%`;
        
        // Calculate days left (assuming 30-day period)
        const periodStart = new Date();
        periodStart.setDate(1); // First day of month
        const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0);
        const today_date = new Date();
        const daysLeft = Math.max(0, Math.ceil((periodEnd - today_date) / (1000 * 60 * 60 * 24)));
        document.getElementById('days-left').textContent = daysLeft;
        
        this.displayRecentActivity();
    }

    showEmptyDashboard() {
        document.getElementById('total-spending').textContent = '0';
        document.getElementById('remaining-budget').textContent = '10,000';
        document.getElementById('today-spending').textContent = '0';
        document.getElementById('today-transactions').textContent = '0';
        document.getElementById('week-spending').textContent = '0';
        document.getElementById('daily-avg').textContent = '0';
        document.getElementById('spending-progress').style.width = '0%';
        document.getElementById('days-left').textContent = '30';
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
                <div style="font-weight: 700; font-size: 1.1rem;">₹${expense.amount.toFixed(0)}</div>
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
        
        document.getElementById('summary-total').textContent = `₹${totalAmount.toFixed(0)}`;
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
                <div style="font-weight: 700; font-size: 1.2rem;">₹${expense.amount.toFixed(0)}</div>
            </div>
        `).join('');
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
        a.download = `studyspend-expenses-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        this.showNotification('Expenses exported successfully!', 'success');
    }

    convertToCSV(data) {
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(row => Object.values(row).map(value => `"${value}"`).join(','));
        return [headers, ...rows].join('\n');
    }

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
        const text = syncElement.childNodes[1];
        
        switch (status) {
            case 'syncing':
                icon.className = 'fas fa-sync-alt fa-spin';
                text.textContent = ' Syncing...';
                break;
            case 'synced':
                icon.className = 'fas fa-cloud-upload-alt';
                text.textContent = ' Synced';
                break;
            case 'offline':
                icon.className = 'fas fa-wifi-slash';
                text.textContent = ' Offline';
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
