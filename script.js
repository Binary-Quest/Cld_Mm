class StudySpendPro {
    constructor() {
        this.currentUser = null;
        this.expenses = [];
        this.budget = 10000;
        this.recurringBills = [];
        this.currentPage = 1;
        this.rowsPerPage = 25;
        this.sortColumn = 'date';
        this.sortDirection = 'desc';
        
        this.init();
    }

    init() {
        this.checkAuthState();
        this.setupEventListeners();
        this.setupNavigation();
        this.setTodaysDate();
        this.loadUserData();
        this.updateDashboard();
        this.showNotification('Welcome to StudySpend Pro!', 'success');
    }

    // Authentication Methods
    checkAuthState() {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.showApp();
        } else {
            this.showLoginScreen();
        }
    }

    showLoginScreen() {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('welcome-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'none';
    }

    showApp() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('current-username').textContent = this.currentUser.username;
        document.getElementById('settings-username').value = this.currentUser.username;
        document.getElementById('settings-email').value = this.currentUser
