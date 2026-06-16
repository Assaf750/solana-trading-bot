// rpc-client.mjs — apps/server wrapper for the Solana RPC provider (HTTP JSON-RPC + wallet activity
// stream). RPC calls + the streaming strategy are OWNED by @soltrade/provider-adapters (ADR-0001 Phase 2D);
// this module just injects the live mechanisms (gRPC ingestor factory, fetch, WebSocket) into the package
// provider. The RPC URL comes from the encrypted vault at call time and is never logged.
//
// The PROVIDER_BACKEND legacy in-process shim was removed in Phase 3B.4 (byte-identical parity proven).
// The pure stream helpers (isHeliusHost / buildWalletSubscriptions / parseStreamNotification) were removed
// in Phase Clean-1 — they were duplicate DEAD copies; the live copies are in @soltrade/provider-adapters
// (packages/provider-adapters/src/rpc.mjs, exported + tested there) and are what the runtime uses.
import { createGrpcIngestor } from '../../../../services/ingestor/src/grpc-ingestor.mjs';
import { createRpcProvider } from '../../../../packages/provider-adapters/src/index.mjs';

export function createRpcClient(args) {
  return createRpcProvider({
    grpcIngestorFactory: createGrpcIngestor,
    request: (u, o) => fetch(u, o),
    wsFactory: (u) => new WebSocket(u),
    ...args,
  });
}
