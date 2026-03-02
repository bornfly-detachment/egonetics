import requests
import time

time.sleep(2)
try:
    response = requests.get('http://localhost:3001/blog', timeout=10)
    print('Status code:', response.status_code)
    print('Response length:', len(response.text))
    print('\nFirst 1000 characters:')
    print(response.text[:1000])
except Exception as e:
    print('Error:', e)
