// netlify/functions/hello.ts
export default async () => {
  return new Response(JSON.stringify({ message: 'Hello from Netlify!' }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

