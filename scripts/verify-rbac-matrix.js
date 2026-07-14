const path = require('path');
module.paths.push(path.resolve(__dirname, '../backend/node_modules'));

require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const mongoose = require('mongoose');
const axios = require('axios');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');

const User = require('../backend/src/models/User');
const Society = require('../backend/src/models/Society');
const Role = require('../backend/src/models/Role');
const UserRole = require('../backend/src/models/UserRole');

const generateToken = (user, roleId, societyId) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    { expiresIn: '7d' }
  );
};

const expectedMatrix = require('../docs/rbac-matrix.json');
process.env.NODE_ENV = 'test';

// Parse command line args
const args = process.argv.slice(2);
let baseUrl = '';
for (const arg of args) {
  if (arg.startsWith('--baseUrl=')) {
    baseUrl = arg.split('=')[1];
  }
}

async function getOrCreateTestUserForRole(roleDoc) {
  // Find user-role association
  let userRole = await UserRole.findOne({ role: roleDoc._id }).populate('user');
  if (userRole && userRole.user) {
    return { user: userRole.user, societyId: userRole.society };
  }

  // Create a new test user
  const email = `test_${roleDoc.name}@ieee-test.org`;
  let user = await User.findOne({ email });
  if (!user) {
    user = new User({
      name: `Test ${roleDoc.displayName}`,
      email,
      password: 'password123',
      role: roleDoc.name === 'sb_faculty_advisor' ? 'ADMIN' : 'OFFICE_BEARER'
    });
    await user.save();
  }

  // Assign society if role is society-scoped
  let societyId = null;
  if (roleDoc.scope === 'society') {
    let society = await Society.findOne({ shortName: 'CS' });
    if (!society) {
      society = new Society({
        name: 'Computer Society',
        shortName: 'CS',
        code: 'CS',
        description: 'IEEE Computer Society'
      });
      await society.save();
    }
    societyId = society._id;
  }

  // Assign role
  userRole = new UserRole({
    user: user._id,
    role: roleDoc._id,
    society: societyId,
    assignedBy: user._id // self-assigned for test purposes
  });
  await userRole.save();

  return { user, societyId };
}

async function run() {
  let mongoServer;
  let serverInstance;

  // If no baseUrl is provided, spin up in-memory MongoDB and a test Express server instance!
  if (!baseUrl) {
    console.log('No --baseUrl provided. Starting in-memory MongoDB and test server...');
    process.env.PORT = 5001;
    const seed = require('../backend/src/scripts/seed');
    const app = require('../backend/src/server');

    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGODB_URI = mongoUri;

    // Connect and seed
    await mongoose.connect(mongoUri);
    console.log('In-memory MongoDB started. Seeding...');
    await seed();
    await mongoose.connect(mongoUri);

    baseUrl = `http://localhost:5001`;
  } else {
    // If baseUrl is provided, connect to the configured DB (for seeding/finding test users)
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ieee_finance_pro';
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    try {
      await mongoose.connect(mongoUri);
    } catch (err) {
      console.error('Failed to connect to database:', err.message);
      process.exit(1);
    }
  }

  const failures = [];
  
  try {
    for (const [roleName, modules] of Object.entries(expectedMatrix)) {
      const roleDoc = await Role.findOne({ name: roleName });
      if (!roleDoc) {
        console.warn(`⚠️ Warning: Role "${roleName}" not found in database. Skipping.`);
        continue;
      }

      const { user, societyId } = await getOrCreateTestUserForRole(roleDoc);
      const token = generateToken(user, roleDoc._id, societyId);

      console.log(`Checking permissions for role: ${roleName}...`);

      for (const [module, expectedLevel] of Object.entries(modules)) {
        try {
          const res = await axios.post(`${baseUrl}/api/v1/access/check`,
            { userId: user._id.toString(), module, action: 'view' },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          const actual = res.data.data.accessLevel;
          if (actual !== expectedLevel) {
            failures.push(`Mismatch: Role "${roleName}" → Module "${module}": expected "${expectedLevel}", got "${actual}"`);
          }
        } catch (err) {
          failures.push(`Request failed: Role "${roleName}" → Module "${module}": ${err.message} ${err.response ? JSON.stringify(err.response.data) : ''}`);
        }
      }
    }
  } catch (error) {
    console.error('An error occurred during verification:', error);
    failures.push(`Verification process crashed: ${error.message}`);
  } finally {
    await mongoose.disconnect();
    if (serverInstance) {
      serverInstance.close();
      console.log('Test Express server stopped.');
    }
    if (mongoServer) {
      await mongoServer.stop();
      console.log('In-memory MongoDB stopped.');
    }
  }

  if (failures.length > 0) {
    console.error('\n❌ RBAC MATRIX MISMATCHES FOUND:');
    console.error(failures.join('\n'));
    process.exit(1);
  }

  console.log('\n✅ Success: RBAC matrix matches expected access levels for all roles and modules.');
  process.exit(0);
}

run();
