// MUWACA Water Billing System - JavaScript with Backend API

// API Base URL
const API_BASE = 'http://localhost:3000/api';

// Auth Management
function checkLogin() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        showLoginForm();
    } else {
        showMainContent();
    }
}

function showLoginForm() {
    document.getElementById('loginContainer').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
}

function showMainContent() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
}

// Login Form Handler
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
        console.error('Login error:', error);
    }
});

// Logout Handler
document.getElementById('logoutBtn').addEventListener('click', function() {
    localStorage.removeItem('authToken');
    showLoginForm();
});

// Check login status on page load
window.addEventListener('load', function() {
    checkLogin();
    displayNotifications();
});

// Event listener for checking overdue bills
document.getElementById('checkOverdueBills').addEventListener('click', checkOverdueBills);

// Navigation
document.getElementById('homeBtn').addEventListener('click', () => showSection('home'));
document.getElementById('customerBtn').addEventListener('click', () => showSection('customers'));
document.getElementById('meterBtn').addEventListener('click', () => showSection('meters'));
document.getElementById('financialBtn').addEventListener('click', () => showSection('financial'));
document.getElementById('infrastructureBtn').addEventListener('click', () => showSection('infrastructure'));
document.getElementById('reportsBtn').addEventListener('click', () => showSection('reports'));

// Notification System
let notifications = [];

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
    const notification = {
        id: Date.now(),
        type: type,
        title: title,
        message: message,
        customerId: customerId,
        timestamp: new Date(),
        read: false
    };
    
    notifications.unshift(notification);
    displayNotifications();
    
    // Auto-remove after 30 seconds for success notifications
    if (type === 'success') {
        setTimeout(() => {
            removeNotification(notification.id);
        }, 30000);
    }
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
    
    container.innerHTML = notifications.map(notification => `
        <div class="notification-item ${notification.type}">
            <div class="notification-title">${notification.title}</div>
            <div class="notification-message">${notification.message}</div>
            <div class="notification-time">${formatTime(notification.timestamp)}</div>
        </div>
    `).join('');
}

function formatTime(date) {
    return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });
}

// Simulate phone notification (in real implementation, this would integrate with SMS service)
async function sendPhoneNotification(customerId, message, type = 'bill_generated') {
    try {
        // Get customer details
        const customers = await fetchData('/customers');
        const customer = customers.find(c => c.customer_id === customerId);
        
        if (!customer || !customer.phone) {
            console.warn(`No phone number found for customer ${customerId}`);
            return false;
        }
        
        // In a real implementation, this would call an SMS API like Twilio or Africa's Talking
        console.log(`📱 SENDING PHONE NOTIFICATION:`);
        console.log(`To: ${customer.phone} (${customer.name})`);
        console.log(`Message: ${message}`);
        console.log(`Type: ${type}`);
        console.log(`---`);
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return true;
    } catch (error) {
        console.error('Phone notification failed:', error);
        return false;
    }
}

// Check for overdue bills and send notifications
async function checkOverdueBills() {
    try {
        const bills = await fetchData('/bills');
        const customers = await fetchData('/customers');
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        
        // Check if it's the 10th of the month or later
        const isAfter10th = currentDate.getDate() >= 10;
        
        let overdueCount = 0;
        
        for (const bill of bills) {
            const dueDate = new Date(bill.due_date);
            const billMonth = dueDate.getMonth();
            const billYear = dueDate.getFullYear();
            
            // Check if bill is unpaid and due in previous months or current month before 10th
            const isOverdue = !bill.paid && (
                (billYear < currentYear) || 
                (billYear === currentYear && billMonth < currentMonth) ||
                (billYear === currentYear && billMonth === currentMonth && !isAfter10th)
            );
            
            if (isOverdue) {
                const customer = customers.find(c => c.customer_id === bill.customer_id);
                if (customer) {
                    const message = `MUWACA WATER: Your bill of KES ${bill.total_payable_amount?.toFixed(2) || '0.00'} is overdue. Please pay immediately to avoid disconnection. Due: ${dueDate.toLocaleDateString()}`;
                    
                    // Send phone notification
                    const phoneSent = await sendPhoneNotification(customer.customer_id, message, 'overdue_bill');
                    
                    if (phoneSent) {
                        addNotification('warning', 'Overdue Bill Notification Sent', 
                            `Phone notification sent to ${customer.name} (${customer.phone}) for overdue bill of KES ${bill.total_payable_amount?.toFixed(2) || '0.00'}`, 
                            customer.customer_id);
                        overdueCount++;
                    }
                }
            }
        }
        
        if (overdueCount === 0) {
            addNotification('success', 'Overdue Bill Check Complete', 'No overdue bills found requiring notification.');
        } else {
            addNotification('warning', 'Overdue Bill Notifications Sent', `${overdueCount} overdue bill notification(s) sent via phone.`);
        }
        
    } catch (error) {
        console.error('Error checking overdue bills:', error);
        addNotification('error', 'Error Checking Overdue Bills', 'Failed to check for overdue bills. Please try again.');
    }
}

// Show section function
// Populate customer name datalists for forms
async function populateCustomerNameLists() {
    const customers = await fetchData('/customers');
    const customerNames = customers.map(c => c.name);
    
    // Meter form datalist
    const meterDatalist = document.getElementById('customerNamesList');
    if (meterDatalist) {
        meterDatalist.innerHTML = customerNames.map(name => `<option value="${name}">`).join('');
    }
    
    // Billing form datalist
    const billingDatalist = document.getElementById('customerNamesListBill');
    if (billingDatalist) {
        billingDatalist.innerHTML = customerNames.map(name => `<option value="${name}">`).join('');
    }
    
    // Infrastructure form datalist
    const infraDatalist = document.getElementById('customerNamesListInfra');
    if (infraDatalist) {
        infraDatalist.innerHTML = customerNames.map(name => `<option value="${name}">`).join('');
    }
}

function showSection(sectionId) {
    document.querySelectorAll('section').forEach(section => section.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    
    // Load data when sections are opened
    if (sectionId === 'customers') {
        displayCustomers();
    }
    if (sectionId === 'meters') {
        populateCustomerNameLists();
        displayMeters();
    }
    if (sectionId === 'financial') {
        populateCustomerNameLists();
        displayBills();
    }
    if (sectionId === 'infrastructure') {
        populateCustomerNameLists();
        displayServices();
    }
}

// Fetch data from API
async function fetchData(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching data:', error);
        return [];
    }
}

// Send data to API
async function sendData(endpoint, method, data) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (error) {
        console.error('Error sending data:', error);
        return null;
    }
}

// Customer Registration
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
    } else {
        await sendData('/customers', 'POST', data);
    }
    
    document.getElementById('customerId').value = '';
    this.reset();
    displayCustomers();
});

// Meter Management - Auto-fill previous reading when customer name is entered
document.getElementById('customerName').addEventListener('input', async function() {
    const customerName = this.value;
    if (!customerName) return;
    
    const customers = await fetchData('/customers');
    const customer = customers.find(c => c.name === customerName);
    
    if (customer) {
        // Get the latest meter reading for this customer
        const meters = await fetchData('/meters');
        const customerMeters = meters.filter(m => m.customer_id === customer.customer_id);
        const latestMeter = customerMeters.sort((a, b) => new Date(b.reading_date) - new Date(a.reading_date))[0];
        
        if (latestMeter) {
            // Move current reading to previous reading
            document.getElementById('previousReading').value = latestMeter.current_reading;
            document.getElementById('currentReading').value = '';
            document.getElementById('meterNumber').value = latestMeter.meter_number;
        }
        // Clear reading date
        document.getElementById('readingDate').value = '';
    }
});

document.getElementById('meterForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const meterId = document.getElementById('meterId').value;
    const customerName = document.getElementById('customerName').value;
    const customers = await fetchData('/customers');
    const customer = customers.find(c => c.name === customerName);
    const customerId = customer ? customer.customer_id : '';
    
    const previousReading = parseFloat(document.getElementById('previousReading').value);
    const currentReading = document.getElementById('currentReading').value ? parseFloat(document.getElementById('currentReading').value) : 0;
    const consumption = currentReading - previousReading;
    
    const data = {
        meter_id: meterId || Date.now().toString(),
        customer_id: customerId,
        meter_number: document.getElementById('meterNumber').value,
        previous_reading: previousReading,
        current_reading: currentReading,
        consumption_m3: consumption,
        reading_date: document.getElementById('readingDate').value
    };
    
    if (meterId) {
        await sendData(`/meters/${meterId}`, 'PUT', data);
    } else {
        await sendData('/meters', 'POST', data);
    }
    
    document.getElementById('meterId').value = '';
    this.reset();
    displayMeters();
});

// Auto-calculate consumption when readings change
function calculateConsumption() {
    const previousReading = parseFloat(document.getElementById('previousReading').value) || 0;
    const currentReading = parseFloat(document.getElementById('currentReading').value) || 0;
    const consumption = currentReading - previousReading;
    document.getElementById('consumption').value = consumption.toFixed(2);
}

document.getElementById('previousReading').addEventListener('input', calculateConsumption);
document.getElementById('currentReading').addEventListener('input', calculateConsumption);

// Financial Tracking - Billing
document.getElementById('billingForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const billId = document.getElementById('billId').value;
    const customerName = document.getElementById('customerNameBill').value;
    const customers = await fetchData('/customers');
    const customer = customers.find(c => c.name === customerName);
    const customerId = customer ? customer.customer_id : '';
    
    // Get customer's latest meter reading to calculate consumption amount
    const meters = await fetchData('/meters');
    const customerMeters = meters.filter(m => m.customer_id === customerId);
    const latestMeter = customerMeters.sort((a, b) => new Date(b.reading_date) - new Date(a.reading_date))[0];
    
    const consumptionAmount = latestMeter ? latestMeter.consumption_m3 * 160 : 0;
    const maintenanceAmount = 200;
    const previousBalance = parseFloat(document.getElementById('previousBalance').value) || 0;
    const totalPayableAmount = consumptionAmount + maintenanceAmount + previousBalance;
    
    const data = {
        bill_id: billId || Date.now().toString(),
        customer_id: customerId,
        previous_total_payable: parseFloat(document.getElementById('previousTotalPayable').value) || 0,
        previous_balance: previousBalance,
        consumption_amount: consumptionAmount,
        maintenance_amount: maintenanceAmount,
        total_payable_amount: totalPayableAmount,
        paid_amount: parseFloat(document.getElementById('paidAmount').value) || 0,
        due_date: document.getElementById('dueDate').value
};
    
    if (billId) {
        await sendData(`/bills/${billId}`, 'PUT', data);
        addNotification('success', 'Bill Updated', `Bill ${billId} has been updated successfully.`);
    } else {
        await sendData('/bills', 'POST', data);
        
        // Send immediate notification to customer
        const customers = await fetchData('/customers');
        const customer = customers.find(c => c.customer_id === customerId);
        
        if (customer) {
            const message = `MUWACA WATER: New bill generated. Total Amount: KES ${totalPayableAmount.toFixed(2)}. Due Date: ${new Date(data.due_date).toLocaleDateString()}. Please pay on time to avoid penalties.`;
            
            // Send phone notification
            const phoneSent = await sendPhoneNotification(customerId, message, 'bill_generated');
            
            if (phoneSent) {
                addNotification('success', 'Bill Generated & Notification Sent', 
                    `Bill generated for ${customer.name} and phone notification sent to ${customer.phone}. Amount: KES ${totalPayableAmount.toFixed(2)}`, 
                    customerId);
            } else {
                addNotification('warning', 'Bill Generated', 
                    `Bill generated for ${customer.name} but phone notification failed. Amount: KES ${totalPayableAmount.toFixed(2)}`, 
                    customerId);
            }
        } else {
            addNotification('success', 'Bill Generated', `New bill generated successfully. Amount: KES ${totalPayableAmount.toFixed(2)}`);
        }
    }
    
    document.getElementById('billId').value = '';
    this.reset();
    displayBills();
});

// Auto-populate billing fields when customer name is entered
document.getElementById('customerNameBill').addEventListener('input', async function() {
    const customerName = this.value;
    if (!customerName) return;
    
    const customers = await fetchData('/customers');
    const customer = customers.find(c => c.name === customerName);
    if (!customer) return;
    
    const customerId = customer.customer_id;
    
    // Get customer's previous bills to calculate previous balance
    const bills = await fetchData('/bills');
    const customerBills = bills.filter(b => b.customer_id === customerId);
    
    if (customerBills.length > 0) {
        const latestBill = customerBills.sort((a, b) => new Date(b.due_date) - new Date(a.due_date))[0];
        document.getElementById('previousTotalPayable').value = latestBill.total_payable_amount || 0;
        document.getElementById('previousBalance').value = (latestBill.total_payable_amount - latestBill.paid_amount) || 0;
    }
    
    // Get customer's latest meter reading to calculate consumption amount
    const meters = await fetchData('/meters');
    const customerMeters = meters.filter(m => m.customer_id === customerId);
    const latestMeter = customerMeters.sort((a, b) => new Date(b.reading_date) - new Date(a.reading_date))[0];
    
    if (latestMeter) {
        const consumptionAmount = latestMeter.consumption_m3 * 160;
        document.getElementById('consumptionAmount').value = consumptionAmount.toFixed(2);
        const maintenanceAmount = 200;
        const previousBalance = parseFloat(document.getElementById('previousBalance').value) || 0;
        const totalPayableAmount = consumptionAmount + maintenanceAmount + previousBalance;
        document.getElementById('totalPayableAmount').value = totalPayableAmount.toFixed(2);
    }
});

document.getElementById('calculatePenalties').addEventListener('click', async function() {
    await sendData('/calculate-penalties', 'POST', {});
    displayBills();
});

// Infrastructure Services
document.getElementById('infrastructureForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const serviceId = document.getElementById('serviceId').value;
    const customerName = document.getElementById('customerNameInfra').value;
    const customers = await fetchData('/customers');
    const customer = customers.find(c => c.name === customerName);
    const customerId = customer ? customer.customer_id : '';
    
    const data = {
        service_id: serviceId || Date.now().toString(),
        customer_id: customerId,
        service_type: document.getElementById('service').value,
        details: document.getElementById('details').value
};
    
    if (serviceId) {
        await sendData(`/services/${serviceId}`, 'PUT', data);
    } else {
        await sendData('/services', 'POST', data);
    }
    
    document.getElementById('serviceId').value = '';
    this.reset();
    displayServices();
});

// Reports
document.getElementById('paymentHistory').addEventListener('click', async function() {
    const data = await fetchData('/reports/payment-history');
    displayReport('Payment History', data);
});

document.getElementById('disconnectedClients').addEventListener('click', async function() {
    const data = await fetchData('/reports/disconnected-customers');
    displayReport('Disconnected Customers', data);
});

document.getElementById('revenueAnalytics').addEventListener('click', async function() {
    const data = await fetchData('/reports/revenue-analytics');
    const previousMonthData = await fetchData('/reports/revenue-previous-month');
    const reportData = {
        currentRevenue: data,
        previousMonth: previousMonthData
    };
    displayReport('Revenue Analytics', reportData);
});

// Display functions
async function displayCustomers() {
    const customers = await fetchData('/customers');
    const customerList = document.getElementById('customerList');
    if (!customers || customers.length === 0) {
        customerList.innerHTML = '<p>No customers registered yet.</p>';
        return;
    }
    customerList.innerHTML = '<h3>Registered Customers</h3><table><tr><th>ID</th><th>Name</th><th>Contact</th><th>Email</th><th>Actions</th></tr>' +
        customers.map(customer => `<tr><td>${customer.customer_id}</td><td>${customer.name}</td><td>${customer.contact_person}</td><td>${customer.email}</td><td><button class="btn-edit" onclick="editCustomer('${customer.customer_id}')">Edit</button> <button class="btn-delete" onclick="deleteCustomer('${customer.customer_id}')">Delete</button></td></tr>`).join('') +
        '</table>';
}

async function displayMeters() {
    const meters = await fetchData('/meters');
    const customers = await fetchData('/customers');
    const meterList = document.getElementById('meterList');
    if (!meters || meters.length === 0) {
        meterList.innerHTML = '<p>No meter readings recorded yet.</p>';
        return;
    }
    meterList.innerHTML = '<h3>Water Meter Readings</h3><table><tr><th>ID</th><th>Customer Name</th><th>Meter Number</th><th>Previous Reading (m³)</th><th>Current Reading (m³)</th><th>Consumption (m³)</th><th>Reading Date</th><th>Actions</th></tr>' +
        meters.map(meter => {
            const customer = customers.find(c => c.customer_id === meter.customer_id);
            const customerName = customer ? customer.name : 'Unknown';
            return `<tr><td>${meter.meter_id}</td><td>${customerName}</td><td>${meter.meter_number}</td><td>${meter.previous_reading}</td><td>${meter.current_reading}</td><td>${meter.consumption_m3}</td><td>${meter.reading_date}</td><td><button class="btn-edit" onclick="editMeter('${meter.meter_id}')">Edit</button> <button class="btn-delete" onclick="deleteMeter('${meter.meter_id}')">Delete</button></td></tr>`;
        }).join('') +
        '</table>';
}

async function displayBills() {
    const bills = await fetchData('/bills');
    const customers = await fetchData('/customers');
    const billingList = document.getElementById('billingList');
    if (!bills || bills.length === 0) {
        billingList.innerHTML = '<p>No bills generated yet.</p>';
        return;
    }
    billingList.innerHTML = '<h3>Billing Details</h3><table><tr><th>ID</th><th>Customer Name</th><th>Previous Total</th><th>Previous Balance</th><th>Consumption Amount</th><th>Maintenance Amount</th><th>Total Payable</th><th>Paid Amount</th><th>Due Date</th><th>Status</th><th>Penalty</th><th>Actions</th></tr>' +
        bills.map(bill => {
            const customer = customers.find(c => c.customer_id === bill.customer_id);
            const customerName = customer ? customer.name : 'Unknown';
            return `<tr><td>${bill.bill_id}</td><td>${customerName}</td><td>${(bill.previous_total_payable || 0).toFixed(2)}</td><td>${(bill.previous_balance || 0).toFixed(2)}</td><td>${(bill.consumption_amount || 0).toFixed(2)}</td><td>${(bill.maintenance_amount || 200).toFixed(2)}</td><td>${(bill.total_payable_amount || 0).toFixed(2)}</td><td>${(bill.paid_amount || 0).toFixed(2)}</td><td>${bill.due_date}</td><td><span class="status-${bill.paid ? 'paid' : 'unpaid'}">${bill.paid ? 'Paid' : 'Unpaid'}</span></td><td>${(bill.penalty || 0).toFixed(2)}</td><td><button class="btn-edit" onclick="editBill('${bill.bill_id}')">Edit</button> <button class="btn-delete" onclick="deleteBill('${bill.bill_id}')">Delete</button> <button class="btn-toggle" onclick="togglePaid('${bill.bill_id}', ${bill.paid})">${bill.paid ? 'Mark Unpaid' : 'Mark Paid'}</button></td></tr>`;
        }).join('') +
        '</table>';
}

async function displayServices() {
    const services = await fetchData('/services');
    const customers = await fetchData('/customers');
    const serviceList = document.getElementById('serviceList');
    if (!services || services.length === 0) {
        serviceList.innerHTML = '<p>No services scheduled yet.</p>';
        return;
    }
    serviceList.innerHTML = '<h3>Scheduled Services</h3><table><tr><th>ID</th><th>Customer Name</th><th>Type</th><th>Details</th><th>Actions</th></tr>' +
        services.map(service => {
            const customer = customers.find(c => c.customer_id === service.customer_id);
            const customerName = customer ? customer.name : 'Unknown';
            return `<tr><td>${service.service_id}</td><td>${customerName}</td><td>${service.service_type}</td><td>${service.details}</td><td><button class="btn-edit" onclick="editService('${service.service_id}')">Edit</button> <button class="btn-delete" onclick="deleteService('${service.service_id}')">Delete</button></td></tr>`;
        }).join('') +
        '</table>';
}

function displayReport(title, data) {
    const reportOutput = document.getElementById('reportOutput');
    reportOutput.innerHTML = `<h3>${title}</h3><pre>${JSON.stringify(data, null, 2)}</pre>`;
}

// Edit functions
async function editCustomer(id) {
    const customers = await fetchData('/customers');
    const customer = customers.find(c => c.customer_id === id);
    if (customer) {
        document.getElementById('customerId').value = customer.customer_id;
        document.getElementById('customerName').value = customer.name;
        document.getElementById('contact').value = customer.contact_person || '';
        document.getElementById('email').value = customer.email || '';
        document.getElementById('phone').value = customer.phone;
        document.getElementById('address').value = customer.address;
        document.getElementById('customerForm').scrollIntoView({ behavior: 'smooth' });
    }
}

async function editMeter(id) {
    const meters = await fetchData('/meters');
    const customers = await fetchData('/customers');
    const meter = meters.find(m => m.meter_id === id);
    if (meter) {
        const customer = customers.find(c => c.customer_id === meter.customer_id);
        document.getElementById('meterId').value = meter.meter_id;
        document.getElementById('customerName').value = customer ? customer.name : '';
        document.getElementById('meterNumber').value = meter.meter_number;
        document.getElementById('previousReading').value = meter.previous_reading;
        document.getElementById('currentReading').value = meter.current_reading;
        document.getElementById('readingDate').value = meter.reading_date;
        calculateConsumption();
        document.getElementById('meterForm').scrollIntoView({ behavior: 'smooth' });
    }
}

async function editBill(id) {
    const bills = await fetchData('/bills');
    const customers = await fetchData('/customers');
    const bill = bills.find(b => b.bill_id === id);
    if (bill) {
        const customer = customers.find(c => c.customer_id === bill.customer_id);
        document.getElementById('billId').value = bill.bill_id;
        document.getElementById('customerNameBill').value = customer ? customer.name : '';
        document.getElementById('previousTotalPayable').value = bill.previous_total_payable || 0;
        document.getElementById('previousBalance').value = bill.previous_balance || 0;
        document.getElementById('consumptionAmount').value = bill.consumption_amount || 0;
        document.getElementById('maintenanceAmount').value = bill.maintenance_amount || 200;
        document.getElementById('totalPayableAmount').value = bill.total_payable_amount || 0;
        document.getElementById('paidAmount').value = bill.paid_amount || 0;
        document.getElementById('dueDate').value = bill.due_date;
        document.getElementById('billingForm').scrollIntoView({ behavior: 'smooth' });
    }
}

async function editService(id) {
    const services = await fetchData('/services');
    const customers = await fetchData('/customers');
    const service = services.find(s => s.service_id === id);
    if (service) {
        const customer = customers.find(c => c.customer_id === service.customer_id);
        document.getElementById('serviceId').value = service.service_id;
        document.getElementById('customerNameInfra').value = customer ? customer.name : '';
        document.getElementById('service').value = service.service_type;
        document.getElementById('details').value = service.details;
        document.getElementById('infrastructureForm').scrollIntoView({ behavior: 'smooth' });
    }
}

// Delete functions
async function deleteCustomer(id) {
    if (confirm('Are you sure you want to delete this customer?')) {
        await sendData(`/customers/${id}`, 'DELETE', {});
        displayCustomers();
    }
}

async function deleteMeter(id) {
    if (confirm('Are you sure you want to delete this meter reading?')) {
        await sendData(`/meters/${id}`, 'DELETE', {});
        displayMeters();
    }
}

async function deleteBill(id) {
    if (confirm('Are you sure you want to delete this bill?')) {
        await sendData(`/bills/${id}`, 'DELETE', {});
        displayBills();
    }
}

async function deleteService(id) {
    if (confirm('Are you sure you want to delete this service?')) {
        await sendData(`/services/${id}`, 'DELETE', {});
        displayServices();
    }
}

// Toggle paid status
async function togglePaid(id, currentStatus) {
    await sendData(`/bills/${id}`, 'PUT', { paid: !currentStatus });
    displayBills();
}

// Initial setup - show home section
showSection('home');