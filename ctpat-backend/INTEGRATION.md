# CTPAT Backend Integration Guide

Complete guide to integrate the React Native frontend with the Express.js backend.

## Overview of Changes

### Backend Improvements (Phase 1 Critical)

1. **JWT Authentication** - All API endpoints now require Bearer token authorization
2. **CORS Configuration** - Properly scoped to prevent unauthorized access
3. **File Size Validation** - PDFs limited to 50MB with proper error messages
4. **Rate Limiting** - 100 requests/15min general, 20 requests/15min for auth
5. **Backend PDF Upload** - PDFs sent to Supabase for centralized storage
6. **Email Service** - Backend SMTP integration for inspection report delivery
7. **Status Workflow** - Enforces valid inspection status transitions (draft → submitted → archived)
8. **Idempotency** - Prevents duplicate submissions with Idempotency-Key header
9. **Audit Trail** - Logs all inspection changes for compliance

### Frontend Improvements

1. **PDF Field Mapping** - All 18 inspection points now properly filled in PDF
2. **Signature File System** - Fixed to use current Expo FileSystem API
3. **Enhanced Error Handling** - Better error messages for debugging

---

## Backend API Endpoints

### Authentication

All endpoints require Bearer token in Authorization header:

```bash
Authorization: Bearer <your-token>
Idempotency-Key: <uuid> # Optional, prevents duplicate submissions
```

### 1. Create Inspection (POST /api/inspections)

**Request:**
```bash
curl -X POST http://localhost:3000/api/inspections \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "truckNumber": "TRUCK-001",
    "trailerNumber": "TRAILER-001",
    "sealNumber": "SEAL-123",
    "inspectionPoints": [
      {
        "id": 1,
        "title": "Bumper, Tires, Rims",
        "description": "Inspect truck bumper, tires, and rims",
        "checked": true
      },
      ...18 total items
    ],
    "verifiedByName": "John Smith",
    "verifiedBySignatureId": "sig_123456",
    "securityCheckboxChecked": true,
    "agriculturalPestCheckboxChecked": false,
    "date": "11/26/2025",
    "time": "14:30",
    "printName": "Jane Doe",
    "inspectorSignatureId": "sig_654321",
    "pdfData": "base64-encoded-pdf-data",
    "pdfFileName": "CTPAT_14:30_26/11/2025.pdf",
    "recipientEmail": "manager@company.com",
    "notes": "No issues found"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "inspectionId": "e4d9a5f2-3b1c-4a7d-8e9f-2c3b4a5d6e7f",
    "truckNumber": "TRUCK-001",
    "trailerNumber": "TRAILER-001",
    "completedAt": "2025-11-26T14:30:00.000Z",
    "pdfUrl": "https://your-project.supabase.co/storage/v1/object/public/ctpat-pdfs/2025/11/CTPAT_14:30_26-11-2025.pdf",
    "completionPercentage": 100,
    "status": "submitted"
  }
}
```

### 2. Get All Inspections (GET /api/inspections)

**Query Parameters:**
- `page` (default: 1) - Page number for pagination
- `limit` (default: 10, max: 100) - Items per page
- `status` (optional) - Filter by status: `draft`, `submitted`, `archived`
- `sortBy` (default: createdAt) - Sort field: `createdAt`, `completedAt`, `truckNumber`
- `sortOrder` (default: desc) - `asc` or `desc`

**Request:**
```bash
curl "http://localhost:3000/api/inspections?page=1&limit=20&status=submitted&sortBy=createdAt&sortOrder=desc" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "inspections": [...],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "pages": 8
    }
  }
}
```

### 3. Get Inspection by ID (GET /api/inspections/:id)

**Request:**
```bash
curl "http://localhost:3000/api/inspections/e4d9a5f2-3b1c-4a7d-8e9f-2c3b4a5d6e7f" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "inspectionId": "e4d9a5f2-3b1c-4a7d-8e9f-2c3b4a5d6e7f",
    "truckNumber": "TRUCK-001",
    "trailerNumber": "TRAILER-001",
    "status": "submitted",
    "completionPercentage": 100,
    "auditLog": [...],
    ...
  }
}
```

### 4. Update Inspection (PUT /api/inspections/:id)

Supports status transitions: `draft` → `submitted` → `archived`

**Request:**
```bash
curl -X PUT "http://localhost:3000/api/inspections/e4d9a5f2-3b1c-4a7d-8e9f-2c3b4a5d6e7f" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "status": "archived",
    "notes": "Archived after review"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "inspectionId": "e4d9a5f2-3b1c-4a7d-8e9f-2c3b4a5d6e7f",
    "status": "archived"
  }
}
```

### 5. Send Inspection Email (POST /api/inspections/:id/send-email)

Send inspection report via SMTP backend (not native mail)

**Request:**
```bash
curl -X POST "http://localhost:3000/api/inspections/e4d9a5f2-3b1c-4a7d-8e9f-2c3b4a5d6e7f/send-email" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "recipientEmail": "manager@company.com"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "messageId": "<message-id@smtp-server>",
    "recipient": "manager@company.com",
    "timestamp": "2025-11-26T14:30:00.000Z"
  }
}
```

### 6. Delete Inspection (DELETE /api/inspections/:id)

Deletes inspection and associated PDF from Supabase

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/inspections/e4d9a5f2-3b1c-4a7d-8e9f-2c3b4a5d6e7f" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Inspection e4d9a5f2-3b1c-4a7d-8e9f-2c3b4a5d6e7f deleted successfully"
}
```

### 7. Get Statistics (GET /api/inspections/stats/summary)

**Request:**
```bash
curl "http://localhost:3000/api/inspections/stats/summary" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 150,
    "thisMonth": 45,
    "thisWeek": 12
  }
}
```

---

## Frontend Integration Steps

### Step 1: Create API Service Module

Create `app/services/ApiService.ts`:

```typescript
import * as FileSystem from 'expo-file-system';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

class ApiService {
  private token: string | null = null;

  /**
   * Set authentication token
   */
  setToken(token: string): void {
    this.token = token;
    console.log('✓ API token set');
  }

  /**
   * Get authentication token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Make authenticated API request
   */
  private async request(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: any,
    options?: { idempotencyKey?: string }
  ): Promise<any> {
    if (!this.token) {
      throw new Error('Not authenticated. Please set token with setToken()');
    }

    const url = `${API_BASE_URL}${endpoint}`;
    const headers: any = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
    };

    if (options?.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || `API error: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API ${method} ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Create inspection with PDF
   */
  async createInspection(inspectionData: any, pdfPath?: string): Promise<any> {
    const payload: any = inspectionData;

    // Read PDF file if path provided
    if (pdfPath) {
      try {
        const base64Pdf = await FileSystem.readAsStringAsync(pdfPath, {
          encoding: FileSystem.EncodingType.Base64,
        });
        payload.pdfData = base64Pdf;
        payload.pdfFileName = `CTPAT_${Date.now()}.pdf`;
      } catch (error) {
        console.warn('Could not read PDF file:', error);
      }
    }

    return this.request('POST', '/api/inspections', payload, {
      idempotencyKey: inspectionData.idempotencyKey,
    });
  }

  /**
   * Get all inspections
   */
  async getInspections(filters?: any): Promise<any> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request('GET', `/api/inspections${query}`);
  }

  /**
   * Get inspection by ID
   */
  async getInspection(id: string): Promise<any> {
    return this.request('GET', `/api/inspections/${id}`);
  }

  /**
   * Update inspection
   */
  async updateInspection(id: string, updates: any): Promise<any> {
    return this.request('PUT', `/api/inspections/${id}`, updates);
  }

  /**
   * Delete inspection
   */
  async deleteInspection(id: string): Promise<any> {
    return this.request('DELETE', `/api/inspections/${id}`);
  }

  /**
   * Send inspection email
   */
  async sendInspectionEmail(id: string, recipientEmail: string): Promise<any> {
    return this.request('POST', `/api/inspections/${id}/send-email`, {
      recipientEmail,
    });
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<any> {
    return this.request('GET', '/api/inspections/stats/summary');
  }
}

export default new ApiService();
```

### Step 2: Update InspectionViewController

In `app/controllers/InspectionViewController.ts`:

```typescript
import ApiService from '../services/ApiService';

// At app startup, set the authentication token
export const initializeBackend = (token: string): void => {
  ApiService.setToken(token);
};

// Update submitInspection to use backend
export const submitInspection = async (
  inspectionData: any,
  pdfPath?: string
): Promise<string> => {
  try {
    const result = await ApiService.createInspection(inspectionData, pdfPath);
    
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to submit inspection');
    }

    console.log('✓ Inspection submitted:', result.data.inspectionId);
    return result.data.inspectionId;
  } catch (error) {
    console.error('Error submitting inspection:', error);
    throw error;
  }
};
```

### Step 3: Update InspectionView Component

In `app/views/InspectionView.tsx`:

```typescript
import ApiService from '../services/ApiService';

// In your submit handler:
const handleSubmitInspection = async () => {
  setIsSubmitting(true);
  try {
    // Generate PDF
    const pdfPath = await PdfService.generatePdfFromTemplate({
      inspectionPoints,
      formData,
      inspectorSignature,
      verifiedBySignature,
    });

    // Submit to backend API
    const result = await ApiService.createInspection({
      truckNumber: formData.truckNumber,
      trailerNumber: formData.trailerNumber,
      sealNumber: formData.sealNumber,
      inspectionPoints,
      verifiedByName: formData.verifiedByName,
      verifiedBySignatureId: verifiedBySignature?.id,
      securityCheckboxChecked: formData.securityCheckboxChecked,
      agriculturalPestCheckboxChecked: formData.agriculturalPestCheckboxChecked,
      date: formData.date,
      time: formData.time,
      printName: formData.printName,
      inspectorSignatureId: inspectorSignature?.id,
      recipientEmail: formData.recipientEmail,
      notes: formData.notes,
    }, pdfPath);

    // Optionally send email via backend
    if (formData.recipientEmail) {
      try {
        await ApiService.sendInspectionEmail(
          result.data.inspectionId,
          formData.recipientEmail
        );
        console.log('✓ Email sent via backend');
      } catch (error) {
        console.warn('Backend email failed, using native mail:', error);
        // Fallback to native mail
        await EmailService.sendInspectionReport(
          pdfPath,
          formData.recipientEmail,
          formData.truckNumber,
          formData.printName
        );
      }
    }

    Alert.alert(
      'Success',
      'Inspection submitted to backend and email sent!'
    );

    // Reset form
    setInspectionPoints(DEFAULT_INSPECTION_POINTS);
    setFormData(DEFAULT_FORM_DATA);
  } catch (error) {
    Alert.alert('Error', error.message || 'Failed to submit inspection');
    console.error(error);
  } finally {
    setIsSubmitting(false);
  }
};
```

### Step 4: Authentication Setup

Create token generation. For development:

```typescript
// app/utils/auth.ts
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_STORAGE_KEY = 'api_token';

export const generateDevToken = async (): Promise<string> => {
  // In development, use device ID as token
  const token = await Crypto.randomUUID();
  await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
  return token;
};

export const getStoredToken = async (): Promise<string | null> => {
  return await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
};

export const setToken = async (token: string): Promise<void> => {
  await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
};
```

In your app initialization:

```typescript
import { generateDevToken, getStoredToken } from './utils/auth';
import ApiService from './services/ApiService';

const initializeApp = async () => {
  let token = await getStoredToken();
  
  if (!token) {
    token = await generateDevToken();
  }

  ApiService.setToken(token);
  console.log('✓ App initialized with token:', token.substring(0, 8) + '...');
};

// Call on app startup in _layout.tsx or main component
useEffect(() => {
  initializeApp();
}, []);
```

### Step 5: Handle Offline Scenarios

For offline support, implement sync queue:

```typescript
// app/services/SyncService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from './ApiService';

const QUEUE_KEY = 'pending_inspections';

export const enqueuePendingInspection = async (data: any): Promise<void> => {
  const queue = JSON.parse(await AsyncStorage.getItem(QUEUE_KEY) || '[]');
  queue.push({
    ...data,
    queuedAt: new Date().toISOString(),
  });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  console.log(`Inspection queued (offline). Queue size: ${queue.length}`);
};

export const syncPendingInspections = async (): Promise<number> => {
  const queue = JSON.parse(await AsyncStorage.getItem(QUEUE_KEY) || '[]');
  
  if (queue.length === 0) return 0;

  let synced = 0;
  const failed = [];

  for (const inspection of queue) {
    try {
      await ApiService.createInspection(inspection);
      synced++;
      console.log(`✓ Synced inspection: ${inspection.truckNumber}`);
    } catch (error) {
      failed.push(inspection);
      console.error(`Failed to sync inspection:`, error);
    }
  }

  // Save failed items back to queue
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(failed));
  
  console.log(`Sync complete. Synced: ${synced}, Failed: ${failed.length}`);
  return synced;
};
```

---

## Environment Configuration

### Backend (.env)

```env
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@your-cluster.mongodb.net/ctpat-db

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_STORAGE_BUCKET=ctpat-pdfs

# CORS
CORS_ORIGIN=http://localhost:8081,http://127.0.0.1:8081

# Email (Optional)
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@ctpat-inspections.app

# Security
HTTPS_ENABLED=false
```

### Frontend (.env.local or app.json)

```json
{
  "expo": {
    "extra": {
      "API_URL": "http://localhost:3000"
    }
  }
}
```

Or in `.env.local`:
```env
EXPO_PUBLIC_API_URL=http://localhost:3000
```

---

## Error Handling

Backend returns consistent error format:

```json
{
  "success": false,
  "error": {
    "message": "Validation error: Truck number is required",
    "statusCode": 400,
    "stack": "..." // Development only
  }
}
```

Frontend should handle:
- 400: Validation errors
- 401: Authentication required
- 403: Insufficient permissions
- 404: Resource not found
- 429: Rate limit exceeded
- 500: Server error

---

## Security Best Practices

1. **Never hardcode tokens** - Generate via authentication endpoint
2. **Use HTTPS in production** - Set `HTTPS_ENABLED=true`
3. **Rotate CORS origins** - Update for production domains
4. **Monitor rate limits** - Watch for 429 responses
5. **Validate input** - Frontend validation + backend validation
6. **Encrypt signatures** - Use react-native-keychain for sensitive data
7. **Audit logs** - Monitor auditLog field in inspections

---

## Testing the Integration

### Local Testing Checklist

- [ ] Backend running: `npm run dev`
- [ ] Frontend connected with correct API_URL
- [ ] API token set in ApiService
- [ ] Create inspection → Backend receives data
- [ ] PDF uploaded to Supabase → Check storage bucket
- [ ] Email sent → Check inbox (or logs)
- [ ] Status transitions working
- [ ] Rate limiting tested → 429 at 100/15min
- [ ] Error handling → Bad data shows error
- [ ] Offline sync → Queue saves when offline

### Production Testing Checklist

- [ ] CORS properly scoped
- [ ] HTTPS enabled
- [ ] Rate limits appropriate for traffic
- [ ] MongoDB backup strategy configured
- [ ] Supabase bucket has backup plan
- [ ] Email service working
- [ ] Error monitoring (Sentry) configured
- [ ] Load testing completed
- [ ] Security audit passed

---

## Troubleshooting

### 401 Unauthorized
- Verify token is set: `ApiService.getToken()`
- Check token format in Authorization header
- Ensure token hasn't expired

### 400 Validation Error
- Check all required fields are provided
- Verify field formats (email, dates, etc.)
- Check PDF size < 50MB

### PDF Not Uploading
- Verify Supabase bucket is public
- Check file size limit
- Ensure base64 encoding is valid

### Email Not Sending
- Verify EMAIL_PROVIDER is set
- Check SMTP credentials
- Look for errors in backend logs
- Test with native mail fallback

### Network Timeout
- Check API_URL is correct
- Verify backend is running
- Check firewall rules
- Increase timeout in fetch options

---

## Next Steps

1. Test locally with development setup
2. Deploy backend to Render/Railway
3. Update CORS_ORIGIN to production domain
4. Configure production email service
5. Set up error monitoring (Sentry)
6. Implement offline sync for field users
7. Add biometric authentication (fingerprint/face)
8. Create admin dashboard for reviewing inspections

