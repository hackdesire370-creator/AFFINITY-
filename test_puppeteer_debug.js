import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => {
      console.log('PAGE ERROR:', error.message);
      console.log('STACK:', error.stack);
  });
  
  await page.goto('http://localhost:5173/#vault-birthday');
  await new Promise(r => setTimeout(r, 500));
  
  // Enter passkey
  await page.type('#birthdayPasskey', 'MYPASSKEY2');
  await page.click('#openVaultBtn');
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Click affinity builder card
  await page.click('#affinityBuilderCard');
  await new Promise(r => setTimeout(r, 1000));
  
  // Enter some name
  // await page.type('#vaultNameInput', 'Test Name');
  
  // Intercept network
  page.on('requestfailed', request => {
    console.log('REQUEST FAILED:', request.url(), request.failure().errorText);
  });
  page.on('response', response => {
    console.log('RESPONSE:', response.url(), response.status());
  });

  // Click save vault
  console.log('Clicking save...');
  await page.click('#saveVaultFinalBtn');
  
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
