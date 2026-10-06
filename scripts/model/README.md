# موديل 5A&M — تدريبه على جهازك

موديلنا = **Qwen2.5-1.5B-Instruct** (Apache 2.0) + طبقة LoRA تعلّمت من إجابات Qwen
الكبير التي راجعها الفريق في «تدريب البوت». التدريب على كارت NVIDIA (RTX 3060، 6 جيجا)
بـ 4-bit، وبعده يشتغل في Ollama على الجهاز نفسه.

كل الملفات الكبيرة خارج الموقع وخارج OneDrive: `%USERPROFILE%\5am-data\model\`

```
5am-data\model\
  venv\                         بيئة Python (PyTorch للكارت + transformers + peft + bitsandbytes)
  base\Qwen2.5-1.5B-Instruct\   الموديل الأساسي (يتحمّل مرة)
  data\train-<نسخة>.jsonl       بيانات التدريب المصدّرة من الموقع
  runs\<نسخة>\                  train.log · heldout.json · adapter\ · merged\ · report.md · results.json
```

## إعادة التدريب (كل ما تزيد الإجابات المقبولة)

الموقع لازم يكون شغّال (start.bat). من مجلد `5am-cms` في PowerShell، غيّر `v0.2` لرقم النسخة الجديدة:

```powershell
$m = "$env:USERPROFILE\5am-data\model"
# 1) البيانات: المقبول فقط (للنسخة الحقيقية). أضف --checked لتجربة بالمقبول + السليم تلقائيًا
node scripts/model/export-data.mjs "$m\data\train-v0.2.jsonl"
# 2) التدريب (~15–40 دقيقة حسب عدد الأمثلة)
$env:PYTHONUTF8 = '1'; $env:HF_HUB_OFFLINE = '1'
& "$m\venv\Scripts\python.exe" scripts\model\train.py --data "$m\data\train-v0.2.jsonl" --base "$m\base\Qwen2.5-1.5B-Instruct" --out "$m\runs\v0.2"
# 3) إلى Ollama على جهازك (5am-model:v0.2)
node scripts/model/to-ollama.mjs "$m\runs\v0.2\merged" v0.2
# 4) التقييم (أضف --teacher للمقارنة بـ Qwen الكبير — يستهلك من حد OpenRouter)
node scripts/model/eval.mjs "$m\runs\v0.2" 5am-model:v0.2
```

افتح `runs\v0.2\report.md`: كل سؤال وجواب موديلنا بجانب الجواب المقبول.

لو Ollama رد بـ «@@@@» أو كلام ملخبط: أعد الدمج من الطبقة بدون إعادة تدريب، ثم الخطوة 3 تاني:

```powershell
& "$m\venv\Scripts\python.exe" scripts\model\merge.py --base "$m\base\Qwen2.5-1.5B-Instruct" --adapter "$m\runs\v0.2\adapter" --out "$m\runs\v0.2\merged"
```

(السبب كان إن transformers 5 بيكتب config.json والـ tokenizer بشكل جديد Ollama مش بيفهمه؛
merge.py بيحط ملفات الموديل الأساسي الأصلية جنب الأوزان المدموجة.)

## تجربته في الموقع (على جهازك)

«تدريب البوت» ← مصدر الردود: **موديلنا** · رابط موديلنا: `http://127.0.0.1:11434` · اسم الموديل: `5am-model:v0.2`.
لو ما ردّش أو ضعيف، Qwen يكمّل تلقائيًا؛ ورجّع المصدر لـ Qwen بضغطة.

## على الاستضافة

الاستضافة المشتركة لا تشغّل موديلات. لما يبقى مستواه كويس: يتحوّل لـ GGUF ويترفع على
Hugging Face Space مجاني (الخطوات في دفتر Colab من «تدريب البوت» — قسم 7 لـ 9)، ورابطه
يتحط في «رابط موديلنا» على الموقع المرفوع.

## متى يكون جاهزًا للعملاء؟

نسخة v0.1 تجريبية (42 مثال) هدفها التأكد إن الخطوات كلها شغّالة. الموديل يبقى مفيدًا
لما يتدرّب على **300+ إجابة مقبولة**، ويعدّي التقييم: يرد بلغة السؤال، بلا صيني ولا أسعار،
وتطابقه مع المقبول قريب من تطابق Qwen المعلّم.
