const clients = []

function addClient(req, res) {

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    })

    clients.push(res)
    console.log(`✅ SSE client connected. Total clients: ${clients.length}`)

    // Handle client disconnect
    req.on('close', () => {
        const index = clients.indexOf(res);
        if (index > -1) {
            clients.splice(index, 1);
        }
        console.log(`❌ SSE client disconnected. Total clients: ${clients.length}`)
    })
}

function sendEvent(data) {
    clients.forEach(client => {
        client.write(`data: ${JSON.stringify(data)}\n\n`)
    })
    console.log(`📡 SSE event broadcasted to ${clients.length} client(s)`)
}

module.exports = {
    addClient,
    sendEvent
}
