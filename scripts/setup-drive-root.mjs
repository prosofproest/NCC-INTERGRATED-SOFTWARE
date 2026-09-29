import { google } from "googleapis";

function sanitizeEnvValue(val) {
  if (!val) return "";
  let trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1);
  }
  return trimmed.replace(/\\n/g, "\n");
}

const clientEmail = sanitizeEnvValue(process.env.GOOGLE_DRIVE_CLIENT_EMAIL);
const privateKey = sanitizeEnvValue(process.env.GOOGLE_DRIVE_PRIVATE_KEY);

if (!clientEmail || !privateKey) {
  console.error("❌ Error: Missing Google Drive credentials in environment variables.");
  console.error("Required: GOOGLE_DRIVE_CLIENT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY");
  process.exit(1);
}

const auth = new google.auth.JWT({
  email: clientEmail,
  key: privateKey,
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const drive = google.drive({ version: "v3", auth });

async function setupDriveRoot() {
  console.log("======================================================");
  console.log(" NCC DATA SYSTEM — GOOGLE DRIVE ROOT SETUP");
  console.log("======================================================");
  console.log(`Service Account: ${clientEmail}`);

  try {
    // Check if folder already exists in root of service account drive
    const listRes = await drive.files.list({
      q: "name = 'NCC Cadet Documents' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: "files(id, name, createdTime)",
      spaces: "drive",
    });

    let folderId;
    if (listRes.data.files && listRes.data.files.length > 0) {
      folderId = listRes.data.files[0].id;
      console.log(`\n✓ Existing root folder found: "${listRes.data.files[0].name}"`);
    } else {
      console.log("\n• Creating folder 'NCC Cadet Documents' in service account Drive...");
      const createRes = await drive.files.create({
        requestBody: {
          name: "NCC Cadet Documents",
          mimeType: "application/vnd.google-apps.folder",
        },
        fields: "id, name",
      });
      folderId = createRes.data.id;
      console.log(`✓ Created folder: "${createRes.data.name}"`);
    }

    console.log("\n======================================================");
    console.log(` ROOT FOLDER ID: ${folderId}`);
    console.log("======================================================");
    console.log(`\nPlease ensure GOOGLE_DRIVE_ROOT_FOLDER_ID in .env.local is set to:`);
    console.log(`GOOGLE_DRIVE_ROOT_FOLDER_ID="${folderId}"\n`);

    return folderId;
  } catch (error) {
    console.error("❌ Failed to setup root Drive folder:", error.message || error);
    process.exit(1);
  }
}

setupDriveRoot();
