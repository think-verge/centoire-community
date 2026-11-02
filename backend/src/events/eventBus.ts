import { EventEmitter } from "node:events";
import { createBus, type Bus } from "@centoire/bahamut";
import type { DomainEvent, DomainEventPayloads } from "@centoire/contracts";
import { enrichEvent } from "./enrich.js";

export type { DomainEvent, DomainEventPayloads };

// Emitters/subscribers keep the same emit/on calls and payload shapes. Events always
// go to in-process listeners; when NATS is configured they are also published
// (enriched with snapshots) to the shared JetStream stream for other services.
export const eventBus = new EventEmitter();

let remote: Bus<DomainEventPayloads> | undefined;

export async function initEventBus(service: string, natsUrl?: string): Promise<Bus<DomainEventPayloads> | undefined> {
  if (!natsUrl) return undefined;
  remote = await createBus<DomainEventPayloads>({ service, url: natsUrl });
  return remote;
}

export function emitDomainEvent<T extends DomainEvent>(event: T, payload: DomainEventPayloads[T]): void {
  eventBus.emit(event, payload);
  const bus = remote;
  if (!bus) return;
  enrichEvent(event, payload)
    .then((enriched) => bus.emit(event, enriched))
    .catch((err) => {
      console.error(`[events] failed to publish ${event}`, err);
    });
}

export function onDomainEvent<T extends DomainEvent>(
  event: T,
  handler: (payload: DomainEventPayloads[T]) => void,
): void {
  eventBus.on(event, handler);
}
