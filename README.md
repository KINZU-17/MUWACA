# MUWACA Water Billing System

**Aqua Project** - Professional Water Billing Solution

A comprehensive water billing management system designed for water utility companies to manage customer subscriptions, meter readings, billing, and infrastructure services.

## What is the MUWACA Water Billing System?

The system focuses on **MUWACA WATER ENTERPRISES**, a water utility company that provides water supply and manages billing for residential and commercial customers across Kenya.

The system is designed to handle the following:

* **Customer Registration:** Managing details of residential and commercial water customers.
* **Meter Management:** Tracking water meters and monthly consumption readings (in cubic meters - m³).
* **Financial Tracking:** Automating monthly billing, processing payments, and calculating a **10% monthly penalty** for overdue balances.
* **Infrastructure:** Managing water pipes, valves, and maintenance/repair services.
* **Reporting:** Generating professional reports like payment histories, disconnected customers, and consumption analytics.

## System Architecture

The system is built with a modern architecture:

| Component | Description |
| :--- | :--- |
| **Frontend** | HTML, CSS, JavaScript with responsive design and dark mode support |
| **Backend** | Node.js with Express REST API |
| **Database** | SQLite with proper relationships and normalization (3NF) |
| **Security** | JWT authentication, password hashing, input validation |

## Key Features

* **Customer Management:** Register, edit, delete customers with full CRUD operations
* **Meter Management:** Record and manage water meter readings with consumption tracking (m³)
* **Financial Tracking:** Generate bills, calculate 10% monthly penalties for overdue balances, mark payments
* **Infrastructure:** Schedule water pipe installations, meter installations, maintenance, and repairs
* **Reports:** Payment history, disconnected customers, and consumption analytics
* **Export:** PDF and Excel export for all reports
* **Search & Filter:** Advanced search and filter functionality
* **Pagination:** Efficient handling of large datasets
* **Dark Mode:** Toggle between light and dark themes
* **Print:** Print reports directly from browser

## System Analysis

### Problem Analysis
MUWACA WATER ENTERPRISES needs a system to manage customer subscriptions, meter readings, billing, and infrastructure services. Manual processes are inefficient, leading to errors in billing and service tracking. The system automates these processes, ensures data integrity, and provides comprehensive reporting capabilities.

### Objectives
- Register and manage customer information
- Record and track water meter readings (consumption in m³)
- Generate and track bills with automatic penalty calculations
- Schedule and manage water infrastructure services
- Generate professional reports for decision-making
- Export data to PDF and Excel formats
- Provide secure authentication and authorization

### Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    CUSTOMERS ||--o{ WATER_METERS : has
    CUSTOMERS ||--o{ BILLS : generates
    CUSTOMERS ||--o{ SERVICES : requests

    CUSTOMERS {
        string customer_id PK
        string name
        string contact_person
        string email
        string phone
        string address
    }

    WATER_METERS {
        string meter_id PK
        string customer_id FK
        string meter_number
        decimal consumption_m3
        date reading_date
    }

    BILLS {
        string bill_id PK
        string customer_id FK
        decimal amount
        date due_date
        boolean paid
        decimal penalty
    }

    SERVICES {
        string service_id PK
        string customer_id FK
        string service_type
        string details
    }
```

### Database Normalization (3NF)
The database is normalized to Third Normal Form (3NF):

1. **First Normal Form (1NF):** All attributes are atomic, no repeating groups
2. **Second Normal Form (2NF):** All non-key attributes are fully dependent on the primary key
3. **Third Normal Form (3NF):** No transitive dependencies exist

- **CUSTOMERS Table:** All attributes (name, contact_person, email, phone, address) depend directly on customer_id
- **WATER_METERS Table:** meter_number, consumption_m3, and reading_date depend on meter_id; customer_id is a foreign key
- **BILLS Table:** amount, due_date, paid, penalty depend on bill_id; customer_id is a foreign key
- **SERVICES Table:** service_type and details depend on service_id; customer_id is a foreign key

No transitive dependencies (e.g., no attribute depends on another non-key attribute).

### Data Flow Diagram (DFD)

```mermaid
flowchart TD
    A[Customer] --> B[Register Customer]
    B --> C[(Customers DB)]
    A --> D[Provide Meter Reading]
    D --> E[Record Reading]
    E --> F[(Meters DB)]
    A --> G[Request Service]
    G --> H[Schedule Service]
    H --> I[(Services DB)]
    J[Administrator] --> K[Generate Bill]
    K --> L[(Bills DB)]
    J --> M[Calculate Penalties]
    M --> L
    J --> N[Generate Reports]
    N --> O[Payment History]
    N --> P[Disconnected Customers]
    N --> Q[Consumption Analytics]
    C --> N
    F --> N
    L --> N
    I --> N
```

## Implementation

### Web Application with Backend

The system is implemented as a full-stack web application:

- **Frontend:** HTML, CSS, JavaScript with responsive design and dark mode support
- **Backend:** Node.js with Express REST API
- **Database:** SQLite with proper relationships and normalization (3NF)
- **Security:** JWT authentication, password hashing, input validation

#### Running the Application

1. Install dependencies: `npm install`
2. Start the backend: `npm start` (runs on http://localhost:3000)
3. Serve the frontend: `python3 -m http.server 8000` (runs on http://localhost:8000)
4. Open http://localhost:8000 in your browser

#### Features Implemented

- **Switchboard Navigation:** Home page with clickable buttons for easy access to all modules
- **Customer Management:** Register, edit, delete customers with full CRUD operations
- **Meter Management:** Record and manage water meter readings with consumption tracking (m³)
- **Financial Tracking:** Generate bills, calculate 10% monthly penalties for overdue balances, mark payments
- **Infrastructure:** Schedule water pipe installations, meter installations, maintenance, and repairs
- **Reports:** Payment history, disconnected customers, and consumption analytics
- **Export:** PDF and Excel export for all reports
- **Search & Filter:** Advanced search and filter functionality
- **Pagination:** Efficient handling of large datasets
- **Dark Mode:** Toggle between light and dark themes
- **Print:** Print reports directly from browser
- **Data Backup:** Backup and restore database functionality
- **Accessibility:** ARIA labels and keyboard navigation support

### Database Schema

The SQLite database includes the following tables:
- `customers`: Customer information
- `water_meters`: Meter readings and consumption tracking
- `bills`: Billing records with penalty calculations
- `services`: Infrastructure and maintenance services
- `users`: Authentication and authorization

All tables are normalized to 3NF with proper foreign key relationships.