# SICET Code Lab Backend API

A secure Express.js backend API for the SICET Code Lab platform with JWT-based authentication and Judge0 integration.

## 🔐 Authentication System

All API routes (except `/health`) are protected with JWT-based authentication. Users must provide a valid JWT token in the Authorization header.

### Authentication Flow

1. **Frontend Login**: Users authenticate through NextAuth in the frontend
2. **JWT Token**: Frontend receives a JWT token containing user information
3. **API Requests**: Include the JWT token in the Authorization header: `Bearer <token>`
4. **Backend Verification**: Backend validates the token and extracts user information

### Protected Routes

| Route                 | Method | Description              | Access Level            |
| --------------------- | ------ | ------------------------ | ----------------------- |
| `/runcode`            | POST   | Execute code with input  | All authenticated users |
| `/submissions`        | POST   | Create Judge0 submission | All authenticated users |
| `/submissions/:token` | GET    | Get submission result    | All authenticated users |
| `/testcases`          | POST   | Run multiple test cases  | All authenticated users |
| `/submissions/save`   | POST   | Save submission data     | Admin only              |
| `/auth/me`            | GET    | Get current user info    | All authenticated users |
| `/auth/test`          | GET    | Test authentication      | All authenticated users |

### Public Routes

| Route     | Method | Description           |
| --------- | ------ | --------------------- |
| `/health` | GET    | Health check endpoint |

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Judge0 API instance

### Installation

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env` file in the root directory:

   ```env
   # Server Configuration
   PORT=3001

   # Judge0 API Configuration
   JUDGE0_API_URL=http://your-judge0-instance/submissions

   # Authentication Configuration
   NEXTAUTH_SECRET=your-nextauth-secret-key
   JWT_SECRET=your-jwt-secret-key
   ```

3. **Start the server:**

   ```bash
   # Development
   npm run dev

   # Production
   npm run build
   npm start
   ```

## 📡 API Endpoints

### Authentication Endpoints

#### Test Authentication

```http
GET /auth/test
Authorization: Bearer <jwt-token>
```

**Response:**

```json
{
  "success": true,
  "message": "Authentication successful!",
  "user": "student123",
  "role": "student",
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

#### Get User Information

```http
GET /auth/me
Authorization: Bearer <jwt-token>
```

**Response:**

```json
{
  "success": true,
  "user": {
    "id": "user-id",
    "collegeId": "student123",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "student",
    "department": "CSE",
    "batch": "2024",
    "contact": "+1234567890"
  }
}
```

### Code Execution Endpoints

#### Run Code

```http
POST /runcode
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "code": "print('Hello World')",
  "language": "python",
  "input": "optional input"
}
```

**Response:**

```json
{
  "status": "success",
  "statusDescription": "Accepted",
  "dbStatus": "COMPLETED",
  "output": "Hello World\n",
  "error": null,
  "executionTime": 0.012,
  "memory": 1024
}
```

#### Create Submission

```http
POST /submissions
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "code": "print('Hello World')",
  "language": "python",
  "input": "optional input",
  "expectedOutput": "Hello World"
}
```

**Response:**

```json
{
  "token": "submission-token-uuid",
  "message": "Submission created successfully",
  "userId": "user-id",
  "userRole": "student"
}
```

#### Get Submission Result

```http
GET /submissions/:token
Authorization: Bearer <jwt-token>
```

**Response:**

```json
{
  "status": {
    "id": 3,
    "description": "Accepted"
  },
  "stdout": "SGVsbG8gV29ybGQK",
  "stderr": null,
  "compile_output": null,
  "message": null,
  "time": "0.012",
  "memory": 1024,
  "decoded_stdout": "Hello World\n"
}
```

#### Run Test Cases

```http
POST /testcases
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "code": "n = int(input())\nprint(n * 2)",
  "language": "python",
  "testCases": [
    {
      "input": "5",
      "output": "10"
    },
    {
      "input": "3",
      "output": "6"
    }
  ]
}
```

**Response:**

```json
{
  "passed": 2,
  "total": 2,
  "status": "COMPLETED",
  "userId": "user-id",
  "userRole": "student",
  "cases": [
    {
      "input": "5",
      "expectedOutput": "10",
      "actualOutput": "10",
      "error": null,
      "passed": true,
      "statusDescription": "Accepted",
      "executionTime": 0.015,
      "memory": 1024
    }
  ]
}
```

### Admin Endpoints

#### Save Submission (Admin Only)

```http
POST /submissions/save
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "submissionData": {
    "code": "print('Hello')",
    "language": "python",
    "userId": "student-id",
    "problemId": "problem-id"
  }
}
```

## 🔒 Security Features

- **JWT Token Validation**: All protected routes verify JWT tokens
- **Role-Based Access Control**: Admin-only endpoints check user roles
- **Token Expiration**: Handles expired tokens gracefully
- **Input Validation**: Validates request parameters and body
- **Error Handling**: Comprehensive error responses
- **Request Logging**: Logs user activities for audit trails

## 🛠️ Supported Languages

The backend supports all languages available in your Judge0 instance:

- Python (3.8+)
- JavaScript (Node.js)
- Java
- C++
- C
- And many more...

## 📊 Response Status Codes

| Code | Description                                                   |
| ---- | ------------------------------------------------------------- |
| 200  | Success                                                       |
| 400  | Bad Request (missing/invalid parameters)                      |
| 401  | Unauthorized (no token provided)                              |
| 403  | Forbidden (invalid/expired token or insufficient permissions) |
| 404  | Not Found                                                     |
| 500  | Internal Server Error                                         |

## 🔧 Environment Variables

| Variable          | Description                               | Required | Default               |
| ----------------- | ----------------------------------------- | -------- | --------------------- |
| `PORT`            | Server port                               | No       | 3001                  |
| `JUDGE0_API_URL`  | Judge0 API endpoint                       | Yes      | -                     |
| `NEXTAUTH_SECRET` | NextAuth secret key (must match frontend) | Yes      | -                     |
| `JWT_SECRET`      | Alternative JWT secret                    | No       | Uses NEXTAUTH_SECRET  |
| `FRONTEND_URL`    | Frontend URL for CORS                     | No       | http://localhost:3000 |

## 🚨 Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

### Common Errors

- **401 Unauthorized**: No token provided
- **403 Forbidden**: Invalid or expired token
- **400 Bad Request**: Missing required fields
- **500 Internal Server Error**: Server-side errors

## 🧪 Testing Authentication

Use the test endpoint to verify your authentication setup:

```bash
curl -X GET http://localhost:3001/auth/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📝 Development Notes

- All routes except `/health` require authentication
- User information is automatically extracted from JWT tokens
- Admin privileges are required for certain operations
- Request logging includes user identification for audit trails
- The system is compatible with NextAuth JWT tokens

## 🤝 Contributing

1. Ensure all new routes include proper authentication
2. Add input validation for all endpoints
3. Include comprehensive error handling
4. Update this documentation for any new endpoints
5. Test authentication flows thoroughly

## 📞 Support

For issues related to authentication or API usage, please check:

1. JWT token validity and format
2. Environment variable configuration
3. Judge0 API connectivity
4. Server logs for detailed error information
