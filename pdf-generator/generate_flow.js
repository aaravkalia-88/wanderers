import puppeteer from 'puppeteer';
import path from 'path';

(async () => {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  const fileUrl = 'file://' + path.resolve('../technical_flow_chart.html');
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  
  // Take a high quality screenshot of just the flow element
  const element = await page.$('.flow-container');
  await element.screenshot({
    path: path.resolve('../Wanderers_Technical_Flow.png'),
    omitBackground: false
  });
  
  await browser.close();
})();
