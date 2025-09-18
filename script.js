class StudySpendPro {
    constructor() {
        this.currentUser = null;
        this.expenses = [];
        this.unsubscribeExpenses = null;
        this.isOnline = navigator.onLine;
        
        // Wait for Firebase to be available
        this.waitForFirebase().then(() => {
            this.init();
        });
    }

    async waitForFirebase() {
        let attempts = 0;
        while (!window.firebase && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!window.firebase) {
            throw new Error('Firebase not loaded');
        }
    }

    init() {
        this.setupEventListeners();
        this.setupAuthStateListener();
        this.showLoadingScreen();
        
        // Check online status
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateSyncStatus('synced');
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.updateSyncStatus('offline');
        });
    }

    showLoadingScreen() {
        document.getElementById('loading-screen').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'none';
    }

    hideLoadingScreen() {
        document.getElementById('loading-screen').style.display = 'none';
    }

    showLoginScreen() {
        this.hideLoadingScreen();
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }

    showMainApp() {
        this.hideLoadingScreen();
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';
        this.loadUserExpenses();
        this.updateDashboard();
    }

    setupAuthStateListener() {
        window.firebase.onAuthStateChanged(window.firebaseAuth, async (user) => {
            if (user) {
                this.currentUser = user;
                await this.setupUserProfile();
                this.showMainApp();
                this.showNotification(`Welcome back, ${user.displayName || user.email}!`, 'success');
            } else {
                this.currentUser = null;
                this.showLoginScreen();
            }
        });
    }

    async setupUserProfile() {
        if (!this.currentUser) return;
        
        const userDocRef = window.firebase.doc(window.firebaseDB, 'users', this.currentUser.uid);
        const userDoc = await window.firebase.getDoc(userDocRef);
        
        if (!userDoc.exists()) {
            // Create user profile
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
        document.getElementById('current-username').textContent = 
            this.currentUser.displayName || this.currentUser.email.split('@')[0];
        document.getElementById('user-email').value = this.currentUser.email;
        document.getElementById('user-name').value = this.currentUser.displayName || '';
        
        // Set user avatar if available
        if (this.currentUser.photoURL) {
            const avatarImg = document.getElementById('user-avatar');
            const avatarIcon = document.getElementById('user-icon');
            avatarImg.src = this.currentUser.photoURL;
            avatarImg.style.display = 'block';
            avatarIcon.style.display = 'none';
        }
    }

    setupEventListeners() {
        // Tab switching
        window.switchTab = (tab) => {
            const loginForm = document.getElementById('login-form');
            const registerForm = document.getElementById('register-form');
            const tabBtns = document.querySelectorAll('.tab-btn');
            
            tabBtns.forEach(btn => btn.classList.remove('active'));
            document.querySelector(`[onclick="switchTab('${tab}')"]`).classList.add('active');
            
            if (tab === 'login') {
                loginForm.classList.add('active');
                registerForm.classList.remove('active');
            } else {
                loginForm.classList.remove('active');
                registerForm.classList.add('active');
            }
        };

        // Login form
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin();
        });

        // Register form
        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleRegister();
        });

        // Google login
        document.getElementById('google-login').addEventListener('click', async () => {
            await this.handleGoogleLogin();
        });

        // Navigation
        this.setupNavigation();

        // Expense form
        document.getElementById('expense-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.addExpense();
        });

        // Quick amount buttons
        document.querySelectorAll('.quick-amount-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('expense-amount').value = btn.dataset.amount;
            });
        });

        // Clear form
        document.getElementById('clear-form').addEventListener('click', () => {
            this.clearExpenseForm();
        });

        // Export data
        document.getElementById('export-data').addEventListener('click', () => {
            this.exportExpenses();
        });

        // Sync now button
        document.getElementById('sync-now').addEventListener('click', () => {
            this.showNotification('Data is automatically synced in real-time!', 'info');
        });

        // Search and filters
        document.getElementById('history-search').addEventListener('input', (e) => {
            this.filterExpenses();
        });

        document.getElementById('history-category-filter').addEventListener('change', () => {
            this.filterExpenses();
        });

        document.getElementById('history-date-from').addEventListener('change', () => {
            this.filterExpenses();
        });

        document.getElementById('history-date-to').addEventListener('change', () => {
            this.filterExpenses();
        });

        // Set today's date
        this.setTodaysDate();
    }

    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                this.showSection(section);
                
                // Update active nav
                navLinks.forEach(nav => nav.classList.remove('active'));
                link.classList.add('active');
                
                // Update URL
                window.history.pushState(null, null, `#${section}`);
            });
        });

        // Handle logo click
        document.querySelector('.logo-container').addEventListener('click', () => {
            this.showSection('dashboard');
            navLinks.forEach(nav => nav.classList.remove('active'));
            document.querySelector('[data-section="dashboard"]').classList.add('active');
        });

        // Handle initial hash
        const hash = window.location.hash.slice(1);
        if (hash) {
            this.showSection(hash);
            const targetNav = document.querySelector(`[data-section="${hash}"]`);
            if (targetNav) {
                navLinks.forEach(nav => nav.classList.remove('active'));
                targetNav.classList.add('active');
            }
        }
    }

    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Show target section
        const targetSection = document.getElementById(sectionName);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Update dashboard when showing dashboard
        if (sectionName === 'dashboard') {
            this.updateDashboard();
        }
    }

    async handleLogin() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const loginBtn = document.querySelector('#login-form .auth-btn');
        
        try {
            loginBtn.classList.add('loading');
            await window.firebase.signInWithEmailAndPassword(window.firebaseAuth, email, password);
        } catch (error) {
            this.showNotification(this.getFirebaseErrorMessage(error), 'error');
        } finally {
            loginBtn.classList.remove('loading');
        }
    }

    async handleRegister() {
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm').value;
        const registerBtn = document.querySelector('#register-form .auth-btn');
        
        if (password !== confirmPassword) {
            this.showNotification('Passwords do not match!', 'error');
            return;
        }

        if (password.length < 6) {
            this.showNotification('Password must be at least 6 characters!', 'error');
            return;
        }
        
        try {
            registerBtn.classList.add('loading');
            const userCredential = await window.firebase.createUserWithEmailAndPassword(window.firebaseAuth, email, password);
            
            // Update user profile
            await window.firebase.updateProfile(userCredential.user, {
                displayName: username
            });
            
            this.showNotification('Account created successfully!', 'success');
        } catch (error) {
            this.showNotification(this.getFirebaseErrorMessage(error), 'error');
        } finally {
            registerBtn.classList.remove('loading');
        }
    }

    async handleGoogleLogin() {
        const googleBtn = document.getElementById('google-login');
        
        try {
            googleBtn.classList.add('loading');
            const provider = new window.firebase.GoogleAuthProvider();
            await window.firebase.signInWithPopup(window.firebaseAuth, provider);
        } catch (error) {
            this.showNotification(this.getFirebaseErrorMessage(error), 'error');
        } finally {
            googleBtn.classList.remove('loading');
        }
    }

    async logout() {
        try {
            if (this.unsubscribeExpenses) {
                this.unsubscribeExpenses();
            }
            await window.firebase.signOut(window.firebaseAuth);
            this.expenses = [];
            this.showNotification('Signed out successfully!', 'success');
        } catch (error) {
            this.showNotification('Error signing out', 'error');
        }
    }

    loadUserExpenses() {
        if (!this.currentUser) return;
        
        // Unsubscribe from previous listener
        if (this.unsubscribeExpenses) {
            this.unsubscribeExpenses();
        }
        
        // Set up real-time listener for expenses
        const expensesRef = window.firebase.collection(window.firebaseDB, 'users', this.currentUser.uid, 'expenses');
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
        const addBtn = document.getElementById('add-expense-btn');
        
        if (!description || !amount || !category || !date) {
            this.showNotification('Please fill in all required fields!', 'error');
            return;
        }
        
        try {
            addBtn.classList.add('loading');
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
            
            const expensesRef = window.firebase.collection(window.firebaseDB, 'users', this.currentUser.uid, 'expenses');
            await window.firebase.addDoc(expensesRef, expenseData);
            
            this.clearExpenseForm();
            this.showNotification(`Expense of ₹${amount} added successfully!`, 'success');
            this.showSection('dashboard');
            
        } catch (error) {
            console.error('Error adding expense:', error);
            this.showNotification('Error adding expense. Please try again.', 'error');
        } finally {
            addBtn.classList.remove('loading');
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
        const budget = 10000; // You can make this dynamic later
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
        const dailyAvg = weekTotal / 7;
        
        // Update dashboard cards
        document.getElementById('current-total').textContent = totalSpent.toFixed(0);
        document.getElementById('current-limit').textContent = budget.toFixed(0);
        document.getElementById('remaining-amount').textContent = remaining.toFixed(0);
        document.getElementById('today-total').textContent = todayTotal.toFixed(0);
        document.getElementById('today-count').textContent = todayExpenses.length;
        document.getElementById('week-total').textContent = weekTotal.toFixed(0);
        document.getElementById('daily-avg').textContent = dailyAvg.toFixed(0);
        
        // Update progress bar
        const progressBar = document.getElementById('spending-progress');
        progressBar.style.width = `${progressPercentage}%`;
        
        this.displayRecentActivity();
    }

    showEmptyDashboard() {
        document.getElementById('current-total').textContent = '0';
        document.getElementById('remaining-amount').textContent = '10000';
        document.getElementById('today-total').textContent = '0';
        document.getElementById('today-count').textContent = '0';
        document.getElementById('week-total').textContent = '0';
        document.getElementById('daily-avg').textContent = '0';
        document.getElementById('spending-progress').style.width = '0%';
        
        document.getElementById('recent-activity-list').innerHTML = `
            <div class="no-activity">
                <i class="fas fa-receipt"></i>
                <p>No expenses added yet</p>
                <button class="premium-btn" onclick="app.showSection('add-expense')">Add First Expense</button>
            </div>
        `;
    }

    displayRecentActivity() {
        const recentExpenses = this.expenses.slice(0, 5);
        const container = document.getElementById('recent-activity-list');
        
        if (recentExpenses.length === 0) {
            this.showEmptyDashboard();
            return;
        }
        
        container.innerHTML = recentExpenses.map(expense => `
            <div class="expense-item">
                <div class="expense-item-left">
                    <div class="expense-item-title">${expense.description}</div>
                    <div class="expense-item-meta">
                        <span class="category-badge category-${expense.category}">${expense.category}</span>
                        <span>${this.formatDate(expense.date)}</span>
                    </div>
                </div>
                <div class="expense-item-amount">₹${expense.amount.toFixed(0)}</div>
            </div>
        `).join('');
    }

    displayExpenseHistory() {
        const container = document.getElementById('expenses-list');
        
        if (this.expenses.length === 0) {
            container.innerHTML = `
                <div class="no-activity">
                    <i class="fas fa-receipt"></i>
                    <h3>No expenses found</h3>
                    <p>Start adding expenses to see your history here</p>
                    <button class="premium-btn" onclick="app.showSection('add-expense')">Add First Expense</button>
                </div>
            `;
            return;
        }
        
        this.filterExpenses();
    }

    filterExpenses() {
        const searchTerm = document.getElementById('history-search').value.toLowerCase();
        const categoryFilter = document.getElementById('history-category-filter').value;
        const dateFrom = document.getElementById('history-date-from').value;
        const dateTo = document.getElementById('history-date-to').value;
        
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
        
        document.getElementById('filtered-total').textContent = `₹${totalAmount.toFixed(0)}`;
        document.getElementById('filtered-count').textContent = filteredExpenses.length;
        document.getElementById('filtered-average').textContent = `₹${averageAmount.toFixed(0)}`;
        
        // Display filtered expenses
        const container = document.getElementById('expenses-list');
        container.innerHTML = filteredExpenses.map(expense => `
            <div class="expense-item">
                <div class="expense-item-left">
                    <div class="expense-item-title">${expense.description}</div>
                    <div class="expense-item-meta">
                        <span class="category-badge category-${expense.category}">${expense.category}</span>
                        <span>${this.formatDate(expense.date)}</span>
                        ${expense.notes ? `<span>${expense.notes}</span>` : ''}
                    </div>
                </div>
                <div class="expense-item-amount">₹${expense.amount.toFixed(0)}</div>
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

    updateSyncStatus(status) {
        const syncElement = document.getElementById('sync-status');
        const syncIcon = syncElement.querySelector('i');
        const syncText = syncElement.querySelector('span');
        
        syncElement.className = `sync-status ${status}`;
        
        switch (status) {
            case 'syncing':
                syncIcon.className = 'fas fa-sync-alt fa-spin';
                syncText.textContent = 'Syncing...';
                break;
            case 'synced':
                syncIcon.className = 'fas fa-cloud-upload-alt';
                syncText.textContent = 'Synced';
                break;
            case 'offline':
                syncIcon.className = 'fas fa-wifi-slash';
                syncText.textContent = 'Offline';
                break;
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
        });
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
        const container = document.getElementById('notification-container');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        container.appendChild(notification);
        
        // Trigger animation
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Auto remove
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => container.removeChild(notification), 300);
        }, 3000);
    }
}

// Initialize app
let app;
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for Firebase to load
    setTimeout(() => {
        app = new StudySpendPro();
    }, 500);
});

// Make functions globally available
window.app = app;
