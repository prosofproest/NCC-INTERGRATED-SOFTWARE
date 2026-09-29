import http from "http";
import url from "url";
import readline from "readline";
import fs from "fs";
import path from "path";
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

// 1. Load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
let envContent = "";
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, "utf8");
}

function getEnvVar(key) {
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (match) {
    return sanitizeEnvValue(match[1]);
  }
  return sanitizeEnvValue(process.env[key]);
}

const clientId = getEnvVar("GOOGLE_OAUTH_CLIENT_ID");
const clientSecret = getEnvVar("GOOGLE_OAUTH_CLIENT_SECRET");
const rootFolderId = getEnvVar("GOOGLE_DRIVE_ROOT_FOLDER_ID");

if (!clientId || !clientSecret) {
  console.error("❌ Error: GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be set in .env.local");
  process.exit(1);
}

const PORT = 8085;
const redirectUri = `http://localhost:${PORT}`;

// We request both full drive and drive.file scopes:
// - drive: Required to access and create subfolders/files inside pre-existing root folders created via Web UI
// - drive.file: Covers files created and managed by this app
const scopes = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.file",
];

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: scopes,
});

console.log("======================================================================");
console.log(" NCC DATA SYSTEM — GOOGLE DRIVE OAUTH DELEGATION AUTHORIZATION");
console.log("======================================================================\n");
console.log("This one-time authorization grants delegated user access to Google Drive");
console.log("so that cadet documents are uploaded with real personal storage quota.\n");
console.log("👉 STEP 1: Open this URL in your web browser:\n");
console.log(authUrl);
console.log("\n👉 STEP 2: Sign in with your NCC admin Google Account (e.g. nccairwing17@gmail.com)");
console.log("   and approve the Drive permissions.\n");
console.log("👉 STEP 3: After clicking 'Allow':");
console.log(`   - If your browser redirects to http://localhost:${PORT}, authorization completes automatically!`);
console.log("   - If you are on a remote server or the redirect cannot connect, copy the full URL");
console.log("     or the '?code=...' value from your browser address bar and paste it below:\n");

let handled = false;

async function processAuthCode(code) {
  if (handled) return;
  handled = true;

  try {
    console.log("\nExchanging authorization code for tokens...");
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      console.warn("\n⚠️ Warning: Google did not return a new refresh token.");
      console.warn("If you previously approved this app, you may need to revoke app access at:");
      console.warn("https://myaccount.google.com/permissions and run this script again with prompt: 'consent'.");
    } else {
      console.log("✓ Refresh token successfully obtained!");

      // Update or append GOOGLE_OAUTH_REFRESH_TOKEN in .env.local
      let updatedEnv = envContent;
      if (/^GOOGLE_OAUTH_REFRESH_TOKEN=/m.test(updatedEnv)) {
        updatedEnv = updatedEnv.replace(
          /^GOOGLE_OAUTH_REFRESH_TOKEN=.*$/m,
          `GOOGLE_OAUTH_REFRESH_TOKEN="${tokens.refresh_token}"`
        );
      } else if (/^GOOGLE_OAUTH_CLIENT_SECRET=/m.test(updatedEnv)) {
        updatedEnv = updatedEnv.replace(
          /^GOOGLE_OAUTH_CLIENT_SECRET=.*$/m,
          `$&\nGOOGLE_OAUTH_REFRESH_TOKEN="${tokens.refresh_token}"`
        );
      } else {
        updatedEnv += `\nGOOGLE_OAUTH_REFRESH_TOKEN="${tokens.refresh_token}"\n`;
      }

      fs.writeFileSync(envPath, updatedEnv, "utf8");
      console.log(`✓ GOOGLE_OAUTH_REFRESH_TOKEN saved to .env.local`);
    }

    // Verify token with a live Drive API test
    oauth2Client.setCredentials(tokens);
    const drive = google.drive({ version: "v3", auth: oauth2Client });
    const about = await drive.about.get({
      fields: "user, storageQuota",
    });

    const user = about.data.user;
    const quota = about.data.storageQuota;
    const limitGb = quota.limit ? (Number(quota.limit) / (1024 ** 3)).toFixed(2) : "Unlimited";
    const usageGb = quota.usage ? (Number(quota.usage) / (1024 ** 3)).toFixed(2) : "0.00";

    console.log("\n======================================================================");
    console.log(" 🎉 AUTHORIZATION SUCCESSFUL & VERIFIED!");
    console.log("======================================================================");
    console.log(`• Authenticated User: ${user.displayName} (${user.emailAddress})`);
    console.log(`• Account Storage Quota: ${usageGb} GB used of ${limitGb} GB`);
    console.log(`• Refresh Token: ${tokens.refresh_token ? tokens.refresh_token.slice(0, 12) + "..." : "[Retained existing]"}`);

    if (rootFolderId) {
      try {
        const folder = await drive.files.get({
          fileId: rootFolderId,
          fields: "id, name, capabilities",
          supportsAllDrives: true,
        });
        console.log(`• Root Folder Access: Verified '${folder.data.name}' (${folder.data.id})`);
      } catch (fErr) {
        console.warn(`• Root Folder Note: Could not inspect ${rootFolderId}: ${fErr.message}`);
      }
    }

    console.log("\nNext step: Run the Stage 12 test suite to verify end-to-end binary upload:");
    console.log("  npx tsx --env-file=.env.local scripts/test-stage12-documents.mjs\n");

    process.exit(0);
  } catch (err) {
    console.error("\n❌ Authorization exchange failed:", err?.response?.data || err?.message || err);
    process.exit(1);
  }
}

// Start local HTTP server to receive the redirect callback
const server = http.createServer((req, res) => {
  const reqUrl = url.parse(req.url, true);
  if (reqUrl.pathname === "/" || reqUrl.pathname === "/oauth2callback") {
    const code = reqUrl.query.code;
    const error = reqUrl.query.error;

    if (error) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(`<h2>Authorization Error:</h2><p>${error}</p>`);
      console.error(`\n❌ Error from Google OAuth: ${error}`);
      process.exit(1);
    }

    if (code) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <div style="font-family: sans-serif; text-align: center; padding: 40px;">
          <h2 style="color: #16a34a;">✓ Google Drive Authorization Successful!</h2>
          <p>You can close this tab and return to the terminal.</p>
        </div>
      `);
      server.close();
      processAuthCode(code);
    }
  }
});

server.listen(PORT, () => {
  // Readline fallback for manual code entry
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Enter authorization code (or paste redirected URL): ", (input) => {
    rl.close();
    server.close();
    let code = input.trim();
    if (code.includes("code=")) {
      const match = code.match(/code=([^&]+)/);
      if (match) code = decodeURIComponent(match[1]);
    }
    processAuthCode(code);
  });
});
