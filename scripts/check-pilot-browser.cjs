/** Optional browser acceptance against the isolated M10 preview only. */
const {chromium}=require(process.env.PILOT_PLAYWRIGHT_PATH || "playwright");
const {randomUUID}=require("node:crypto");
const assert=require("node:assert/strict");
const origin="http://127.0.0.1:3140";
async function check(){
  const browser=await chromium.launch({executablePath:process.env.PILOT_CHROMIUM_PATH,headless:true});
  try{
    console.log("Chromium started for the isolated pilot.");
    const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:"reduce"});
    page.setDefaultTimeout(180000);
    page.setDefaultNavigationTimeout(300000);
    const errors=[];
    page.on("pageerror",err=>errors.push(err.message.slice(0,120)));
    await page.goto(origin+"/help",{waitUntil:"domcontentloaded"});
    await page.getByRole("heading",{name:"Privacy and help"}).waitFor();
    console.log("Public help rendered.");
    await page.goto(origin+"/signup",{waitUntil:"domcontentloaded"});
    await page.locator("[name=name]").fill("Pilot fixture");
    await page.locator("[name=email]").fill("pilot-"+randomUUID()+"@example.invalid");
    await page.locator("[name=password]").fill(randomUUID());
    await page.getByRole("button",{name:"Create account",exact:true}).click();
    await page.waitForURL("**/setup",{timeout:300000});
    await page.getByRole("heading",{name:"Setup progress · 0 of 6"}).waitFor();
    console.log("New household reached empty setup.");
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.getByLabel("Household time zone").fill("America/Toronto");
    await page.getByLabel("Display currency").selectOption("CAD");
    await page.getByLabel("Skip recurring bills for now").check();
    await page.getByLabel("Set up without a partner").check();
    const save=page.getByRole("button",{name:"Save household preferences"});
    assert.ok((await save.boundingBox()).height>=44);
    await save.focus(); await page.keyboard.press("Enter");
    await page.getByRole("heading",{name:"Setup progress · 3 of 6"}).waitFor();
    await page.reload();
    assert.equal(await page.getByLabel("Household time zone").inputValue(),"America/Toronto");
    await page.getByRole("link",{name:"Report a setup problem"}).click();
    await page.getByLabel("Steps and expected result").fill("Synthetic pilot keyboard check");
    await page.getByRole("button",{name:"Send feedback"}).click();
    await page.getByRole("status").filter({hasText:"Report received"}).waitFor();
    await page.goto(origin+"/exports");
    await page.getByRole("heading",{name:"0 transactions in this part"}).waitFor();
    await page.setViewportSize({width:1440,height:900});
    await page.goto(origin+"/setup");
    assert.match(await page.locator("main").ariaSnapshot(),/heading "Household preferences"/);
    assert.deepEqual(errors,[]);
    console.log("Mobile and desktop Chromium: help, blank signup, labelled controls, keyboard submit, saved progress, private feedback receipt, empty activity export. No page errors.");
  }finally{await browser.close();}
}
check().catch(e=>{console.error(e.message);process.exitCode=1;});
