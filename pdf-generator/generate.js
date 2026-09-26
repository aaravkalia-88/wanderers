import puppeteer from 'puppeteer';
import path from 'path';

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  const fileUrl = 'file://' + path.resolve('../wanderers_tech_presentation.html');
  console.log("Loading page: " + fileUrl);
  
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  
  const outputPath = path.resolve('../Wanderers_Tech_Stack_Slides.pdf');
  console.log("Saving PDF to: " + outputPath);
  
  await page.pdf({
    path: outputPath,
    printBackground: true,
    width: '1280px',
    height: '720px',
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });
  
  await browser.close();
  console.log("Done!");
})();
