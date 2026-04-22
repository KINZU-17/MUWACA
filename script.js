// MUWACA Water Billing System - JavaScript with Backend API
// FIXED VERSION: duplicate IDs, script path, togglePaid, overdue logic, report rendering

const API_BASE = '/api';

// ── Auth ────────────────────────────────────────────────────────────────────
function checkLogin() {
    const token = localStorage.getItem('authToken');
    token ? showMainContent() : showLoginForm();
}
function showLoginForm() {
    document.getElementById('loginContainer').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('customerLoginContainer').style.display = 'none';
    document.getElementById('customerPortal').style.display = 'none';
}
function showMainContent() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('customerLoginContainer').style.display = 'none';
    document.getElementById('customerPortal').style.display = 'none';
    loadDashboard();
}

// Load dashboard data
async function loadDashboard() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            document.getElementById('totalCustomers').textContent = data.totalCustomers || 0;
            document.getElementById('activeMeters').textContent = data.activeMeters || 0;
            document.getElementById('monthlyRevenue').textContent = `KES ${data.monthlyRevenue || 0}`;
            document.getElementById('overdueBills').textContent = data.overdueBills || 0;
            // Load charts if needed
        }
    } catch (error) {
        console.error('Failed to load dashboard:', error);
    }
}

// Form switching functionality
const loginForm = document.getElementById('loginForm');
const signUpForm = document.getElementById('signUpForm');
const forgetPasswordForm = document.getElementById('forgetPasswordForm');

const signUpLink = document.getElementById('signUpLink');
const loginLink = document.getElementById('loginLink');
const forgetPasswordLink = document.getElementById('forgetPasswordLink');
const backToLoginLink = document.getElementById('backToLoginLink');

function showForm(formToShow) {
    loginForm.classList.remove('active');
    signUpForm.classList.remove('active');
    forgetPasswordForm.classList.remove('active');
    formToShow.classList.add('active');
}

if (signUpLink) signUpLink.addEventListener('click', (e) => {
    e.preventDefault();
    showForm(signUpForm);
});

if (loginLink) loginLink.addEventListener('click', (e) => {
    e.preventDefault();
    showForm(loginForm);
});

if (forgetPasswordLink) forgetPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    showForm(forgetPasswordForm);
});

if (backToLoginLink) backToLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    showForm(loginForm);
});

// Vanishing button logic for admin login
const loginBtn = document.getElementById('vanishBtn');
const usernameInp = document.getElementById('username');
const passwordInp = document.getElementById('password');

loginBtn.addEventListener('mouseover', () => {
    // Only vanish if fields are empty
    if (usernameInp.value.trim() === "" || passwordInp.value.trim() === "") {
        // Make it disappear instantly
        loginBtn.style.opacity = '0';
        loginBtn.style.pointerEvents = 'none'; // Prevent clicking while invisible

        // Make it dramatic by reappearing after 600ms
        setTimeout(() => {
            loginBtn.classList.remove('pop-up'); // Reset animation
            void loginBtn.offsetWidth;  // Trigger reflow to restart animation

            loginBtn.style.opacity = '1';
            loginBtn.style.pointerEvents = 'auto';

            loginBtn.classList.add('pop-up'); // Play pop animation
        }, 600);
    }
});

document.getElementById('signUpForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('signUpEmail').value;
    const username = document.getElementById('signUpUsername').value;
    const password = document.getElementById('signUpPassword').value;
    const confirmPassword = document.getElementById('signUpConfirmPassword').value;
    const warning = document.getElementById('signUpWarning');

    if (password !== confirmPassword) {
        warning.textContent = 'Passwords do not match';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, username, password })
        });
        const data = await response.json();
        if (response.ok) {
            warning.textContent = '';
            alert('Account created successfully! Please login.');
            showForm(loginForm);
        } else {
            warning.textContent = data.error || 'Sign up failed';
        }
    } catch (error) {
        warning.textContent = 'Sign up failed. Please try again.';
    }
});

document.getElementById('forgetPasswordForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('forgetEmail').value;
    const warning = document.getElementById('forgetWarning');

    // Placeholder for forget password
    warning.textContent = 'Password reset not implemented yet. Please contact admin.';
});

document.getElementById('logoutBtn').addEventListener('click', function() {
    localStorage.removeItem('authToken');
    showLoginForm();
});

window.addEventListener('load', function() {
    checkLogin();
    displayNotifications();
});

// ── Customer Portal Functions ──────────────────────────────────────────────────
let currentCustomer = null;
let customerConsumptionChart = null;

function showCustomerLogin() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('customerLoginContainer').style.display = 'flex';
}

function showAdminLogin() {
    document.getElementById('customerLoginContainer').style.display = 'none';
    document.getElementById('loginContainer').style.display = 'flex';
}

document.getElementById('customerLoginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const phone = document.getElementById('customerPhone').value;
    const pin = document.getElementById('customerPin').value;
    const errorMsg = document.getElementById('customerLoginError');

    try {
        const response = await fetch(`${API_BASE}/customer-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, pin })
        });
        const data = await response.json();

        if (response.ok) {
            currentCustomer = data.customer;
            localStorage.setItem('authToken', data.token);
            document.getElementById('customerLoginContainer').style.display = 'none';
            document.getElementById('customerPortal').style.display = 'block';
            document.getElementById('customerNameDisplay').textContent = data.customer.name;
            loadCustomerData();
            errorMsg.textContent = '';
        } else {
            errorMsg.textContent = data.error || 'Customer not found. Please check your phone number.';
        }
    } catch (error) {
        errorMsg.textContent = 'Login failed. Please try again.';
    }
});

document.getElementById('customerLogoutBtn').addEventListener('click', function() {
    currentCustomer = null;
    localStorage.removeItem('authToken');
    showLoginForm();
});

async function loadCustomerData() {
    if (!currentCustomer) return;
    
    try {
        const bills = await fetchData('/bills');
        const customerBills = bills.filter(b => b.customer_id === currentCustomer.customer_id);
        
        // Get current bill
        const currentBill = customerBills.sort((a, b) => new Date(b.due_date) - new Date(a.due_date))[0];
        if (currentBill) {
            document.getElementById('customerCurrentBill').textContent = `KES ${(currentBill.total_payable_amount || 0).toLocaleString()}`;
            document.getElementById('customerDueDate').textContent = currentBill.due_date || '-';
        }
        
        // Get consumption
        const meters = await fetchData('/meters');
        const customerMeters = meters.filter(m => m.customer_id === currentCustomer.customer_id);
        const latestMeter = customerMeters.sort((a, b) => new Date(b.reading_date) - new Date(a.reading_date))[0];
        if (latestMeter) {
            document.getElementById('customerConsumption').textContent = `${(latestMeter.consumption_m3 || 0).toFixed(2)} m³`;
        }
        
        // Load bills list
        displayCustomerBills(customerBills);
        
        // Load payments
        const paidBills = customerBills.filter(b => b.paid);
        displayCustomerPayments(paidBills);
        
        // Load consumption chart
        initCustomerConsumptionChart(customerMeters);
    } catch (error) {
        console.error('Error loading customer data:', error);
    }
}

function displayCustomerBills(bills) {
    const container = document.getElementById('customerBillsList');
    if (!bills || bills.length === 0) {
        container.innerHTML = '<p class="report-empty">No bills found.</p>';
        return;
    }
    
    const sortedBills = bills.sort((a, b) => new Date(b.due_date) - new Date(a.due_date));
    container.innerHTML = sortedBills.map(bill => `
        <div class="customer-bill-card">
            <div class="bill-header">
                <span class="bill-date">${bill.due_date || 'N/A'}</span>
                <span class="bill-status ${bill.paid ? 'status-paid' : 'status-unpaid'}">${bill.paid ? 'PAID' : 'UNPAID'}</span>
            </div>
            <div class="bill-amount">KES ${(bill.total_payable_amount || 0).toLocaleString()}</div>
            <div class="bill-details">
                <div>Consumption: KES ${(bill.consumption_amount || 0).toLocaleString()}</div>
                <div>Maintenance: KES ${(bill.maintenance_amount || 0).toLocaleString()}</div>
                ${bill.penalty > 0 ? `<div class="penalty">Penalty: KES ${bill.penalty.toLocaleString()}</div>` : ''}
            </div>
        </div>
    `).join('');
}

function displayCustomerPayments(bills) {
    const container = document.getElementById('customerPaymentsList');
    if (!bills || bills.length === 0) {
        container.innerHTML = '<p class="report-empty">No payment history found.</p>';
        return;
    }
    
    container.innerHTML = bills.map(bill => `
        <div class="customer-payment-card">
            <div class="payment-header">
                <span class="payment-date">${bill.due_date || 'N/A'}</span>
                <span class="payment-amount">KES ${(bill.paid_amount || 0).toLocaleString()}</span>
            </div>
            <div class="payment-status">Paid</div>
        </div>
    `).join('');
}

function initCustomerConsumptionChart(meters) {
    const ctx = document.getElementById('customerConsumptionChart');
    if (!ctx) return;
    
    // Get last 6 months consumption
    const months = [];
    const consumptionData = [];
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthName = date.toLocaleDateString('en-US', { month: 'short' });
        months.push(monthName);
        
        const monthMeters = meters.filter(m => {
            const readingDate = new Date(m.reading_date);
            return readingDate.getMonth() === date.getMonth() && 
                   readingDate.getFullYear() === date.getFullYear();
        });
        
        const totalConsumption = monthMeters.reduce((sum, m) => sum + (m.consumption_m3 || 0), 0);
        consumptionData.push(totalConsumption);
    }
    
    if (customerConsumptionChart) {
        customerConsumptionChart.destroy();
    }
    
    customerConsumptionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Consumption (m³)',
                data: consumptionData,
                borderColor: '#059669',
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value + ' m³';
                        }
                    }
                }
            }
        }
    });
}

function showCustomerTab(event, tabId) {
    // Hide all tabs
    document.querySelectorAll('.customer-tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.customer-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    const targetTab = document.getElementById(`customer${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
    if (targetTab) {
        targetTab.classList.add('active');
    }
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
    
    // Load data for specific tabs
    if (tabId === 'services') {
        loadCustomerServiceRequests();
    } else if (tabId === 'profile') {
        loadCustomerProfile();
    }
}

// Load customer service requests
async function loadCustomerServiceRequests() {
    if (!currentCustomer) return;
    
    try {
        const services = await fetchData('/services');
        const customerServices = services.filter(s => s.customer_id === currentCustomer.customer_id);
        
        const container = document.getElementById('serviceRequestsList');
        if (customerServices.length === 0) {
            container.innerHTML = '<p class="no-data">No service requests found.</p>';
            return;
        }
        
        container.innerHTML = customerServices.map(service => `
            <div class="service-request-item">
                <div class="service-request-header">
                    <span class="service-type">${service.service_type.replace('_', ' ').toUpperCase()}</span>
                    <span class="service-status status-${service.status}">${service.status}</span>
                </div>
                <div class="service-details">${service.details}</div>
                <div class="service-date">Scheduled: ${service.scheduled_date || 'Not scheduled'}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading service requests:', error);
    }
}

// Load customer profile
async function loadCustomerProfile() {
    if (!currentCustomer) return;
    
    document.getElementById('profileName').textContent = currentCustomer.name || '-';
    document.getElementById('profileEmail').textContent = currentCustomer.email || '-';
    document.getElementById('profilePhone').textContent = currentCustomer.phone || '-';
    document.getElementById('profileAddress').textContent = currentCustomer.address || '-';
}

// Edit profile function
function editProfile() {
    showToast('Profile editing feature coming soon!', 'info');
}

// Change password function
function changePassword() {
    showToast('Password change feature coming soon!', 'info');
}

document.getElementById('serviceRequestForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!currentCustomer) return;
    const data = {
        service_id: Date.now().toString(),
        customer_id: currentCustomer.customer_id,
        service_type: document.getElementById('serviceType').value,
        details: document.getElementById('serviceDetails').value,
        scheduled_date: document.getElementById('preferredDate').value,
        status: 'scheduled'
    };
    const token = localStorage.getItem('authToken');
    try {
        const res = await fetch(`${API_BASE}/services`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            showToast('Service request submitted successfully!', 'success');
            this.reset();
            loadCustomerServiceRequests();
        } else {
            showToast('Failed to submit service request.', 'error');
        }
    } catch {
        showToast('Network error. Please try again.', 'error');
    }
});

document.getElementById('supportForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const type = document.getElementById('supportType').value;
    const message = document.getElementById('supportMessage').value;

    alert(`Support request submitted!\n\nType: ${type}\nMessage: ${message}\n\nWe will contact you soon.`);
    this.reset();
});

// ── Payment Integration Functions ──────────────────────────────────────────────
function selectPaymentMethod(method) {
    // Remove selected class from all methods
    document.querySelectorAll('.payment-method').forEach(m => {
        m.classList.remove('selected');
    });
    
    // Hide all payment forms
    document.getElementById('mpesaPayment').style.display = 'none';
    document.getElementById('cardPayment').style.display = 'none';
    
    // Show selected payment form
    if (method === 'mpesa') {
        document.querySelector('.payment-method:first-child').classList.add('selected');
        document.getElementById('mpesaPayment').style.display = 'block';
    } else if (method === 'card') {
        document.querySelector('.payment-method:last-child').classList.add('selected');
        document.getElementById('cardPayment').style.display = 'block';
    }
}

document.getElementById('mpesaForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const phone = document.getElementById('mpesaPhone').value;
    const amount = parseFloat(document.getElementById('mpesaAmount').value);
    
    if (!currentCustomer) {
        alert('Please login first');
        return;
    }
    
    // Simulate M-Pesa payment
    const confirmed = confirm(`Initiate M-Pesa payment of KES ${amount.toLocaleString()} to ${phone}?\n\nYou will receive an M-Pesa prompt on your phone.`);
    
    if (confirmed) {
        // In production, this would call M-Pesa API
        alert('M-Pesa payment initiated! Please check your phone for the payment prompt.');
        
        // Update bill as paid
        const bills = await fetchData('/bills');
        const customerBills = bills.filter(b => b.customer_id === currentCustomer.customer_id && !b.paid);
        if (customerBills.length > 0) {
            const bill = customerBills[0];
            await sendData(`/bills/${bill.bill_id}`, 'PUT', {
                ...bill,
                paid_amount: amount,
                paid: 1
            });
            alert('Payment recorded successfully!');
            loadCustomerData();
        }
    }
    
    this.reset();
});

document.getElementById('cardForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const cardNumber = document.getElementById('cardNumber').value;
    const expiry = document.getElementById('cardExpiry').value;
    const cvv = document.getElementById('cardCvv').value;
    const amount = parseFloat(document.getElementById('cardAmount').value);
    
    if (!currentCustomer) {
        alert('Please login first');
        return;
    }
    
    // Simulate card payment
    const confirmed = confirm(`Process card payment of KES ${amount.toLocaleString()}?\n\nCard: ${cardNumber.slice(-4)}`);
    
    if (confirmed) {
        // In production, this would call payment gateway
        alert('Card payment processed successfully!');
        
        // Update bill as paid
        const bills = await fetchData('/bills');
        const customerBills = bills.filter(b => b.customer_id === currentCustomer.customer_id && !b.paid);
        if (customerBills.length > 0) {
            const bill = customerBills[0];
            await sendData(`/bills/${bill.bill_id}`, 'PUT', {
                ...bill,
                paid_amount: amount,
                paid: 1
            });
            alert('Payment recorded successfully!');
            loadCustomerData();
        }
    }
    
    this.reset();
});

// ── Dashboard Functions ──────────────────────────────────────────────────────
let revenueChart = null;
let consumptionChart = null;

async function loadDashboard() {
    try {
        const customers = await fetchData('/customers');
        const meters = await fetchData('/meters');
        const bills = await fetchData('/bills');
        
        // Update statistics
        document.getElementById('totalCustomers').textContent = customers.length;
        document.getElementById('activeMeters').textContent = meters.length;
        
        // Calculate monthly revenue
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthlyBills = bills.filter(b => {
            const billDate = new Date(b.due_date);
            return billDate.getMonth() === currentMonth && billDate.getFullYear() === currentYear;
        });
        const monthlyRevenue = monthlyBills.reduce((sum, b) => sum + (b.paid_amount || 0), 0);
        document.getElementById('monthlyRevenue').textContent = `KES ${monthlyRevenue.toLocaleString()}`;
        
        // Count overdue bills
        const today = new Date();
        const isAfter10th = today.getDate() >= 10;
        const overdueCount = bills.filter(b => {
            const dueDate = new Date(b.due_date);
            const billMonth = dueDate.getMonth();
            const billYear = dueDate.getFullYear();
            return !b.paid && (
                (billYear < currentYear) ||
                (billYear === currentYear && billMonth < currentMonth) ||
                (billYear === currentYear && billMonth === currentMonth && isAfter10th)
            );
        }).length;
        document.getElementById('overdueBills').textContent = overdueCount;
        
        // Initialize charts
        initRevenueChart(bills);
        initConsumptionChart(meters);
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function initRevenueChart(bills) {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    
    // Get last 6 months data
    const months = [];
    const revenueData = [];
    const paidData = [];
    const penaltyData = [];
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthName = date.toLocaleDateString('en-US', { month: 'short' });
        months.push(monthName);
        
        const monthBills = bills.filter(b => {
            const billDate = new Date(b.due_date);
            return billDate.getMonth() === date.getMonth() && 
                   billDate.getFullYear() === date.getFullYear();
        });
        
        const totalBilled = monthBills.reduce((sum, b) => sum + (b.total_payable_amount || 0), 0);
        const totalPaid = monthBills.reduce((sum, b) => sum + (b.paid_amount || 0), 0);
        const totalPenalty = monthBills.reduce((sum, b) => sum + (b.penalty || 0), 0);
        
        revenueData.push(totalBilled);
        paidData.push(totalPaid);
        penaltyData.push(totalPenalty);
    }
    
    if (revenueChart) {
        revenueChart.destroy();
    }
    
    revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Billed Amount',
                    data: revenueData,
                    borderColor: '#0369a1',
                    backgroundColor: 'rgba(3, 105, 161, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#0369a1',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                },
                {
                    label: 'Paid Amount',
                    data: paidData,
                    borderColor: '#059669',
                    backgroundColor: 'rgba(5, 150, 105, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#059669',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                },
                {
                    label: 'Penalties',
                    data: penaltyData,
                    borderColor: '#dc2626',
                    backgroundColor: 'rgba(220, 38, 38, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#dc2626',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#0369a1',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': KES ' + context.parsed.y.toLocaleString();
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            return 'KES ' + value.toLocaleString();
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            animation: {
                duration: 2000,
                easing: 'easeOutQuart'
            }
        }
    });
}

function initConsumptionChart(meters) {
    const ctx = document.getElementById('consumptionChart');
    if (!ctx) return;
    
    // Get last 6 months consumption
    const months = [];
    const consumptionData = [];
    const avgConsumptionData = [];
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthName = date.toLocaleDateString('en-US', { month: 'short' });
        months.push(monthName);
        
        const monthMeters = meters.filter(m => {
            const readingDate = new Date(m.reading_date);
            return readingDate.getMonth() === date.getMonth() && 
                   readingDate.getFullYear() === date.getFullYear();
        });
        
        const totalConsumption = monthMeters.reduce((sum, m) => sum + (m.consumption_m3 || 0), 0);
        const avgConsumption = monthMeters.length > 0 ? totalConsumption / monthMeters.length : 0;
        
        consumptionData.push(totalConsumption);
        avgConsumptionData.push(avgConsumption);
    }
    
    if (consumptionChart) {
        consumptionChart.destroy();
    }
    
    consumptionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Total Consumption (m³)',
                    data: consumptionData,
                    backgroundColor: 'rgba(6, 182, 212, 0.7)',
                    borderColor: '#06b6d4',
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false
                },
                {
                    label: 'Avg Consumption (m³)',
                    data: avgConsumptionData,
                    type: 'line',
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#f59e0b',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#06b6d4',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y.toFixed(2) + ' m³';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value + ' m³';
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            animation: {
                duration: 2000,
                easing: 'easeOutQuart'
            }
        }
    });
}

// ── Customer Management Functions ────────────────────────────────────────────
async function loadCustomers() {
    try {
        showSkeleton('customerList', 8);
        const customers = await fetchData('/customers');
        displayCustomers(customers);
    } catch (error) {
        console.error('Error loading customers:', error);
        showToast('Failed to load customers', 'error');
    }
}

function displayCustomers(customers) {
    const container = document.getElementById('customerList');
    if (!container) return;
    
    if (customers.length === 0) {
        container.innerHTML = '<div class="no-data">No customers registered yet.</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="data-table">
            <div class="table-header">
                <h3>Registered Customers (${customers.length})</h3>
                <div class="table-actions">
                    <input type="text" id="customerSearch" placeholder="Search customers..." class="search-input">
                    <button onclick="exportCustomers()" class="btn-export">Export to Excel</button>
                </div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Customer ID</th>
                            <th>Name</th>
                            <th>Contact Person</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Address</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${customers.map(customer => `
                            <tr>
                                <td>${customer.customer_id}</td>
                                <td>${customer.name}</td>
                                <td>${customer.contact_person || '-'}</td>
                                <td>${customer.email || '-'}</td>
                                <td>${customer.phone}</td>
                                <td>${customer.address}</td>
                                <td class="actions">
                                    <button onclick="editCustomer('${customer.customer_id}')" class="btn-edit">Edit</button>
                                    <button onclick="deleteCustomer('${customer.customer_id}')" class="btn-delete">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Add search functionality
    document.getElementById('customerSearch').addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const rows = container.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    });
}

async function saveCustomer() {
    const form = document.getElementById('customerForm');
    const formData = new FormData(form);
    
    const customerData = {
        customer_id: formData.get('customerId') || Date.now().toString(),
        name: formData.get('customerName'),
        contact_person: formData.get('contact'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        address: formData.get('address')
    };
    
    try {
        const isEdit = customerData.customer_id && customerData.customer_id !== '';
        const url = isEdit ? `/customers/${customerData.customer_id}` : '/customers';
        const method = isEdit ? 'PUT' : 'POST';
        
        await sendData(url, method, customerData);
        
        showToast(`Customer ${isEdit ? 'updated' : 'created'} successfully!`, 'success');
        form.reset();
        document.getElementById('customerId').value = '';
        loadCustomers();
    } catch (error) {
        console.error('Error saving customer:', error);
        showToast('Failed to save customer', 'error');
    }
}

function editCustomer(customerId) {
    fetchData(`/customers/${customerId}`).then(customer => {
        document.getElementById('customerId').value = customer.customer_id;
        document.getElementById('customerName').value = customer.name;
        document.getElementById('contact').value = customer.contact_person || '';
        document.getElementById('email').value = customer.email || '';
        document.getElementById('phone').value = customer.phone;
        document.getElementById('address').value = customer.address;
        
        // Scroll to form
        document.getElementById('customerForm').scrollIntoView({ behavior: 'smooth' });
    }).catch(error => {
        console.error('Error loading customer:', error);
        showToast('Failed to load customer details', 'error');
    });
}

async function deleteCustomer(customerId) {
    if (!confirm('Are you sure you want to delete this customer? This action cannot be undone.')) {
        return;
    }
    
    try {
        await sendData(`/customers/${customerId}`, 'DELETE');
        showToast('Customer deleted successfully!', 'success');
        loadCustomers();
    } catch (error) {
        console.error('Error deleting customer:', error);
        showToast('Failed to delete customer', 'error');
    }
}

function exportCustomers() {
    fetchData('/customers').then(customers => {
        const csvContent = [
            ['Customer ID', 'Name', 'Contact Person', 'Email', 'Phone', 'Address'],
            ...customers.map(c => [c.customer_id, c.name, c.contact_person || '', c.email || '', c.phone, c.address])
        ].map(row => row.join(',')).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'customers.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        
        showToast('Customers exported successfully!', 'success');
    }).catch(error => {
        console.error('Error exporting customers:', error);
        showToast('Failed to export customers', 'error');
    });
}

// ── Meter Management Functions ──────────────────────────────────────────────
async function loadMeters() {
    try {
        showSkeleton('meterList', 8);
        const [meters, customers] = await Promise.all([
            fetchData('/meters'),
            fetchData('/customers')
        ]);
        displayMeters(meters, customers);
        populateCustomerDatalists(customers);
    } catch (error) {
        console.error('Error loading meters:', error);
        showToast('Failed to load meters', 'error');
    }
}

function displayMeters(meters, customers) {
    const container = document.getElementById('meterList');
    if (!container) return;
    
    if (meters.length === 0) {
        container.innerHTML = '<div class="no-data">No meter readings recorded yet.</div>';
        return;
    }
    
    // Create customer lookup
    const customerMap = {};
    customers.forEach(c => customerMap[c.customer_id] = c.name);
    
    container.innerHTML = `
        <div class="data-table">
            <div class="table-header">
                <h3>Meter Readings (${meters.length})</h3>
                <div class="table-actions">
                    <input type="text" id="meterSearch" placeholder="Search meters..." class="search-input">
                    <button onclick="exportMeters()" class="btn-export">Export to Excel</button>
                </div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Meter ID</th>
                            <th>Customer</th>
                            <th>Meter Number</th>
                            <th>Previous Reading</th>
                            <th>Current Reading</th>
                            <th>Consumption (m³)</th>
                            <th>Reading Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${meters.map(meter => `
                            <tr>
                                <td>${meter.meter_id}</td>
                                <td>${customerMap[meter.customer_id] || 'Unknown'}</td>
                                <td>${meter.meter_number}</td>
                                <td>${meter.previous_reading || 0} m³</td>
                                <td>${meter.current_reading || 0} m³</td>
                                <td>${meter.consumption_m3 || 0} m³</td>
                                <td>${meter.reading_date ? new Date(meter.reading_date).toLocaleDateString() : '-'}</td>
                                <td class="actions">
                                    <button onclick="editMeter('${meter.meter_id}')" class="btn-edit">Edit</button>
                                    <button onclick="deleteMeter('${meter.meter_id}')" class="btn-delete">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Add search functionality
    document.getElementById('meterSearch').addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const rows = container.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    });
}

function populateCustomerDatalists(customers) {
    const datalists = ['customerNamesList', 'customerNamesListBill'];
    datalists.forEach(id => {
        const datalist = document.getElementById(id);
        if (datalist) {
            datalist.innerHTML = customers.map(c => `<option value="${c.name}">`).join('');
        }
    });
}

async function saveMeter() {
    const form = document.getElementById('meterForm');
    const formData = new FormData(form);
    
    const previousReading = parseFloat(formData.get('previousReading')) || 0;
    const currentReading = parseFloat(formData.get('currentReading')) || 0;
    const consumption = currentReading - previousReading;
    
    // Find customer ID by name
    const customerName = formData.get('meterCustomerName');
    const customers = await fetchData('/customers');
    const customer = customers.find(c => c.name === customerName);
    
    if (!customer) {
        showToast('Customer not found. Please select a valid customer.', 'error');
        return;
    }
    
    const meterData = {
        meter_id: formData.get('meterId') || Date.now().toString(),
        customer_id: customer.customer_id,
        meter_number: formData.get('meterNumber'),
        previous_reading: previousReading,
        current_reading: currentReading,
        consumption_m3: consumption,
        reading_date: formData.get('readingDate') || new Date().toISOString().split('T')[0]
    };
    
    try {
        const isEdit = meterData.meter_id && meterData.meter_id !== '';
        const url = isEdit ? `/meters/${meterData.meter_id}` : '/meters';
        const method = isEdit ? 'PUT' : 'POST';
        
        await sendData(url, method, meterData);
        
        showToast(`Meter reading ${isEdit ? 'updated' : 'recorded'} successfully!`, 'success');
        form.reset();
        document.getElementById('meterId').value = '';
        loadMeters();
    } catch (error) {
        console.error('Error saving meter:', error);
        showToast('Failed to save meter reading', 'error');
    }
}

function editMeter(meterId) {
    fetchData(`/meters/${meterId}`).then(meter => {
        document.getElementById('meterId').value = meter.meter_id;
        document.getElementById('meterCustomerName').value = meter.customer_name || '';
        document.getElementById('meterNumber').value = meter.meter_number;
        document.getElementById('previousReading').value = meter.previous_reading || 0;
        document.getElementById('currentReading').value = meter.current_reading || 0;
        document.getElementById('consumption').value = meter.consumption_m3 || 0;
        document.getElementById('readingDate').value = meter.reading_date ? meter.reading_date.split('T')[0] : '';
        
        // Scroll to form
        document.getElementById('meterForm').scrollIntoView({ behavior: 'smooth' });
    }).catch(error => {
        console.error('Error loading meter:', error);
        showToast('Failed to load meter details', 'error');
    });
}

async function deleteMeter(meterId) {
    if (!confirm('Are you sure you want to delete this meter reading? This action cannot be undone.')) {
        return;
    }
    
    try {
        await sendData(`/meters/${meterId}`, 'DELETE');
        showToast('Meter reading deleted successfully!', 'success');
        loadMeters();
    } catch (error) {
        console.error('Error deleting meter:', error);
        showToast('Failed to delete meter reading', 'error');
    }
}

function exportMeters() {
    Promise.all([fetchData('/meters'), fetchData('/customers')]).then(([meters, customers]) => {
        const customerMap = {};
        customers.forEach(c => customerMap[c.customer_id] = c.name);
        
        const csvContent = [
            ['Meter ID', 'Customer', 'Meter Number', 'Previous Reading', 'Current Reading', 'Consumption', 'Reading Date'],
            ...meters.map(m => [
                m.meter_id, 
                customerMap[m.customer_id] || 'Unknown',
                m.meter_number,
                m.previous_reading || 0,
                m.current_reading || 0,
                m.consumption_m3 || 0,
                m.reading_date || ''
            ])
        ].map(row => row.join(',')).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'meters.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        
        showToast('Meters exported successfully!', 'success');
    }).catch(error => {
        console.error('Error exporting meters:', error);
        showToast('Failed to export meters', 'error');
    });
}

// Calculate consumption when readings change
document.getElementById('currentReading').addEventListener('input', function() {
    const previous = parseFloat(document.getElementById('previousReading').value) || 0;
    const current = parseFloat(this.value) || 0;
    const consumption = Math.max(0, current - previous);
    document.getElementById('consumption').value = consumption.toFixed(2);
});

// ── Financial Tracking Functions ────────────────────────────────────────────
async function loadBills() {
    try {
        showSkeleton('billList', 8);
        const [bills, customers] = await Promise.all([
            fetchData('/bills'),
            fetchData('/customers')
        ]);
        displayBills(bills, customers);
    } catch (error) {
        console.error('Error loading bills:', error);
        showToast('Failed to load bills', 'error');
    }
}

function displayBills(bills, customers) {
    const container = document.getElementById('billList');
    if (!container) return;
    
    if (bills.length === 0) {
        container.innerHTML = '<div class="no-data">No bills generated yet.</div>';
        return;
    }
    
    // Create customer lookup
    const customerMap = {};
    customers.forEach(c => customerMap[c.customer_id] = c.name);
    
    container.innerHTML = `
        <div class="data-table">
            <div class="table-header">
                <h3>Billing Records (${bills.length})</h3>
                <div class="table-actions">
                    <input type="text" id="billSearch" placeholder="Search bills..." class="search-input">
                    <button onclick="generateBulkBills()" class="btn-generate">Generate Bills</button>
                    <button onclick="exportBills()" class="btn-export">Export to Excel</button>
                </div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Bill ID</th>
                            <th>Customer</th>
                            <th>Consumption Amount</th>
                            <th>Maintenance Amount</th>
                            <th>Total Payable</th>
                            <th>Paid Amount</th>
                            <th>Due Date</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bills.map(bill => {
                            const status = bill.paid ? 'Paid' : 'Unpaid';
                            const statusClass = bill.paid ? 'status-paid' : 'status-unpaid';
                            const overdue = !bill.paid && new Date(bill.due_date) < new Date();
                            
                            return `
                            <tr class="${overdue ? 'overdue' : ''}">
                                <td>${bill.bill_id}</td>
                                <td>${customerMap[bill.customer_id] || 'Unknown'}</td>
                                <td>KES ${bill.consumption_amount ? bill.consumption_amount.toLocaleString() : '0'}</td>
                                <td>KES ${bill.maintenance_amount ? bill.maintenance_amount.toLocaleString() : '0'}</td>
                                <td>KES ${bill.total_payable_amount ? bill.total_payable_amount.toLocaleString() : '0'}</td>
                                <td>KES ${bill.paid_amount ? bill.paid_amount.toLocaleString() : '0'}</td>
                                <td>${bill.due_date ? new Date(bill.due_date).toLocaleDateString() : '-'}</td>
                                <td><span class="status ${statusClass}">${status}</span></td>
                                <td class="actions">
                                    <button onclick="editBill('${bill.bill_id}')" class="btn-edit">Edit</button>
                                    <button onclick="markAsPaid('${bill.bill_id}')" class="btn-paid">Mark Paid</button>
                                    ${!bill.paid ? `<button onclick="initiateMpesaPayment('${bill.bill_id}', ${bill.total_payable_amount ?? 0})" class="btn-mpesa">Pay via M-Pesa</button>` : ''}
                                    <button onclick="deleteBill('${bill.bill_id}')" class="btn-delete">Delete</button>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Add search functionality
    document.getElementById('billSearch').addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const rows = container.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    });
}

async function saveBill() {
    const form = document.getElementById('billingForm');
    const formData = new FormData(form);
    
    // Find customer ID by name
    const customerName = formData.get('customerNameBill');
    const customers = await fetchData('/customers');
    const customer = customers.find(c => c.name === customerName);
    
    if (!customer) {
        showToast('Customer not found. Please select a valid customer.', 'error');
        return;
    }
    
    const consumptionAmount = parseFloat(formData.get('consumptionAmount')) || 0;
    const maintenanceAmount = parseFloat(formData.get('maintenanceAmount')) || 0;
    const totalPayable = consumptionAmount + maintenanceAmount;
    
    const billData = {
        bill_id: formData.get('billId') || Date.now().toString(),
        customer_id: customer.customer_id,
        previous_total_payable: parseFloat(formData.get('previousTotalPayable')) || 0,
        previous_balance: parseFloat(formData.get('previousBalance')) || 0,
        consumption_amount: consumptionAmount,
        maintenance_amount: maintenanceAmount,
        total_payable_amount: totalPayable,
        paid_amount: parseFloat(formData.get('paidAmount')) || 0,
        due_date: formData.get('dueDate'),
        paid: formData.get('paid') === 'on'
    };
    
    try {
        const isEdit = billData.bill_id && billData.bill_id !== '';
        const url = isEdit ? `/bills/${billData.bill_id}` : '/bills';
        const method = isEdit ? 'PUT' : 'POST';
        
        await sendData(url, method, billData);
        
        showToast(`Bill ${isEdit ? 'updated' : 'created'} successfully!`, 'success');
        form.reset();
        document.getElementById('billId').value = '';
        loadBills();
    } catch (error) {
        console.error('Error saving bill:', error);
        showToast('Failed to save bill', 'error');
    }
}

function editBill(billId) {
    fetchData(`/bills/${billId}`).then(bill => {
        document.getElementById('billId').value = bill.bill_id;
        document.getElementById('customerNameBill').value = bill.customer_name || '';
        document.getElementById('previousTotalPayable').value = bill.previous_total_payable || 0;
        document.getElementById('previousBalance').value = bill.previous_balance || 0;
        document.getElementById('consumptionAmount').value = bill.consumption_amount || 0;
        document.getElementById('maintenanceAmount').value = bill.maintenance_amount || 0;
        document.getElementById('totalPayableAmount').value = bill.total_payable_amount || 0;
        document.getElementById('paidAmount').value = bill.paid_amount || 0;
        document.getElementById('dueDate').value = bill.due_date ? bill.due_date.split('T')[0] : '';
        document.getElementById('paid').checked = bill.paid;
        
        // Scroll to form
        document.getElementById('billingForm').scrollIntoView({ behavior: 'smooth' });
    }).catch(error => {
        console.error('Error loading bill:', error);
        showToast('Failed to load bill details', 'error');
    });
}

async function markAsPaid(billId) {
    try {
        const bill = await fetchData(`/bills/${billId}`);
        await sendData(`/bills/${billId}`, 'PUT', {
            ...bill,
            paid_amount: bill.total_payable_amount,
            paid: 1
        });
        
        showToast('Bill marked as paid!', 'success');
        loadBills();
    } catch (error) {
        console.error('Error marking bill as paid:', error);
        showToast('Failed to mark bill as paid', 'error');
    }
}

async function deleteBill(billId) {
    if (!confirm('Are you sure you want to delete this bill? This action cannot be undone.')) {
        return;
    }
    
    try {
        await sendData(`/bills/${billId}`, 'DELETE');
        showToast('Bill deleted successfully!', 'success');
        loadBills();
    } catch (error) {
        console.error('Error deleting bill:', error);
        showToast('Failed to delete bill', 'error');
    }
}

async function generateBulkBills() {
    if (!confirm('This will generate bills for all customers based on their latest meter readings. Continue?')) {
        return;
    }
    
    try {
        showToast('Generating bills... This may take a moment.', 'info');
        
        // Get all customers and their latest meter readings
        const [customers, meters] = await Promise.all([
            fetchData('/customers'),
            fetchData('/meters')
        ]);
        
        // Get active rates
        const rates = await fetchData('/rates/active');
        const consumptionRate = rates.find(r => r.rate_type === 'consumption')?.rate_value || 50;
        const maintenanceRate = rates.find(r => r.rate_type === 'maintenance')?.rate_value || 200;
        
        let generated = 0;
        for (const customer of customers) {
            // Get latest meter reading for customer
            const customerMeters = meters.filter(m => m.customer_id === customer.customer_id)
                .sort((a, b) => new Date(b.reading_date) - new Date(a.reading_date));
            
            if (customerMeters.length > 0) {
                const latestMeter = customerMeters[0];
                const consumptionAmount = latestMeter.consumption_m3 * consumptionRate;
                
                const billData = {
                    bill_id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    customer_id: customer.customer_id,
                    consumption_amount: consumptionAmount,
                    maintenance_amount: maintenanceRate,
                    total_payable_amount: consumptionAmount + maintenanceRate,
                    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
                    paid: 0
                };
                
                await sendData('/bills', 'POST', billData);
                generated++;
            }
        }
        
        showToast(`Generated ${generated} bills successfully!`, 'success');
        loadBills();
    } catch (error) {
        console.error('Error generating bills:', error);
        showToast('Failed to generate bills', 'error');
    }
}

function exportBills() {
    Promise.all([fetchData('/bills'), fetchData('/customers')]).then(([bills, customers]) => {
        const customerMap = {};
        customers.forEach(c => customerMap[c.customer_id] = c.name);
        
        const csvContent = [
            ['Bill ID', 'Customer', 'Consumption Amount', 'Maintenance Amount', 'Total Payable', 'Paid Amount', 'Due Date', 'Status'],
            ...bills.map(b => [
                b.bill_id,
                customerMap[b.customer_id] || 'Unknown',
                b.consumption_amount || 0,
                b.maintenance_amount || 0,
                b.total_payable_amount || 0,
                b.paid_amount || 0,
                b.due_date || '',
                b.paid ? 'Paid' : 'Unpaid'
            ])
        ].map(row => row.join(',')).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bills.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        
        showToast('Bills exported successfully!', 'success');
    }).catch(error => {
        console.error('Error exporting bills:', error);
        showToast('Failed to export bills', 'error');
    });
}

// ── Infrastructure Management Functions ─────────────────────────────────────
async function loadServices() {
    try {
        showSkeleton('serviceList', 8);
        const [services, customers] = await Promise.all([
            fetchData('/services'),
            fetchData('/customers')
        ]);
        displayServices(services, customers);
    } catch (error) {
        console.error('Error loading services:', error);
        showToast('Failed to load services', 'error');
    }
}

function displayServices(services, customers) {
    const container = document.getElementById('serviceList');
    if (!container) return;
    
    if (services.length === 0) {
        container.innerHTML = '<div class="no-data">No service requests scheduled yet.</div>';
        return;
    }
    
    // Create customer lookup
    const customerMap = {};
    customers.forEach(c => customerMap[c.customer_id] = c.name);
    
    const statusColors = {
        'scheduled': 'status-scheduled',
        'in_progress': 'status-progress',
        'completed': 'status-completed',
        'cancelled': 'status-cancelled'
    };
    
    container.innerHTML = `
        <div class="data-table">
            <div class="table-header">
                <h3>Service Requests (${services.length})</h3>
                <div class="table-actions">
                    <input type="text" id="serviceSearch" placeholder="Search services..." class="search-input">
                    <button onclick="exportServices()" class="btn-export">Export to Excel</button>
                </div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Service ID</th>
                            <th>Customer</th>
                            <th>Service Type</th>
                            <th>Details</th>
                            <th>Status</th>
                            <th>Scheduled Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${services.map(service => `
                            <tr>
                                <td>${service.service_id}</td>
                                <td>${customerMap[service.customer_id] || 'Unknown'}</td>
                                <td>${service.service_type.replace('_', ' ').toUpperCase()}</td>
                                <td>${service.details}</td>
                                <td><span class="status ${statusColors[service.status] || 'status-scheduled'}">${service.status.replace('_', ' ').toUpperCase()}</span></td>
                                <td>${service.scheduled_date ? new Date(service.scheduled_date).toLocaleDateString() : '-'}</td>
                                <td class="actions">
                                    <button onclick="editService('${service.service_id}')" class="btn-edit">Edit</button>
                                    <button onclick="updateServiceStatus('${service.service_id}', 'completed')" class="btn-complete">Complete</button>
                                    <button onclick="deleteService('${service.service_id}')" class="btn-delete">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Add search functionality
    document.getElementById('serviceSearch').addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const rows = container.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    });
}

async function saveService() {
    const form = document.getElementById('serviceForm');
    if (!form) return;
    
    const formData = new FormData(form);
    
    // Find customer ID by name
    const customerName = formData.get('serviceCustomerName');
    const customers = await fetchData('/customers');
    const customer = customers.find(c => c.name === customerName);
    
    if (!customer) {
        showToast('Customer not found. Please select a valid customer.', 'error');
        return;
    }
    
    const serviceData = {
        service_id: formData.get('serviceId') || Date.now().toString(),
        customer_id: customer.customer_id,
        service_type: formData.get('serviceType'),
        details: formData.get('serviceDetails'),
        status: formData.get('serviceStatus') || 'scheduled',
        scheduled_date: formData.get('scheduledDate') || null
    };
    
    try {
        const isEdit = serviceData.service_id && serviceData.service_id !== '';
        const url = isEdit ? `/services/${serviceData.service_id}` : '/services';
        const method = isEdit ? 'PUT' : 'POST';
        
        await sendData(url, method, serviceData);
        
        showToast(`Service ${isEdit ? 'updated' : 'scheduled'} successfully!`, 'success');
        form.reset();
        document.getElementById('serviceId').value = '';
        loadServices();
    } catch (error) {
        console.error('Error saving service:', error);
        showToast('Failed to save service', 'error');
    }
}

function editService(serviceId) {
    fetchData(`/services/${serviceId}`).then(service => {
        // Assuming there's a service form in the infrastructure section
        const form = document.getElementById('serviceForm');
        if (form) {
            document.getElementById('serviceId').value = service.service_id;
            document.getElementById('serviceCustomerName').value = service.customer_name || '';
            document.getElementById('serviceType').value = service.service_type;
            document.getElementById('serviceDetails').value = service.details;
            document.getElementById('serviceStatus').value = service.status;
            document.getElementById('scheduledDate').value = service.scheduled_date ? service.scheduled_date.split('T')[0] : '';
            
            // Scroll to form
            form.scrollIntoView({ behavior: 'smooth' });
        }
    }).catch(error => {
        console.error('Error loading service:', error);
        showToast('Failed to load service details', 'error');
    });
}

async function updateServiceStatus(serviceId, newStatus) {
    try {
        const service = await fetchData(`/services/${serviceId}`);
        await sendData(`/services/${serviceId}`, 'PUT', {
            ...service,
            status: newStatus
        });
        
        showToast(`Service marked as ${newStatus}!`, 'success');
        loadServices();
    } catch (error) {
        console.error('Error updating service status:', error);
        showToast('Failed to update service status', 'error');
    }
}

async function deleteService(serviceId) {
    if (!confirm('Are you sure you want to delete this service request? This action cannot be undone.')) {
        return;
    }
    
    try {
        await sendData(`/services/${serviceId}`, 'DELETE');
        showToast('Service deleted successfully!', 'success');
        loadServices();
    } catch (error) {
        console.error('Error deleting service:', error);
        showToast('Failed to delete service', 'error');
    }
}

// ── Reports Functions ─────────────────────────────────────────────────────
async function loadReports() {
    // Initialize report buttons
    document.getElementById('paymentHistory').addEventListener('click', generatePaymentHistory);
    document.getElementById('disconnectedClients').addEventListener('click', generateDisconnectedClients);
    document.getElementById('revenueAnalytics').addEventListener('click', generateRevenueAnalytics);
    document.getElementById('consumptionAnalytics').addEventListener('click', generateConsumptionAnalytics);
    
    // Initialize export buttons
    document.getElementById('exportPaymentPdf').addEventListener('click', () => exportReport('payment', 'pdf'));
    document.getElementById('exportPaymentExcel').addEventListener('click', () => exportReport('payment', 'excel'));
    document.getElementById('exportDisconnectedPdf').addEventListener('click', () => exportReport('disconnected', 'pdf'));
    document.getElementById('exportRevenuePdf').addEventListener('click', () => exportReport('revenue', 'pdf'));
    document.getElementById('exportJson').addEventListener('click', exportFullDataJson);
    document.getElementById('backupDb').addEventListener('click', backupDatabase);
    
    // Load default report
    generatePaymentHistory();
}

async function generatePaymentHistory() {
    try {
        const [bills, customers] = await Promise.all([
            fetchData('/bills'),
            fetchData('/customers')
        ]);
        
        const customerMap = {};
        customers.forEach(c => customerMap[c.customer_id] = c.name);
        
        const paidBills = bills.filter(b => b.paid).sort((a, b) => new Date(b.due_date) - new Date(a.due_date));
        
        const reportHTML = `
            <div class="report-container">
                <h3>Payment History Report</h3>
                <div class="report-meta">
                    <span>Total Payments: ${paidBills.length}</span>
                    <span>Total Amount: KES ${paidBills.reduce((sum, b) => sum + (b.paid_amount || 0), 0).toLocaleString()}</span>
                    <span>Generated: ${new Date().toLocaleString()}</span>
                </div>
                <div class="report-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Customer</th>
                                <th>Bill ID</th>
                                <th>Amount Paid</th>
                                <th>Payment Method</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${paidBills.map(bill => `
                                <tr>
                                    <td>${new Date(bill.due_date).toLocaleDateString()}</td>
                                    <td>${customerMap[bill.customer_id] || 'Unknown'}</td>
                                    <td>${bill.bill_id}</td>
                                    <td>KES ${bill.paid_amount ? bill.paid_amount.toLocaleString() : '0'}</td>
                                    <td>M-Pesa/Cash</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        document.getElementById('reportOutput').innerHTML = reportHTML;
        showToast('Payment history report generated!', 'success');
    } catch (error) {
        console.error('Error generating payment history:', error);
        showToast('Failed to generate payment history', 'error');
    }
}

async function generateDisconnectedClients() {
    try {
        const [bills, customers] = await Promise.all([
            fetchData('/bills'),
            fetchData('/customers')
        ]);
        
        const customerMap = {};
        customers.forEach(c => {
            customerMap[c.customer_id] = c;
        });
        
        // Find customers with overdue bills (more than 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const disconnectedCustomers = [];
        bills.forEach(bill => {
            if (!bill.paid && new Date(bill.due_date) < thirtyDaysAgo) {
                const customer = customerMap[bill.customer_id];
                if (customer && !disconnectedCustomers.find(dc => dc.customer_id === customer.customer_id)) {
                    disconnectedCustomers.push({
                        ...customer,
                        overdueAmount: bill.total_payable_amount,
                        daysOverdue: Math.floor((new Date() - new Date(bill.due_date)) / (1000 * 60 * 60 * 24))
                    });
                }
            }
        });
        
        const reportHTML = `
            <div class="report-container">
                <h3>Disconnected Clients Report</h3>
                <div class="report-meta">
                    <span>Clients to Disconnect: ${disconnectedCustomers.length}</span>
                    <span>Total Overdue: KES ${disconnectedCustomers.reduce((sum, c) => sum + (c.overdueAmount || 0), 0).toLocaleString()}</span>
                    <span>Generated: ${new Date().toLocaleString()}</span>
                </div>
                <div class="report-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Customer ID</th>
                                <th>Name</th>
                                <th>Phone</th>
                                <th>Overdue Amount</th>
                                <th>Days Overdue</th>
                                <th>Address</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${disconnectedCustomers.map(customer => `
                                <tr>
                                    <td>${customer.customer_id}</td>
                                    <td>${customer.name}</td>
                                    <td>${customer.phone}</td>
                                    <td>KES ${customer.overdueAmount ? customer.overdueAmount.toLocaleString() : '0'}</td>
                                    <td>${customer.daysOverdue}</td>
                                    <td>${customer.address}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        document.getElementById('reportOutput').innerHTML = reportHTML;
        showToast('Disconnected clients report generated!', 'success');
    } catch (error) {
        console.error('Error generating disconnected clients:', error);
        showToast('Failed to generate disconnected clients report', 'error');
    }
}

async function generateRevenueAnalytics() {
    try {
        const bills = await fetchData('/bills');
        
        // Calculate monthly revenue for the last 12 months
        const monthlyRevenue = {};
        bills.filter(b => b.paid).forEach(bill => {
            const date = new Date(bill.due_date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + (bill.paid_amount || 0);
        });
        
        const months = Object.keys(monthlyRevenue).sort().slice(-12);
        const revenueData = months.map(month => monthlyRevenue[month]);
        
        const totalRevenue = revenueData.reduce((sum, rev) => sum + rev, 0);
        const avgMonthly = revenueData.length > 0 ? totalRevenue / revenueData.length : 0;
        
        const reportHTML = `
            <div class="report-container">
                <h3>Revenue Analytics Report</h3>
                <div class="report-meta">
                    <span>Total Revenue (12 months): KES ${totalRevenue.toLocaleString()}</span>
                    <span>Average Monthly: KES ${avgMonthly.toLocaleString()}</span>
                    <span>Generated: ${new Date().toLocaleString()}</span>
                </div>
                <div class="chart-container">
                    <canvas id="revenueReportChart"></canvas>
                </div>
                <div class="report-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Month</th>
                                <th>Revenue</th>
                                <th>Growth %</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${months.map((month, index) => {
                                const revenue = revenueData[index];
                                const prevRevenue = index > 0 ? revenueData[index - 1] : 0;
                                const growth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue * 100).toFixed(1) : 'N/A';
                                return `
                                    <tr>
                                        <td>${month}</td>
                                        <td>KES ${revenue.toLocaleString()}</td>
                                        <td>${growth === 'N/A' ? 'N/A' : growth + '%'}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        document.getElementById('reportOutput').innerHTML = reportHTML;
        
        // Create chart
        setTimeout(() => {
            const ctx = document.getElementById('revenueReportChart');
            if (ctx) {
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: months,
                        datasets: [{
                            label: 'Monthly Revenue',
                            data: revenueData,
                            borderColor: '#059669',
                            backgroundColor: 'rgba(5, 150, 105, 0.1)',
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'top' }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: function(value) {
                                        return 'KES ' + value.toLocaleString();
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }, 100);
        
        showToast('Revenue analytics report generated!', 'success');
    } catch (error) {
        console.error('Error generating revenue analytics:', error);
        showToast('Failed to generate revenue analytics', 'error');
    }
}

async function generateConsumptionAnalytics() {
    try {
        const [meters, customers] = await Promise.all([
            fetchData('/meters'),
            fetchData('/customers')
        ]);
        
        const customerMap = {};
        customers.forEach(c => customerMap[c.customer_id] = c.name);
        
        // Calculate consumption by customer
        const consumptionByCustomer = {};
        meters.forEach(meter => {
            const customerId = meter.customer_id;
            if (!consumptionByCustomer[customerId]) {
                consumptionByCustomer[customerId] = {
                    name: customerMap[customerId] || 'Unknown',
                    totalConsumption: 0,
                    readingCount: 0
                };
            }
            consumptionByCustomer[customerId].totalConsumption += meter.consumption_m3 || 0;
            consumptionByCustomer[customerId].readingCount++;
        });
        
        const sortedCustomers = Object.values(consumptionByCustomer)
            .sort((a, b) => b.totalConsumption - a.totalConsumption);
        
        const reportHTML = `
            <div class="report-container">
                <h3>Consumption Analytics Report</h3>
                <div class="report-meta">
                    <span>Total Customers: ${sortedCustomers.length}</span>
                    <span>Total Consumption: ${sortedCustomers.reduce((sum, c) => sum + c.totalConsumption, 0).toFixed(2)} m³</span>
                    <span>Generated: ${new Date().toLocaleString()}</span>
                </div>
                <div class="chart-container">
                    <canvas id="consumptionReportChart"></canvas>
                </div>
                <div class="report-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Customer</th>
                                <th>Total Consumption (m³)</th>
                                <th>Readings</th>
                                <th>Avg per Reading</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedCustomers.map(customer => `
                                <tr>
                                    <td>${customer.name}</td>
                                    <td>${customer.totalConsumption.toFixed(2)}</td>
                                    <td>${customer.readingCount}</td>
                                    <td>${(customer.totalConsumption / customer.readingCount).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        document.getElementById('reportOutput').innerHTML = reportHTML;
        
        // Create chart
        setTimeout(() => {
            const ctx = document.getElementById('consumptionReportChart');
            if (ctx) {
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: sortedCustomers.slice(0, 10).map(c => c.name),
                        datasets: [{
                            label: 'Consumption (m³)',
                            data: sortedCustomers.slice(0, 10).map(c => c.totalConsumption),
                            backgroundColor: 'rgba(6, 182, 212, 0.7)',
                            borderColor: '#06b6d4',
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'top' }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: function(value) {
                                        return value + ' m³';
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }, 100);
        
        showToast('Consumption analytics report generated!', 'success');
    } catch (error) {
        console.error('Error generating consumption analytics:', error);
        showToast('Failed to generate consumption analytics', 'error');
    }
}

function printReport() {
    window.print();
}

async function exportReport(type, format) {
    try {
        showToast(`Exporting ${type} report as ${format.toUpperCase()}...`, 'info');
        
        // For now, just export as CSV since PDF would require additional libraries
        // In production, you'd use libraries like pdfkit or puppeteer
        let data = [];
        let filename = '';
        
        switch (type) {
            case 'payment':
                const bills = await fetchData('/bills');
                data = bills.filter(b => b.paid);
                filename = 'payment_history.csv';
                break;
            case 'disconnected':
                // This would require more complex logic to identify disconnected customers
                showToast('Disconnected customers export coming soon!', 'info');
                return;
            case 'revenue':
                const revenueBills = await fetchData('/bills');
                data = revenueBills;
                filename = 'revenue_analytics.csv';
                break;
        }
        
        if (data.length > 0) {
            const csvContent = [
                Object.keys(data[0]).join(','),
                ...data.map(row => Object.values(row).join(','))
            ].join('\n');
            
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            window.URL.revokeObjectURL(url);
            
            showToast(`${type} report exported successfully!`, 'success');
        }
    } catch (error) {
        console.error('Error exporting report:', error);
        showToast('Failed to export report', 'error');
    }
}

async function exportFullDataJson() {
    try {
        showToast('Exporting full database...', 'info');
        
        const [customers, meters, bills, services] = await Promise.all([
            fetchData('/customers'),
            fetchData('/meters'),
            fetchData('/bills'),
            fetchData('/services')
        ]);
        
        const fullData = {
            exportDate: new Date().toISOString(),
            customers,
            meters,
            bills,
            services
        };
        
        const jsonContent = JSON.stringify(fullData, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `muwaca_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        showToast('Full database exported successfully!', 'success');
    } catch (error) {
        console.error('Error exporting full data:', error);
        showToast('Failed to export full data', 'error');
    }
}

async function backupDatabase() {
    // In a real application, this would trigger a server-side backup
    // For now, just export the data
    await exportFullDataJson();
    showToast('Database backup completed!', 'success');
}

// Service form event listener
document.getElementById('serviceForm').addEventListener('submit', function(e) {
    e.preventDefault();
    saveService();
});

// Calculate penalties event listener
document.getElementById('calculatePenalties').addEventListener('click', async function() {
    try {
        showToast('Calculating penalties...', 'info');
        await sendData('/calculate-penalties', 'POST');
        showToast('Penalties calculated successfully!', 'success');
        loadBills(); // Refresh the bills list
    } catch (error) {
        console.error('Error calculating penalties:', error);
        showToast('Failed to calculate penalties', 'error');
    }
});

// Check overdue bills function
async function checkOverdueBills() {
    try {
        showToast('Checking overdue bills...', 'info');
        await sendData('/calculate-penalties', 'POST');
        showToast('Overdue bills checked and penalties calculated!', 'success');
        loadDashboard(); // Refresh dashboard stats
    } catch (error) {
        console.error('Error checking overdue bills:', error);
        showToast('Failed to check overdue bills', 'error');
    }
}
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('main section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remove active class from all nav buttons
    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        
        // Add active class to corresponding nav button
        const navBtn = document.getElementById(sectionId + 'Btn');
        if (navBtn) {
            navBtn.classList.add('active');
        }
        
        // Load data for specific sections
        switch(sectionId) {
            case 'home':
                loadDashboard();
                break;
            case 'customers':
                loadCustomers();
                break;
            case 'meters':
                loadMeters();
                break;
            case 'financial':
                loadBills();
                break;
            case 'infrastructure':
                loadServices();
                break;
            case 'reports':
                loadReports();
                break;
            case 'rates':
                loadRates();
                break;
        }
    }
}

document.getElementById('homeBtn').addEventListener('click', () => showSection('home'));
document.getElementById('customerBtn').addEventListener('click', () => showSection('customers'));
document.getElementById('meterBtn').addEventListener('click', () => showSection('meters'));
document.getElementById('financialBtn').addEventListener('click', () => showSection('financial'));
document.getElementById('infrastructureBtn').addEventListener('click', () => showSection('infrastructure'));
document.getElementById('reportsBtn').addEventListener('click', () => showSection('reports'));

// ── Rate Management Functions ──────────────────────────────────────────────
async function loadRates() {
    try {
        showSkeleton('rateList', 5);
        const rates = await fetchData('/rates');
        displayRates(rates);
    } catch (error) {
        console.error('Error loading rates:', error);
        showToast('Failed to load rates', 'error');
    }
}

function displayRates(rates) {
    const container = document.getElementById('rateList');
    if (!container) return;
    
    if (rates.length === 0) {
        container.innerHTML = '<div class="no-data">No rates configured yet.</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="data-table">
            <div class="table-header">
                <h3>Rate Configurations (${rates.length})</h3>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Rate Type</th>
                            <th>Name</th>
                            <th>Value</th>
                            <th>Unit</th>
                            <th>Effective Date</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rates.map(rate => {
                            const isActive = rate.is_active ? 'Active' : 'Inactive';
                            const statusClass = rate.is_active ? 'status-paid' : 'status-unpaid';
                            return `
                            <tr>
                                <td>${rate.rate_type}</td>
                                <td>${rate.rate_name}</td>
                                <td>${rate.rate_value}</td>
                                <td>${rate.unit}</td>
                                <td>${rate.effective_date ? new Date(rate.effective_date).toLocaleDateString() : '-'}</td>
                                <td><span class="status ${statusClass}">${isActive}</span></td>
                                <td class="actions">
                                    <button onclick="editRate('${rate.id}')" class="btn-edit">Edit</button>
                                    <button onclick="deleteRate('${rate.id}')" class="btn-delete">Delete</button>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

document.getElementById('rateForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const rateData = {
        rate_type: document.getElementById('rateType').value,
        rate_name: document.getElementById('rateName').value,
        rate_value: parseFloat(document.getElementById('rateValue').value),
        unit: document.getElementById('rateUnit').value,
        effective_date: document.getElementById('effectiveDate').value,
        expiry_date: document.getElementById('expiryDate').value || null
    };
    
    try {
        const rateId = document.getElementById('rateId').value;
        const isEdit = rateId && rateId !== '';
        const url = isEdit ? `/rates/${rateId}` : '/rates';
        const method = isEdit ? 'PUT' : 'POST';
        
        await sendData(url, method, rateData);
        
        showToast(`Rate ${isEdit ? 'updated' : 'created'} successfully!`, 'success');
        this.reset();
        document.getElementById('rateId').value = '';
        loadRates();
    } catch (error) {
        console.error('Error saving rate:', error);
        showToast('Failed to save rate', 'error');
    }
});

async function editRate(rateId) {
    fetchData(`/rates/${rateId}`).then(rate => {
        document.getElementById('rateId').value = rate.id;
        document.getElementById('rateType').value = rate.rate_type;
        document.getElementById('rateName').value = rate.rate_name;
        document.getElementById('rateValue').value = rate.rate_value;
        document.getElementById('rateUnit').value = rate.unit;
        document.getElementById('effectiveDate').value = rate.effective_date;
        document.getElementById('expiryDate').value = rate.expiry_date || '';
    }).catch(error => {
        console.error('Error loading rate:', error);
        showToast('Failed to load rate details', 'error');
    });
}

async function deleteRate(rateId) {
    if (!confirm('Are you sure you want to delete this rate?')) {
        return;
    }
    
    try {
        await sendData(`/rates/${rateId}`, 'DELETE');
        showToast('Rate deleted successfully!', 'success');
        loadRates();
    } catch (error) {
        console.error('Error deleting rate:', error);
        showToast('Failed to delete rate', 'error');
    }
}

// ── M-Pesa Payment Functions ──────────────────────────────────────────────
document.getElementById('mpesaPaymentForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    
    const paymentData = {
        bill_id: document.getElementById('mpesaBillId').value,
        phone_number: document.getElementById('mpesaPhone').value,
        amount: parseFloat(document.getElementById('mpesaAmount').value)
    };
    
    const statusDiv = document.getElementById('mpesaStatus');
    statusDiv.innerHTML = '';
    const infoP = document.createElement('p');
    infoP.className = 'info';
    infoP.textContent = 'Initiating M-Pesa payment... Please wait.';
    statusDiv.appendChild(infoP);
    
    try {
        const response = await sendData('/mpesa/initiate', 'POST', paymentData);
        
        if (response.checkoutRequestId) {
            statusDiv.innerHTML = '';
            
            const successP = document.createElement('p');
            successP.className = 'success';
            successP.textContent = 'Payment request sent! Check your phone for M-Pesa prompt.';
            statusDiv.appendChild(successP);
            
            const idP = document.createElement('p');
            idP.textContent = `Checkout Request ID: ${response.checkoutRequestId}`;
            statusDiv.appendChild(idP);
            
            const checkBtn = document.createElement('button');
            checkBtn.textContent = 'Check Payment Status';
            checkBtn.onclick = () => checkMpesaStatus(response.checkoutRequestId);
            statusDiv.appendChild(checkBtn);
        } else {
            statusDiv.innerHTML = '';
            const errorP = document.createElement('p');
            errorP.className = 'error';
            errorP.textContent = 'Failed to initiate payment. Please try again.';
            statusDiv.appendChild(errorP);
        }
    } catch (error) {
        console.error('M-Pesa payment error:', error);
        statusDiv.innerHTML = '';
        const errorP = document.createElement('p');
        errorP.className = 'error';
        errorP.textContent = 'Payment failed. Please try again later.';
        statusDiv.appendChild(errorP);
    } finally {
        submitBtn.disabled = false;
    }
});

async function checkMpesaStatus(checkoutRequestId) {
    try {
        const status = await fetchData(`/mpesa/status/${checkoutRequestId}`);
        const statusDiv = document.getElementById('mpesaStatus');
        statusDiv.innerHTML = '';
        
        const messageP = document.createElement('p');
        
        if (status.status === 'completed') {
            messageP.className = 'success';
            messageP.textContent = `✅ Payment successful! Receipt: ${status.mpesa_receipt_number}`;
            loadBills(); // Refresh bills list
        } else if (status.status === 'pending') {
            messageP.className = 'info';
            messageP.textContent = '⏳ Payment pending. Please check your phone.';
        } else {
            messageP.className = 'error';
            messageP.textContent = `❌ Payment failed: ${status.result_desc || 'Unknown error'}`;
        }
        
        statusDiv.appendChild(messageP);
    } catch (error) {
        console.error('Error checking M-Pesa status:', error);
        showToast('Failed to check payment status', 'error');
    }
}

// Helper: Set bill ID for M-Pesa payment
function initiateMpesaPayment(billId, amount) {
    document.getElementById('mpesaBillId').value = billId;
    document.getElementById('mpesaAmount').value = amount;
    showSection('financial');
    document.getElementById('mpesaPhone').focus();
}

// ── Toast Notification System ──────────────────────────────────────────────
let notifications = [];

// Toast notification function for instant feedback
function showToast(message, type = 'info', duration = 5000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${getToastIcon(type)}</div>
        <div class="toast-message">${message}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    document.body.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Auto-remove after duration
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function getToastIcon(type) {
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    return icons[type] || icons.info;
}

// Skeleton loading function
function showSkeleton(containerId, rows = 5) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let skeletonHTML = '<div class="skeleton-container">';
    for (let i = 0; i < rows; i++) {
        skeletonHTML += `
            <div class="skeleton-row">
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text"></div>
            </div>
        `;
    }
    skeletonHTML += '</div>';
    container.innerHTML = skeletonHTML;
}

function hideSkeleton(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        const skeleton = container.querySelector('.skeleton-container');
        if (skeleton) skeleton.remove();
    }
}

// Animated counter for statistics
function animateCounter(element, target, duration = 2000) {
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target.toLocaleString();
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current).toLocaleString();
        }
    }, 16);
}

// Ripple effect for buttons
function createRipple(event) {
    const button = event.currentTarget;
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.className = 'ripple';
    
    button.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
}

// Add ripple effect to all buttons
function initRippleEffects() {
    document.querySelectorAll('.btn, button').forEach(button => {
        button.addEventListener('click', createRipple);
    });
}

// Initialize visual enhancements on page load
function initVisualEnhancements() {
    initRippleEffects();
    
    // Add smooth scroll behavior
    document.documentElement.style.scrollBehavior = 'smooth';
    
    // Add loading states to forms
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function() {
            const submitBtn = this.querySelector('[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="spinner"></span> Loading...';
            }
        });
    });
}

function toggleNotifications() {
    const notificationList = document.getElementById('notificationList');
    const toggleBtn = document.querySelector('.notification-toggle');
    if (notificationList.style.display === 'none') {
        notificationList.style.display = 'block';
        toggleBtn.textContent = '−';
    } else {
        notificationList.style.display = 'none';
        toggleBtn.textContent = '+';
    }
}

function addNotification(type, title, message, customerId = null) {
    const notification = { id: Date.now(), type, title, message, customerId, timestamp: new Date(), read: false };
    notifications.unshift(notification);
    displayNotifications();
    if (type === 'success') setTimeout(() => removeNotification(notification.id), 30000);
}

function removeNotification(id) {
    notifications = notifications.filter(n => n.id !== id);
    displayNotifications();
}

function displayNotifications() {
    const container = document.getElementById('notificationList');
    if (notifications.length === 0) {
        container.innerHTML = '<div class="notification-item"><div class="notification-message">No notifications</div></div>';
        return;
    }
    container.innerHTML = notifications.map(n => `
        <div class="notification-item ${n.type}">
            <div class="notification-title">${n.title}</div>
            <div class="notification-message">${n.message}</div>
            <div class="notification-time">${formatTime(n.timestamp)}</div>
        </div>
    `).join('');
}

function formatTime(date) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

async function sendPhoneNotification(customerId, message, type = 'bill_generated') {
    try {
        const customers = await fetchData('/customers');
        const customer = customers.find(c => c.customer_id === customerId);
        if (!customer || !customer.phone) return false;
        console.log(`📱 SMS to ${customer.phone} (${customer.name}): ${message}`);
        await new Promise(resolve => setTimeout(resolve, 500));
        return true;
    } catch { return false; }
}

// ── BUG FIX: Overdue logic was inverted for current-month bills ──────────────
async function checkOverdueBills() {
    try {
        const bills = await fetchData('/bills');
        const customers = await fetchData('/customers');
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        // After the 10th = payment deadline passed
        const isAfter10th = currentDate.getDate() >= 10;
        let overdueCount = 0;

        for (const bill of bills) {
            const dueDate = new Date(bill.due_date);
            const billMonth = dueDate.getMonth();
            const billYear = dueDate.getFullYear();

            // FIXED: current month bill is overdue AFTER the 10th (was: before)
            const isOverdue = !bill.paid && (
                (billYear < currentYear) ||
                (billYear === currentYear && billMonth < currentMonth) ||
                (billYear === currentYear && billMonth === currentMonth && isAfter10th)
            );

            if (isOverdue) {
                const customer = customers.find(c => c.customer_id === bill.customer_id);
                if (customer) {
                    const message = `MUWACA WATER: Your bill of KES ${(bill.total_payable_amount || 0).toFixed(2)} is overdue. Pay immediately to avoid disconnection. Due: ${dueDate.toLocaleDateString()}`;
                    const sent = await sendPhoneNotification(customer.customer_id, message, 'overdue_bill');
                    if (sent) {
                        addNotification('warning', 'Overdue Bill Notification Sent',
                            `Notification sent to ${customer.name} (${customer.phone}). Amount: KES ${(bill.total_payable_amount || 0).toFixed(2)}`,
                            customer.customer_id);
                        overdueCount++;
                    }
                }
            }
        }

        if (overdueCount === 0) {
            addNotification('success', 'Overdue Bill Check Complete', 'No overdue bills found.');
        } else {
            addNotification('warning', 'Overdue Notifications Sent', `${overdueCount} notification(s) sent.`);
        }
    } catch (error) {
        addNotification('error', 'Error', 'Failed to check overdue bills.');
    }
}

// ── Customer Name Datalists ──────────────────────────────────────────────────
async function populateCustomerNameLists() {
    const customers = await fetchData('/customers');
    const names = customers.map(c => c.name);
    ['customerNamesList', 'customerNamesListBill', 'customerNamesListInfra'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = names.map(name => `<option value="${name}">`).join('');
    });
}

// ── Section Navigation ───────────────────────────────────────────────────────

// ── Loading States ──────────────────────────────────────────────────────────
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '<div class="loading-container"><div class="loading"></div><p>Loading...</p></div>';
    }
}

function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '';
    }
}

// ── API Helpers ──────────────────────────────────────────────────────────────
async function fetchData(endpoint, showLoadingState = true) {
    const loadingId = endpoint.replace('/', '') + 'Loading';
    if (showLoadingState) {
        showLoading(loadingId);
    }

    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('authToken');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, { headers });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (showLoadingState) {
            hideLoading(loadingId);
        }
        return data;
    } catch (error) {
        console.error('Fetch error:', error);
        if (showLoadingState) {
            hideLoading(loadingId);
        }
        addNotification('error', 'Network Error', `Failed to fetch data: ${error.message}`);
        return [];
    }
}

async function sendData(endpoint, method, data, showLoadingState = true) {
    const loadingId = endpoint.replace('/', '') + 'Loading';
    if (showLoadingState) {
        showLoading(loadingId);
    }
    
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('authToken');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method,
            headers,
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        if (showLoadingState) {
            hideLoading(loadingId);
        }
        return result;
    } catch (error) {
        console.error('Send error:', error);
        if (showLoadingState) {
            hideLoading(loadingId);
        }
        addNotification('error', 'Operation Failed', error.message);
        return null;
    }
}

// ── Customer Registration ────────────────────────────────────────────────────
document.getElementById('customerForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const customerId = document.getElementById('customerId').value;
    const data = {
        customer_id: customerId || Date.now().toString(),
        name: document.getElementById('customerName').value,
        contact_person: document.getElementById('contact').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        address: document.getElementById('address').value
    };
    if (customerId) {
        await sendData(`/customers/${customerId}`, 'PUT', data);
        addNotification('success', 'Customer Updated', `${data.name} updated successfully.`);
    } else {
        await sendData('/customers', 'POST', data);
        addNotification('success', 'Customer Registered', `${data.name} registered successfully.`);
    }
    document.getElementById('customerId').value = '';
    this.reset();
    displayCustomers();
});

// ── Meter Management ─────────────────────────────────────────────────────────
// BUG FIX: Changed from 'customerName' to 'meterCustomerName' to avoid duplicate ID conflict
document.getElementById('meterCustomerName').addEventListener('input', async function() {
    const customerName = this.value;
    if (!customerName) return;
    const customers = await fetchData('/customers');
    const customer = customers.find(c => c.name === customerName);
    if (customer) {
        const meters = await fetchData('/meters');
        const customerMeters = meters.filter(m => m.customer_id === customer.customer_id);
        const latestMeter = customerMeters.sort((a, b) => new Date(b.reading_date) - new Date(a.reading_date))[0];
        if (latestMeter) {
            document.getElementById('previousReading').value = latestMeter.current_reading;
            document.getElementById('currentReading').value = '';
            document.getElementById('meterNumber').value = latestMeter.meter_number;
        }
        document.getElementById('readingDate').value = '';
    }
});

document.getElementById('meterForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const meterId = document.getElementById('meterId').value;
    const customerName = document.getElementById('meterCustomerName').value;
    const customers = await fetchData('/customers');
    const customer = customers.find(c => c.name === customerName);
    if (!customer) { addNotification('error', 'Error', 'Please select a valid customer.'); return; }

    const previousReading = parseFloat(document.getElementById('previousReading').value);
    const currentReadingInput = document.getElementById('currentReading').value;
    const currentReading = currentReadingInput ? parseFloat(currentReadingInput) : 0;
    if (isNaN(previousReading) || isNaN(currentReading)) {
        addNotification('error', 'Error', 'Please enter valid numeric readings.');
        return;
    }
    const consumption = Math.max(0, currentReading - previousReading);

    const data = {
        meter_id: meterId || Date.now().toString(),
        customer_id: customer.customer_id,
        meter_number: document.getElementById('meterNumber').value,
        previous_reading: previousReading,
        current_reading: currentReading,
        consumption_m3: consumption,
        reading_date: document.getElementById('readingDate').value
    };
    if (meterId) {
        await sendData(`/meters/${meterId}`, 'PUT', data);
        addNotification('success', 'Meter Updated', `Meter ${data.meter_number} updated.`);
    } else {
        await sendData('/meters', 'POST', data);
        addNotification('success', 'Meter Recorded', `Consumption: ${consumption.toFixed(2)} m³`);
    }
    document.getElementById('meterId').value = '';
    this.reset();
    displayMeters();
});

function calculateConsumption() {
    const prev = parseFloat(document.getElementById('previousReading').value) || 0;
    const curr = parseFloat(document.getElementById('currentReading').value) || 0;
    document.getElementById('consumption').value = Math.max(0, curr - prev).toFixed(2);
}
document.getElementById('previousReading').addEventListener('input', calculateConsumption);
document.getElementById('currentReading').addEventListener('input', calculateConsumption);

// ── Financial Tracking ───────────────────────────────────────────────────────
document.getElementById('customerNameBill').addEventListener('input', async function() {
    const customerName = this.value;
    if (!customerName) return;
    const customers = await fetchData('/customers');
    const customer = customers.find(c => c.name === customerName);
    if (!customer) return;
    const bills = await fetchData('/bills');
    const customerBills = bills.filter(b => b.customer_id === customer.customer_id);
    if (customerBills.length > 0) {
        const latestBill = customerBills.sort((a, b) => new Date(b.due_date) - new Date(a.due_date))[0];
        document.getElementById('previousTotalPayable').value = latestBill.total_payable_amount || 0;
        document.getElementById('previousBalance').value = ((latestBill.total_payable_amount || 0) - (latestBill.paid_amount || 0));
    }
    const meters = await fetchData('/meters');
    const customerMeters = meters.filter(m => m.customer_id === customer.customer_id);
    const latestMeter = customerMeters.sort((a, b) => new Date(b.reading_date) - new Date(a.reading_date))[0];
    if (latestMeter) {
        const consumptionAmount = latestMeter.consumption_m3 * 160;
        document.getElementById('consumptionAmount').value = consumptionAmount.toFixed(2);
        const previousBalance = parseFloat(document.getElementById('previousBalance').value) || 0;
        document.getElementById('totalPayableAmount').value = (consumptionAmount + 200 + previousBalance).toFixed(2);
    }
});

document.getElementById('billingForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const billId = document.getElementById('billId').value;
    const customerName = document.getElementById('customerNameBill').value;
    const customers = await fetchData('/customers');
    const customer = customers.find(c => c.name === customerName);
    if (!customer) { addNotification('error', 'Error', 'Please select a valid customer.'); return; }

    const meters = await fetchData('/meters');
    const customerMeters = meters.filter(m => m.customer_id === customer.customer_id);
    const latestMeter = customerMeters.sort((a, b) => new Date(b.reading_date) - new Date(a.reading_date))[0];
    const consumptionAmount = latestMeter ? latestMeter.consumption_m3 * 160 : 0;
    const maintenanceAmount = 200;
    const previousBalance = parseFloat(document.getElementById('previousBalance').value) || 0;
    const totalPayableAmount = consumptionAmount + maintenanceAmount + previousBalance;

    const data = {
        bill_id: billId || Date.now().toString(),
        customer_id: customer.customer_id,
        previous_total_payable: parseFloat(document.getElementById('previousTotalPayable').value) || 0,
        previous_balance: previousBalance,
        consumption_amount: consumptionAmount,
        maintenance_amount: maintenanceAmount,
        total_payable_amount: totalPayableAmount,
        paid_amount: parseFloat(document.getElementById('paidAmount').value) || 0,
        due_date: document.getElementById('dueDate').value,
        paid: 0,
        penalty: 0
    };

    if (billId) {
        await sendData(`/bills/${billId}`, 'PUT', data);
        addNotification('success', 'Bill Updated', `Bill for ${customer.name} updated.`);
    } else {
        await sendData('/bills', 'POST', data);
        await sendPhoneNotification(customer.customer_id,
            `MUWACA WATER: New bill KES ${totalPayableAmount.toFixed(2)}. Due: ${new Date(data.due_date).toLocaleDateString()}.`,
            'bill_generated');
        addNotification('success', 'Bill Generated', `Bill for ${customer.name}: KES ${totalPayableAmount.toFixed(2)}`);
    }
    document.getElementById('billId').value = '';
    this.reset();
    displayBills();
});

document.getElementById('calculatePenalties').addEventListener('click', async function() {
    await sendData('/calculate-penalties', 'POST', {});
    addNotification('success', 'Penalties Calculated', '10% monthly penalty applied to all overdue bills.');
    displayBills();
});

// ── Reports ──────────────────────────────────────────────────────────────────
document.getElementById('paymentHistory').addEventListener('click', async function() {
    const bills = await fetchData('/reports/payment-history');
    const customers = await fetchData('/customers');
    displayPaymentHistoryReport(bills, customers);
});

document.getElementById('disconnectedClients').addEventListener('click', async function() {
    const customers = await fetchData('/reports/disconnected-customers');
    const bills = await fetchData('/bills');
    displayDisconnectedReport(customers, bills);
});

document.getElementById('consumptionAnalytics').addEventListener('click', async function() {
    const data = await fetchData('/reports/consumption-analytics');
    displayConsumptionReport(data);
});

document.getElementById('revenueAnalytics').addEventListener('click', async function() {
    const data = await fetchData('/reports/revenue-analytics');
    const prevMonth = await fetchData('/reports/revenue-previous-month');
    displayRevenueReport(data, prevMonth);
});

// ── Export Buttons ────────────────────────────────────────────────────────────
document.getElementById('exportPaymentPdf').addEventListener('click', () => window.open(`${API_BASE}/export/payment-history/pdf`, '_blank'));
document.getElementById('exportPaymentExcel').addEventListener('click', () => window.open(`${API_BASE}/export/payment-history/excel`, '_blank'));
document.getElementById('exportDisconnectedPdf').addEventListener('click', () => window.open(`${API_BASE}/export/disconnected-customers/pdf`, '_blank'));
document.getElementById('exportRevenuePdf').addEventListener('click', () => window.open(`${API_BASE}/export/revenue-analytics/pdf`, '_blank'));
document.getElementById('exportJson').addEventListener('click', () => window.open(`${API_BASE}/export/json`, '_blank'));
document.getElementById('backupDb').addEventListener('click', () => window.open(`${API_BASE}/backup`, '_blank'));

function displayConsumptionReport(data) {
    const output = document.getElementById('reportOutput');
    if (!data || data.length === 0) {
        output.innerHTML = reportHeader('Consumption Analytics Report') + '<p class="report-empty">No consumption data found.</p>';
        return;
    }
    const totalConsumption = data.reduce((s, r) => s + (r.total_consumption || 0), 0);
    const rows = data.map(r => `<tr>
        <td>${r.customer_id}</td>
        <td>${r.name}</td>
        <td>${(r.total_consumption || 0).toFixed(2)} m³</td>
        <td>${(r.avg_consumption || 0).toFixed(2)} m³</td>
        <td>${(r.max_consumption || 0).toFixed(2)} m³</td>
        <td>${r.reading_count}</td>
    </tr>`).join('');
    output.innerHTML = reportHeader('Consumption Analytics Report', `${data.length} customer(s)`) + `
        <div class="report-summary">
            <div class="summary-card"><div class="summary-label">Total Consumption</div><div class="summary-value">${totalConsumption.toFixed(2)} m³</div></div>
            <div class="summary-card"><div class="summary-label">Customers Tracked</div><div class="summary-value">${data.length}</div></div>
        </div>
        <table class="report-table">
            <thead><tr><th>ID</th><th>Customer</th><th>Total (m³)</th><th>Avg (m³)</th><th>Max (m³)</th><th>Readings</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
        <div class="report-footer">End of Consumption Analytics Report — MUWACA Water Enterprises</div>`;
}

// ── Report Renderers (proper formatted HTML, not raw JSON) ───────────────────
function reportHeader(title, subtitle) {
    const now = new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });
    return `
        <div class="report-header">
            <div class="report-logo">💧</div>
            <h2>MUWACA WATER ENTERPRISES</h2>
            <h3>${title}</h3>
            <p class="report-date">Generated: ${now}</p>
            ${subtitle ? `<p class="report-subtitle">${subtitle}</p>` : ''}
        </div>`;
}

function displayPaymentHistoryReport(bills, customers) {
    const output = document.getElementById('reportOutput');
    if (!bills || bills.length === 0) {
        output.innerHTML = reportHeader('Payment History Report') + '<p class="report-empty">No paid bills found.</p>';
        return;
    }
    const totalPaid = bills.reduce((sum, b) => sum + (b.paid_amount || 0), 0);
    const rows = bills.map(bill => {
        const customer = customers.find(c => c.customer_id === bill.customer_id);
        return `<tr>
            <td>${bill.bill_id}</td>
            <td>${customer ? customer.name : 'Unknown'}</td>
            <td>KES ${(bill.total_payable_amount || 0).toFixed(2)}</td>
            <td>KES ${(bill.paid_amount || 0).toFixed(2)}</td>
            <td>${bill.due_date || '—'}</td>
            <td><span class="status-paid">PAID</span></td>
        </tr>`;
    }).join('');
    output.innerHTML = reportHeader('Payment History Report', `${bills.length} paid bill(s)`) + `
        <div class="report-summary">
            <div class="summary-card"><div class="summary-label">Total Bills Paid</div><div class="summary-value">${bills.length}</div></div>
            <div class="summary-card"><div class="summary-label">Total Amount Collected</div><div class="summary-value">KES ${totalPaid.toFixed(2)}</div></div>
        </div>
        <table class="report-table">
            <thead><tr><th>Bill ID</th><th>Customer</th><th>Billed Amount</th><th>Paid Amount</th><th>Due Date</th><th>Status</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
        <div class="report-footer">End of Payment History Report — MUWACA Water Enterprises</div>`;
}

function displayDisconnectedReport(customers, allBills) {
    const output = document.getElementById('reportOutput');
    if (!customers || customers.length === 0) {
        output.innerHTML = reportHeader('Disconnected Customers Report') + '<p class="report-empty">No disconnected customers found.</p>';
        return;
    }
    const today = new Date().toISOString().split('T')[0];
    const rows = customers.map(c => {
        const unpaidBills = allBills.filter(b => b.customer_id === c.customer_id && !b.paid);
        const totalOwed = unpaidBills.reduce((sum, b) => sum + (b.total_payable_amount || 0) + (b.penalty || 0), 0);
        const oldest = unpaidBills.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];
        return `<tr>
            <td>${c.customer_id}</td>
            <td>${c.name}</td>
            <td>${c.phone || '—'}</td>
            <td>${c.address || '—'}</td>
            <td>${unpaidBills.length}</td>
            <td class="amount-owed">KES ${totalOwed.toFixed(2)}</td>
            <td>${oldest ? oldest.due_date : '—'}</td>
        </tr>`;
    }).join('');
    output.innerHTML = reportHeader('Disconnected Customers Report', 'Customers with overdue unpaid bills') + `
        <div class="report-summary">
            <div class="summary-card warn"><div class="summary-label">Disconnected Customers</div><div class="summary-value">${customers.length}</div></div>
        </div>
        <table class="report-table">
            <thead><tr><th>ID</th><th>Name</th><th>Phone</th><th>Address</th><th>Unpaid Bills</th><th>Total Owed</th><th>Oldest Due</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
        <div class="report-footer">End of Disconnected Customers Report — MUWACA Water Enterprises</div>`;
}

function displayRevenueReport(data, prevMonth) {
    const output = document.getElementById('reportOutput');
    const totalRevenue = data?.totalRevenue || 0;
    const totalPenalties = data?.totalPenalties || 0;
    const prevPaid = prevMonth?.previousMonthPaid || 0;
    output.innerHTML = reportHeader('Revenue Analytics Report', 'Financial summary of billing and collections') + `
        <div class="report-summary">
            <div class="summary-card"><div class="summary-label">Total Revenue Collected</div><div class="summary-value">KES ${totalRevenue.toFixed(2)}</div></div>
            <div class="summary-card warn"><div class="summary-label">Total Penalties Charged</div><div class="summary-value">KES ${totalPenalties.toFixed(2)}</div></div>
            <div class="summary-card"><div class="summary-label">Previous Month Collections</div><div class="summary-value">KES ${prevPaid.toFixed(2)}</div></div>
        </div>
        <table class="report-table">
            <thead><tr><th>Metric</th><th>Amount (KES)</th></tr></thead>
            <tbody>
                <tr><td>Total Revenue from Paid Bills</td><td>KES ${totalRevenue.toFixed(2)}</td></tr>
                <tr><td>Total Penalties Collected</td><td>KES ${totalPenalties.toFixed(2)}</td></tr>
                <tr><td>Previous Month Collections (${prevMonth?.period || 'N/A'})</td><td>KES ${prevPaid.toFixed(2)}</td></tr>
                <tr class="total-row"><td><strong>Grand Total (Revenue + Penalties)</strong></td><td><strong>KES ${(totalRevenue + totalPenalties).toFixed(2)}</strong></td></tr>
            </tbody>
        </table>
        <div class="report-footer">End of Revenue Analytics Report — MUWACA Water Enterprises</div>`;
}

// ── Pagination Variables ──────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 10;
let customerPage = 1;
let meterPage = 1;
let billPage = 1;
let servicePage = 1;

// ── Pagination Helper Functions ──────────────────────────────────────────────
function paginateData(data, page) {
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return data.slice(startIndex, endIndex);
}

function renderPagination(currentPage, totalItems, onPageChange, containerId) {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    if (totalPages <= 1) return '';
    
    let html = `<div class="pagination-container">`;
    
    // Previous button
    if (currentPage > 1) {
        html += `<button class="pagination-btn" onclick="${onPageChange}(${currentPage - 1})">Previous</button>`;
    }
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="${onPageChange}(${i})">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += `<span class="pagination-ellipsis">...</span>`;
        }
    }
    
    // Next button
    if (currentPage < totalPages) {
        html += `<button class="pagination-btn" onclick="${onPageChange}(${currentPage + 1})">Next</button>`;
    }
    
    html += `</div>`;
    return html;
}

function changeCustomerPage(page) {
    customerPage = page;
    displayCustomers();
}

function changeMeterPage(page) {
    meterPage = page;
    displayMeters();
}

function changeBillPage(page) {
    billPage = page;
    displayBills();
}

function changeServicePage(page) {
    servicePage = page;
    displayServices();
}

// ── Search and Filter Functions ──────────────────────────────────────────────
let customerSearchTerm = '';
let customerFilterField = 'all';

function filterCustomers(customers) {
    if (!customerSearchTerm) return customers;
    const term = customerSearchTerm.toLowerCase();
    return customers.filter(c => {
        if (customerFilterField === 'all') {
            return c.name.toLowerCase().includes(term) ||
                   (c.contact_person && c.contact_person.toLowerCase().includes(term)) ||
                   (c.email && c.email.toLowerCase().includes(term)) ||
                   (c.phone && c.phone.includes(term)) ||
                   c.customer_id.toLowerCase().includes(term);
        } else {
            const value = c[customerFilterField] || '';
            return value.toString().toLowerCase().includes(term);
        }
    });
}

// ── Display Functions ────────────────────────────────────────────────────────
async function displayCustomers() {
    const customers = await fetchData('/customers');
    const el = document.getElementById('customerList');
    if (!customers || customers.length === 0) { el.innerHTML = '<p>No customers registered yet.</p>'; return; }
    
    const filteredCustomers = filterCustomers(customers);
    const paginatedCustomers = paginateData(filteredCustomers, customerPage);
    
    el.innerHTML = `
        <h3>Registered Customers (${filteredCustomers.length} of ${customers.length})</h3>
        <div class="search-filter-container">
            <input type="text" id="customerSearch" placeholder="Search customers..." value="${customerSearchTerm}" 
                   onkeyup="customerSearchTerm = this.value; customerPage = 1; displayCustomers();">
            <select id="customerFilter" onchange="customerFilterField = this.value; customerPage = 1; displayCustomers();">
                <option value="all" ${customerFilterField === 'all' ? 'selected' : ''}>All Fields</option>
                <option value="name" ${customerFilterField === 'name' ? 'selected' : ''}>Name</option>
                <option value="contact_person" ${customerFilterField === 'contact_person' ? 'selected' : ''}>Contact Person</option>
                <option value="email" ${customerFilterField === 'email' ? 'selected' : ''}>Email</option>
                <option value="phone" ${customerFilterField === 'phone' ? 'selected' : ''}>Phone</option>
            </select>
        </div>
        <table>
            <tr><th>ID</th><th>Name</th><th>Contact</th><th>Email</th><th>Phone</th><th>Actions</th></tr>
            ${paginatedCustomers.map(c => `<tr>
                <td>${c.customer_id}</td><td>${c.name}</td><td>${c.contact_person || '—'}</td><td>${c.email || '—'}</td><td>${c.phone || '—'}</td>
                <td><button class="btn-edit" onclick="editCustomer('${c.customer_id}')">Edit</button> <button class="btn-delete" onclick="deleteCustomer('${c.customer_id}')">Delete</button></td>
            </tr>`).join('')}
        </table>
        ${renderPagination(customerPage, filteredCustomers.length, 'changeCustomerPage', 'customerList')}`;
}

let meterSearchTerm = '';
let meterFilterField = 'all';

function filterMeters(meters, customers) {
    if (!meterSearchTerm) return meters;
    const term = meterSearchTerm.toLowerCase();
    return meters.filter(m => {
        const customer = customers.find(c => c.customer_id === m.customer_id);
        const customerName = customer ? customer.name.toLowerCase() : '';
        
        if (meterFilterField === 'all') {
            return m.meter_id.toLowerCase().includes(term) ||
                   customerName.includes(term) ||
                   m.meter_number.toLowerCase().includes(term) ||
                   m.reading_date.includes(term);
        } else if (meterFilterField === 'customer') {
            return customerName.includes(term);
        } else {
            const value = m[meterFilterField] || '';
            return value.toString().toLowerCase().includes(term);
        }
    });
}

async function displayMeters() {
    const meters = await fetchData('/meters');
    const customers = await fetchData('/customers');
    const el = document.getElementById('meterList');
    if (!meters || meters.length === 0) { el.innerHTML = '<p>No meter readings recorded yet.</p>'; return; }
    
    const filteredMeters = filterMeters(meters, customers);
    const paginatedMeters = paginateData(filteredMeters, meterPage);
    
    el.innerHTML = `
        <h3>Water Meter Readings (${filteredMeters.length} of ${meters.length})</h3>
        <div class="search-filter-container">
            <input type="text" id="meterSearch" placeholder="Search meters..." value="${meterSearchTerm}" 
                   onkeyup="meterSearchTerm = this.value; meterPage = 1; displayMeters();">
            <select id="meterFilter" onchange="meterFilterField = this.value; meterPage = 1; displayMeters();">
                <option value="all" ${meterFilterField === 'all' ? 'selected' : ''}>All Fields</option>
                <option value="customer" ${meterFilterField === 'customer' ? 'selected' : ''}>Customer</option>
                <option value="meter_number" ${meterFilterField === 'meter_number' ? 'selected' : ''}>Meter Number</option>
                <option value="reading_date" ${meterFilterField === 'reading_date' ? 'selected' : ''}>Reading Date</option>
            </select>
        </div>
        <table>
            <tr><th>ID</th><th>Customer</th><th>Meter No.</th><th>Prev (m³)</th><th>Curr (m³)</th><th>Usage (m³)</th><th>Date</th><th>Actions</th></tr>
            ${paginatedMeters.map(m => {
                const customer = customers.find(c => c.customer_id === m.customer_id);
                return `<tr>
                    <td>${m.meter_id}</td><td>${customer ? customer.name : 'Unknown'}</td><td>${m.meter_number}</td>
                    <td>${m.previous_reading}</td><td>${m.current_reading}</td><td>${m.consumption_m3}</td><td>${m.reading_date}</td>
                    <td><button class="btn-edit" onclick="editMeter('${m.meter_id}')">Edit</button> <button class="btn-delete" onclick="deleteMeter('${m.meter_id}')">Delete</button></td>
                </tr>`;
            }).join('')}
        </table>
        ${renderPagination(meterPage, filteredMeters.length, 'changeMeterPage', 'meterList')}`;
}

let billSearchTerm = '';
let billFilterField = 'all';
let billFilterStatus = 'all';

function filterBills(bills, customers) {
    let filtered = bills;
    
    // Filter by status
    if (billFilterStatus !== 'all') {
        filtered = filtered.filter(b => billFilterStatus === 'paid' ? b.paid : !b.paid);
    }
    
    // Filter by search term
    if (billSearchTerm) {
        const term = billSearchTerm.toLowerCase();
        filtered = filtered.filter(b => {
            const customer = customers.find(c => c.customer_id === b.customer_id);
            const customerName = customer ? customer.name.toLowerCase() : '';
            
            if (billFilterField === 'all') {
                return b.bill_id.toLowerCase().includes(term) ||
                       customerName.includes(term) ||
                       b.due_date.includes(term);
            } else if (billFilterField === 'customer') {
                return customerName.includes(term);
            } else {
                const value = b[billFilterField] || '';
                return value.toString().toLowerCase().includes(term);
            }
        });
    }
    
    return filtered;
}

async function displayBills() {
    const bills = await fetchData('/bills');
    const customers = await fetchData('/customers');
    const el = document.getElementById('billingList');
    if (!bills || bills.length === 0) { el.innerHTML = '<p>No bills generated yet.</p>'; return; }
    
    const filteredBills = filterBills(bills, customers);
    const paginatedBills = paginateData(filteredBills, billPage);
    
    el.innerHTML = `
        <h3>Billing Details (${filteredBills.length} of ${bills.length})</h3>
        <div class="search-filter-container">
            <input type="text" id="billSearch" placeholder="Search bills..." value="${billSearchTerm}" 
                   onkeyup="billSearchTerm = this.value; billPage = 1; displayBills();">
            <select id="billFilter" onchange="billFilterField = this.value; billPage = 1; displayBills();">
                <option value="all" ${billFilterField === 'all' ? 'selected' : ''}>All Fields</option>
                <option value="customer" ${billFilterField === 'customer' ? 'selected' : ''}>Customer</option>
                <option value="bill_id" ${billFilterField === 'bill_id' ? 'selected' : ''}>Bill ID</option>
                <option value="due_date" ${billFilterField === 'due_date' ? 'selected' : ''}>Due Date</option>
            </select>
            <select id="billStatusFilter" onchange="billFilterStatus = this.value; billPage = 1; displayBills();">
                <option value="all" ${billFilterStatus === 'all' ? 'selected' : ''}>All Status</option>
                <option value="paid" ${billFilterStatus === 'paid' ? 'selected' : ''}>Paid</option>
                <option value="unpaid" ${billFilterStatus === 'unpaid' ? 'selected' : ''}>Unpaid</option>
            </select>
        </div>
        <table>
            <tr><th>ID</th><th>Customer</th><th>Prev Total</th><th>Prev Balance</th><th>Consumption</th><th>Maintenance</th><th>Total Payable</th><th>Paid</th><th>Due Date</th><th>Status</th><th>Penalty</th><th>Actions</th></tr>
            ${paginatedBills.map(b => {
                const customer = customers.find(c => c.customer_id === b.customer_id);
                return `<tr>
                    <td>${b.bill_id}</td><td>${customer ? customer.name : 'Unknown'}</td>
                    <td>${(b.previous_total_payable || 0).toFixed(2)}</td><td>${(b.previous_balance || 0).toFixed(2)}</td>
                    <td>${(b.consumption_amount || 0).toFixed(2)}</td><td>${(b.maintenance_amount || 200).toFixed(2)}</td>
                    <td>${(b.total_payable_amount || 0).toFixed(2)}</td><td>${(b.paid_amount || 0).toFixed(2)}</td>
                    <td>${b.due_date}</td>
                    <td><span class="status-${b.paid ? 'paid' : 'unpaid'}">${b.paid ? 'Paid' : 'Unpaid'}</span></td>
                    <td>${(b.penalty || 0).toFixed(2)}</td>
                    <td>
                        <button class="btn-edit" onclick="editBill('${b.bill_id}')">Edit</button>
                        <button class="btn-delete" onclick="deleteBill('${b.bill_id}')">Delete</button>
                        <button class="btn-toggle" onclick="togglePaid('${b.bill_id}', ${b.paid}, '${b.customer_id}', ${b.previous_total_payable||0}, ${b.previous_balance||0}, ${b.consumption_amount||0}, ${b.maintenance_amount||200}, ${b.total_payable_amount||0}, ${b.paid_amount||0}, '${b.due_date}', ${b.penalty||0})">${b.paid ? 'Mark Unpaid' : 'Mark Paid'}</button>
                    </td>
                </tr>`;
            }).join('')}
        </table>
        ${renderPagination(billPage, filteredBills.length, 'changeBillPage', 'billingList')}`;
}

let serviceSearchTerm = '';
let serviceFilterField = 'all';

function filterServices(services, customers) {
    if (!serviceSearchTerm) return services;
    const term = serviceSearchTerm.toLowerCase();
    return services.filter(s => {
        const customer = customers.find(c => c.customer_id === s.customer_id);
        const customerName = customer ? customer.name.toLowerCase() : '';
        
        if (serviceFilterField === 'all') {
            return s.service_id.toLowerCase().includes(term) ||
                   customerName.includes(term) ||
                   s.service_type.toLowerCase().includes(term) ||
                   s.details.toLowerCase().includes(term);
        } else if (serviceFilterField === 'customer') {
            return customerName.includes(term);
        } else {
            const value = s[serviceFilterField] || '';
            return value.toString().toLowerCase().includes(term);
        }
    });
}

async function displayServices() {
    const services = await fetchData('/services');
    const customers = await fetchData('/customers');
    const el = document.getElementById('serviceList');
    if (!services || services.length === 0) { el.innerHTML = '<p>No services scheduled yet.</p>'; return; }
    
    const filteredServices = filterServices(services, customers);
    const paginatedServices = paginateData(filteredServices, servicePage);
    
    el.innerHTML = `
        <h3>Scheduled Services (${filteredServices.length} of ${services.length})</h3>
        <div class="search-filter-container">
            <input type="text" id="serviceSearch" placeholder="Search services..." value="${serviceSearchTerm}" 
                   onkeyup="serviceSearchTerm = this.value; servicePage = 1; displayServices();">
            <select id="serviceFilter" onchange="serviceFilterField = this.value; servicePage = 1; displayServices();">
                <option value="all" ${serviceFilterField === 'all' ? 'selected' : ''}>All Fields</option>
                <option value="customer" ${serviceFilterField === 'customer' ? 'selected' : ''}>Customer</option>
                <option value="service_type" ${serviceFilterField === 'service_type' ? 'selected' : ''}>Service Type</option>
                <option value="details" ${serviceFilterField === 'details' ? 'selected' : ''}>Details</option>
            </select>
        </div>
        <table>
            <tr><th>ID</th><th>Customer</th><th>Type</th><th>Details</th><th>Actions</th></tr>
            ${paginatedServices.map(s => {
                const customer = customers.find(c => c.customer_id === s.customer_id);
                return `<tr>
                    <td>${s.service_id}</td><td>${customer ? customer.name : 'Unknown'}</td>
                    <td>${s.service_type}</td><td>${s.details}</td>
                    <td><button class="btn-edit" onclick="editService('${s.service_id}')">Edit</button> <button class="btn-delete" onclick="deleteService('${s.service_id}')">Delete</button></td>
                </tr>`;
            }).join('')}
        </table>
        ${renderPagination(servicePage, filteredServices.length, 'changeServicePage', 'serviceList')}`;
}

// ── Edit Functions ───────────────────────────────────────────────────────────
async function editCustomer(id) {
    const customers = await fetchData('/customers');
    const c = customers.find(c => c.customer_id === id);
    if (c) {
        document.getElementById('customerId').value = c.customer_id;
        document.getElementById('customerName').value = c.name;
        document.getElementById('contact').value = c.contact_person || '';
        document.getElementById('email').value = c.email || '';
        document.getElementById('phone').value = c.phone;
        document.getElementById('address').value = c.address;
        showSection('customers');
        document.getElementById('customerForm').scrollIntoView({ behavior: 'smooth' });
    }
}

async function editMeter(id) {
    const meters = await fetchData('/meters');
    const customers = await fetchData('/customers');
    const m = meters.find(m => m.meter_id === id);
    if (m) {
        const customer = customers.find(c => c.customer_id === m.customer_id);
        document.getElementById('meterId').value = m.meter_id;
        // BUG FIX: use meterCustomerName not customerName
        document.getElementById('meterCustomerName').value = customer ? customer.name : '';
        document.getElementById('meterNumber').value = m.meter_number;
        document.getElementById('previousReading').value = m.previous_reading;
        document.getElementById('currentReading').value = m.current_reading;
        document.getElementById('readingDate').value = m.reading_date;
        calculateConsumption();
        showSection('meters');
        document.getElementById('meterForm').scrollIntoView({ behavior: 'smooth' });
    }
}

async function editBill(id) {
    const bills = await fetchData('/bills');
    const customers = await fetchData('/customers');
    const b = bills.find(b => b.bill_id === id);
    if (b) {
        const customer = customers.find(c => c.customer_id === b.customer_id);
        document.getElementById('billId').value = b.bill_id;
        document.getElementById('customerNameBill').value = customer ? customer.name : '';
        document.getElementById('previousTotalPayable').value = b.previous_total_payable || 0;
        document.getElementById('previousBalance').value = b.previous_balance || 0;
        document.getElementById('consumptionAmount').value = b.consumption_amount || 0;
        document.getElementById('maintenanceAmount').value = b.maintenance_amount || 200;
        document.getElementById('totalPayableAmount').value = b.total_payable_amount || 0;
        document.getElementById('paidAmount').value = b.paid_amount || 0;
        document.getElementById('dueDate').value = b.due_date;
        showSection('financial');
        document.getElementById('billingForm').scrollIntoView({ behavior: 'smooth' });
    }
}

async function editService(id) {
    const services = await fetchData('/services');
    const customers = await fetchData('/customers');
    const service = services.find(item => item.service_id === id);
    if (service) {
        const customer = customers.find(c => c.customer_id === service.customer_id);
        document.getElementById('serviceId').value = service.service_id;
        document.getElementById('serviceCustomerName').value = customer ? customer.name : '';
        document.getElementById('serviceType').value = service.service_type;
        document.getElementById('serviceDetails').value = service.details;
        document.getElementById('serviceStatus').value = service.status || 'scheduled';
        document.getElementById('scheduledDate').value = service.scheduled_date ? service.scheduled_date.split('T')[0] : '';
        showSection('infrastructure');
        document.getElementById('serviceForm').scrollIntoView({ behavior: 'smooth' });
    }
}

// ── Delete Functions ─────────────────────────────────────────────────────────
async function deleteCustomer(id) {
    if (confirm('Delete this customer? This cannot be undone.')) {
        await sendData(`/customers/${id}`, 'DELETE', {});
        addNotification('success', 'Customer Deleted', `Customer ${id} removed.`);
        displayCustomers();
    }
}
async function deleteMeter(id) {
    if (confirm('Delete this meter reading?')) { await sendData(`/meters/${id}`, 'DELETE', {}); displayMeters(); }
}
async function deleteBill(id) {
    if (confirm('Delete this bill?')) { await sendData(`/bills/${id}`, 'DELETE', {}); displayBills(); }
}
async function deleteService(id) {
    if (confirm('Delete this service?')) { await sendData(`/services/${id}`, 'DELETE', {}); displayServices(); }
}

// ── BUG FIX: togglePaid now passes ALL required fields so PUT doesn't null them ──
async function togglePaid(id, currentStatus, customer_id, previous_total_payable,
    previous_balance, consumption_amount, maintenance_amount,
    total_payable_amount, paid_amount, due_date, penalty) {
    await sendData(`/bills/${id}`, 'PUT', {
        customer_id,
        previous_total_payable,
        previous_balance,
        consumption_amount,
        maintenance_amount,
        total_payable_amount,
        paid_amount,
        due_date,
        penalty,
        paid: currentStatus ? 0 : 1
    });
    displayBills();
}

// ── Print Functionality ──────────────────────────────────────────────────────
function printReport() {
    const reportOutput = document.getElementById('reportOutput');
    if (!reportOutput.innerHTML.trim()) {
        alert('No report to print. Please generate a report first.');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>MUWACA Report - Print</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1, h2, h3 { color: #0369a1; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #0369a1; color: white; }
                .report-header { text-align: center; margin-bottom: 30px; }
                .report-footer { text-align: center; margin-top: 30px; font-style: italic; }
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            ${reportOutput.innerHTML}
            <div class="no-print" style="margin-top: 20px; text-align: center;">
                <button onclick="window.print()" style="padding: 10px 20px; background: #0369a1; color: white; border: none; border-radius: 5px; cursor: pointer;">Print</button>
                <button onclick="window.close()" style="padding: 10px 20px; background: #64748b; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">Close</button>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// ── Dark Mode Toggle ──────────────────────────────────────────────────────────
let darkMode = localStorage.getItem('darkMode') === 'true';

function toggleDarkMode() {
    darkMode = !darkMode;
    localStorage.setItem('darkMode', darkMode);
    applyDarkMode();
}

function applyDarkMode() {
    if (darkMode) {
        document.body.classList.add('dark-mode');
        document.getElementById('darkModeToggle').textContent = '☀️ Light Mode';
    } else {
        document.body.classList.remove('dark-mode');
        document.getElementById('darkModeToggle').textContent = '🌙 Dark Mode';
    }
}

// Initialize dark mode on page load
if (darkMode) {
    applyDarkMode();
}

// ── Initial Setup ────────────────────────────────────────────────────────────
showSection('home');
