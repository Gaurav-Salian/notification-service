const express = require("express");
const router = express.Router();

const redis = require('../redis');
const { sendToQueue } = require('../rabbitmq');
const { addClient } = require('../sse')
const db = require('../db')


router.get('/', (req,res)=>{
  res.send("Notifications API working")
})

router.get('/vapid-key', (req, res) => {
  res.json({ vapidKey: process.env.VAPID_PUBLIC_KEY })
})

router.post('/', async (req ,res) => {
    const { userId, message, scheduleAt } = req.body;

    if (!userId || !message) {
        return res.status(400).json({ error: "userId and message required"})
    }

    const minute = Math.floor(Date.now() / 60000)

    const key = `rate:${userId}:${minute}`

    const count = await redis.incr(key)

    if (count ===1) {
        await redis.expire(key, 60)
    }

    if (count > 5) {
        return res.status(429).json({ error: "Too Many Requests."})
    }

    if (scheduleAt) {
        // global.scheduledNotifications.push({
        //     userId,
        //     message,
        //     scheduleAt
        // })
        await db.run(`INSERT INTO scheduled_notifications 
        (user_id, message, schedule_at) 
        VALUES (?, ?, ?)`,[userId, message, scheduleAt]
        )

        return res.json({ status: "scheduled"})
    }

    // Get user's subscription from database
    db.get(
        `SELECT subscription FROM subscriptions WHERE userId = ?`,
        [userId],
        (err, row) => {
            if (err) {
                console.error(`❌ Database error for user ${userId}:`, err);
                return res.status(500).json({ error: "Database error" });
            }

            const userSubscription = row ? JSON.parse(row.subscription) : null;
            
            console.log(`📤 Sending to queue for user ${userId}. Has subscription: ${!!userSubscription}`)
            
            sendToQueue({ 
                userId,
                message,
                subscription: userSubscription, 
                retries: 0
            })

            res.json({ status: "queued" })
        }
    )
})

router.get('/stream', (req, res) => {
    addClient(req, res)
})

router.post("/subscriptions", (req, res) => {
    const {userId, subscription} = req.body

    if (!userId || !subscription) {
        return res.status(400).json({ error: "userId and subscription required"})
    }

    const subscriptionJson = JSON.stringify(subscription)

    db.run(
        `INSERT INTO subscriptions (userId, subscription) VALUES (?, ?)
         ON CONFLICT(userId) DO UPDATE SET 
         subscription = excluded.subscription,
         updatedAt = CURRENT_TIMESTAMP`,
        [userId, subscriptionJson],
        (err) => {
            if (err) {
                console.error(`❌ Error saving subscription for user ${userId}:`, err);
                return res.status(500).json({ error: "Failed to save subscription" })
            }

            console.log(`✅ Subscription stored in database for user ${userId}`)
            console.log(`📋 Subscription ID: ${subscription.endpoint}`)
            
            res.json({ status: "subscribed"})
        }
    )
})

router.delete("/subscriptions/:userId", (req, res) => {
    const { userId } = req.params

    if (!userId) {
        return res.status(400).json({ error: "userId required"})
    }

    db.run(
        `DELETE FROM subscriptions WHERE userId = ?`,
        [userId],
        function(err) {
            if (err) {
                console.error(`❌ Error deleting subscription for user ${userId}:`, err);
                return res.status(500).json({ error: "Failed to delete subscription" })
            }

            console.log(`✅ Subscription deleted for user ${userId}`)
            res.json({ status: "unsubscribed", deleted: this.changes })
        }
    )
})

router.get("/subscriptions", (req, res) => {
    db.all(
        `SELECT userId, createdAt, updatedAt FROM subscriptions`,
        (err, rows) => {
            if (err) {
                console.error("❌ Error fetching subscriptions:", err);
                return res.status(500).json({ error: "Failed to fetch subscriptions" })
            }

            console.log(`📊 Total users with subscriptions: ${rows.length}`)
            res.json({ 
                total: rows.length,
                subscriptions: rows
            })
        }
    )
})

router.get("/subscriptions/:userId", (req, res) => {
    const { userId } = req.params

    db.get(
        `SELECT userId, createdAt, updatedAt FROM subscriptions WHERE userId = ?`,
        [userId],
        (err, row) => {
            if (err) {
                console.error(`❌ Error fetching subscription for user ${userId}:`, err);
                return res.status(500).json({ error: "Failed to fetch subscription" })
            }

            if (!row) {
                return res.status(404).json({ error: "Subscription not found" })
            }

            res.json(row)
        }
    )
})

module.exports = router;