// Real UI and APIs against an isolated synthetic database. Never uses installed data.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const repo=path.resolve(__dirname,'..'),out=fs.mkdtempSync(path.join(repo,'diagnostics','principaled-usability-'));
process.env.NODE_ENV='test';process.env.PORT='0';process.env.DB_PATH=path.join(out,'synthetic.sqlite');process.env.JWT_SECRET='usability-isolated-browser-test-secret-32-chars';process.env.REFRESH_TOKEN_SECRET='usability-isolated-refresh-test-secret-32-chars';process.env.TIMSYS_LAUNCHER_DIST=path.join(repo,'apps/launcher/dist');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(require('os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const platform=require('../platform');let server,browser;
(async()=>{
 server=await platform.bootPlatform();const origin=`http://127.0.0.1:${server.address().port}`;
 const {token}=await fetch(origin+'/api/auth/dev-login',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest'},body:'{}'}).then(r=>r.json());
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(token=>localStorage.setItem('jwt_token',token),token);
 await page.goto(origin+'/app/principal-ed');await page.locator('.school-home h1').waitFor({timeout:30000});
 const content=page.locator('#school-content'),nav=page.getByRole('navigation',{name:'Application',exact:true});
 assert.equal(await content.getByText('System',{exact:true}).count(),0);
 await page.screenshot({path:path.join(out,'home.png'),fullPage:true});
 async function go(name){await page.getByRole('searchbox',{name:'Find a page'}).fill(name);await nav.getByRole('button',{name,exact:true}).click();await page.waitForTimeout(200);}
 await go('Documents');await content.getByRole('heading',{name:'Documents',exact:true}).waitFor();
 assert.equal(await content.getByPlaceholder('Document title').isVisible(),false);await content.getByRole('button',{name:'Add document',exact:true}).click();
 await content.getByLabel('Document title',{exact:true}).fill('Synthetic document');
 await content.getByRole('button',{name:'Hide form',exact:true}).click();await content.getByRole('button',{name:'Add document',exact:true}).click();assert.equal(await content.getByLabel('Document title',{exact:true}).inputValue(),'Synthetic document');
 // Leaving a draft uses the same application guard, including sidebar search navigation.
 await go('Staff');await page.getByRole('alertdialog').waitFor();await page.getByRole('alertdialog').getByRole('button',{name:'Cancel',exact:true}).click();
 await content.getByRole('heading',{name:'Documents',exact:true}).waitFor();
 // One controlled HTTP failure verifies that save errors cannot dismiss a draft.
 await page.route('**/documents',async route=>route.request().method()==='POST'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'Synthetic save failure'}})}):route.continue());
 await content.locator('form').first().getByRole('button',{name:'Add document',exact:true}).click();await content.getByText('Synthetic save failure',{exact:true}).waitFor();assert.equal(await content.getByLabel('Document title',{exact:true}).inputValue(),'Synthetic document');
 await page.unroute('**/documents');await content.locator('form').first().getByRole('button',{name:'Add document',exact:true}).click();checks.push('controlled save failure retains form and typed data');
 await content.getByText('Document created',{exact:true}).waitFor();assert.equal(await content.getByLabel('Document title',{exact:true}).isVisible(),false);
 const row=content.getByRole('row').filter({hasText:'Synthetic document'});await row.getByRole('button',{name:'Edit',exact:true}).click();
 assert.equal(await content.getByLabel('Document title',{exact:true}).inputValue(),'Synthetic document');await content.getByLabel('Document title',{exact:true}).fill('Synthetic updated document');await content.getByRole('button',{name:'Save changes',exact:true}).click();await content.getByText('Document updated',{exact:true}).waitFor();
 await page.screenshot({path:path.join(out,'document-edit.png'),fullPage:true});await page.reload();await content.getByRole('row').filter({hasText:'Synthetic updated document'}).waitFor();checks.push('document create/edit persists; collapsed drafts retained; unsaved navigation cancelled');
 const pages=[['Standalone tasks','Add task'],['Approvals','Request approval'],['Calendar','Add calendar entry'],['Communications','Write message'],['Ownership','Assign responsibility'],['Catering','Add catering plan'],['Finance','Add budget'],['Events','Add event'],['Transportation','Plan journey'],['Venue Bookings','Add venue booking'],['Resource Reservations','Reserve resource'],['Risk Assessments','Add risk assessment'],['Safeguarding','Add safeguarding requirement'],['Contingency','Add contingency plan']];
 for(const [name,action] of pages){await go(name);const button=content.getByRole('button',{name:action,exact:true});await button.waitFor();assert.equal(await button.getAttribute('aria-expanded'),'false');await button.click();assert.equal(await content.locator('.school-record-form>button[aria-expanded="true"]').count(),1);await content.getByRole('button',{name:'Hide form',exact:true}).click();checks.push(name+' on-demand form');}
 for(const name of ['Students','Staff','Rooms','Inventory']){await go(name);await content.locator('h1').first().waitFor();assert.ok(await content.locator('input').count()>0);checks.push(name+' navigation and controls');}
 for(const [name,heading] of [['Responsibilities','Nervous Breakdown'],['Gradebook','Gradebook'],['Scheduler','Scheduler']]){await go(name);await content.getByRole('heading',{name:heading,exact:true}).waitFor();checks.push(name+' specialist view in shared shell');}
 const discovery=await fetch(origin+'/modules/list-for-app?appId=principal-ed',{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json());
 const assessment=discovery.data.find(m=>m.name==='assessment_evaluator');
 if(assessment?.enabled){await go('Assessment Evaluator');await content.getByRole('heading',{name:'Assessment Evaluator',exact:true}).waitFor();checks.push('Assessment Evaluator specialist view');}
 else {await page.getByRole('searchbox',{name:'Find a page'}).fill('Assessment Evaluator');assert.equal(await nav.getByRole('button',{name:'Assessment Evaluator',exact:true}).count(),0);checks.push('disabled Assessment Evaluator excluded from navigation');}
 await go('Documents');await page.setViewportSize({width:390,height:844});assert.equal(await page.getByRole('searchbox',{name:'Find a page'}).isVisible(),false);await page.getByRole('button',{name:'Menu',exact:true}).click();await go('Projects & tasks');await content.getByRole('heading',{name:'Projects & tasks',exact:true}).waitFor();assert.equal(await page.getByRole('searchbox',{name:'Find a page'}).isVisible(),false);
 await page.keyboard.press('Control+k');await page.getByRole('searchbox',{name:'Find a page'}).waitFor({state:'visible'});assert.equal(await page.getByRole('searchbox',{name:'Find a page'}).evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});checks.push('mobile navigation, keyboard search and no horizontal page overflow');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,syntheticOnly:true,checks,browserErrors:errors,productionDatabaseTouched:false},null,2));console.log('PRINCIPALED_USABILITY_PASS '+out);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)await platform.shutdownPlatform(server);});


