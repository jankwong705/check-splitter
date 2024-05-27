import requests
import json

def receipt_scan(imageFile):
    receiptOcrEndpoint = 'https://ocr.asprise.com/api/v1/receipt' # Receipt OCR API endpoint
    r = requests.post(receiptOcrEndpoint, data = { \
    'api_key': 'TEST',        # Use 'TEST' for testing purpose \
    'recognizer': 'auto',       # can be 'US', 'CA', 'JP', 'SG' or 'auto' \
    'ref_no': 'ocr_python_123', # optional caller provided ref code \
    }, \
    files = {"file": open(imageFile, "rb")})

    return r.text # result in JSON

data = json.loads(receipt_scan('test.jpeg'))
print(data)