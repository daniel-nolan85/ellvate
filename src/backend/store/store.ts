import { createSeedState } from './seed';
import type { StoreState } from './types';

// WHY: Expo API routes are bundled per-route; a plain module-level `let` gets a
// fresh copy in every route bundle, so mutations made by one route are invisible
// to the next request. Anchoring the singleton on globalThis keeps a single
// shared instance across route bundles within one server process (dev server and
// single-process `expo serve`). Request-isolated serverless workers (EAS Hosting)
// still require a real datastore — see docs for the swap path.
interface StoreHolder {
  state: StoreState;
}

const globalRef = globalThis as typeof globalThis & {
  __llvStoreHolder?: StoreHolder;
};

const holder: StoreHolder =
  globalRef.__llvStoreHolder ?? { state: createSeedState() };

globalRef.__llvStoreHolder = holder;

export function getState(): StoreState {
  return holder.state;
}

export function setState(
  update: (current: StoreState) => StoreState,
): StoreState {
  holder.state = update(holder.state);
  return holder.state;
}

export function resetStore(): void {
  holder.state = createSeedState();
}
