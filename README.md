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

### Why `--webpack` in the dev script?

`npm run dev` passes `--webpack` on purpose. The default bundler (Turbopack) in
Next.js 16 draws a code frame around errors using Rust, and it slices the line by
**byte count**, not character count. Arabic characters are two bytes each, so when
an error lands on a line containing Arabic the bundler panics:

```
panicked at crates\next-code-frame\src\highlight.rs: end byte index … is not a
char boundary; it is inside 'ل'
```

The panic crosses the NAPI boundary uncaught, killing the entire dev server — the
site becomes unreachable not because of a code bug but because the original error
could not be displayed. This project's codebase is heavily commented in Arabic, so
the risk exists in virtually every file.

The bug is filed in Next.js ([#98178](https://github.com/vercel/next.js/issues/98178))
and is not yet fixed. Once it is, run `npm run dev:turbo` to switch back to
Turbopack (faster). Nothing in `next.config.ts` depends on either bundler, and
production builds (`npm run build`) use Turbopack as-is.

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
