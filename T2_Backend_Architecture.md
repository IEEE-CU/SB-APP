
# Team T2 — Backend Architecture & Project Structure


## 1. Overview

Team **T2** owns the complete Backend API layer responsible for authentication, business logic, REST APIs, security middleware, validation, request processing, and communication with MongoDB and external services.

The backend follows a layered Express architecture:

```
Client
   │
   ▼
Express Server
   │
   ├── Security Middleware
   ├── Authentication
   ├── Authorization
   ├── Validation
   ├── Controllers (Routes)
   ├── Business Logic
   ├── Mongoose Models
   └── MongoDB
```

---

# 2. Backend Folder Structure

```text
backend/
├── src/
│   ├── server.js
│   ├── config/
│   │    └── database.js
│   ├── middleware/
│   │    ├── auth.js
│   │    ├── errorHandler.js
│   │    └── rateLimiter.js
│   ├── models/
│   │    ├── User.js
│   │    ├── Society.js
│   │    ├── Event.js
│   │    ├── Project.js
│   │    ├── ProjectReport.js
│   │    ├── Transaction.js
│   │    ├── Announcement.js
│   │    ├── CalendarEvent.js
│   │    └── Institution.js
│   ├── routes/
│   │    ├── auth.js
│   │    ├── users.js
│   │    ├── societies.js
│   │    ├── events.js
│   │    ├── projects.js
│   │    ├── projectReports.js
│   │    ├── announcements.js
│   │    ├── calendar.js
│   │    ├── dashboard.js
│   │    ├── institution.js
│   │    ├── transactions.js
│   │    └── index.js
│   ├── scripts/
│   └── utils/
├── package.json
├── README.md
└── .env.example
```

---

# 3. Layered Architecture

## Entry Layer
- server.js
- Express initialization
- Cluster support
- Global middleware
- Route mounting
- Graceful shutdown

## Configuration Layer
- MongoDB connection
- Environment loading
- Retry logic
- Connection pooling

## Middleware Layer
- JWT Authentication
- Role Authorization
- Society Access Guard
- Global Error Handler
- Rate Limiting
- Helmet
- CORS
- Mongo Sanitize
- HPP

## API Layer

Modules:
- Authentication
- Users
- Societies
- Transactions
- Events
- Projects
- Reports
- Calendar
- Announcements
- Dashboard
- Institution

## Data Layer

Mongoose Models:
- User
- Society
- Transaction
- Event
- Project
- ProjectReport
- Announcement
- CalendarEvent
- Institution

---

# 4. Request Flow

```
Client
   │
   ▼
Express
   │
Helmet
CORS
Compression
Rate Limiter
Mongo Sanitize
HPP
JWT Authentication
Authorization
Route
Business Logic
Mongoose Model
MongoDB
Response
```

---

# 5. Backend Responsibilities (Team T2)

- Authentication (JWT)
- Authorization
- REST API Development
- CRUD Operations
- Request Validation
- Security Enforcement
- Error Handling
- API Response Formatting
- Integration with Team T3 Models
- Integration with Team T4 Services
- RBAC integration with Team T5

---

# 6. Tech Stack

## Runtime
- Node.js

## Framework
- Express.js

## Database
- MongoDB
- Mongoose

## Authentication
- JSON Web Token (jsonwebtoken)
- bcryptjs

## Validation
- express-validator

## Security
- helmet
- cors
- express-rate-limit
- express-mongo-sanitize
- hpp

## Configuration
- dotenv

## Performance
- compression
- Node Cluster API

## Development
- Nodemon

---

# 7. API Modules

- Auth
- Users
- Societies
- Events
- Transactions
- Projects
- Reports
- Calendar
- Dashboard
- Announcements
- Institution

---

# 8. Deployment Architecture

```
Frontend
      │
      ▼
REST API (Express)
      │
JWT Middleware
      │
Business Logic
      │
Mongoose ODM
      │
MongoDB Atlas
```

---

# 9. Environment Variables

- PORT
- NODE_ENV
- MONGODB_URI
- JWT_SECRET
- JWT_EXPIRES_IN
- GEMINI_API_KEY
- ENABLE_CLUSTER
- WEB_CONCURRENCY
- DB_MAX_POOL_SIZE
- DB_MIN_POOL_SIZE
- DB_CONNECT_MAX_RETRIES
- DB_CONNECT_RETRY_DELAY_MS

---

# 10. Key Features

- RESTful API
- Modular Architecture
- JWT Authentication
- RBAC Ready
- MongoDB ODM
- Secure Middleware Stack
- Request Rate Limiting
- Centralized Error Handling
- Cluster-based Scaling
- Graceful Shutdown
- Environment-based Configuration
- Database Retry Mechanism
