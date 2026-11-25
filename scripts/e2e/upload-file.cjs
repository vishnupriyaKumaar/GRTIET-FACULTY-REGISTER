const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); 
  for (const f of ['/home/claude/docx/sample.docx','/tmp/pdfout/sample.pdf']) {
    const p = await b.newPage();
    p.on('pageerror', e => console.log('ERR', e.message));
    await p.goto('http://localhost:4173/');
    await p.addStyleTag({ content: '.splash,[class*=intro]{display:none!important}' });
    await p.click('text=Teacher Access'); await p.waitForSelector('text=Select the Academic Year'); await p.click('.modal-actions button:has-text("Continue")');
    await p.waitForSelector('text=Upload File', { timeout: 15000 });
    await p.setInputFiles('input[type=file]', f);
    await p.waitForSelector('.notice.ok, .notice.bad', { timeout: 60000 });
    console.log(f, await p.innerText('.notice.ok, .notice.bad'));
    console.log('name=', await p.inputValue('#namebox-input'));
    await p.screenshot({ path: '/tmp/up-'+f.split('.').pop()+'.png' });
    await p.close();
  }
  await b.close();
})();
