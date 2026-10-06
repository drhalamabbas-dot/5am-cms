"""يحمّل الموديل الأساسي Qwen2.5-1.5B-Instruct (Apache 2.0) من Hugging Face — مرة واحدة.
    python download-base.py <مجلد_الحفظ>"""
import sys
from huggingface_hub import snapshot_download

dest = sys.argv[1]
path = snapshot_download('Qwen/Qwen2.5-1.5B-Instruct', local_dir=dest,
                         allow_patterns=['*.json', '*.safetensors', '*.txt', 'merges.txt', 'vocab.json', 'LICENSE'])
print('حُمّل في:', path)
