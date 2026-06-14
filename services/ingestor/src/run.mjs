// run.mjs — standalone runner: stream leader activity from a Yellowstone gRPC endpoint.
// Env: GRPC_ENDPOINT (required), GRPC_TOKEN (optional), LEADER_ADDRESSES (comma-separated, required).
// This is the seam: in production apps/server can spawn/consume this, or import createGrpcIngestor
// directly behind its subscribeWallets interface.
import { createGrpcIngestor } from './grpc-ingestor.mjs';

const endpoint = process.env.GRPC_ENDPOINT;
const token = process.env.GRPC_TOKEN || undefined;
const addresses = (process.env.LEADER_ADDRESSES || '').split(',').map((s) => s.trim()).filter(Boolean);

if (!endpoint || addresses.length === 0) {
  console.error('ingestor: set GRPC_ENDPOINT and LEADER_ADDRESSES (comma-separated)');
  process.exit(1);
}

createGrpcIngestor({
  endpoint,
  token,
  addresses,
  onLeaderActivity: ({ signature }) => console.log('leader_activity', signature),
  onUp: ({ provider }) => console.log('stream_up', provider),
  onGap: () => console.warn('stream_gap'),
});
console.log(`ingestor: subscribing to ${addresses.length} leader(s) via ${endpoint}`);
