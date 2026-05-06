## Accounting API (Go + MySQL)

این API معادل قابلیت‌های فرانت‌اند را فراهم می‌کند:
- ورود و مدیریت کاربران (JWT)
- محصولات (ویژگی‌ها/گزینه‌ها/ترکیب‌ها)
- مشتریان
- فاکتورها (پیش‌نویس/تأیید‌شده)
- گزارش‌ها: داشبورد و سود/زیان

### اجرا (محلی)

1) اجرای MySQL:

```bash
cd /home/vox/project/accounting/api
docker compose up -d
```

2) تنظیم متغیرهای محیطی:

```bash
cp .env.example .env
export $(cat .env | xargs)
```

3) اجرای API:

```bash
go run .
```

API روی `http://localhost:8080` اجرا می‌شود.

### کاربر پیش‌فرض

در اولین اجرا اگر جدول `users` خالی باشد، کاربر زیر ایجاد می‌شود:
- username: `admin`
- password: `123456`

### Endpoint ها

Base: `/api`

- `POST /api/auth/login`
- `GET /api/me`

CRUD:
- `GET/POST/PUT/DELETE /api/products`
- `GET/POST/PUT/DELETE /api/customers`
- `GET/POST/PUT/DELETE /api/invoices`
- `GET /api/invoices/next-number`

Users (فقط admin):
- `GET/POST/PUT/DELETE /api/users`

Reports:
- `GET /api/dashboard`
- `GET /api/reports/profit-loss`
