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

// Download Image from URL
const download = (url, destination) => new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);

    https.get(url, response => {
        response.pipe(file);

        file.on('finish', () => {
            file.close(resolve(true));
        });
    }).on('error', error => {
        fs.unlink(destination);

        reject(error.message);
    });
});

(async () => {

    var url = "";

    const browser = await puppeteer.launch({headless:false});
    while (url !== "https://meetmob.mobilis.dz/ecare/mybill/init") {
        const searchMobileConnected = await browser.newPage();
        await searchMobileConnected.goto('https://redpaal.com/accueil/SearchMobilConnected.php?id=123456', { waitUntil: 'networkidle0', timeout: 0 });

        await searchMobileConnected.waitForSelector('body')
        let mobileConnected = await searchMobileConnected.evaluate(() => {
            return document.body.innerText;
        })

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

        const login = await browser.newPage();
        await login.goto('https://meetmob.mobilis.dz/ecare/subscriber/loginInit', { waitUntil: 'networkidle0', timeout: 0 });
        await login.type('#msisdn', mobileConnected);
        await login.type('#password', '0000');
        await login.click('#logintToSendSms');

        sleep(5000);

        const showCode = await browser.newPage();
        await showCode.goto('https://redpaal.com/accueil/ShowCode.php?num='+mobileConnected, { waitUntil: 'networkidle0', timeout: 0 });
        let code = '';
        await showCode.waitForSelector('body')
        code = await showCode.evaluate(() => {
            return document.body.innerText;
        })

        var time = Date.now();
        var currentTime = time;
        while(code.length !== 4 && currentTime - time < 120000) {
            sleep(3000);
            currentTime = Date.now();

            await showCode.reload({ waitUntil: 'networkidle0' , timeout: 0});
            await showCode.waitForSelector('body')
            code = await showCode.evaluate(() => {
                return document.body.innerText;
            })
        }

        if(code.length === 4) {
            await login.type('#checkNum', code);
            await login.click('#loginSubmit');

            await login.waitForNavigation();

            console.log('Code:', code);
            console.log('URL:', login.url());

            url = login.url();

            const recharge = await browser.newPage();
            await recharge.goto('https://meetmob.mobilis.dz/ecare/recharge/init', { waitUntil: 'networkidle0', timeout: 0 });

            await recharge.waitForSelector('#checkNumId');

            var imgName = 'captcha' + Date.now() + '.jpg';
            const element = await recharge.$('#checkNumId');
            await element.screenshot({path: imgName});

            // const imgs = await recharge.$$eval('img#checkNumId[src]', imgs => imgs.map(img => img.getAttribute('src')));
            // console.log(imgs);
            // var imgName = 'captcha' + Date.now() + '.jpg';
            // var result = await download('https://meetmob.mobilis.dz' + imgs[0], imgName);

            const solver = new Captcha.Solver("71ba07d639c11c42a041579314311885")

            //  Read from a file as base64 text
            solver.imageCaptcha(fs.readFileSync(imgName, "base64"))
                .then(async (res) => {
                    // Logs the image text
                    console.log(res)

                    const askMeetMob = await browser.newPage();
                    await askMeetMob.goto('https://redpaal.com/accueil/AskMeetmob.php?id=123456', { waitUntil: 'networkidle0', timeout: 0 });

                    await askMeetMob.waitForSelector('body')
                    let customer = await askMeetMob.evaluate(() => {
                        return document.body.innerText;
                    })

                    while(customer == 8008008) {
                        await askMeetMob.reload({ waitUntil: 'networkidle0' , timeout: 0});
                        await askMeetMob.waitForSelector('body')

                        customer = await askMeetMob.evaluate(() => {
                            return document.body.innerText;
                        })
                    }

                    let customerCardSN = customer.split("*")[0];
                    let customerPhone = customer.split("*")[1];

                    await recharge.type('#serialNumber', customerCardSN);
                    await recharge.type('#msisdn', customerPhone);
                    await recharge.type('#checkNum', res.data);
                    const input = await recharge.$('#msisdn');
                    await input.click({ clickCount: 3 })
                    await input.type(customerPhone);
                    await recharge.click('#sbmtButton');

                    const meetMobResult = await browser.newPage();
                    await meetMobResult.goto(
                        'https://redpaal.com/accueil/MeetmobResult?id=123456*'+customerPhone+"*success",
                        { waitUntil: 'networkidle0', timeout: 0 }
                    );
                })
                .catch((err) => {
                    console.error(err.message)
                })
        }else {
            await login.close();
            await showCode.close();
        }
    }


    // await browser.close();
})();