# CTPAT Inspection Backend API

Express.js backend server for the CTPAT Inspection and Signoff mobile app.

## Features

- **REST API** for inspection CRUD operations
- **MongoDB** for data persistence
- **Supabase Storage** for PDF file management
- **Input validation** with Joi schema validation
- **Error handling** with custom error middleware
- **CORS** configured for React Native mobile app

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js 4.18
- **Database:** MongoDB (Atlas free tier)
- **File Storage:** Supabase Storage
- **Validation:** Joi
- **Security:** Helmet, CORS

## Prerequisites

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **MongoDB Atlas Account** - [Create Free Cluster](https://www.mongodb.com/cloud/atlas)
3. **Supabase Project** - [Create Free Project](https://supabase.com/)
4. **Git** - For cloning/version control

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Navigate to backend folder
cd ctpat-backend

# Install dependencies
npm install
```

### 2. Configure Environment Variables

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your credentials
nano .env  # or use your favorite editor
```

**Required `.env` variables:**

```env
# Server
PORT=3000
NODE_ENV=development

# MongoDB Atlas
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@your-cluster.mongodb.net/ctpat-inspections?retryWrites=true&w=majority

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_STORAGE_BUCKET=ctpat-pdfs

# CORS
CORS_ORIGIN=*
```

### 3. Set Up MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free M0 cluster
3. Create a database user with username/password
4. Whitelist your IP (or use 0.0.0.0 for development)
5. Copy connection string from MongoDB Atlas (format: `mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@your-cluster.mongodb.net/database?retryWrites=true&w=majority`)
6. Paste in `.env` as `MONGODB_URI`

### 4. Set Up Supabase

1. Go to [Supabase](https://supabase.com/)
2. Create a new project (free tier)
3. Go to **Storage** → Create a new bucket named `ctpat-pdfs`
4. Set bucket to **Public** for file sharing
5. Copy project URL and anon key from **Settings** → **API**
6. Paste in `.env` as `SUPABASE_URL` and `SUPABASE_ANON_KEY`

### 5. Start Development Server

```bash
# Using nodemon (watches for changes)
npm run dev

# Or production start
npm start
```

Server will run at `http://localhost:3000`

## API Endpoints

### Base URL
```
http://localhost:3000/api
```

### Health Check
```
GET /health
```

### Inspections

#### Create Inspection
```
POST /inspections
Content-Type: application/json

{
  "truckNumber": "TRUCK123",
  "trailerNumber": "TRAILER456",
  "sealNumber": "SEAL789",
  "inspectionPoints": [
    {"id": 1, "title": "Item 1", "description": "Desc", "checked": true},
    ...
  ],
  "verifiedByName": "John Doe",
  "date": "11/22/2025",
  "time": "10:30 AM",
  "printName": "Jane Smith",
  "pdfData": "base64-encoded-pdf",
  "pdfFileName": "CTPAT_10:30_22/11/2025.pdf",
  "recipientEmail": "email@example.com"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "inspectionId": "uuid-string",
    "truckNumber": "TRUCK123",
    "trailerNumber": "TRAILER456",
    "completedAt": "2025-11-22T10:30:00.000Z",
    "pdfUrl": "https://supabase-url/...",
    "completionPercentage": 85
  }
}
```

#### List Inspections
```
GET /inspections?page=1&limit=10&status=submitted&sortBy=createdAt&sortOrder=desc
```

**Response:**
```json
{
  "success": true,
  "data": {
    "inspections": [...],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 10,
      "pages": 5
    }
  }
}
```

#### Get Inspection
```
GET /inspections/:inspectionId
```

**Response:**
```json
{
  "success": true,
  "data": { ...inspection object... }
}
```

#### Update Inspection
```
PUT /inspections/:inspectionId
Content-Type: application/json

{ ...same as create... }
```

#### Delete Inspection
```
DELETE /inspections/:inspectionId
```

**Response:**
```json
{
  "success": true,
  "message": "Inspection inspectionId deleted successfully"
}
```

#### Get Statistics
```
GET /inspections/stats/summary
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 42,
    "thisMonth": 12,
    "thisWeek": 3
  }
}
```

## Error Handling

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "statusCode": 400
  }
}
```

**Common Status Codes:**
- `400` - Validation error
- `404` - Inspection not found
- `500` - Server error

## Development

### File Structure

```
ctpat-backend/
├── src/
│   ├── config/
│   │   ├── database.js      # MongoDB connection
│   │   └── supabase.js      # Supabase client
│   ├── middleware/
│   │   ├── cors.js          # CORS configuration
│   │   └── errorHandler.js  # Error handling
│   ├── models/
│   │   └── Inspection.js    # MongoDB schema
│   ├── routes/
│   │   └── inspections.js   # API endpoints
│   ├── utils/
│   │   └── validators.js    # Joi schemas
│   └── index.js             # Server entry point
├── .env.example             # Environment template
├── package.json
└── README.md
```

### Running Tests

```bash
npm test
```

Currently no tests configured. To add:
1. Install Jest: `npm install --save-dev jest`
2. Create test files in `tests/` directory
3. Update package.json scripts

## Deployment

### Option 1: Render (Recommended)

1. Push code to GitHub
2. Connect GitHub repo to Render
3. Set environment variables in Render dashboard
4. Deploy automatically on push

### Option 2: Railway

1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Create project: `railway init`
4. Set environment variables: `railway variable add`
5. Deploy: `railway up`

### Option 3: Local Testing with Ngrok

```bash
# Install ngrok
npm install -g ngrok

# In one terminal, start server
npm run dev

# In another terminal, expose to internet
ngrok http 3000

# Use the ngrok URL in your React Native app
```

## Environment Variables for Production

```env
NODE_ENV=production
PORT=3000
MONGODB_URI=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_STORAGE_BUCKET=ctpat-pdfs
CORS_ORIGIN=https://your-app-domain.com
```

## Troubleshooting

### MongoDB Connection Error
- Verify IP whitelist in MongoDB Atlas
- Check connection string in `.env`
- Ensure database user exists and password is correct

### Supabase Upload Error
- Verify bucket exists and is public
- Check Supabase credentials in `.env`
- Verify base64 PDF data is valid

### CORS Errors
- Check `CORS_ORIGIN` environment variable
- Ensure Origin header matches allowed domains

## License

MIT

## Contact

Created by Huzeir Kurpejovic for CTPAT Inspection App
