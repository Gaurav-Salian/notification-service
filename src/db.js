const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database("./notifications.db")

    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS scheduled_notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_Id TEXT,
            message TEXT,
            schedule_At TEXT,
            retries INTEGER DEFAULT 0
            )
            `)
        
        db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId TEXT UNIQUE NOT NULL,
            subscription TEXT NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            `)
    })

    module.exports = db;