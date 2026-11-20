# Invoice Management System

A mobile-first invoice management application.

## Architecture

- Mobile: React Native + Expo
- Backend: Node.js + Fastify
- Language: TypeScript
- Database: PostgreSQL
- ORM: Drizzle ORM

## User Roles

### Admin
- Full application access
- Organization settings
- Customer management
- Technician management
- Invoice management
- Reports

### Technician
- Create invoices
- View own invoice history

## Business Rules

- One organization only.
- Multiple customers.
- Two roles: Admin and Technician.
- Currency: INR.
- Invoice PDF based on approved reference template.

## Development

See the project documentation in /docs.