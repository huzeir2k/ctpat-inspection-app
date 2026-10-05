/**
 * Stores finished inspection PDFs.
 *
 * Production uses a PRIVATE Supabase Storage bucket, accessed with the
 * server-only service role key. PDFs are never exposed through public URLs;
 * they are only returned by the authenticated, owner-checked API.
 *
 * Without Supabase configured (local development only) PDFs are written to
 * ./.local-storage instead.
 */

const fs = require('fs/promises');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const PDF_CONTENT_TYPE = 'application/pdf';

class SupabaseStorage {
  constructor({ url, serviceRoleKey, bucket }) {
    this.bucket = bucket;
    this.client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  }

  async save(storagePath, buffer) {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(storagePath, buffer, { contentType: PDF_CONTENT_TYPE, upsert: false });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
  }

  async read(storagePath) {
    const { data, error } = await this.client.storage.from(this.bucket).download(storagePath);
    if (error) throw new Error(`Storage download failed: ${error.message}`);
    return Buffer.from(await data.arrayBuffer());
  }

  async remove(storagePath) {
    const { error } = await this.client.storage.from(this.bucket).remove([storagePath]);
    if (error) throw new Error(`Storage delete failed: ${error.message}`);
  }
}

class LocalDiskStorage {
  constructor(rootDir) {
    this.rootDir = rootDir;
  }

  resolve(storagePath) {
    const resolved = path.resolve(this.rootDir, storagePath);
    if (!resolved.startsWith(this.rootDir + path.sep)) {
      throw new Error('Invalid storage path');
    }
    return resolved;
  }

  async save(storagePath, buffer) {
    const target = this.resolve(storagePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer, { flag: 'wx' });
  }

  read(storagePath) {
    return fs.readFile(this.resolve(storagePath));
  }

  async remove(storagePath) {
    await fs.rm(this.resolve(storagePath), { force: true });
  }
}

const createStorage = (env = process.env) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET } = env;

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && SUPABASE_STORAGE_BUCKET) {
    return new SupabaseStorage({
      url: SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      bucket: SUPABASE_STORAGE_BUCKET,
    });
  }
  if (env.NODE_ENV === 'production') {
    throw new Error('Supabase storage is not configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET)');
  }

  console.warn('⚠️  Supabase storage not configured - saving PDFs to ./.local-storage (development only)');
  return new LocalDiskStorage(path.resolve(__dirname, '../../.local-storage'));
};

module.exports = { createStorage, LocalDiskStorage };
