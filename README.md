# Notification Service

A real-time push notification service built with Node.js, Express, RabbitMQ, and Web Push API.

## Features

- 🔔 **Push Notifications** - Send real-time notifications to browsers
- 📋 **Subscription Management** - Store and manage user subscriptions in SQLite
- 🔄 **Message Queuing** - Reliable message delivery with RabbitMQ
- ⏱️ **Scheduled Notifications** - Schedule notifications for later delivery
- 🛡️ **Rate Limiting** - Prevent spam with Redis-based rate limiting (5 notifications/min per user)
- ♻️ **Retry Logic** - Automatic retry with dead letter queue (DLQ) after 3 attempts
- � **Real-time Updates** - Server-Sent Events (SSE) for live notification status
- 🖥️ **Web UI** - Simple frontend with subscription validation and real-time feedback

## Architecture

```
┌─────────────────┐
│   Frontend      │
│  (index.html)   │
└────────┬────────┘
         │
┌────────▼────────────────────┐
│   Express Server            │
│  - API Routes              │
│  - Static Files            │
└────────┬───────────────────┘
         │
    ┌────┴────┬──────────┬──────────┐
    │          │          │          │
┌───▼──┐  ┌───▼──┐  ┌───▼──┐  ┌───▼──┐
│SQLite│  │Redis │  │Queue │  │Cron  │
│  DB  │  │      │  │(AMQP)│  │      │
└──────┘  └──────┘  └──┬───┘  └──────┘
                       │
                   ┌───▼─────┐
                   │  Worker  │
                   │ (Process)│
                   └────┬─────┘
                        │
                   ┌────▼──────────┐
                   │  Web Push API  │
                   │  (Browsers)    │
                   └────────────────┘
```

## Prerequisites

- **Node.js** (v14+)
- **RabbitMQ** - Message broker
- **Redis** - Rate limiting & caching
- Modern browser with Service Worker support

## Installation

1. Clone the repository
```bash
git clone https://github.com/Gaurav-Salian/notification-service
cd notification-service
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables
```bash
cp .env.example .env
```

Edit `.env`:
```env
PORT=3000
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost
QUEUE_NAME=notification_queue
DLQ_NAME=notification_dlq

VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_EMAIL=your_email@example.com
```

### Generate VAPID Keys

```bash
node -e "const webpush = require('web-push'); console.log(webpush.generateVAPIDKeys())"
```

## Setup Services

### RabbitMQ

- Windows: Download from https://www.rabbitmq.com/download.html
- Mac: `brew install rabbitmq`
- Linux: `sudo apt install rabbitmq-server`

Access management UI at: http://localhost:15672 (guest/guest)

### Redis

- Windows: Download from https://github.com/microsoftarchive/redis/releases
- Mac: `brew install redis`
- Linux: `sudo apt install redis-server`

## Usage

### Start the Service

```bash
npm start
```

The server will start on `http://localhost:3000`

### Frontend UI

1. Open `http://localhost:3000` in your browser
2. Enter a **User ID** (e.g., `user123`)
3. Click **Subscribe** button
4. Allow browser notifications when prompted
5. Subscription status displays: `✅ Subscribed as user123`
6. **Send Notification** button becomes enabled
7. Enter a message and click **Send Notification**
8. Real-time status updates appear automatically via SSE

**Note:** The Send button is disabled until you subscribe. This ensures users understand they need to subscribe first.

### API Endpoints

#### Subscribe to Notifications
```bash
POST /notifications/subscriptions
Content-Type: application/json

{
  "userId": "user123",
  "subscription": {
    "endpoint": "https://...",
    "keys": { "p256dh": "...", "auth": "..." }
  }
}
```

#### Send Notification
```bash
POST /notifications
Content-Type: application/json

{
  "userId": "user123",
  "message": "Hello, this is a test notification"
}
```

#### Send Scheduled Notification
```bash
POST /notifications
Content-Type: application/json

{
  "userId": "user123",
  "message": "Delayed notification",
  "scheduleAt": "2024-03-10T15:30:00Z"
}
```

#### Get All Subscriptions
```bash
GET /notifications/subscriptions
```

Response:
```json
{
  "total": 2,
  "subscriptions": [
    {
      "userId": "user123",
      "createdAt": "2024-03-08T10:00:00Z",
      "updatedAt": "2024-03-08T10:00:00Z"
    }
  ]
}
```

#### Get User Subscription
```bash
GET /notifications/subscriptions/:userId
```

#### Delete Subscription
```bash
DELETE /notifications/subscriptions/:userId
```

#### Get VAPID Public Key
```bash
GET /notifications/vapid-key
```

## Database Schema

### subscriptions table
```sql
CREATE TABLE subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT UNIQUE NOT NULL,
  subscription TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### scheduled_notifications table
```sql
CREATE TABLE scheduled_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_Id TEXT,
  message TEXT,
  schedule_At TEXT,
  retries INTEGER DEFAULT 0
)
```

## File Structure

```
notification-service2/
├── src/
│   ├── server.js              # Express server setup
│   ├── db.js                  # SQLite database config
│   ├── redis.js               # Redis client
│   ├── rabbitmq.js            # RabbitMQ producer
│   ├── scheduler.js           # Cron job for scheduled notifications
│   ├── worker.js              # Message worker process
│   ├── sse.js                 # Server-Sent Events (real-time updates)
│   ├── routes/
│   │   └── notifications.js   # API routes
│   ├── services/
│   │   └── pushservice.js     # Web Push notification sender
│   ├── worker/
│   │   └── worker.js          # Background worker
│   └── public/
│       ├── index.html         # Frontend UI
│       └── sw.js              # Service Worker
├── .env                       # Environment variables
├── package.json
└── notifications.db           # SQLite database (auto-created)
```

## How It Works

### Notification Flow

1. **User subscribes** via frontend
   - Browser requests notification permission
   - Service Worker is registered
   - Push subscription object is created
   - Subscription sent to backend and stored in database

2. **Notification is sent**
   - POST request to `/notifications` endpoint
   - Rate limit checked (Redis)
   - Message added to RabbitMQ queue

3. **Real-time SSE updates**
   - Frontend automatically connects to `/notifications/stream` on page load
   - SSE broadcasts notification events to all connected clients
   - Auto-reconnect on disconnect
   - Real-time status messages in browser

4. **Worker processes message**
   - Worker listens to RabbitMQ queue
   - Retrieves user subscription from database
   - Sends push notification via Web Push API
   - **Broadcasts SSE event** to connected clients with result
   - On failure: retries up to 3 times
   - After 3 failures: moves to Dead Letter Queue (DLQ)

5. **Browser receives notification**
   - Service Worker receives push event
   - Displays notification to user
   - Handles notification clicks

### Scheduled Notifications

1. Message stored in database with schedule time
2. Cron job runs every 10 seconds
3. Checks for messages scheduled before current time
4. Moves messages to queue for processing
5. Messages processed as normal

### Real-time Updates (SSE)

- **Automatic connection**: Frontend connects to `/notifications/stream` on page load
- **Live events**: When the worker sends a notification, an SSE event broadcasts to all connected clients
- **Event data**:
  ```json
  {
    "type": "notification_sent",
    "userId": "user123",
    "message": "Your message here",
    "timestamp": "2024-03-08T15:30:00.000Z"
  }
  ```
- **Auto-reconnect**: If connection drops, automatically attempts to reconnect every 5 seconds

## Error Handling

- **No subscription found**: Message acknowledged, user prompted to subscribe
- **Send without subscription**: Frontend blocks with clear error message
- **Send failure**: Automatic retry up to 3 times with logging
- **Rate limit exceeded**: Returns 429 (Too Many Requests)
- **Missing fields**: Returns 400 (Bad Request)

## Frontend Features

### Subscription Validation
- **Send button disabled** until user subscribes
- **Status indicator** shows subscription state
- **Error messages** guide users when attempting to send without subscription

### Real-time Feedback
- **Status messages** appear for all actions (subscribe, send, errors)
- **Live SSE updates** from server show when notifications are delivered
- **Auto-dismiss** success messages after 4 seconds
- **Persistent errors** until user acknowledges

## Troubleshooting

### Service Worker not registering
- Check browser console for errors
- Ensure HTTPS or localhost
- Clear browser cache and service workers

### Notifications not displaying
- Check browser notification settings
- Verify user is subscribed
- Open server console to see worker logs

### RabbitMQ connection error
- Ensure RabbitMQ is running
- Check `RABBITMQ_URL` in `.env`
- Default: `amqp://localhost`

### Redis connection error
- Ensure Redis is running
- Check `REDIS_URL` in `.env`
- Default: `redis://localhost:6379`

### Database errors
- Delete `notifications.db` to reset
- Check file permissions in project directory

## Development

### Start with nodemon
```bash
npm start
```

### View RabbitMQ Management
- Navigate to: http://localhost:15672
- Username: `guest`
- Password: `guest`

### Monitor Worker
```bash
nodemon src/worker/worker.js
```

### Console Logs
The service outputs detailed logs:
```
✅ Subscription stored in database for user user123
📤 Sending to queue for user user123. Has subscription: true
📨 Message received for user: user123
✅ Notification sent to user user123: Hello world
```

## Performance

- **Rate Limited**: 5 notifications per user per minute
- **Retry Policy**: 3 attempts with exponential backoff
- **Dead Letter Queue**: Failed messages stored for review
- **Database**: SQLite (suitable for small to medium scale)

For production, consider:
- PostgreSQL instead of SQLite
- Message persistence in RabbitMQ
- Horizontal scaling with multiple workers
- Monitoring and alerting

## License

MIT
