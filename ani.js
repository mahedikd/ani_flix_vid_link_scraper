/* eslint-disable no-console */
const fetch = require('node-fetch');
const argv = require('minimist')(process.argv.slice(2));
const puppeteer = require('puppeteer-core');
const { execSync: exec } = require('child_process');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

// sets options for browser
const userAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4422.0 Safari/537.36';
const browserPath = '/usr/bin/brave';
const { log } = console;
const url = argv.u;

async function getDownloadLink(id) {
  try {
    const data = `id=${id}&key=direct`;
    const response = await fetch('https://anidrive.in/post', {
      method: 'POST',
      headers: {
        accept: '*/*',
        'user-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4422.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: data,
    });
    const resData = await response.json();
    const link = await resData.redirect;
    log(chalk.green('Got download link'));
    return link;
  } catch (err) {
    log(chalk.red('form getDownloadLink: ${err.message}'));
  }
}

async function anidrive(url) {
  const browser = await puppeteer.launch({
    executablePath: browserPath,
    args: ['--disable-dev-shm-usage'],
    // headless: false,
  });
  const episodeIds = [];
  try {
    const [page] = await browser.pages();
    await page.setUserAgent(userAgent);

    page.goto(url);
    await page.waitForSelector('.entry-content');
    await page.waitForTimeout(1000);

    const pageLinks = await page.evaluate(() =>
      [...document.querySelectorAll('h3 > a')].map((link) => link.href),
    );

    for (let i = 0; i < pageLinks.length; i += 1) {
      const urll = pageLinks[i];
      try {
        page.goto(urll);
        await page.waitForSelector('#a', { timeout: 10000 });
        await page.waitForTimeout(2000);
        const episodeLink = await page.evaluate(() => document.querySelector('#a').value);
        const episodeId = episodeLink.split('/').filter(Boolean)[3];
        episodeIds.push(episodeId);
      } catch (error) {
        log(chalk.red(`from anidrive loop: ${error.message}`));
      }
      log(chalk.grey(`Got ${i + 1} id`));
    }
  } catch (error) {
    log(chalk.red(`from anidrive: ${error.message}`));
  } finally {
    await browser.close();
  }
  log(chalk.green('\nId collecting done\n'));
  return episodeIds;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(url) {
  const dir = path.resolve(__dirname, 'links');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  const episodeIds = await anidrive(url);
  const downloadLinks = [];
  for (let i = 0; i < episodeIds.length; i += 1) {
    const id = episodeIds[i];
    const downloadLink = await getDownloadLink(id);

    exec(`echo '${downloadLink}' >> ${dir}/${url.split('/').filter(Boolean)[3]}.txt`);
    downloadLinks.push(downloadLink);
  }
  log(downloadLinks);
}

main(url);
