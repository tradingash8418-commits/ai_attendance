import urllib.request
import json
import os

def subscribe_app_to_waba():
    env_path = r'd:\face recognition attendence\frontend\.env.local'
    token = ''
    waba_id = '1738385663951266'
    api_version = 'v20.0'

    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith('WHATSAPP_ACCESS_TOKEN='):
                    token = line.strip().split('=', 1)[1].strip('"\'')
                elif line.startswith('WHATSAPP_BUSINESS_ACCOUNT_ID='):
                    waba_id = line.strip().split('=', 1)[1].strip('"\'')

    print(f"=== SUBSCRIBING APP TO WABA '{waba_id}' ===")

    if not token or token.startswith('EAAG_dummy'):
        print("Error: Invalid or missing WHATSAPP_ACCESS_TOKEN.")
        return

    url = f"https://graph.facebook.com/{api_version}/{waba_id}/subscribed_apps"
    req = urllib.request.Request(
        url,
        data=b'',
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
        method='POST'
    )

    try:
        with urllib.request.urlopen(req) as res:
            status = res.status
            body_text = res.read().decode('utf-8')
            print(f"Subscribe WABA App API Status: HTTP {status}")
            print(f"Response: {body_text}")
    except Exception as e:
        if hasattr(e, 'read'):
            err_body = e.read().decode('utf-8')
            print(f"Subscribe WABA App Error (HTTP {getattr(e, 'code', 'Unknown')}): {err_body}")
        else:
            print(f"Error subscribing WABA app: {e}")

if __name__ == '__main__':
    subscribe_app_to_waba()
