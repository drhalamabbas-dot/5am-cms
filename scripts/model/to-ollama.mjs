/* يحوّل الموديل المدموج (runs/<نسخة>/merged) إلى موديل Ollama على جهازك، مضغوطًا q4_K_M
   (حوالي 1 جيجا، يرد بسرعة على كارت 6 جيجا)، باسم 5am-model:<نسخة>.
   node scripts/model/to-ollama.mjs <مجلد_merged> <النسخة> */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [mdir, ver = 'v0.1'] = process.argv.slice(2);
if (!mdir || !fs.existsSync(path.join(mdir, 'config.json'))) { console.error('مجلد merged غير صحيح'); process.exit(1); }
/* قالب Qwen (ChatML) صريح: لا نعتمد على اكتشاف Ollama له. رسالة النظام من الموقع
   جوّه .Messages أصلًا، فلا نضيف .System (كانت هتتكرر). */
const modelfile = `FROM ${mdir.replace(/\\/g, '/')}
TEMPLATE """{{- range .Messages }}<|im_start|>{{ .Role }}
{{ .Content }}<|im_end|>
{{ end }}<|im_start|>assistant
"""
PARAMETER stop "<|im_end|>"
PARAMETER stop "<|endoftext|>"
PARAMETER temperature 0.3
PARAMETER num_ctx 4096
`;
const mf = path.join(mdir, 'Modelfile');
fs.writeFileSync(mf, modelfile);
const name = `5am-model:${ver}`;
console.log(`ollama create ${name} --quantize q4_K_M …`);
execFileSync('ollama', ['create', name, '-f', mf, '--quantize', 'q4_K_M'], { stdio: 'inherit' });
console.log(`جاهز: ${name} — في «تدريب البوت»: رابط موديلنا http://127.0.0.1:11434 واسم الموديل ${name}`);
