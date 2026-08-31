# Implementing a KLM Module System for Compliance

### C.2 Field-level checkpoint encryption (KMS/Vault) — DEFER / document

Encryption at rest is the **storage module's** concern (`plugin-ai-core-backend-module-runtime-store`), not the engine's. Right move: define a pluggable `StateSerializer`/`EncryptionProvider` seam on `CheckpointStore` so an enterprise can supply KMS/Vault envelope encryption, ship an unencrypted default, and document the requirement. Do not build KMS integration into core — provider-specific, belongs behind the seam. Provide the *seam*, not the *implementation*.

## How an end user supplies their own KMS

They write a small module — same shape as the Grafana feature-flag example, zero core changes:

## The seam: a serializer on the `CheckpointStore` write path

The cleanest place to cut is *between* "the checkpoint as a typed object" and "the bytes that hit the database." That boundary is one interface:

```ts
// plugin-ai-core-node/src/@types/checkpoint.ts

/**
 * Transforms a checkpoint record to/from its persisted
 * representation. The default is pass-through JSON; an
 * enterprise supplies an encrypting implementation. The
 * engine and CheckpointStore logic are unaware of it.
 */
export interface StateSerializer {
  /**
   * Stable identifier, recorded on each row so mixed
   * plaintext/encrypted stores can be read back and
   * migrated.
   */
  readonly serializerId: string;
  /**
   * Called once per checkpoint before persistence. Must be
   * deterministic enough that the same record decrypts
   * identically.
   */
  serialize(record: CheckpointRecord): Promise<PersistedCheckpoint>;
  /** Inverse of serialize; called on every read. */
  deserialize(record: PersistedCheckpoint): Promise<CheckpointRecord>;
}

export type PersistedCheckpoint = {
  runId: string;
  seq: number;
  /**
   * Opaque payload — ciphertext when encrypted, JSON when
   * not.
   */
  payload: Uint8Array | string;
  /**
   * Which serializer produced this row; drives
   * deserialize().
   */
  serializerId: string;
  /**
   * Non-sensitive metadata kept queryable in plaintext
   * (never the state blob).
   */
  nextNode?: string;
  stateVersion: number;
  createdAt: string;
};
```

The crucial detail: __only the `state` blob gets encrypted.__ The routing metadata (`runId`, `seq`, `nextNode`, `stateVersion`, `createdAt`) stays in plaintext columns, because the engine needs `nextNode` to resume and ops needs `createdAt` for retention purges — and none of those are sensitive. The sensitive thing (the full workflow state: evidence, prompts, intermediate outputs) is the opaque `payload`. This is what "field-level" means in practice: encrypt the sensitive column, keep the operational columns readable.

## How it plugs in — extension point, same pattern as everything else

One new method on the existing `runtimeStoreExtensionPoint` (or a small dedicated one):

```ts
export interface RuntimeStoreExtensionPoint {
  setSessionStore(store: SessionStore): void;
  setCheckpointStore(store: CheckpointStore): void;
  setRunStore(store: RunStore): void;
  setArtifactSink(sink: ArtifactSink): void;
  setAuditLogSink(sink: AuditLogSink): void;
  /**
   * NEW: optional. Default is JsonStateSerializer (no
   * encryption).
   */
  setStateSerializer?(serializer: StateSerializer): void;
}
```

The runtime-store module composes it: `SqlCheckpointStore` writes whatever `serializer.serialize()` returns and reads via `deserialize()`. If no serializer is registered, it uses the built-in JSON pass-through. The engine, `GraphExecutor`, and `LangGraphCheckpointer` are completely untouched — they hand a `CheckpointRecord` down and get one back.

## How an end user supplies their own KMS

They write a small module — same shape as the Grafana feature-flag example, zero core changes:

## The end user's KMS module (post-refactor, zero core changes)

```ts
// @acme/plugin-ai-core-backend-module-kms-encryption  (their package, their repo)
import { createBackendModule, coreServices } from '@backstage/backend-plugin-api';
import {
  runtimeStoreExtensionPoint,
  type StateSerializer,
  type CheckpointRecord,
  type PersistedCheckpoint,
} from '@webstackbuilders/plugin-ai-core-node';
// wraps @aws-sdk/client-kms
import { KmsEnvelopeCipher } from './KmsEnvelopeCipher';

class KmsStateSerializer implements StateSerializer {
  readonly serializerId = 'kms-envelope-v1';

  constructor(private readonly cipher: KmsEnvelopeCipher) {}

  async serialize(record: CheckpointRecord): Promise<PersistedCheckpoint> {
    // Envelope encryption: generate a per-record data key,
    // encrypt the state blob locally with AES-256-GCM,
    // encrypt the data key with the KMS CMK, and pack {
    // encryptedDataKey, iv, authTag, ciphertext } into the
    // payload.
    const plaintext = new TextEncoder().encode(JSON.stringify(record.state));
    const payload = await this.cipher.encrypt(plaintext, {
      // KMS encryption context binds the ciphertext to its 
      // run — a ciphertext copied to another run's row
      // fails to decrypt.
      runId: record.runId,
      agentId: record.agentId,
    });
    return {
      runId: record.runId,
      seq: record.seq,
      payload,
      serializerId: this.serializerId,
      // stays plaintext — needed for resume
      nextNode: record.nextNode,
      stateVersion: record.stateVersion,
      // stays plaintext — needed for retention
      createdAt: record.createdAt,
    };
  }

  async deserialize(record: PersistedCheckpoint):
      Promise<CheckpointRecord> {
    const plaintext = await this.cipher.decrypt(
        record.payload, {
          runId: record.runId,
        }
    );
    return {
      ...record,
      state: JSON.parse(
          new TextDecoder().decode(plaintext)
      ),
    };
  }
}

export const kmsEncryptionModule = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'kms-state-serializer',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        stores: runtimeStoreExtensionPoint,
      },
      async init({ config, logger, stores }) {
        const keyArn = config.getString(
            'ai.encryption.kmsKeyArn'
        );
        // Fail boot, not first run — the same posture as
        // the rest of the refactor.
        const cipher = await KmsEnvelopeCipher.create(
            keyArn, logger
        ); // pings KMS at boot
        stores.setStateSerializer?.(
            new KmsStateSerializer(cipher)
        );
        logger.info('Checkpoint state encryption enabled via KMS envelope cipher');
      },
    });
  },
});
```

Their `app-config.yaml`:

```yaml
ai:
  encryption:
    kmsKeyArn: arn:aws:kms:us-east-1:123456789:key/abcd-...
```

And they add their package to `packages/backend/package.json` + one `backend.add(...)` line. No PR to us, no patched core — exactly the Datadog driver pattern.

## So: deferred, or possible after the refactor?

__Possible after the refactor — if we build the seam. It's three concrete pieces, none large:__

1. __The `StateSerializer` / `PersistedCheckpoint` types in core-node__ (~60 lines). This is the actual contract change.
2. __One extension point method__ (`setStateSerializer`) wired in `plugin.ts`, single-registration-guarded like the other stores (~15 lines).
3. __Composition inside `SqlCheckpointStore`__ in the runtime-store module: call `serialize()` on write, `deserialize()` on read, store `serializerId` in a new column, default to a JSON pass-through serializer when none is registered (~50 lines plus a migration for the column).

The one unavoidable caveat: because rows record `serializerId`, plaintext and encrypted checkpoints can coexist and a store can be *migrated* (re-encrypt lazily on read, or via a one-shot re-encrypt job the enterprise runs themselves). That's what makes this a seam rather than a flag day.

What we deliberately do __not__ ship: the `KmsEnvelopeCipher` itself, Vault integration, key rotation logic, or any cloud SDK dependency in our packages. Those are the enterprise's module to write (or a future `@webstackbuilders/plugin-ai-core-backend-module-encryption-aws-kms` companion package if you ever want a reference implementation — nice portfolio piece, but optional).

__Bottom line__: if we add items 1–3 to the refactor plan, the answer to "can an end user plug in their own KMS?" is *yes, on day one after the refactor, with zero core changes*. If we skip the seam, the answer is "not without forking the runtime-store module" — which is precisely the patched-core failure mode you asked to eliminate in the capability-category discussion. Given that, I'd promote C.2 from DEFER to __ADOPT the seam (items 1–3), DEFER the reference KMS implementation__ — the seam is ~125 lines and it closes a compliance-story hole that otherwise has no workaround.

## 