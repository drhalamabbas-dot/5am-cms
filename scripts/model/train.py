"""
تدريب موديل 5A&M على جهازك (كارت NVIDIA) — LoRA فوق Qwen2.5-1.5B-Instruct.

البيانات: ملف JSONL من «تدريب البوت ← بيانات التدريب» (رسالة النظام بمعلومات
الموقع + سؤال العميل + الجواب المقبول) — نفس شكل ما يرسله الموقع للموديل وهو
يعمل، فيتعلّم يجاوب من معلومات الموقع لا من خياله.

• الموديل يتحمّل بـ 4-bit (QLoRA) فيكفيه كارت 6 جيجا، ولو bitsandbytes غير
  متاح يتحمّل bf16.
• الخسارة على الجواب وحده (السؤال ورسالة النظام لا يُتعلَّمان كنص).
• جزء من البيانات يُحجز للتقييم ولا يتدرّب عليه.
• في الآخر: الطبقة (adapter) + موديل مدموج (merged) جاهز لـ Ollama.

    python train.py --data data/train.jsonl --base base/Qwen2.5-1.5B-Instruct --out runs/v0.1
"""
import argparse, json, math, os, random, sys, time

import torch
from torch.utils.data import Dataset
from transformers import AutoModelForCausalLM, AutoTokenizer, Trainer, TrainingArguments
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

p = argparse.ArgumentParser()
p.add_argument('--data', required=True)
p.add_argument('--base', required=True)
p.add_argument('--out', required=True)
p.add_argument('--epochs', type=float, default=3)
p.add_argument('--lr', type=float, default=2e-4)
p.add_argument('--max-len', type=int, default=1536)
p.add_argument('--eval-frac', type=float, default=0.15)
p.add_argument('--seed', type=int, default=42)
args = p.parse_args()

random.seed(args.seed); torch.manual_seed(args.seed)
os.makedirs(args.out, exist_ok=True)
log = open(os.path.join(args.out, 'train.log'), 'a', encoding='utf-8')
def say(*a):
    s = ' '.join(str(x) for x in a)
    print(s, flush=True); log.write(s + '\n'); log.flush()

assert torch.cuda.is_available(), 'لا يوجد كارت NVIDIA متاح لـ PyTorch'
say('GPU:', torch.cuda.get_device_name(0), f'{torch.cuda.get_device_properties(0).total_memory / 2**30:.1f} GB')

rows = [json.loads(l) for l in open(args.data, encoding='utf-8') if l.strip()]
random.shuffle(rows)
n_eval = max(2, int(len(rows) * args.eval_frac)) if len(rows) >= 10 else 0
eval_rows, train_rows = rows[:n_eval], rows[n_eval:]
json.dump(eval_rows, open(os.path.join(args.out, 'heldout.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
say(f'بيانات: {len(rows)} — تدريب {len(train_rows)} · تقييم محجوز {len(eval_rows)}')

tok = AutoTokenizer.from_pretrained(args.base)
if tok.pad_token is None: tok.pad_token = tok.eos_token

def encode(msgs):
    """يرجع (ids, labels): الخسارة على الجواب وحده. لو الطول زاد، تُقصّ معلومات الموقع في رسالة النظام لا الجواب."""
    sys_msg, user, asst = msgs[0]['content'], msgs[1]['content'], msgs[2]['content']
    for cut in range(0, 12):
        s = sys_msg if cut == 0 else sys_msg[: max(400, int(len(sys_msg) * (1 - cut * 0.08)))]
        prompt = tok.apply_chat_template([{'role': 'system', 'content': s}, {'role': 'user', 'content': user}], tokenize=False, add_generation_prompt=True)
        full = prompt + asst + tok.eos_token
        p_ids = tok(prompt, add_special_tokens=False)['input_ids']
        f_ids = tok(full, add_special_tokens=False)['input_ids']
        if len(f_ids) <= args.max_len: break
    f_ids = f_ids[: args.max_len]
    labels = [-100] * min(len(p_ids), len(f_ids)) + f_ids[len(p_ids):]
    return f_ids, labels[: len(f_ids)]

class DS(Dataset):
    def __init__(self, rs): self.items = [encode(r['messages']) for r in rs]
    def __len__(self): return len(self.items)
    def __getitem__(self, i): return self.items[i]

def collate(batch):
    m = max(len(x[0]) for x in batch)
    ids = torch.full((len(batch), m), tok.pad_token_id); lab = torch.full((len(batch), m), -100); att = torch.zeros((len(batch), m), dtype=torch.long)
    for i, (x, y) in enumerate(batch):
        ids[i, : len(x)] = torch.tensor(x); lab[i, : len(y)] = torch.tensor(y); att[i, : len(x)] = 1
    return {'input_ids': ids, 'labels': lab, 'attention_mask': att}

train_ds, eval_ds = DS(train_rows), (DS(eval_rows) if eval_rows else None)
lens = [len(x[0]) for x in train_ds.items]
say(f'أطوال الأمثلة (tokens): أقل {min(lens)} · متوسط {sum(lens)//len(lens)} · أكبر {max(lens)}')

bf16 = torch.cuda.is_bf16_supported()
quant = None
try:
    from transformers import BitsAndBytesConfig
    import bitsandbytes  # noqa: F401
    quant = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type='nf4', bnb_4bit_use_double_quant=True,
                               bnb_4bit_compute_dtype=torch.bfloat16 if bf16 else torch.float16)
    say('التحميل: 4-bit (QLoRA)')
except Exception as e:
    say('bitsandbytes غير متاح — التحميل bf16/fp16:', e)

model = AutoModelForCausalLM.from_pretrained(args.base, quantization_config=quant, dtype=torch.bfloat16 if bf16 else torch.float16,
                                             device_map={'': 0}, attn_implementation='sdpa')
model.config.use_cache = False
if quant: model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=True)
else: model.gradient_checkpointing_enable()
model = get_peft_model(model, LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, task_type='CAUSAL_LM',
                                         target_modules=['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj']))
trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
say(f'يتعلّم: {trainable/1e6:.1f} مليون parameter (من {sum(p.numel() for p in model.parameters())/1e9:.2f} مليار)')

steps_per_epoch = math.ceil(len(train_ds) / 8)
targs = TrainingArguments(
    output_dir=os.path.join(args.out, 'ckpt'), num_train_epochs=args.epochs, per_device_train_batch_size=1,
    gradient_accumulation_steps=8, learning_rate=args.lr, lr_scheduler_type='cosine', warmup_steps=0.05,  # transformers 5: كسر < 1 = نسبة من الخطوات
    logging_steps=max(1, steps_per_epoch // 4), save_strategy='no', eval_strategy='epoch' if eval_ds else 'no',
    per_device_eval_batch_size=1, bf16=bf16, fp16=not bf16, optim='paged_adamw_8bit' if quant else 'adamw_torch',
    report_to='none', remove_unused_columns=False, gradient_checkpointing=True, dataloader_pin_memory=False,
)
t0 = time.time()
tr = Trainer(model=model, args=targs, train_dataset=train_ds, eval_dataset=eval_ds, data_collator=collate)
res = tr.train()
say(f'انتهى التدريب في {(time.time()-t0)/60:.1f} دقيقة · خسارة التدريب {res.training_loss:.4f}')
for h in tr.state.log_history:
    if 'eval_loss' in h: say(f"  تقييم بعد epoch {h.get('epoch')}: خسارة {h['eval_loss']:.4f}")
say('أقصى ذاكرة على الكارت:', f'{torch.cuda.max_memory_allocated()/2**30:.2f} GB')

adapter = os.path.join(args.out, 'adapter')
model.save_pretrained(adapter); tok.save_pretrained(adapter)
say('حُفظت الطبقة:', adapter)

# الدمج: الموديل الأساسي كامل الدقة + الطبقة ← موديل واحد لـ Ollama (التفاصيل في merge.py)
eval_losses = [h['eval_loss'] for h in tr.state.log_history if 'eval_loss' in h]
del model, tr; torch.cuda.empty_cache()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from merge import merge
mdir = merge(args.base, adapter, os.path.join(args.out, 'merged'))
json.dump({'base': args.base, 'data': args.data, 'train': len(train_rows), 'heldout': len(eval_rows), 'epochs': args.epochs,
           'lr': args.lr, 'max_len': args.max_len, 'train_loss': res.training_loss,
           'eval_loss': eval_losses,
           'finished_at': time.strftime('%Y-%m-%dT%H:%M:%S')},
          open(os.path.join(args.out, 'run.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
say('حُفظ الموديل المدموج:', mdir)
