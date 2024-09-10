# Use a pipeline as a high-level helper
from transformers import pipeline

pipe = pipeline("image-to-text", model="selvakumarcts/sk_invoice_receipts")

# Load model directly
from transformers import AutoTokenizer, AutoModel

tokenizer = AutoTokenizer.from_pretrained("selvakumarcts/sk_invoice_receipts")
model = AutoModel.from_pretrained("selvakumarcts/sk_invoice_receipts")

