const puppeteer = require('puppeteer');
const path = require('path');
const assert = require('node:assert/strict');
(async () => {
 const browser = await puppeteer.launch({executablePath:path.resolve(__dirname,'chrome/mac_arm-153.0.8010.36/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'), headless:true});
 try {
 const page = await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const shot=async name=>page.screenshot({path:path.resolve(__dirname,'../artifacts/'+name+'.png'),fullPage:true});
 const clickText=async text=>{const handle=await page.evaluateHandle(text=>Array.from(document.querySelectorAll('button,a')).find(e=>e.textContent.trim()===text),text);assert(await handle.asElement(), 'Missing control: '+text);await handle.asElement().click();await handle.dispose();};
 await page.setViewport({width:1440,height:1050,deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle2'});await page.evaluate(()=>document.fonts.ready);
 await page.waitForFunction(()=>!!localStorage.getItem('wanderer-token'));
 assert.equal(await page.$$eval('.destination-card',e=>e.length),9);
 await shot('home-desktop');
 await page.click('input[aria-label="Search destinations"]');await page.type('input[aria-label="Search destinations"]','Barot');await page.waitForFunction(()=>document.querySelectorAll('.destination-card').length===1);
 await page.click('button[aria-label="Save Barot"]');await page.waitForSelector('button[aria-label="Unsave Barot"]');
 await page.click('.card-title');await page.waitForSelector('dialog[open]');assert(page.url().endsWith('/places/2'));
 await clickText('Mark as visited');await page.waitForSelector('.visit-form');await page.type('textarea','Browser check: a peaceful valley walk.');await clickText('Stamp my passport');await page.waitForFunction(()=>!document.querySelector('dialog'));
 await clickText('My passport');await page.waitForSelector('.stamp-card:not(.awaiting)');assert((await page.$eval('.xp-count',e=>e.textContent)).includes('400'));
 await shot('passport-desktop');
 await page.reload({waitUntil:'networkidle2'});await page.waitForSelector('.stamp-card:not(.awaiting)');assert((await page.$eval('.stamp-card:not(.awaiting)',e=>e.textContent)).includes('peaceful valley walk'));
 await clickText('Plan a trip');await page.waitForSelector('.planner-form');
 const expected=await page.$eval('.cost-summary h2',e=>e.textContent);assert.equal(expected,'₹10,800');
 await page.$eval('.planner-form input[type="number"]',e=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(e,'4');e.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.waitForFunction(()=>document.querySelector('.cost-summary h2').textContent==='₹14,400');
 await clickText('Save this trip');await page.waitForFunction(()=>document.querySelector('.toast')?.textContent.includes('Trip saved'));
 await page.goto('http://127.0.0.1:5173/map',{waitUntil:'networkidle2'});await page.waitForSelector('.leaflet-container',{timeout:20000});await page.waitForFunction(()=>document.querySelectorAll('.leaflet-interactive').length===30);await shot('map-desktop');
 await page.setViewport({width:390,height:844,deviceScaleFactor:1});
 for(const [route,name] of [['/','home-mobile'],['/passport','passport-mobile'],['/planner','planner-mobile']]){
   await page.goto('http://127.0.0.1:5173'+route,{waitUntil:'networkidle2'});await page.evaluate(()=>document.fonts.ready);await shot(name);
   const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,elements:Array.from(document.querySelectorAll('body *')).filter(e=>e.getBoundingClientRect().right>innerWidth+1&&getComputedStyle(e).position!=='absolute'&&getComputedStyle(e).position!=='fixed').slice(0,12).map(e=>[e.tagName,e.className,e.getBoundingClientRect().right])}));
   assert(overflow.scroll<=overflow.width,JSON.stringify({route,...overflow}));
 }
 await page.goto('http://127.0.0.1:5173/places/2',{waitUntil:'networkidle2'});await page.waitForSelector('dialog[open]');await page.$eval('dialog .weather-panel',e=>e.scrollIntoView());await page.waitForFunction(()=>document.querySelectorAll('.forecast>div').length===5,{timeout:20000});await shot('detail-mobile');
 const weather=await page.$eval('.weather-current',e=>e.textContent);console.log('Live weather:',weather);
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog'));
 assert.deepEqual(errors,[]);console.log('PASS: discovery search, save, visit, 400 XP, stamp persistence, trip budget updates, trip saving, 30 map markers, five-day live forecast, deep link, Escape dismissal, and mobile overflow checks.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
