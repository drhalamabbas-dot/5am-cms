/* خادم ملفات بسيط للموقع القديم، لمقارنة الشكل بالجديد أثناء النقل.
   الاستعمال:  node scripts/serve-old.mjs [port] */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SITE_SRC
  || 'C:\\Users\\Mohamed Nagy\\OneDrive - Arab Open University - AOU\\Desktop\\5am-website - Copy';
const PORT = Number(process.argv[2] || 8000);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.join(ROOT, rel);
  // لا يُقرأ خارج جذر الموقع
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, '127.0.0.1', () => console.log(`الموقع القديم: http://localhost:${PORT}`));
