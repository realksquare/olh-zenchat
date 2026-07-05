/**
 * Seeds ZenVoiceDomainWhitelist with approved academic domains.
 * Run once on first deploy: node server/scripts/seedZenVoiceDomains.js
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const ZenVoiceDomainWhitelist = require("../models/ZenVoiceDomainWhitelist");

const SEED_DOMAINS = [
    // --- Priority: Your Institution ---
    { domain: "veltechmultitech.org", institutionName: "Vel Tech Multi Tech Dr.Rangarajan Dr.Sakunthala Engineering College", country: "India" },

    // --- IITs ---
    { domain: "iitb.ac.in", institutionName: "IIT Bombay", country: "India" },
    { domain: "iitd.ac.in", institutionName: "IIT Delhi", country: "India" },
    { domain: "iitm.ac.in", institutionName: "IIT Madras", country: "India" },
    { domain: "iitkgp.ac.in", institutionName: "IIT Kharagpur", country: "India" },
    { domain: "iitk.ac.in", institutionName: "IIT Kanpur", country: "India" },
    { domain: "iith.ac.in", institutionName: "IIT Hyderabad", country: "India" },
    { domain: "iitg.ac.in", institutionName: "IIT Guwahati", country: "India" },
    { domain: "iitr.ac.in", institutionName: "IIT Roorkee", country: "India" },

    // --- NITs ---
    { domain: "nitk.ac.in", institutionName: "NIT Karnataka", country: "India" },
    { domain: "nitt.edu", institutionName: "NIT Tiruchirappalli", country: "India" },
    { domain: "nitp.ac.in", institutionName: "NIT Patna", country: "India" },
    { domain: "nitw.ac.in", institutionName: "NIT Warangal", country: "India" },

    // --- BITS ---
    { domain: "bits-pilani.ac.in", institutionName: "BITS Pilani", country: "India" },
    { domain: "pilani.bits-pilani.ac.in", institutionName: "BITS Pilani - Pilani Campus", country: "India" },
    { domain: "goa.bits-pilani.ac.in", institutionName: "BITS Pilani - Goa Campus", country: "India" },
    { domain: "hyderabad.bits-pilani.ac.in", institutionName: "BITS Pilani - Hyderabad Campus", country: "India" },

    // --- Other Prominent Indian Universities ---
    { domain: "du.ac.in", institutionName: "Delhi University", country: "India" },
    { domain: "bhu.ac.in", institutionName: "Banaras Hindu University", country: "India" },
    { domain: "vit.ac.in", institutionName: "VIT Vellore", country: "India" },
    { domain: "srm.edu.in", institutionName: "SRM Institute of Science and Technology", country: "India" },
    { domain: "amity.edu", institutionName: "Amity University", country: "India" },
    { domain: "manipal.edu", institutionName: "Manipal Academy of Higher Education", country: "India" },
    { domain: "christuniversity.in", institutionName: "Christ University", country: "India" },
    { domain: "psgtech.edu", institutionName: "PSG College of Technology", country: "India" },
    { domain: "annauniv.edu", institutionName: "Anna University", country: "India" },

    // --- Select International Institutions ---
    { domain: "mit.edu", institutionName: "Massachusetts Institute of Technology", country: "USA" },
    { domain: "stanford.edu", institutionName: "Stanford University", country: "USA" },
    { domain: "harvard.edu", institutionName: "Harvard University", country: "USA" },
    { domain: "ox.ac.uk", institutionName: "University of Oxford", country: "UK" },
    { domain: "cam.ac.uk", institutionName: "University of Cambridge", country: "UK" },
    { domain: "student.mit.edu", institutionName: "MIT (Student)", country: "USA" },
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("[ZenVoice Seed] Connected to MongoDB");

        let created = 0;
        let skipped = 0;

        for (const entry of SEED_DOMAINS) {
            const exists = await ZenVoiceDomainWhitelist.findOne({ domain: entry.domain });
            if (exists) {
                console.log(`[SKIP] ${entry.domain} already exists`);
                skipped++;
                continue;
            }
            await ZenVoiceDomainWhitelist.create({ ...entry, status: "approved" });
            console.log(`[OK]   ${entry.domain} — ${entry.institutionName}`);
            created++;
        }

        console.log(`\n[ZenVoice Seed] Done. Created: ${created}, Skipped: ${skipped}`);
    } catch (err) {
        console.error("[ZenVoice Seed] Error:", err.message);
    } finally {
        await mongoose.disconnect();
    }
}

seed();
