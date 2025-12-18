# MERN Stack Chat Application

A real-time chat application built with MongoDB, Express, React, and Node.js (MERN Stack) with Socket.io for real-time messaging. Features both **direct messaging** and **room-based group chat**.

## 🚀 Features

### Authentication
- 🔐 User registration with username, email, and password
- 🔑 Secure login with JWT token authentication
- 🔒 Password hashing with bcrypt
- 🚪 Logout functionality

### Room-Based Chat
- 🏠 Create chat rooms with custom room numbers
- 🔢 Auto-generate random room numbers
- 🔐 Private rooms with password protection
- 👥 Join existing rooms by room number
- 📋 View all your joined rooms
- 👀 See room participants in real-time
- 💬 Real-time group messaging within rooms
- 📢 System notifications when users join/leave

### Direct Messaging
- 🔍 Search for users by username
- 💬 One-on-one private conversations
- 📝 Conversation history

### Real-Time Features (Socket.io)
- ⚡ Instant message delivery
- 🟢 Online/Offline user status
- ⌨️ Typing indicators
- 👥 Live participant list in rooms

---

## 📁 Project Structure

```
chat-app/
├── server/                     # Backend (Express + Node.js)
│   ├── models/
│   │   ├── User.js            # User schema (username, email, password)
│   │   ├── Message.js         # Direct message schema
│   │   ├── Conversation.js    # Conversation between two users
│   │   ├── Room.js            # Chat room schema
│   │   └── RoomMessage.js     # Room message schema
│   ├── routes/
│   │   ├── auth.js            # Authentication routes
│   │   ├── messages.js        # Direct messaging routes
│   │   ├── users.js           # User management routes
│   │   └── rooms.js           # Room management routes
│   ├── middleware/
│   │   └── auth.js            # JWT authentication middleware
│   ├── server.js              # Main server + Socket.io setup
│   ├── .env                   # Environment variables
│   └── package.json
│
└── client/                     # Frontend (React)
    ├── public/
    │   └── index.html
    └── src/
        ├── components/
        │   ├── Login.js       # Login form
        │   ├── Register.js    # Registration form
        │   ├── Chat.js        # Direct messaging interface
        │   ├── RoomEntry.js   # Create/Join room interface
        │   ├── RoomChat.js    # Room chat interface
        │   └── MyRooms.js     # List of joined rooms
        ├── context/
        │   ├── AuthContext.js # Authentication state management
        │   └── SocketContext.js # Socket.io connection management
        ├── App.js             # Main app with routing
        ├── index.js           # React entry point
        └── index.css          # All styles
```

---

## 🔄 How It Works

### 1. Authentication Flow

```
User enters credentials → POST /api/auth/login or /register
                                    ↓
                        Server validates & creates JWT token
                                    ↓
                        Token stored in localStorage
                                    ↓
                        User redirected to main app
                                    ↓
                        Socket.io connection established
```

### 2. Room-Based Chat Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     CREATE A ROOM                           │
├─────────────────────────────────────────────────────────────┤
│  1. User clicks "Create Room" tab                           │
│  2. Enters room number (or clicks "Generate" for random)    │
│  3. Adds room name and optional description                 │
│  4. Optionally sets private + password                      │
│  5. POST /api/rooms/create → Room saved to MongoDB          │
│  6. User automatically joins the room                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      JOIN A ROOM                            │
├─────────────────────────────────────────────────────────────┤
│  1. User enters room number (shared by room creator)        │
│  2. If private, enters room password                        │
│  3. POST /api/rooms/join → Server validates                 │
│  4. User added to room participants                         │
│  5. Redirected to room chat page                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   REAL-TIME MESSAGING                       │
├─────────────────────────────────────────────────────────────┤
│  1. User enters room → Socket emits "joinRoom"              │
│  2. Server adds user to Socket.io room                      │
│  3. All room members receive "userJoinedRoom" event         │
│  4. User types message → Saved to DB + Socket emit          │
│  5. All room members receive "roomMessage" event            │
│  6. Messages appear instantly for everyone                  │
│  7. User leaves → Socket emits "leaveRoom"                  │
│  8. All room members receive "userLeftRoom" event           │
└─────────────────────────────────────────────────────────────┘
```

### 3. Direct Messaging Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   START CONVERSATION                        │
├─────────────────────────────────────────────────────────────┤
│  1. User searches for another user by username              │
│  2. Clicks on user → POST /api/messages/conversation        │
│  3. Server creates/retrieves conversation between users     │
│  4. Chat window opens with message history                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    SEND MESSAGE                             │
├─────────────────────────────────────────────────────────────┤
│  1. User types and sends message                            │
│  2. POST /api/messages → Message saved to MongoDB           │
│  3. Socket emits "sendMessage" to recipient                 │
│  4. If recipient online, receives instant notification      │
│  5. Message appears in both users' chat windows             │
└─────────────────────────────────────────────────────────────┘
```

### 4. Socket.io Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `addUser` | Client → Server | Register user as online |
| `getUsers` | Server → Client | List of online users |
| `joinRoom` | Client → Server | Join a chat room |
| `leaveRoom` | Client → Server | Leave a chat room |
| `sendRoomMessage` | Client → Server | Send message to room |
| `roomMessage` | Server → Clients | Broadcast message to room |
| `userJoinedRoom` | Server → Clients | Notify room of new user |
| `userLeftRoom` | Server → Clients | Notify room user left |
| `roomUsers` | Server → Clients | Updated participant list |
| `sendMessage` | Client → Server | Direct message to user |
| `getMessage` | Server → Client | Receive direct message |
| `typing` | Client → Server | User is typing |
| `userTyping` | Server → Client | Show typing indicator |

---

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v16+)
- MongoDB Atlas account (or local MongoDB)
- npm or yarn

### 1. Clone & Install Dependencies

```bash
# Install server dependencies
cd chat-app/server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure Environment Variables

Edit `server/.env`:

```env
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chatapp
JWT_SECRET=your_secret_key_here
```

### 3. Run the Application

**Terminal 1 - Start Server:**
```bash
cd chat-app/server
npm run dev
```

**Terminal 2 - Start Client:**
```bash
cd chat-app/client
npm start
```

### 4. Access the App

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000

---

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | Get all users |
| GET | `/api/users/search?query=` | Search users |
| GET | `/api/users/:id` | Get user by ID |
| PUT | `/api/users/profile` | Update profile |

### Rooms
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rooms/create` | Create new room |
| POST | `/api/rooms/join` | Join room by number |
| GET | `/api/rooms/my-rooms` | Get user's rooms |
| GET | `/api/rooms/number/:roomNumber` | Get room by number |
| GET | `/api/rooms/:roomId/messages` | Get room messages |
| POST | `/api/rooms/:roomId/messages` | Send room message |
| POST | `/api/rooms/:roomId/leave` | Leave room |
| GET | `/api/rooms/:roomId/participants` | Get room participants |

### Direct Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/messages/conversation` | Create/get conversation |
| GET | `/api/messages/conversations` | Get user's conversations |
| POST | `/api/messages` | Send direct message |
| GET | `/api/messages/:conversationId` | Get conversation messages |
| PUT | `/api/messages/read/:conversationId` | Mark messages as read |

---

## 🎯 User Guide

### Creating a Room
1. Login to the app
2. On the home page, click **"Create Room"** tab
3. Enter a room number or click **"Generate"** for a random one
4. Add a room name (required)
5. Optionally add a description
6. For private rooms, check **"Private Room"** and set a password
7. Click **"Create Room"**
8. Share the room number with others!

### Joining a Room
1. Login to the app
2. On the home page, stay on **"Join Room"** tab
3. Enter the room number shared with you
4. If it's a private room, enter the password
5. Click **"Join Room"**
6. Start chatting!

### Direct Messaging
1. Click **"Direct Messages"** on the home page
2. Use the search box to find users
3. Click on a user to start a conversation
4. Type and send messages

---

## 🔧 Technologies Used

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **Socket.io** - Real-time communication
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing
- **cors** - Cross-origin requests
- **dotenv** - Environment variables

### Frontend
- **React 18** - UI library
- **React Router v6** - Client-side routing
- **Socket.io-client** - Real-time client
- **Axios** - HTTP client
- **Context API** - State management

---

## 📄 License

MIT
