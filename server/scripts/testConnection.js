require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

// Import all models to ensure no syntax/compilation issues
require('../models/User');
require('../models/Role');
require('../models/Permission');
require('../models/RolePermission');
require('../models/Society');
require('../models/Membership');
require('../models/Transaction');
require('../models/Event');
require('../models/Project');
require('../models/Report');
require('../models/Announcement');
require('../models/File');
require('../models/AuditLog');
require('../models/Notification');

const testConnection = async () => {
  try {
    console.log('📡 Testing MongoDB connection...');
    const conn = await connectDB();
    
    console.log('✓ Successfully connected to:', conn.connection.name);
    console.log('✓ All schemas loaded correctly:');
    
    const models = Object.keys(mongoose.models);
    console.log(`  Total Models Registered: ${models.length}`);
    console.log(`  Models: ${models.join(', ')}`);
    
    await mongoose.connection.close();
    console.log('📡 Connection closed. Test successful!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Connection test failed:', err);
    process.exit(1);
  }
};

testConnection();
