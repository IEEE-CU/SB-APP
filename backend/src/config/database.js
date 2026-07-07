const mongoose = require('mongoose');
const dns = require('dns');

// Set DNS options for better SRV record resolution
dns.setDefaultResultOrder('ipv4first');

const MAX_RETRIES = parseInt(process.env.DB_CONNECT_MAX_RETRIES, 10) || 5;
const RETRY_DELAY_MS = parseInt(process.env.DB_CONNECT_RETRY_DELAY_MS, 10) || 5000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Connects to MongoDB with a bounded retry-with-backoff loop instead of
 * killing the process on the first failure. The HTTP server starts
 * regardless of DB state, so a hard `process.exit(1)` here would take down
 * every in-flight request over what is often a transient blip (DNS hiccup,
 * Atlas failover, brief network partition). Once connected, /api/health
 * reflects real connectivity so a load balancer can route around an instance
 * that's still struggling - the process itself stays alive to recover.
 */
const connectDB = async () => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const conn = await mongoose.connect(process.env.MONGODB_URI, {
                serverSelectionTimeoutMS: 30000,
                socketTimeoutMS: 45000,
                // Pool sized per-process: with clustering enabled, total connections
                // to the DB is roughly workers * maxPoolSize, so keep this modest by
                // default and tune via env if the deployment needs more headroom.
                maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE, 10) || 20,
                minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE, 10) || 2,
            });
            console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

            mongoose.connection.on('error', (err) => {
                console.error(`❌ MongoDB connection error: ${err.message}`);
            });
            mongoose.connection.on('disconnected', () => {
                console.warn('⚠️  MongoDB disconnected. Mongoose will attempt to reconnect automatically.');
            });
            mongoose.connection.on('reconnected', () => {
                console.log('✅ MongoDB reconnected.');
            });

            return conn;
        } catch (error) {
            console.error(`❌ MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`);

            if (attempt === MAX_RETRIES) {
                console.error('💡 Troubleshooting tips:');
                console.error('   - Check your internet connection');
                console.error('   - Verify your IP is whitelisted in MongoDB Atlas');
                console.error('   - Ensure credentials are correct');
                console.error('⚠️  Giving up on initial connection. The server will keep running and');
                console.error('   /api/health will report 503 until the database becomes reachable.');
                return null;
            }

            await sleep(RETRY_DELAY_MS);
        }
    }
};

module.exports = connectDB;
