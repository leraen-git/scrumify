const puppeteer = require('puppeteer-core');
const path = require('path');

async function generatePDF(htmlFile, pdfFile) {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  const page = await browser.newPage();
  const fileUrl = 'file://' + path.resolve(htmlFile);
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });

  await page.pdf({
    path: pdfFile,
    format: 'A4',
    printBackground: true,
    margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
  });

  await browser.close();
  console.log('Generated:', pdfFile);
}

(async () => {
  await generatePDF('tasks/docs/admin-manual.html', 'tasks/docs/admin-manual.pdf');
  await generatePDF('tasks/docs/user-manual.html', 'tasks/docs/user-manual.pdf');
})();
