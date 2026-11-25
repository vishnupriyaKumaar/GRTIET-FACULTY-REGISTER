const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ acceptDownloads: true }); const p = await ctx.newPage();
  p.on('pageerror', e => console.log('ERR', e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:4173/'); await p.addStyleTag({ content: '.splash,[class*=intro]{display:none!important}' });
  await p.click('text=Admin Login'); await p.fill('#login-pw', 'newpass99').catch(()=>{}); 
  await p.click('button.login-btn');
  let ok = await p.waitForSelector('text=Live', { timeout: 6000 }).catch(() => null);
  if (!ok) { await p.fill('#login-pw', 'grtcse@1234'); await p.click('button.login-btn'); await p.waitForSelector('text=Live'); }
  await p.waitForSelector('text=Select the Academic Year'); await p.click('.modal-actions button:has-text("Continue")');
  // add teacher with certificate
  await p.fill('#namebox-input', 'Ms. Test. T.');
  await p.click('text=Add another NPTEL course');
  await p.locator('#nptel input[type=file]').first().setInputFiles('/tmp/cert3.6mb.pdf');
  await p.waitForTimeout(500);
  await p.click('button.btn-primary:has-text("Save")'); await p.waitForSelector('.toast.ok', { timeout: 40000 });
  console.log('saved with 3.6MB certificate:', await p.innerText('.toast.ok'));
  await p.click('role=tab[name=/Update/]'); await p.waitForSelector('text=Test. T.');
  // edit while polling (wait > 5s) must keep typed text
  await p.click('text=Ms. Test. T.');
  const des = p.locator('input[placeholder*="Assistant"], input').filter({ hasText: '' }).first();
  await p.waitForTimeout(100);
  const label = p.locator('label:has-text("Designation") input').first(); await label.fill('Typed By Me');
  await p.waitForTimeout(12000);
  console.log('after 2 polls designation =', await label.inputValue());
  // relieve
  await p.locator('button:has-text("Relieve (left")').click(); await p.waitForSelector('.modal-card');
  await p.click('.modal-actions button.btn-danger'); await p.waitForTimeout(1500);
  await p.click('role=tab[name=/Relieved/]'); await p.waitForSelector('text=Test. T.');
  console.log('relieved listed');
  // backup download
  await p.click('button[aria-label="Settings and guide"]'); await p.click('summary:has-text("Data")');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('text=Download backup (all')]);
  await dl.saveAs('/tmp/backup.json'); const j = JSON.parse(fs.readFileSync('/tmp/backup.json','utf8'));
  console.log('backup staff', j.staff.length, 'records', j.records.length, 'files', j.files.length, 'file bytes', j.files[0] && j.files[0].data.length);
  await b.close();
})().catch(e => { console.error('FAIL', e.message.split('\n')[0]); process.exit(1); });
