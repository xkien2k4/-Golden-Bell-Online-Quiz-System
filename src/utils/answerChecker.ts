/**
 * Vietnamese text normalization and robust answer checker.
 * Handles case sensitivity, Vietnamese diacritics removal, spacing, punctuation,
 * and extracts option letters (A, B, C, D) accurately.
 */

export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  let result = str;
  result = result.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
  result = result.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
  result = result.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
  result = result.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
  result = result.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
  result = result.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
  result = result.replace(/đ/g, 'd');
  result = result.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, 'A');
  result = result.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, 'E');
  result = result.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, 'I');
  result = result.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, 'O');
  result = result.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, 'U');
  result = result.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, 'Y');
  result = result.replace(/Đ/g, 'D');

  // Remove combining diacritical marks
  result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return result;
}

export function normalizeAnswer(
  text: string,
  options: {
    caseSensitive?: boolean;
    ignoreDiacritics?: boolean;
    ignoreSpaces?: boolean;
  } = {}
): string {
  if (!text) return '';
  let cleaned = String(text).trim();

  // Remove punctuation (dots, commas, quotes, dashes, question marks)
  cleaned = cleaned.replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, ' ');

  if (options.ignoreDiacritics !== false) {
    cleaned = removeVietnameseTones(cleaned);
  }

  if (!options.caseSensitive) {
    cleaned = cleaned.toLowerCase();
  }

  if (options.ignoreSpaces) {
    cleaned = cleaned.replace(/\s+/g, '');
  } else {
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
  }

  return cleaned;
}

/**
 * Extracts letter A, B, C, D from answer string if present.
 * Example: "A", "A.", "A. Đáp án...", "Đáp án A", "Phương án B", "(C)", "[D]" -> "A", "B", "C", "D"
 */
export function extractChoiceLetter(str: string): string | null {
  if (!str) return null;
  const trimmed = str.trim().toUpperCase();
  if (['A', 'B', 'C', 'D'].includes(trimmed)) return trimmed;

  // Handles "A.", "A:", "A -", "A)", "A " at start
  const match = trimmed.match(/^([ABCD])[\s\.\:\,\-\)\/]/);
  if (match) return match[1];

  // Handles "(A)" or "[A]"
  const matchParen = trimmed.match(/^[\(\[]([ABCD])[\)\]]/);
  if (matchParen) return matchParen[1];

  // Handles "ĐÁP ÁN A", "PHƯƠNG ÁN A", "CHỌN A", "CÂU A", "OPTION A"
  const matchPrefix = trimmed.match(/(?:ĐÁP ÁN|PHƯƠNG ÁN|CHỌN|CÂU|OPTION|LỰA CHỌN)\s*[:\-\s]*([ABCD])\b/i);
  if (matchPrefix) return matchPrefix[1].toUpperCase();

  // Handles any string ending with or containing option letter clearly
  const matchWord = trimmed.match(/\b([ABCD])\b/);
  if (matchWord) return matchWord[1].toUpperCase();

  return null;
}

export function checkAnswerCorrectness(
  userAnswer: string,
  correctAnswer: string,
  acceptedAnswers: string[] = [],
  options: {
    caseSensitive?: boolean;
    ignoreDiacritics?: boolean;
    ignoreSpaces?: boolean;
    questionType?: string;
    questionOptions?: Array<{ id: string; text: string }>;
  } = {}
): boolean {
  if (!userAnswer || !String(userAnswer).trim()) return false;
  if (!correctAnswer || !String(correctAnswer).trim()) return false;

  const rawUser = String(userAnswer).trim();
  const rawCorrect = String(correctAnswer).trim();

  // 0. Direct match (case-insensitive & space-trimmed)
  if (rawUser.toLowerCase() === rawCorrect.toLowerCase()) return true;

  // 1. Single-choice ABCD Question
  const qType = (options.questionType || '').toUpperCase();
  const isABCDType = qType === 'ABCD' || (options.questionOptions && options.questionOptions.length === 4);

  const userLetter = extractChoiceLetter(rawUser);
  const correctLetter = extractChoiceLetter(rawCorrect);

  if (isABCDType || userLetter || correctLetter) {
    // If both resolve to option letters (A, B, C, D)
    if (userLetter && correctLetter) {
      if (userLetter === correctLetter) return true;
    }

    // Match with options list if available
    if (options.questionOptions && options.questionOptions.length > 0) {
      // Find what option the user selected (by ID or by Text)
      const userSelectedOpt = options.questionOptions.find(
        (o) =>
          o.id.toUpperCase() === (userLetter || rawUser).toUpperCase() ||
          normalizeAnswer(o.text) === normalizeAnswer(rawUser)
      );

      // Find what option is marked correct (by ID or by Text)
      const correctOpt = options.questionOptions.find(
        (o) =>
          o.id.toUpperCase() === (correctLetter || rawCorrect).toUpperCase() ||
          normalizeAnswer(o.text) === normalizeAnswer(rawCorrect) ||
          (o.id && rawCorrect.toUpperCase().startsWith(o.id.toUpperCase()))
      );

      if (userSelectedOpt && correctOpt && userSelectedOpt.id.toUpperCase() === correctOpt.id.toUpperCase()) {
        return true;
      }
    }

    if (userLetter && correctLetter && userLetter === correctLetter) {
      return true;
    }
  }

  // 2. True / False Question
  if (qType === 'TRUE_FALSE') {
    const normUser = removeVietnameseTones(rawUser).toLowerCase().trim();
    const normCorrect = removeVietnameseTones(rawCorrect).toLowerCase().trim();

    const isUserTrue = ['dung', 'true', 't', '1', 'yes', 'd'].includes(normUser);
    const isUserFalse = ['sai', 'false', 'f', '0', 'no', 's'].includes(normUser);

    const isCorrectTrue = ['dung', 'true', 't', '1', 'yes', 'd'].includes(normCorrect);
    const isCorrectFalse = ['sai', 'false', 'f', '0', 'no', 's'].includes(normCorrect);

    if (isCorrectTrue && isUserTrue) return true;
    if (isCorrectFalse && isUserFalse) return true;
    return normUser === normCorrect;
  }

  // 3. Short text or Numeric Question
  const allCandidates = [rawCorrect, ...(acceptedAnswers || [])].filter(Boolean);
  const normalizedUser = normalizeAnswer(rawUser, options);

  return allCandidates.some((candidate) => {
    const normalizedCandidate = normalizeAnswer(String(candidate), options);
    if (normalizedUser === normalizedCandidate) return true;
    // Also check diacritics-removed match
    if (removeVietnameseTones(normalizedUser) === removeVietnameseTones(normalizedCandidate)) return true;
    return false;
  });
}
