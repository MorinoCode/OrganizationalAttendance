import { Language } from "../types"

export interface KnowledgeItem {
  id: string
  keywords: string[]
  category: "attendance" | "payroll" | "excel" | "security" | "settings" | "general"
  fa: {
    question: string
    answer: string
  }
  ar: {
    question: string
    answer: string
  }
  en: {
    question: string
    answer: string
  }
}

export const KNOWLEDGE_BASE: KnowledgeItem[] = [
  {
    id: "kiosk_punch",
    category: "attendance",
    keywords: ["تردد", "ورود", "خروج", "شیفت", "استراحت", "کیوسک", "پانچ", "دوام", "تسجيل", "دخول", "انصراف", "استراحة", "punch", "shift", "break", "kiosk"],
    fa: {
      question: "نحوه ثبت تردد و وقت استراحت پرسنل چگونه است؟",
      answer: "ثبت تردد از طریق صفحه «کیوسک ثبت تردد» انجام می‌شود:\n\n۱. **آغاز شیفت (Start Shift):** کارمند نام خود را از فهرست انتخاب کرده و دکمه آغاز شیفت را می‌زند. زمان دقیق ورود ثبت می‌شود.\n۲. **وقت استراحت (Start Break):** در طول شیفت، کارمند می‌تواند زمان استراحت را شروع و پایان دهد. دقایق استراحت به طور خودکار از کل کارکرد کسر می‌شود تا ساعت خالص محاسبه گردد.\n۳. **پایان شیفت (Finish Shift):** در پایان روز، با ثبت خروج، جمع ساعات خالص کارکرد به صورت ساعت و دقیقه محاسبه شده و شیفت خاتمه می‌یابد."
    },
    ar: {
      question: "كيف يتم تسجيل الحضور وأوقات الاستراحة؟",
      answer: "يتم تسجيل الدوام عبر شاشة «كشك تسجيل الحضور» بسهولة:\n\n١. **بدء الوردية (Start shift):** يحدد الموظف اسمه ويضغط على زر بدء الوردية، فيتم حفظ وقت الدخول بدقة.\n٢. **وقت الاستراحة (Start break):** يمكن للموظف تسجيل وقت الاستراحة وإنهاءها عند العودة. يتم خصم دقائق الاستراحة تلقائياً من إجمالي ساعات العمل.\n٣. **إنهاء الوردية (Finish shift):** عند نهاية الدوام، يتم احتساب الساعات الصافية تلقائياً بصيغة ساعات ودقائق وإغلاق الوردية."
    },
    en: {
      question: "How do attendance and breaks work?",
      answer: "Attendance logging is managed through the Kiosk page:\n\n1. **Start Shift:** The employee selects their name and clicks Start Shift. Exact punch-in time is recorded.\n2. **Break Time:** Employees can start and finish breaks anytime during their shift. Break minutes are automatically subtracted from gross shift duration.\n3. **Finish Shift:** Punching out calculates net worked duration in exact hours and minutes and completes the daily record."
    }
  },
  {
    id: "payroll_calculation",
    category: "payroll",
    keywords: ["حقوق", "محاسبه", "دستمزد", "اضافه کار", "کسورات", "فیش", "راتب", "رواتب", "حساب", "اضافي", "خصم", "payroll", "salary", "overtime", "calculation", "deduction"],
    fa: {
      question: "محاسبه حقوق، ساعات کارکرد و اضافه‌کاری چگونه انجام می‌شود؟",
      answer: "موتور محاسبه حقوق بر اساس تردد واقعی کارمندان عمل می‌کند:\n\n• **حقوق پایه:** بر اساس نوع قرارداد (ماهانه ثابت، روزانه یا ساعتی) محاسبه می‌شود.\n• **ساعات کارکرد خالص:** مجموع دقایق کارکرد در طول بازه به ساعت و دقیقه تبدیل می‌شود (بدون اعشار).\n• **اضافه‌کاری:** زمان مازاد بر ساعات مجاز شیفت، با ضریب استاندارد (قابل تنظیم در فیش) به مبلغ دریافتی اضافه می‌گردد.\n• **کسورات غیبت:** روزهایی که پرسنل بدون حضور بوده‌اند شناسایی شده و مبلغ روزانه از حقوق ناخالص کسر می‌شود.\n• **فیش حقوقی:** فیش آماده شامل خلاصه، مبالغ، جزئیات و بخش امضای کارفرما و کارمند است که قابل چاپ و صدور به اکسل می‌باشد."
    },
    ar: {
      question: "كيف يتم احتساب الراتب والساعات والعمل الإضافي؟",
      answer: "يعتمد محرك الرواتب على سجلات الحضور الفعلية:\n\n• **الراتب الأساسي:** يُحسب حسب نوع العقد (شهري ثابت، يومي، أو بالساعة).\n• **ساعات العمل الصافية:** يتم تجميع الدقائق الفعلية وتحويلها إلى ساعات ودقائق واضحة.\n• **العمل الإضافي:** تُحتسب الساعات الزائدة عن أوقات الدوام الرسمي وتُضاف للراتب بمعدل مضاعف قابل للتعديل.\n• **خصومات الغياب:** يُحسب الغياب تلقائياً للأيام التي لم يُسجل فيها دوام ويُخصم من إجمالي المستحقات.\n• **قسيمة الراتب:** توفر قسيمة رسمية قابلة للطباعة والتصدير بملف Excel والتوقيع اليدوي."
    },
    en: {
      question: "How are salary, worked hours, and overtime calculated?",
      answer: "The payroll engine derives payouts directly from actual punch logs:\n\n• **Base Salary:** Configured per employee (Monthly fixed, Daily rate, or Hourly rate).\n• **Net Worked Time:** Cumulative punch minutes formatted cleanly in hours and minutes.\n• **Overtime:** Hours worked beyond regular shifts are evaluated with a customizable overtime multiplier.\n• **Absence Deductions:** Days with no punch records are detected and deduced proportionally.\n• **Payslip:** Displays full earnings, deductions, net salary, and printable signature blocks."
    }
  },
  {
    id: "excel_export",
    category: "excel",
    keywords: ["اکسل", "خروجی", "دانلود", "گزارش", "فایل", "تصدير", "تقرير", "ملف", "excel", "export", "report", "spreadsheet"],
    fa: {
      question: "خروجی فایل اکسل چه مواردی را شامل می‌شود؟",
      answer: "خروجی اکسل پیشرفته پلتفرم در بخش «حضور و گزارش‌ها» و «فیش‌های حقوقی» در دسترس است:\n\n• **ساعات کارکرد به ساعت و دقیقه:** ستون ساعات کار خالص به فرمت دقیق متنی (مثلاً ۱ ساعت ۳۰ دقیقه) بدون اعشارهای نامفهوم درج می‌شود.\n• **اطلاعات کامل تردد:** تاریخ، نام روز، ساعت ورود، ساعت خروج، مدت استراحت و وضعیت شیفت.\n• **سطر سرجمع (Totals):** در انتهای فایل، سطر مجموع کل ساعات کارکرد و استراحت با فرمول استاندارد اکسل درج می‌گردد.\n• **قابلیت فیلتر:** می‌توانید گزارش را بر اساس کارمند خاص یا بازه‌های زمانی دلخواه (این ماه، ماه قبل، ۳۰ روز اخیر) فیلتر کرده و اکسل دریافت کنید."
    },
    ar: {
      question: "ماذا يتضمن ملف تقرير Excel الصادر؟",
      answer: "يوفر النظام تصديراً احترافياً لملفات Excel في شاشتي التقارير والرواتب:\n\n• **ساعات العمل بالصيغة النصية:** تُكتب الساعات بصيغة «ساعة ودقيقة» دقيقة وواضحة بدون كسور عشرية.\n• **تفاصيل السجلات:** يشمل التاريخ، اليوم، وقت الدخول، وقت الخروج، مدة الاستراحة، والملاحظات.\n• **صف المجموع العام:** يتضمن أسفل الجدول صف المجموع الإجمالي لكافة ساعات العمل والاستراحات.\n• **الفلاتر الزمنية:** إمكانية تصدير تقرير لموظف محدد أو لجميع الموظفين لفترات مخصصة (الشهر الحالي، السابق، إلخ)."
    },
    en: {
      question: "What is included in the exported Excel spreadsheet?",
      answer: "The platform's high-performance Excel exporter provides:\n\n• **Clean Duration Format:** Hours are exported in exact hours & minutes rather than decimals.\n• **Complete Attendance Logs:** Date, Day name, Punch-in, Punch-out, Break duration, and status.\n• **Summary Totals:** Trailing total row summarizing net worked duration and breaks.\n• **Custom Filtering:** Export by specific employee or date range (this month, last month, custom)."
    }
  },
  {
    id: "offline_security",
    category: "security",
    keywords: ["امنیت", "افلاین", "آفلاین", "دیتابیس", "پشتیبان", "بکاپ", "رمز", "پسورد", "حفظ", "أمان", "محلي", "قاعدة بيانات", "نسخ احتياطي", "offline", "security", "backup", "database", "password"],
    fa: {
      question: "امنیت داده‌ها، حالت آفلاین و پشتیبان‌گیری چگونه است؟",
      answer: "این پلتفرم با رویکرد Local-First و نهایت امنیت طراحی شده است:\n\n• **۱۰۰٪ آفلاین و محلی:** تمام اطلاعات در پایگاه‌داده محلی SQLite روی کامپیوتر شما ذخیره می‌شود و هیچ داده‌ای به سرورهای خارجی ارسال نمی‌گردد.\n• **پشتیبان‌گیری خودکار (Auto-Backup):** سیستم به طور مرتب نسخه‌های پشتیبان امن در پوشه اسناد شما ذخیره می‌کند.\n• **پشتیبان‌گیری دستی و بازیابی:** در تب تنظیمات می‌توانید در هر لحظه فایل بکاپ را در هر درایو ذخیره یا در صورت نیاز بازیابی کنید.\n• **رمز عبور امن:** ورود به بخش مدیریت نیازمند رمز عبور است و سیستم دارای قفل ضد حمله Brute-Force برای جلوگیری از ورود غیرمجاز می‌باشد."
    },
    ar: {
      question: "ما هي معايير الأمان والعمل دون اتصال والنسخ الاحتياطي؟",
      answer: "صُمم النظام ليعمل محلياً بالكامل بأعلى معايير الخصوصية والأمان:\n\n• **نظام محلي ١٠٠٪ (Offline):** تُحفظ كافة البيانات في قاعدة بيانات SQLite محلية بجهازك دون الاعتماد على الإنترنت.\n• **النسخ الاحتياطي التلقائي:** يُنشئ البرنامج نسخاً احتياطية دورية آمنة في مجلد المستندات.\n• **تصدير واستعادة النسخ:** يمكنك في أي وقت أخذ نسخة احتياطية على فلاش ميموري أو استعادتها من الإعدادات.\n• **حماية كلمة المرور:** وصول الإدارة محمي برمز مرور مع إغلاق أمني مؤقت ضد المحاولات المتكررة الخاطئة."
    },
    en: {
      question: "How does offline data storage and backups work?",
      answer: "The system runs on a strict Local-First architecture:\n\n• **100% Offline & Private:** All records reside inside a local SQLite database on your machine with zero cloud leaks.\n• **Automated Daily Backups:** Safe snapshot backups are saved regularly to your Documents folder.\n• **Manual Backup & Restore:** Export or restore full backups to external drives via Settings.\n• **Admin Protection:** Secured by an admin passcode with automatic brute-force lockout defense."
    }
  },
  {
    id: "system_settings",
    category: "settings",
    keywords: ["تنظیمات", "واحد پول", "دینار", "کویت", "تاخیر", "ساعت کار", "إعدادات", "عملة", "دينار", "سماحية", "settings", "currency", "grace", "kwd", "hours"],
    fa: {
      question: "تنظیمات پلتفرم، واحد پول و ساعات مجاز چگونه سفارشی‌سازی می‌شوند؟",
      answer: "از تب «تنظیمات» در پنل مدیریت می‌توانید سیستم را سفارشی‌سازی کنید:\n\n• **اطلاعات شرکت:** نام شرکت، نام مدیر و عنوان مدیریت.\n• **واحد پول و اعشار:** تنظیم واحد پول رسمی (مانند دینار کویت KWD، ریال، درهم، دلار) و تعداد اعشار.\n• **ساعت استاندارد شیفت:** تعیین طول شیفت معمول روزانه (مثلاً ۸ ساعت).\n• **مهلت تاخیر مجاز (Grace Period):** دقایق مجازی که کارمند می‌تواند بدون جریمه تاخیر ورود داشته باشد.\n• **به‌روزرسانی آنلاین:** دکمه بررسی نسخه جدید برای آپدیت خودکار نرم‌افزار بدون از دست رفتن هیچ داده‌ای."
    },
    ar: {
      question: "كيف يتم ضبط إعدادات العملة والوردية وسماحية التأخير؟",
      answer: "يمكنك تخصيص المنظومة بالكامل من تبويب «الإعدادات» في لوحة الإدارة:\n\n• **بيانات المنشأة:** اسم الشركة، اسم صاحب العمل، والصفة الإدارية.\n• **العملة والكسور:** ضبط العملة (مثل الدينار الكويتي KWD) وعدد الخانات العشرية.\n• **طول الوردية القياسية:** تحديد عدد ساعات الدوام اليومي المعتاد (مثل ٨ ساعات).\n• **فترة السماح (Grace Period):** عدد الدقائق المسموح بها للتأخر دون تسجيل مخالفة.\n• **التحديث التلقائي:** فحص وتنزيل أحدث إصدارات البرنامج بنقرة زر وبأمان تام."
    },
    en: {
      question: "How do platform settings, currency, and shift limits work?",
      answer: "In the Admin Settings panel, you can customize:\n\n• **Company Info:** Business name, owner name, and executive role.\n• **Currency & Decimals:** Default currency (e.g., Kuwaiti Dinar KWD) and fractional digits.\n• **Standard Shift Length:** Daily expected hours (e.g., 8 hours).\n• **Grace Period:** Grace minutes allowed for late punch-ins before penalty.\n• **Online Updates:** One-click check to download and install new releases safely."
    }
  }
]

export interface AIAssistantResponse {
  answer: string
  matchedTopic?: string
  suggestions: string[]
}

export function queryAIAssistant(prompt: string, lang: Language): AIAssistantResponse {
  const cleanPrompt = prompt.trim().toLowerCase()

  if (
    cleanPrompt.includes("سلام") ||
    cleanPrompt.includes("درود") ||
    cleanPrompt.includes("مرحبا") ||
    cleanPrompt.includes("اهلا") ||
    cleanPrompt.includes("hello") ||
    cleanPrompt.includes("hi") ||
    cleanPrompt.includes("hey")
  ) {
    if (lang === "fa") {
      return {
        answer: "سلام و درود! من دستیار هوشمند اختصاصی سیستم حضور و غیاب و حقوق هستم. خوشحالم که در کنارتان هستم. چه کمکی در مورد ثبت تردد، فیش‌های حقوقی، گزارشات اکسل یا تنظیمات سیستم از دست من برمی‌آید؟",
        suggestions: [
          "محاسبه حقوق و اضافه‌کاری چگونه است؟",
          "نحوه ثبت تردد در کیوسک چگونه کار می‌کند؟",
          "خروجی فایل اکسل شامل چه مواردی است؟"
        ]
      }
    }
    if (lang === "ar") {
      return {
        answer: "أهلاً وسهلاً بك! أنا المساعد الذكي الخاص بنظام الحضور والرواتب. يسعدني مساعدتك في كل ما يتعلق بالدوام، قسائم الرواتب، تقارير Excel، أو إعدادات النظام. ما هو استفسارك اليوم؟",
        suggestions: [
          "كيف يتم احتساب الراتب والعمل الإضافي؟",
          "كيف يعمل كشك تسجيل الدوام للموظفين؟",
          "ما هي مزايا تصدير تقارير Excel؟"
        ]
      }
    }
    return {
      answer: "Hello! I am the platform's AI Assistant. I'm here to guide you through attendance logging, payroll calculation, Excel reports, and security settings. How can I help you today?",
      suggestions: [
        "How is overtime and salary calculated?",
        "How does the kiosk punch-in work?",
        "What details are in the Excel export?"
      ]
    }
  }

  if (
    cleanPrompt.includes("کیستی") ||
    cleanPrompt.includes("کی هستی") ||
    cleanPrompt.includes("من انت") ||
    cleanPrompt.includes("who are you") ||
    cleanPrompt.includes("معرفی")
  ) {
    if (lang === "fa") {
      return {
        answer: "من هوش مصنوعی اختصاصی این پلتفرم هستم؛ طراحی شده‌ام تا به عنوان یک دستیار همراه، تمام قوانین محاسباتی حقوق و دستمزد، نحوه ثبت تردد، جزئیات گزارشات اکسل و امکانات امنیتی سیستم را به زبان ساده و حرفه‌ای برای شما توضیح دهم.",
        suggestions: [
          "امنیت و حالت آفلاین چگونه است؟",
          "تنظیمات واحد پول و ساعت کار کجاست؟",
          "چگونه فیش حقوقی صادر می‌شود؟"
        ]
      }
    }
    if (lang === "ar") {
      return {
        answer: "أنا المساعد الذكي الاصطناعي لهذه المنظومة. مهمتي إرشادك وتقديم شروحات شاملة حول إدارة أوقات الدوام، احتساب الأجور، النسخ الاحتياطي، وإعدادات المنشأة بأعلى درجات الدقة والوضوح.",
        suggestions: [
          "كيف يتم احتساب ساعات العمل والغياب؟",
          "أين أجد إعدادات النسخ الاحتياطي؟",
          "ما هي خيارات طباعة قسيمة الراتب؟"
        ]
      }
    }
    return {
      answer: "I am this platform's dedicated AI Assistant, specialized in guiding you through all attendance policies, payroll math, Excel reporting, and offline database security.",
      suggestions: [
        "How is net work time computed?",
        "Where are backup files saved?",
        "How to export employee Excel reports?"
      ]
    }
  }

  let bestMatch: KnowledgeItem | null = null
  let maxScore = 0

  for (const item of KNOWLEDGE_BASE) {
    let score = 0
    for (const kw of item.keywords) {
      if (cleanPrompt.includes(kw)) {
        score += 2
      }
    }
    const itemFaQ = item.fa.question.toLowerCase()
    const itemArQ = item.ar.question.toLowerCase()
    const itemEnQ = item.en.question.toLowerCase()

    const words = cleanPrompt.split(/\s+/)
    for (const w of words) {
      if (w.length > 2) {
        if (itemFaQ.includes(w) || itemArQ.includes(w) || itemEnQ.includes(w)) {
          score += 1
        }
      }
    }

    if (score > maxScore) {
      maxScore = score
      bestMatch = item
    }
  }

  if (bestMatch && maxScore >= 2) {
    const loc = lang === "fa" ? bestMatch.fa : lang === "ar" ? bestMatch.ar : bestMatch.en
    const otherItems = KNOWLEDGE_BASE.filter(i => i.id !== bestMatch?.id).slice(0, 3)
    const suggestions = otherItems.map(i => (lang === "fa" ? i.fa.question : lang === "ar" ? i.ar.question : i.en.question))

    return {
      answer: loc.answer,
      matchedTopic: bestMatch.id,
      suggestions
    }
  }

  if (lang === "fa") {
    return {
      answer: "من به طور اختصاصی برای راهنمایی درباره این سیستم حضور و غیاب و حقوق آموزش دیده‌ام. سوال شما در دانش پلتفرم دقیقاً مشخص نشد، اما می‌توانید درباره یکی از موضوعات زیر از من بپرسید تا راهنمایی‌تان کنم:\n\n۱. **ثبت تردد و شیفت‌ها** (کیوسک، استراحت، پایان شیفت)\n۲. **محاسبات مالی** (حقوق پایه، ساعات کارکرد، اضافه‌کاری، فیش حقوقی)\n۳. **فایل اکسل** (خروجی تردد و فیش‌ها با ساعت و دقیقه)\n۴. **پشتیبان‌گیری و امنیت** (دیتابیس آفلاین، بازیابی اطلاعات)",
      suggestions: [
        "نحوه ثبت تردد و وقت استراحت چگونه است؟",
        "محاسبه حقوق و اضافه‌کاری چگونه انجام می‌شود؟",
        "امنیت داده‌ها و پشتیبان‌گیری آفلاین چگونه است؟"
      ]
    }
  }

  if (lang === "ar") {
    return {
      answer: "أنا متخصص في الإجابة عن كل ما يخص نظام الحضور والرواتب هذا. لم أتعرف على سؤالك بدقة، لكن يمكنك سؤالي عن أي من المحاور التالية وسأجيبك فوراً:\n\n١. **تسجيل الحضور والورديات** (الكشك، الاستراحات، الدوام)\n٢. **احتساب الأجور والرواتب** (الراتب الأساسي، العمل الإضافي، قسائم الراتب)\n٣. **تصدير Excel** (تقارير الدوام التفصيلية)\n٤. **النسخ الاحتياطي والأمان** (العمل بدون إنترنت، حفظ واستعادة البيانات)",
      suggestions: [
        "كيف يتم تسجيل الحضور والورديات؟",
        "كيف يُحسب الراتب والعمل الإضافي؟",
        "ما هي معايير الأمان والنسخ الاحتياطي؟"
      ]
    }
  }

  return {
    answer: "I am specifically trained to assist with this Attendance & Payroll platform. I couldn't find an exact match for your inquiry, but feel free to ask about any of these core areas:\n\n1. **Attendance & Shift Punching** (Kiosk, break tracking, completion)\n2. **Payroll Engine** (Base pay, net hours, overtime, payslips)\n3. **Excel Export** (Attendance logs with hours & minutes)\n4. **Security & Offline Backups** (Local database, safe restores)",
    suggestions: [
      "How do attendance and breaks work?",
      "How are salary and overtime calculated?",
      "How does offline data storage and backups work?"
    ]
  }
}
