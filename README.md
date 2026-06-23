# CTPAT Inspection App

A comprehensive mobile application for conducting and managing CTPAT (Customs-Trade Partnership Against Terrorism) security inspections. Built with React Native and Expo, this full-stack solution provides field inspectors with powerful tools for documentation, digital signatures, and real-time reporting.

## Overview

The CTPAT Inspection App streamlines the inspection workflow with a modern, user-friendly mobile interface coupled with a robust backend API. The application supports offline functionality, secure data handling, and seamless synchronization with cloud-based systems.

## Project Structure

```
ctpat-inspection/          # React Native mobile application
├── app/                   # Expo Router-based navigation and views
├── services/              # Core business logic (API, Auth, Email, PDF)
├── components/            # Reusable UI components
├── models/                # Data models and type definitions
├── nodejs/                # Embedded Node.js backend for offline support
└── assets/                # Images and resources

ctpat-backend/             # Express.js REST API server
├── src/
│   ├── routes/            # API endpoints
│   ├── services/          # Business logic (Email, PDF processing)
│   ├── models/            # Database schemas
│   ├── middleware/        # Auth, CORS, rate limiting
│   ├── config/            # Database and service configuration
│   └── utils/             # Validators and helpers
└── nodejs/                # Embedded server variant
```

## Key Features

### Mobile Application (React Native)
- **Inspection Management**: Create, update, and track inspection records
- **Digital Signatures**: Capture and store digital signatures with timestamp verification
- **Offline Support**: Full offline capability with local data storage and sync-on-reconnect
- **PDF Generation**: Generate inspection reports with embedded signatures and data
- **Secure Authentication**: JWT-based authentication with secure credential storage
- **Email Integration**: Queue and send inspection reports via email
- **History & Records**: View and manage past inspections with comprehensive filtering
- **Settings & Configuration**: Manage app settings and backend configurations

### Backend API (Express.js)
- **RESTful Endpoints**: Comprehensive API for inspection data management
- **Authentication & Authorization**: Secure JWT-based access control
- **Database Integration**: MongoDB support for persistent data storage
- **Cloud Integration**: Supabase for additional data management
- **Rate Limiting**: Protection against abuse with configurable rate limits
- **Email Services**: Automated email delivery for reports and notifications
- **PDF Processing**: Server-side PDF generation and document filling
- **Error Handling**: Centralized error handling with logging capabilities
- **CORS Support**: Cross-origin resource sharing for flexible client access

## Technology Stack

### Frontend
- **React Native** & **Expo** - Cross-platform mobile development
- **TypeScript** - Type-safe development
- **Expo Router** - File-based routing and navigation
- **AsyncStorage** - Local data persistence
- **Expo Print** - PDF printing capabilities

### Backend
- **Node.js** & **Express.js** - REST API server
- **MongoDB** - Primary database
- **Supabase** - Cloud database and authentication
- **JWT** - Secure token-based authentication
- **Nodemailer** - Email delivery

### Development Tools
- **ESLint** - Code quality and consistency
- **Babel** - JavaScript transpilation
- **Metro** - React Native bundler
- **TypeScript** - Type checking

## Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- Expo CLI
- Git

### Installation

#### Mobile App
```bash
cd ctpat-inspection
npm install
npm start
```

To run on specific platforms:
```bash
npm run android    # Android emulator
npm run ios        # iOS simulator
npm run web        # Web browser
```

#### Backend Server
```bash
cd ctpat-backend
npm install
npm run dev        # Development mode with auto-reload
npm start          # Production mode
```

## Configuration

### Environment Variables

Create a `.env` file in the backend root with:
```
DATABASE_URL=<mongodb-connection-string>
SUPABASE_URL=<supabase-project-url>
SUPABASE_KEY=<supabase-api-key>
JWT_SECRET=<jwt-signing-secret>
EMAIL_SERVICE=<email-provider-config>
```

For the mobile app, create `expo-env.d.ts` with necessary API endpoints and configuration.

## API Documentation

### Core Endpoints

**Inspections**
- `GET /api/inspections` - Retrieve all inspections
- `POST /api/inspections` - Create new inspection
- `GET /api/inspections/:id` - Get specific inspection
- `PUT /api/inspections/:id` - Update inspection
- `DELETE /api/inspections/:id` - Delete inspection

**Authentication**
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh authentication token

**Reports**
- `POST /api/reports/generate` - Generate inspection report
- `POST /api/reports/email` - Email inspection report
- `GET /api/reports/:id` - Download report

Additional endpoints available for email queue management, PDF operations, and credential management.

## Security Features

- **JWT Authentication**: Stateless token-based security
- **Encrypted Storage**: Sensitive data encrypted locally on device
- **Password Hashing**: bcrypt for secure password storage
- **Rate Limiting**: Request rate limiting to prevent abuse
- **CORS Protection**: Restricted cross-origin access
- **Input Validation**: Joi-based schema validation
- **Error Handling**: Safe error messages without exposing internals

## Offline Functionality

The app includes an embedded Node.js backend (`ctpat-inspection/nodejs/`) that enables:
- Local inspection creation and editing
- Signature capture and storage
- PDF generation
- Automatic synchronization when connectivity is restored

## Development Guidelines

### Code Style
- Follow ESLint configuration for consistent formatting
- Use TypeScript for type safety in the mobile app
- Implement error boundaries for graceful error handling

### Testing
- Unit tests for critical business logic
- Integration tests for API endpoints
- Manual testing on physical devices recommended

### Deployment

**Mobile App**
- Use Expo for building and publishing
- Refer to [eas.json](ctpat-inspection/eas.json) for build configuration

**Backend**
- Docker support available ([Dockerfile](ctpat-backend/Dockerfile))
- Deployable to Fly.io and other cloud platforms
- Refer to [FLY_IO_DEPLOYMENT.md](ctpat-backend/FLY_IO_DEPLOYMENT.md) for cloud setup

## Performance Considerations

- Lazy loading of inspection records
- Optimized PDF generation for large documents
- Image compression for photo attachments
- Efficient local caching strategies

## Support & Troubleshooting

- Check logs in the mobile app's debug console for client-side issues
- Review backend logs for server-side problems
- Verify network connectivity for sync issues
- Clear local storage if experiencing data inconsistencies

## License

MIT

## Author

Huzeir Kurpejovic

---

For detailed information on specific components, features, or deployment options, refer to documentation in individual module folders.
