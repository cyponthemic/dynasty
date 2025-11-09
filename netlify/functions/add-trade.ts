// netlify/functions/add-trade.ts
import { getStore } from '@netlify/blobs';
import type { Trade } from '../../src/types/state';
import type { BlobState } from '../../src/types/blobState';
import { validateNoDuplicatePicks } from '../../src/lib/tradeValidation';

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const store = getStore('dynasty-picks');

  const body = await req.json(); // { fromTeamId, toTeamId, picks, notes }

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

  const picks = body.picks ?? [];

  // Validate no duplicate picks
  const duplicateValidation = validateNoDuplicatePicks(picks);
  if (!duplicateValidation.ok) {
    return new Response(
      JSON.stringify({ error: duplicateValidation.error }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const newTrade: Trade = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    fromTeamId: body.fromTeamId,
    toTeamId: body.toTeamId,
    picks,
    notes: body.notes ?? ''
  };

  // TODO: plug in Sapiens rule validation here, e.g.:
  // const validation = validateSapiensRule(initialState, blob.trades, newTrade);
  // if (!validation.ok) {
  //   return new Response(
  //     JSON.stringify({ error: validation.message }),
  //     { status: 400 }
  //   );
  // }

  const nextBlob: BlobState = {
    trades: [...blob.trades, newTrade]
  };

  await store.set('state', JSON.stringify(nextBlob));

  return new Response(JSON.stringify({ ok: true, trade: newTrade }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
};

