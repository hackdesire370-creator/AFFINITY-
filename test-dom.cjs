const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require('fs');

const html = fs.readFileSync('/Users/hkmac/Downloads/affinity/index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true });

dom.window.addEventListener('error', event => {
  console.error("DOM Error:", event.error.message);
});

setTimeout(() => {
  console.log("heroEnterVaultBtn exists:", !!dom.window.document.getElementById('heroEnterVaultBtn'));
  console.log("enterVaultModal exists:", !!dom.window.document.getElementById('enterVaultModal'));
  process.exit(0);
}, 1000);
