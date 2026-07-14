/**
 * Database Seeding Script
 * Seeds the MongoDB database with IEEE societies and admin users
 * 
 * Usage: npm run seed
 */

require('dotenv').config();
const connectDB = require('../config/database');

// Import models
const User = require('../models/User');
const Society = require('../models/Society');
const Project = require('../models/Project');
const CalendarEvent = require('../models/CalendarEvent');
const Announcement = require('../models/Announcement');

// IEEE Societies data (from frontend constants)
const IEEE_SOCIETIES = [
    { name: 'IEEE Student Branch', shortName: 'IEEE SB', type: 'SOCIETY', budget: 100000 },
    { name: 'Aerospace and Electronic Systems Society', shortName: 'AESS', type: 'SOCIETY', budget: 15000 },
    { name: 'Antennas and Propagation Society', shortName: 'APS', type: 'SOCIETY', budget: 12000 },
    { name: 'Broadcast Technology Society', shortName: 'BTS', type: 'SOCIETY', budget: 8000 },
    { name: 'Circuits and Systems Society', shortName: 'CAS', type: 'SOCIETY', budget: 20000 },
    { name: 'Communications Society', shortName: 'ComSoc', type: 'SOCIETY', budget: 25000 },
    { name: 'Computational Intelligence Society', shortName: 'CIS', type: 'SOCIETY', budget: 18000 },
    { name: 'Computer Society', shortName: 'IEEE CS', type: 'SOCIETY', budget: 40000 },
    { name: 'Consumer Technology Society', shortName: 'CTSoc', type: 'SOCIETY', budget: 10000 },
    { name: 'Control Systems Society', shortName: 'CSS', type: 'SOCIETY', budget: 15000 },
    { name: 'Dielectrics and Electrical Insulation Society', shortName: 'DEIS', type: 'SOCIETY', budget: 9000 },
    { name: 'Electron Devices Society', shortName: 'EDS', type: 'SOCIETY', budget: 14000 },
    { name: 'Electromagnetic Compatibility Society', shortName: 'EMCS', type: 'SOCIETY', budget: 11000 },
    { name: 'Electronics Packaging Society', shortName: 'EPS', type: 'SOCIETY', budget: 10000 },
    { name: 'Engineering in Medicine and Biology Society', shortName: 'EMBS', type: 'SOCIETY', budget: 22000 },
    { name: 'Education Society', shortName: 'EdSoc', type: 'SOCIETY', budget: 12000 },
    { name: 'Geoscience and Remote Sensing Society', shortName: 'GRSS', type: 'SOCIETY', budget: 16000 },
    { name: 'Industrial Electronics Society', shortName: 'IES', type: 'SOCIETY', budget: 20000 },
    { name: 'Industry Applications Society', shortName: 'IAS', type: 'SOCIETY', budget: 22000 },
    { name: 'Information Theory Society', shortName: 'ITS', type: 'SOCIETY', budget: 13000 },
    { name: 'Instrumentation and Measurement Society', shortName: 'IMS', type: 'SOCIETY', budget: 12500 },
    { name: 'Intelligent Transportation Systems Society', shortName: 'ITSS', type: 'SOCIETY', budget: 14000 },
    { name: 'Magnetics Society', shortName: 'MAG', type: 'SOCIETY', budget: 10000 },
    { name: 'Microwave Theory and Technology Society', shortName: 'MTT-S', type: 'SOCIETY', budget: 18000 },
    { name: 'Nuclear and Plasma Sciences Society', shortName: 'NPSS', type: 'SOCIETY', budget: 15000 },
    { name: 'Oceanic Engineering Society', shortName: 'OES', type: 'SOCIETY', budget: 12000 },
    { name: 'Photonics Society', shortName: 'PHO', type: 'SOCIETY', budget: 17000 },
    { name: 'Power Electronics Society', shortName: 'PELS', type: 'SOCIETY', budget: 24000 },
    { name: 'Power & Energy Society', shortName: 'PES', type: 'SOCIETY', budget: 30000 },
    { name: 'Product Safety Engineering Society', shortName: 'PSES', type: 'SOCIETY', budget: 8500 },
    { name: 'Professional Communication Society', shortName: 'PCS', type: 'SOCIETY', budget: 7000 },
    { name: 'Reliability Society', shortName: 'RS', type: 'SOCIETY', budget: 9500 },
    { name: 'Robotics and Automation Society', shortName: 'RAS', type: 'SOCIETY', budget: 35000 },
    { name: 'Signal Processing Society', shortName: 'SPS', type: 'SOCIETY', budget: 26000 },
    { name: 'Society on Social Implications of Technology', shortName: 'SSIT', type: 'SOCIETY', budget: 9000 },
    { name: 'Solid-State Circuits Society', shortName: 'SSCS', type: 'SOCIETY', budget: 20000 },
    { name: 'Systems, Man, and Cybernetics Society', shortName: 'SMC', type: 'SOCIETY', budget: 15000 },
    { name: 'Technology and Engineering Management Society', shortName: 'TEMS', type: 'SOCIETY', budget: 11000 },
    { name: 'Ultrasonics, Ferroelectrics, and Frequency Control Society', shortName: 'UFFC', type: 'SOCIETY', budget: 13000 },
    { name: 'Vehicular Technology Society', shortName: 'VTS', type: 'SOCIETY', budget: 14500 }
];

const AFFINITY_GROUPS = [
    { name: 'Women in Engineering', shortName: 'WIE', type: 'AFFINITY_GROUP', budget: 15000 },
    { name: 'Young Professionals', shortName: 'YP', type: 'AFFINITY_GROUP', budget: 10000 },
    { name: 'Special Interest Group on Humanitarian Technology', shortName: 'SIGHT', type: 'AFFINITY_GROUP', budget: 12000 },
    { name: 'Life Members', shortName: 'LM', type: 'AFFINITY_GROUP', budget: 5000 }
];

const IEEE_COUNCILS = [
    { name: 'Sensors Council', shortName: 'Sensors', type: 'COUNCIL', budget: 12000 },
    { name: 'Biometrics Council', shortName: 'Biometrics', type: 'COUNCIL', budget: 8000 },
    { name: 'Nanotechnology Council', shortName: 'Nano', type: 'COUNCIL', budget: 10000 },
    { name: 'Systems Council', shortName: 'Systems', type: 'COUNCIL', budget: 15000 },
    { name: 'Council on Electronic Design Automation', shortName: 'CEDA', type: 'COUNCIL', budget: 11000 }
];

// Admin users
const ADMIN_USERS = [
    { email: 'admin@ieee.org', password: 'password123', role: 'ADMIN', name: 'CHRIST SBC' },
    { email: 'dean@ieee.org', password: 'password123', role: 'ADMIN', name: 'Dean of Engineering' },
    { email: 'director@ieee.org', password: 'password123', role: 'ADMIN', name: 'Director' },
    { email: 'associate.dean@ieee.org', password: 'password123', role: 'ADMIN', name: 'Associate Dean' },
    { email: 'associate.director@ieee.org', password: 'password123', role: 'ADMIN', name: 'Associate Director' }
];

// Additional test users
const ADDITIONAL_USERS = [
    { email: 'teacher@ieee.org', password: 'password123', role: 'FACULTY', name: 'Faculty Advisor' },
    { email: 'member@ieee.org', password: 'password123', role: 'STUDENT_MEMBER', name: 'Student Member' },
    { email: 'student@ieee.org', password: 'password123', role: 'STUDENT', name: 'Guest Student' }
];

// Helper to generate email from short name
const generateEmail = (shortName) => {
    return `${shortName.toLowerCase().replace(/[^a-z0-9]/g, '')}@ieee.org`;
};

async function seed() {
    try {
        await connectDB();
        console.log('🌱 Starting database seeding...\n');

        // Clear existing data
        console.log('🗑️  Clearing existing data...');
        await User.deleteMany({});
        await Society.deleteMany({});
        await Project.deleteMany({});
        await CalendarEvent.deleteMany({});
        await Announcement.deleteMany({});

        // Combine all societies
        const allSocieties = [...IEEE_SOCIETIES, ...AFFINITY_GROUPS, ...IEEE_COUNCILS];

        // Create societies
        console.log('🏛️  Creating societies...');
        const createdSocieties = await Society.insertMany(allSocieties);
        console.log(`   ✅ Created ${createdSocieties.length} societies`);

        // Create society ID map
        const societyMap = {};
        createdSocieties.forEach(s => {
            societyMap[s.shortName] = s._id;
        });

        // Create admin users
        console.log('👤 Creating admin users...');
        for (const admin of ADMIN_USERS) {
            await User.create(admin);
        }
        console.log(`   ✅ Created ${ADMIN_USERS.length} admin users`);

        // Create office bearer users for each society
        console.log('👥 Creating office bearer users...');
        let obCount = 0;
        const createdEmails = new Set();

        for (const society of createdSocieties) {
            const email = generateEmail(society.shortName);

            // Check for duplicate emails
            if (createdEmails.has(email)) {
                console.log(`   ⚠️  WARNING: Duplicate email ${email} for ${society.shortName} - skipping`);
                continue;
            }

            await User.create({
                email,
                password: 'password123',
                role: 'OFFICE_BEARER',
                name: `${society.shortName} Chair`,
                societyId: society._id
            });

            createdEmails.add(email);
            console.log(`   ✅ ${email.padEnd(25)} → ${society.shortName.padEnd(10)} (${society.name})`);
            obCount++;
        }
        console.log(`   ✅ Created ${obCount} office bearer users`);

        console.log('👤 Creating additional test users...');
        for (const user of ADDITIONAL_USERS) {
            await User.create(user);
        }
        console.log(`   ✅ Created ${ADDITIONAL_USERS.length} additional test users`);

        // Create sample projects
        console.log('📁 Creating sample projects...');
        const sampleProjects = [
            {
                societyId: societyMap['RAS'],
                title: 'Autonomous Agricultural Drone',
                category: 'TECHNICAL_PROJECT',
                sanctioningBody: 'IEEE R10 HAC',
                amountSanctioned: 45000,
                startDate: new Date('2024-01-15'),
                status: 'ONGOING',
                description: 'Developing a low-cost drone for small-scale farmers to monitor crop health.'
            },
            {
                societyId: societyMap['WIE'],
                title: 'STEM Outreach for Rural Girls',
                category: 'TECHNICAL_PROJECT',
                sanctioningBody: 'IEEE WIE HQ',
                amountSanctioned: 15000,
                startDate: new Date('2023-11-20'),
                status: 'COMPLETED',
                description: 'Mentorship program and workshops for girls in grade 8-10 in rural Bangalore.'
            },
            {
                societyId: societyMap['IEEE SB'],
                title: 'IEEE R10 SYWL Congress Travel',
                category: 'TRAVEL_GRANT',
                sanctioningBody: 'IEEE Region 10',
                amountSanctioned: 65000,
                startDate: new Date('2024-03-10'),
                status: 'ANNOUNCED',
                description: 'Travel grant for Student Branch Chair to attend the Regional Congress in Tokyo.'
            },
            {
                societyId: societyMap['IEEE CS'],
                title: 'IEEE CS Richard E. Merwin Scholarship',
                category: 'SCHOLARSHIP',
                sanctioningBody: 'IEEE Computer Society',
                amountSanctioned: 82000,
                startDate: new Date('2024-02-01'),
                status: 'AWARDED',
                description: 'Prestigious scholarship recognized for active involvement in student branch leadership.'
            }
        ];
        await Project.insertMany(sampleProjects);
        console.log(`   ✅ Created ${sampleProjects.length} sample projects`);

        // Create sample calendar events
        console.log('📅 Creating sample calendar events...');
        const now = new Date();
        const sampleCalendarEvents = [
            {
                societyId: societyMap['IEEE CS'],
                title: 'CodeSprint 2024 Hackathon',
                date: new Date(now.getFullYear(), now.getMonth(), 15),
                time: '09:00',
                venue: 'Block 4, 3rd Floor Labs',
                status: 'CONFIRMED',
                description: '24-hour hackathon focused on sustainable development goals.'
            },
            {
                societyId: societyMap['RAS'],
                title: 'Robotics Workshop: Line Follower',
                date: new Date(now.getFullYear(), now.getMonth(), 22),
                time: '14:00',
                venue: 'Auditorium Block 1',
                status: 'PROPOSED',
                description: 'Introductory workshop for first year students on basic robotics.'
            },
            {
                societyId: societyMap['WIE'],
                title: 'Women in Tech Panel Discussion',
                date: new Date(now.getFullYear(), now.getMonth() + 1, 5),
                time: '10:00',
                venue: 'Seminar Hall',
                status: 'CONFIRMED',
                description: 'Panel discussion with industry leaders from top tech companies.'
            },
            {
                societyId: societyMap['IEEE CS'],
                title: 'Intro to Web Dev Workshop',
                date: new Date(now.getFullYear(), now.getMonth(), 28),
                time: '16:00',
                venue: 'Block 2, Room 412',
                status: 'PROPOSED',
                description: 'A beginner-friendly workshop on React and Vite.'
            },
            {
                societyId: societyMap['IEEE SB'],
                title: 'Annual General Meeting 2024',
                date: new Date(now.getFullYear(), now.getMonth() + 2, 10),
                time: '11:00',
                venue: 'Main Auditorium',
                status: 'CONFIRMED',
                description: 'The main gathering for all IEEE members.'
            }
        ];
        await CalendarEvent.insertMany(sampleCalendarEvents);
        console.log(`   ✅ Created ${sampleCalendarEvents.length} calendar events`);

        // Create sample announcements
        console.log('📢 Creating sample announcements...');
        const sampleAnnouncements = [
            {
                title: 'General Body Meeting',
                message: 'All office bearers are requested to attend the GBM on Friday at 4 PM in Block 1 Auditorium.',
                date: new Date(now.setDate(now.getDate() - 2)),
                senderName: 'CHRIST SBC',
                targetAudience: 'LEADERSHIP'
            },
            {
                title: 'Membership Drive Extended',
                message: 'The early bird membership drive has been extended by one week due to high demand.',
                date: new Date(now.setDate(now.getDate() - 5)),
                senderName: 'Dean of Engineering',
                targetAudience: 'ALL'
            }
        ];
        await Announcement.insertMany(sampleAnnouncements);
        console.log(`   ✅ Created ${sampleAnnouncements.length} announcements`);

        console.log('\n✨ Database seeding completed successfully!\n');
        console.log('📋 Login Credentials:');
        console.log('   Admin:          admin@ieee.org / password123');
        console.log('   Office Bearer:  cs@ieee.org / password123');
        console.log('   Faculty:        teacher@ieee.org / password123');
        console.log('   Member:         member@ieee.org / password123');
        console.log('   Student:        student@ieee.org / password123');
        console.log('   (Any society:   <shortname>@ieee.org / password123)\n');

        if (require.main === module) {
            process.exit(0);
        }
    } catch (error) {
        console.error('❌ Seeding error:', error);
        if (require.main === module) {
            process.exit(1);
        }
        throw error;
    }
}

if (require.main === module) {
    seed();
}

module.exports = seed;
