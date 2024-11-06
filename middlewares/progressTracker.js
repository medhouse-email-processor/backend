let clients = {} // for storing requesting clients for progress monitoring

exports.monitorFetchProgress = async (req, res) => {
    const googleUserId = req.user.googleUserId
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    // adding the client when connected
    clients[googleUserId] = res
    // removing the client when disconnected
    req.on('close', () => {
        delete clients[googleUserId]
    })
}

// Function to send progress updates to all clients
exports.sendProgressUpdate = (googleUserId, message) => {
    const client = clients[googleUserId]
    if (client) {
        client.write(`data: ${JSON.stringify(message)}\n\n`)
    }
}