import urllib.request
import json
import os

env_path = r'd:\face recognition attendence\frontend\.env.local'
token = ''
if os.path.exists(env_path):
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.startswith('WHATSAPP_ACCESS_TOKEN='):
                token = line.strip().split('=', 1)[1].strip('"\'')

print('Token loaded length:', len(token))

url = 'https://graph.facebook.com/v20.0/1330066433517275/messages'
payload = {
    'messaging_product': 'whatsapp',
    'to': '918418082692',
    'type': 'text',
    'text': {'body': 'Contractor AI Live Test Message'}
}

req = urllib.request.Request(
    url,
    data=json.dumps(payload).encode('utf-8'),
    headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
)

try:
    with urllib.request.urlopen(req) as res:
        print('Meta API Status:', res.status)
        print('Response:', res.read().decode('utf-8'))
except Exception as e:
    if hasattr(e, 'read'):
        print('Meta API Error:', e.read().decode('utf-8'))
    else:
        print('Error:', e)
