This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### لماذا `--webpack` في سكربت التطوير؟

`npm run dev` يمرّر `--webpack` عمدًا. المجمِّع الافتراضي (Turbopack) في Next.js 16
يرسم إطار الشيفرة حول أي خطأ بلغة Rust، وهو يقصّ السطر بعدّ **البايتات** لا الأحرف.
الحرف العربي بايتان، فحين يقع الخطأ على سطر فيه عربية ينهار المجمِّع:

```
panicked at crates\next-code-frame\src\highlight.rs: end byte index … is not a
char boundary; it is inside 'ل'
```

والانهيار يعبر حدود NAPI بلا التقاط، فيموت خادم التطوير كلّه ويصير الموقع «لا يمكن
الوصول إليه» — لا لخطأ في الموقع بل لأن الخطأ الأصلي تعذّر عرضه. وشيفرة هذا المشروع
معلَّقة بالعربية كلها، فالاحتمال قائم في أي ملف.

العلّة مرفوعة في Next.js ([#98178](https://github.com/vercel/next.js/issues/98178))
ولم تُصلَح بعد. ولمّا تُصلَح، يُشغَّل `npm run dev:turbo` للعودة إلى Turbopack
(أسرع)؛ ولا شيء في `next.config.ts` يعتمد على أيّ منهما، والبناء (`npm run build`)
على Turbopack كما هو.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
