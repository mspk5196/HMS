# Neha Hospital HRMS — Multi-Tenant System Architecture & Deployment Flow

**Status:** Finalized architecture
**Purpose:** Define the complete production architecture for a multi-tenant hospital HRMS with tenant-isolated databases, customer-hosted deployments, centralized Super Admin control, branch management, and local biometric connectors.

---

## 1. Executive Summary

The system will be designed as a **multi-tenant Hospital HRMS platform**.

The platform must support two hosting models:

1. **Platform-hosted tenant** — the HRMS runs on Platform infrastructure.
2. **Customer-hosted tenant** — the complete HRMS runs on the hospital/customer's own server.

In both models, biometric devices such as eSSL devices are connected through a **Biometric Connector** running inside the hospital's local network.

The central **Super Admin / Control Plane** manages:

- Organizations / tenants
- Tenant deployments
- Branches
- Biometric connectors
- Biometric devices
- Customer-hosted installations
- Tenant activation
- Initial administrators
- Licensing / subscription status
- Deployment versions
- Connector online/offline status

The core database strategy is:

> **One database per tenant.**

Organizations hosted on Platform infrastructure share the application platform but have isolated databases.

Customer-hosted organizations receive an isolated HRMS deployment and an isolated tenant database.

---

# 2. High-Level Architecture

```text
               ┌───────────────────────────┐
               │   CONTROL PLANE  │
               │              │
               │   Super Admin Panel  │
               │   Control Plane API  │
               │   Deployment Manager  │
               │   License Manager   │
               │   Connector Manager  │
               └─────────────┬─────────────┘
                      │
             ┌──────────────────┴──────────────────┐
             │                   │
             ▼                   ▼
       ┌─────────────────────┐       ┌─────────────────────┐
       │  PLATFORM INFRASTRUCTURE│       │ CUSTOMER INFRASTRUCTURE│
       │           │       │           │
       │ Shared HRMS Platform│       │ Dedicated HRMS   │
       │           │       │ Dedicated DB    │
       └──────────┬──────────┘       └──────────┬──────────┘
             │                   │
         ┌───────┼───────┐               │
         │    │    │               │
         ▼    ▼    ▼               ▼
        Org A  Org B  Org C             Org D
         │    │    │               │
        DB-A  DB-B  DB-C             DB-D
         │
         │
         └──────────────────────────────────────────────┐
                                │
                       Hospital Local Network
                                │
                            ┌───────▼───────┐
                            │ Bio Connector │
                            └───────┬───────┘
                                │
                        ┌───────────────┼───────────────┐
                        ▼        ▼        ▼
                       eSSL #1     eSSL #2     eSSL #3
```

---

# 3. Core Concepts

The system has six major concepts:

```text
Organization
  │
  ├── Deployment
  │
  ├── Branches
  │   │
  │   └── Biometric Connectors
  │       │
  │       └── Biometric Devices
  │
  ├── AI Service Platform
  │   ├── Cloud Shared AI (ai.mspkapps.in)
  │   └── Customer-Local AI Sidecar
  │
  ├── Users / Roles
  │
  └── Subscription / License
```

## 3.1 Organization / Tenant

An organization represents one hospital group / customer.

Example:

```text
Neha Hospitals
```

One organization may contain many branches.

An organization is the top-level tenant boundary.

---

## 3.2 Branch

A branch represents one physical hospital/location belonging to the organization.

Example:

```text
Neha Hospitals
├── Erode
├── Coimbatore
└── Chennai
```

Branch is important because biometric devices are physically associated with a branch.

---

## 3.3 Deployment

A deployment represents where the HRMS application itself runs.

Deployment types:

```text
_INFRA
CUSTOMER_INFRA
```

A tenant hosted on Platform infrastructure does not require a new application deployment when another tenant is added.

A customer-hosted tenant receives its own isolated HRMS deployment.

---

## 3.4 Biometric Connector

A biometric connector is a local service running inside the hospital network.

It communicates with:

```text
Hospital LAN
   │
   ├── eSSL device
   ├── eSSL device
   └── eSSL device
```

and communicates outbound with the HRMS/control services.

A connector belongs to:

```text
Organization
  ↓
Branch
  ↓
Connector
```

The connector is independent of where the HRMS is hosted.

---

## 3.5 Biometric Device

A biometric device belongs to a connector.

Example:

```text
Erode Branch
  │
  └── Connector-001
     ├── ESSL-001
     ├── ESSL-002
     └── ESSL-003
```

---

## 3.6 AI Service Platform

The AI service is an independently deployed microservice responsible for heavy computational workloads:

```text
AI Service Platform (Python 3.11 / FastAPI)
  │
  ├── Clinical Ambient Scribe (Whisper STT large-v3)
  │
  ├── Voiceprint Identification (SpeechBrain acoustic embeddings)
  │
  ├── Clinical NLP & Dialogue Parsing (Ollama LLM)
  │
  └── Duty Roster Optimizer (Google OR-Tools)
```

The AI Service runs on a dedicated domain (e.g. `https://ai.mspkapps.in` or `https://ai.nehahospitals.in`) with isolated GPU/CPU scaling.

Hospital frontends **never** connect to the AI Service directly. All AI traffic flows:

```text
Browser / Mobile App
       ↓
  HRMS Backend (Node.js)  ───[ X-Internal-Key + X-Tenant-ID ]───►  AI Service
```

For customer-hosted, air-gapped hospitals, the AI service can optionally be deployed locally as a Docker sidecar on the customer's server (`http://localhost:8000`).

---

# 4. Database Architecture

## 4.1 Control Plane Database

There is one central database for the Control Plane.

It stores platform-level information such as:

```text
organizations
deployments
branches
connectors
devices
licenses
installation_tokens
connector_credentials
deployment_versions
activation_records
```

It does **not** contain normal tenant HRMS data.

---

# 5. Tenant Database Architecture

Every organization receives a separate database.

Example:

```text
Control Plane
│
├── ORG-001 → neha_hospitals_db
├── ORG-002 → abc_hospital_db
└── ORG-003 → xyz_healthcare_db
```

Tenant databases contain HRMS data:

```text
employees
departments
attendance
leaves
salary
payroll
shifts
holidays
documents
reports
etc.
```

## Important rule

A tenant must never be able to access another tenant's database.

---

# 6. -Hosted Tenant Architecture

Suppose:

```text
Organization A
Organization B
Organization C
```

are hosted by .

Do NOT deploy three separate copies of the application.

Instead:

```text
           HRMS PLATFORM
              │
       ┌────────────┼────────────┐
       │      │      │
       Org A    Org B    Org C
       │      │      │
      DB-A     DB-B     DB-C
```

The application is shared.

The database is isolated.

When a new organization is added:

```text
Create organization
    ↓
Create tenant database
    ↓
Run migrations
    ↓
Create tenant configuration
    ↓
Configure domain
    ↓
Create initial administrator
    ↓
Activate tenant
```

No new application deployment is required.

---

# 7. Tenant Identification

For Platform-hosted tenants, the application identifies the tenant using the request's domain/hostname.

Example:

```text
erode.neha.example
    ↓
ORG-001
    ↓
Tenant DB: neha_hospitals_db
```

Another:

```text
abc.example
    ↓
ORG-002
    ↓
Tenant DB: abc_hospital_db
```

The backend resolves:

```text
hostname
  ↓
organization
  ↓
tenant database
```

The tenant database connection is selected dynamically.

---

# 8. Nginx Architecture

Nginx remains the reverse proxy.

The preferred model is:

```text
          Internet
            │
            ▼
           Nginx
            │
       ┌────────┴────────┐
       │         │
      Tenant A      Tenant B
       │         │
    Shared HRMS App  Shared HRMS App
```

All Platform-hosted tenants can route to the same application service.

The application determines the tenant.

For customer-hosted deployments:

```text
Customer Domain
   ↓
Customer Nginx
   ↓
Customer HRMS
```

---

# 9. Customer-Hosted Architecture

When a customer wants the HRMS on their own server:

```text
Customer Server
│
├── Nginx
├── HRMS Frontend
├── HRMS Backend
├── Tenant Database
└── Management Agent
```

This deployment is isolated from other customers.

Example:

```text
Hospital A
  └── Customer Server A
     ├── HRMS
     └── DB-A

Hospital B
  └── Customer Server B
     ├── HRMS
     └── DB-B
```

---

# 10. Central Control Plane

The Super Admin is a separate application/service from the tenant HRMS.

```text
         CONTROL PLANE
            │
    ┌──────────────┼──────────────┐
    │       │       │
  Super Admin  Control API  Deployment Manager
```

The Control Plane is responsible for platform management.

The tenant HRMS is responsible for hospital operations.

The two must not be tightly coupled.

---

# 11. Super Admin Responsibilities

The Super Admin should provide:

### Organizations

- Create organization
- Edit organization
- Activate/deactivate organization
- View organization status

### Deployment

- Platform infrastructure
- Customer infrastructure
- Deployment status
- Deployment version
- Activation
- Upgrade status

### Branches

- Create branch
- Edit branch
- Disable branch
- View branch status

### Biometric Connectors

- Register connector
- Activate connector
- Disable connector
- View online/offline status
- Assign connector to branch
- Rotate credentials
- Revoke connector

### Biometric Devices

- Add device
- Edit device
- Enable/disable device
- Map device to connector
- View connection status

### Administration

- Create initial tenant administrator
- Manage licenses
- View audit logs

---

# 12. Unified Installation Command

A single installer should be provided.

Example:

```bash
curl -fsSL https://install.mspkapps.in | bash
```

The installer displays:

```text
 Installation Manager

Select installation type:

1. Full HRMS
2. Biometric Connector

Enter choice:
```

---

# 13. Installation Mode 1 — Full HRMS

The Full HRMS installation is used when the customer wants the application on their own infrastructure.

The installer installs:

```text
HRMS Frontend
HRMS Backend
Tenant Database
Management Agent
Nginx configuration
Required supporting services
```

The customer-hosted deployment is initially unactivated.

Example:

```text
Installation ID:
DEP-83K29A

Activation status:
NOT ACTIVATED

Activation code:
7F4D-9A2C
```

---

# 14. Full HRMS Activation Flow

```text
Customer runs installer
    ↓
Selects Full HRMS
    ↓
HRMS is installed
    ↓
Deployment ID generated
    ↓
One-time activation code generated
    ↓
Website displays activation information
    ↓
 Super Admin creates/opens organization
    ↓
Selects Customer Infrastructure
    ↓
Enters activation code
    ↓
Control Plane validates installation
    ↓
Deployment is associated with organization
    ↓
Deployment receives permanent identity/credential
    ↓
Deployment becomes ACTIVE
```

---

# 15. Initial Admin Creation

The Super Admin creates the initial administrator for the organization.

Recommended flow:

```text
Super Admin
  ↓
Create Initial Admin
  ↓
Generate invitation / temporary activation
  ↓
Customer sets final password
```

Permanent plaintext passwords should not be stored in the Control Plane.

---

# 16. Installation Mode 2 — Biometric Connector

The biometric connector is independent of the HRMS deployment.

This mode is used when:

- HRMS is hosted by
- HRMS is hosted by the customer
- The hospital has multiple branches
- The biometric device is inside a local hospital network

Installer:

```text
curl -fsSL https://install.mspkapps.in | bash
```

Select:

```text
2. Biometric Connector
```

---

# 17. Connector Registration

The Super Admin first creates a connector record.

Example:

```text
Organization:
Neha Hospitals

Branch:
Erode

Connector:
CON-001
```

The Control Plane generates a one-time connector installation token.

Example:

```text
BIO-7F4D-92AC
```

The customer enters that token during connector installation.

---

# 18. Connector Activation Flow

```text
Super Admin
  ↓
Organization
  ↓
Branch
  ↓
Add Connector
  ↓
Generate one-time installation token
  ↓
Customer runs installer
  ↓
Selects Biometric Connector
  ↓
Enters token
  ↓
Connector contacts Control Plane
  ↓
Token validated
  ↓
Connector assigned to organization + branch
  ↓
Permanent connector credential issued
  ↓
Connector becomes ACTIVE
```

The installation token is only for bootstrap registration.

It must not be used as the permanent connector credential.

---

# 19. Connector Identity

Every connector should have a unique identity:

```text
connector_id
organization_id
branch_id
credential
status
version
last_seen
```

Example:

```text
Connector:
CON-001

Organization:
ORG-001

Branch:
BR-001

Status:
ONLINE
```

The connector must not be able to arbitrarily select another organization.

Its authenticated identity determines its organization and branch.

---

# 20. Biometric Device Hierarchy

Final hierarchy:

```text
Organization
  │
  └── Branch
     │
     └── Connector
        │
        ├── Device 1
        ├── Device 2
        └── Device 3
```

Example:

```text
Neha Hospitals
│
├── Erode
│  ├── Connector-001
│  │  ├── ESSL-001
│  │  └── ESSL-002
│  │
│  └── Connector-002
│     └── ESSL-003
│
├── Coimbatore
│  └── Connector-003
│     └── ESSL-004
│
└── Chennai
   └── Connector-004
     ├── ESSL-005
     └── ESSL-006
```

---

# 21. Why Multiple Connectors Are Supported

A branch may have:

- multiple buildings
- multiple networks
- multiple PCs
- multiple biometric devices
- network restrictions

Therefore:

```text
One Branch
  ↓
Many Connectors
  ↓
Many Devices
```

must be supported.

---

# 22. Connector Network Architecture

The connector should communicate outbound.

Preferred architecture:

```text
Hospital LAN

ESSL Device
  ↑
  │ LAN
  ↓
Biometric Connector
  │
  │ HTTPS / WebSocket outbound
  ▼
Control Plane / HRMS API
```

Avoid requiring inbound public access to the connector.

The hospital should not normally need:

```text
Internet
  ↓
Public IP
  ↓
Connector
```

This reduces firewall/NAT complexity and attack surface.

---

# 23. Current Biometric Connector Integration

The existing NehaHospital repository already has a separate `BiometricConnector` service.

Its responsibilities include:

- local connector server
- device management
- ESSL communication
- staff/device synchronization
- punch synchronization
- backend communication

The new architecture should extend this existing connector rather than replace it.

The major architectural changes are:

```text
Current:
Connector → fixed backend configuration

Final:
Connector
  ↓
registered identity
  ↓
organization + branch
  ↓
authenticated backend communication
```

---

# 24. Attendance Data Flow

When an employee punches on an ESSL device:

```text
Employee
  ↓
ESSL Device
  ↓
Biometric Connector
  ↓
Connector authentication
  ↓
Tenant/HRMS API
  ↓
Attendance processing
  ↓
Tenant Database
```

The backend must know:

```text
Organization
Branch
Connector
Device
Employee
Punch time
Punch type
```

The connector identity determines the organization and branch.

The backend must not blindly trust organization IDs supplied in request bodies.

---

# 25. Attendance Example

```text
Employee:
EMP-1001

Organization:
ORG-001

Branch:
BR-ERODE

Connector:
CON-001

Device:
ESSL-001

Punch:
09:01:24
```

Stored attendance belongs to:

```text
Tenant DB: neha_hospitals_db
Branch: Erode
Employee: EMP-1001
```

---

# 26. Multiple Branches

Branches belong to the same organization.

Example:

```text
ORG-001
│
├── BR-001 Erode
├── BR-002 Coimbatore
└── BR-003 Chennai
```

All branches use the same tenant database:

```text
neha_hospitals_db
```

but records contain `branch_id` where branch-level isolation/filtering is required.

---

# 27. User and Role Access

Users should belong to an organization.

Branch access should be separately controlled.

Example:

```text
Super Admin
  → Platform

Organization Admin
  → Entire organization

HR Manager
  → Erode + Coimbatore

Branch HR
  → Erode only

Attendance Operator
  → Erode attendance only
```

The authorization model should support:

```text
user
organization
role
branch_access
permissions
```

---

# 28. Employee Transfers Between Branches

Employee identity should remain stable across branch transfers.

Example:

```text
EMP-001

Erode
2025-01-01 → 2026-06-30

Coimbatore
2026-07-01 → Current
```

This preserves historical attendance and employment data.

Do not create a completely new employee identity just because the employee changes branches.

---

# 29. Domain Architecture

## Platform-hosted tenant

```text
tenant.example.com
    ↓
   Nginx
    ↓
Shared HRMS Application
    ↓
Tenant Resolution
    ↓
Tenant DB
```

## Customer-hosted tenant

```text
customer-domain.com
    ↓
Customer Nginx
    ↓
Customer HRMS
    ↓
Customer Tenant DB
```

---

# 30. Tenant Creation on Platform Infrastructure

When Super Admin selects:

```text
Deployment:
Platform Infrastructure
```

the platform performs:

```text
Create Organization
    ↓
Generate tenant ID
    ↓
Create tenant database
    ↓
Create DB user/credentials
    ↓
Run migrations
    ↓
Create tenant configuration
    ↓
Configure domain
    ↓
Create initial administrator
    ↓
Activate tenant
```

No new application deployment is required.

---

# 31. Tenant Creation on Customer Infrastructure

When Super Admin selects:

```text
Deployment:
Customer Infrastructure
```

the flow is:

```text
Create Organization
    ↓
Create deployment record
    ↓
Generate deployment registration token
    ↓
Customer runs Full HRMS installer
    ↓
Customer server registers deployment
    ↓
Super Admin enters/validates activation code
    ↓
Deployment assigned to organization
    ↓
Deployment activated
    ↓
Initial admin activated
```

---

# 32. Adding a New Organization

### Platform infrastructure

```text
Add Organization
   ↓
Select Platform Infrastructure
   ↓
Create tenant DB
   ↓
Configure tenant
   ↓
Add domain
   ↓
Create admin
   ↓
ACTIVE
```

No application duplication.

### Customer infrastructure

```text
Add Organization
   ↓
Select Customer Infrastructure
   ↓
Generate installation token
   ↓
Customer runs Full HRMS installer
   ↓
Customer deployment registers
   ↓
Activate
   ↓
ACTIVE
```

---

# 33. Adding a New Branch

Adding a branch does not require deploying HRMS again.

```text
Organization
  ↓
Add Branch
  ↓
Create branch
  ↓
Generate connector token
  ↓
Install connector at branch
  ↓
Register connector
  ↓
Add biometric devices
```

---

# 34. Adding a New Biometric Device

No HRMS deployment is required.

```text
Super Admin / Branch Admin
    ↓
Add Device
    ↓
Assign Connector
    ↓
Configure:
  IP
  Port
  Communication Key
    ↓
Connector connects
    ↓
Device becomes ONLINE
```

---

# 35. Connector Offline Handling

The Control Plane should maintain:

```text
last_seen
status
version
```

Example:

```text
CON-001
Status: ONLINE
Last Seen: 10 seconds ago
Version: 1.2.0
```

If no heartbeat is received within the configured threshold:

```text
ONLINE → OFFLINE
```

The Super Admin should see:

```text
🔴 Connector Offline
```

The HRMS should continue functioning even if the connector is temporarily offline.

---

# 36. Offline Biometric Operation

The connector should preferably support local buffering.

If:

```text
ESSL
 ↓
Connector
 ↓
Internet unavailable
```

the connector should temporarily store unsynchronized punch records.

When connectivity returns:

```text
Local queue
  ↓
Synchronize
  ↓
HRMS
```

This prevents loss of attendance caused by temporary network failure.

---

# 37. Security Model

Security must be designed around independent identities.

### Control Plane

```text
Super Admin authentication
```

### Tenant HRMS

```text
Tenant user authentication
```

### Customer deployment

```text
Deployment credential
```

### Biometric connector

```text
Connector credential
```

Never reuse one global API key for every organization.

---

# 38. Connector Credential Lifecycle

```text
Installation Token
    ↓
One-time registration
    ↓
Permanent Connector Credential
    ↓
Normal operation
    ↓
Credential rotation
    ↓
Credential revocation
```

If a connector PC is compromised:

```text
Super Admin
  ↓
Revoke Connector
  ↓
Credential invalid
  ↓
Connector cannot communicate
```

---

# 39. Deployment Version Management

The Control Plane should maintain product versions.

Example:

```text
HRMS
v1.0
v1.1
v1.2
v2.0
```

Customer deployments should report:

```text
deployment_id
current_version
last_seen
status
```

This allows future centralized upgrade management.

---

# 40. Do Not Duplicate Source Code Per Tenant

For Platform-hosted tenants:

```text
ONE application
+
MANY tenant databases
```

Do not create:

```text
application-org-a
application-org-b
application-org-c
```

unless a special isolation requirement appears later.

For customer-hosted tenants, use versioned deployment artifacts/images rather than manually copying source code.

---

# 41. Recommended Technology Direction

The architecture should work with the current project stack.

Recommended components:

```text
Control Plane
  Node.js / Express
  MySQL

Tenant HRMS
  Existing Node.js / Express
  MySQL

Frontend
  Existing HospitalsWeb / HospitalsApp

Biometric Connector
  Existing Node.js connector
  ESSL driver integration

Deployment
  Docker
  Docker Compose initially
  Nginx

Future scale
  Kubernetes if required
```

Do not introduce Kubernetes merely because the platform is multi-tenant.

Docker Compose is sufficient for the initial customer-hosted deployment model.

---

# 42. Control Plane Data Model

Conceptually:

```text
organizations
----------------
id
name
code
status
created_at

deployments
----------------
id
organization_id
type
version
status
registration_token
last_seen
created_at

branches
----------------
id
organization_id
name
code
address
status

connectors
----------------
id
organization_id
branch_id
name
version
status
last_seen
credential_hash
created_at

devices
----------------
id
connector_id
name
ip
port
comm_key_reference
status
created_at

licenses
----------------
id
organization_id
plan
status
start_date
expiry_date
```

Exact schema can be refined during implementation.

---

# 43. Tenant Database Data Model

Each tenant database contains the normal HRMS schema.

Examples:

```text
employees
departments
designations
attendance
leave_types
leave_requests
holidays
shifts
salary
payroll
users
roles
permissions
documents
etc.
```

Branch-related records should include `branch_id` where required.

---

# 44. Full System Flow

```text
             SUPER ADMIN
               │
               ▼
            CONTROL PLANE
               │
        ┌─────────────┴─────────────┐
        │              │
     INFRA          CUSTOMER INFRA
        │              │
     Shared HRMS          Full HRMS
        │              │
     Tenant DB           Tenant DB
        │              │
        └─────────────┬─────────────┘
               │
           Organization
               │
          ┌─────────┴─────────┐
          │          │
         Branch       Branch
          │          │
        Connector      Connector
          │          │
       ┌─────┴─────┐       │
       │      │       │
      ESSL #1   ESSL #2    ESSL #3
```

---

# 45. New Organization — Complete Flow

```text
1. Super Admin opens Organizations.

2. Clicks "Add Organization".

3. Enters:
  - Organization name
  - Contact details
  - Domain
  - License/plan

4. Selects:
  - Platform Infrastructure
  OR
  - Customer Infrastructure

5A. Platform Infrastructure:
  - Create tenant database
  - Run migrations
  - Configure tenant
  - Configure domain
  - Create admin
  - Activate

5B. Customer Infrastructure:
  - Generate deployment registration token
  - Customer runs Full HRMS installer
  - Deployment registers
  - Super Admin validates activation
  - Deployment becomes active
  - Admin is activated

6. Add branches.

7. For each branch:
  - Create connector record
  - Generate connector installation token

8. Customer runs connector installer locally.

9. Connector registers.

10. Add/map ESSL devices.

11. Devices synchronize.

12. Attendance begins flowing into the tenant database.
```

---

# 46. Existing Organization — Add New Branch

```text
Super Admin
  ↓
Organization
  ↓
Add Branch
  ↓
Generate Connector Token
  ↓
Install connector at branch
  ↓
Register connector
  ↓
Add ESSL devices
  ↓
Test connectivity
  ↓
Branch operational
```

No HRMS redeployment.

---

# 47. Existing Organization — Add New ESSL Device

```text
Add Device
  ↓
Assign connector
  ↓
Enter ESSL IP/port/communication key
  ↓
Connector tests device
  ↓
Device registered
  ↓
Device begins synchronization
```

---

# 48. Existing Tenant — Customer Changes Infrastructure

If an organization initially uses Platform infrastructure and later wants its own server:

```text
Current:
 HRMS
  ↓
Tenant DB

Migration process:
  ↓
Provision customer server
  ↓
Deploy HRMS
  ↓
Create tenant DB
  ↓
Export tenant data
  ↓
Import tenant data
  ↓
Validate
  ↓
Change deployment type
  ↓
Point domain to customer server
  ↓
Retire old deployment
```

The organization identity remains the same.

---

# 49. Existing Customer Tenant — Return to Platform Infrastructure

The reverse should also be possible:

```text
Customer HRMS
  ↓
Export tenant DB
  ↓
Create tenant DB
  ↓
Import data
  ↓
Validate
  ↓
Change deployment type
  ↓
Point domain to
```

This should be treated as a controlled migration process.

---

# 50. Important Design Rules

## Rule 1

**Organization is the tenant boundary.**

## Rule 2

**One tenant = one database.**

## Rule 3

**Branch is a physical/business subdivision of an organization.**

## Rule 4

**Connector belongs to a branch.**

## Rule 5

**Device belongs to a connector.**

## Rule 6

**Connector identity determines organization and branch.**

## Rule 7

**Activation tokens are one-time bootstrap credentials.**

## Rule 8

**Permanent credentials must be unique per deployment/connector.**

## Rule 9

**Do not expose biometric connectors publicly unless there is a specific operational requirement.**

## Rule 10

**Platform-hosted tenants share the application platform but never share tenant databases.**

## Rule 11

**Customer-hosted tenants receive isolated deployments.**

## Rule 12

**Adding a tenant to Platform infrastructure must not require redeploying the HRMS application.**

---

# 51. Final Architecture Decision

The finalized system is:

```text
             PLATFORM
               │
          ┌─────────┴─────────┐
          │          │
        CONTROL PLANE    HRMS PLATFORM
          │          │
       Super Admin    Multi-Tenant App
          │          │
     ┌─────────┼─────────┐     │
     │     │     │     │
   Tenants  Deployments Branches  │
     │          │     │
     │          │     │
     │       Connectors   │
     │          │     │
     │        Devices   │
     │               │
     └──────────────┬──────────────┘
             │
         Tenant Databases
```

### Hosting options

```text
 HOSTED

One shared HRMS platform
    +
One database per tenant
    +
Local biometric connector per branch
```

```text
CUSTOMER HOSTED

One isolated HRMS deployment
    +
One tenant database
    +
Local biometric connector per branch
    +
Central Control Plane registration
```

### Installer

```text
One command
   ↓
Installation Manager
   │
   ├── Full HRMS
   │   └── Customer infrastructure
   │
   └── Biometric Connector
      └── Hospital local network
```

---

# 52. Recommended Implementation Order

Do not implement everything simultaneously.

### Phase 0 — Standalone AI Service Platform

1. Containerize AI service (`AiService/Dockerfile`).
2. Deploy AI Service to dedicated domain (e.g. `ai.mspkapps.in`).
3. Harden CORS to accept only backend hosts (block direct browser access).
4. Update Backend AI client (`aiClient.js`) to target dedicated AI domain and pass `X-Internal-Key` and `X-Tenant-ID`.
5. Support optional customer-hosted local AI sidecar in Docker compose.

### Phase 1 — Multi-tenancy

1. Create Control Plane.
2. Create organization model.
3. Implement tenant resolution.
4. Implement database-per-tenant.
5. Implement tenant database provisioning.
6. Add domain mapping.
7. Add tenant-aware authentication.

### Phase 2 — Branches

1. Create branches.
2. Add `branch_id` where required.
3. Add branch-based access control.
4. Support employee transfers.

### Phase 3 — Biometric Connector

1. Refactor current connector registration.
2. Add connector identity.
3. Add organization/branch mapping.
4. Replace global/static connector authentication.
5. Add secure registration.
6. Add heartbeat.
7. Add offline buffering.
8. Add device mapping.

### Phase 4 — Control Plane

1. Super Admin authentication.
2. Organization management.
3. Deployment management.
4. Branch management.
5. Connector management.
6. Device management.
7. License management.
8. Audit logging.

### Phase 5 — Customer Deployment

1. Build Dockerized HRMS.
2. Build installation command.
3. Add Full HRMS installer.
4. Add activation flow.
5. Add management agent.
6. Add deployment health reporting.

### Phase 6 — Production Hardening

1. Credential rotation.
2. Token expiry.
3. Audit logs.
4. Backup/restore.
5. Monitoring.
6. Automatic updates.
7. Disaster recovery.
8. Security testing.

---

# 53. Final Goal

The final user experience should be:

### You

```text
Super Admin
  ↓
Add Hospital
  ↓
Choose:
Platform Infrastructure
or
Customer Infrastructure
```

### Customer server

```text
One command
  ↓
Select Full HRMS
  ↓
Installation complete
  ↓
Activation
```

### Hospital branch

```text
One command
  ↓
Select Biometric Connector
  ↓
Enter connector token
  ↓
Connector registered
  ↓
Map ESSL devices
```

### After that

```text
Hospital employees
    ↓
Biometric devices
    ↓
Local connector
    ↓
HRMS
    ↓
Correct tenant database
    ↓
Correct branch
    ↓
Attendance
```

This architecture supports the current hospital HRMS requirements while leaving room for many organizations, many branches, many biometric devices, Platform-hosted tenants, and customer-hosted installations without redesigning the platform.
