# DSD Finance Hub - Authentication System Setup Guide

## 📋 Overview

Complete authentication and authorization system with:
- User login/logout
- Role-based access control (Admin, Manager, Analyst, Viewer)
- Protected routes via middleware
- Permission-based UI components
- Audit logging
- Institutional dashboard with financial overview

---

## 🗄️ Database Setup

### Step 1: Run SQL Script in Supabase

Execute the complete SQL script in your Supabase SQL Editor:

```bash
File: docs/AUTH-SETUP.sql
```

This creates:
- ✅ `roles` table with 4 default roles
- ✅ `users` table (extends auth.users)
- ✅ `user_permissions` table for granular permissions
- ✅ `audit_log` table for action tracking
- ✅ Helper functions (`has_permission`, `log_audit`)
- ✅ Row Level Security (RLS) policies
- ✅ Views for user details

### Step 2: Enable Supabase Auth

1. Go to Supabase Dashboard → Authentication → Settings
2. Enable **Email Auth**
3. (Optional) Enable OAuth providers (Google, Microsoft)
4. Configure email templates if needed

### Step 3: Create First Admin User

**Option A: Via Supabase Dashboard**
1. Go to Authentication → Users
2. Click "Add User"
3. Fill in email and password
4. Copy the generated UUID

**Option B: Via SQL**
```sql
-- After creating user via dashboard, insert into users table
INSERT INTO users (id, email, name, role, company_code)
VALUES (
  '<UUID_FROM_AUTH_USERS>',
  'admin@digitalsmiledesign.com',
  'DSD Administrator',
  'admin',
  'GLOBAL'
);
```

---

## 🔐 Role Hierarchy

| Role             | Level | Permissions                                               |
|------------------|-------|-----------------------------------------------------------|
| **admin**        | 100   | Full system access (wildcard *)                           |
| **finance_manager** | 50    | view_all, edit_invoices, edit_payments, reconcile, edit_master_data, export_data, view_reports |
| **analyst**      | 10    | view_all, edit_invoices, view_reports, export_data        |
| **viewer**       | 1     | view_reports, export_data (read-only)                     |

---

## 🛠️ Frontend Integration

### Files Created:

#### 1. **Auth Context** (`src/contexts/auth-context.tsx`)
- Manages authentication state
- Provides hooks: `useAuth()`, `usePermission()`, `useRole()`
- Handles login/logout/signup
- Tracks user sessions

#### 2. **Middleware** (`src/middleware.ts`)
- Protects all routes except `/login`, `/signup`
- Validates active user status
- Redirects unauthorized users

#### 3. **Auth Components**
- `LoginForm.tsx` - Login page with email/password
- `RoleGuard.tsx` - Protect components by role/permission
- `UserMenu.tsx` - User profile dropdown in sidebar

#### 4. **Dashboard** (`src/app/dashboard/page.tsx`)
- Institutional header with DSD branding
- Financial overview cards (Payables, Receivables, Reconciliation)
- Cash flow chart (12-month trend)
- Expense distribution pie chart
- Top vendors bar chart
- Quick action buttons

#### 5. **Dashboard Components** (`src/components/dashboard/`)
- `OverviewCards.tsx` - 6 key metrics cards
- `CashFlowChart.tsx` - Recharts line chart
- `ExpenseChart.tsx` - Recharts pie chart
- `VendorChart.tsx` - Recharts bar chart

---

## 🚀 Usage Examples

### Protect a Page

```tsx
import { RoleGuard } from '@/components/auth/RoleGuard';

export default function AdminPage() {
  return (
    <RoleGuard requiredRole="admin">
      <div>Admin-only content</div>
    </RoleGuard>
  );
}
```

### Protect a Component

```tsx
import { RequirePermission } from '@/components/auth/RoleGuard';

function InvoiceActions() {
  return (
    <RequirePermission permission="edit_invoices">
      <Button onClick={handleEdit}>Edit Invoice</Button>
    </RequirePermission>
  );
}
```

### Check Permissions in Code

```tsx
import { useAuth, usePermission } from '@/contexts/auth-context';

function MyComponent() {
  const { profile, isAdmin } = useAuth();
  const canEdit = usePermission('edit_invoices');

  if (isAdmin()) {
    // Show admin features
  }

  if (canEdit) {
    // Show edit button
  }
}
```

### Use User Profile

```tsx
import { useAuth } from '@/contexts/auth-context';

function Header() {
  const { profile, signOut } = useAuth();

  return (
    <div>
      <span>Welcome, {profile?.name}!</span>
      <span>Company: {profile?.company_code}</span>
      <button onClick={signOut}>Logout</button>
    </div>
  );
}
```

---

## 🎨 UI/UX Features

### Login Page
- Professional DSD-branded design
- Email + Password authentication
- Error handling with alerts
- Loading states
- Responsive layout

### User Menu (Sidebar)
- Avatar with initials
- Role badge (Admin, Manager, Analyst, Viewer)
- User details (email, company, department)
- Profile settings link
- Sign out button

### Dashboard
- **Institutional Header**: DSD branding with mission statement
- **Overview Cards**: 6 KPIs with icons and colors
- **Cash Flow Chart**: 12-month line chart
- **Expense Distribution**: Pie chart by cost center
- **Top Vendors**: Bar chart of top 10
- **Quick Actions**: 4 module shortcuts

---

## 🔧 Configuration

### Environment Variables

Add to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Middleware Config

Edit `src/middleware.ts` to add more public routes:

```typescript
const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password'];
```

---

## 📊 Audit Logging

All user actions are logged automatically:

```typescript
// Automatic logging in auth context:
- User login/logout
- User registration
- Profile updates

// Manual logging in your code:
await supabase.from('audit_log').insert({
  user_id: user.id,
  action: 'invoice_created',
  resource_type: 'invoice',
  resource_id: invoice.id,
  details: { amount: 1000, currency: 'EUR' }
});
```

View audit logs in Supabase:
```sql
SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100;
```

---

## 🔐 Security Features

1. **Row Level Security (RLS)**
   - Users can only view their own profile
   - Admins can view all users
   - Audit logs are user-scoped

2. **Session Management**
   - Auto-refresh of user sessions
   - Inactive user detection
   - Forced logout for disabled accounts

3. **Permission Checking**
   - Server-side permission validation
   - Client-side permission guards
   - Hierarchical role system

4. **Password Security**
   - Handled by Supabase Auth
   - Bcrypt hashing
   - Rate limiting

---

## 📝 Common Tasks

### Add a New User (As Admin)

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User"
3. Enter email and temporary password
4. Go to SQL Editor:

```sql
INSERT INTO users (id, email, name, role, company_code, department)
VALUES (
  '<USER_UUID>',
  'user@digitalsmiledesign.com',
  'User Name',
  'analyst',  -- Choose role
  'ES',       -- Choose scope
  'Finance'   -- Optional
);
```

### Change User Role

```sql
UPDATE users
SET role = 'finance_manager'
WHERE email = 'user@digitalsmiledesign.com';
```

### Grant Additional Permission

```sql
INSERT INTO user_permissions (user_id, permission, granted_by)
VALUES (
  '<USER_UUID>',
  'export_sensitive_data',
  '<ADMIN_UUID>'
);
```

### Disable User

```sql
UPDATE users
SET is_active = false
WHERE email = 'user@digitalsmiledesign.com';
```

---

## 🧪 Testing

### Test Login Flow

1. Navigate to `http://localhost:3000/login`
2. Enter admin credentials
3. Should redirect to `/dashboard`
4. Check user menu in sidebar (bottom)
5. Click "Sign Out" to test logout

### Test Protected Routes

1. Sign out
2. Try accessing `/accounts-payable`
3. Should redirect to `/login?redirectTo=/accounts-payable`
4. After login, should redirect back

### Test Role Guards

1. Login as `viewer` role
2. Navigate to invoice edit page
3. Edit button should be hidden
4. Try accessing admin-only pages
5. Should show "Access Denied"

---

## 📱 Responsive Design

All components are fully responsive:
- Login page: Mobile-optimized
- Dashboard: Stacks on mobile, grid on desktop
- Charts: Responsive containers
- Sidebar: Collapses on mobile

---

## 🎯 Next Steps

### Recommended Enhancements:

1. **Password Reset Flow**
   - Create `/forgot-password` page
   - Email template for reset link
   - `/reset-password` page

2. **Two-Factor Authentication (2FA)**
   - Enable in Supabase Auth
   - Add phone verification

3. **User Management Page**
   - Admin-only page to manage users
   - CRUD for users, roles, permissions

4. **Activity Dashboard**
   - Real-time audit log viewer
   - User session monitoring
   - Security alerts

5. **Permissions Editor**
   - UI to manage role permissions
   - Custom permission sets

---

## ❓ Troubleshooting

### "auth.users does not exist"
- Run Supabase migrations
- Ensure Supabase Auth is enabled

### "Session not found"
- Check environment variables
- Verify Supabase URL and keys
- Clear browser cookies

### "Access Denied" after login
- Check user's `is_active` status
- Verify role exists in `roles` table
- Check RLS policies

### Middleware redirect loop
- Ensure `/login` is in `publicRoutes`
- Check session validation logic

---

## 📚 Resources

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Recharts Documentation](https://recharts.org/)
- [shadcn/ui Components](https://ui.shadcn.com/)

---

## ✅ Checklist

Before deploying to production:

- [ ] SQL script executed in Supabase
- [ ] Supabase Auth enabled
- [ ] Admin user created
- [ ] Environment variables set
- [ ] Login flow tested
- [ ] Protected routes working
- [ ] Role guards tested
- [ ] Audit logging verified
- [ ] Dashboard loading correctly
- [ ] Charts displaying data
- [ ] User menu functional
- [ ] Mobile responsive tested
- [ ] RLS policies reviewed
- [ ] Password policies configured

---

**System Status:** ✅ Ready for Testing

**Deployment:** Run `npm run build` and verify no errors

**Support:** Contact DSD Corporate Team for assistance
