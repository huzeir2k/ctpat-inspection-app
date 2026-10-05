/**
 * In-memory stand-ins for MongoDB and file storage, so the workflow and API
 * can be tested without external services.
 */

const clone = (value) => structuredClone(value);

const matches = (doc, filter) =>
  Object.entries(filter).every(([key, expected]) => {
    if (expected && typeof expected === 'object' && '$gte' in expected) return doc[key] >= expected.$gte;
    return doc[key] === expected;
  });

/** Chainable query that mimics the few Mongoose methods the service uses. */
class FakeQuery {
  constructor(docs, hideSignatures) {
    this.docs = docs;
    this.hideSignatures = hideSignatures;
  }
  select() { return this; }
  sort() { this.docs = [...this.docs].sort((a, b) => b.createdAt - a.createdAt); return this; }
  skip(n) { this.docs = this.docs.slice(n); return this; }
  limit(n) { this.docs = this.docs.slice(0, n); return this; }
  lean() {
    const strip = ({ signatures, ...rest }) => rest;
    const result = this.docs.map((d) => (this.hideSignatures ? strip(clone(d)) : clone(d)));
    return Promise.resolve(this.single ? result[0] ?? null : result);
  }
}

const createFakeInspectionModel = () => {
  const store = [];
  let clock = Date.now();

  return {
    store,

    async create(data) {
      if (data.idempotencyKey && store.some((d) => d.createdBy === data.createdBy && d.idempotencyKey === data.idempotencyKey)) {
        throw Object.assign(new Error('duplicate key'), { code: 11000 });
      }
      clock += 1000;
      const doc = { ...clone(data), createdAt: new Date(clock), updatedAt: new Date(clock) };
      store.push(doc);
      return { toObject: () => clone(doc) };
    },

    findOne(filter) {
      const query = new FakeQuery(store.filter((d) => matches(d, filter)), true);
      query.single = true;
      return query;
    },

    find(filter) {
      return new FakeQuery(store.filter((d) => matches(d, filter)), true);
    },

    async countDocuments(filter = {}) {
      return store.filter((d) => matches(d, filter)).length;
    },

    async deleteOne(filter) {
      const index = store.findIndex((d) => matches(d, filter));
      if (index >= 0) store.splice(index, 1);
    },

    async updateOne(filter, update) {
      const doc = store.find((d) => matches(d, filter));
      if (doc && update.$push) {
        for (const [key, value] of Object.entries(update.$push)) doc[key].push({ ...value, at: new Date() });
      }
    },
  };
};

const createFakeStorage = () => {
  const files = new Map();
  return {
    files,
    failNextSave: false,
    async save(path, buffer) {
      if (this.failNextSave) throw new Error('storage down');
      files.set(path, buffer);
    },
    async read(path) {
      if (!files.has(path)) throw new Error('missing');
      return files.get(path);
    },
    async remove(path) {
      files.delete(path);
    },
  };
};

module.exports = { createFakeInspectionModel, createFakeStorage };
