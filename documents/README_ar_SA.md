<br />
<div align="center">
  <a href="https://github.com/franciscoBSalgueiro/en-croissant">
    <img width="115" height="115" src="https://github.com/franciscoBSalgueiro/en-croissant/blob/master/src-tauri/icons/icon.png" alt="Logo">
  </a>

<h3 align="center">En Croissant</h3>

  <p align="center">
    مجموعة أدوات الشطرنج النهائية
    <br />
    <a href="https://www.encroissant.org"><strong>encroissant.org</strong></a>
    <br />
    <br />
    <a href="https://discord.gg/tdYzfDbSSW">خادم ديسكورد</a>
    ·
    <a href="https://www.encroissant.org/download">تحميل</a>
    .
    <a href="https://www.encroissant.org/docs">استكشف الوثائق</a>
  </p>
</div>

En-Croissant هو واجهة رسومية مفتوحة المصدر ومتعددة المنصات للشطرنج تهدف إلى أن تكون قوية وقابلة للتخصيص وسهلة الاستخدام.


## الميزات

- تخزين وتحليل ألعابك من [lichess.org](https://lichess.org) و [chess.com](https://chess.com)
- تحليل متعدد المحركات. يدعم جميع محركات UCI
- تحضير مجموعة افتتاحيات وتدريبها بالتكرار المتباعد
- تركيب وإدارة بسيط للمحركات وقواعد البيانات
- بحث عن مواضع مطلقة أو جزئية في قاعدة البيانات

<img src="https://github.com/franciscoBSalgueiro/encroisssant-site/blob/master/assets/showcase.webp" />

## البناء من المصدر

ارجع إلى [وثائق Tauri](https://tauri.app/v1/guides/getting-started/prerequisites) للمتطلبات على منصتك.

يستخدم En-Croissant pnpm كمدير حزم للتبعيات. ارجع إلى [تعليمات تثبيت pnpm](https://pnpm.io/installation) لكيفية تثبيته على منصتك.

```bash
git clone https://github.com/franciscoBSalgueiro/en-croissant
cd en-croissant
pnpm install
pnpm build
```

يمكن العثور على التطبيق المبني في `src-tauri/target/release`

## تبرع

إذا كنت ترغب في دعم تطوير هذه الواجهة الرسومية، يمكنك القيام بذلك [هنا](https://encroissant.org/support). جميع التبرعات موضع تقدير كبير!

## المساهمة

للمساهمة في هذا المشروع، يرجى الرجوع إلى [دليل المساهمة](./CONTRIBUTING.md).
## الرخصة
هذا البرنامج مرخص تحت رخصة GPL-3.0.
