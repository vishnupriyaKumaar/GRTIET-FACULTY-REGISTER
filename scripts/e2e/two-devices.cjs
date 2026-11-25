const { chromium, devices } = require('playwright');
const CSS = '.splash,[class*=intro]{display:none!important}';
(async () => {
  const b = await chromium.launch();
  const mk = async (opts = {}) => { const c = await b.newContext(opts); const p = await c.newPage(); p.on('pageerror', e => console.log('ERR', e.message)); await p.goto('http://localhost:4173/'); await p.addStyleTag({ content: CSS }); return p; };
  const cont = async (p) => { await p.waitForSelector('text=Select the Academic Year', { timeout: 15000 }); await p.click('.modal-actions button:has-text("Continue")'); };
  const pc = await mk();
  await pc.click('text=Admin Login'); await pc.fill('#login-pw', 'grtcse@1234'); await pc.click('button.login-btn');
  await pc.waitForSelector('text=Live', { timeout: 15000 }); await cont(pc);
  console.log('PC admin in');
  // teacher on phone
  const ph = await mk(devices['Pixel 7']);
  await ph.click('text=Teacher Access');
  await ph.waitForSelector('#namebox-input'); await cont(ph);
  await ph.setInputFiles('input[type=file]', '/home/claude/docx/sample.docx');
  await ph.waitForSelector('.notice.ok', { timeout: 30000 });
  await ph.click('button.btn-primary:has-text("Save")');
  await ph.waitForSelector('.toast.ok', { timeout: 20000 });
  console.log('phone saved:', await ph.innerText('.toast.ok'));
  // PC should see it within ~5s without reload
  await pc.click('role=tab[name=/Search/]');
  await pc.waitForSelector('text=Kamal', { timeout: 15000 });
  console.log('PC sees teacher live');
  // phone admin login with password change on PC
  await pc.click('text=Change Password');
  await pc.fill('.modal-card >> nth=0 >> input >> nth=0', 'grtcse@1234');
  const inputs = pc.locator('.pw-fields input'); await inputs.nth(0).fill('grtcse@1234'); await inputs.nth(1).fill('newpass99'); await inputs.nth(2).fill('newpass99');
  await pc.click('button:has-text("Change Password") >> nth=-1');
  await pc.waitForSelector('text=Password changed', { timeout: 10000 });
  const ph2 = await mk(devices['iPhone 13']);
  await ph2.click('text=Admin Login'); await ph2.fill('#login-pw', 'grtcse@1234'); await ph2.click('button.login-btn');
  await ph2.waitForSelector('text=Incorrect', { timeout: 10000 }); console.log('old password rejected on phone');
  await ph2.fill('#login-pw', 'newpass99'); await ph2.click('button.login-btn');
  await ph2.waitForSelector('text=Live', { timeout: 15000 }); await cont(ph2);
  await ph2.click('role=tab[name=/Search/]'); await ph2.waitForSelector('text=Kamal', { timeout: 15000 });
  console.log('phone admin sees teacher with new password');
  await ph2.screenshot({ path: '/tmp/phone.png' });
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
