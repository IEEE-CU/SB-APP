/**
 * Seed only Users and Societies
 */

require("dotenv").config();
const connectDB = require("../config/database");
const User = require("../models/User");
const Society = require("../models/Society");

// IEEE Societies data
const IEEE_SOCIETIES = [
  {
    name: "IEEE Student Branch",
    shortName: "IEEE SB",
    type: "SOCIETY",
    budget: 100000,
  },
  {
    name: "Aerospace and Electronic Systems Society",
    shortName: "AESS",
    type: "SOCIETY",
    budget: 15000,
  },
  {
    name: "Antennas and Propagation Society",
    shortName: "APS",
    type: "SOCIETY",
    budget: 12000,
  },
  {
    name: "Broadcast Technology Society",
    shortName: "BTS",
    type: "SOCIETY",
    budget: 8000,
  },
  {
    name: "Circuits and Systems Society",
    shortName: "CAS",
    type: "SOCIETY",
    budget: 20000,
  },
  {
    name: "Communications Society",
    shortName: "ComSoc",
    type: "SOCIETY",
    budget: 25000,
  },
  {
    name: "Computational Intelligence Society",
    shortName: "CIS",
    type: "SOCIETY",
    budget: 18000,
  },
  {
    name: "Computer Society",
    shortName: "IEEE CS",
    type: "SOCIETY",
    budget: 40000,
  },
  {
    name: "Consumer Technology Society",
    shortName: "CTSoc",
    type: "SOCIETY",
    budget: 10000,
  },
  {
    name: "Control Systems Society",
    shortName: "CSS",
    type: "SOCIETY",
    budget: 15000,
  },
  {
    name: "Dielectrics and Electrical Insulation Society",
    shortName: "DEIS",
    type: "SOCIETY",
    budget: 9000,
  },
  {
    name: "Electron Devices Society",
    shortName: "EDS",
    type: "SOCIETY",
    budget: 14000,
  },
  {
    name: "Electromagnetic Compatibility Society",
    shortName: "EMCS",
    type: "SOCIETY",
    budget: 11000,
  },
  {
    name: "Electronics Packaging Society",
    shortName: "EPS",
    type: "SOCIETY",
    budget: 10000,
  },
  {
    name: "Engineering in Medicine and Biology Society",
    shortName: "EMBS",
    type: "SOCIETY",
    budget: 22000,
  },
  {
    name: "Education Society",
    shortName: "EdSoc",
    type: "SOCIETY",
    budget: 12000,
  },
  {
    name: "Geoscience and Remote Sensing Society",
    shortName: "GRSS",
    type: "SOCIETY",
    budget: 16000,
  },
  {
    name: "Industrial Electronics Society",
    shortName: "IES",
    type: "SOCIETY",
    budget: 20000,
  },
  {
    name: "Industry Applications Society",
    shortName: "IAS",
    type: "SOCIETY",
    budget: 22000,
  },
  {
    name: "Information Theory Society",
    shortName: "ITS",
    type: "SOCIETY",
    budget: 13000,
  },
  {
    name: "Instrumentation and Measurement Society",
    shortName: "IMS",
    type: "SOCIETY",
    budget: 12500,
  },
  {
    name: "Intelligent Transportation Systems Society",
    shortName: "ITSS",
    type: "SOCIETY",
    budget: 14000,
  },
  {
    name: "Magnetics Society",
    shortName: "MAG",
    type: "SOCIETY",
    budget: 10000,
  },
  {
    name: "Microwave Theory and Technology Society",
    shortName: "MTT-S",
    type: "SOCIETY",
    budget: 18000,
  },
  {
    name: "Nuclear and Plasma Sciences Society",
    shortName: "NPSS",
    type: "SOCIETY",
    budget: 15000,
  },
  {
    name: "Oceanic Engineering Society",
    shortName: "OES",
    type: "SOCIETY",
    budget: 12000,
  },
  {
    name: "Photonics Society",
    shortName: "PHO",
    type: "SOCIETY",
    budget: 17000,
  },
  {
    name: "Power Electronics Society",
    shortName: "PELS",
    type: "SOCIETY",
    budget: 24000,
  },
  {
    name: "Power & Energy Society",
    shortName: "PES",
    type: "SOCIETY",
    budget: 30000,
  },
  {
    name: "Product Safety Engineering Society",
    shortName: "PSES",
    type: "SOCIETY",
    budget: 8500,
  },
  {
    name: "Professional Communication Society",
    shortName: "PCS",
    type: "SOCIETY",
    budget: 7000,
  },
  {
    name: "Reliability Society",
    shortName: "RS",
    type: "SOCIETY",
    budget: 9500,
  },
  {
    name: "Robotics and Automation Society",
    shortName: "RAS",
    type: "SOCIETY",
    budget: 35000,
  },
  {
    name: "Signal Processing Society",
    shortName: "SPS",
    type: "SOCIETY",
    budget: 26000,
  },
  {
    name: "Society on Social Implications of Technology",
    shortName: "SSIT",
    type: "SOCIETY",
    budget: 9000,
  },
  {
    name: "Solid-State Circuits Society",
    shortName: "SSCS",
    type: "SOCIETY",
    budget: 20000,
  },
  {
    name: "Systems, Man, and Cybernetics Society",
    shortName: "SMC",
    type: "SOCIETY",
    budget: 15000,
  },
  {
    name: "Technology and Engineering Management Society",
    shortName: "TEMS",
    type: "SOCIETY",
    budget: 11000,
  },
  {
    name: "Ultrasonics, Ferroelectrics, and Frequency Control Society",
    shortName: "UFFC",
    type: "SOCIETY",
    budget: 13000,
  },
  {
    name: "Vehicular Technology Society",
    shortName: "VTS",
    type: "SOCIETY",
    budget: 14500,
  },
];

const AFFINITY_GROUPS = [
  {
    name: "Women in Engineering",
    shortName: "WIE",
    type: "AFFINITY_GROUP",
    budget: 15000,
  },
  {
    name: "Young Professionals",
    shortName: "YP",
    type: "AFFINITY_GROUP",
    budget: 10000,
  },
  {
    name: "Special Interest Group on Humanitarian Technology",
    shortName: "SIGHT",
    type: "AFFINITY_GROUP",
    budget: 12000,
  },
  {
    name: "Life Members",
    shortName: "LM",
    type: "AFFINITY_GROUP",
    budget: 5000,
  },
];

const IEEE_COUNCILS = [
  {
    name: "Sensors Council",
    shortName: "Sensors",
    type: "COUNCIL",
    budget: 12000,
  },
  {
    name: "Biometrics Council",
    shortName: "Biometrics",
    type: "COUNCIL",
    budget: 8000,
  },
  {
    name: "Nanotechnology Council",
    shortName: "Nano",
    type: "COUNCIL",
    budget: 10000,
  },
  {
    name: "Systems Council",
    shortName: "Systems",
    type: "COUNCIL",
    budget: 15000,
  },
  {
    name: "Council on Electronic Design Automation",
    shortName: "CEDA",
    type: "COUNCIL",
    budget: 11000,
  },
];

// Admin users
const ADMIN_USERS = [
  {
    email: "admin@ieee.org",
    password: "admin1234",
    role: "ADMIN",
    name: "CHRIST SBC",
  },
  {
    email: "dean@ieee.org",
    password: "admin1234",
    role: "ADMIN",
    name: "Dean of Engineering",
  },
  {
    email: "director@ieee.org",
    password: "admin1234",
    role: "ADMIN",
    name: "Director",
  },
  {
    email: "associate.dean@ieee.org",
    password: "admin1234",
    role: "ADMIN",
    name: "Associate Dean",
  },
  {
    email: "associate.director@ieee.org",
    password: "admin1234",
    role: "ADMIN",
    name: "Associate Director",
  },
];

const generateEmail = (shortName) => {
  return `${shortName.toLowerCase().replace(/[^a-z0-9]/g, "")}@ieee.org`;
};

async function seedUsersAndSocieties() {
  try {
    await connectDB();
    console.log("🌱 Seeding Users and Societies only...\n");

    // Combine all societies
    const allSocieties = [
      ...IEEE_SOCIETIES,
      ...AFFINITY_GROUPS,
      ...IEEE_COUNCILS,
    ];

    // Create societies
    console.log("🏛️  Creating societies...");
    const createdSocieties = await Society.insertMany(allSocieties);
    console.log(`   ✅ Created ${createdSocieties.length} societies`);

    // Create admin users
    console.log("👤 Creating admin users...");
    for (const admin of ADMIN_USERS) {
      await User.create(admin);
    }
    console.log(`   ✅ Created ${ADMIN_USERS.length} admin users`);

    // Create office bearer users for each society
    console.log("👥 Creating office bearer users...");
    let obCount = 0;
    const createdEmails = new Set();

    for (const society of createdSocieties) {
      const email = generateEmail(society.shortName);

      if (createdEmails.has(email)) {
        console.log(`   ⚠️  Skipping duplicate email: ${email}`);
        continue;
      }

      await User.create({
        email,
        password: "office1234",
        role: "OFFICE_BEARER",
        name: `${society.shortName} Chair`,
        societyId: society._id,
      });

      createdEmails.add(email);
      obCount++;
    }
    console.log(`   ✅ Created ${obCount} office bearer users`);

    const totalUsers = ADMIN_USERS.length + obCount;
    console.log(
      `\n✅ Done! Created ${createdSocieties.length} societies and ${totalUsers} users.`,
    );

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

seedUsersAndSocieties();
