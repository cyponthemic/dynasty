// netlify/functions/delete-trade.ts
import { getStore } from '@netlify/blobs';
import type { BlobState } from '../../src/types/blobState';

export default async (req: Request) => {
  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const store = getStore('dynasty-picks');

  const body = await req.json(); // { tradeId }
  const { tradeId } = body;

  if (!tradeId) {
    return new Response(JSON.stringify({ error: 'tradeId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const data = await store.get('state');
  let blob: BlobState;
  
  if (data) {
    if (typeof data === 'string') {
      blob = JSON.parse(data) as BlobState;
    } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      blob = JSON.parse(new TextDecoder().decode(data)) as BlobState;
    } else {
      blob = { trades: [] };
    }
  } else {
    blob = { trades: [] };
  }

  const tradeIndex = blob.trades.findIndex((t) => t.id === tradeId);
  
  if (tradeIndex === -1) {
    return new Response(JSON.stringify({ error: 'Trade not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const nextBlob: BlobState = {
    trades: blob.trades.filter((t) => t.id !== tradeId),
  };

  await store.set('state', JSON.stringify(nextBlob));

  return new Response(JSON.stringify({ ok: true, deletedTradeId: tradeId }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
};

