import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Lang = "en" | "ar";

type Dict = Record<string, { en: string; ar: string }>;

const dict: Dict = {
  brand: { en: "Nawras", ar: "نورس" },
  brandFull: { en: "Nawras The Barbershop", ar: "صالون نورس للحلاقة" },
  tagline: { en: "Premium grooming in Amman", ar: "عناية فاخرة في عمّان" },
  bookNow: { en: "Book Now", ar: "احجز الآن" },
  services: { en: "Services", ar: "الخدمات" },
  barbers: { en: "Barbers", ar: "الحلاقون" },
  reviews: { en: "Reviews", ar: "التقييمات" },
  hours: { en: "Hours", ar: "أوقات العمل" },
  location: { en: "Location", ar: "الموقع" },
  about: { en: "About", ar: "من نحن" },
  contact: { en: "Contact", ar: "تواصل" },
  call: { en: "Call", ar: "اتصل" },
  whatsapp: { en: "WhatsApp", ar: "واتساب" },
  directions: { en: "Directions", ar: "الاتجاهات" },
  selectService: { en: "Select a service", ar: "اختر الخدمة" },
  selectBarber: { en: "Select a barber", ar: "اختر الحلاق" },
  selectDate: { en: "Select a date", ar: "اختر التاريخ" },
  selectTime: { en: "Select a time", ar: "اختر الوقت" },
  yourDetails: { en: "Your details", ar: "بياناتك" },
  fullName: { en: "Full name", ar: "الاسم الكامل" },
  phone: { en: "Phone number", ar: "رقم الهاتف" },
  notes: { en: "Notes (optional)", ar: "ملاحظات (اختياري)" },
  confirmBooking: { en: "Confirm booking", ar: "تأكيد الحجز" },
  next: { en: "Next", ar: "التالي" },
  back: { en: "Back", ar: "السابق" },
  step: { en: "Step", ar: "خطوة" },
  of: { en: "of", ar: "من" },
  jod: { en: "JOD", ar: "د.أ" },
  min: { en: "min", ar: "دقيقة" },
  duration: { en: "Duration", ar: "المدة" },
  price: { en: "Price", ar: "السعر" },
  bookingConfirmed: { en: "Booking confirmed!", ar: "تم تأكيد الحجز!" },
  bookingPending: { en: "Booking received", ar: "تم استلام الحجز" },
  confirmationMsg: { en: "We'll see you soon. Save this confirmation or message us on WhatsApp.", ar: "نراك قريباً. احفظ التأكيد أو راسلنا على واتساب." },
  bookAnother: { en: "Book another", ar: "احجز موعد آخر" },
  noSlots: { en: "No available times for this date", ar: "لا توجد أوقات متاحة لهذا التاريخ" },
  closed: { en: "Closed", ar: "مغلق" },
  open: { en: "Open", ar: "مفتوح" },
  loading: { en: "Loading…", ar: "جارٍ التحميل…" },
  bookingFor: { en: "Booking for", ar: "الحجز لـ" },
  with: { en: "with", ar: "مع" },
  on: { en: "on", ar: "في" },
  at: { en: "at", ar: "الساعة" },
  adminLogin: { en: "Admin Login", ar: "دخول الإدارة" },
  email: { en: "Email", ar: "البريد الإلكتروني" },
  password: { en: "Password", ar: "كلمة المرور" },
  signIn: { en: "Sign in", ar: "تسجيل الدخول" },
  signOut: { en: "Sign out", ar: "تسجيل الخروج" },
  dashboard: { en: "Dashboard", ar: "لوحة التحكم" },
  appointments: { en: "Appointments", ar: "المواعيد" },
  manageServices: { en: "Manage Services", ar: "إدارة الخدمات" },
  manageBarbers: { en: "Manage Barbers", ar: "إدارة الحلاقين" },
  manageHours: { en: "Working Hours", ar: "أوقات العمل" },
  closedDays: { en: "Closed Days", ar: "أيام الإغلاق" },
  today: { en: "Today", ar: "اليوم" },
  thisWeek: { en: "This week", ar: "هذا الأسبوع" },
  all: { en: "All", ar: "الكل" },
  pending: { en: "Pending", ar: "قيد الانتظار" },
  confirmed: { en: "Confirmed", ar: "مؤكد" },
  completed: { en: "Completed", ar: "مكتمل" },
  cancelled: { en: "Cancelled", ar: "ملغي" },
  confirm: { en: "Confirm", ar: "تأكيد" },
  cancel: { en: "Cancel", ar: "إلغاء" },
  markCompleted: { en: "Mark completed", ar: "تحديد كمكتمل" },
  add: { en: "Add", ar: "إضافة" },
  edit: { en: "Edit", ar: "تعديل" },
  delete: { en: "Delete", ar: "حذف" },
  save: { en: "Save", ar: "حفظ" },
  name: { en: "Name", ar: "الاسم" },
  nameAr: { en: "Name (Arabic)", ar: "الاسم (عربي)" },
  active: { en: "Active", ar: "نشط" },
  filterBarber: { en: "Filter by barber", ar: "تصفية بالحلاق" },
  filterStatus: { en: "Filter by status", ar: "تصفية بالحالة" },
  startingFrom: { en: "Starting from", ar: "تبدأ من" },
  popular: { en: "Most popular", ar: "الأكثر طلباً" },
  bookingSummary: { en: "Booking summary", ar: "ملخص الحجز" },
  premiumExperience: { en: "A Premium Grooming Experience", ar: "تجربة عناية فاخرة" },
  heroSubtitle: { en: "Master barbers. Sharp cuts. Hot towel shaves. Welcome to Amman's most refined grooming destination.", ar: "حلاقون محترفون. قصات أنيقة. حلاقة بالمنشفة الساخنة. مرحباً بك في الوجهة الأرقى للعناية في عمّان." },
  ourCraft: { en: "Our Craft", ar: "حرفتنا" },
  meetTheTeam: { en: "Meet The Team", ar: "تعرّف على الفريق" },
  whatClientsSay: { en: "What Clients Say", ar: "ماذا يقول عملاؤنا" },
  visitUs: { en: "Visit Us", ar: "زرنا" },
  address: { en: "Al-Azharan St., Wadi Al-Seer, Amman", ar: "شارع الأزهران، وادي السير، عمّان" },
  language: { en: "العربية", ar: "English" },
  invalidPhone: { en: "Please enter a valid phone number", ar: "يرجى إدخال رقم هاتف صحيح" },
  invalidName: { en: "Name must be at least 2 characters", ar: "الاسم يجب أن يكون حرفين على الأقل" },
  bookingError: { en: "This time slot was just taken. Please pick another.", ar: "تم حجز هذا الوقت للتو. يرجى اختيار وقت آخر." },
  back_home: { en: "Back to home", ar: "العودة للرئيسية" },
  selectServices: { en: "Select services", ar: "اختر الخدمات" },
  selectServicesHint: { en: "Tap one or more — they'll be numbered in order", ar: "اضغط على خدمة أو أكثر — سيتم ترقيمها بالترتيب" },
  selected: { en: "Selected", ar: "المختار" },
  total: { en: "Total", ar: "الإجمالي" },
  totalDuration: { en: "Total time", ar: "الوقت الإجمالي" },
  since: { en: "Since 1992", ar: "منذ 1992" },
  owner: { en: "Owner", ar: "المالك" },
  followUs: { en: "Follow us", ar: "تابعنا" },
  scanToBook: { en: "Scan to book", ar: "امسح للحجز" },
  findUs: { en: "Find us on the map", ar: "اعثر علينا على الخريطة" },
  noServiceSelected: { en: "Please select at least one service", ar: "يرجى اختيار خدمة واحدة على الأقل" },
  customerLogin: { en: "Customer Login", ar: "دخول العميل" },
  staffLogin: { en: "Staff Login", ar: "دخول الموظفين" },
  ownerLogin: { en: "Owner / Admin", ar: "المالك / الإدارة" },
  employeeLogin: { en: "Employee Barber", ar: "حلاق موظف" },
  loginRequired: { en: "Please sign in to book", ar: "يرجى تسجيل الدخول للحجز" },
  createAccount: { en: "Create account", ar: "إنشاء حساب" },
  noAccount: { en: "No account?", ar: "لا تملك حساباً؟" },
  haveAccount: { en: "Already have an account?", ar: "لديك حساب؟" },
  myBookings: { en: "My bookings", ar: "حجوزاتي" },
  serviceSwapped: { en: "Replaced previous selection", ar: "تم استبدال الاختيار السابق" },
  serviceIncluded: { en: "Already included in another service", ar: "مشمولة بالفعل في خدمة أخرى" },
};

const I18nContext = createContext<{
  lang: Lang;
  dir: "ltr" | "rtl";
  t: (key: keyof typeof dict) => string;
  setLang: (l: Lang) => void;
  toggle: () => void;
}>({ lang: "en", dir: "ltr", t: (k) => dict[k]?.en ?? String(k), setLang: () => {}, toggle: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && (localStorage.getItem("nawras_lang") as Lang | null)) || "en";
    setLangState(saved === "ar" ? "ar" : "en");
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.body.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("nawras_lang", l);
  };

  const value = {
    lang,
    dir: (lang === "ar" ? "rtl" : "ltr") as "ltr" | "rtl",
    t: (key: keyof typeof dict) => dict[key]?.[lang] ?? dict[key]?.en ?? String(key),
    setLang,
    toggle: () => setLang(lang === "en" ? "ar" : "en"),
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export type { Lang };
