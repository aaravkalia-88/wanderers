import puppeteer from 'puppeteer';
import path from 'path';

(async () => {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 600, height: 1600 });
  
  const fileUrl = 'file://' + path.resolve('../technical_flow_chart_vertical.html');
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  
  const element = await page.$('.flow-container');
  await element.screenshot({
    path: path.resolve('../Wanderers_Technical_Flow_Vertical.png'),
    omitBackground: false
  });
  
  await browser.close();
})();
