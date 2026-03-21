const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.')); // Serve static files

// Database setup
const db = new sqlite3.Database('./muwaca.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the SQLite database.');
});

// Create tables for water billing system
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS customers (
        customer_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        contact_person TEXT,
        email TEXT,
        phone TEXT,
        address TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS water_meters (
        meter_id TEXT PRIMARY KEY,
        customer_id TEXT,
        meter_number TEXT,
        previous_reading REAL,
        current_reading REAL,
        consumption_m3 REAL,
        reading_date TEXT,
        FOREIGN KEY (customer_id) REFERENCES customers (customer_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS bills (
        bill_id TEXT PRIMARY KEY,
        customer_id TEXT,
        previous_total_payable REAL DEFAULT 0,
        previous_balance REAL DEFAULT 0,
        consumption_amount REAL DEFAULT 0,
        maintenance_amount REAL DEFAULT 200,
        total_payable_amount REAL DEFAULT 0,
        paid_amount REAL DEFAULT 0,
        due_date TEXT,
        paid BOOLEAN DEFAULT 0,
        penalty REAL DEFAULT 0,
        FOREIGN KEY (customer_id) REFERENCES customers (customer_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS services (
        service_id TEXT PRIMARY KEY,
        customer_id TEXT,
        service_type TEXT,
        details TEXT,
        FOREIGN KEY (customer_id) REFERENCES customers (customer_id)
    )`);
});

// API Routes

// Authentication
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    // Simple hardcoded authentication (for demo purposes)
    // In production, use proper password hashing and database queries
    const validUsers = {
        'admin': 'password123',
        'user': 'user123'
    };
    
    if (validUsers[username] && validUsers[username] === password) {
        // Generate a simple token (in production, use JWT)
        const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
        res.json({ 
            token: token,
            message: 'Login successful'
        });
    } else {
        res.status(401).json({ 
            error: 'Invalid username or password'
        });
    }
});

// Customers
app.get('/api/customers', (req, res) => {
    db.all('SELECT * FROM customers', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/customers', (req, res) => {
    const { customer_id, name, contact_person, email, phone, address } = req.body;
    db.run('INSERT INTO customers (customer_id, name, contact_person, email, phone, address) VALUES (?, ?, ?, ?, ?, ?)',
        [customer_id, name, contact_person, email, phone, address], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

app.put('/api/customers/:id', (req, res) => {
    const { name, contact_person, email, phone, address } = req.body;
    db.run('UPDATE customers SET name = ?, contact_person = ?, email = ?, phone = ?, address = ? WHERE customer_id = ?',
        [name, contact_person, email, phone, address, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
    });
});

app.delete('/api/customers/:id', (req, res) => {
    db.run('DELETE FROM customers WHERE customer_id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
    });
});

// Water Meters
app.get('/api/meters', (req, res) => {
    db.all('SELECT * FROM water_meters', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/meters', (req, res) => {
    const { meter_id, customer_id, meter_number, previous_reading, current_reading, consumption_m3, reading_date } = req.body;
    db.run('INSERT INTO water_meters (meter_id, customer_id, meter_number, previous_reading, current_reading, consumption_m3, reading_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [meter_id, customer_id, meter_number, previous_reading, current_reading, consumption_m3, reading_date], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

app.put('/api/meters/:id', (req, res) => {
    const { customer_id, meter_number, previous_reading, current_reading, consumption_m3, reading_date } = req.body;
    db.run('UPDATE water_meters SET customer_id = ?, meter_number = ?, previous_reading = ?, current_reading = ?, consumption_m3 = ?, reading_date = ? WHERE meter_id = ?',
        [customer_id, meter_number, previous_reading, current_reading, consumption_m3, reading_date, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
    });
});

app.delete('/api/meters/:id', (req, res) => {
    db.run('DELETE FROM water_meters WHERE meter_id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
    });
});

// Bills
app.get('/api/bills', (req, res) => {
    db.all('SELECT * FROM bills', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/bills', (req, res) => {
    const { bill_id, customer_id, previous_total_payable, previous_balance, consumption_amount, maintenance_amount, total_payable_amount, paid_amount, due_date } = req.body;
    db.run('INSERT INTO bills (bill_id, customer_id, previous_total_payable, previous_balance, consumption_amount, maintenance_amount, total_payable_amount, paid_amount, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [bill_id, customer_id, previous_total_payable, previous_balance, consumption_amount, maintenance_amount, total_payable_amount, paid_amount, due_date], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

app.put('/api/bills/:id', (req, res) => {
    const { customer_id, previous_total_payable, previous_balance, consumption_amount, maintenance_amount, total_payable_amount, paid_amount, due_date, paid } = req.body;
    db.run('UPDATE bills SET customer_id = ?, previous_total_payable = ?, previous_balance = ?, consumption_amount = ?, maintenance_amount = ?, total_payable_amount = ?, paid_amount = ?, due_date = ?, paid = ? WHERE bill_id = ?',
        [customer_id, previous_total_payable, previous_balance, consumption_amount, maintenance_amount, total_payable_amount, paid_amount, due_date, paid, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
    });
});

app.delete('/api/bills/:id', (req, res) => {
    db.run('DELETE FROM bills WHERE bill_id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
    });
});

// Calculate penalties - 10% monthly for water billing
app.post('/api/calculate-penalties', (req, res) => {
    const today = new Date();
    db.all('SELECT * FROM bills WHERE paid = 0', [], (err, bills) => {
        if (err) return res.status(500).json({ error: err.message });
        
        bills.forEach(bill => {
            const dueDate = new Date(bill.due_date);
            const monthsOverdue = Math.max(0, Math.floor((today - dueDate) / (1000 * 60 * 60 * 24 * 30)));
            const penalty = bill.amount * 0.10 * monthsOverdue;
            
            db.run('UPDATE bills SET penalty = ? WHERE bill_id = ?', [penalty, bill.bill_id]);
        });
        
        res.json({ message: 'Penalties calculated' });
    });
});

// Services
app.get('/api/services', (req, res) => {
    db.all('SELECT * FROM services', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/services', (req, res) => {
    const { service_id, customer_id, service_type, details } = req.body;
    db.run('INSERT INTO services (service_id, customer_id, service_type, details) VALUES (?, ?, ?, ?)',
        [service_id, customer_id, service_type, details], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

app.put('/api/services/:id', (req, res) => {
    const { customer_id, service_type, details } = req.body;
    db.run('UPDATE services SET customer_id = ?, service_type = ?, details = ? WHERE service_id = ?',
        [customer_id, service_type, details, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
    });
});

app.delete('/api/services/:id', (req, res) => {
    db.run('DELETE FROM services WHERE service_id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
    });
});

// Reports
app.get('/api/reports/payment-history', (req, res) => {
    db.all('SELECT * FROM bills WHERE paid = 1', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/reports/disconnected-customers', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    db.all(`SELECT DISTINCT c.* FROM customers c 
            JOIN bills b ON c.customer_id = b.customer_id 
            WHERE b.paid = 0 AND b.due_date < ?`, [today], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/reports/revenue-analytics', (req, res) => {
    db.get('SELECT SUM(amount) as totalRevenue, SUM(penalty) as totalPenalties FROM bills WHERE paid = 1', [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
    });
});

// Revenue Analytics - Previous Month
app.get('/api/reports/revenue-previous-month', (req, res) => {
    const now = new Date();
    const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfPreviousMonth = new Date(firstDayOfCurrentMonth);
    lastDayOfPreviousMonth.setDate(lastDayOfPreviousMonth.getDate() - 1);
    const firstDayOfPreviousMonth = new Date(lastDayOfPreviousMonth.getFullYear(), lastDayOfPreviousMonth.getMonth(), 1);
    
    const startDate = firstDayOfPreviousMonth.toISOString().split('T')[0];
    const endDate = lastDayOfPreviousMonth.toISOString().split('T')[0];
    
    db.get('SELECT SUM(paid_amount) as previousMonthPaid FROM bills WHERE paid = 1 AND due_date BETWEEN ? AND ?', [startDate, endDate], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ previousMonthPaid: row.previousMonthPaid || 0, period: `${startDate} to ${endDate}` });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});