# Local Infra (Docker Compose) — PR-A1

بنية تطوير محلية فقط: **PostgreSQL · ClickHouse · Redis**. لا أكثر.

> **النطاق (PR-A1):** datastores محلية للتطوير فقط · قيم dev وهمية معزولة · منافذ مربوطة بـ `127.0.0.1` فقط.
> **ممنوع:** secrets/مفاتيح/API keys · ربط RPC/Solana/Jupiter/Helius/Jito · migrations · trading config · كود services · signing/sending · أي قدرة تداول.

## المتطلّبات
- Docker Desktop (daemon يعمل) — Compose v2+.

## التشغيل المحلي
```bash
cd infra/docker

# (اختياري) نسخ قيم dev القابلة للتعديل — .env مستثناة من git
cp .env.example .env

# التحقّق من صحّة الملف (لا يحتاج daemon)
docker compose -f compose.yaml config

# الإقلاع في الخلفية
docker compose -f compose.yaml up -d

# الحالة والصحّة
docker compose -f compose.yaml ps

# الإيقاف (مع الحفاظ على الـ volumes)
docker compose -f compose.yaml down

# الإيقاف وحذف البيانات المحلية
docker compose -f compose.yaml down -v
```

## فحص الاتصال (بعد الإقلاع)
```bash
# PostgreSQL
docker exec soltrade-postgres pg_isready -U soltrade -d soltrade_dev

# ClickHouse (HTTP ping)
docker exec soltrade-clickhouse wget -qO- http://127.0.0.1:8123/ping   # => Ok.

# Redis
docker exec soltrade-redis redis-cli ping                              # => PONG
```

## المنافذ (localhost فقط)
| الخدمة | المنفذ |
|---|---|
| PostgreSQL | `127.0.0.1:5432` |
| ClickHouse HTTP | `127.0.0.1:8123` |
| ClickHouse native | `127.0.0.1:9000` |
| Redis | `127.0.0.1:6379` |

> القيم الافتراضية في `compose.yaml` قابلة للتعديل عبر `.env` (انظر `.env.example`). **لا تضع أسراراً حقيقية.**
