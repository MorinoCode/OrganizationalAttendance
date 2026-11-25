import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import arTranslation from "./locales/ar.json"
import enTranslation from "./locales/en.json"
import faTranslation from "./locales/fa.json"

const savedLang = localStorage.getItem("preferred_lang") || "ar"

i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: arTranslation },
    en: { translation: enTranslation },
    fa: { translation: faTranslation }
  },
  lng: savedLang,
  fallbackLng: "ar",
  interpolation: {
    escapeValue: false
  }
})

export const setAppLanguage = (lang: "ar" | "en" | "fa") => {
  i18n.changeLanguage(lang)
  localStorage.setItem("preferred_lang", lang)
  const dir = lang === "en" ? "ltr" : "rtl"
  document.documentElement.setAttribute("dir", dir)
  document.documentElement.setAttribute("lang", lang)
  document.title = i18n.t("appTitle")
}

const initialDir = savedLang === "en" ? "ltr" : "rtl"
document.documentElement.setAttribute("dir", initialDir)
document.documentElement.setAttribute("lang", savedLang)
document.title = i18n.t("appTitle")

export default i18n
