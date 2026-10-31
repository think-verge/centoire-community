import { EventEmitter } from "node:events";
import {
  AckPolicy,
  connect,
  JSONCodec,
  RetentionPolicy,
  StorageType,
  type NatsConnection,
} from "nats";

export const EVENT_STREAM = "CENTOIRE_EVENTS";
export const EVENT_SUBJECT_PREFIX = "events.";

export interface OnOptions {
  /** Durable consumer name; defaults to <service>-<event>. Survives restarts and replays missed events. */
  durable?: string;
}

export interface Bus<M extends object = Record<string, unknown>> {
  readonly mode: "nats" | "local";
  readonly connection?: NatsConnection;
  emit<K extends keyof M & string>(event: K, payload: M[K]): void;
  on<K extends keyof M & string>(event: K, handler: (payload: M[K]) => void | Promise<void>, opts?: OnOptions): Promise<void>;
  /** Core-NATS (non-durable) publish/subscribe for control messages. No-op in local mode. */
  publishRaw(subject: string, payload: unknown): void;
  subscribeRaw(subject: string, handler: (payload: unknown) => void): void;
  close(): Promise<void>;
}

const jc = JSONCodec();

/** In-process bus used when no NATS_URL is configured (single-process dev, tests). */
function createLocalBus<M extends object>(): Bus<M> {
  const ee = new EventEmitter();
  return {
    mode: "local",
    emit: (event, payload) => void ee.emit(event, payload),
    on: async (event, handler) => void ee.on(event, (p) => void Promise.resolve(handler(p as never)).catch(logHandlerError(event))),
    publishRaw: () => {},
    subscribeRaw: () => {},
    close: async () => void ee.removeAllListeners(),
  };
}

function logHandlerError(event: string) {
  return (err: unknown) => console.error(`[bus] handler for ${event} failed`, err);
}

export async function createBus<M extends object = Record<string, unknown>>(opts: {
  service: string;
  url?: string;
}): Promise<Bus<M>> {
  if (!opts.url) return createLocalBus<M>();

  const nc = await connect({ servers: opts.url, name: opts.service, maxReconnectAttempts: -1 });
  const jsm = await nc.jetstreamManager();
  const streamCfg = {
    name: EVENT_STREAM,
    subjects: [`${EVENT_SUBJECT_PREFIX}>`],
    retention: RetentionPolicy.Limits,
    storage: StorageType.File,
    max_age: 7 * 24 * 60 * 60 * 1e9,
  };
  try {
    await jsm.streams.add(streamCfg);
  } catch {
    await jsm.streams.update(EVENT_STREAM, streamCfg).catch(() => {});
  }
  const js = nc.jetstream();

  return {
    mode: "nats",
    connection: nc,
    emit(event, payload) {
      js.publish(`${EVENT_SUBJECT_PREFIX}${event}`, jc.encode(payload)).catch((err) =>
        console.error(`[bus] publish ${event} failed`, err),
      );
    },
    async on(event, handler, o) {
      const durable = o?.durable ?? `${opts.service}-${event.replace(/\./g, "-")}`;
      try {
        await jsm.consumers.add(EVENT_STREAM, {
          durable_name: durable,
          ack_policy: AckPolicy.Explicit,
          filter_subject: `${EVENT_SUBJECT_PREFIX}${event}`,
        });
      } catch {
        // already exists
      }
      const consumer = await js.consumers.get(EVENT_STREAM, durable);
      const messages = await consumer.consume();
      void (async () => {
        for await (const m of messages) {
          try {
            await handler(jc.decode(m.data) as never);
            m.ack();
          } catch (err) {
            logHandlerError(event)(err);
            m.nak(5000);
          }
        }
      })();
    },
    publishRaw: (subject, payload) => nc.publish(subject, jc.encode(payload)),
    subscribeRaw(subject, handler) {
      const sub = nc.subscribe(subject);
      void (async () => {
        for await (const m of sub) {
          try {
            handler(jc.decode(m.data));
          } catch (err) {
            console.error(`[bus] bad message on ${subject}`, err);
          }
        }
      })();
    },
    async close() {
      await nc.drain();
    },
  };
}
