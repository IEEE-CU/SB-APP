require('dotenv').config();
const mongoose = require('mongoose');
const { User, Society, Transaction, Event, Project, CalendarEvent, Announcement } = require('../models');

async function clearAllData() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB Atlas');

        // Clear all collections
        console.log('\nClearing all collections...\n');

        const results = await Promise.all([
            User.deleteMany({}),
            Society.deleteMany({}),
            Transaction.deleteMany({}),
            Event.deleteMany({}),
            Project.deleteMany({}),
            CalendarEvent.deleteMany({}),
            Announcement.deleteMany({})
        ]);

        const collections = ['Users', 'Societies', 'Transactions', 'Events', 'Projects', 'CalendarEvents', 'Announcements'];

        results.forEach((result, index) => {
            console.log(`✅ ${collections[index]}: ${result.deletedCount} documents deleted`);
        });

        console.log('\n✅ All data cleared successfully!');

    } catch (error) {
        console.error('❌ Error clearing data:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('\nDatabase connection closed.');
        process.exit(0);
    }
}

clearAllData();
