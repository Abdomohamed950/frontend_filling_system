# سيرفرات SCADA المتعددة

المزامنة بتتبعت لكل سيرفر `enabled = 1` **بالتوازي** (نفس خريطة القنوات `/scada-channels` لكل السيرفرات). فشل سيرفر (timeout / connection refused) بيتسجل في اللوج باسمه وعنوانه، ومش بيأثر على باقي السيرفرات ولا على التعبئة. لو مفيش سيرفر مفعّل، المزامنة بتتخطى بصمت.

## الـ endpoints (تحت `/api`)

### `GET /scada-servers` (تسجيل دخول)
```json
[{ "id": 1, "name": "Main", "host": "197.134.251.84", "port": 11001, "enabled": 1,
   "createdAt": "2025-01-01 10:00:00", "updatedAt": "2025-01-01 10:00:00" }]
```

### `PUT /scada-servers` (أدمن، زي `PUT /sync-settings`)
Body: `{ "servers": [{ "id"?, "name", "host", "port", "enabled" }] }`

بيستبدل القايمة كلها في transaction واحدة:
- عنصر فيه `id` موجود ← يتحدّث. من غير `id` ← يتضاف. أي صف مش في القايمة ← يتمسح (وحالة مزامنته كمان).
- `host`: نص مش فاضي. `port`: integer من 1 لـ 65535. `enabled`: `0`/`1` أو boolean (الافتراضي `1`). `name`: نص اختياري. ممنوع تكرار نفس `host:port`، ولا `id` مكرر، ولا `id` مش موجود.
- أي خطأ ← `400 { "error": "..." }` ومفيش أي تعديل.
- بيرجع القايمة بعد الحفظ. التعديل بيسري على أول تعبئة تالية من غير restart (القايمة بتتقرا عند كل تعبئة، والاتصالات القديمة بتتقفل).

`GET/PUT /sync-settings` شغالين للـ Receipt API. أعمدة `scadaEnabled/scadaHost/scadaPort` لسه موجودة فيه للتوافق لكن **مش بتتقرا في الإرسال**.

## الجداول (schema v7)
- `scada_servers(id, name, host, port, enabled, createdAt, updatedAt)`.
- `scada_sync_state(historyId, serverId, rowId, flowId, synced)`: الـ `row_id`/`flow_id` بيرجعوا من كل سيرفر لوحده، فاتنقلوا من أعمدة `history.scada*` (اللي بقت قديمة وملهاش استخدام).
- **Migration (مرة واحدة، لما النسخة < 7):** لو `sync_settings.scadaHost` و`scadaPort` مليانين بيتعمل منهم صف في `scada_servers` بـ `enabled = scadaEnabled`، وحالة مزامنة السجلات الحالية بتتنسخ له.

## المزامنة المتأخرة (retry)
- عند الإقلاع، لكل سيرفر مفعّل: السجلات المقفولة اللي `synced = 0` عنده بتتبعت (per-server). سيرفر واقع بيتخطّى من غير ما يأثر على غيره، وكل سيرفر له circuit breaker (30 ثانية) بتاعه.
- سيرفر جديد (أو اتفعّل) بيستلم من التعبئات اللي **تبدأ بعد إضافته** بس، مش التاريخ القديم. تعبئة بدأت قبل إضافته مبتتبعتلوش.

## إعادة المزامنة لسيرفر واحد عن فترة (resync)

job في الخلفية بيبعت سجلات `history` **المقفولة** (`exitTime` مش فاضي، و`entryTime` جوه الفترة، من الأقدم) لسيرفر واحد بس، بغض النظر عن `enabled`. الحالة في الذاكرة (بتتمسح بعد ساعة من الانتهاء أو مع إعادة التشغيل).

### `POST /api/scada-servers/:id/resync` (أدمن)
Body: `{ "from": "YYYY-MM-DD HH:MM:SS", "to": "YYYY-MM-DD HH:MM:SS" }`
- `404` سيرفر مش موجود، `400` فترة غلط (`from`/`to` ناقصين أو مش صالحين، `from > to`، أو أكتر من 31 يوم)، `409` فيه job شغال لنفس السيرفر (سيرفرين مختلفين مسموح بالتوازي).
- بيرجع فورًا `202 { "jobId", "total" }` ويكمل في الخلفية.

### `GET /api/scada-servers/:id/resync`
حالة آخر job للسيرفر (نفس شكل الـ event تحت)، أو `404` لو مفيش.

### `POST /api/scada-servers/:id/resync/cancel` (أدمن)
بيوقف الـ job بعد السجل الحالي (`status = "cancelled"`). `409` لو مفيش job شغال.

### Socket: `scada_resync_progress` (لكل العملاء)
```json
{ "jobId": "…", "serverId": 3, "status": "running|done|cancelled|failed",
  "total": 120, "done": 45, "sent": 40, "failed": 3, "skipped": 2,
  "from": "…", "to": "…", "message": "<سبب لو failed>" }
```
`done = sent + failed + skipped`. بيتبعت عند البدء (`done=0`)، وبعد السجلات بحد أقصى مرة كل ~300ms، وعند الانتهاء بالحالة النهائية دايمًا.

### السلوك
- `skipped`: منفذ من غير خريطة قنوات. `failed` (عدّاد): سجل فشل إرساله، والـ job بيكمل الباقي.
- `status = "failed"` بيوقف الـ job كله: السيرفر اتمسح أثناء التشغيل، أو فضل واقع أكتر من دقيقتين (`SCADA_RESYNC_UNREACHABLE_MS`). طول ما الـ circuit breaker (30 ثانية) فاتح، الـ job بيستنى ومبيحسبش السجلات فاشلة.
- تسلسلي بتأخير `SCADA_RESYNC_DELAY_MS` بين السجلات (الافتراضي 100ms).
- الإرسال بيستخدم نفس دالة المزامنة العادية (نفس القنوات والصيغة). السجل اللي نجح بيتحدّث صفه في `scada_sync_state` (`rowId`/`flowId` الجداد، `synced = 1`) من غير صف مكرر. لو الإرسال فشل، الحالة القديمة بتترجع. مفيش تعديل على `history` ولا عدّ النقلات.

### حذف قراءات الفترة من SQL Server قبل الإرسال
زي النظام القديم (`synchronize_log`)، الـ resync بيمسح قراءات الفترة من السيرفر الأول عشان ما يحصلش تكرار، بتنفيذ `[dbo].[CarMovements_DeleteReadings] @From, @To, @ChannelNumber`.

- **الإعدادات لكل سيرفر** (حقول اختيارية في `PUT /scada-servers`): `sqlHost`, `sqlPort` (الافتراضي 1433), `sqlDatabase`, `sqlUser`, `sqlPassword`. المفتاح الغايب بيسيب القيمة الحالية، و`null` أو `""` بيمسحها. الـ password مبيرجعش في أي response أبدًا: `GET`/`PUT` بيرجعوا `sqlPasswordSet: true|false` بدله.
- **التحقق:** `POST /scada-servers/:id/resync` بيرجع `400` لو ناقص `sqlHost` أو `sqlDatabase` أو `sqlUser` أو `sqlPassword` (والرسالة بتسمّي الناقص).
- **القنوات:** الـ procedure بتتنفذ لكل `truckCh` مختلفة في `/scada-channels` (كل البورتات، مش أول بورت بس زي القديم)، كلها في transaction واحدة: لو واحدة فشلت ولا حاجة بتتمسح.
- **الترتيب والأمان:** الحذف مرة واحدة قبل الإرسال، وبس لو `total > 0`. لو فشل (اتصال، صلاحيات، procedure مش موجودة) الـ job بيوقف بـ `status = "failed"` و`message = "delete before resync failed: …"` ومفيش إرسال خالص. مفيش أخطاء بتتبلع.
- **الـ event:** `scada_resync_progress` فيه حقل `phase`: `"deleting"` أثناء الحذف ثم `"sending"`.
- السيرفر بيتتصل بـ `encrypt: false` مع `trustServerCertificate: true`. الباسورد متخزن نص عادي في SQLite (زي بقية إعدادات المشروع)، فاحمي ملف `data/filling_system.db`.
