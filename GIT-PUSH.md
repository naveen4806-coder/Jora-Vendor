# Publish Jora Vendor

Configure and test the shared MongoDB API first. Do not commit `.env` files or Atlas credentials.

```powershell
git add -A
git commit -m "Migrate vendor portal to the Jora Mongo API"
git pull --rebase origin main
git push origin main
```
