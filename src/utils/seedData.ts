import { Competition, Question, THPT_2510_CLASSES } from '../types';

export const sampleQuestions: Question[] = [
  {
    id: 'q1',
    order: 1,
    type: 'ABCD',
    prompt: 'Trường THPT 25-10 mang tên gắn liền với ngày truyền thống lịch sử vẻ vang nào của quê hương Thủy Nguyên – Hải Phòng?',
    options: [
      { id: 'A', text: 'Ngày tiếp quản thị xã Thủy Nguyên' },
      { id: 'B', text: 'Ngày truyền thống Thủy Nguyên quật khởi (25/10/1948)' },
      { id: 'C', text: 'Ngày thành lập Chi bộ Đảng đầu tiên' },
      { id: 'D', text: 'Ngày giải phóng hoàn toàn Hải Phòng' },
    ],
    correctAnswer: 'B',
    explanation: 'Ngày 25/10/1948 là ngày Thủy Nguyên quật khởi – ngọn cờ đầu chống giặc cứu nước kiên cường, trường THPT 25-10 vinh dự tự hào mang tên mốc son lịch sử này.',
    timeLimitSeconds: 15,
    subject: 'Lịch sử & Truyền thống trường',
    isActive: true,
  },
  {
    id: 'q2',
    order: 2,
    type: 'ABCD',
    prompt: 'Nhà thơ nào được mệnh danh là "Nhà thơ của tình yêu" và tác giả của bài thơ "Sóng" trong chương trình Ngữ Văn THPT?',
    options: [
      { id: 'A', text: 'Hàn Mặc Tử' },
      { id: 'B', text: 'Xuân Diệu' },
      { id: 'C', text: 'Xuân Quỳnh' },
      { id: 'D', text: 'Nguyễn Bính' },
    ],
    correctAnswer: 'C',
    explanation: 'Bài thơ "Sóng" được nữ thi sĩ Xuân Quỳnh sáng tác năm 1967 tại vùng biển Diêm Điền (Thái Bình), in trong tập "Hoa dọc chiến hào".',
    timeLimitSeconds: 15,
    subject: 'Ngữ văn',
    isActive: true,
  },
  {
    id: 'q3',
    order: 3,
    type: 'TRUE_FALSE',
    prompt: 'Định luật vạn vật hấp dẫn được nhà bác học Isaac Newton công bố trong tác phẩm nổi tiếng "Các nguyên lý toán học của triết học tự nhiên". Khẳng định này Đúng hay Sai?',
    options: [
      { id: 'Đúng', text: 'ĐÚNG' },
      { id: 'Sai', text: 'SAI' },
    ],
    correctAnswer: 'Đúng',
    explanation: 'Đúng! Tác phẩm Philosophiae Naturalis Principia Mathematica (Principia) được xuất bản năm 1687 đặt nền móng cho cơ học cổ điển.',
    timeLimitSeconds: 15,
    subject: 'Vật lý',
    isActive: true,
  },
  {
    id: 'q4',
    order: 4,
    type: 'ABCD',
    prompt: 'Hành tinh nào trong Hệ Mặt Trời có số lượng vệ tinh tự nhiên được xác nhận nhiều nhất hiện nay?',
    options: [
      { id: 'A', text: 'Sao Mộc (Jupiter)' },
      { id: 'B', text: 'Sao Thổ (Saturn)' },
      { id: 'C', text: 'Sao Hải Vương (Neptune)' },
      { id: 'D', text: 'Sao Thiên Vương (Uranus)' },
    ],
    correctAnswer: 'B',
    explanation: 'Sao Thổ (Saturn) giữ kỷ lục với hơn 145 vệ tinh tự nhiên đã được IAU công nhận chính thức.',
    timeLimitSeconds: 15,
    subject: 'Thiên văn học',
    isActive: true,
  },
  {
    id: 'q5',
    order: 5,
    type: 'SHORT_ANSWER',
    prompt: 'Hãy điền tên Thủ đô của nước Cộng hòa Xã hội Chủ nghĩa Việt Nam (trái tim của cả nước, nghìn năm văn hiến)?',
    correctAnswer: 'Hà Nội',
    acceptedAnswers: [
      'Ha Noi',
      'hà nội',
      'ha noi',
      'HA NOI',
      'Hà nội',
      'Thủ đô Hà Nội',
      'Thu do Ha Noi',
    ],
    caseSensitive: false,
    ignoreDiacritics: true,
    ignoreSpaces: false,
    explanation: 'Thủ đô Hà Nội là trung tâm chính trị, văn hóa, giáo dục và khoa học quan trọng của Việt Nam.',
    timeLimitSeconds: 20,
    subject: 'Địa lý & Lịch sử',
    isActive: true,
  },
  {
    id: 'q6',
    order: 6,
    type: 'NUMERIC',
    prompt: '[CÂU HỎI PHỤ - TIEBREAKER] Số tự nhiên nhỏ nhất có ba chữ số khác nhau chia hết cho cả 2, 3 và 5 là số nào?',
    correctAnswer: '120',
    acceptedAnswers: ['120'],
    explanation: 'Số chia hết cho 2 và 5 phải tận cùng bằng 0. Để nhỏ nhất có 3 chữ số khác nhau, chữ số hàng trăm là 1, hàng đơn vị là 0. Để chia hết cho 3, tổng các chữ số (1 + a + 0) chia hết cho 3 => a = 2. Vậy số đó là 120.',
    timeLimitSeconds: 15,
    subject: 'Toán học',
    isTieBreaker: true,
    isActive: true,
  },
];

export const createDefaultCompetition = (): Competition => {
  const now = Date.now();
  return {
    id: 'comp-thpt-2510',
    roomCode: 'RCV2510',
    title: 'RUNG CHUÔNG VÀNG – TRƯỜNG THPT 25-10',
    schoolName: 'TRƯỜNG THPT 25-10',
    slogan: 'Chinh phục tri thức – Bứt phá giới hạn',
    organizer: 'ĐOÀN TRƯỜNG & BAN CHUYÊN MÔN THPT 25-10',
    totalExpectedParticipants: 66,
    totalClasses: 33,
    date: '2026-10-25',
    time: '08:00',
    location: 'Sân trường / Nhà thi đấu Đa năng THPT 25-10',
    status: 'WAITING',
    gameState: 'WAITING',
    currentQuestionIndex: 0,
    questionStartTime: null,
    questionEndTime: null,
    rules: {
      eliminateOnWrong: true,
      eliminateOnNoAnswer: true,
      allowAnswerChange: false,
      showCorrectAnswer: true,
      showExplanation: true,
      autoNextQuestion: false,
      allowRescue: true,
      allowTiebreaker: true,
      requirePreRegistration: false,
      lockRoomOnStart: false,
    },
    questions: sampleQuestions,
    participants: [],
    answers: {},
    rescues: [],
    logs: [
      {
        id: 'log-1',
        timestamp: now,
        action: 'Khởi tạo phòng thi RCV2510 (66 thí sinh / 33 lớp)',
        performedBy: 'Ban Tổ Chức',
        details: 'Hệ thống đã sẵn sàng đón 66 thí sinh đại diện cho 33 lớp',
      },
    ],
    winnerId: null,
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * Tạo danh sách 66 thí sinh đến từ 33 lớp (mỗi lớp 2 thí sinh đại diện)
 */
export const generateDemoParticipants = (count: number = 66) => {
  const firstNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];
  const middleNames = ['Văn', 'Thị', 'Đức', 'Minh', 'Ngọc', 'Quang', 'Hải', 'Thành', 'Thu', 'Phương', 'Mai', 'Bảo'];
  const lastNames = [
    'An', 'Bình', 'Cường', 'Dũng', 'Giang', 'Hà', 'Hưng', 'Khánh', 'Linh', 'Minh',
    'Nam', 'Nhi', 'Phúc', 'Quân', 'Sơn', 'Trang', 'Tú', 'Uyên', 'Việt', 'Yến',
    'Bách', 'Duy', 'Đan', 'Hiếu', 'Khoa', 'Khang', 'Long', 'Nga', 'Phong', 'Thảo'
  ];

  const participants = [];
  const totalStudents = Math.min(count, 66);

  for (let i = 0; i < totalStudents; i++) {
    // 33 classes, 2 students per class
    const classIndex = Math.floor(i / 2) % THPT_2510_CLASSES.length;
    const className = THPT_2510_CLASSES[classIndex];
    const memberIndexInClass = (i % 2) + 1; // 1 or 2

    const fn = firstNames[(i * 3 + classIndex) % firstNames.length];
    const mn = middleNames[(i * 2 + memberIndexInClass) % middleNames.length];
    const ln = lastNames[(i * 5 + classIndex) % lastNames.length];
    const studentCode = `SBD-${String(i + 1).padStart(2, '0')}`;

    participants.push({
      id: `p-${studentCode.toLowerCase()}`,
      sessionId: `sess-${studentCode.toLowerCase()}`,
      name: `${fn} ${mn} ${ln}`,
      className,
      studentCode,
      status: 'ACTIVE' as const,
      eliminatedAtQuestionIndex: null,
      eliminatedAtQuestionOrder: null,
      isOnline: true,
      lastSeenAt: Date.now(),
      joinedAt: Date.now() - (66 - i) * 1500,
      totalCorrect: 0,
      totalWrong: 0,
      totalResponseTimeMs: 0,
      violations: [],
    });
  }

  return participants;
};
