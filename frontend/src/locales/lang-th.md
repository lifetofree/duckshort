# Thai Translations for DuckShort

This file contains all static text extracted from the frontend components, organized by the same structure as `lang-en.json`.

## Usage
Copy these values into the i18n system. The translation keys use dot notation (e.g., `common.close`).

---

## Common
```json
{
  "common": {
    "close": "ปิด",
    "copy": "คัดลอก",
    "copied": "คัดลอกแล้ว!",
    "loading": "กำลังประมวลผล...",
    "error": "ข้อผิดพลาด",
    "go": "ไป",
    "back": "← กลับ"
  }
}
```

---

## Home Page
```json
{
  "home": {
    "title": {
      "duck": "เป็ด",
      "short": "สั้น"
    },
    "tagline": "ส่งต่อด้วยความเร็วแสง",
    "quacksServed": "🦆 {{count}} ครั้งการใช้งาน",
    "tabs": {
      "shorten": "ย่อลิงก์",
      "viewStats": "ดูสถิติ"
    },
    "shortenForm": {
      "urlPlaceholder": "วาง URL ยาวของคุณที่นี่...",
      "customAliasPlaceholder": "ชื่อปรับแต่ง (ไม่บังคับ)...",
      "expiry": "หมดอายุ:",
      "expiryOptions": {
        "never": "ไม่หมดอายุ",
        "1hour": "1 ชั่วโมง",
        "24hours": "24 ชั่วโมง",
        "7days": "7 วัน",
        "30days": "30 วัน",
        "custom": "กำหนดเอง"
      },
      "customExpiryPlaceholder": "ชั่วโมง...",
      "burnOnRead": "ทำลายเมื่ออ่าน (แบบอัตโนมัติ)",
      "button": "ย่อ!",
      "errors": {
        "invalidUrl": "รูปแบบ URL ไม่ถูกต้อง",
        "invalidCustomId": "รหัสปรับแต่งต้องมี 3-50 ตัวอักษร (ตัวอักษร ตัวเลข ขีดล่าง ขีดกลาง)",
        "networkError": "ข้อผิดพลาดเครือข่าย เซิร์ฟเวอร์เบื้องหลังทำงานอยู่หรือไม่?",
        "failedToShorten": "ข้อผิดพลาด {{status}}: ไม่สามารถย่อลิงก์ได้"
      }
    },
    "statsForm": {
      "placeholder": "ใส่รหัสลิงก์หรือโค้ดสั้น...",
      "button": "ไป",
      "error": "ข้อผิดพลาดเครือข่าย"
    },
    "stats": {
      "totalVisits": "จำนวนการเข้าชมทั้งหมด",
      "topCountries": "ประเทศยอดนิยม",
      "topReferrers": "แหล่งอ้างอิงยอดนิยม"
    },
    "footer": "เวอร์ชัน {{version}}",
    "modal": {
      "title": "สร้างลิงก์แล้ว",
      "yourShortUrl": "URL สั้นของคุณ",
      "copyToClipboard": "คัดลอกไปยังคลิปบอร์ด",
      "transferComplete": "โอนย้ายเสร็จสิ้น"
    }
  }
}
```

---

## Duck Mood Labels
```json
{
  "duckMood": {
    "dormant": "หลับ",
    "active": "ตื่น",
    "busy": "ยุ่ง",
    "viral": "ไวรัล",
    "degraded": "ขัดข้อง"
  }
}
```

---

## Quack Counter
```json
{
  "quackCounter": {
    "served": "🦆 {{count}} ครั้งการใช้งาน"
  }
}
```

---

## Developer Mode Bar
```json
{
  "devModeBar": {
    "text": "โหมดพัฒนา"
  }
}
```

---

## Developer Mode Bar
```json
{
  "devModeBar": {
    "text": "โหมดพัฒนา"
  }
}
```

---

## Admin Page
```json
{
  "admin": {
    "title": "ผู้ดูแล",
    "comingSoon": "เร็วๆ นี้ — ใช้ SSR admin ของ Worker ที่ <a href=\"/admin-ssr\" class=\"underline\">/admin-ssr</a>",
    "back": "← กลับ"
  }
}
```

---

## Powered By
```json
{
  "poweredBy": "สนับสนุนโดย Adduckivity"
}
```

---

## Implementation Notes

To use these translations in the i18n system, the `lang-en.json` file needs to be extended to support Thai locale switching. Here's what needs to be done:

1. The `I18nProvider` should accept a `locale` prop
2. Create `lang-th.json` with the Thai translations above
3. Update `useTranslation` to use the correct locale file based on context or URL parameter

For now, the English file (`lang-en.json`) has been updated with the new keys, and components have been modified to use `translate()` for static text. The Thai translations above are ready to be used when locale switching is implemented.