import urllib.request
import json
import os

def check_waba_subscription():
    env_path = r'd:\face recognition attendence\frontend\.env.local'
    token = ''
    phone_id = '1330066433517275'
    waba_id = '1738385663951266'
    api_version = 'v20.0'

    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith('WHATSAPP_ACCESS_TOKEN='):
                    token = line.strip().split('=', 1)[1].strip('"\'')
                elif line.startswith('WHATSAPP_PHONE_NUMBER_ID='):
                    phone_id = line.strip().split('=', 1)[1].strip('"\'')
                elif line.startswith('WHATSAPP_BUSINESS_ACCOUNT_ID='):
                    waba_id = line.strip().split('=', 1)[1].strip('"\'')

    print(f"=== WABA WEBHOOK SUBSCRIPTION DIAGNOSTIC ===")
    print(f"Target WABA ID: {waba_id}")
    print(f"Target Phone Number ID: {phone_id}")

    if not token or token.startswith('EAAG_dummy'):
        print("Error: Invalid or missing WHATSAPP_ACCESS_TOKEN.")
        return

    # 1. Query WABA subscribed_apps
    url = f"https://graph.facebook.com/{api_version}/{waba_id}/subscribed_apps"
    req = urllib.request.Request(
        url,
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    )

    try:
        with urllib.request.urlopen(req) as res:
            status = res.status
            body_text = res.read().decode('utf-8')
            data = json.loads(body_text)

            subscribed_apps = data.get('data', [])

            print(f"\n1. WABA Subscribed Apps API Response Status: HTTP {status}")
            print(f"Subscribed Apps Count: {len(subscribed_apps)}")

            is_subscribed = False
            for app in subscribed_apps:
                app_id = app.get('whatsapp_business_api_data', {}).get('id') or app.get('id') or app.get('name')
                print(f"  - App Record: {app}")
                is_subscribed = True

            print(f"\nIs WABA '{waba_id}' Subscribed to Webhooks?: {'YES (SUBSCRIBED)' if is_subscribed else 'NO (NOT SUBSCRIBED!)'}")

    except Exception as e:
        if hasattr(e, 'read'):
            err_body = e.read().decode('utf-8')
            print(f"\n1. WABA Subscribed Apps API Error (HTTP {getattr(e, 'code', 'Unknown')}): {err_body}")
        else:
            print(f"\n1. Error querying WABA subscribed_apps: {e}")

if __name__ == '__main__':
    check_waba_subscription()
