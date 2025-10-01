# 🔌 Mini Trello Backend API

Backend API server cho ứng dụng Mini Trello được xây dựng với Node.js, Express và Firebase.

## Features

### 🔐 Authentication
- **Email-based authentication** (no passwords required)
- **Verification code system** sent via email
- **GitHub OAuth integration** for seamless sign-in
- **JWT token management** with refresh capabilities
- **Firebase Authentication** support

### 📋 Board Management
- Create, read, update, delete boards
- Board member management and invitations
- Role-based access control (owner/member)
- Email invitation system

### 🎯 Card Management
- Create cards within boards
- Card positioning and drag-drop support
- Member assignment to cards
- Comments and attachments system
- Rich text descriptions

### ✅ Task Management
- Create tasks within cards
- Task completion tracking
- Due date management
- Priority levels (low, medium, high, urgent)
- Labels and categorization
- Member assignment

### 🐙 GitHub Integration
- OAuth authentication with GitHub
- Repository browsing and management
- Issue and Pull Request integration
- Commit tracking and linking
- Branch information
- Search repositories

### 📧 Email Services
- Verification code delivery
- Board invitation emails
- Notification system
- HTML email templates

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth + JWT
- **Email**: Nodemailer
- **GitHub API**: Axios + OAuth
- **Security**: Helmet, CORS, Rate Limiting
- **Validation**: Express Validator
- **Documentation**: Built-in API docs

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Firebase project with Firestore enabled
- GitHub OAuth app (for GitHub integration)
- Email service (Gmail/SMTP)

### Setup Steps

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd mini-trello-backend
npm install
```

2. **Environment Configuration:**
Create a `.env` file in the root directory:
```env
# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Firebase Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project.iam.gserviceaccount.com

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-here
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-key
JWT_REFRESH_EXPIRES_IN=7d

# Email Configuration (Gmail)
EMAIL_SERVICE=gmail
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM_NAME=Mini Trello
EMAIL_FROM_ADDRESS=your-email@gmail.com

# GitHub OAuth Configuration
GITHUB_CLIENT_ID=your-github-oauth-app-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-app-client-secret
GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

3. **Firebase Setup:**
- Create a Firebase project at https://console.firebase.google.com
- Enable Firestore Database
- Create a service account and download the JSON key
- Enable Authentication with Email/Password provider

4. **GitHub OAuth Setup:**
- Go to GitHub Settings > Developer settings > OAuth Apps
- Create a new OAuth App
- Set Authorization callback URL to: `http://localhost:5000/api/auth/github/callback`
- Copy Client ID and Client Secret to `.env`

5. **Email Setup (Gmail):**
- Enable 2-Factor Authentication on your Gmail account
- Generate an App Password
- Use the App Password in the `EMAIL_PASS` field

## Running the Application


## Running the Application

### Development Mode (Local)
```bash
# Development với auto-reload (nodemon)
npm run dev

# Hoặc development mode thường
npm run start:dev
```
Server sẽ chạy tại `http://localhost:5000`

### Production Mode
```bash
# Production mode
npm start

# Hoặc explicit
npm run start:prod
```
Server sẽ bind vào `0.0.0.0:5000` (cho Render.com, VPS, v.v.)

### Using PM2 (Production)
```bash
npm install -g pm2
pm2 start src/app.js --name mini-trello-backend -i max
pm2 save
pm2 startup
```

## 🚀 Deployment

### Deploy to Render.com
Chi tiết đầy đủ về deployment lên Render.com, xem file [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md)

**Tóm tắt nhanh:**
1. Push code lên GitHub
2. Tạo Web Service trên Render.com
3. Set Build Command: `npm install`
4. Set Start Command: `npm start`
5. Thêm Environment Variables (đặc biệt `NODE_ENV=production`)
6. Deploy!

**Lưu ý:** Server sẽ tự động bind vào `0.0.0.0` khi `NODE_ENV=production`

## API Documentation

Once the server is running, visit:
- **API Documentation**: http://localhost:5000/api/docs
- **Health Check**: http://localhost:5000/health

## API Endpoints

### Authentication
```
POST   /api/auth/send-verification-code    # Send verification code
GET    /api/auth/github                    # GitHub OAuth
GET    /api/auth/github/callback           # GitHub callback
GET    /api/auth/profile                   # Get user profile
PUT    /api/auth/profile                   # Update profile
POST   /api/auth/refresh-token             # Refresh JWT
POST   /api/auth/logout                    # Logout
```

### Boards
```
GET    /api/boards                         # Get user boards
POST   /api/boards                         # Create board
GET    /api/boards/:id                     # Get board details
PUT    /api/boards/:id                     # Update board
DELETE /api/boards/:id                     # Delete board
POST   /api/boards/:id/invite              # Invite member to board
POST   /api/boards/:id/leave               # Leave board
GET    /api/boards/:id/members             # Get board members
DELETE /api/boards/:id/members/:memberId   # Remove member from board
GET    /api/boards/:id/invitations         # Get board invitations
GET    /api/boards/invitations/pending     # Get user's pending invitations
POST   /api/boards/invitation/respond      # Respond to invitation
DELETE /api/boards/:id/invitations/:invitationId # Cancel invitation
```

### Cards
```
GET    /api/boards/:boardId/cards          # Get all cards in board
POST   /api/boards/:boardId/cards          # Create card in board
GET    /api/boards/:boardId/cards/:id      # Get specific card
PUT    /api/boards/:boardId/cards/:id      # Update card
DELETE /api/boards/:boardId/cards/:id      # Delete card

```

### Tasks
```
GET    /api/boards/:boardId/cards/:cardId/tasks                    # Get all tasks in card
POST   /api/boards/:boardId/cards/:cardId/tasks                    # Create task in card
GET    /api/boards/:boardId/cards/:cardId/tasks/:taskId            # Get specific task
PUT    /api/boards/:boardId/cards/:cardId/tasks/:taskId            # Update task
DELETE /api/boards/:boardId/cards/:cardId/tasks/:taskId            # Delete task
```

# Task Member Management
```
GET    /api/boards/:boardId/cards/:cardId/tasks/:taskId/members                  # Get task members
POST   /api/boards/:boardId/cards/:cardId/tasks/:taskId/assign-member            # Assign member to task
DELETE /api/boards/:boardId/cards/:cardId/tasks/:taskId/members/:memberId        # Remove member from task
```

# GitHub Attachments for Tasks
```
GET    /api/boards/:boardId/cards/:cardId/tasks/:taskId/github-attachments                  # Get GitHub attachments
POST   /api/boards/:boardId/cards/:cardId/tasks/:taskId/github-attachments                  # Attach GitHub item to task
DELETE /api/boards/:boardId/cards/:cardId/tasks/:taskId/github-attachments/:attachmentId    # Remove GitHub attachment
```

### GitHub Integration
```

GET    /api/github/repositories                                # Get user repositories
GET    /api/github/repositories/search                         # Search repositories
GET    /api/github/repositories/:owner/:repo                   # Get repository info
GET    /api/github/repositories/:owner/:repo/github-info       # Get detailed GitHub info
GET    /api/github/repositories/:owner/:repo/branches          # Get repository branches
GET    /api/github/repositories/:owner/:repo/branches/paginated # Get paginated branches
GET    /api/github/repositories/:owner/:repo/commits           # Get repository commits
GET    /api/github/repositories/:owner/:repo/commits/paginated # Get paginated commits
GET    /api/github/repositories/:owner/:repo/issues            # Get repository issues
GET    /api/github/repositories/:owner/:repo/issues/paginated  # Get paginated issues
GET    /api/github/repositories/:owner/:repo/pulls             # Get pull requests
GET    /api/github/repositories/:owner/:repo/pulls/paginated   # Get paginated pull requests
```



## Security Features

- **Helmet.js** for security headers
- **CORS** configuration
- **Rate limiting** to prevent abuse
- **Input validation** and sanitization
- **JWT token** authentication
- **Firebase security rules**
- **Environment variable** protection


### Available Scripts
```bash
npm run dev        # Start development server with nodemon
```
or
```bash
node src/app.js        # Start development server with nodemon

```


## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email support@minitrello.com or create an issue in the repository.



