import fs from 'fs';
import { execSync } from 'child_process';

function zip(name) {
  const cmd = `rm -f ../${name} && 7z a -tzip ../${name} . > /dev/null`;
  execSync(cmd, { cwd: distPath, shell: true });
}

const distPath = './dist';
const manifestPath = `${distPath}/manifest.json`;

if (!fs.existsSync(manifestPath)) {
  console.error("manifest.json not found!");
  process.exit(1);
}

const originalManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// 1. Chrome Zip
console.log("Packaging Chrome extension...");
const chromeManifest = JSON.parse(JSON.stringify(originalManifest));
delete chromeManifest.browser_specific_settings;
if (chromeManifest.background) {
  delete chromeManifest.background.scripts;
}
fs.writeFileSync(manifestPath, JSON.stringify(chromeManifest, null, 2));
zip("readlater-chrome.zip");

// 2. Firefox Zip
console.log("Packaging Firefox extension...");
const ffManifest = JSON.parse(JSON.stringify(originalManifest));
if (ffManifest.background) {
  delete ffManifest.background.service_worker;
}
fs.writeFileSync(manifestPath, JSON.stringify(ffManifest, null, 2));
zip("readlater-firefox.zip");

// Restore original manifest
fs.writeFileSync(manifestPath, JSON.stringify(originalManifest, null, 2));
console.log("Packaging complete. Created readlater-chrome.zip and readlater-firefox.zip.");
