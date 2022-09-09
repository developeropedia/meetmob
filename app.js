const puppeteer = require('puppeteer-extra');
const Captcha = require("2captcha")
const https = require('https');
const fs = require("fs");

// Sleep Function
function sleep(milliseconds) {
    const time = Date.now();
    let currentTime = null;
    do {
        currentTime = Date.now();
    } while (currentTime - time < milliseconds);
}

(async () => {

    var url = "";

    const browser = await puppeteer.launch({headless:false});
    while (url !== "https://meetmob.mobilis.dz/ecare/mybill/init") {

        // Open SearchMobileConnected.php and wait for response
        const searchMobileConnected = await browser.newPage();
        await searchMobileConnected.goto('https://redpaal.com/accueil/SearchMobilConnected.php?id=27102022', { waitUntil: 'networkidle0', timeout: 0 });

        await searchMobileConnected.waitForSelector('body')
        let mobileConnected = await searchMobileConnected.evaluate(() => {
            return document.body.innerText;
        })

        // Run while not get serialNumber*phone
        while(mobileConnected == '2002002') {
            await searchMobileConnected.reload({ waitUntil: 'networkidle0' , timeout: 0});
            await searchMobileConnected.waitForSelector('body')

            mobileConnected = await searchMobileConnected.evaluate(() => {
                return document.body.innerText;
            })
        }

        let serialNum = mobileConnected.split("*")[0];
        mobileConnected = mobileConnected.split("*")[1];
        console.log("Serial Num : " + serialNum);
        console.log("Mobile Num : " + mobileConnected);

        await searchMobileConnected.close();

        // Login to meetmob
        const login = await browser.newPage();
        await login.goto('https://meetmob.mobilis.dz/ecare/subscriber/loginInit', { waitUntil: 'networkidle0', timeout: 0 });
        await login.type('#msisdn', mobileConnected);
        await login.type('#password', '0000');
        await login.click('#logintToSendSms');

        sleep(3000);

        // Get code sent to showCode
        const showCode = await browser.newPage();
        await showCode.goto('https://redpaal.com/accueil/ShowCode.php?num='+mobileConnected, { waitUntil: 'networkidle0', timeout: 0 });
        let code = '';
        await showCode.waitForSelector('body')
        code = await showCode.evaluate(() => {
            return document.body.innerText;
        })

        var time = Date.now();
        var currentTime = time;

        // Run while not get code or time is under 2 min
        while(code.length !== 4 && currentTime - time < 120000) {
            sleep(3000);
            currentTime = Date.now();

            await showCode.reload({ waitUntil: 'networkidle0' , timeout: 0});
            await showCode.waitForSelector('body')
            code = await showCode.evaluate(() => {
                return document.body.innerText;
            })
        }

        // If code received
        if(code.length === 4) {
            // Login with the code
            await login.type('#checkNum', code);
            await login.click('#loginSubmit');

            await login.waitForNavigation();

            console.log('Code:', code);
            console.log('URL:', login.url());

            url = login.url();

            // Navigate to recharge page
            const recharge = await browser.newPage();
            await recharge.goto('https://meetmob.mobilis.dz/ecare/recharge/init', { waitUntil: 'networkidle0', timeout: 0 });

            await recharge.waitForSelector('#checkNumId');

            // Get and Resolve Captcha
            var imgName = 'captchas/captcha' + Date.now() + '.jpg';
            const element = await recharge.$('#checkNumId');
            await element.screenshot({path: imgName});

            const solver = new Captcha.Solver("71ba07d639c11c42a041579314311885")

            //  Read from a file as base64 text
            solver.imageCaptcha(fs.readFileSync(imgName, "base64"))
                .then(async (res) => {
                    // Logs the image text
                    console.log(res)

                    // Open AskMeetMob.php and wait for Response
                    const askMeetMob = await browser.newPage();
                    await askMeetMob.goto('https://redpaal.com/accueil/AskMeetmob.php?id=27102022', { waitUntil: 'networkidle0', timeout: 0 });

                    await askMeetMob.waitForSelector('body')
                    let customer = await askMeetMob.evaluate(() => {
                        return document.body.innerText;
                    })

                    // Run while not found serialNum*card
                    while(customer == 8008008) {
                        await askMeetMob.reload({ waitUntil: 'networkidle0' , timeout: 0});
                        await askMeetMob.waitForSelector('body')

                        customer = await askMeetMob.evaluate(() => {
                            return document.body.innerText;
                        })
                    }

                    let customerCardSN = customer.split("*")[0];
                    let customerPhone = customer.split("*")[1];

                    // Perform recharge with the received data
                    await recharge.type('#serialNumber', customerCardSN);
                    await recharge.type('#msisdn', customerPhone);
                    await recharge.type('#checkNum', res.data);
                    const input = await recharge.$('#msisdn');
                    await input.click({ clickCount: 3 })
                    await input.type(customerPhone);
                    await recharge.click('#sbmtButton');

                    let meetMobReport = '';

                    // Get Report Messages
                    // If report is successful
                    let successAlert = await recharge.waitForSelector('div.NewSuccess', {timeout: 3000});
                    if(successAlert != null) {
                        let element = await recharge.$('div.NewSuccess')
                        meetMobReport = await recharge.evaluate(el => el.innerText, element)
                    }

                    // If report is error
                    let errorAlert = await recharge.waitForSelector('#warning > div', {timeout: 3000});
                    if(errorAlert != null) {
                        let element = await recharge.$('#warning > div')
                        meetMobReport = await recharge.evaluate(el => el.innerText, element)
                    }

                    console.log(meetMobReport);

                    // Open MeetMobResult.php and send report
                    const meetMobResult = await browser.newPage();
                    await meetMobResult.goto(
                        'https://redpaal.com/accueil/MeetmobResult.php?id=27102022*'+customerPhone+"*"+meetMobReport,
                        { waitUntil: 'networkidle0', timeout: 0 }
                    );
                })
                .catch((err) => {
                    console.error(err.message)
                })
        }else { // If code not received
            await login.close();
            await showCode.close();
        }
    }


    // await browser.close();
})();