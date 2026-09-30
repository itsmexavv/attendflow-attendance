/* End-to-end tests use a fresh temporary SQLite data directory. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawn } = require('node:child_process');
const temp = fs.mkdtempSync(path.join(os.tmpdir(),'portfolio-browser-'));
const artifacts = path.join(__dirname,'artifacts');
fs.mkdirSync(artifacts,{recursive:true});
const server = spawn(process.env.PYTHON || 'python',['run.py','--port','8765','--data-dir',temp],{cwd:__dirname,stdio:['ignore','ignore','inherit']});
const base = 'http://127.0.0.1:8765';
(async () => {
  let ready=false;
  for(let i=0;i<100;i++) { try { ready=(await fetch(base+'/api/health')).ok; if(ready) break; } catch {} await new Promise(resolve=>setTimeout(resolve,100)); }
  if(!ready) throw new Error('Python server did not become ready.');
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{ if(message.type()==='error' && !message.text().includes('422 (Unprocessable Entity)')) errors.push(message.text()); });
  async function shot() { await page.screenshot({path:path.join(artifacts,'screenshot.png'),fullPage:true}); }
  try {
    await page.goto(base);
    await page.waitForLoadState('networkidle');
    await shot();
    await page.locator('#records button').first().click();
    await page.getByRole('button',{name:'Check out',exact:true}).waitFor();
    await page.getByRole('button',{name:'Check out',exact:true}).click();
    await page.getByText('Completed',{exact:true}).last().waitFor();
    const student=page.locator('#student-form');
    await student.locator('[name="student_no"]').fill('BROWSER-001');
    await student.locator('[name="name"]').fill('Browser Demo Student');
    await student.locator('button').click();
    await page.getByText('Browser Demo Student',{exact:true}).waitFor();
    const event=page.locator('#event-form');
    await event.locator('[name="name"]').fill('Browser Demo Event');
    await event.locator('button').click();
    await page.waitForFunction(()=>document.querySelector('#event-select').selectedOptions[0].textContent.includes('Browser Demo Event'));
    await page.waitForFunction(()=>{const tags=[...document.querySelectorAll('#records .tag')]; return tags.length===4 && tags.every(tag=>tag.textContent==='Absent');});
    const downloadPromise=page.waitForEvent('download');
    await page.locator('#export').click();
    const download=await downloadPromise;
    await download.saveAs(path.join(artifacts,'attendance.csv'));
    assert.ok(fs.readFileSync(path.join(artifacts,'attendance.csv'),'utf8').includes('Browser Demo Student'));

    await page.getByRole('link',{name:'Demo guide',exact:false}).click();
    await page.getByRole('heading',{name:'Five-minute walkthrough',exact:true}).waitFor();
    await page.setViewportSize({width:390,height:844});
    for(const route of ['/','/guide.html']) {
      await page.goto(base+route);
      await page.waitForLoadState('networkidle');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page overflows on mobile: '+route);
    }
    await page.goto(base);
    await page.waitForLoadState('networkidle');
    await page.screenshot({path:path.join(artifacts,'mobile.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS: standalone workflow, guide, responsive layouts, and no unexpected browser errors.');
  } finally { await browser.close(); }
})().catch(error=>{ console.error(error); process.exitCode=1; }).finally(()=>{server.kill();fs.rmSync(temp,{recursive:true,force:true});});
