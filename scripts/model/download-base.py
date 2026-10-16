"""يحمّل موديلًا أساسيًّا من Hugging Face — مرة واحدة.

    python download-base.py <مجلد_الحفظ> [اسم_الموديل]

الافتراضي Qwen2.5-1.5B-Instruct (Apache 2.0) وهو أساس النسخ الأولى.
ولتجربة أساس أكبر (يخترع أقل ويكرّر أقل، لكنه أثقل على الكارت):

    python download-base.py "%USERPROFILE%\\5am-data\\model\\base\\Qwen2.5-7B-Instruct" Qwen/Qwen2.5-7B-Instruct
"""
import sys
from huggingface_hub import snapshot_download

dest = sys.argv[1]
repo = sys.argv[2] if len(sys.argv) > 2 else 'Qwen/Qwen2.5-1.5B-Instruct'
path = snapshot_download(repo, local_dir=dest,
                         allow_patterns=['*.json', '*.safetensors', '*.txt', 'merges.txt', 'vocab.json', 'LICENSE'])
print('حُمّل في:', path)
