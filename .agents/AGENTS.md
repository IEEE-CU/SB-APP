# IEEE Finance Pro Workspace Rules

This file sets the global constraints for all agentic operations in this workspace.

## 🔒 API Contract Constraints
- **Prefix**: Prefix all API routes with `/api/v1`.
- **Response Wrapper**: All successful responses must use:
  ```json
  {
    "success": true,
    "data": { },
    "meta": { }
  }
  ```
- **Error Wrapper**: All failed responses must return the correct HTTP status code and match:
  ```json
  {
    "success": false,
    "error": {
      "code": "ERROR_CODE",
      "message": "Human-readable error description"
    }
  }
  ```
- **Object Serialization**: Replace all `_id` and `__v` outputs with `id` at the serialization layer.

## 🌿 Git Branching Rule
- All Team 5 work must be developed, tested, and committed exclusively into the `T5` branch.

## 🛠️ Recommended Tech Stack by Team

To ensure consistency and ease of integration across all teams, the following tech stack recommendations must be adhered to:

### 📱 Team 1 (Frontend)
- **Core Library**: React 19
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS, Vanilla CSS
- **Routing**: React Router (v6+)
- **HTTP Client**: Axios (configured with base URL `/api/v1` and authorization interceptor)
- **State Management**: Zustand
- **Security / Sanitization**: DOMPurify (for XSS sanitization of user-generated content)
- **Real-time Communication**: Socket.io-client (for real-time updates / Community Hub)

### 🔌 Team 2 (Backend API)
- **Platform & Runtime**: Node.js
- **Framework**: Express.js
- **Language**: JavaScript (ES Modules)
- **Authentication**: JWT (JSON Web Tokens) via `jsonwebtoken`
- **Real-time Communication**: Socket.io
- **Security Middlewares**:
  - `helmet` (HTTP headers security)
  - `cors` (Cross-Origin Resource Sharing controls)
  - `mongo-sanitize` (NoSQL injection prevention)
  - `express-rate-limit` (DDoS and brute-force mitigation on auth-adjacent routes)
- **Testing**: Jest, Supertest

### 🗄️ Team 3 (Database & Storage)
- **Database**: MongoDB
- **ODM**: Mongoose
- **Tooling**: Node.js script runner for database seeding and migration routines (e.g. `npm run seed`)
- **Testing / Development**: MongoDB Memory Server (`mongodb-memory-server` for isolated and clean unit/integration test runs)

### ☁️ Team 4 (External Services)
- **Platform & Runtime**: Node.js, Express.js
- **Service Providers**:
  - **File Storage**: Cloudinary / AWS S3
  - **Email**: SendGrid
  - **AI Integration**: Google Gemini API (`@google/generative-ai`)
- **Document Processing**: `pdfkit` or similar for PDF generation
- **File Upload Middleware**: `multer` (with strict limits on file size and mime-types)

### 🛡️ Team 5 (Roles & Access Control)
- **Platform & Runtime**: Node.js, Express.js
- **Database/ODM**: MongoDB, Mongoose (Role, Permission, RolePermission schemas)
- **Auth/Access Control**: Custom Express middleware (`requirePermission`, `attachScope`, `requireSuperAdmin` checks)
- **Testing**: Jest, Supertest
