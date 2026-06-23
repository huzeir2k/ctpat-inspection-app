const { createClient } = require('@supabase/supabase-js');

/**
 * Initialize Supabase client for file storage
 * Falls back gracefully if credentials are missing
 */
let supabase = null;

if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  console.log('✓ Supabase initialized');
} else {
  console.warn('⚠️  Supabase credentials not configured. File uploads will be disabled.');
}

/**
 * Upload PDF file to Supabase Storage
 * @param {string} fileName - Name of the file
 * @param {Buffer} fileData - File content as buffer
 * @returns {Promise<{publicUrl: string, path: string}>}
 */
const uploadPDFToStorage = async (fileName, fileData) => {
  if (!supabase) {
    console.warn('⚠️  Supabase not configured. Returning mock response.');
    return {
      path: `inspections/${fileName}`,
      publicUrl: `http://localhost:3000/uploads/${fileName}`,
    };
  }

  try {
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET;
    const filePath = `inspections/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${fileName}`;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, fileData, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (error) {
      throw new Error(`Supabase upload error: ${error.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return {
      path: filePath,
      publicUrl: publicUrlData.publicUrl,
    };
  } catch (error) {
    console.error('Error uploading PDF to Supabase:', error);
    throw error;
  }
};

/**
 * Delete PDF file from Supabase Storage
 * @param {string} filePath - Path of the file to delete
 * @returns {Promise<void>}
 */
const deletePDFFromStorage = async (filePath) => {
  if (!supabase) {
    console.warn('⚠️  Supabase not configured. Skipping delete.');
    return;
  }

  try {
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET;

    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (error) {
      throw new Error(`Supabase delete error: ${error.message}`);
    }

    console.log(`✓ Deleted PDF: ${filePath}`);
  } catch (error) {
    console.error('Error deleting PDF from Supabase:', error);
    throw error;
  }
};

module.exports = {
  supabase,
  uploadPDFToStorage,
  deletePDFFromStorage,
};
