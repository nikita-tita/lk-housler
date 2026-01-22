/**
 * Проверяет валидность имени застройщика
 * Исключает URL-подобные строки и технические имена источников
 */
export function isValidDeveloperName(name: string | null | undefined): boolean {
  if (!name) return false;

  // Исключаем если содержит признаки URL/домена/технического источника
  const invalidPatterns = [
    /\.(ru|com|pro|net|org|xml|html)/i,
    /^https?:\/\//i,
    /www\./i,
    /allrealty/i,
    /\.xml/i,
    /-xml\d*/i,
    /nmarket/i,
    /feed/i,
  ];

  for (const pattern of invalidPatterns) {
    if (pattern.test(name)) return false;
  }

  // Минимальная длина и не только цифры
  if (name.length < 2 || /^\d+$/.test(name)) return false;

  return true;
}
