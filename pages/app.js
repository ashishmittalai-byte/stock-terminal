// pages/_app.js — Shared layout: fonts, CSS variables, global styles
import Head from 'next/head';

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <style jsx global>{`
        :root {
          --bg-primary:#f5f6fa; --bg-elevated:#ffffff; --card-bg:#ffffff;
          --card-border:rgba(0,0,0,0.06); --card-shadow:0 1px 3px rgba(0,0,0,0.04),0 4px 16px rgba(0,0,0,0.03);
          --text-primary:#1a1f36; --text-secondary:#4a5568; --text-muted:#94a0b4;
          --accent-blue:#4f46e5; --accent-purple:#7c3aed; --accent-green:#16a34a;
          --accent-red:#dc2626; --accent-amber:#d97706;
          --pill-bg:#f3f4f8; --pill-border:rgba(0,0,0,0.04);
          --radius-sm:8px; --radius-md:12px; --radius-lg:16px;
        }
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        body{font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;background:var(--bg-primary);color:var(--text-primary);min-height:100vh;-webkit-font-smoothing:antialiased;overflow-x:hidden}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.12);border-radius:3px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        a{color:inherit;text-decoration:none}
      `}</style>
      <Component {...pageProps} />
    </>
  );
}
