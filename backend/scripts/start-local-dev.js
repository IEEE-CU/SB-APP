#!/usr/bin/env node
/**
 * Local Development Server with In-Memory MongoDB
 * 
 * Boots the backend against a real in-memory MongoDB instance and seeds
 * it with test data and users. This mimics a real backend environment
 * completely for local frontend testing without needing MongoDB installed.
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const seed = require('../src/scripts/seed');

async function main() {
    console.log('🚀 Starting Local Development Environment...');
    
    // Start In-Memory MongoDB
    console.log('📦 Starting in-memory MongoDB server...');
    const mongod = await MongoMemoryServer.create();
    
    // Set Environment Variables
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-do-not-use-in-production';
    process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
    process.env.NODE_ENV = 'development';
    process.env.PORT = process.env.PORT || 5000;
    
    // Run Seeding
    await seed();
    
    // Start Server
    console.log('🌐 Booting Express Server...');
    require('../src/server.js');
}

main().catch((err) => {
    console.error('❌ Failed to start local development server:', err);
    process.exit(1);
});
