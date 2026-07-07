# IEEE Finance Pro - Backend API

RESTful API backend for IEEE Finance Pro, built with Node.js, Express, and MongoDB.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 6+ (local or Atlas)

### Installation

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret

# Seed database with sample data
npm run seed

# Start development server
npm run dev
```

---

## ⚙️ Environment Variables

```env
PORT=3001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/ieee_finance
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
```

---

## 📊 Database Schema

### User
```javascript
{
  email: String (unique),
  password: String (bcrypt hashed),
  role: 'ADMIN' | 'OFFICE_BEARER',
  name: String,
  societyId: ObjectId -> Society
}
```

### Society
```javascript
{
  name: String,
  shortName: String (unique),
  type: 'SOCIETY' | 'AFFINITY_GROUP' | 'COUNCIL',
  budget: Number,
  logoUrl: String,
  advisorSignatureUrl: String,
  officeBearers: [{
    name, position, email, phone, termYear
  }],
  members: [{
    ieeeId, name, email, contactNumber, grade
  }]
}
```

### Transaction
```javascript
{
  societyId: ObjectId -> Society,
  type: 'INCOME' | 'EXPENSE',
  amount: Number,
  category: String,
  description: String,
  date: Date,
  approvedBy: ObjectId -> User
}
```

### Event
```javascript
{
  societyId: ObjectId -> Society,
  title: String,
  date: Date,
  time: String,
  venue: String,
  eventType: String,
  participants: Number,
  description: String,
  images: [String],
  speakers: [{
    name, designation, organization, presentationTitle
  }]
}
```

### Project
```javascript
{
  societyId: ObjectId -> Society,
  title: String,
  category: 'TECHNICAL_PROJECT' | 'TRAVEL_GRANT' | 'SCHOLARSHIP' | 'AWARD',
  sanctioningBody: String,
  amountSanctioned: Number,
  startDate: Date,
  status: 'PROPOSED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED' | 'ANNOUNCED' | 'AWARDED',
  description: String
}
```

### ProjectReport
```javascript
{
  societyId: ObjectId -> Society,
  title: String,
  reportType: String,
  reportDate: Date,
  content: String,
  attachments: [String]
}
```

### CalendarEvent
```javascript
{
  societyId: ObjectId -> Society,
  title: String,
  date: Date,
  time: String,
  venue: String,
  description: String,
  status: 'PROPOSED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'
}
```

### Announcement
```javascript
{
  societyId: ObjectId -> Society (optional),
  title: String,
  message: String,
  date: Date,
  senderName: String,
  targetAudience: 'ALL' | 'LEADERSHIP' | 'SOCIETY'
}
```

---

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/auth/login` | Login with email/password | Public |
| GET | `/api/auth/me` | Get current user profile | Authenticated |
| POST | `/api/auth/change-password` | Change password | Authenticated |

**Login Request:**
```json
{
  "email": "admin@ieee.org",
  "password": "admin"
}
```

**Login Response:**
```json
{
  "success": true,
  "data": {
    "token": "jwt_token_here",
    "user": {
      "id": "...",
      "email": "admin@ieee.org",
      "name": "Admin User",
      "role": "ADMIN",
      "societyId": null
    }
  }
}
```

---

### Users (Admin Only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List all users |
| GET | `/api/users/:id` | Get user details |
| POST | `/api/users/:id/reset-password` | Reset user password |

---

### Societies
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/societies` | List all societies | All |
| GET | `/api/societies/:id` | Get society details | All |
| PATCH | `/api/societies/:id/budget` | Update budget | Admin |
| PATCH | `/api/societies/:id/logo` | Update logo | Admin/OB |
| GET | `/api/societies/:id/office-bearers` | Get office bearers | All |
| POST | `/api/societies/:id/office-bearers` | Add office bearer | Admin/OB |
| PUT | `/api/societies/:id/office-bearers/:obId` | Update office bearer | Admin/OB |
| DELETE | `/api/societies/:id/office-bearers/:obId` | Remove office bearer | Admin/OB |
| GET | `/api/societies/:id/members` | Get members | All |
| POST | `/api/societies/:id/members` | Add member | Admin/OB |
| DELETE | `/api/societies/:id/members/:memberId` | Remove member | Admin/OB |

---

### Transactions
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/transactions` | List all transactions | Admin |
| GET | `/api/transactions/society/:id` | Get society transactions | Admin/OB (own) |
| POST | `/api/transactions` | Create transaction | Admin/OB |
| PUT | `/api/transactions/:id` | Update transaction | Admin/OB |
| DELETE | `/api/transactions/:id` | Delete transaction | Admin/OB |

**Create Transaction:**
```json
{
  "societyId": "society_id",
  "type": "EXPENSE",
  "amount": 5000,
  "category": "Food & Catering",
  "description": "Workshop refreshments",
  "date": "2024-02-01"
}
```

---

### Events
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/events` | List all events | All |
| GET | `/api/events/society/:id` | Get society events | All |
| POST | `/api/events` | Create event | Admin/OB |
| PUT | `/api/events/:id` | Update event | Admin/OB |
| DELETE | `/api/events/:id` | Delete event | Admin/OB |

---

### Projects
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/projects` | List all projects | All |
| GET | `/api/projects/society/:id` | Get society projects | All |
| POST | `/api/projects` | Create project | Admin/OB |
| PUT | `/api/projects/:id` | Update project | Admin/OB |
| DELETE | `/api/projects/:id` | Delete project | Admin/OB |

---

### Calendar Events
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/calendar` | List all calendar events | All |
| GET | `/api/calendar/society/:id` | Get society events | All |
| POST | `/api/calendar` | Create event | Admin/OB |
| PUT | `/api/calendar/:id` | Update event | Admin/OB |
| DELETE | `/api/calendar/:id` | Delete event | Admin/OB |

---

### Announcements
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/announcements` | List announcements | All (filtered by role) |
| POST | `/api/announcements` | Create announcement | Admin/OB |
| PUT | `/api/announcements/:id` | Update announcement | Admin/OB |
| DELETE | `/api/announcements/:id` | Delete announcement | Admin/OB |

---

### Dashboard
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/dashboard` | Overall statistics | Admin |
| GET | `/api/dashboard/society/:id` | Society statistics | Admin/OB (own) |

**Dashboard Response:**
```json
{
  "success": true,
  "data": {
    "totalIncome": 150000,
    "totalExpenses": 85000,
    "balance": 65000,
    "transactionCount": 45,
    "upcomingEvents": 5,
    "activeProjects": 8
  }
}
```

---

## 🔒 Authentication & Authorization

### JWT Authentication
All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Role-Based Access Control (RBAC)

**Admin (`ADMIN`):**
- Full access to all resources
- Can manage all societies
- Can view and manage all users
- Can access system-wide statistics

**Office Bearer (`OFFICE_BEARER`):**
- Can manage own society's resources
- Cannot access other societies' data
- Cannot manage users
- Can only view own society statistics

---

## 📝 API Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "count": 10,
  "message": "Optional message"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description"
}
```

### Validation Error
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

---

## 🗄️ Database Seeding

The seed script creates:
- **5 Admin accounts**
- **40 IEEE Societies**
- **4 Affinity Groups**
- **5 IEEE Councils**
- Sample transactions, events, and projects

```bash
npm run seed
```

**Default Credentials:**
- Admin: `admin@ieee.org` / `admin`
- All Office Bearers: `<society>@ieee.org` / `office`

---

## 🛡️ Security Features

- **Password Hashing**: bcryptjs with salt rounds
- **JWT Tokens**: Signed with secret key, expiration time
- **Input Validation**: express-validator for all inputs
- **CORS**: Configured for allowed origins
- **Error Handling**: Centralized middleware
- **SQL Injection Protection**: MongoDB parameterized queries
- **XSS Protection**: Input sanitization

---

## 🔧 Development Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start development server with nodemon |
| `npm run seed` | Seed database with sample data |

---

## 📦 Dependencies

### Production
- `express` - Web framework
- `mongoose` - MongoDB ODM
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT authentication
- `express-validator` - Input validation
- `cors` - CORS middleware
- `dotenv` - Environment variables
- `multer` - File upload handling

### Development
- `nodemon` - Auto-restart on file changes

---

## 🚀 Deployment

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Use strong `JWT_SECRET`
- [ ] Configure MongoDB Atlas or production database
- [ ] Set up proper CORS origins
- [ ] Enable HTTPS
- [ ] Set up monitoring and logging
- [ ] Configure rate limiting
- [ ] Set up backup strategy

---

## 📊 Performance

- MongoDB indexing on frequently queried fields
- Pagination support for large datasets
- Efficient query optimization
- Connection pooling

---

**Built for IEEE Finance Pro** | **API Version 1.0**
