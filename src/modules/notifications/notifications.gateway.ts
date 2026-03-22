import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    handleConnection(client: Socket) {
        // Optionally authenticate user here
        // Example: client.join(client.handshake.query.userId);
        console.log(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        // Handle disconnect logic if needed
        console.log(`Client disconnected: ${client.id}`);
    }

    sendNotificationToUser(userId: string, notification: any) {
        this.server.to(userId).emit('notification', notification);
    }
}