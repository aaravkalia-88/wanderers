import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Configure explicitly in production
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'realtime' });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Wanderer Real-time service running on port ${PORT}`);
});
