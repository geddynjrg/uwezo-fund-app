const fs = require('fs');

function addAfter(file, needle, insert) {
  let t = fs.readFileSync(file, 'utf8');
  if (t.includes('APP_PUSH_NOTIFY_URL')) {
    console.log('skip admin', file);
    return;
  }
  if (!t.includes(needle)) throw new Error('needle miss ' + file);
  t = t.replace(needle, needle + '\n' + insert);
  fs.writeFileSync(file, t);
  console.log('patched', file);
}

addAfter(
  '/las/docker-compose.yml',
  '      SMTP_PASSWORD: ${SMTP_PASSWORD:-${PROD_SMTP_PASSWORD}}',
  '      APP_PUSH_NOTIFY_URL: ${APP_PUSH_NOTIFY_URL:-http://web:3000/api/auth/app/notify}\n      APP_PUSH_WEBHOOK_SECRET: ${APP_PUSH_WEBHOOK_SECRET:-${EXTERNAL_API_KEY}}',
);
addAfter(
  '/loans/docker-compose.yml',
  '      SMTP_PASSWORD: ${PROD_SMTP_PASSWORD}',
  '      APP_PUSH_NOTIFY_URL: ${APP_PUSH_NOTIFY_URL:-http://prod-web:3000/api/auth/app/notify}\n      APP_PUSH_WEBHOOK_SECRET: ${APP_PUSH_WEBHOOK_SECRET:-${EXTERNAL_API_KEY}}',
);

let tw = fs.readFileSync('/las/docker-compose.yml', 'utf8');
if (!tw.includes('APP_PUSH_WEBHOOK_SECRET=${APP_PUSH_WEBHOOK_SECRET')) {
  tw = tw.replace(
    '      - EXTERNAL_API_KEY=${EXTERNAL_API_KEY:-}',
    '      - EXTERNAL_API_KEY=${EXTERNAL_API_KEY:-}\n      - APP_PUSH_WEBHOOK_SECRET=${APP_PUSH_WEBHOOK_SECRET:-${EXTERNAL_API_KEY}}',
  );
  fs.writeFileSync('/las/docker-compose.yml', tw);
  console.log('staging web env secret');
}

let pw = fs.readFileSync('/loans/docker-compose.yml', 'utf8');
if (!pw.includes('APP_PUSH_WEBHOOK_SECRET:')) {
  pw = pw.replace(
    '      EXTERNAL_API_KEY: ${EXTERNAL_API_KEY}',
    '      EXTERNAL_API_KEY: ${EXTERNAL_API_KEY}\n      APP_PUSH_WEBHOOK_SECRET: ${APP_PUSH_WEBHOOK_SECRET:-${EXTERNAL_API_KEY}}',
  );
  fs.writeFileSync('/loans/docker-compose.yml', pw);
  console.log('prod web env secret');
}
