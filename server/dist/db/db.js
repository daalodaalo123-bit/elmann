import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
function loadEnv() {
    // Try common locations so running from repo root still picks up server/.env
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const candidates = [
        path.join(process.cwd(), '.env'),
        path.join(process.cwd(), 'server', '.env'),
        path.join(__dirname, '..', '..', '.env')
    ];
    const envPath = candidates.find((p) => fs.existsSync(p));
    if (envPath) {
        dotenv.config({ path: envPath, override: true });
    }
    else {
        dotenv.config({ override: true });
    }
}
loadEnv();
let connecting = null;
// Fail fast instead of buffering commands for 10s
mongoose.set('bufferCommands', false);
function normalizeMongoUri(raw) {
    let uri = String(raw ?? '').trim();
    // Common mistake in Render env vars: pasting the whole "MONGODB_URI=..." line into the value field
    if (uri.toUpperCase().startsWith('MONGODB_URI=')) {
        uri = uri.slice('MONGODB_URI='.length).trim();
    }
    // Strip surrounding quotes if present
    if ((uri.startsWith('"') && uri.endsWith('"') && uri.length >= 2) ||
        (uri.startsWith("'") && uri.endsWith("'") && uri.length >= 2)) {
        uri = uri.slice(1, -1).trim();
    }
    // Placeholder check (Atlas "copy/paste" template not filled)
    if (uri.includes('<db_password>') || uri.includes('<password>') || uri.includes('<username>')) {
        throw new Error('MONGODB_URI contains placeholders (e.g. <username>/<db_password>). Replace them with your real Atlas DB username/password.');
    }
    // Must be a valid Mongo connection string scheme
    if (!(uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'))) {
        throw new Error('Invalid MONGODB_URI. It must start with "mongodb://" or "mongodb+srv://". (If deploying on Render, paste only the URI value, not "MONGODB_URI=").');
    }
    return uri;
}
export async function connectDb() {
    const raw = process.env.MONGODB_URI;
    if (!raw) {
        throw new Error('MONGODB_URI is not set. Create server/.env with MONGODB_URI (MongoDB Atlas connection string).');
    }
    const uri = normalizeMongoUri(raw);
    if (mongoose.connection.readyState === 1)
        return;
    if (connecting)
        return connecting;
    connecting = (async () => {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000
        });
    })();
    try {
        await connecting;
    }
    finally {
        connecting = null;
    }
}
export function dbStatus() {
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    return {
        readyState: mongoose.connection.readyState,
        name: mongoose.connection.name,
        hasUri: Boolean(process.env.MONGODB_URI)
    };
}
export async function disconnectDb() {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
}
