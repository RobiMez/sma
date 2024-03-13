// src/lib/db.ts

import mongoose, { Mongoose } from 'mongoose';
import { config } from 'dotenv';

config();

interface Connection {
    isConnected?: number;
}

const connection: Connection = {};

const dbConnect: () => Promise<void> = async () => {
    if (connection.isConnected) {
        return;
    }
    if (!process.env.MONGO_URI) {
        throw new Error('Please define the MONGO_URI environment variable inside .env.local');
    }

    const db: Mongoose = await mongoose.connect(process.env.MONGO_URI,);

    connection.isConnected = db.connections[0].readyState;
    console.log("DB Connected: ", connection.isConnected);
};

export { dbConnect };