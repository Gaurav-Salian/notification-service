require('dotenv').config();
require('./scheduler')
const path = require('path')


const express = require("express");
const { initRabbit } = require("./rabbitmq");

const { addClient } = require("./sse");
const notificationRoutes = require('./routes/notifications');

const app = express();

app.use(express.json())

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')))

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'))
})

app.use('/notifications', notificationRoutes);


const PORT = process.env.PORT || 3000;

initRabbit().then(() => {
    app.listen(PORT, () => {
        console.log(`Notification service is running on port ${PORT}`);
    })
})