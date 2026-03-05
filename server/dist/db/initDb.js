import { connectDb, disconnectDb } from './db.js';
async function main() {
    await connectDb();
    console.log('MongoDB connected. No schema init needed.');
    await disconnectDb();
}
main().catch(async (err) => {
    console.error(err);
    try {
        await disconnectDb();
    }
    catch {
        // ignore
    }
    process.exit(1);
});
