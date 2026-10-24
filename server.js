const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const { body, query, validationResult } = require('express-validator');
const db = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is missing from the .env file.');
}

const departments = [
    'Engineering',
    'Human Resources',
    'Design',
    'Marketing',
    'Finance',
    'Operations'
];

const leaveTypes = [
    'Casual Leave',
    'Sick Leave',
    'Earned Leave'
];

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Required when deployed behind Render's proxy.
app.set('trust proxy', 1);

app.use(session({
    name: 'leaveease.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: 'auto',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60
    }
}));

app.use(express.static(path.join(__dirname, 'public')));

function getTodayIST() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());

    const values = {};
    parts.forEach(part => {
        values[part.type] = part.value;
    });

    return `${values.year}-${values.month}-${values.day}`;
}

function isValidDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    return !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value;
}

function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Please correct the invalid input.',
            errors: errors.array().map(error => ({
                field: error.path,
                message: error.msg
            }))
        });
    }

    next();
}

function requireAdmin(req, res, next) {
    if (!req.session || !req.session.adminId) {
        return res.status(401).json({
            success: false,
            message: 'Please log in as an administrator to continue.'
        });
    }

    next();
}

// Health check
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'LeaveEase server is running successfully.'
    });
});

app.get('/api', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Welcome to LeaveEase Leave Request Management System.'
    });
});

app.get('/api/db-test', (req, res) => {
    try {
        const result = db.prepare('SELECT 1 AS connected').get();

        res.status(200).json({
            success: true,
            message: 'SQLite database connected successfully.',
            database: result.connected === 1
        });
    } catch (error) {
        console.error('Database test failed:', error.message);

        res.status(500).json({
            success: false,
            message: 'Database connection failed.'
        });
    }
});

// Employee leave request submission
app.post('/api/leave-requests', [
    body('employee_name')
        .isString().withMessage('Name must be text.')
        .bail()
        .trim()
        .notEmpty().withMessage('Please enter your full name.')
        .bail()
        .isLength({ min: 2, max: 80 })
        .withMessage('Name must contain 2–80 characters.')
        .bail()
        .matches(/^[A-Za-z][A-Za-z '-]*$/)
        .withMessage('Name must start with a letter and contain only letters, spaces, hyphens or apostrophes.'),

    body('email')
        .isString().withMessage('Email must be text.')
        .bail()
        .trim()
        .notEmpty().withMessage('Please enter your email address.')
        .bail()
        .isLength({ max: 254 })
        .withMessage('Email cannot exceed 254 characters.')
        .bail()
        .isEmail().withMessage('Please enter a valid email address.')
        .normalizeEmail(),

    body('department')
        .isString().withMessage('Please select a valid department.')
        .bail()
        .isIn(departments)
        .withMessage('Please select a valid department.'),

    body('leave_type')
        .isString().withMessage('Please select a valid leave type.')
        .bail()
        .isIn(leaveTypes)
        .withMessage('Please select a valid leave type.'),

    body('start_date')
        .isString().withMessage('Please enter a valid start date.')
        .bail()
        .custom(value => {
            if (!isValidDate(value)) {
                throw new Error('Please enter a valid start date.');
            }

            if (value < getTodayIST()) {
                throw new Error('Start date cannot be in the past.');
            }

            return true;
        }),

    body('end_date')
        .isString().withMessage('Please enter a valid end date.')
        .bail()
        .custom(value => {
            if (!isValidDate(value)) {
                throw new Error('Please enter a valid end date.');
            }

            if (value < getTodayIST()) {
                throw new Error('End date cannot be in the past.');
            }

            return true;
        })
        .bail()
        .custom((value, { req }) => {
            if (
                isValidDate(req.body.start_date) &&
                value < req.body.start_date
            ) {
                throw new Error('End date cannot be before the start date.');
            }

            return true;
        }),

    body('reason')
        .isString().withMessage('Reason must be text.')
        .bail()
        .trim()
        .notEmpty().withMessage('Please enter a reason for leave.')
        .bail()
        .isLength({ min: 10, max: 500 })
        .withMessage('Reason must contain 10–500 characters.')
], handleValidationErrors, (req, res) => {
    try {
        const {
            employee_name,
            email,
            department,
            leave_type,
            start_date,
            end_date,
            reason
        } = req.body;

        const result = db.prepare(`
            INSERT INTO leave_requests (
                employee_name,
                email,
                department,
                leave_type,
                start_date,
                end_date,
                reason
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            employee_name,
            email,
            department,
            leave_type,
            start_date,
            end_date,
            reason
        );

        return res.status(201).json({
            success: true,
            message: 'Leave request submitted successfully.',
            requestId: result.lastInsertRowid,
            status: 'Pending'
        });
    } catch (error) {
        console.error('Leave request submission failed:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Unable to submit your request. Please try again.'
        });
    }
});

// Employee leave request history
app.get('/api/leave-requests', [
    query('email')
        .isString().withMessage('Please provide a valid email address.')
        .bail()
        .trim()
        .notEmpty().withMessage('Please provide your email address.')
        .bail()
        .isLength({ max: 254 })
        .withMessage('Email cannot exceed 254 characters.')
        .bail()
        .isEmail().withMessage('Please provide a valid email address.')
], handleValidationErrors, (req, res) => {
    const email = req.query.email.trim().toLowerCase();

    try {
        const requests = db.prepare(`
            SELECT
                id,
                employee_name,
                email,
                department,
                leave_type,
                start_date,
                end_date,
                reason,
                status,
                admin_remark,
                created_at
            FROM leave_requests
            WHERE lower(email) = ?
            ORDER BY id DESC
        `).all(email);

        return res.status(200).json({
            success: true,
            count: requests.length,
            requests
        });
    } catch (error) {
        console.error('Request history retrieval failed:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve leave request history.'
        });
    }
});

// One-time administrator setup
app.post('/api/admin/setup', async (req, res) => {
    try {
        const setupSecret = process.env.ADMIN_SETUP_SECRET;

        if (!setupSecret || req.get('x-admin-setup-secret') !== setupSecret) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden.'
            });
        }

        const adminCount = db.prepare(
            'SELECT COUNT(*) AS count FROM admins'
        ).get().count;

        if (adminCount > 0) {
            return res.status(409).json({
                success: false,
                message: 'Admin setup has already been completed.'
            });
        }

        const { username, password } = req.body;

        if (
            typeof username !== 'string' ||
            !/^[A-Za-z0-9_.-]{3,80}$/.test(username.trim())
        ) {
            return res.status(400).json({
                success: false,
                message: 'Username must be 3–80 valid characters.'
            });
        }

        if (
            typeof password !== 'string' ||
            password.length < 8 ||
            password.length > 200
        ) {
            return res.status(400).json({
                success: false,
                message: 'Password must contain 8–200 characters.'
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        db.prepare(`
            INSERT INTO admins (username, password_hash)
            VALUES (?, ?)
        `).run(username.trim(), passwordHash);

        return res.status(201).json({
            success: true,
            message: 'Administrator account created successfully.'
        });
    } catch (error) {
        console.error('Admin setup failed:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Unable to create administrator account.'
        });
    }
});

// Administrator login
app.post('/api/admin/login', [
    body('username')
        .isString().withMessage('Username must be text.')
        .bail()
        .trim()
        .notEmpty().withMessage('Please enter your username.')
        .bail()
        .isLength({ max: 80 })
        .withMessage('Username cannot exceed 80 characters.'),

    body('password')
        .isString().withMessage('Password must be text.')
        .bail()
        .notEmpty().withMessage('Please enter your password.')
        .bail()
        .isLength({ max: 200 })
        .withMessage('Password is too long.')
], handleValidationErrors, async (req, res) => {
    try {
        const username = req.body.username.trim();
        const password = req.body.password;

        const admin = db.prepare(`
            SELECT id, username, password_hash
            FROM admins
            WHERE username = ?
        `).get(username);

        if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password.'
            });
        }

        req.session.regenerate(error => {
            if (error) {
                console.error('Session creation failed:', error.message);

                return res.status(500).json({
                    success: false,
                    message: 'Unable to create a login session.'
                });
            }

            req.session.adminId = admin.id;
            req.session.adminUsername = admin.username;

            req.session.save(saveError => {
                if (saveError) {
                    console.error('Session save failed:', saveError.message);

                    return res.status(500).json({
                        success: false,
                        message: 'Unable to save the login session.'
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: 'Administrator login successful.',
                    admin: {
                        id: admin.id,
                        username: admin.username
                    }
                });
            });
        });
    } catch (error) {
        console.error('Administrator login failed:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Unable to log in. Please try again.'
        });
    }
});

// Check administrator session
app.get('/api/admin/me', requireAdmin, (req, res) => {
    res.status(200).json({
        success: true,
        admin: {
            id: req.session.adminId,
            username: req.session.adminUsername
        }
    });
});

// Administrator dashboard statistics
app.get('/api/admin/stats', requireAdmin, (req, res) => {
    try {
        const stats = db.prepare(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) AS rejected
            FROM leave_requests
        `).get();

        res.status(200).json({
            success: true,
            stats: {
                total: stats.total,
                pending: stats.pending || 0,
                approved: stats.approved || 0,
                rejected: stats.rejected || 0
            }
        });
    } catch (error) {
        console.error('Dashboard statistics failed:', error.message);

        res.status(500).json({
            success: false,
            message: 'Unable to retrieve dashboard statistics.'
        });
    }
});

// View all leave requests (administrator only)
app.get('/api/admin/leave-requests', requireAdmin, [
    query('status')
        .optional()
        .isString().withMessage('Invalid status filter.')
        .bail()
        .isIn(['Pending', 'Approved', 'Rejected'])
        .withMessage('Status must be Pending, Approved or Rejected.')
], handleValidationErrors, (req, res) => {
    try {
        let requests;

        if (req.query.status) {
            requests = db.prepare(`
                SELECT * FROM leave_requests
                WHERE status = ?
                ORDER BY id DESC
            `).all(req.query.status);
        } else {
            requests = db.prepare(`
                SELECT * FROM leave_requests
                ORDER BY id DESC
            `).all();
        }

        res.status(200).json({
            success: true,
            count: requests.length,
            requests
        });
    } catch (error) {
        console.error('Admin request retrieval failed:', error.message);

        res.status(500).json({
            success: false,
            message: 'Unable to retrieve leave requests.'
        });
    }
});

// Approve or reject a leave request
app.patch('/api/admin/leave-requests/:id', requireAdmin, [
    body('status')
        .isString().withMessage('Status must be text.')
        .bail()
        .isIn(['Approved', 'Rejected'])
        .withMessage('Status must be Approved or Rejected.'),

    body('admin_remark')
        .optional({ values: 'null' })
        .isString().withMessage('Admin remark must be text.')
        .bail()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Admin remark cannot exceed 500 characters.')
], handleValidationErrors, (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({
            success: false,
            message: 'Invalid leave request ID.'
        });
    }

    try {
        const request = db.prepare(`
            SELECT id, status
            FROM leave_requests
            WHERE id = ?
        `).get(id);

        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Leave request not found.'
            });
        }

        const status = req.body.status;
        const adminRemark = req.body.admin_remark || '';

        db.prepare(`
            UPDATE leave_requests
            SET status = ?, admin_remark = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(status, adminRemark, id);

        return res.status(200).json({
            success: true,
            message: `Leave request ${status.toLowerCase()} successfully.`,
            requestId: id,
            status
        });
    } catch (error) {
        console.error('Leave request update failed:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Unable to update the leave request.'
        });
    }
});

// Administrator logout
app.post('/api/admin/logout', requireAdmin, (req, res) => {
    req.session.destroy(error => {
        if (error) {
            console.error('Administrator logout failed:', error.message);

            return res.status(500).json({
                success: false,
                message: 'Unable to log out. Please try again.'
            });
        }

        res.clearCookie('leaveease.sid', {
            httpOnly: true,
            secure: 'auto',
            sameSite: 'lax'
        });

        return res.status(200).json({
            success: true,
            message: 'Administrator logged out successfully.'
        });
    });
});

// Handle unknown routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'The requested route was not found.'
    });
});

app.listen(PORT, () => {
    console.log(`LeaveEase server running on port ${PORT}`);
});