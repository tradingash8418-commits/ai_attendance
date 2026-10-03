const fs = require('fs');
const path = require('path');

async function testMetaMessage(recipientNumber) {
  const envContent = fs.readFileSync(path.resolve(__dirname, '../frontend/.env.local'), 'utf-8');
  const tokenMatch = envContent.match(/WHATSAPP_ACCESS_TOKEN=(.+)/);
  const token = tokenMatch ? tokenMatch[1].trim().replace(/^["']|["']$/g, '') : '';
  const phoneNumberId = '1330066433517275';
  const cleanNumber = recipientNumber.replace(/\+/g, '');

  console.log(`Testing Meta WhatsApp API dispatch to ${cleanNumber}...`);

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanNumber,
        type: 'text',
        text: {
          preview_url: false,
          body: 'Test dispatch from Contractor OS',
        },
      }),
    });

    const data = await res.json();
    console.log(`[HTTP ${res.status}] Response for ${cleanNumber}:`);
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Fetch error for ${cleanNumber}:`, err);
  }
}

async function run() {
  console.log('--- TEST 1: Sending to 918418020692 (User number) ---');
  await testMetaMessage('918418020692');
  console.log('\n--- TEST 2: Sending to 916306232467 (Supervisor Divyanshu Yadav) ---');
  await testMetaMessage('916306232467');
}

run();
