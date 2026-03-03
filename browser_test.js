const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Collect console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
  });

  // Collect JavaScript errors
  const jsErrors = [];
  page.on('pageerror', error => {
    jsErrors.push({
      message: error.message,
      stack: error.stack
    });
  });

  // Collect network errors
  const networkErrors = [];
  page.on('requestfailed', request => {
    networkErrors.push({
      url: request.url(),
      errorText: request.failure().errorText
    });
  });

  console.log('Navigating to http://localhost:8765/index.html...');
  
  try {
    // Navigate with extended timeout
    await page.goto('http://localhost:8765/index.html', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    console.log('Page loaded. Taking initial screenshot...');
    await page.screenshot({ path: 'screenshot_initial.png', fullPage: false });
    console.log('Initial screenshot saved as screenshot_initial.png');

    // Check if loading screen is visible
    const loadingVisible = await page.evaluate(() => {
      const loadingEl = document.getElementById('loading');
      if (!loadingEl) return false;
      const style = window.getComputedStyle(loadingEl);
      return style.opacity !== '0' && style.display !== 'none';
    });

    console.log(`Loading screen visible: ${loadingVisible}`);

    if (loadingVisible) {
      console.log('Loading screen detected. Waiting 30 more seconds...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      console.log('Taking second screenshot after 30s wait...');
      await page.screenshot({ path: 'screenshot_after_wait.png', fullPage: false });
      console.log('Second screenshot saved as screenshot_after_wait.png');
    } else {
      console.log('No loading screen detected, page appears to be loaded.');
    }

    // Get page state information
    const pageState = await page.evaluate(() => {
      return {
        title: document.title,
        loadingScreenClass: document.getElementById('loading')?.className || 'not found',
        startScreenClass: document.getElementById('startScreen')?.className || 'not found',
        gameState: window.gState || 'unknown',
        texturesLoaded: window.loadedTex || 0,
        totalTextures: window.totalTex || 0
      };
    });

    console.log('\n=== PAGE STATE ===');
    console.log(JSON.stringify(pageState, null, 2));

    // Report console messages
    console.log('\n=== CONSOLE MESSAGES ===');
    if (consoleMessages.length === 0) {
      console.log('No console messages');
    } else {
      consoleMessages.forEach((msg, i) => {
        console.log(`[${i + 1}] [${msg.type.toUpperCase()}] ${msg.text}`);
        if (msg.location && msg.location.url) {
          console.log(`    at ${msg.location.url}:${msg.location.lineNumber}`);
        }
      });
    }

    // Report JavaScript errors
    console.log('\n=== JAVASCRIPT ERRORS ===');
    if (jsErrors.length === 0) {
      console.log('No JavaScript errors detected ✓');
    } else {
      jsErrors.forEach((error, i) => {
        console.log(`[${i + 1}] ${error.message}`);
        if (error.stack) {
          console.log(error.stack);
        }
      });
    }

    // Report network errors
    console.log('\n=== NETWORK ERRORS ===');
    if (networkErrors.length === 0) {
      console.log('No network errors detected ✓');
    } else {
      networkErrors.forEach((error, i) => {
        console.log(`[${i + 1}] Failed to load: ${error.url}`);
        console.log(`    Error: ${error.errorText}`);
      });
    }

  } catch (error) {
    console.error('Error during page load:', error.message);
    await page.screenshot({ path: 'screenshot_error.png', fullPage: false });
    console.log('Error screenshot saved as screenshot_error.png');
  } finally {
    await browser.close();
    console.log('\nBrowser closed.');
  }
})();
