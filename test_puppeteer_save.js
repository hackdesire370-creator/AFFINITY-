import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  await page.goto('http://localhost:5173/#vault-birthday');
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Enter passkey
  await page.type('#birthdayPasskey', 'MYPASSKEY123');
  await page.click('#openVaultBtn');
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Click affinity builder card
  await page.click('#affinityBuilderCard');
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Click save vault
  await page.click('#saveVaultFinalBtn');
  
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
