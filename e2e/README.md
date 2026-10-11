# Browser test (web emulator)

Runs the real mobile app, compiled for the web, in headless Chromium against the real
API code. Only the outside world is faked: MongoDB and Supabase Storage are in memory,
and the Supabase login is replaced by an injected session.

    cd e2e
    npm install
    npx playwright install chromium     # once; or set CHROME_PATH to an existing Chrome
    npm run build-web                   # after any app change (writes e2e/dist, not your .env.local)
    npm test

For each of the five forms it: picks the form in the dropdown, ticks every checklist
item, fills every sign-off field (including both signatures), confirms a blank freight
bill is blocked by the app, submits, then checks the stored record and the text of the
stored PDF. It ends by checking the history screen. Screenshots go to `e2e/screenshots`.

Limits: this is react-native-web, not a phone. Native-only code (file system, mail
composer, secure store, share sheet) is not exercised, and `Alert.alert` shows nothing
on web, so the test asserts on network calls instead of pop-ups.
