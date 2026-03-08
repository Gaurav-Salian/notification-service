const webpush = require('web-push');

// const vapidKeys = webpush.generateVAPIDKeys();

webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
)

async function sendPushNotification(subscription, payload) {
    try {
        await webpush.sendNotification(
            subscription,
            JSON.stringify(payload)
        )
    } catch (err){
        console.error("Push notification failed: ", err)

        throw err
    }

}

module.exports = {
    sendPushNotification
}