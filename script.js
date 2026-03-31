// MUWACA Water Billing System - JavaScript with Backend API
// FIXED VERSION: duplicate IDs, script path, togglePaid, overdue logic, report rendering

const API_BASE = 'http://localhost:3000/api';

// ── Auth ────────────────────────────────────────────────────────────────────
function checkLogin() {
    const token = localStorage.getItem('authToken');
    token ? showMainContent() : showLoginForm();
}
function showLoginForm() {
    document.getElementById('loginContainer').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
}
function showMainContent() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    loadDashboard();
}

document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('loginError');
    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('authToken', data.token);
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
            errorMsg.textContent = '';
            showMainContent();
        } else {
            errorMsg.textContent = data.error || 'Invalid credentials';
        }
    } catch (error) {
        errorMsg.textContent = 'Login failed. Please try again.';
    }
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
        const customers = await fetchData('/customers');
        const customer = customers.find(c => c.phone === phone);
        
        if (customer) {
            // For demo, accept any PIN. In production, validate against stored PIN
            currentCustomer = customer;
            document.getElementById('customerLoginContainer').style.display = 'none';
            document.getElementById('customerPortal').style.display = 'block';
            document.getElementById('customerNameDisplay').textContent = customer.name;
            loadCustomerData();
            errorMsg.textContent = '';
        } else {
            errorMsg.textContent = 'Customer not found. Please check your phone number.';
        }
    } catch (error) {
        errorMsg.textContent = 'Login failed. Please try again.';
    }
});

document.getElementById('customerLogoutBtn').addEventListener('click', function() {
    currentCustomer = null;
    document.getElementById('customerPortal').style.display = 'none';
    document.getElementById('loginContainer').style.display = 'flex';
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

function showCustomerTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.customer-tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.customer-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(`customer${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`).classList.add('active');
    event.target.classList.add('active');
    
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

document.getElementById('supportForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const type = document.getElementById('supportType').value;
    const message = document.getElementById('supportMessage').value;
    
    // In production, this would send to backend
    alert(`Support request submitted!

Type: ${type}
Message: ${message}

We will contact you soon.`);
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

document.getElementById('checkOverdueBills').addEventListener('click', checkOverdueBills);

// ── Navigation ───────────────────────────────────────────────────────────────
document.getElementById('homeBtn').addEventListener('click', () => showSection('home'));
document.getElementById('customerBtn').addEventListener('click', () => showSection('customers'));
document.getElementById('meterBtn').addEventListener('click', () => showSection('meters'));
document.getElementById('financialBtn').addEventListener('click', () => showSection('financial'));
document.getElementById('infrastructureBtn').addEventListener('click', () => showSection('infrastructure'));
document.getElementById('reportsBtn').addEventListener('click', () => showSection('reports'));

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
function showSection(sectionId) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    if (sectionId === 'home') loadDashboard();
    if (sectionId === 'customers') displayCustomers();
    if (sectionId === 'meters') { populateCustomerNameLists(); displayMeters(); }
    if (sectionId === 'financial') { populateCustomerNameLists(); displayBills(); }
    if (sectionId === 'infrastructure') { populateCustomerNameLists(); displayServices(); }
}

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
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);
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
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
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

// ── Infrastructure Services ──────────────────────────────────────────────────
document.getElementById('infrastructureForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const serviceId = document.getElementById('serviceId').value;
    const customerName = document.getElementById('customerNameInfra').value;
    const customers = await fetchData('/customers');
    const customer = customers.find(c => c.name === customerName);
    if (!customer) { addNotification('error', 'Error', 'Please select a valid customer.'); return; }
    const data = {
        service_id: serviceId || Date.now().toString(),
        customer_id: customer.customer_id,
        service_type: document.getElementById('service').value,
        details: document.getElementById('details').value
    };
    if (serviceId) {
        await sendData(`/services/${serviceId}`, 'PUT', data);
    } else {
        await sendData('/services', 'POST', data);
        addNotification('success', 'Service Scheduled', `${data.service_type} scheduled for ${customer.name}.`);
    }
    document.getElementById('serviceId').value = '';
    this.reset();
    displayServices();
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

document.getElementById('revenueAnalytics').addEventListener('click', async function() {
    const data = await fetchData('/reports/revenue-analytics');
    const prevMonth = await fetchData('/reports/revenue-previous-month');
    displayRevenueReport(data, prevMonth);
});

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
    const s = services.find(s => s.service_id === id);
    if (s) {
        const customer = customers.find(c => c.customer_id === s.customer_id);
        document.getElementById('serviceId').value = s.service_id;
        document.getElementById('customerNameInfra').value = customer ? customer.name : '';
        document.getElementById('service').value = s.service_type;
        document.getElementById('details').value = s.details;
        showSection('infrastructure');
        document.getElementById('infrastructureForm').scrollIntoView({ behavior: 'smooth' });
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
