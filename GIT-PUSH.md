# Publish this folder to `jora-partner`

From a PowerShell window, run the following after you have downloaded this folder. These commands copy the converted files into a fresh checkout, create one commit, and push it to `main`.

```powershell
git clone https://github.com/naveen4806-coder/jora-partner.git
Set-Location jora-partner

Copy-Item -Path "C:\path\to\jora-partner-supabase\*" -Destination . -Recurse -Force

git add index.html supabase-adapter.js supabase-config.js nexcart-notifications.js .env.example README.md GIT-PUSH.md supabase
git commit -m "Migrate delivery partner portal to Supabase"
git push origin main
```

Before deployment, set the real project URL and publishable browser key in `supabase-config.js`, then run the SQL migration in `supabase/migrations/0001_delivery_partner_documents.sql`. Do not place a Supabase service-role key in this folder or commit it.
