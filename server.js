const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const https = require('https');
const querystring = require('querystring');

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'muwaca-water-billing-secret-key-2026';

// M-Pesa Configuration
const MPESA_CONFIG = {
    consumerKey: process.env.MPESA_CONSUMER_KEY || 'your_consumer_key',
    consumerSecret: process.env.MPESA_CONSUMER_SECRET || 'your_consumer_secret',
    shortcode: process.env.MPESA_SHORTCODE || '174379',
    passkey: process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
    callbackUrl: process.env.MPESA_CALLBACK_URL || 'https://yourdomain.com/api/mpesa/callback',
    environment: process.env.MPESA_ENVIRONMENT || 'sandbox' // 'sandbox' or 'production'
};

// SMS Configuration (Africa's Talking)
const SMS_CONFIG = {
    apiKey: process.env.SMS_API_KEY || 'your_sms_api_key',
    username: process.env.SMS_USERNAME || 'your_sms_username',
    senderId: process.env.SMS_SENDER_ID || 'MUWACA'
};

// Email Configuration (Nodemailer)
const EMAIL_CONFIG = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER || 'your_email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your_email_password'
    },
    from: process.env.EMAIL_FROM || 'MUWACA Water <noreply@muwaca.com>'
};

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.')); // Serve static files

// Rate limiting middleware
const rateLimit = (windowMs, maxRequests) => {
    const requests = new Map();
    
    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        
        if (!requests.has(ip)) {
            requests.set(ip, { count: 1, resetTime: now + windowMs });
        } else {
            const requestData = requests.get(ip);
            if (now > requestData.resetTime) {
                requestData.count = 1;
                requestData.resetTime = now + windowMs;
            } else {
                requestData.count++;
            }
            
            if (requestData.count > maxRequests) {
                return res.status(429).json({ 
                    error: 'Too many requests. Please try again later.',
                    retryAfter: Math.ceil((requestData.resetTime - now) / 1000)
                });
            }
        }
        
        next();
    };
};

// Apply rate limiting to API endpoints
app.use('/api/', rateLimit(15 * 60 * 1000, 100)); // 100 requests per 15 minutes
app.use('/api/login', rateLimit(15 * 60 * 1000, 5)); // 5 login attempts per 15 minutes

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

// Database setup
const db = new sqlite3.Database('./muwaca.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the SQLite database.');
});

// Create tables for water billing system
db.serialize(() => {
    // Users table for authentication
    db.run(`CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Insert default admin user with hashed password
    const defaultPassword = bcrypt.hashSync('password123', 10);
    db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)`,
        ['admin', defaultPassword, 'admin']);

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
        status TEXT DEFAULT 'scheduled',
        scheduled_date TEXT,
        FOREIGN KEY (customer_id) REFERENCES customers (customer_id)
    )`);

    // Create indexes for frequently queried columns
    db.run(`CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_bills_customer_id ON bills(customer_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_bills_due_date ON bills(due_date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_bills_paid ON bills(paid)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_meters_customer_id ON water_meters(customer_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_meters_reading_date ON water_meters(reading_date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_services_customer_id ON services(customer_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_services_status ON services(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_services_scheduled_date ON services(scheduled_date)`);

    // Rate configuration table for dynamic pricing
    db.run(`CREATE TABLE IF NOT EXISTS rate_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rate_type TEXT NOT NULL,
        rate_name TEXT NOT NULL,
        rate_value REAL NOT NULL,
        unit TEXT DEFAULT 'KES',
        effective_date TEXT NOT NULL,
        expiry_date TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Insert default rates if not exists
    db.run(`INSERT OR IGNORE INTO rate_config (rate_type, rate_name, rate_value, unit, effective_date) VALUES (?, ?, ?, ?, ?)`,
        ['consumption', 'Water Consumption Rate', 50, 'KES/m³', '2026-01-01']);
    db.run(`INSERT OR IGNORE INTO rate_config (rate_type, rate_name, rate_value, unit, effective_date) VALUES (?, ?, ?, ?, ?)`,
        ['maintenance', 'Monthly Maintenance Fee', 200, 'KES', '2026-01-01']);
    db.run(`INSERT OR IGNORE INTO rate_config (rate_type, rate_name, rate_value, unit, effective_date) VALUES (?, ?, ?, ?, ?)`,
        ['penalty', 'Late Payment Penalty', 10, '%', '2026-01-01']);
    db.run(`INSERT OR IGNORE INTO rate_config (rate_type, rate_name, rate_value, unit, effective_date) VALUES (?, ?, ?, ?, ?)`,
        ['reconnection', 'Reconnection Fee', 500, 'KES', '2026-01-01']);

    // Create index for rate_config
    db.run(`CREATE INDEX IF NOT EXISTS idx_rate_config_type ON rate_config(rate_type)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_rate_config_active ON rate_config(is_active)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_rate_config_effective ON rate_config(effective_date)`);

    // M-Pesa payments table
    db.run(`CREATE TABLE IF NOT EXISTS mpesa_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_id TEXT,
        customer_id TEXT,
        phone_number TEXT NOT NULL,
        amount REAL NOT NULL,
        mpesa_receipt_number TEXT,
        transaction_id TEXT,
        checkout_request_id TEXT,
        merchant_request_id TEXT,
        result_code INTEGER,
        result_description TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bill_id) REFERENCES bills (bill_id),
        FOREIGN KEY (customer_id) REFERENCES customers (customer_id)
    )`);

    // Create indexes for mpesa_payments
    db.run(`CREATE INDEX IF NOT EXISTS idx_mpesa_bill_id ON mpesa_payments(bill_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_mpesa_customer_id ON mpesa_payments(customer_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_mpesa_status ON mpesa_payments(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_mpesa_checkout_request_id ON mpesa_payments(checkout_request_id)`);

    // Notifications table
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id TEXT,
        type TEXT NOT NULL,
        recipient TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers (customer_id)
    )`);

    // Create indexes for notifications
    db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_customer_id ON notifications(customer_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status)`);
});

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Input Validation Helper
const validateInput = (fields, body) => {
    const errors = [];
    fields.forEach(field => {
        if (!body[field] || body[field].toString().trim() === '') {
            errors.push(`${field} is required`);
        }
    });
    return errors;
};

// API Routes

// Authentication
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    // Input validation
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Query database for user
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        // Verify password
        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { userId: user.user_id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({ 
            token: token,
            message: 'Login successful',
            user: { username: user.username, role: user.role }
        });
    });
});

// Customers
app.get('/api/customers', authenticateToken, (req, res) => {
    db.all('SELECT * FROM customers', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/customers', authenticateToken, (req, res) => {
    const { customer_id, name, contact_person, email, phone, address } = req.body;
    
    // Input validation
    const errors = validateInput(['customer_id', 'name', 'phone'], req.body);
    if (errors.length > 0) {
        return res.status(400).json({ error: errors.join(', ') });
    }
    
    // Email validation if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Phone validation
    if (!/^\+?[0-9]{10,15}$/.test(phone.replace(/\s/g, ''))) {
        return res.status(400).json({ error: 'Invalid phone number format' });
    }
    
    db.run('INSERT INTO customers (customer_id, name, contact_person, email, phone, address) VALUES (?, ?, ?, ?, ?, ?)',
        [customer_id, name, contact_person, email, phone, address], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Customer ID already exists' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID, message: 'Customer created successfully' });
    });
});

app.put('/api/customers/:id', authenticateToken, (req, res) => {
    const { name, contact_person, email, phone, address } = req.body;
    db.run('UPDATE customers SET name = ?, contact_person = ?, email = ?, phone = ?, address = ? WHERE customer_id = ?',
        [name, contact_person, email, phone, address, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
    });
});

app.delete('/api/customers/:id', authenticateToken, (req, res) => {
    db.run('DELETE FROM customers WHERE customer_id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
    });
});

// Water Meters
app.get('/api/meters', authenticateToken, (req, res) => {
    db.all('SELECT * FROM water_meters', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/meters', authenticateToken, (req, res) => {
    const { meter_id, customer_id, meter_number, previous_reading, current_reading, consumption_m3, reading_date } = req.body;
    
    // Input validation
    const errors = validateInput(['meter_id', 'customer_id', 'meter_number', 'reading_date'], req.body);
    if (errors.length > 0) {
        return res.status(400).json({ error: errors.join(', ') });
    }
    
    // Validate numeric readings
    if (isNaN(parseFloat(previous_reading)) || isNaN(parseFloat(current_reading))) {
        return res.status(400).json({ error: 'Readings must be valid numbers' });
    }
    
    if (parseFloat(current_reading) < parseFloat(previous_reading)) {
        return res.status(400).json({ error: 'Current reading cannot be less than previous reading' });
    }
    
    db.run('INSERT INTO water_meters (meter_id, customer_id, meter_number, previous_reading, current_reading, consumption_m3, reading_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [meter_id, customer_id, meter_number, previous_reading, current_reading, consumption_m3, reading_date], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Meter ID already exists' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID, message: 'Meter reading recorded successfully' });
    });
});

app.put('/api/meters/:id', authenticateToken, (req, res) => {
    const { customer_id, meter_number, previous_reading, current_reading, consumption_m3, reading_date } = req.body;
    db.run('UPDATE water_meters SET customer_id = ?, meter_number = ?, previous_reading = ?, current_reading = ?, consumption_m3 = ?, reading_date = ? WHERE meter_id = ?',
        [customer_id, meter_number, previous_reading, current_reading, consumption_m3, reading_date, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
    });
});

app.delete('/api/meters/:id', authenticateToken, (req, res) => {
    db.run('DELETE FROM water_meters WHERE meter_id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
    });
});

// Bills
app.get('/api/bills', authenticateToken, (req, res) => {
    db.all('SELECT * FROM bills', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/bills', authenticateToken, (req, res) => {
    const { bill_id, customer_id, previous_total_payable, previous_balance, consumption_amount, maintenance_amount, total_payable_amount, paid_amount, due_date } = req.body;
    
    // Input validation
    const errors = validateInput(['bill_id', 'customer_id', 'due_date'], req.body);
    if (errors.length > 0) {
        return res.status(400).json({ error: errors.join(', ') });
    }
    
    // Validate numeric amounts
    const numericFields = ['consumption_amount', 'maintenance_amount', 'total_payable_amount'];
    for (const field of numericFields) {
        if (isNaN(parseFloat(req.body[field]))) {
            return res.status(400).json({ error: `${field} must be a valid number` });
        }
    }
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
        return res.status(400).json({ error: 'Due date must be in YYYY-MM-DD format' });
    }
    
    db.run('INSERT INTO bills (bill_id, customer_id, previous_total_payable, previous_balance, consumption_amount, maintenance_amount, total_payable_amount, paid_amount, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [bill_id, customer_id, previous_total_payable, previous_balance, consumption_amount, maintenance_amount, total_payable_amount, paid_amount, due_date], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Bill ID already exists' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID, message: 'Bill created successfully' });
    });
});

app.put('/api/bills/:id', authenticateToken, (req, res) => {
    const { customer_id, previous_total_payable, previous_balance, consumption_amount, maintenance_amount, total_payable_amount, paid_amount, due_date, paid } = req.body;
    db.run('UPDATE bills SET customer_id = ?, previous_total_payable = ?, previous_balance = ?, consumption_amount = ?, maintenance_amount = ?, total_payable_amount = ?, paid_amount = ?, due_date = ?, paid = ? WHERE bill_id = ?',
        [customer_id, previous_total_payable, previous_balance, consumption_amount, maintenance_amount, total_payable_amount, paid_amount, due_date, paid, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
    });
});

app.delete('/api/bills/:id', authenticateToken, (req, res) => {
    db.run('DELETE FROM bills WHERE bill_id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
    });
});

// Calculate penalties - 10% monthly for water billing
app.post('/api/calculate-penalties', authenticateToken, (req, res) => {
    const today = new Date();
    db.all('SELECT * FROM bills WHERE paid = 0', [], (err, bills) => {
        if (err) return res.status(500).json({ error: err.message });
        
        bills.forEach(bill => {
            const dueDate = new Date(bill.due_date);
            const monthsOverdue = Math.max(0, Math.floor((today - dueDate) / (1000 * 60 * 60 * 24 * 30)));
            const penalty = bill.total_payable_amount * 0.10 * monthsOverdue;
            
            db.run('UPDATE bills SET penalty = ? WHERE bill_id = ?', [penalty, bill.bill_id]);
        });
        
        res.json({ message: 'Penalties calculated' });
    });
});

// Services
app.get('/api/services', authenticateToken, (req, res) => {
    db.all('SELECT * FROM services', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/services', authenticateToken, (req, res) => {
    const { service_id, customer_id, service_type, details } = req.body;
    
    // Input validation
    const errors = validateInput(['service_id', 'customer_id', 'service_type', 'details'], req.body);
    if (errors.length > 0) {
        return res.status(400).json({ error: errors.join(', ') });
    }
    
    // Validate service type
    const validServiceTypes = ['pipe_installation', 'meter_installation', 'maintenance', 'repair'];
    if (!validServiceTypes.includes(service_type)) {
        return res.status(400).json({ error: 'Invalid service type' });
    }
    
    const { scheduled_date, status } = req.body;
    db.run('INSERT INTO services (service_id, customer_id, service_type, details, status, scheduled_date) VALUES (?, ?, ?, ?, ?, ?)',
        [service_id, customer_id, service_type, details, status || 'scheduled', scheduled_date || null], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Service ID already exists' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID, message: 'Service scheduled successfully' });
    });
});

app.put('/api/services/:id', authenticateToken, (req, res) => {
    const { customer_id, service_type, details, status, scheduled_date } = req.body;
    db.run('UPDATE services SET customer_id = ?, service_type = ?, details = ?, status = ?, scheduled_date = ? WHERE service_id = ?',
        [customer_id, service_type, details, status || 'scheduled', scheduled_date || null, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
    });
});

app.delete('/api/services/:id', authenticateToken, (req, res) => {
    db.run('DELETE FROM services WHERE service_id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
    });
});

// Rate Management
app.get('/api/rates', authenticateToken, (req, res) => {
    db.all('SELECT * FROM rate_config ORDER BY rate_type, effective_date DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/rates/active', authenticateToken, (req, res) => {
    db.all('SELECT * FROM rate_config WHERE is_active = 1 ORDER BY rate_type', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/rates/:type', authenticateToken, (req, res) => {
    db.get('SELECT * FROM rate_config WHERE rate_type = ? AND is_active = 1 ORDER BY effective_date DESC LIMIT 1', 
        [req.params.type], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Rate not found' });
        res.json(row);
    });
});

app.post('/api/rates', authenticateToken, (req, res) => {
    const { rate_type, rate_name, rate_value, unit, effective_date, expiry_date } = req.body;
    
    if (!rate_type || !rate_name || !rate_value || !effective_date) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Deactivate previous rates of the same type
    db.run('UPDATE rate_config SET is_active = 0 WHERE rate_type = ?', [rate_type], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // Insert new rate
        db.run(`INSERT INTO rate_config (rate_type, rate_name, rate_value, unit, effective_date, expiry_date) 
                VALUES (?, ?, ?, ?, ?, ?)`,
            [rate_type, rate_name, rate_value, unit || 'KES', effective_date, expiry_date],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ id: this.lastID, message: 'Rate created successfully' });
            }
        );
    });
});

app.put('/api/rates/:id', authenticateToken, (req, res) => {
    const { rate_name, rate_value, unit, effective_date, expiry_date, is_active } = req.body;
    
    db.run(`UPDATE rate_config SET rate_name = ?, rate_value = ?, unit = ?, 
            effective_date = ?, expiry_date = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
        [rate_name, rate_value, unit, effective_date, expiry_date, is_active, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ changes: this.changes });
        }
    );
});

app.delete('/api/rates/:id', authenticateToken, (req, res) => {
    db.run('DELETE FROM rate_config WHERE id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
    });
});

// Get current active rate for a specific type
app.get('/api/rates/current/:type', authenticateToken, (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    db.get(`SELECT * FROM rate_config 
            WHERE rate_type = ? AND is_active = 1 
            AND effective_date <= ? 
            AND (expiry_date IS NULL OR expiry_date >= ?)
            ORDER BY effective_date DESC LIMIT 1`,
        [req.params.type, today, today], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'No active rate found' });
        res.json(row);
    });
});

// M-Pesa Payment Integration
// Helper function to get M-Pesa access token
async function getMpesaAccessToken() {
    return new Promise((resolve, reject) => {
        const auth = Buffer.from(`${MPESA_CONFIG.consumerKey}:${MPESA_CONFIG.consumerSecret}`).toString('base64');
        const options = {
            hostname: MPESA_CONFIG.environment === 'production' ? 'api.safaricom.co.ke' : 'sandbox.safaricom.co.ke',
            path: '/oauth/v1/generate?grant_type=client_credentials',
            method: 'GET',
            headers: {
                'Authorization': `Basic ${auth}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve(response.access_token);
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.end();
    });
}

// Initiate M-Pesa STK Push
app.post('/api/mpesa/initiate', authenticateToken, async (req, res) => {
    try {
        const { bill_id, customer_id, phone_number, amount } = req.body;

        if (!bill_id || !customer_id || !phone_number || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Format phone number (remove leading 0 and add 254)
        let formattedPhone = phone_number.replace(/^0/, '254');
        if (!formattedPhone.startsWith('254')) {
            formattedPhone = '254' + formattedPhone;
        }

        const accessToken = await getMpesaAccessToken();
        const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
        const password = Buffer.from(`${MPESA_CONFIG.shortcode}${MPESA_CONFIG.passkey}${timestamp}`).toString('base64');

        const postData = JSON.stringify({
            BusinessShortCode: MPESA_CONFIG.shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: amount,
            PartyA: formattedPhone,
            PartyB: MPESA_CONFIG.shortcode,
            PhoneNumber: formattedPhone,
            CallBackURL: MPESA_CONFIG.callbackUrl,
            AccountReference: `MUWACA-${bill_id}`,
            TransactionDesc: `Water bill payment for ${bill_id}`
        });

        const options = {
            hostname: MPESA_CONFIG.environment === 'production' ? 'api.safaricom.co.ke' : 'sandbox.safaricom.co.ke',
            path: '/mpesa/stkpush/v1/processrequest',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const mpesaReq = https.request(options, (mpesaRes) => {
            let data = '';
            mpesaRes.on('data', (chunk) => { data += chunk; });
            mpesaRes.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    
                    // Save payment request to database
                    db.run(`INSERT INTO mpesa_payments (bill_id, customer_id, phone_number, amount, checkout_request_id, merchant_request_id, status)
                            VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [bill_id, customer_id, formattedPhone, amount, response.CheckoutRequestID, response.MerchantRequestID, 'pending'],
                        function(err) {
                            if (err) console.error('Error saving M-Pesa payment:', err);
                        }
                    );

                    res.json({
                        success: true,
                        checkoutRequestId: response.CheckoutRequestID,
                        merchantRequestId: response.MerchantRequestID,
                        message: 'Payment request sent. Please check your phone.'
                    });
                } catch (e) {
                    res.status(500).json({ error: 'Failed to parse M-Pesa response' });
                }
            });
        });

        mpesaReq.on('error', (e) => {
            res.status(500).json({ error: 'M-Pesa request failed' });
        });

        mpesaReq.write(postData);
        mpesaReq.end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// M-Pesa Callback Handler
app.post('/api/mpesa/callback', (req, res) => {
    try {
        const { Body } = req.body;
        const { stkCallback } = Body;
        const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

        // Find the payment record
        db.get('SELECT * FROM mpesa_payments WHERE checkout_request_id = ?', [CheckoutRequestID], (err, payment) => {
            if (err || !payment) {
                console.error('Payment not found:', CheckoutRequestID);
                return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
            }

            if (ResultCode === 0) {
                // Payment successful
                const metadata = CallbackMetadata.Item;
                const receipt = metadata.find(item => item.Name === 'MpesaReceiptNumber');
                const transactionDate = metadata.find(item => item.Name === 'TransactionDate');
                const phoneNumber = metadata.find(item => item.Name === 'PhoneNumber');

                // Update payment record
                db.run(`UPDATE mpesa_payments SET 
                        mpesa_receipt_number = ?,
                        result_code = ?,
                        result_description = ?,
                        status = 'completed',
                        updated_at = CURRENT_TIMESTAMP
                        WHERE checkout_request_id = ?`,
                    [receipt?.Value, ResultCode, ResultDesc, CheckoutRequestID],
                    function(err) {
                        if (err) console.error('Error updating payment:', err);
                    }
                );

                // Update bill as paid
                db.run(`UPDATE bills SET paid = 1, paid_amount = total_payable_amount WHERE bill_id = ?`,
                    [payment.bill_id],
                    function(err) {
                        if (err) console.error('Error updating bill:', err);
                    }
                );

                console.log(`M-Pesa payment successful: ${receipt?.Value} for bill ${payment.bill_id}`);
            } else {
                // Payment failed
                db.run(`UPDATE mpesa_payments SET 
                        result_code = ?,
                        result_description = ?,
                        status = 'failed',
                        updated_at = CURRENT_TIMESTAMP
                        WHERE checkout_request_id = ?`,
                    [ResultCode, ResultDesc, CheckoutRequestID],
                    function(err) {
                        if (err) console.error('Error updating payment:', err);
                    }
                );

                console.log(`M-Pesa payment failed: ${ResultDesc} for checkout ${CheckoutRequestID}`);
            }
        });

        res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    } catch (error) {
        console.error('M-Pesa callback error:', error);
        res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
});

// Check M-Pesa payment status
app.get('/api/mpesa/status/:checkoutRequestId', authenticateToken, (req, res) => {
    db.get('SELECT * FROM mpesa_payments WHERE checkout_request_id = ?', 
        [req.params.checkoutRequestId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Payment not found' });
        res.json(row);
    });
});

// Get M-Pesa payments for a bill
app.get('/api/mpesa/payments/:billId', authenticateToken, (req, res) => {
    db.all('SELECT * FROM mpesa_payments WHERE bill_id = ? ORDER BY created_at DESC', 
        [req.params.billId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// SMS Notification Endpoints
app.post('/api/notifications/sms', authenticateToken, async (req, res) => {
    try {
        const { phone_number, message, customer_id } = req.body;
        
        if (!phone_number || !message) {
            return res.status(400).json({ error: 'Phone number and message are required' });
        }

        // Format phone number for Kenya
        let formattedPhone = phone_number.replace(/^0/, '254');
        if (!formattedPhone.startsWith('254')) {
            formattedPhone = '254' + formattedPhone;
        }

        // In production, integrate with Africa's Talking or similar SMS gateway
        // For now, we'll simulate sending SMS
        console.log(`📱 SMS to ${formattedPhone}: ${message}`);
        
        // Log notification to database
        db.run(`INSERT INTO notifications (customer_id, type, recipient, message, status) 
                VALUES (?, 'sms', ?, ?, 'sent')`,
            [customer_id, formattedPhone, message],
            function(err) {
                if (err) console.error('Error logging SMS notification:', err);
            }
        );

        res.json({ success: true, message: 'SMS sent successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Email Notification Endpoints
app.post('/api/notifications/email', authenticateToken, async (req, res) => {
    try {
        const { email, subject, message, customer_id } = req.body;
        
        if (!email || !subject || !message) {
            return res.status(400).json({ error: 'Email, subject, and message are required' });
        }

        // In production, integrate with Nodemailer or similar email service
        // For now, we'll simulate sending email
        console.log(`📧 Email to ${email}: ${subject}`);
        console.log(`Message: ${message}`);
        
        // Log notification to database
        db.run(`INSERT INTO notifications (customer_id, type, recipient, message, status) 
                VALUES (?, 'email', ?, ?, 'sent')`,
            [customer_id, email, `${subject}: ${message}`],
            function(err) {
                if (err) console.error('Error logging email notification:', err);
            }
        );

        res.json({ success: true, message: 'Email sent successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Send bulk notifications
app.post('/api/notifications/bulk', authenticateToken, async (req, res) => {
    try {
        const { customer_ids, type, message, subject } = req.body;
        
        if (!customer_ids || !type || !message) {
            return res.status(400).json({ error: 'Customer IDs, type, and message are required' });
        }

        const customers = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM customers WHERE customer_id IN (?)', 
                [customer_ids.join(',')], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        let sentCount = 0;
        for (const customer of customers) {
            if (type === 'sms' && customer.phone) {
                // Send SMS
                let formattedPhone = customer.phone.replace(/^0/, '254');
                if (!formattedPhone.startsWith('254')) {
                    formattedPhone = '254' + formattedPhone;
                }
                console.log(`📱 Bulk SMS to ${formattedPhone}: ${message}`);
                sentCount++;
            } else if (type === 'email' && customer.email) {
                // Send Email
                console.log(`📧 Bulk Email to ${customer.email}: ${subject || 'MUWACA Notification'}`);
                sentCount++;
            }
        }

        res.json({ success: true, message: `Notifications sent to ${sentCount} customers` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get notifications for a customer
app.get('/api/notifications/customer/:customerId', authenticateToken, (req, res) => {
    db.all('SELECT * FROM notifications WHERE customer_id = ? ORDER BY created_at DESC', 
        [req.params.customerId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get all notifications
app.get('/api/notifications', authenticateToken, (req, res) => {
    db.all('SELECT n.*, c.name as customer_name FROM notifications n LEFT JOIN customers c ON n.customer_id = c.customer_id ORDER BY n.created_at DESC LIMIT 100', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Reports
app.get('/api/reports/payment-history', authenticateToken, (req, res) => {
    db.all('SELECT * FROM bills WHERE paid = 1', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/reports/disconnected-customers', authenticateToken, (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    db.all(`SELECT DISTINCT c.* FROM customers c 
            JOIN bills b ON c.customer_id = b.customer_id 
            WHERE b.paid = 0 AND b.due_date < ?`, [today], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/reports/revenue-analytics', authenticateToken, (req, res) => {
    db.get('SELECT SUM(total_payable_amount) as totalRevenue, SUM(penalty) as totalPenalties FROM bills WHERE paid = 1', [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
    });
});

// Revenue Analytics - Previous Month
app.get('/api/reports/revenue-previous-month', authenticateToken, (req, res) => {
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

// Consumption Analytics
app.get('/api/reports/consumption-analytics', authenticateToken, (req, res) => {
    db.all(`SELECT wm.customer_id, c.name, SUM(wm.consumption_m3) as total_consumption,
            AVG(wm.consumption_m3) as avg_consumption, MAX(wm.consumption_m3) as max_consumption,
            COUNT(wm.meter_id) as reading_count
            FROM water_meters wm
            JOIN customers c ON wm.customer_id = c.customer_id
            GROUP BY wm.customer_id
            ORDER BY total_consumption DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ── Export Functionality ──────────────────────────────────────────────────────

// Export Payment History to PDF
app.get('/api/export/payment-history/pdf', authenticateToken, async (req, res) => {
    try {
        const bills = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM bills WHERE paid = 1', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        const customers = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM customers', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=payment-history.pdf');
        doc.pipe(res);
        
        // Header
        doc.fontSize(20).text('MUWACA WATER ENTERPRISES', { align: 'center' });
        doc.fontSize(16).text('Payment History Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString('en-KE')}`, { align: 'center' });
        doc.moveDown(2);
        
        // Table
        const tableTop = 200;
        const tableLeft = 50;
        const colWidths = [80, 120, 100, 100, 100];
        
        // Table header
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Bill ID', tableLeft, tableTop);
        doc.text('Customer', tableLeft + colWidths[0], tableTop);
        doc.text('Billed Amount', tableLeft + colWidths[0] + colWidths[1], tableTop);
        doc.text('Paid Amount', tableLeft + colWidths[0] + colWidths[1] + colWidths[2], tableTop);
        doc.text('Due Date', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableTop);
        
        // Table rows
        doc.font('Helvetica');
        let y = tableTop + 25;
        bills.forEach(bill => {
            const customer = customers.find(c => c.customer_id === bill.customer_id);
            doc.text(bill.bill_id, tableLeft, y);
            doc.text(customer ? customer.name : 'Unknown', tableLeft + colWidths[0], y);
            doc.text(`KES ${(bill.total_payable_amount || 0).toFixed(2)}`, tableLeft + colWidths[0] + colWidths[1], y);
            doc.text(`KES ${(bill.paid_amount || 0).toFixed(2)}`, tableLeft + colWidths[0] + colWidths[1] + colWidths[2], y);
            doc.text(bill.due_date || '—', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], y);
            y += 20;
        });
        
        // Footer
        doc.moveDown(2);
        doc.fontSize(8).text('End of Payment History Report — MUWACA Water Enterprises', { align: 'center' });
        
        doc.end();
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

// Export Payment History to Excel
app.get('/api/export/payment-history/excel', authenticateToken, async (req, res) => {
    try {
        const bills = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM bills WHERE paid = 1', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        const customers = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM customers', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Payment History');
        
        // Add title
        worksheet.mergeCells('A1:E1');
        worksheet.getCell('A1').value = 'MUWACA WATER ENTERPRISES';
        worksheet.getCell('A1').font = { size: 16, bold: true };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };
        
        worksheet.mergeCells('A2:E2');
        worksheet.getCell('A2').value = 'Payment History Report';
        worksheet.getCell('A2').font = { size: 14, bold: true };
        worksheet.getCell('A2').alignment = { horizontal: 'center' };
        
        worksheet.mergeCells('A3:E3');
        worksheet.getCell('A3').value = `Generated: ${new Date().toLocaleDateString('en-KE')}`;
        worksheet.getCell('A3').alignment = { horizontal: 'center' };
        
        // Add headers
        worksheet.addRow([]);
        const headerRow = worksheet.addRow(['Bill ID', 'Customer', 'Billed Amount', 'Paid Amount', 'Due Date']);
        headerRow.font = { bold: true };
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF0369A1' }
            };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        });
        
        // Add data
        bills.forEach(bill => {
            const customer = customers.find(c => c.customer_id === bill.customer_id);
            worksheet.addRow([
                bill.bill_id,
                customer ? customer.name : 'Unknown',
                bill.total_payable_amount || 0,
                bill.paid_amount || 0,
                bill.due_date || '—'
            ]);
        });
        
        // Set column widths
        worksheet.columns = [
            { width: 15 },
            { width: 25 },
            { width: 18 },
            { width: 18 },
            { width: 15 }
        ];
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=payment-history.xlsx');
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate Excel file' });
    }
});

// Export Disconnected Customers to PDF
app.get('/api/export/disconnected-customers/pdf', authenticateToken, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const customers = await new Promise((resolve, reject) => {
            db.all(`SELECT DISTINCT c.* FROM customers c 
                    JOIN bills b ON c.customer_id = b.customer_id 
                    WHERE b.paid = 0 AND b.due_date < ?`, [today], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        const bills = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM bills', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=disconnected-customers.pdf');
        doc.pipe(res);
        
        // Header
        doc.fontSize(20).text('MUWACA WATER ENTERPRISES', { align: 'center' });
        doc.fontSize(16).text('Disconnected Customers Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString('en-KE')}`, { align: 'center' });
        doc.moveDown(2);
        
        // Table
        const tableTop = 200;
        const tableLeft = 50;
        const colWidths = [60, 100, 80, 100, 60, 80];
        
        // Table header
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('ID', tableLeft, tableTop);
        doc.text('Name', tableLeft + colWidths[0], tableTop);
        doc.text('Phone', tableLeft + colWidths[0] + colWidths[1], tableTop);
        doc.text('Address', tableLeft + colWidths[0] + colWidths[1] + colWidths[2], tableTop);
        doc.text('Unpaid Bills', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableTop);
        doc.text('Total Owed', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], tableTop);
        
        // Table rows
        doc.font('Helvetica');
        let y = tableTop + 25;
        customers.forEach(customer => {
            const unpaidBills = bills.filter(b => b.customer_id === customer.customer_id && !b.paid);
            const totalOwed = unpaidBills.reduce((sum, b) => sum + (b.total_payable_amount || 0) + (b.penalty || 0), 0);
            
            doc.text(customer.customer_id, tableLeft, y);
            doc.text(customer.name, tableLeft + colWidths[0], y);
            doc.text(customer.phone || '—', tableLeft + colWidths[0] + colWidths[1], y);
            doc.text(customer.address || '—', tableLeft + colWidths[0] + colWidths[1] + colWidths[2], y);
            doc.text(unpaidBills.length.toString(), tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], y);
            doc.text(`KES ${totalOwed.toFixed(2)}`, tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], y);
            y += 20;
        });
        
        // Footer
        doc.moveDown(2);
        doc.fontSize(8).text('End of Disconnected Customers Report — MUWACA Water Enterprises', { align: 'center' });
        
        doc.end();
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

// Export Revenue Analytics to PDF
app.get('/api/export/revenue-analytics/pdf', authenticateToken, async (req, res) => {
    try {
        const data = await new Promise((resolve, reject) => {
            db.get('SELECT SUM(total_payable_amount) as totalRevenue, SUM(penalty) as totalPenalties FROM bills WHERE paid = 1', [], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=revenue-analytics.pdf');
        doc.pipe(res);
        
        // Header
        doc.fontSize(20).text('MUWACA WATER ENTERPRISES', { align: 'center' });
        doc.fontSize(16).text('Revenue Analytics Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString('en-KE')}`, { align: 'center' });
        doc.moveDown(2);
        
        // Summary
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('Financial Summary', { underline: true });
        doc.moveDown();
        
        doc.font('Helvetica');
        doc.fontSize(11);
        doc.text(`Total Revenue Collected: KES ${(data?.totalRevenue || 0).toFixed(2)}`);
        doc.text(`Total Penalties Charged: KES ${(data?.totalPenalties || 0).toFixed(2)}`);
        doc.moveDown();
        doc.font('Helvetica-Bold');
        doc.text(`Grand Total: KES ${((data?.totalRevenue || 0) + (data?.totalPenalties || 0)).toFixed(2)}`);
        
        // Footer
        doc.moveDown(2);
        doc.fontSize(8).text('End of Revenue Analytics Report — MUWACA Water Enterprises', { align: 'center' });
        
        doc.end();
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

// ── Data Backup and Restore ──────────────────────────────────────────────────

// Backup database
app.get('/api/backup', authenticateToken, (req, res) => {
    const backupPath = path.join(__dirname, 'muwaca_backup.db');
    
    // Create backup by copying database file
    const source = db.name;
    const destination = backupPath;
    
    fs.copyFile(source, destination, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to create backup' });
        }
        
        res.download(backupPath, 'muwaca_backup.db', (err) => {
            if (err) {
                console.error('Download error:', err);
            }
            // Clean up backup file after download
            fs.unlink(backupPath, () => {});
        });
    });
});

// Restore database from backup
app.post('/api/restore', (req, res) => {
    if (!req.files || !req.files.backup) {
        return res.status(400).json({ error: 'No backup file provided' });
    }
    
    const backupFile = req.files.backup;
    const restorePath = path.join(__dirname, 'muwaca.db');
    
    // Validate file extension
    if (!backupFile.name.endsWith('.db')) {
        return res.status(400).json({ error: 'Invalid file format. Only .db files are allowed' });
    }
    
    // Move uploaded file to database location
    backupFile.mv(restorePath, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to restore database' });
        }
        
        // Reconnect to database
        db.close(() => {
            db = new sqlite3.Database('./muwaca.db', (err) => {
                if (err) {
                    console.error('Database reconnection error:', err);
                }
                console.log('Database restored and reconnected.');
            });
        });
        
        res.json({ message: 'Database restored successfully' });
    });
});

// Export all data as JSON
app.get('/api/export/json', authenticateToken, async (req, res) => {
    try {
        const customers = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM customers', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        const meters = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM water_meters', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        const bills = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM bills', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        const services = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM services', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        const exportData = {
            exportDate: new Date().toISOString(),
            version: '1.0.0',
            data: {
                customers,
                meters,
                bills,
                services
            }
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=muwaca_export.json');
        res.json(exportData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to export data' });
    }
});

// Import data from JSON
app.post('/api/import/json', authenticateToken, async (req, res) => {
    try {
        const { data } = req.body;
        
        if (!data || !data.customers || !data.meters || !data.bills || !data.services) {
            return res.status(400).json({ error: 'Invalid import data format' });
        }
        
        // Clear existing data
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM services', [], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM bills', [], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM water_meters', [], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM customers', [], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Import customers
        for (const customer of data.customers) {
            await new Promise((resolve, reject) => {
                db.run('INSERT INTO customers (customer_id, name, contact_person, email, phone, address) VALUES (?, ?, ?, ?, ?, ?)',
                    [customer.customer_id, customer.name, customer.contact_person, customer.email, customer.phone, customer.address],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
            });
        }
        
        // Import meters
        for (const meter of data.meters) {
            await new Promise((resolve, reject) => {
                db.run('INSERT INTO water_meters (meter_id, customer_id, meter_number, previous_reading, current_reading, consumption_m3, reading_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [meter.meter_id, meter.customer_id, meter.meter_number, meter.previous_reading, meter.current_reading, meter.consumption_m3, meter.reading_date],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
            });
        }
        
        // Import bills
        for (const bill of data.bills) {
            await new Promise((resolve, reject) => {
                db.run('INSERT INTO bills (bill_id, customer_id, previous_total_payable, previous_balance, consumption_amount, maintenance_amount, total_payable_amount, paid_amount, due_date, paid, penalty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [bill.bill_id, bill.customer_id, bill.previous_total_payable, bill.previous_balance, bill.consumption_amount, bill.maintenance_amount, bill.total_payable_amount, bill.paid_amount, bill.due_date, bill.paid, bill.penalty],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
            });
        }
        
        // Import services
        for (const service of data.services) {
            await new Promise((resolve, reject) => {
                db.run('INSERT INTO services (service_id, customer_id, service_type, details) VALUES (?, ?, ?, ?)',
                    [service.service_id, service.customer_id, service.service_type, service.details],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
            });
        }
        
        res.json({ message: 'Data imported successfully', counts: { customers: data.customers.length, meters: data.meters.length, bills: data.bills.length, services: data.services.length } });
    } catch (error) {
        res.status(500).json({ error: 'Failed to import data' });
    }
});