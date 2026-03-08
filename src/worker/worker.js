require('dotenv').config();

const amqp = require('amqplib');

const { sendPushNotification } = require('../services/pushservice')
const { sendEvent } = require('../sse')

async function startWorker() {
    const connection = await amqp.connect(process.env.RABBITMQ_URL)

    connection.on("error", (err) => {
      console.error("RabbitMQ connection error:", err.message)
    })

    connection.on("close", () => {
      console.error("RabbitMQ connection closed. Reconnecting...")
      setTimeout(startWorker, 5000)
    })

    const channel = await connection.createChannel()

    await channel.assertQueue(process.env.QUEUE_NAME)

    console.log("Worker started. Waiting for notifications...")

    channel.consume(process.env.QUEUE_NAME, async (msg) => {
        const data = JSON.parse(msg.content.toString())
        console.log(`\n📨 Message received for user: ${data.userId}`)
        console.log(`Has subscription: ${!!data.subscription}`)

        try {
            // Check if subscription exists in the message
            if (!data.subscription) {
                console.warn(`❌ No subscription found for user ${data.userId}`)
                console.log(`💡 Make sure you clicked Subscribe button and saved the subscription`)
                // Acknowledge the message anyway to avoid infinite retry
                channel.ack(msg)
                return
            }

            await sendPushNotification(data.subscription, {
                title: "Notification",
                message: data.message,
                timestamp: new Date()
            })
            console.log(`✅ Notification sent to user ${data.userId}: ${data.message}`)

            // Broadcast SSE event to connected clients
            sendEvent({
                type: 'notification_sent',
                userId: data.userId,
                message: data.message,
                timestamp: new Date().toISOString()
            })

            // simulate sending
            await new Promise(r => setTimeout(r, 1000))

            channel.ack(msg)
        } catch (err) {
            if (data.retries < 3) {
                data.retries++

                console.log(`Retrying notification for user ${data.userId}. Attempt ${data.retries}`)

                channel.sendToQueue(
                    process.env.QUEUE_NAME,
                    Buffer.from(JSON.stringify(data)),
                    { persistent: true }
                )

            } else {
                console.error("Moving job to DLQ after 3 failed attempts:", data)

                channel.sendToQueue(
                    process.env.DLQ_NAME,
                    Buffer.from(JSON.stringify({
                        ...data,
                        failedAt: new Date()
                    })),
                    { persistent: true }
                )
            }

            channel.ack(msg)
        }

    })
}

startWorker()