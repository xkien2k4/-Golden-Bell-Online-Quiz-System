import { Question, QuestionType } from '../types';

export interface ParseQuestionOptions {
  defaultTimeLimit: number;
  overrideAllTimes: boolean;
}

/**
 * Robust CSV/TSV parser for questions.
 * Handles quoted fields, tabs (from Excel/Sheets copy-paste), semicolons, and commas.
 */
export function parseQuestionCsv(
  text: string,
  options: ParseQuestionOptions = { defaultTimeLimit: 15, overrideAllTimes: false }
): Partial<Question>[] {
  if (!text || !text.trim()) return [];

  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (rawLines.length === 0) return [];

  // Helper to split row handling quotes
  const parseRow = (line: string): string[] => {
    // If copied directly from Excel / Google Sheets (Tab-separated)
    if (line.includes('\t')) {
      return line.split('\t').map((c) => c.trim().replace(/^["']|["']$/g, ''));
    }

    // CSV with quotes or semicolon separated
    const delimiter = line.includes(';') && !line.includes(',') ? ';' : ',';
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^["']|["']$/g, ''));
    return result;
  };

  const parsedQuestions: Partial<Question>[] = [];

  // Detect and skip header row if present
  const firstRow = parseRow(rawLines[0]);
  const isHeader = firstRow.some((col) =>
    /thứ tự|stt|câu hỏi|nội dung|prompt|loại|đáp án|phương án|thời gian/i.test(col)
  );
  const dataLines = isHeader ? rawLines.slice(1) : rawLines;

  dataLines.forEach((line, index) => {
    const cols = parseRow(line);
    if (cols.length < 2) return;

    let prompt = '';
    let type: QuestionType = 'ABCD';
    let optA = '';
    let optB = '';
    let optC = '';
    let optD = '';
    let correctAnswer = 'A';
    let explanation = '';
    let timeLimitSeconds = options.defaultTimeLimit;
    let subject = 'Kiến thức chung';

    if (cols.length >= 7) {
      // Check if col[0] is an order number
      const startsWithOrder = /^\d+$/.test(cols[0].trim());
      const offset = startsWithOrder ? 1 : 0;

      prompt = cols[offset] || '';
      const rawType = (cols[offset + 1] || '').toUpperCase();
      if (rawType.includes('TRUE') || rawType.includes('SAI') || rawType.includes('ĐÚNG')) {
        type = 'TRUE_FALSE';
      } else if (rawType.includes('SHORT') || rawType.includes('NGẮN') || rawType.includes('ĐIỀN')) {
        type = 'SHORT_ANSWER';
      } else if (rawType.includes('NUM')) {
        type = 'NUMERIC';
      } else {
        type = 'ABCD';
      }

      optA = cols[offset + 2] || '';
      optB = cols[offset + 3] || '';
      optC = cols[offset + 4] || '';
      optD = cols[offset + 5] || '';
      correctAnswer = cols[offset + 6] || 'A';
      explanation = cols[offset + 7] || '';

      // Parse time column if available
      const rawTime = cols[offset + 8];
      const parsedTime = rawTime ? parseInt(rawTime, 10) : NaN;

      if (options.overrideAllTimes) {
        timeLimitSeconds = options.defaultTimeLimit;
      } else if (!isNaN(parsedTime) && parsedTime >= 5 && parsedTime <= 300) {
        timeLimitSeconds = parsedTime;
      } else {
        timeLimitSeconds = options.defaultTimeLimit;
      }

      subject = cols[offset + 9] || 'Kiến thức chung';
    } else {
      // Simplified row format: [Nội dung, Đáp án, Thời gian]
      prompt = cols[0] || '';
      correctAnswer = cols[1] || 'A';
      if (cols[2]) {
        const t = parseInt(cols[2], 10);
        if (!options.overrideAllTimes && !isNaN(t) && t >= 5) {
          timeLimitSeconds = t;
        } else {
          timeLimitSeconds = options.defaultTimeLimit;
        }
      } else {
        timeLimitSeconds = options.defaultTimeLimit;
      }
    }

    if (!prompt.trim()) return;

    parsedQuestions.push({
      id: `q-imported-${Date.now()}-${index + 1}`,
      order: index + 1,
      type,
      prompt: prompt.trim(),
      options:
        type === 'ABCD'
          ? [
              { id: 'A', text: optA.trim() || 'Phương án A' },
              { id: 'B', text: optB.trim() || 'Phương án B' },
              { id: 'C', text: optC.trim() || 'Phương án C' },
              { id: 'D', text: optD.trim() || 'Phương án D' },
            ]
          : type === 'TRUE_FALSE'
          ? [
              { id: 'Đúng', text: 'ĐÚNG' },
              { id: 'Sai', text: 'SAI' },
            ]
          : undefined,
      correctAnswer: correctAnswer.trim(),
      explanation: explanation.trim(),
      timeLimitSeconds: timeLimitSeconds || 15,
      subject: subject.trim() || 'Kiến thức chung',
      isActive: true,
    });
  });

  return parsedQuestions;
}
