# 🔐 SECURITY GUIDE - API Keys and Secrets

## ⚠️ NEVER COMMIT SENSITIVE DATA

**Files that should NEVER be committed:**
- `.env.local`
- `.env.production`
- Any file containing real API keys
- Database passwords
- Access tokens

---

## ✅ How to Securely Manage Secrets

### 1. Local Development

Use `.env.local` file (already in `.gitignore`):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_key_here

# SQL Server
SQLSERVER_HOST=your_host
SQLSERVER_DATABASE=your_database
SQLSERVER_USER=your_user
SQLSERVER_PASSWORD=your_password

# GoCardless
GOCARDLESS_ACCESS_TOKEN=your_token_here

# Braintree
BRAINTREE_MERCHANT_ID=your_merchant_id
BRAINTREE_PUBLIC_KEY=your_public_key
BRAINTREE_PRIVATE_KEY=your_private_key
```

### 2. Production (Vercel)

Add secrets in Vercel Dashboard:
1. Go to: https://vercel.com/dsdpowerbitutorials/automacao-dados-financeiros
2. Settings → Environment Variables
3. Add each variable
4. Select: Production, Preview, Development

### 3. GitHub Actions / Codespaces

Add secrets in GitHub:
1. Go to: https://github.com/DSDPowerBiTutorials/automacao-dados-financeiros/settings/secrets
2. Actions → New repository secret
3. Add: `GOCARDLESS_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, etc.

---

## 🚨 What to Do If You Accidentally Commit a Secret

### Immediate Actions (< 5 minutes):

1. **Revoke the exposed key IMMEDIATELY**
   - GoCardless: https://manage.gocardless.com/developers
   - Braintree: https://sandbox.braintreegateway.com/merchants/xxx/api_keys
   - Supabase: https://supabase.com/dashboard/project/_/settings/api

2. **Generate a new key**
   - Same location as step 1
   - Copy to safe location (password manager)

3. **Update `.env.local` with new key**
   - Never commit this file!

4. **Update production secrets**
   - Vercel dashboard
   - GitHub secrets

### Remove from Git History:

```bash
# Method 1: BFG Repo Cleaner (recommended)
brew install bfg  # or download from https://rtyley.github.io/bfg-repo-cleaner/
bfg --replace-text passwords.txt
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force

# Method 2: git filter-repo
pip install git-filter-repo
git filter-repo --invert-paths --path docs/FILE_WITH_SECRET.md --force
git push origin --force --all
```

---

## ✅ Best Practices

### DO:
- ✅ Use `.env.local` for local development
- ✅ Use environment variables in code: `process.env.VARIABLE_NAME`
- ✅ Add all `.env*` files to `.gitignore`
- ✅ Use GitHub Secrets for CI/CD
- ✅ Use Vercel Environment Variables for production
- ✅ Rotate keys regularly
- ✅ Use different keys for dev/staging/production

### DON'T:
- ❌ Never hardcode API keys in code
- ❌ Never commit `.env.local` or `.env.production`
- ❌ Never put secrets in documentation files (.md)
- ❌ Never put secrets in comments
- ❌ Never share secrets via email/Slack
- ❌ Never use production keys in development

---

## 🔍 How to Check for Exposed Secrets

### Scan your repository:

```bash
# Install truffleHog
pip install truffleHog

# Scan repo
trufflehog filesystem . --json
```

### GitHub Secret Scanning:
- Automatically enabled for public repos
- Check: https://github.com/DSDPowerBiTutorials/automacao-dados-financeiros/security

---

## 📚 Resources

- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [BFG Repo Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)

---

## ⚡ Quick Reference

**If you see a secret in a file, ask:**
1. Is this file in `.gitignore`? If NO → add it!
2. Is this file committed? If YES → remove it!
3. Is the secret still valid? If YES → revoke it!
4. Do I need to clean Git history? Usually YES!

**Remember:** Once pushed to GitHub, consider the secret compromised forever.
