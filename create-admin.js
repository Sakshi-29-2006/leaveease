const readline = require('readline');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const db = require('./database/db');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise(resolve => rl.question(question, resolve));
}

async function createAdmin() {
    try {
        const username = (await ask('Enter admin username: ')).trim();
        const password = await ask('Enter admin password (minimum 8 characters): ');

        if (!/^[A-Za-z0-9_.-]{3,80}$/.test(username)) {
            throw new Error(
                'Username must be 3–80 characters and contain only letters, numbers, dots, underscores or hyphens.'
            );
        }

        if (password.length < 8 || password.length > 200) {
            throw new Error('Password must contain 8–200 characters.');
        }

        const existingAdmin = db.prepare(
            'SELECT id FROM admins WHERE username = ?'
        ).get(username);

        if (existingAdmin) {
            throw new Error('This administrator username already exists.');
        }

        const passwordHash = await bcrypt.hash(password, 12);

        db.prepare(`
            INSERT INTO admins (username, password_hash)
            VALUES (?, ?)
        `).run(username, passwordHash);

        console.log('\nAdministrator account created successfully.');
        console.log(`Username: ${username}`);
        console.log('You can now sign in through the LeaveEase admin portal.');
    } catch (error) {
        console.error('\nAdmin setup failed:', error.message);
        process.exitCode = 1;
    } finally {
        rl.close();
        db.close();
    }
}

createAdmin();