/* يبني دفتر Colab (train-5am-model.ipynb) من الخلايا المكتوبة هنا — أسهل في
   المراجعة من JSON الدفتر نفسه. شغّله بعد أي تعديل:
   node scripts/colab/build-notebook.mjs */
import fs from 'node:fs';

const md = (s) => ({ cell_type: 'markdown', metadata: {}, source: s.trim().split('\n').map((l, i, a) => l + (i < a.length - 1 ? '\n' : '')) });
const code = (s) => ({ cell_type: 'code', metadata: {}, execution_count: null, outputs: [], source: s.trim().split('\n').map((l, i, a) => l + (i < a.length - 1 ? '\n' : '')) });

const cells = [
  md(`
# تدريب موديل 5A&M — يتعلّم من ردود Qwen المراجَعة

**الفكرة:** Qwen يرد على العملاء الآن، والفريق يراجع ردوده في «تدريب البوت» ويقبل الصحيح أو يصحّحه. هذا الدفتر يعلّم موديلًا صغيرًا مفتوح المصدر (Qwen2.5-1.5B) من تلك الردود — فيصير عندنا موديل خاص بنا، مجاني، نشغّله بدل Qwen بسويتش في اللوحة.

**الخطوات (حوالي 30–60 دقيقة على Colab المجاني):**
1. من القائمة: **Runtime ← Change runtime type ← T4 GPU**.
2. من لوحة التحكم: «تدريب البوت» ← **بيانات التدريب (JSONL)**. يُستحسن 300 سؤال وجواب مقبول على الأقل قبل التدريب الأول.
3. شغّل الخلايا بالترتيب (Shift+Enter)، وارفع الملف لما يُطلب.
4. آخر الدفتر: رفع الموديل على Hugging Face وتشغيله مجانًا، ثم وضع رابطه في «تدريب البوت ← رابط موديلنا».

> الدفتر لا يحتاج أي مفتاح من الموقع. مفتاح Hugging Face تكتبه أنت فقط في خلية الرفع.
`),
  code(`
# 1) المكتبات
!pip install -q -U "transformers>=4.45" "peft>=0.13" "trl>=0.12" datasets accelerate
import torch; print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'لا يوجد — غيّر Runtime إلى T4 GPU')
`),
  code(`
# 2) ارفع ملف بيانات التدريب (5am-chat-train-….jsonl) من لوحة التحكم
from google.colab import files
up = files.upload()
DATA = next(iter(up))
import json
rows = [json.loads(l) for l in open(DATA, encoding='utf-8') if l.strip()]
print(len(rows), 'سؤال وجواب')
print(rows[0]['messages'][1]['content'], '→', rows[0]['messages'][2]['content'][:200])
`),
  code(`
# 3) الموديل الأساسي. 1.5B أفضل في العربي ويعمل على CPU مجاني؛ 0.5B أسرع وأضعف.
BASE = 'Qwen/Qwen2.5-1.5B-Instruct'
from transformers import AutoTokenizer, AutoModelForCausalLM
tok = AutoTokenizer.from_pretrained(BASE)
model = AutoModelForCausalLM.from_pretrained(BASE, torch_dtype=torch.float16, device_map='auto')
`),
  code(`
# 4) التدريب (LoRA: يتعلّم طبقة صغيرة فوق الموديل — سريع ويكفيه كارت Colab المجاني)
from datasets import Dataset
from peft import LoraConfig
from trl import SFTTrainer, SFTConfig

ds = Dataset.from_list(rows).train_test_split(test_size=0.1, seed=42) if len(rows) >= 50 else None
train = ds['train'] if ds else Dataset.from_list(rows)
lora = LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, task_type='CAUSAL_LM',
                  target_modules=['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj'])
import inspect
kw = dict(output_dir='out', num_train_epochs=3, per_device_train_batch_size=2, gradient_accumulation_steps=4,
          learning_rate=2e-4, lr_scheduler_type='cosine', warmup_ratio=0.05, logging_steps=10, save_strategy='no',
          fp16=True, report_to='none')
# اسم خانة الطول تغيّر بين إصدارات trl
kw['max_seq_length' if 'max_seq_length' in inspect.signature(SFTConfig).parameters else 'max_length'] = 2048
cfg = SFTConfig(**kw)
trainer = SFTTrainer(model=model, args=cfg, train_dataset=train, eval_dataset=ds['test'] if ds else None,
                     peft_config=lora, processing_class=tok)
trainer.train()
if ds: print('خطأ التقييم (الأقل أفضل):', trainer.evaluate()['eval_loss'])
`),
  code(`
# 5) جرّبه على أسئلة لم يرها (بنفس رسالة النظام التي يرسلها الموقع)
def ask(msgs):
    ids = tok.apply_chat_template(msgs, add_generation_prompt=True, return_tensors='pt').to(trainer.model.device)
    out = trainer.model.generate(ids, max_new_tokens=300, temperature=0.3, do_sample=True)
    return tok.decode(out[0][ids.shape[1]:], skip_special_tokens=True)

for r in (ds['test'] if ds else train).select(range(min(5, len(ds['test'] if ds else train)))):
    m = r['messages']
    print('س:', m[1]['content']); print('موديلنا:', ask(m[:2])); print('المقبول:', m[2]['content']); print('—' * 40)
`),
  code(`
# 6) دمج الطبقة في الموديل وحفظه
merged = trainer.model.merge_and_unload()
merged.save_pretrained('5am-model', safe_serialization=True)
tok.save_pretrained('5am-model')
`),
  code(`
# 7) تحويله لملف GGUF (يعمل على CPU بسرعة معقولة) — جودة q8_0 قريبة جدًا من الأصل
!git clone -q --depth 1 https://github.com/ggml-org/llama.cpp
!pip install -q -r llama.cpp/requirements/requirements-convert_hf_to_gguf.txt
!python llama.cpp/convert_hf_to_gguf.py 5am-model --outfile 5am-model-q8_0.gguf --outtype q8_0
!ls -lh 5am-model-q8_0.gguf
`),
  md(`
## 8) الرفع على Hugging Face (حساب مجاني)

1. اعمل حسابًا على huggingface.co، ثم **Settings ← Access Tokens ← New token** بصلاحية **Write**.
2. شغّل الخلية التالية والصق التوكن **في خانة Colab نفسها** (لا ترسله لأحد).
3. غيّر \`HF_USER\` لاسم حسابك. المستودع خاص (private) — لا يراه غيرك.
`),
  code(`
HF_USER = 'اكتب-اسم-حسابك'
from huggingface_hub import login, HfApi
login()
api = HfApi()
repo = f'{HF_USER}/5am-model-gguf'
api.create_repo(repo, private=True, exist_ok=True)
api.upload_file(path_or_fileobj='5am-model-q8_0.gguf', path_in_repo='5am-model-q8_0.gguf', repo_id=repo)
print('رُفع:', f'https://huggingface.co/{repo}')
`),
  md(`
## 9) تشغيله مجانًا على Hugging Face Spaces (بلا VPS ولا فلوس)

1. **New Space** ← الاسم \`5am-model\` ← **Docker ← Blank** ← الجهاز **CPU basic (free)** ← **Private**.
2. في **Settings ← Variables and secrets** أضف:
   - Secret: \`HF_TOKEN\` = توكن قراءة من حسابك (ليقرأ المستودع الخاص).
   - Secret: \`LLAMA_API_KEY\` = كلمة سر طويلة تخترعها (تحمي الموديل من الاستعمال من غيرك).
3. أنشئ ملفًا اسمه \`Dockerfile\` في الـ Space بالمحتوى الذي تطبعه الخلية التالية.
4. بعد ما يشتغل (Running): الرابط \`https://<HF_USER>-5am-model.hf.space\`.
5. في لوحة التحكم ← «تدريب البوت»: ضع الرابط في «رابط موديلنا»، وفي ملف إعدادات الموقع \`OWN_MODEL_KEY=\` نفس \`LLAMA_API_KEY\`، ثم غيّر «مصدر الردود» إلى «موديلنا» وجرّب. لو ضعف ردّه رجّع Qwen.

> ملاحظة صادقة: الـ Space المجاني «ينام» بعد 48 ساعة بلا استعمال، وأول رد بعدها يتأخر دقيقة. والـ CPU المجاني يكتب حوالي 5–10 كلمات في الثانية. لو البطء ضايقك، Qwen يفضل الأساس وموديلنا احتياطي.
`),
  code(`
print(f'''FROM ghcr.io/ggml-org/llama.cpp:server
ENV LLAMA_ARG_HOST=0.0.0.0 LLAMA_ARG_PORT=7860 LLAMA_ARG_CTX_SIZE=4096
CMD ["--hf-repo", "{HF_USER}/5am-model-gguf", "--hf-file", "5am-model-q8_0.gguf", "--alias", "5am-model"]
''')
`),
  md(`
## كل ما يتجمّع مقبول جديد (مثلًا كل شهر)
نزّل بيانات التدريب من جديد وأعد تشغيل الدفتر — الموديل يتعلّم من كل الأسئلة المقبولة حتى الآن، ثم ارفع الملف الجديد على المستودع نفسه وأعد تشغيل الـ Space (Factory reboot).
`),
];

const nb = {
  nbformat: 4, nbformat_minor: 0,
  metadata: { colab: { provenance: [], gpuType: 'T4' }, kernelspec: { name: 'python3', display_name: 'Python 3' }, language_info: { name: 'python' }, accelerator: 'GPU' },
  cells,
};
fs.writeFileSync(new URL('./train-5am-model.ipynb', import.meta.url), JSON.stringify(nb, null, 1) + '\n');
console.log(`train-5am-model.ipynb — ${cells.length} خلية`);
