import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

const SEO_MAP = {
  '/': {
    title: 'QueueNova | Digital queue tokens with live wait estimates',
    h1: 'Know your wait before you join the line',
    description: 'QueueNova gives visitors a digital token and a live wait estimate, and shows staff which queues are filling up and which counters to open.',
    indexed: true,
  },
  '/loading': {
    title: 'Loading | QueueNova',
    h1: 'Loading QueueNova',
    description: 'Initializing QueueNova queue management engine, syncing real-time counter states, and preparing live operational dashboard session.',
    indexed: false,
  },
  '/login': {
    title: 'Sign in | QueueNova',
    h1: 'Staff and admin sign in',
    description: 'Sign in to the QueueNova queue management portal to access real-time counter controls, queue pulse monitoring, and customer tokens.',
    indexed: false,
  },
  '/dashboard': {
    title: 'Queue dashboard | QueueNova',
    h1: 'Queue management dashboard',
    description: 'Live QueueNova operations dashboard showing active counters, real-time customer tokens, service pulse levels, and recommendations.',
    indexed: false,
  },
  '/join': {
    title: 'Join a queue | QueueNova',
    h1: 'Get your queue token',
    description: 'Choose a service, enter your name, and receive a digital token with an estimated wait and a suggested time to come back.',
    indexed: true,
  },
  '/pass': {
    title: 'Your queue pass | QueueNova',
    h1: 'Queue pass QN-104',
    description: 'Track your token, estimated wait and notifications in one place.',
    indexed: false,
  },
  '/live': {
    title: 'Live queue status | QueueNova',
    h1: 'Live queue status',
    description: 'See who is being served, how many people are waiting, and how busy each queue is right now.',
    indexed: true,
  },
  '/admin': {
    title: 'Admin control centre | QueueNova',
    h1: 'Admin control centre',
    description: 'Call, complete, skip and recall tokens, and manage counters. Demo admin for the QueueNova prototype.',
    indexed: false,
  },
  '/admin/counters': {
    title: 'Counters and analytics | QueueNova',
    h1: 'Counters and analytics',
    description: 'Counter status, activity history, service durations and the Flow Score for the demo organisation.',
    indexed: false,
  },
  '/terms': {
    title: 'Terms and conditions | QueueNova',
    h1: 'Terms and conditions',
    description: 'The terms for using the QueueNova prototype, including limits on wait estimates and demo data.',
    indexed: true,
  },
  '/privacy': {
    title: 'Privacy policy | QueueNova',
    h1: 'Privacy policy',
    description: 'What QueueNova stores, where it is stored, and how to delete it.',
    indexed: true,
  },
  '404': {
    title: 'Page not found | QueueNova',
    h1: 'Page not found',
    description: 'The page you asked for does not exist. Go to the home page, join a queue, or view live queue status.',
    indexed: false,
  },
};

const templatePath = path.join(distDir, 'index.html');
if (!fs.existsSync(templatePath)) {
  console.error('Template dist/index.html not found.');
  process.exit(1);
}

const template = fs.readFileSync(templatePath, 'utf8');

for (const [route, meta] of Object.entries(SEO_MAP)) {
  let html = template;

  // Replace title
  html = html.replace(/<title>.*?<\/title>/i, `<title>${meta.title}</title>`);

  // Replace or inject description
  if (/<meta name="description"[^>]*>/i.test(html)) {
    html = html.replace(
      /<meta name="description"[^>]*>/i,
      `<meta name="description" content="${meta.description}" />`
    );
  } else {
    html = html.replace(
      '</head>',
      `  <meta name="description" content="${meta.description}" />\n  </head>`
    );
  }

  // Inject robots tag if not indexed
  if (!meta.indexed) {
    html = html.replace(
      '</head>',
      `  <meta name="robots" content="noindex, nofollow" />\n  </head>`
    );
  }

  // Inject canonical tag
  const canonicalUrl = route === '/' ? 'https://queuenova.app' : `https://queuenova.app${route}`;
  html = html.replace(
    '</head>',
    `  <link rel="canonical" href="${canonicalUrl}" />\n  </head>`
  );

  // Inject prerendered H1 inside root so crawlers read it
  const prerenderedContent = `<div id="root"><header class="p-4 border-b">QueueNova</header><main class="p-8"><h1>${meta.h1}</h1><p>${meta.description}</p></main></div>`;
  html = html.replace('<div id="root"></div>', prerenderedContent);

  if (route === '/') {
    fs.writeFileSync(templatePath, html, 'utf8');
  } else if (route === '404') {
    fs.writeFileSync(path.join(distDir, '404.html'), html, 'utf8');
  } else {
    const routeDir = path.join(distDir, route.slice(1));
    fs.mkdirSync(routeDir, { recursive: true });
    fs.writeFileSync(path.join(routeDir, 'index.html'), html, 'utf8');
  }
}

console.log('Prerendering completed.');
