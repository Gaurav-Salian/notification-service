const cron = require('node-cron')
const { sendToQueue } = require('./rabbitmq')
const db = require('./db')

// global.scheduledNotifications = []

cron.schedule('*/10 * * * * *', () => {
    // const now = Date.now()
    const now = new Date().toISOString()

    // const ready = global.scheduledNotifications.filter(n =>
    //     new Date(n.scheduleAt).getTime() <= now
    // )

    db.all(`SELECT * FROM scheduled_notifications 
        WHERE schedule_at <= ?`, 
        [now], 
        (err, rows) => {
            if (err) {
                console.error("Scheduler DB Error:", err)
                return
            }

    // ready.forEach(n =>{
    //     sendToQueue({
    //         userId: n.userId,
    //         message: n.message,
    //         retries: 0
    //     })
    // })
            rows.forEach(row => {
                sendToQueue({
                    userId: row.user_Id,
                    message: row.message,
                    retries: row.retries
                })

                db.run(`DELETE FROM scheduled_notifications 
                WHERE id = ?`, 
                [row.id]
            )
            })

        // global.scheduledNotifications = global.scheduledNotifications.filter(n =>
        //     new Date(n.scheduleAt).getTime() > now
        // )
        }
    )

})