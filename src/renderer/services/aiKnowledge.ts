import { Language } from "../types"

export interface KnowledgeItem {
  id: string
  keywords: string[]
  category: "attendance" | "payroll" | "excel" | "security" | "settings" | "leaves" | "employees"
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
    keywords: [
      "تردد", "ورود و خروج", "شروع شیفت", "پایان شیفت", "استراحت", "کیوسک", "پانچ", "ثبت ورود", "ثبت خروج",
      "تسجيل دوام", "تسجيل دخول", "تسجيل انصراف", "كشك", "استراحة", "بدء الوردية", "إنهاء الوردية",
      "kiosk punch", "start shift", "finish shift", "break time", "punch in", "punch out"
    ],
    fa: {
      question: "نحوه ثبت تردد و وقت استراحت پرسنل در کیوسک چگونه است؟",
      answer: "ثبت تردد از طریق صفحه «کیوسک ثبت تردد» به سادگی انجام می‌شود:\n\n۱. **آغاز شیفت:** کارمند نام خود را انتخاب کرده و دکمه آغاز شیفت را می‌زند. زمان دقیق ورود ثبت می‌گردد.\n۲. **شروع و پایان استراحت:** در طول شیفت، کارمند می‌تواند زمان استراحت را با دکمه استراحت شروع و هنگام بازگشت پایان دهد. دقایق استراحت به طور خودکار از کل زمان حضور کسر می‌شود.\n۳. **پایان شیفت:** در پایان زمان کاری، با زدن دکمه پایان شیفت، جمع ساعات خالص کارکرد به صورت ساعت و دقیقه محاسبه شده و شیفت بسته می‌شود."
    },
    ar: {
      question: "كيف يتم تسجيل الحضور وأوقات الاستراحة في الكشك؟",
      answer: "يتم تسجيل الدوام عبر شاشة «كشك تسجيل الحضور» بسهولة وسرعة:\n\n١. **بدء الوردية:** يحدد الموظف اسمه ويضغط على زر بدء الوردية، فيتم حفظ وقت الدخول بدقة بالغة.\n٢. **وقت الاستراحة:** يمكن للموظف تسجيل وقت الاستراحة وإنهاءها عند العودة. يتم خصم دقائق الاستراحة تلقائياً من إجمالي ساعات الحضور لحساب الوقت الصافي.\n٣. **إنهاء الوردية:** عند نهاية الدوام، يتم احتساب الساعات الصافية تلقائياً بصيغة ساعات ودقائق وإغلاق الوردية."
    },
    en: {
      question: "How do attendance punch-in and break tracking work in the Kiosk?",
      answer: "Attendance logging is managed through the Kiosk screen:\n\n1. **Start Shift:** The employee selects their name and clicks Start Shift. The exact punch-in timestamp is recorded.\n2. **Break Tracking:** Employees can pause for breaks and resume when returning. Break minutes are automatically subtracted from gross duration to determine net working time.\n3. **Finish Shift:** Punching out calculates cumulative net duration in exact hours and minutes and finalizes the shift record."
    }
  },
  {
    id: "multiple_shifts",
    category: "attendance",
    keywords: [
      "چند شیفت", "دو شیفت", "شیفت دوم", "صبح و عصر", "شکسته", "شیفت های چندگانه", "دو شیفته",
      "ورديات متعددة", "وردية ثانية", "ورديتين", "فترتين", "دوامين", "وردية صباحية ومسائية", "ورديات",
      "multiple shifts", "split shift", "split shifts", "two shifts", "second shift", "multiple shift"
    ],
    fa: {
      question: "آیا پرسنل می‌توانند در یک روز چند شیفت کاری ثبت کنند؟",
      answer: "بله، پلتفرم به طور کامل از ثبت چند شیفت در یک روز (مانند شیفت صبح و عصر) پشتیبانی می‌کند:\n\n• پس از پایان شیفت اول، در همان روز کارمند می‌تواند مجدداً شیفت کاری جدیدی را آغاز کند.\n• سیستم هر شیفت را به عنوان یک رکورد مجزا با زمان ورود، خروج و استراحت ثبت می‌کند.\n• در بخش گزارش‌ها و فیش حقوقی، ساعات کارکرد کلیه شیفت‌های روزانه با هم جمع شده و تعداد روزهای واقعی کاری بدون تکرار محاسبه می‌گردد."
    },
    ar: {
      question: "هل يمكن للموظف تسجيل أكثر من وردية في نفس اليوم؟",
      answer: "نعم، يدعم النظام تسجيل ورديات متعددة في اليوم الواحد (مثل دوام الصباح والمساء):\n\n• بعد إنهاء الوردية الأولى، يمكن للموظف في نفس اليوم بدء وردية عمل جديدة بكل سهولة.\n• يتم حفظ كل وردية بسجل مستقل يتضمن أوقات الدخول والخروج والاستراحة.\n• في التقارير وحساب الرواتب، يتم تجميع ساعات كافة ورديات اليوم معاً واحتساب يوم العمل الفعلي بدون أي ازدواجية."
    },
    en: {
      question: "Can employees log multiple or split shifts on the same day?",
      answer: "Yes, the system fully supports multiple or split shifts per day (e.g., morning and evening shifts):\n\n• After finishing a morning shift, the employee can start a new shift later the same day.\n• Each shift maintains its own punch-in, punch-out, and break intervals.\n• In reporting and payroll, durations across all shifts of the day are seamlessly aggregated, and distinct working days are accurately computed."
    }
  },
  {
    id: "attendance_correction",
    category: "attendance",
    keywords: [
      "اصلاح تردد", "ویرایش تردد", "فراموشی ثبت", "تغییر ساعت", "اصلاح سابقه", "ویرایش ورود", "ویرایش خروج", "اصلاح دستی",
      "تعديل الحضور", "تصحيح الدوام", "نسيان البصمة", "تعديل الوقت", "تصحيح", "تعديل ورود", "تعديل انصراف",
      "attendance correction", "edit attendance", "correct punch", "adjust hours", "edit punch", "edit punch in", "edit punch out", "edit time", "edit times", "correction"
    ],
    fa: {
      question: "چگونه می‌توان سوابق تردد پرسنل را اصلاح یا ویرایش کرد؟",
      answer: "مدیر سیستم در پنل مدیریت می‌تواند هر رکورد تردد را در صورت لزوم اصلاح کند:\n\n۱. در تب «حضور و گزارش‌ها»، بر روی دکمه ویرایش (آیکون مداد) کنار رکورد مورد نظر کلیک کنید.\n۲. پنجره اصلاح تردد باز می‌شود که به شما امکان می‌دهد ساعت ورود، ساعت خروج و مدت دقایق استراحت را تغییر دهید یا وضعیت رکورد را دستی به پایان‌یافته تبدیل کنید.\n۳. تمامی اصلاحات به صورت شفاف در دفترچه رخدادهای سیستم (Audit Logs) ثبت می‌شوند."
    },
    ar: {
      question: "كيف يمكن للمدير تعديل أو تصحيح سجلات الحضور والانصراف؟",
      answer: "يمكن للمدير من لوحة الإدارة تعديل أي سجل دوام عند الحاجة:\n\n١. من شاشة «الحضور والتقارير»، اضغط على أيقونة التعديل (القلم) بجانب السجل المراد تصحيحه.\n٢. تفتح نافذة تعديل الحضور لتغيير وقت الدخول، وقت الخروج، ودقائق الاستراحة، أو تحويل الحالة إلى مكتملة.\n٣. تُسجل كافة التعديلات في سجل التدقيق الأمني (Audit Logs) لضمان الشفافية والموثوقية."
    },
    en: {
      question: "How can managers edit or correct attendance records?",
      answer: "Administrators can correct any attendance record directly from the Admin Dashboard:\n\n1. In the 'Attendance & Reports' tab, click the edit (pencil) icon next to the record.\n2. The correction modal allows adjusting punch-in time, punch-out time, break duration, or marking the record completed.\n3. All manual adjustments are automatically tracked inside the tamper-resistant Audit Logs for transparency."
    }
  },
  {
    id: "leave_management",
    category: "leaves",
    keywords: ["مرخصی", "استعلاجی", "بدون حقوق", "با حقوق", "کسر مرخصی", "إجازة", "إجازات", "مرضية", "بدون راتب", "مدفوعة", "leave", "leaves", "sick leave", "unpaid leave", "paid leave"],
    fa: {
      question: "ثبت و مدیریت مرخصی‌ها و تاثیر مرخصی بدون حقوق بر دستمزد چگونه است؟",
      answer: "مدیریت مرخصی‌ها از تب اختصاصی «مرخصی‌ها» در پنل مدیریت انجام می‌شود:\n\n• **انواع مرخصی:** امکان ثبت مرخصی باحقوق (Paid)، بدون حقوق (Unpaid) و استعلاجی (Sick) وجود دارد.\n• **تعیین بازه زمانی:** تاریخ شروع و پایان به همراه تعداد روزها و توضیحات ثبت می‌شود.\n• **تاثیر بر حقوق:** روزهای مرخصی بدون حقوق در دوره کاری به طور خودکار شناسایی شده و در محاسبه فیش حقوقی از دستمزد کسر می‌گردد، در حالی که مرخصی باحقوق باعث کسر حقوق نمی‌شود."
    },
    ar: {
      question: "كيف تتم إدارة الإجازات وما أثر الإجازة بدون راتب على الأجر؟",
      answer: "تتم إدارة الإجازات عبر تبويب «الإجازات» في لوحة الإدارة:\n\n• **أنواع الإجازات:** تشمل الإجازة مدفوعة الأجر، الإجازة بدون راتب، والإجازة المرضية.\n• **تحديد الفترة:** يتم تسجيل تاريخ البدء والانتهاء وعدد الأيام مع إمكانية إضافة الملاحظات.\n• **التأثير على الراتب:** تُحتسب أيام الإجازة بدون راتب تلقائياً وتُخصم قيمتها من قسيمة الراتب، بينما تحتفظ الإجازة المدفوعة بكامل مستحقات الموظف."
    },
    en: {
      question: "How are employee leaves managed and how does unpaid leave affect payroll?",
      answer: "Leaves are administered through the 'Leaves' section in the Admin Dashboard:\n\n• **Leave Types:** Supports Paid leave, Unpaid leave, and Sick leave.\n• **Date Ranges:** Records start date, end date, total days, and optional notes.\n• **Payroll Impact:** Unpaid leave days occurring within a pay period are automatically factored into the payroll engine and deducted from gross earnings, whereas paid leaves do not penalize salary."
    }
  },
  {
    id: "payroll_calculation",
    category: "payroll",
    keywords: ["حقوق", "محاسبه", "دستمزد", "اضافه کار", "کسورات", "فیش", "راتب", "رواتب", "حساب", "اضافي", "خصم", "payroll", "salary", "overtime", "calculation", "deduction"],
    fa: {
      question: "محاسبه حقوق، ساعات کارکرد و اضافه‌کاری چگونه انجام می‌شود؟",
      answer: "موتور محاسبه حقوق بر اساس تردد واقعی کارمندان عمل می‌کند:\n\n• **حقوق پایه:** بر اساس نوع قرارداد کارمند (ماهانه ثابت، روزانه بر اساس روزهای حضور، یا ساعتی بر اساس ساعات خالص) محاسبه می‌شود.\n• **ساعات کارکرد خالص:** دقایق تردد واقعی در بازه انتخاب‌شده جمع شده و به ساعت و دقیقه تبدیل می‌گردد.\n• **اضافه‌کاری:** ساعات کارکرد مازاد بر شیفت موظف، با ضریب استاندارد (قابل تنظیم در فیش) به عنوان اضافه کار محاسبه و اضافه می‌شود.\n• **پاداش و کسورات:** امکان اضافه کردن پاداش‌های تشویقی و کسورات متفرقه قبل از صدور نهایی فیش وجود دارد."
    },
    ar: {
      question: "كيف يتم احتساب الراتب وساعات العمل الإضافي والخصومات؟",
      answer: "يعتمد محرك الرواتب على سجلات الحضور الفعلية بدقة رياضية متناهية:\n\n• **الراتب الأساسي:** يُحسب وفق نوع عقد الموظف (شهري ثابت، يومي بحسب أيام الدوام، أو بالساعة للوقت الصافي).\n• **ساعات العمل الصافية:** يتم تجميع الدقائق الفعلية وتحويلها إلى ساعات ودقائق صريحة بدون كسور معقدة.\n• **العمل الإضافي:** تُحتسب الساعات التي تتجاوز الوردية النظامية وتُضرب في معامل الإضافي المعتمد في الإعدادات.\n• **المكافآت والخصومات:** إمكانية إضافة مكافآت أو استقطاعات مخصصة قبل اعتماد قسيمة الراتب النهائية."
    },
    en: {
      question: "How are employee salaries, worked hours, and overtime calculated?",
      answer: "The payroll engine derives net payouts mathematically from verified attendance records:\n\n• **Base Salary:** Calculated by contract type (Fixed Monthly, Daily based on attended days, or Hourly based on net worked hours).\n• **Net Worked Duration:** Actual punch minutes summed across the pay period and displayed in clean hours and minutes.\n• **Overtime:** Time worked beyond standard contractual hours is compensated using the configured overtime multiplier.\n• **Bonuses & Deductions:** Custom bonuses, loan repayments, or penalties can be added before final payslip confirmation."
    }
  },
  {
    id: "payslip_actions",
    category: "payroll",
    keywords: ["پیش نمایش فیش", "امضای فیش", "چاپ فیش", "رسید حقوق", "معاينة القسيمة", "توقيع الراتب", "طباعة القسيمة", "إيصال الاستلام", "payslip preview", "sign payslip", "print payslip", "salary receipt"],
    fa: {
      question: "پیش‌نمایش فیش حقوقی، امضای دیجیتال و چاپ رسید رسمی چگونه کار می‌کند؟",
      answer: "در تب «فیش‌های حقوقی» امکانات کاملی برای تسویه حساب پرسنل تعبیه شده است:\n\n• **پیش‌نمایش فیش (Preview):** با کلیک روی آیکون چشم، فیش استاندارد شامل جزئیات کارکرد، پایه، اضافه‌کار و خالص پرداختی نمایش داده می‌شود.\n• **امضای دیجیتال:** مدیر می‌تواند وضعیت فیش را با یک کلیک به «امضا شده (Signed)» تغییر دهد تا پرداخت آن تایید گردد.\n• **چاپ استاندارد A4:** دکمه چاپ یک نسخه کاملاً استاندارد به همراه متن اقرارنامه دریافت حقوق و کادرهای مشخص امضای کارفرما و کارمند تولید می‌کند."
    },
    ar: {
      question: "كيف تعمل معاينة قسيمة الراتب والتوقيع الإلكتروني والطباعة الرسمية؟",
      answer: "توفر شاشة «قسائم الرواتب» أدوات تسوية شاملة واحترافية:\n\n• **المعاينة الفورية:** بالضغط على رمز العين، تظهر قسيمة الراتب المفصلة بجميع بنود الاستحقاقات والاستقطاعات.\n• **التوقيع الإلكتروني:** يمكن للمدير وسم القسيمة كـ «موقعة ومستلمة» بنقرة زر واحدة لتوثيق الصرف.\n• **الطباعة الرسمية A4:** يتضمن قالب الطباعة إقرار استلام الراتب وخانات مخصصة لتوقيع صاحب العمل وتوقيع الموظف."
    },
    en: {
      question: "How do payslip previewing, digital signing, and formal receipt printing work?",
      answer: "The 'Payslips' tab provides end-to-end salary settlement capabilities:\n\n• **Payslip Preview:** Clicking the eye icon opens the structured payslip detailing hours, base pay, overtime, and net payout.\n• **Digital Signing:** Admins can mark payslips as Signed to document employee payout verification.\n• **A4 Receipt Printing:** Generates a ready-to-print salary receipt complete with formal acknowledgment terms and signature boxes for both employer and employee."
    }
  },
  {
    id: "whatsapp_payslip",
    category: "payroll",
    keywords: ["واتساپ", "ارسال فیش", "پیام رسان", "واتس اب", "ارسال به کارمند", "واتساب", "إرسال القسيمة", "رسالة واتساب", "whatsapp", "send payslip", "message", "share"],
    fa: {
      question: "نحوه ارسال فیش حقوقی از طریق واتساپ به کارمند چگونه است؟",
      answer: "سیستم دارای قابلیت اتصال مستقیم به واتساپ است:\n\n۱. در صورت ثبت شماره موبایل برای کارمند، دکمه سبز رنگ واتساپ در پنجره پیش‌نمایش فیش و جدول فیش‌ها فعال می‌شود.\n۲. با زدن دکمه واتساپ، یک پیام زیبا و رسمی شامل نام کارمند، بازه پرداخت، ساعات کارکرد خالص، اضافه‌کاری و مبلغ نهایی دریافتی آماده شده و از طریق وب‌سایت رسمی واتساپ (wa.me) ارسال می‌گردد."
    },
    ar: {
      question: "كيف يتم إرسال قسيمة الراتب عبر تطبيق واتساب للموظف؟",
      answer: "يتضمن النظام تكاملاً مباشراً مع تطبيق واتساب لسهولة التواصل:\n\n١. عند تسجيل رقم هاتف للموظف، تظهر أيقونة واتساب الخضراء في جدول وقسائم الرواتب.\n٢. بمجرد الضغط عليها، يتم إعداد رسالة رسمية منسقة تتضمن اسم الموظف، فترة الاستحقاق، ساعات الدوام، والراتب الصافي، وفتح محادثة واتساب الرسمية (wa.me) للإرسال الفوري."
    },
    en: {
      question: "How does sending payslips directly via WhatsApp work?",
      answer: "The application features seamless WhatsApp integration:\n\n1. When an employee profile contains a phone number, the green WhatsApp action button is active on their payslip.\n2. Clicking it opens a pre-formatted official text via wa.me, summarizing pay period, worked hours, overtime, and final net payout directly to the employee's mobile."
    }
  },
  {
    id: "excel_export",
    category: "excel",
    keywords: ["اکسل", "خروجی", "دانلود", "گزارش", "فایل", "تصدير", "تقرير", "ملف", "excel", "export", "report", "spreadsheet"],
    fa: {
      question: "خروجی فایل اکسل چه مواردی را شامل می‌شود و چگونه صادر می‌گردد؟",
      answer: "موتور صدور اکسل نرم‌افزار به صورت استریمینگ و بسیار پرسرعت عمل می‌کند:\n\n• **خروجی حضور و غیاب:** شامل تاریخ، نام روز، ساعت ورود، ساعت خروج، مدت استراحت و ساعت کار خالص به فرمت دقیق ساعت و دقیقه (بدون اعشار).\n• **دفتر کل فیش‌های حقوقی:** شامل شماره فیش، مشخصات کارمند، ساعات کار، اضافه‌کار، حقوق پایه، پاداش، کسورات و خالص دریافتی.\n• **سطر فرمول سرجمع (Totals):** در انتهای فایل‌ها سطر مجموع خودکار با فرمول اکسل درج می‌گردد."
    },
    ar: {
      question: "ماذا تتضمن ملفات Excel المصدرة وكيف يتم تنزيلها؟",
      answer: "يعمل محرك تصدير Excel بتقنية التدفق السريع للبيانات الضخمة:\n\n• **تقرير الحضور والدوام:** يتضمن التاريخ، اسم اليوم، وقت الدخول، وقت الخروج، مدة الاستراحة، وساعات العمل الصافية بصيغة ساعات ودقائق صريحة.\n• **دفتر قسائم الرواتب:** يشمل رقم القسيمة، بيانات الموظف، ساعات العمل، الإضافي، الراتب الأساسي، والراتب الصافي.\n• **معادلات المجموع الإجمالي:** يختتم الملف بصف إجمالي يعتمد صيغ Excel الرياضية لجمع الساعات والمبالغ تلقائياً."
    },
    en: {
      question: "What is included in the exported Excel workbooks and how are they generated?",
      answer: "The streaming Excel engine produces production-grade workbooks efficiently:\n\n• **Attendance Reports:** Includes record date, weekday, punch-in, punch-out, break duration, and net hours formatted in exact hours & minutes without confusing decimals.\n• **Payroll Ledger:** Captures payslip numbers, employee codes, base earnings, overtime hours, deductions, and net payouts.\n• **Formula Total Rows:** Concludes with an automated total row using native Excel formulas."
    }
  },
  {
    id: "employee_management",
    category: "employees",
    keywords: ["کارمند", "افزودن کارمند", "قرارداد", "حذف کارمند", "غیرفعال", "موظف", "إضافة موظف", "عقد", "حذف موظف", "تعطيل", "employee", "add employee", "delete employee", "deactivate"],
    fa: {
      question: "نحوه تعریف کارمندان، نوع قرارداد و قانون عدم حذف کارمند دارای سابقه چیست؟",
      answer: "مدیریت پرسنل از صفحه «کارمندان» انجام می‌شود:\n\n• **انواع قرارداد دستمزد:** ماهانه ثابت (Monthly)، روزانه (Daily) و ساعتی (Hourly).\n• **کد کارمندی و بخش:** تخصیص کد یکتا و دپارتمان کاری برای تفکیک گزارش‌ها.\n• **فعال یا غیرفعال‌سازی:** به جای حذف، می‌توانید کارمند را غیرفعال کنید تا در کیوسک تردد نشان داده نشود اما سوابقش حفظ شود.\n• **حفاظت دیتابیس:** سیستم به دلایل حسابداری اجازه حذف پرسنلی که سابقه تردد، فیش یا مرخصی دارند را نمی‌دهد."
    },
    ar: {
      question: "كيف يتم تعريف الموظفين وأنواع العقود وما هي شروط حذف الموظف؟",
      answer: "تتم إدارة الكادر الوظيفي من شاشة «الموظفون»:\n\n• **أنواع العقود المالية:** راتب شهري ثابت، أجر يومي، أو أجر بالساعة.\n• **الرمز الوظيفي والقسم:** تعيين كود مميز وقسم عمل لكل موظف لتنظيم السجلات.\n• **التعطيل بدلاً من الحذف:** يمكن إيقاف تفعيل الموظف لمنعه من تسجيل الدوام في الكشك مع الحفاظ الكامل على أرشيفه المالي.\n• **حماية البيانات التاريخية:** يمنع النظام حذف أي موظف ارتبطت به سجلات حضور، قسائم رواتب، أو إجازات سابقة لحماية الدفاتر المحاسبية."
    },
    en: {
      question: "How are employees created, what are contract types, and why can't employees with history be deleted?",
      answer: "Employee records are managed from the 'Employees' tab:\n\n• **Contract Types:** Monthly fixed, Daily rate, or Hourly rate.\n• **Employee Code & Department:** Assign unique identifiers and department tags for targeted reporting.\n• **Deactivation:** Inactive employees are hidden from the Kiosk punch list while keeping their complete audit trail intact.\n• **Deletion Protection:** Strict database rules prohibit deleting employees with existing attendance, payroll, or leave history to preserve audit integrity."
    }
  },
  {
    id: "offline_security_backup",
    category: "security",
    keywords: ["امنیت", "افلاین", "آفلاین", "دیتابیس", "پشتیبان", "بکاپ", "بازیابی", "أمان", "محلي", "قاعدة بيانات", "نسخ احتياطي", "استعادة", "offline", "security", "backup", "restore", "database"],
    fa: {
      question: "امنیت داده‌ها، حالت آفلاین و پشتیبان‌گیری خودکار و دستی چگونه عمل می‌کند؟",
      answer: "این پلتفرم با رویکرد Local-First و بالاترین درجه امنیت مهندسی شده است:\n\n• **۱۰۰٪ آفلاین:** پایگاه داده محلی SQLite روی کامپیوتر شما مستقر است و هیچ داده‌ای در فضای ابری به اشتراک گذاشته نمی‌شود.\n• **پشتیبان‌گیری خودکار:** سیستم در زمان شروع و به طور روزانه در پوشه Documents نسخه پشتیبان مطمئن تهیه و فایل‌های قدیمی را پاکسازی می‌کند.\n• **پشتیبان‌گیری دستی و بازیابی:** در تب تنظیمات می‌توانید در هر لحظه بکاپ را روی فلش‌مموری ذخیره کرده یا فایل پشتیبان را بازگردانی نمایید."
    },
    ar: {
      question: "ما هي معايير الأمان والعمل بدون إنترنت والنسخ الاحتياطي التلقائي واليدوي؟",
      answer: "صُممت المنظومة محلياً بالكامل (Local-First) لحماية سرية منشأتك:\n\n• **محلي ١٠٠٪ دون إنترنت:** تُحفظ كافة السجلات في قاعدة بيانات SQLite محلية بجهازك دون أي اتصال بسحابة خارجية.\n• **النسخ التلقائي المنظم:** ينشئ البرنامج نسخاً احتياطية دورية في مجلد المستندات ويحتفظ بأحدث النسخ تلقائياً.\n• **التصدير والاستعادة:** يمكنك أخذ نسخة احتياطية فورية على قرص خارجي أو استرجاع بياناتك بنقرة زر من الإعدادات."
    },
    en: {
      question: "How do offline data privacy, automated backups, and manual restores operate?",
      answer: "The platform operates on a strict, hardened Local-First architecture:\n\n• **100% Offline Privacy:** Data lives securely inside a local SQLite database file on your PC without external cloud exposure.\n• **Automated Rolling Backups:** Routine snapshots are archived to your Documents folder upon startup with automatic pruning.\n• **Manual Backup & Restore:** Easily export full snapshots to USB flash drives or preview and restore backups from the Settings pane."
    }
  },
  {
    id: "admin_passcode_recovery",
    category: "security",
    keywords: ["رمز عبور", "رمز مدیر", "فراموشی رمز", "بازیابی رمز", "قفل امنیتی", "کلمه مرور", "نسيان كلمة المرور", "استعادة الرمز", "قفل الحماية", "admin passcode", "password recovery", "forgot password", "emergency reset"],
    fa: {
      question: "رمز عبور مدیریت، قفل امنیتی ضد حمله و روش بازیابی اضطراری رمز چگونه است؟",
      answer: "بخش مدیریت مجهز به تدابیر امنیتی پیشرفته است:\n\n• **رمز عبور قوی:** ورود به پنل نیازمند رمز عبور تعیین‌شده در راه‌اندازی اولیه است.\n• **قفل ضد حمله (Brute-Force):** در صورت ۵ بار تلاش ناموفق پیاپی، سیستم موقتاً دسترسی را قفل می‌کند.\n• **بازیابی اضطراری (Emergency Recovery):** در صورت فراموشی رمز، با ۵ بار کلیک سریع روی آیکون قفل در کادر ورود، حالت بازیابی باز می‌شود و با وارد کردن پاسخ امنیتی شرکت، می‌توانید بدون از دست رفتن هیچ داده‌ای رمز جدید تعیین کنید."
    },
    ar: {
      question: "كيف تعمل حماية رمز المرور والإغلاق الأمني وطريقة استعادة الرمز المفقود؟",
      answer: "تخضع لوحة الإدارة لإجراءات أمان صارمة:\n\n• **حماية الوصول:** تتطلب شاشة الإدارة إدخال رمز المرور المعتمد أثناء التثبيت.\n• **الحماية ضد التخمين:** يتم إغلاق نافذة الدخول مؤقتاً عند تكرار ٥ محاولات خاطئة.\n• **الاسترداد الطارئ:** في حال نسيان الرمز، اضغط ٥ مرات متتالية وسريعة على أيقونة القفل لفتح نافذة الاسترداد، وبإدخال كود التحقق للمنشأة يمكنك تعيين كلمة مرور جديدة فوراً دون فقدان أي بيانات."
    },
    en: {
      question: "How do admin passcode protection, brute-force defense, and emergency recovery work?",
      answer: "Administrative access is safeguarded by strict defense mechanisms:\n\n• **Admin Authentication:** Management requires the passcode established during initial setup.\n• **Brute-Force Protection:** Automatically locks input after 5 failed attempts within a 60-second window.\n• **Emergency Recovery:** If a password is lost, clicking the lock icon 5 times in 3 seconds unlocks the Emergency Recovery dialog, enabling immediate passcode reset via company verification credentials without any data loss."
    }
  },
  {
    id: "system_settings",
    category: "settings",
    keywords: ["تنظیمات", "واحد پول", "دینار", "کویت", "تاخیر", "ساعت کار", "آپدیت", "إعدادات", "عملة", "دينار", "سماحية", "تحديث", "settings", "currency", "grace period", "kwd", "updater"],
    fa: {
      question: "تنظیمات اطلاعات شرکت، واحد پول، مهلت تاخیر و آپدیت آنلاین چگونه است؟",
      answer: "در تب «تنظیمات» می‌توانید کل سامانه را شخصی‌سازی کنید:\n\n• **مشخصات شرکت:** ویرایش نام کسب‌وکار، نام مدیر و سمت رسمی.\n• **واحد پول و اعشار:** تنظیم واحد پول رسمی (مانند دینار کویت KWD) و تعداد ارقام اعشار (مثلاً ۳ رقم برای فلس کویت).\n• **مهلت تاخیر مجاز (Grace Period):** تعیین دقایق مجاز تاخیر ورود روزانه.\n• **ساعت استاندارد روزانه:** تعیین ساعات تعهد روزانه (مثلاً ۸ ساعت).\n• **به‌روزرسانی آنلاین:** بررسی و دریافت نسخه‌های جدید نرم‌افزار بدون نیاز به تنظیم مجدد."
    },
    ar: {
      question: "كيف يتم ضبط إعدادات المنشأة، العملة، فترة السماح، والتحديثات؟",
      answer: "يوفر تبويب «الإعدادات» خيارات تهيئة شاملة للمنظومة:\n\n• **بيانات المنشأة:** اسم الشركة، اسم المدير، والصفة الرسمية.\n• **العملة والكسور:** ضبط العملة المعتمدة (مثل الدينار الكويتي KWD) وعدد الخانات العشرية (٣ خانات للفلس).\n• **فترة السماح (Grace Period):** عدد الدقائق المسموح بها للتأخر الصباحي دون احتساب خصم.\n• **الدوام اليومي القياسي:** تحديد ساعات العمل المستهدفة للوردية (مثل ٨ ساعات).\n• **التحديث المباشر:** فحص وتثبيت تحديثات البرنامج الجديدة بنقرة واحدة وبأمان تام."
    },
    en: {
      question: "How do company preferences, currency, grace periods, and online updates work?",
      answer: "The 'Settings' panel provides centralized configuration control:\n\n• **Company Profile:** Update company name, owner name, and executive title.\n• **Currency & Decimals:** Set operating currency (e.g., Kuwaiti Dinar KWD) and decimal precision (e.g., 3 decimals for fils).\n• **Grace Period:** Configurable grace minutes allowed for punch-in delays before registering tardiness.\n• **Standard Hours:** Daily expected shift commitment (e.g., 8 hours).\n• **Online Updater:** Integrated one-click update checker to download and apply new versions safely."
    }
  }
]

export interface AIAssistantResponse {
  answer: string
  matchedTopic?: string
  suggestions: string[]
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[؟?.,!،;:()_/-]/g, " ")
    .replace(/[أإآ]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[ي]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/\s+/g, " ")
    .trim()
}

export function queryAIAssistant(prompt: string, lang: Language): AIAssistantResponse {
  const cleanPrompt = normalizeText(prompt)
  const promptWords = cleanPrompt.split(/\s+/)

  const isGreeting = promptWords.some(w => ["سلام", "درود", "مرحبا", "اهلا", "أهلا", "hello", "hi", "hey"].includes(w))

  if (isGreeting) {
    if (lang === "fa") {
      return {
        answer: "سلام و درود! من دستیار هوشمند اختصاصی پلتفرم حضور و غیاب و حقوق هستم. در تمام زمینه‌های ثبت تردد، شیفت‌های چندگانه، مرخصی‌ها، محاسبه فیش حقوقی، گزارشات اکسل، ارسال واتساپ و امنیت سیستم آماده پاسخگویی هستم. چه سوالی دارید؟",
        suggestions: [
          "نحوه ثبت تردد و وقت استراحت در کیوسک چگونه است؟",
          "آیا امکان ثبت چند شیفت در یک روز وجود دارد؟",
          "محاسبه حقوق و اضافه‌کاری چگونه انجام می‌شود؟"
        ]
      }
    }
    if (lang === "ar") {
      return {
        answer: "أهلاً وسهلاً بك! أنا المساعد الذكي لنظام الحضور والرواتب. يسعدني إرشادك في كل ما يخص تسجيل الدوام، الورديات المتعددة، الإجازات، احتساب الرواتب، تقارير Excel، وإرسال القسائم عبر واتساب. كيف يمكنني مساعدتك اليوم؟",
        suggestions: [
          "كيف يتم تسجيل الحضور وأوقات الاستراحة في الكشك؟",
          "هل يمكن تسجيل أكثر من وردية في نفس اليوم؟",
          "كيف يتم احتساب الراتب والعمل الإضافي؟"
        ]
      }
    }
    return {
      answer: "Hello! I am the platform's AI Assistant. I can guide you through attendance logging, split shifts, leave management, payroll calculations, Excel reporting, WhatsApp payslip sharing, and offline security. How can I help you today?",
      suggestions: [
        "How do attendance punch-in and break tracking work in the Kiosk?",
        "Can employees log multiple or split shifts on the same day?",
        "How are employee salaries, worked hours, and overtime calculated?"
      ]
    }
  }

  if (
    cleanPrompt.includes("کیستی") ||
    cleanPrompt.includes("کی هستی") ||
    cleanPrompt.includes("من انت") ||
    cleanPrompt.includes("من أنت") ||
    cleanPrompt.includes("who are you") ||
    cleanPrompt.includes("معرفی")
  ) {
    if (lang === "fa") {
      return {
        answer: "من هوش مصنوعی اختصاصی این سیستم هستم؛ طراحی شده‌ام تا به عنوان یک دستیار همراه، تمامی قوانین محاسباتی حقوق و دستمزد، جزئیات تردد، مدیریت مرخصی‌ها، نحوه صدور گزارشات اکسل و امکانات امنیتی سامانه را به زبان ساده و حرفه‌ای برای شما توضیح دهم.",
        suggestions: [
          "آیا امکان ثبت چند شیفت در یک روز وجود دارد؟",
          "خروجی فایل اکسل چه مواردی را شامل می‌شود؟",
          "امنیت داده‌ها و پشتیبان‌گیری آفلاین چگونه است؟"
        ]
      }
    }
    if (lang === "ar") {
      return {
        answer: "أنا المساعد الذكي الاصطناعي لهذه المنظومة. مهمتي إرشادك وتقديم شروحات شاملة وموثوقة حول إدارة أوقات الدوام، احتساب الأجور، الورديات المتعددة، الإجازات، النسخ الاحتياطي، وإعدادات المنشأة بأعلى درجات الدقة والوضوح.",
        suggestions: [
          "هل يمكن تسجيل أكثر من وردية في نفس اليوم؟",
          "ماذا تتضمن ملفات Excel المصدرة؟",
          "ما هي معايير الأمان والنسخ الاحتياطي؟"
        ]
      }
    }
    return {
      answer: "I am this platform's dedicated AI Assistant, specialized in providing guidance across all attendance policies, multi-shift logging, leave tracking, payroll math, Excel exports, and local-first security.",
      suggestions: [
        "Can employees log multiple or split shifts on the same day?",
        "What is included in the exported Excel workbooks?",
        "How do offline data privacy and backups operate?"
      ]
    }
  }

  let bestMatch: KnowledgeItem | null = null
  let maxScore = 0

  for (const item of KNOWLEDGE_BASE) {
    let score = 0
    for (const kw of item.keywords) {
      const normKw = normalizeText(kw)
      if (cleanPrompt.includes(normKw)) {
        score += normKw.includes(" ") ? 6 : 3
      }
    }
    const itemFaQ = normalizeText(item.fa.question)
    const itemArQ = normalizeText(item.ar.question)
    const itemEnQ = normalizeText(item.en.question)

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
      answer: "من برای راهنمایی درباره تمام بخش‌های این سیستم حضور و غیاب و حقوق آموزش دیده‌ام. سوال شما دقیقاً شناسایی نشد، اما می‌توانید درباره هر یک از موضوعات زیر از من بپرسید تا راهنمایی‌تان کنم:\n\n۱. **ثبت تردد در کیوسک و چند شیفت در روز**\n۲. **اصلاح و ویرایش سوابق تردد توسط مدیر**\n۳. **مدیریت مرخصی‌ها و کسر از کارکرد**\n۴. **محاسبات حقوق، اضافه کار و صدور فیش**\n۵. **پیش‌نمایش فیش، امضای دیجیتال و چاپ رسید رسمی**\n۶. **ارسال مستقیم فیش حقوقی از طریق واتساپ**\n۷. **خروجی اکسل پیشرفته به ساعت و دقیقه با فرمول سرجمع**\n۸. **امنیت آفلاین، پشتیبان‌گیری خودکار و بازیابی اضطراری رمز**",
      suggestions: [
        "نحوه ثبت تردد و وقت استراحت در کیوسک چگونه است؟",
        "آیا امکان ثبت چند شیفت در یک روز وجود دارد؟",
        "محاسبه حقوق و اضافه‌کاری چگونه انجام می‌شود؟"
      ]
    }
  }

  if (lang === "ar") {
    return {
      answer: "أنا متخصص في الإجابة عن كافة تفاصيل نظام الحضور والرواتب. لم أتعرف على سؤالك بدقة، ولكن يمكنك سؤالي عن أي من المواضيع التالية وسأجيبك فوراً:\n\n١. **تسجيل الحضور في الكشك والورديات المتعددة في اليوم**\n٢. **تعديل وتصحيح سجلات الدوام من قبل الإدارة**\n٣. **إدارة الإجازات وأثرها على الراتب**\n٤. **احتساب الرواتب والعمل الإضافي وقسائم الصرف**\n٥. **معاينة القسائم والتوقيع والطباعة الرسمية**\n٦. **إرسال قسائم الرواتب عبر واتساب للموظفين**\n٧. **تصدير تقارير Excel بالساعات والدقائق ومعادلات الإجمالي**\n٨. **الأمان المحلي والنسخ الاحتياطي التلقائي واستعادة رمز المرور**",
      suggestions: [
        "كيف يتم تسجيل الحضور وأوقات الاستراحة في الكشك؟",
        "هل يمكن تسجيل أكثر من وردية في نفس اليوم؟",
        "كيف يتم احتساب الراتب والعمل الإضافي؟"
      ]
    }
  }

  return {
    answer: "I am specifically trained to assist with all capabilities of this Attendance & Payroll platform. I couldn't find an exact match for your inquiry, but feel free to ask about any of these core areas:\n\n1. **Kiosk Punching & Multiple Shifts per Day**\n2. **Attendance Adjustments by Management**\n3. **Leave Management & Payroll Deductions**\n4. **Salary Engine, Overtime & Net Pay Calculation**\n5. **Payslip Previewing, Digital Signing & Receipt Printing**\n6. **Instant Payslip Delivery via WhatsApp**\n7. **Excel Exports with Hours & Minutes Totals**\n8. **Local-First Privacy, Backups & Emergency Recovery**",
    suggestions: [
      "How do attendance punch-in and break tracking work in the Kiosk?",
      "Can employees log multiple or split shifts on the same day?",
      "How are employee salaries, worked hours, and overtime calculated?"
    ]
  }
}
