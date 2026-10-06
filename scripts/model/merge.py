"""
دمج الطبقة (adapter) مع الموديل الأساسي ← موديل واحد (merged) جاهز لـ Ollama.
يستدعيه train.py في آخره، ويشتغل لوحده لإعادة الدمج بدون إعادة تدريب:

    python merge.py --base base/Qwen2.5-1.5B-Instruct --adapter runs/v0.1/adapter --out runs/v0.1/merged

• الأوزان فقط من الدمج؛ config.json وملفات الـ tokenizer تتنسخ من الموديل الأساسي
  كما هي (LoRA لا يغيّر البنية ولا الكلمات). السبب: transformers 5 يكتبها بشكل جديد
  (rope_theta جوّه rope_parameters، وtokenizer.json مختلف)، وOllama يقراها غلط
  فيرد «@@@@» مع إن الموديل نفسه سليم.
• الدمج بـ bf16 (نوع Qwen2.5 الأصلي).
"""
import argparse, os, shutil

import torch
from transformers import AutoModelForCausalLM
from peft import PeftModel


def merge(base_dir, adapter_dir, out_dir):
    base = AutoModelForCausalLM.from_pretrained(base_dir, dtype=torch.bfloat16, device_map={'': 'cpu'})
    merged = PeftModel.from_pretrained(base, adapter_dir).merge_and_unload()
    merged.save_pretrained(out_dir, safe_serialization=True)
    for f in ('config.json', 'generation_config.json', 'tokenizer.json', 'tokenizer_config.json', 'vocab.json', 'merges.txt', 'chat_template.jinja'):
        dst = os.path.join(out_dir, f)
        if os.path.exists(os.path.join(base_dir, f)): shutil.copyfile(os.path.join(base_dir, f), dst)
        elif os.path.exists(dst): os.remove(dst)  # نسخة transformers 5 من الملف — الأصل لا يحتاجه
    return out_dir


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--base', required=True)
    p.add_argument('--adapter', required=True)
    p.add_argument('--out', required=True)
    a = p.parse_args()
    print('حُفظ الموديل المدموج:', merge(a.base, a.adapter, a.out))
