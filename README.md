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
3. Create a `.env` file and configure environment variables, such as:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   CLIENT_URL=http://localhost:5173
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
   STORAGE_LIMIT_BYTES=16106127360
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

## AWS Cloud Deployment

NimbusVault can be deployed to AWS using Docker. The app bundles the React frontend into the backend image and serves the built files from Express.

### Build the Docker image

From the project root:
```bash
docker build -t nimbusvault:latest .
```

### Run locally with Docker

```bash
docker run -p 5000:5000 \
  -e PORT=5000 \
  -e MONGO_URI=your_mongodb_connection_string \
  -e JWT_SECRET=your_jwt_secret \
  -e CLIENT_URL=https://your-frontend-url \
  -e GOOGLE_CLIENT_ID=your_google_client_id \
  -e GOOGLE_CLIENT_SECRET=your_google_client_secret \
  -e GOOGLE_CALLBACK_URL=https://your-domain/api/auth/google/callback \
  nimbusvault:latest
```

### Deploy to AWS Elastic Container Service (ECS)

1. Push the Docker image to Amazon ECR.
2. Create an ECS task definition using the image.
3. Configure environment variables in ECS task or service.
4. Use an Application Load Balancer with a target group on port `5000`.
5. Open port `5000` on the service security group.

### Deploy to AWS Elastic Beanstalk

1. Install and configure the AWS CLI.
2. Create an Elastic Beanstalk application for Docker.
3. Deploy from the project root using:
   ```bash
   eb init -p docker nimbusvault
   eb create nimbusvault-env
   eb setenv \
     MONGO_URI=your_mongodb_connection_string \
     JWT_SECRET=your_jwt_secret \
     CLIENT_URL=https://your-frontend-url \
     GOOGLE_CLIENT_ID=your_google_client_id \
     GOOGLE_CLIENT_SECRET=your_google_client_secret \
     GOOGLE_CALLBACK_URL=https://your-domain/api/auth/google/callback
   eb deploy
   ```

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
