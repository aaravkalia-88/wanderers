import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  console.log("Launching Puppeteer...");
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  const fileUrl = 'file://' + path.resolve(__dirname, '../Indian_Telecom_Industry_Managerial_Economics_Report.html');
  console.log("Loading page: " + fileUrl);
  
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  
  const outputPath = path.resolve(__dirname, '../Indian_Telecom_Industry_Managerial_Economics_Report.pdf');
  console.log("Saving PDF to: " + outputPath);
  
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });
  
  await browser.close();
  console.log("PDF Generation Successfully Completed!");
})();
