# NimbusVault

NimbusVault is a cloud storage web application with a Node.js/Express backend and a React/Vite frontend. It provides user authentication, file and folder management, uploads, and activity tracking.

## Project Structure

- `backend/` - Express API server and authentication logic
- `frontend/` - React client app built with Vite

## Features

- User authentication
- File upload and download
- Folder management
- Activity logging
- Google OAuth support
- Real-time updates via Socket.IO

## Getting Started

### Prerequisites

- Node.js 18+ recommended
- npm or yarn
- MongoDB instance (if backend uses MongoDB)

### Backend Setup

1. Open a terminal in the `backend/` folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file if needed and configure environment variables, such as:
   ```env
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   ```
4. Start the server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Open a terminal in the `frontend/` folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open the displayed local URL in your browser.

## Scripts

### Backend

- `npm start` - Run the backend server with Node.js
- `npm run dev` - Run the backend with nodemon for development

### Frontend

- `npm run dev` - Start the Vite development server
- `npm run build` - Build the production frontend
- `npm run preview` - Preview the production build

## Notes

- The backend entry point is `backend/app.js`.
- The frontend entry point is `frontend/src/main.jsx`.
- Uploaded files are stored in the `backend/uploads/` folder.

## Contributions

Feel free to extend functionality by adding error handling, improved UI/UX, file preview support, or more advanced sharing features.
