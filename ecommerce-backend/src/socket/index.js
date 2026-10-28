import { Server } from 'socket.io';

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:4200',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    socket.join('catalog');
    console.log(`Socket connected: ${socket.id}`);
  });

  return io;
}

export function broadcastProductStockUpdates(updates) {
  if (!io || !Array.isArray(updates) || updates.length === 0) {
    return;
  }

  io.to('catalog').emit('product:stock-updated', {
    products: updates.map((item) => ({
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
    })),
  });
}
