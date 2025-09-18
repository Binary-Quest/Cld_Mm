class StudySpendPro {
    constructor() {
        this.expenses = JSON.parse(localStorage.getItem('expenses')) || [];
        this.budget = JSON.parse(localStorage.getItem('budget')) || 10000;
        this.recurringBills = JSON.parse(localStorage.getItem('recurringBills')) || [];
        
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupEventListeners();
        this.updateDashboard();
        this.setTodayDate();
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const pages = document.querySelectorAll('.page');

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const targetPage = item.dataset.page;
                
                // Update active nav item
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                // Show target page
                pages.forEach(page => page.classList.remove('active'));
                document.getElementById(targetPage).classList.add('active');
            });
        });
    }

    setupEventListeners() {
        // Expense form
        document.getElementById('expenseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addExpense();
        });

        // Smart reminders
        document.getElementById('smartReminders').addEventListener('click', () => {
            this.showNotification('Smart reminders activated! You\'ll get daily notifications at 9:30 PM.');
        });

        // New period
        document.getElementById('newPeriod').addEventListener('click', () => {
            this.startNewPeriod();
        });

        // Update budget
        document.getElementById('updateBudget').addEventListener('click', () => {
            this.updateBudget();
        });

        // Add recurring bill
        document.getElementById('addRecurring').addEventListener('click', () => {
            this.addRecurringBill();
        });
    }

    addExpense() {
        const amount = parseFloat(document.getElementById('expenseAmount').value);
        const category = document.getElementById('expenseCategory').value;
        const description = document.getElementById('expenseDescription').value;
        const date = document.getElementById('expenseDate').value;

        const expense = {
            id: Date.now(),
            amount,
            category,
            description,
            date,
            timestamp: new Date().toLocaleString()
        };

        this.expenses.push(expense);
        this.saveExpenses();
        this.updateDashboard();
        this.showNotification(`Expense of ₹${amount} added successfully!`);
        
        // Reset form
        document.getElementById('expenseForm').reset();
        this.setTodayDate();
    }

    updateDashboard() {
        const totalSpent = this.expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const remaining = this.budget - totalSpent;
        const progressPercentage = (totalSpent / this.budget) * 100;

        document.getElementById('currentSpending').textContent = totalSpent.toFixed(0);
        document.getElementById('totalBudget').textContent = this.budget;
        document.getElementById('remainingBudget').textContent = remaining.toFixed(0);
        document.getElementById('budgetProgress').style.width = `${Math.min(progressPercentage, 100)}%`;

        this.updateRecentExpenses();
        this.updateTopCategories();
    }

    updateRecentExpenses() {
        const container = document.getElementById('recentExpenses');
        const recent = this.expenses.slice(-5).reverse();

        if (recent.length === 0) {
            container.innerHTML = '<p class="no-data">No expenses added yet</p>';
            return;
        }

        container.innerHTML = recent.map(expense => `
            <div class="expense-item">
                <div>
                    <strong>₹${expense.amount}</strong>
                    <div style="font-size: 0.9rem; opacity: 0.8;">${expense.category} - ${expense.date}</div>
                </div>
            </div>
        `).join('');
    }

    updateTopCategories() {
        const container = document.getElementById('topCategories');
        const categoryTotals = {};

        this.expenses.forEach(expense => {
            categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
        });

        const sortedCategories = Object.entries(categoryTotals)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);

        if (sortedCategories.length === 0) {
            container.innerHTML = '<p class="no-data">No categories data</p>';
            return;
        }

        container.innerHTML = sortedCategories.map(([category, amount]) => `
            <div class="category-item">
                <span>${category}</span>
                <strong>₹${amount.toFixed(0)}</strong>
            </div>
        `).join('');
    }

    startNewPeriod() {
        if (confirm('Start a new spending period? This will archive current expenses.')) {
            const archiveData = {
                expenses: this.expenses,
                period: new Date().toLocaleDateString(),
                total: this.expenses.reduce((sum, expense) => sum + expense.amount, 0)
            };
            
            // Save to archive (you can expand this)
            const archives = JSON.parse(localStorage.getItem('archives')) || [];
            archives.push(archiveData);
            localStorage.setItem('archives', JSON.stringify(archives));
            
            // Reset expenses
            this.expenses = [];
            this.saveExpenses();
            this.updateDashboard();
            this.showNotification('New period started! Previous expenses archived.');
        }
    }

    updateBudget() {
        const newBudget = parseFloat(document.getElementById('monthlyBudget').value);
        this.budget = newBudget;
        localStorage.setItem('budget', JSON.stringify(this.budget));
        this.updateDashboard();
        this.showNotification(`Budget updated to ₹${newBudget}`);
    }

    addRecurringBill() {
        const name = prompt('Enter bill name:');
        const amount = parseFloat(prompt('Enter amount:'));
        
        if (name && amount) {
            const bill = {
                id: Date.now(),
                name,
                amount,
                nextDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()
            };
            
            this.recurringBills.push(bill);
            localStorage.setItem('recurringBills', JSON.stringify(this.recurringBills));
            this.updateRecurringBills();
            this.showNotification(`Recurring bill "${name}" added!`);
        }
    }

    updateRecurringBills() {
        const container = document.getElementById('recurringList');
        
        if (this.recurringBills.length === 0) {
            container.innerHTML = '<p class="no-data">No recurring bills added</p>';
            return;
        }

        container.innerHTML = this.recurringBills.map(bill => `
            <div class="card">
                <h4>${bill.name}</h4>
                <p>Amount: ₹${bill.amount}</p>
                <p>Next Due: ${bill.nextDue}</p>
            </div>
        `).join('');
    }

    setTodayDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('expenseDate').value = today;
    }

    saveExpenses() {
        localStorage.setItem('expenses', JSON.stringify(this.expenses));
    }

    showNotification(message) {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new StudySpendPro();
});
