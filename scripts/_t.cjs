const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.addInitScript(() => { const s = document.createElement('style'); s.textContent = '.intro,.splash,[class*=intro],[class*=splash]{display:none!important}'; document.addEventListener('DOMContentLoaded', () => document.head.append(s)); });
  await p.goto('http://localhost:4173/'); await p.waitForTimeout(1500);
  await p.getByText(/Teacher Access/i).first().click(); await p.waitForTimeout(800);
  for (const f of ['/home/claude/docx/sample.docx', '/tmp/pdfout/sample.pdf']) {
    await p.reload(); await p.waitForTimeout(1200);
    if (await p.getByText(/Teacher Access/i).count()) { await p.getByText(/Teacher Access/i).first().click(); await p.waitForTimeout(600); }
    await p.setInputFiles('input[type=file][accept*=".pdf"]', f);
    await p.waitForSelector('.notice.ok, .notice.bad', { timeout: 60000 });
    console.log(f, (await p.locator('.notice').first().innerText()).replace(/\n/g, ' | '));
    console.log('name=', await p.inputValue('#namebox-input'));
  }
  await p.screenshot({ path: '/tmp/imp.png' }); await b.close();
})();
