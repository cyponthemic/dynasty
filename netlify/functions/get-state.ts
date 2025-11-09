// netlify/functions/get-state.ts
import { getStore } from '@netlify/blobs';
import { initialState } from '../../src/data/initialState';
import type { State, Trade } from '../../src/types/state';
import type { BlobState } from '../../src/types/blobState';

export default async () => {
  const store = getStore('dynasty-picks');

  const data = await store.get('state');
  let blob: BlobState | null = null;

  if (data) {
    if (typeof data === 'string') {
      blob = JSON.parse(data) as BlobState;
    } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      blob = JSON.parse(new TextDecoder().decode(data)) as BlobState;
    }
  }

  const trades: Trade[] = blob?.trades ?? [];

  const fullState: State = {
    teams: initialState.teams,
    basePicks: initialState.basePicks,
    trades
  };

  return new Response(JSON.stringify(fullState), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
};

