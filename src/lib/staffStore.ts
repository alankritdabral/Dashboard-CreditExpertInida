import { randomBytes } from "crypto";
import { backendRequest } from "./cibil/backendApi";

/**
 * Staff-side data (dashboard logins, system logs, WhatsApp message logs) lives in the backend's
 * RDS database; it used to be Firestore. RDS is private to the backend's network, so this module
 * is a small stand-in for the Firestore Admin API that talks to the backend's
 * `/internal/staff-data` routes. Only the calls this app makes are supported:
 *
 *   adminDb.collection(c).where(f, "==" | ">=" | "<=", v).orderBy(f, dir).limit(n).get()
 *   adminDb.collection(c).add(data) / .doc(id).get() / .set() / .update() / .delete()
 *   adminDb.batch().update(ref, data).commit()
 *
 * Documents keep their Firestore shape (a JSON object under collection + id).
 */

const BASE = "/internal/staff-data";

type Op = "==" | ">=" | "<=";
type Filter = { field: string; op: Op; value: string | number | boolean };
interface StoredDoc {
  id: string;
  data: Record<string, any>;
  version: number;
}

const enc = encodeURIComponent;

class DocSnapshot {
  readonly exists = true;
  constructor(
    readonly id: string,
    private readonly body: Record<string, any>,
    readonly ref: DocRef
  ) {}
  data() {
    return this.body;
  }
}

class QuerySnapshot {
  readonly docs: DocSnapshot[];
  constructor(docs: DocSnapshot[]) {
    this.docs = docs;
  }
  get empty() {
    return this.docs.length === 0;
  }
  get size() {
    return this.docs.length;
  }
}

class DocRef {
  constructor(
    readonly collectionName: string,
    readonly id: string
  ) {}

  async get(): Promise<DocSnapshot | { exists: false; id: string; data(): undefined }> {
    try {
      const row = await backendRequest<StoredDoc>("GET", `/${enc(this.collectionName)}/${enc(this.id)}`, { basePath: BASE });
      return new DocSnapshot(row.id, row.data, this);
    } catch (err: any) {
      if (err?.status === 404) return { exists: false, id: this.id, data: () => undefined };
      throw err;
    }
  }

  async set(data: Record<string, any>): Promise<void> {
    await backendRequest("PUT", `/${enc(this.collectionName)}/${enc(this.id)}`, { basePath: BASE, body: { data: clean(data) } });
  }

  /** Merges top-level fields into an existing document; fails when it does not exist (as Firestore does). */
  async update(updates: Record<string, any>): Promise<void> {
    const snap = await this.get();
    if (!snap.exists) throw new Error(`NOT_FOUND: ${this.collectionName}/${this.id}`);
    await this.set({ ...(snap.data() as Record<string, any>), ...updates });
  }

  async delete(): Promise<void> {
    await backendRequest("DELETE", `/${enc(this.collectionName)}/${enc(this.id)}`, { basePath: BASE });
  }
}

class Query {
  constructor(
    protected readonly collectionName: string,
    private readonly filters: Filter[] = [],
    private readonly order?: { field: string; dir: "asc" | "desc" },
    private readonly max?: number
  ) {}

  where(field: string, op: string, value: string | number | boolean): Query {
    if (op !== "==" && op !== ">=" && op !== "<=") throw new Error(`Unsupported filter operator "${op}".`);
    return new Query(this.collectionName, [...this.filters, { field, op, value }], this.order, this.max);
  }

  orderBy(field: string, dir: "asc" | "desc" = "asc"): Query {
    return new Query(this.collectionName, this.filters, { field, dir }, this.max);
  }

  limit(n: number): Query {
    return new Query(this.collectionName, this.filters, this.order, n);
  }

  async get(): Promise<QuerySnapshot> {
    const { docs } = await backendRequest<{ docs: StoredDoc[] }>("GET", `/${enc(this.collectionName)}`, {
      basePath: BASE,
      query: {
        filters: this.filters.length ? JSON.stringify(this.filters) : undefined,
        orderField: this.order?.field,
        orderDir: this.order?.dir,
        limit: this.max,
      },
    });
    return new QuerySnapshot(docs.map((d) => new DocSnapshot(d.id, d.data, new DocRef(this.collectionName, d.id))));
  }
}

class CollectionRef extends Query {
  doc(id: string): DocRef {
    return new DocRef(this.collectionName, id);
  }

  /** Adds a document under a new random ID (20 URL-safe characters, like Firestore's). */
  async add(data: Record<string, any>): Promise<DocRef> {
    const ref = new DocRef(this.collectionName, randomBytes(15).toString("base64url"));
    await ref.set(data);
    return ref;
  }
}

class Batch {
  private readonly jobs: Array<() => Promise<void>> = [];
  update(ref: DocRef, data: Record<string, any>) {
    this.jobs.push(() => ref.update(data));
    return this;
  }
  set(ref: DocRef, data: Record<string, any>) {
    this.jobs.push(() => ref.set(data));
    return this;
  }
  delete(ref: DocRef) {
    this.jobs.push(() => ref.delete());
    return this;
  }
  async commit(): Promise<void> {
    for (const job of this.jobs) await job();
  }
}

/** Firestore rejects undefined values and the backend stores JSON; a JSON round trip drops them. */
function clean<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

export const adminDb = {
  collection: (name: string) => new CollectionRef(name),
  batch: () => new Batch(),
};
