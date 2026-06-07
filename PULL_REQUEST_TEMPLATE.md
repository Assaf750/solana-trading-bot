# Pull Request

> كل PR يستهلك أسماء `docs/01-SSOT.md` فقط ولا يعرّف اسماً جديداً. عند أي تعارض مع `CLAUDE.md`/`docs/00`–`12` تُغلَّب الوثيقة المعتمدة.

## Goal
<!-- هدف واحد قابل للقياس. -->

## Scope
<!-- ما يشمله / لا يشمله هذا الـ PR. Gate: A | B | C | D | E | Analytics-branch. -->

## SSOT names used
<!-- أسماء SSOT المستخدمة (مع المجموعة)، أو `none — internal-only`. -->

## Checklist (إلزامي — ضع ✅/❌ مع سطر تبرير)

- [ ] **No-SSOT-drift check** — لا `field`/`enum`/`event`/`command_type`/`resource_type`/`api_error_code`/`stream_channel`/`audit_scope`/threshold خارج `ARCH → SSOT`.
- [ ] **Candidate guard** — لا حذف بادئة `candidate_` · لا إعادة تسمية بلا ARCH→SSOT · لا candidate جديد خارج SSOT · **لا نقل `candidate_*` إلى implemented** (skeleton ≠ promotion).
- [ ] **Secrets check** — لا private key/seed/signer credential/auth token/raw provider key في الكود/logs/exports/backups/diagnostics/`.env` المُلتزَم. provider عبر `candidate_provider_key_ref` فقط.
- [ ] **No trading authority introduced** — لا signing/sending · لا تجاوز `order → sign → send` · لا أوامر فرص (`buy_/execute_/submit_opportunity`) · لا أمر خروج ذرّي · لا تحويل radar/`accepted`→تنفيذ · لا P&L محلي كمصدر حقيقة.
- [ ] **Tests/checks run** — unit/contract/integration/safety + النتيجة (أو سبب عدم الانطباق).
- [ ] **Docs impact** — هل تأثّر فهم أي وثيقة؟ (عادة لا — وثائق `10`+ تنفيذية).

## Notes / Open questions
<!-- أي غموض معماري وُقِف عنده، وما يفتحه دمج هذا الـ PR. -->
