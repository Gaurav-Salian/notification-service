const amqp = require("amqplib")

let channel

async function initRabbit() {
    const connection = await amqp.connect(process.env.RABBITMQ_URL)

    channel = await connection.createChannel()

    await channel.assertQueue(process.env.QUEUE_NAME, {
        durable:true
    })

    await channel.assertQueue(process.env.DLQ_NAME,{
        durable:true
    })
}

function sendToQueue(data) {
    channel.sendToQueue(
        process.env.QUEUE_NAME,
        Buffer.from(JSON.stringify(data)),
        {
            persistent: true
        }
    )
}

module.exports = {
    initRabbit,
    sendToQueue
}