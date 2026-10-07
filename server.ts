import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  Competition,
  GameState,
  Participant,
  Question,
  AnswerSubmission,
  RescueEvent,
  SystemLog,
} from './src/types';
import { createDefaultCompetition, generateDemoParticipants, sampleQuestions } from './src/utils/seedData';
import { checkAnswerCorrectness } from "./src/utils/answerChecker";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, getDocs, collection, setLogLevel } from "firebase/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
// Determine writable directory (supports Vercel Serverless /tmp and standard local dev)
const isVercel = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const DATA_DIR = isVercel ? path.join(os.tmpdir(), 'data') : path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'competitions.json');

// Ensure data directory exists safely
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Notice: Could not create local data directory (serverless mode):', e);
}

// In-memory store
let competitions: Record<string, Competition> = {};

// Firestore Initialization using Firebase SDK with project configuration
// Firebase configuration with bundled fallback for Vercel Serverless & Cloud Run
const DEFAULT_FIREBASE_CONFIG = {
  projectId: "folkloric-seer-7wh4c",
  appId: "1:854360255587:web:a1a40612c811383296dc56",
  apiKey: "AIzaSyCtcU4p-USr_yuVFOu89bv4rZwW7VmvChY",
  authDomain: "folkloric-seer-7wh4c.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-remixremixremixr-9e27a836-eb37-4e76-a36f-42934d1b6182",
  storageBucket: "folkloric-seer-7wh4c.firebasestorage.app",
  messagingSenderId: "854360255587",
};

let firestoreDb: any = null;
try {
  let config = DEFAULT_FIREBASE_CONFIG;
  const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      config = DEFAULT_FIREBASE_CONFIG;
    }
  } else if (process.env.FIREBASE_CONFIG) {
    try {
      config = JSON.parse(process.env.FIREBASE_CONFIG);
    } catch (e) {
      config = DEFAULT_FIREBASE_CONFIG;
    }
  }
  const firebaseApp = getApps().length === 0 ? initializeApp(config) : getApps()[0];
  setLogLevel('silent');
  firestoreDb = getFirestore(firebaseApp, config.firestoreDatabaseId);
  console.log('Initialized Cloud Firestore successfully.');
} catch (err) {
  console.warn('Firestore initialization notice (will use local fallback):', err);
}

let loadPromise: Promise<void> | null = null;
let firestoreSyncTimer: ReturnType<typeof setTimeout> | null = null;

async function syncToFirestoreNow(compIds: string[]): Promise<void> {
  if (!firestoreDb) return;
  for (const compId of compIds) {
    const comp = competitions[compId];
    if (!comp) continue;
    const compDocRef = doc(firestoreDb, 'competitions', compId);
    const firestorePayload = JSON.parse(JSON.stringify(comp));
    try {
      await setDoc(compDocRef, firestorePayload);
    } catch (err) {
      console.error(`Failed to sync competition ${compId} to Firestore:`, err);
      throw err;
    }
  }
}

// Load or seed competitions (reads Cloud Firestore first, with local disk fallback)
async function loadCompetitions(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    let loadedFromFirestore = false;

    // 1. Try loading from Cloud Firestore (primary source of truth for Cloud Run & republish)
    if (firestoreDb) {
      try {
        const snap = await getDocs(collection(firestoreDb, 'competitions'));
        if (!snap.empty) {
          snap.forEach((d) => {
            const compData = d.data() as Competition;
            if (compData && compData.id) {
              if (!Array.isArray(compData.questions)) {
                compData.questions = [];
              }
              competitions[compData.id] = compData;
              recalculateParticipantScores(competitions[compData.id]);
            }
          });
          loadedFromFirestore = Object.keys(competitions).length > 0;
          if (loadedFromFirestore) {
            console.log(`Restored ${Object.keys(competitions).length} competition(s) with full questions from Cloud Firestore.`);
          }
        }
      } catch (fsErr) {
        console.warn('Failed to load from Cloud Firestore, falling back to local file:', fsErr);
      }
    }

    // 2. Fallback to local competitions.json if Firestore was empty or unreachable
    if (!loadedFromFirestore) {
      try {
        if (fs.existsSync(DB_FILE)) {
          const data = fs.readFileSync(DB_FILE, 'utf-8');
          competitions = JSON.parse(data);
          for (const compId in competitions) {
            recalculateParticipantScores(competitions[compId]);
          }
          console.log(`Loaded ${Object.keys(competitions).length} competition(s) from local competitions.json.`);
        }
      } catch (err) {
        console.error('Failed to load database from disk:', err);
      }
    }

    // 3. Seed default competition ONLY if completely empty across both Firestore and disk
    if (Object.keys(competitions).length === 0) {
      const defaultComp = createDefaultCompetition();
      competitions[defaultComp.id] = defaultComp;
      await saveCompetitions(defaultComp.id);
    }
  })();

  return loadPromise;
}

// Persists competition state to both local disk and Cloud Firestore
async function saveCompetitions(targetCompId?: string): Promise<void> {
  // 1. Save to local disk cache (fast sync fallback)
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(competitions, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save database to disk:', err);
  }

  // 2. Sync to Cloud Firestore (immediate when targetCompId is explicitly awaited, debounced 1.5s for background saves)
  if (firestoreDb) {
    if (targetCompId) {
      await syncToFirestoreNow([targetCompId]);
    } else {
      if (firestoreSyncTimer) clearTimeout(firestoreSyncTimer);
      firestoreSyncTimer = setTimeout(() => {
        firestoreSyncTimer = null;
        syncToFirestoreNow(Object.keys(competitions)).catch(() => {});
      }, 1500);
    }
  }
}

loadCompetitions().catch((err) => console.error("Initial load error:", err));

// Background periodic check for offline students (heartbeat timeout after 20s)
setInterval(() => {
  const now = Date.now();
  for (const compId in competitions) {
    const comp = competitions[compId];
    let hasOfflineChange = false;
    for (const p of comp.participants) {
      if (p.isOnline && now - p.lastSeenAt > 20000) {
        p.isOnline = false;
        hasOfflineChange = true;
      }
    }
    if (hasOfflineChange) {
      broadcastCompetitionState(compId);
    }
  }
}, 4000);

// Server-Sent Events subscribers map: competitionId -> Set of express Response objects
const sseClients: Record<string, Set<express.Response>> = {};

function recalculateParticipantScores(comp: Competition): void {
  comp.participants.forEach((p) => {
    let correctCount = 0;
    let wrongCount = 0;
    let totalTimeMs = 0;

    comp.questions.forEach((q) => {
      const sub = comp.answers[q.id]?.[p.id];
      if (sub && sub.isCorrect !== undefined) {
        if (sub.isCorrect === true) {
          correctCount++;
          totalTimeMs += sub.clientResponseTimeMs || 0;
        } else if (sub.isCorrect === false) {
          wrongCount++;
        }
      }
    });

    p.totalCorrect = correctCount;
    p.totalWrong = wrongCount;
    p.totalResponseTimeMs = totalTimeMs;
  });
}

function getSortedLeaderboard(comp: Competition): Participant[] {
  recalculateParticipantScores(comp);

  const list = [...comp.participants];
  return list.sort((a, b) => {
    // 1. Status: ACTIVE or RESCUED takes precedence
    const aActive = a.status === 'ACTIVE' || a.status === 'RESCUED';
    const bActive = b.status === 'ACTIVE' || b.status === 'RESCUED';
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;

    // 2. Total correct answers descending
    const aCorrect = a.totalCorrect || 0;
    const bCorrect = b.totalCorrect || 0;
    if (bCorrect !== aCorrect) return bCorrect - aCorrect;

    // 3. For eliminated contestants, who stayed longer (eliminated at higher question order)
    const aOrder = a.eliminatedAtQuestionOrder || 0;
    const bOrder = b.eliminatedAtQuestionOrder || 0;
    if (bOrder !== aOrder) return bOrder - aOrder;

    // 4. Total response time ascending (faster is better)
    const aTime = a.totalResponseTimeMs || 9999999;
    const bTime = b.totalResponseTimeMs || 9999999;
    return aTime - bTime;
  });
}

function evaluateQuestionResults(comp: Competition, q: Question | undefined): number {
  if (!q) return 0;
  const currentAnswers = comp.answers[q.id] || {};
  let newlyEliminatedCount = 0;

  comp.participants.forEach((p) => {
    // Only participants currently on the floor (ACTIVE or RESCUED) are evaluated
    if (p.status === 'ACTIVE' || p.status === 'RESCUED') {
      const sub = currentAnswers[p.id];
      let isCorrect = false;

      if (sub && sub.answer) {
        if (typeof sub.isCorrect === 'boolean') {
          isCorrect = sub.isCorrect;
        } else {
          isCorrect = checkAnswerCorrectness(
            sub.answer,
            q.correctAnswer,
            q.acceptedAnswers || [],
            {
              caseSensitive: q.caseSensitive,
              ignoreDiacritics: q.ignoreDiacritics,
              ignoreSpaces: q.ignoreSpaces,
              questionType: q.type,
              questionOptions: q.options,
            }
          );
          sub.isCorrect = isCorrect;
        }
      }

      // LUẬT RUNG CHUÔNG VÀNG:
      // Trả lời ĐÚNG => ĐƯỢC TIẾP TỤC THI ĐẤU (ACTIVE), xóa bỏ vết bị loại
      // Trả lời SAI hoặc KHÔNG KỊP NỘP ĐÁP ÁN => BỊ LOẠI (ELIMINATED), ĐỢI CỨU TRỢ
      if (isCorrect) {
        p.status = 'ACTIVE';
        p.eliminatedAtQuestionIndex = null;
        p.eliminatedAtQuestionOrder = null;
      } else {
        p.status = 'ELIMINATED';
        p.eliminatedAtQuestionIndex = comp.currentQuestionIndex;
        p.eliminatedAtQuestionOrder = q.order;
        newlyEliminatedCount++;
      }
    }
  });

  // Calculate accurate scores across all questions without duplicate incrementation
  recalculateParticipantScores(comp);

  return newlyEliminatedCount;
}

function getClientGameState(comp: Competition): any {
  // Mask correct answer if not revealed yet
  const isAnswerRevealed =
    comp.gameState === 'ANSWER_REVEALED' ||
    comp.gameState === 'RESULT' ||
    comp.gameState === 'FINISHED';

  const isWaiting = comp.gameState === 'WAITING';
  const currentQ = isWaiting ? null : (comp.questions[comp.currentQuestionIndex] || null);
  const sanitizedCurrentQ = currentQ
    ? {
        id: currentQ.id,
        order: currentQ.order,
        type: currentQ.type,
        prompt: currentQ.prompt,
        options: currentQ.options,
        timeLimitSeconds: currentQ.timeLimitSeconds,
        subject: currentQ.subject,
        imageUrl: currentQ.imageUrl,
        isTieBreaker: currentQ.isTieBreaker,
        ...(isAnswerRevealed
          ? {
              correctAnswer: currentQ.correctAnswer,
              explanation: currentQ.explanation,
            }
          : {}),
      }
    : null;

  const now = Date.now();
  const activeCount = comp.participants.filter(
    (p) => p.status === 'ACTIVE' || p.status === 'RESCUED'
  ).length;
  const eliminatedCount = comp.participants.filter(
    (p) => p.status === 'ELIMINATED'
  ).length;
  const rescuedCount = comp.participants.filter((p) => p.status === 'RESCUED').length;
  const onlineCount = comp.participants.filter((p) => p.isOnline).length;

  const currentAnswers = currentQ ? comp.answers[currentQ.id] || {} : {};
  const answeredCount = Object.keys(currentAnswers).length;

  const optionCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  Object.values(currentAnswers).forEach((ans) => {
    if (ans.answer && optionCounts[ans.answer] !== undefined) {
      optionCounts[ans.answer]++;
    }
  });

  const participantStatuses: Record<string, any> = {};
  comp.participants.forEach((p) => {
    participantStatuses[p.id] = {
      status: p.status,
      isOnline: p.isOnline,
      totalCorrect: p.totalCorrect,
      totalWrong: p.totalWrong,
      eliminatedAtQuestionOrder: p.eliminatedAtQuestionOrder,
    };
  });

  const leaderboardEntries = [...comp.participants]
    .sort((a, b) => {
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (b.status === 'ACTIVE' && a.status !== 'ACTIVE') return 1;
      if (b.totalCorrect !== a.totalCorrect) return b.totalCorrect - a.totalCorrect;
      return a.totalResponseTimeMs - b.totalResponseTimeMs;
    })
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      name: p.name,
      className: p.className,
      studentCode: p.studentCode,
      totalCorrect: p.totalCorrect,
      totalWrong: p.totalWrong,
      totalResponseTimeMs: p.totalResponseTimeMs,
      avgResponseTimeMs: p.totalCorrect > 0 ? Math.round(p.totalResponseTimeMs / p.totalCorrect) : 0,
      status: p.status,
    }));

  const resolvedWinner =
    comp.winnerId
      ? comp.participants.find((p) => p.id === comp.winnerId) || null
      : comp.participants.find((p) => p.status === 'ACTIVE') || null;

  return {
    competitionId: comp.id,
    roomCode: comp.roomCode,
    title: comp.title,
    schoolName: comp.schoolName,
    slogan: comp.slogan,
    status: comp.status,
    gameState: comp.gameState,
    ceremonyMode: comp.gameState === 'FINISHED' ? (comp.ceremonyMode || 'CHAMPION') : comp.ceremonyMode,
    currentQuestionIndex: comp.currentQuestionIndex,
    totalQuestions: comp.questions.length,
    currentQuestion: sanitizedCurrentQ,
    questionStartTime: comp.questionStartTime,
    questionEndTime: comp.questionEndTime,
    serverTime: now,
    timeRemaining: comp.questionEndTime ? Math.max(0, Math.ceil((comp.questionEndTime - now) / 1000)) : 0,
    winner: resolvedWinner,
    leaderboard: leaderboardEntries,
    stats: {
      totalParticipants: comp.participants.length,
      activeCount,
      eliminatedCount,
      rescuedCount,
      onlineCount,
      answeredCount,
      totalClassesCount: new Set(comp.participants.map((p) => p.className)).size,
      currentAnswersCount: optionCounts,
    },
    rules: comp.rules,
    participantStatuses,
  };
}

function broadcastCompetitionState(competitionId: string) {
  const comp = competitions[competitionId];
  if (!comp) return;

  const clients = sseClients[competitionId];
  if (!clients || clients.size === 0) return;

  const clientState = getClientGameState(comp);
  const payload = {
    type: 'STATE_UPDATE',
    serverTime: Date.now(),
    data: clientState,
  };

  const message = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    try {
      client.write(message);
    } catch {
      clients.delete(client);
    }
  }
}

const app = express();
app.use(express.json());

// Enable CORS and permissive headers for cross-device mobile connections
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

  // Polling State endpoint (supports Vercel serverless & fallback when SSE disconnects)
  app.get('/api/competitions/:id/state', (req, res) => {
    const comp = competitions[req.params.id];
    if (!comp) return res.status(404).json({ error: 'Cuộc thi không tồn tại' });
    res.json({
      type: 'STATE_UPDATE',
      data: getClientGameState(comp),
      serverTime: Date.now(),
    });
  });

  // SSE Stream for Real-time game events (Optimized for Mobile, Cloud Run, and Low Latency)
  app.get('/api/competitions/:id/stream', (req, res) => {
    const { id } = req.params;
    const comp = competitions[id];
    if (!comp) {
      return res.status(404).json({ error: 'Cuộc thi không tồn tại' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    if (!sseClients[id]) {
      sseClients[id] = new Set();
    }
    sseClients[id].add(res);

    // Send initial state immediately directly to this client
    try {
      const clientState = getClientGameState(comp);
      const initPayload = {
        type: 'STATE_UPDATE',
        serverTime: Date.now(),
        data: clientState,
      };
      res.write(`data: ${JSON.stringify(initPayload)}\n\n`);
    } catch (e) {
      console.error('Error sending initial SSE state:', e);
    }

    // Keep-alive heartbeat every 10s for mobile connections & Cloud Run proxy
    const pingTimer = setInterval(() => {
      try {
        res.write(`: ping ${Date.now()}\n\n`);
      } catch {
        clearInterval(pingTimer);
        sseClients[id]?.delete(res);
      }
    }, 10000);

    req.on('close', () => {
      clearInterval(pingTimer);
      sseClients[id]?.delete(res);
    });
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', serverTime: Date.now() });
  });

  // Check if public shared origin (ais-pre-*) is active (not returning 404 Page not found)
  app.get('/api/check-public-url', async (req, res) => {
    const targetUrl = String(req.query.url || '').trim();
    if (!targetUrl || (!targetUrl.startsWith('https://') && !targetUrl.startsWith('http://'))) {
      return res.json({ reachable: true, status: 200 });
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(targetUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      // 404 means the remixed app has not been Shared/Published on AI Studio yet
      const reachable = response.status !== 404;
      return res.json({ reachable, status: response.status });
    } catch {
      return res.json({ reachable: true, status: 0 });
    }
  });

  // Get all competitions (Admin list)
  app.get('/api/competitions', (req, res) => {
    const list = Object.values(competitions).map((c) => ({
      id: c.id,
      roomCode: c.roomCode,
      title: c.title,
      schoolName: c.schoolName,
      status: c.status,
      date: c.date,
      time: c.time,
      totalParticipants: c.participants.length,
      totalQuestions: c.questions.length,
      winnerId: c.winnerId,
      createdAt: c.createdAt,
    }));
    res.json(list);
  });

  // Get single competition details (Admin / Proctor view)
  app.get('/api/competitions/:id', (req, res) => {
    const comp = competitions[req.params.id];
    if (!comp) return res.status(404).json({ error: 'Không tìm thấy cuộc thi' });
    res.json({ ...comp, serverTime: Date.now() });
  });

  // Room lookup by roomCode (for Students joining)
  app.get('/api/rooms/:roomCode', (req, res) => {
    const roomCode = req.params.roomCode.toUpperCase().trim();
    const comp = Object.values(competitions).find(
      (c) => c.roomCode.toUpperCase() === roomCode
    );
    if (!comp) return res.status(404).json({ error: 'Mã phòng không tồn tại' });

    res.json({
      id: comp.id,
      roomCode: comp.roomCode,
      title: comp.title,
      schoolName: comp.schoolName,
      slogan: comp.slogan,
      status: comp.status,
      gameState: comp.gameState,
      grades: comp.grades,
      totalParticipants: comp.participants.length,
    });
  });

  // Student Join Room
  app.post('/api/rooms/:roomCode/join', (req, res) => {
    const roomCode = req.params.roomCode.toUpperCase().trim();
    const { name, className, studentCode, sessionId } = req.body;

    const comp = Object.values(competitions).find(
      (c) => c.roomCode.toUpperCase() === roomCode
    );
    if (!comp) {
      return res.status(404).json({ error: 'Mã phòng không tồn tại' });
    }

    if (comp.rules.lockRoomOnStart && comp.status === 'LIVE') {
      return res.status(403).json({ error: 'Phòng thi đã bắt đầu và không nhận thêm thí sinh mới' });
    }

    if (!name || !className) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ Họ tên và Lớp của bạn' });
    }

    // Check existing participant by sessionId, studentCode, or exact (name + className)
    const normalizedStudentCode = studentCode ? String(studentCode).trim().toUpperCase() : '';
    let participant = comp.participants.find(
      (p) =>
        (sessionId && p.sessionId === sessionId) ||
        (normalizedStudentCode && p.studentCode && p.studentCode.trim().toUpperCase() === normalizedStudentCode) ||
        (p.name.trim().toLowerCase() === name.trim().toLowerCase() &&
          p.className.trim().toLowerCase() === className.trim().toLowerCase())
    );

    const now = Date.now();

    if (participant) {
      // Reconnection or claiming slot: update online status, name and session
      participant.isOnline = true;
      participant.lastSeenAt = now;
      if (name) participant.name = name.trim();
      if (className) participant.className = className.trim().toUpperCase();
      if (normalizedStudentCode) participant.studentCode = normalizedStudentCode;
      if (sessionId) participant.sessionId = sessionId;
    } else {
      // New participant
      const detectedGrade = className.replace(/[^0-9]/g, '').slice(0, 2) || '';
      const code = normalizedStudentCode || `SBD-${String(comp.participants.length + 1).padStart(2, '0')}`;
      participant = {
        id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sessionId: sessionId || `sess-${Date.now()}`,
        name: name.trim(),
        grade: detectedGrade,
        className: className.trim().toUpperCase(),
        studentCode: code,
        status: 'ACTIVE',
        eliminatedAtQuestionIndex: null,
        eliminatedAtQuestionOrder: null,
        isOnline: true,
        lastSeenAt: now,
        joinedAt: now,
        totalCorrect: 0,
        totalWrong: 0,
        totalResponseTimeMs: 0,
        violations: [],
      };
      comp.participants.push(participant);
      comp.logs.unshift({
        id: `log-${Date.now()}`,
        timestamp: now,
        action: `Thí sinh ${participant.name} (${participant.className}) tham gia phòng`,
        performedBy: 'Hệ thống',
      });
    }

    comp.updatedAt = now;
    saveCompetitions();
    broadcastCompetitionState(comp.id);

    res.json({
      success: true,
      participant,
      competitionId: comp.id,
      roomCode: comp.roomCode,
    });
  });

  // Participant Heartbeat (keepalive & check status)
  app.post('/api/competitions/:id/heartbeat', (req, res) => {
    const { id } = req.params;
    const { participantId } = req.body;
    const comp = competitions[id];
    if (!comp) return res.status(404).json({ error: 'Cuộc thi không tồn tại' });

    const participant = comp.participants.find((p) => p.id === participantId);
    if (participant) {
      participant.lastSeenAt = Date.now();
      participant.isOnline = true;
    }

    res.json({
      status: 'ok',
      participantStatus: participant?.status || 'SPECTATOR',
      gameState: comp.gameState,
      serverTime: Date.now(),
    });
  });

  // Submit Answer
  app.post('/api/competitions/:id/answers', (req, res) => {
    const { id } = req.params;
    const { participantId, questionId, answer, clientResponseTimeMs } = req.body;
    const comp = competitions[id];

    if (!comp) {
      return res.status(404).json({ error: 'Cuộc thi không tồn tại' });
    }

    const currentQ = comp.questions[comp.currentQuestionIndex];
    if (!currentQ || currentQ.id !== questionId) {
      return res.status(400).json({ error: 'Câu hỏi không khớp với câu hiện tại của hệ thống' });
    }

    // Must be in ANSWERING state
    if (comp.gameState !== 'ANSWERING') {
      return res.status(400).json({ error: 'Hệ thống đã khóa hoặc chưa mở nhận đáp án' });
    }

    const now = Date.now();
    // Allow small 500ms network jitter buffer beyond questionEndTime
    if (comp.questionEndTime && now > comp.questionEndTime + 500) {
      return res.status(400).json({ error: 'Hết thời gian trả lời' });
    }

    const participant = comp.participants.find((p) => p.id === participantId);
    if (!participant) {
      return res.status(404).json({ error: 'Thí sinh không tồn tại trong danh sách' });
    }

    // Only ACTIVE or RESCUED contestants can submit scored answers
    if (participant.status === 'ELIMINATED' || participant.status === 'SPECTATOR') {
      return res.status(403).json({
        error: 'Bạn đã dừng cuộc thi (chế độ quan sát) và không thể nộp đáp án. Vui lòng chờ vòng cứu trợ!',
        eliminated: true,
        participantStatus: participant.status,
      });
    }

    if (!comp.answers[questionId]) {
      comp.answers[questionId] = {};
    }

    const existing = comp.answers[questionId][participantId];
    if (existing && !comp.rules.allowAnswerChange) {
      return res.status(400).json({ error: 'Bạn đã xác nhận đáp án và không thể thay đổi' });
    }

    // Server-side correctness evaluation
    const isCorrect = checkAnswerCorrectness(
      answer,
      currentQ.correctAnswer,
      currentQ.acceptedAnswers || [],
      {
        caseSensitive: currentQ.caseSensitive,
        ignoreDiacritics: currentQ.ignoreDiacritics,
        ignoreSpaces: currentQ.ignoreSpaces,
        questionType: currentQ.type,
        questionOptions: currentQ.options,
      }
    );

    const submission: AnswerSubmission = {
      participantId,
      questionId,
      answer: String(answer).trim(),
      submittedAtServer: now,
      clientResponseTimeMs: clientResponseTimeMs || 0,
      isCorrect,
    };

    comp.answers[questionId][participantId] = submission;
    comp.updatedAt = now;
    saveCompetitions();

    // Broadcast updated submission counts
    broadcastCompetitionState(comp.id);

    res.json({
      success: true,
      message: 'Đã ghi nhận đáp án thành công',
      submittedAt: now,
    });
  });

  // Admin Control Actions
  app.post('/api/competitions/:id/control', (req, res) => {
    const { id } = req.params;
    const { action, payload } = req.body;
    const comp = competitions[id];

    if (!comp) return res.status(404).json({ error: 'Cuộc thi không tồn tại' });
    const now = Date.now();

    switch (action) {
      case 'START_COMPETITION': {
        comp.status = 'LIVE';
        comp.gameState = 'QUESTION_READY';
        comp.currentQuestionIndex = 0;
        comp.logs.unshift({
          id: `log-${now}`,
          timestamp: now,
          action: 'Bắt đầu cuộc thi chính thức',
          performedBy: 'Ban Tổ Chức',
        });
        break;
      }

      case 'READY_QUESTION': {
        comp.status = 'LIVE';
        comp.gameState = 'QUESTION_READY';
        comp.questionStartTime = null;
        comp.questionEndTime = null;
        comp.logs.unshift({
          id: `log-${now}`,
          timestamp: now,
          action: `Hiển thị câu ${comp.currentQuestionIndex + 1}`,
          performedBy: 'Ban Tổ Chức',
        });
        break;
      }

      case 'START_QUESTION': {
        const q = comp.questions[comp.currentQuestionIndex];
        const durationSec = payload?.durationSeconds || q?.timeLimitSeconds || 15;
        comp.status = 'LIVE';
        comp.gameState = 'ANSWERING';
        comp.questionStartTime = now;
        comp.questionEndTime = now + durationSec * 1000;
        comp.logs.unshift({
          id: `log-${now}`,
          timestamp: now,
          action: `Bắt đầu đếm ngược ${durationSec}s cho câu ${comp.currentQuestionIndex + 1}`,
          performedBy: 'Ban Tổ Chức',
        });
        break;
      }

      case 'LOCK_ANSWERS': {
        comp.gameState = 'LOCKED';
        comp.questionEndTime = now;
        comp.logs.unshift({
          id: `log-${now}`,
          timestamp: now,
          action: `Khóa nhận đáp án câu ${comp.currentQuestionIndex + 1}`,
          performedBy: 'Ban Tổ Chức',
        });
        break;
      }

      case 'REVEAL_ANSWER': {
        comp.gameState = 'ANSWER_REVEALED';
        const q = comp.questions[comp.currentQuestionIndex];
        const newlyEliminatedCount = evaluateQuestionResults(comp, q);
        comp.logs.unshift({
          id: `log-${now}`,
          timestamp: now,
          action: `Công bố đáp án câu ${comp.currentQuestionIndex + 1}: ${q?.correctAnswer}. Loại ${newlyEliminatedCount} thí sinh trả lời sai/không trả lời.`,
          performedBy: 'Ban Tổ Chức',
        });
        break;
      }

      case 'CALCULATE_RESULTS': {
        comp.gameState = 'RESULT';
        const q = comp.questions[comp.currentQuestionIndex];
        const newlyEliminatedCount = evaluateQuestionResults(comp, q);
        comp.logs.unshift({
          id: `log-${now}`,
          timestamp: now,
          action: `Tổng kết câu ${q ? q.order : ''}: ${newlyEliminatedCount} thí sinh bị loại`,
          performedBy: 'Ban Tổ Chức',
        });
        break;
      }

      case 'NEXT_QUESTION': {
        // Auto-evaluate current question before advancing, ensuring any incorrect or unanswered student is eliminated
        const prevQ = comp.questions[comp.currentQuestionIndex];
        if (prevQ) {
          evaluateQuestionResults(comp, prevQ);
        }

        if (comp.currentQuestionIndex < comp.questions.length - 1) {
          comp.currentQuestionIndex++;
          comp.gameState = 'QUESTION_READY';
          comp.questionStartTime = null;
          comp.questionEndTime = null;
          comp.logs.unshift({
            id: `log-${now}`,
            timestamp: now,
            action: `Chuyển sang câu hỏi số ${comp.currentQuestionIndex + 1}`,
            performedBy: 'Ban Tổ Chức',
          });
        } else {
          comp.gameState = 'FINISHED';
          comp.status = 'FINISHED';
        }
        break;
      }

      case 'PREV_QUESTION': {
        if (comp.currentQuestionIndex > 0) {
          comp.currentQuestionIndex--;
          comp.gameState = 'QUESTION_READY';
          comp.questionStartTime = null;
          comp.questionEndTime = null;
        }
        break;
      }

      case 'RESCUE_STUDENTS': {
        // Payload: { type: 'ALL' | 'RANDOM' | 'GRADE' | 'CLASS' | 'SPECIFIC_QUESTION' | 'MANUAL', count?: number, grade?: string, className?: string, participantIds?: string[] }
        const { type, count, grade, className, participantIds } = payload || {};
        const eliminatedList = comp.participants.filter((p) => p.status === 'ELIMINATED');
        let toRescue: Participant[] = [];

        if (type === 'ALL') {
          toRescue = [...eliminatedList];
        } else if (type === 'RANDOM') {
          const num = Math.min(count || 10, eliminatedList.length);
          // Shuffle and pick
          const shuffled = [...eliminatedList].sort(() => 0.5 - Math.random());
          toRescue = shuffled.slice(0, num);
        } else if (type === 'GRADE' && grade) {
          toRescue = eliminatedList.filter((p) => p.grade === grade);
        } else if (type === 'CLASS' && className) {
          toRescue = eliminatedList.filter((p) => p.className.toUpperCase() === className.toUpperCase());
        } else if (type === 'MANUAL' && Array.isArray(participantIds)) {
          toRescue = eliminatedList.filter((p) => participantIds.includes(p.id));
        }

        const rescuedIds: string[] = [];
        toRescue.forEach((p) => {
          p.status = 'RESCUED';
          p.eliminatedAtQuestionOrder = null;
          p.eliminatedAtQuestionIndex = null;
          p.rescuedAtQuestionIndex = comp.currentQuestionIndex;
          rescuedIds.push(p.id);
        });

        const rescueEvent: RescueEvent = {
          id: `rescue-${now}`,
          timestamp: now,
          type: type || 'ALL',
          description: `Cứu trợ ${toRescue.length} thí sinh (${type})`,
          count: toRescue.length,
          rescuedParticipantIds: rescuedIds,
        };

        comp.rescues.push(rescueEvent);
        comp.logs.unshift({
          id: `log-${now}`,
          timestamp: now,
          action: `Thực hiện cứu trợ: ${toRescue.length} thí sinh quay lại sàn thi đấu`,
          performedBy: 'Ban Tổ Chức',
        });
        break;
      }

      case 'SIMULATE_DEMO_PLAYERS': {
        const count = payload?.count || 66;
        const demos = generateDemoParticipants(count);
        comp.participants = demos; // Replace with complete 66 contestants from 33 classes
        comp.logs.unshift({
          id: `log-${now}`,
          timestamp: now,
          action: `Khởi tạo 66 thí sinh đại diện cho 33 lớp THPT 25-10`,
          performedBy: 'Ban Tổ Chức',
        });
        break;
      }

      case 'SIMULATE_DEMO_ANSWERS': {
        // Auto submit answers for simulated demo participants
        const q = comp.questions[comp.currentQuestionIndex];
        if (q && comp.gameState === 'ANSWERING') {
          if (!comp.answers[q.id]) comp.answers[q.id] = {};
          comp.participants.forEach((p) => {
            if (p.status === 'ACTIVE' || p.status === 'RESCUED') {
              // 70% chance of correct answer
              const isCorrect = Math.random() < 0.75;
              let answer = q.correctAnswer;
              if (!isCorrect) {
                if (q.type === 'ABCD') {
                  const wrongOptions = ['A', 'B', 'C', 'D'].filter((opt) => opt !== q.correctAnswer);
                  answer = wrongOptions[Math.floor(Math.random() * wrongOptions.length)] || 'A';
                } else if (q.type === 'TRUE_FALSE') {
                  answer = q.correctAnswer === 'Đúng' ? 'Sai' : 'Đúng';
                } else {
                  answer = 'Đáp án sai thử nghiệm';
                }
              }

              comp.answers[q.id][p.id] = {
                participantId: p.id,
                questionId: q.id,
                answer,
                submittedAtServer: now,
                clientResponseTimeMs: Math.floor(Math.random() * 8000) + 1000,
                isCorrect,
              };
            }
          });
        }
        break;
      }

      case 'RING_GOLDEN_BELL': {
        comp.gameState = 'FINISHED';
        comp.status = 'FINISHED';
        comp.ceremonyMode = 'CHAMPION';
        comp.gameState = 'FINISHED';
        comp.status = 'FINISHED';
        recalculateParticipantScores(comp);
        const sorted = getSortedLeaderboard(comp);
        if (payload?.winnerId) {
          comp.winnerId = payload.winnerId;
        } else if (sorted.length > 0) {
          comp.winnerId = sorted[0].id;
        }
        comp.logs.unshift({
          id: `log-${now}`,
          timestamp: now,
          action: 'RUNG CHUÔNG VÀNG! Vinh danh Quán Quân xuất sắc nhất!',
          performedBy: 'Ban Tổ Chức',
        });
        saveCompetitions();
        break;
      }

      case 'SET_CEREMONY_MODE': {
        const mode = payload?.mode || 'CHAMPION';
        comp.ceremonyMode = mode;
        comp.gameState = 'FINISHED';
        comp.status = 'FINISHED';
        recalculateParticipantScores(comp);
        const sorted = getSortedLeaderboard(comp);
        if (!comp.winnerId && sorted.length > 0) {
          comp.winnerId = sorted[0].id;
        }
        const modeLabel = mode === 'CHAMPION' ? 'Quán Quân (Rung Chuông Vàng)' : mode === 'TOP3' ? 'Bục Vinh Quang Top 3' : 'Bảng Vàng Top 5';
        comp.logs.unshift({
          id: `log-${now}`,
          timestamp: now,
          action: `Chuyển chế độ vinh danh: ${modeLabel}`,
          performedBy: 'Ban Tổ Chức',
        });
        saveCompetitions();
        break;
      }

      case 'PAUSE_COMPETITION': {
        comp.status = 'PAUSED';
        break;
      }

      case 'RESUME_COMPETITION': {
        comp.status = 'LIVE';
        break;
      }

      case 'RESET_COMPETITION': {
        comp.status = 'WAITING';
        comp.gameState = 'WAITING';
        comp.currentQuestionIndex = 0;
        comp.questionStartTime = null;
        comp.questionEndTime = null;
        comp.winnerId = null;
        comp.ceremonyMode = undefined;
        comp.answers = {};
        comp.rescues = [];
        comp.participants.forEach((p) => {
          p.status = 'ACTIVE';
          p.totalCorrect = 0;
          p.totalWrong = 0;
          p.totalResponseTimeMs = 0;
          p.eliminatedAtQuestionIndex = null;
          p.eliminatedAtQuestionOrder = null;
        });
        comp.logs.unshift({
          id: `log-${now}`,
          timestamp: now,
          action: 'Đặt lại trạng thái ban đầu của cuộc thi',
          performedBy: 'Ban Tổ Chức',
        });
        break;
      }

      case 'CLEAR_ALL_PARTICIPANTS': {
        comp.participants = [];
        comp.answers = {};
        comp.rescues = [];
        comp.winnerId = null;
        comp.gameState = 'WAITING';
        comp.currentQuestionIndex = 0;
        comp.questionStartTime = null;
        comp.questionEndTime = null;
        comp.logs.unshift({
          id: `log-${now}`,
          timestamp: now,
          action: 'Đã xóa toàn bộ danh sách thí sinh để chuẩn bị tải danh sách 66 thí sinh chính thức',
          performedBy: 'Ban Tổ Chức',
        });
        break;
      }
    }

    comp.updatedAt = now;
    saveCompetitions();
    broadcastCompetitionState(comp.id);

    res.json({ success: true, gameState: comp.gameState, status: comp.status });
  });

  // Participant status update (Eliminate / Revive / Violation flag)
  app.post('/api/competitions/:id/participants/:pId/status', (req, res) => {
    const { id, pId } = req.params;
    const { status, violation } = req.body;
    const comp = competitions[id];
    if (!comp) return res.status(404).json({ error: 'Cuộc thi không tồn tại' });

    const p = comp.participants.find((item) => item.id === pId);
    if (!p) return res.status(404).json({ error: 'Thí sinh không tồn tại' });

    if (status) {
      p.status = status;
      if (status === 'ACTIVE' || status === 'RESCUED') {
        p.eliminatedAtQuestionIndex = null;
        p.eliminatedAtQuestionOrder = null;
      } else if (status === 'ELIMINATED') {
        p.eliminatedAtQuestionIndex = comp.currentQuestionIndex;
      }
    }

    if (violation) {
      p.violations.push(violation);
    }

    comp.updatedAt = Date.now();
    saveCompetitions();
    broadcastCompetitionState(comp.id);

    res.json({ success: true, participant: p });
  });

  // Participant leaves room (voluntarily or closing window)
  app.post('/api/competitions/:id/participants/:pId/leave', (req, res) => {
    const { id, pId } = req.params;
    const comp = competitions[id];
    if (!comp) return res.status(404).json({ error: 'Cuộc thi không tồn tại' });

    const idx = comp.participants.findIndex((p) => p.id === pId);
    if (idx === -1) return res.json({ success: true, message: 'Thí sinh đã không còn trong phòng' });

    const participant = comp.participants[idx];

    // Remove participant from room so admin list updates immediately
    comp.participants.splice(idx, 1);
    comp.logs.unshift({
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      action: `Thí sinh đã rời khỏi phòng thi: ${participant.name} (${participant.className})`,
      performedBy: 'Học sinh',
    });

    comp.updatedAt = Date.now();
    saveCompetitions();
    broadcastCompetitionState(comp.id);
    res.json({ success: true });
  });

  // Participant set offline beacon
  app.post('/api/competitions/:id/participants/:pId/offline', (req, res) => {
    const { id, pId } = req.params;
    const comp = competitions[id];
    if (!comp) return res.status(404).json({ error: 'Cuộc thi không tồn tại' });

    const p = comp.participants.find((item) => item.id === pId);
    if (p) {
      p.isOnline = false;
      comp.updatedAt = Date.now();
      saveCompetitions();
      broadcastCompetitionState(comp.id);
    }
    res.json({ success: true });
  });

  // Import official participants list (CSV/JSON)
  app.post('/api/competitions/:id/participants/import', (req, res) => {
    const { id } = req.params;
    const { participants: newParticipants, replaceExisting = true } = req.body;
    const comp = competitions[id];
    if (!comp) return res.status(404).json({ error: 'Cuộc thi không tồn tại' });

    if (!Array.isArray(newParticipants)) {
      return res.status(400).json({ error: 'Dữ liệu danh sách thí sinh không hợp lệ' });
    }

    const now = Date.now();
    const formattedParticipants: Participant[] = newParticipants.map((p, idx) => {
      const className = String(p.className || '').trim().toUpperCase();
      const code = p.studentCode || `SBD-${String(idx + 1).padStart(2, '0')}`;
      return {
        id: `p-${now}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        sessionId: `session-${now}-${idx}`,
        name: String(p.name || '').trim(),
        className,
        studentCode: code,
        status: 'ACTIVE',
        totalCorrect: 0,
        totalWrong: 0,
        totalResponseTimeMs: 0,
        eliminatedAtQuestionIndex: null,
        eliminatedAtQuestionOrder: null,
        violations: [],
        isOnline: true,
        lastSeenAt: now,
        deviceInfo: {
          userAgent: 'Tải lên bởi Ban Tổ Chức',
          ipAddress: '127.0.0.1',
          screenResolution: '1920x1080',
          lastSeenAt: now,
        },
        joinedAt: now,
      };
    });

    if (replaceExisting) {
      comp.participants = formattedParticipants;
      comp.answers = {};
      comp.rescues = [];
      comp.winnerId = null;
    } else {
      comp.participants.push(...formattedParticipants);
    }

    comp.updatedAt = now;
    comp.logs.unshift({
      id: `log-${now}`,
      timestamp: now,
      action: `Tải lên thành công ${formattedParticipants.length} thí sinh chính thức`,
      performedBy: 'Ban Tổ Chức',
    });

    saveCompetitions();
    broadcastCompetitionState(comp.id);

    res.json({
      success: true,
      count: comp.participants.length,
      participants: comp.participants,
    });
  });

  // Add a single participant manually
  app.post('/api/competitions/:id/participants', (req, res) => {
    const { id } = req.params;
    const { name, className, studentCode } = req.body;
    const comp = competitions[id];
    if (!comp) return res.status(404).json({ error: 'Cuộc thi không tồn tại' });

    if (!name || !className) {
      return res.status(400).json({ error: 'Thiếu họ tên hoặc lớp' });
    }

    const now = Date.now();
    const code = studentCode || `SBD-${String(comp.participants.length + 1).padStart(2, '0')}`;
    const newParticipant: Participant = {
      id: `p-${now}-${Math.random().toString(36).substring(2, 7)}`,
      sessionId: `session-${now}`,
      name: String(name).trim(),
      className: String(className).trim().toUpperCase(),
      studentCode: code,
      status: 'ACTIVE',
      totalCorrect: 0,
      totalWrong: 0,
      totalResponseTimeMs: 0,
      eliminatedAtQuestionIndex: null,
      eliminatedAtQuestionOrder: null,
      violations: [],
      isOnline: true,
      lastSeenAt: now,
      joinedAt: now,
    };

    comp.participants.push(newParticipant);
    comp.updatedAt = now;
    comp.logs.unshift({
      id: `log-${now}`,
      timestamp: now,
      action: `Thêm thí sinh: ${newParticipant.name} (${newParticipant.className} - ${newParticipant.studentCode})`,
      performedBy: 'Ban Tổ Chức',
    });

    saveCompetitions();
    broadcastCompetitionState(comp.id);

    res.json({ success: true, participant: newParticipant });
  });

  // Delete all participants
  app.delete('/api/competitions/:id/participants', (req, res) => {
    const { id } = req.params;
    const comp = competitions[id];
    if (!comp) return res.status(404).json({ error: 'Cuộc thi không tồn tại' });

    comp.participants = [];
    comp.answers = {};
    comp.rescues = [];
    comp.winnerId = null;
    comp.updatedAt = Date.now();

    comp.logs.unshift({
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      action: 'Xóa toàn bộ danh sách thí sinh',
      performedBy: 'Ban Tổ Chức',
    });

    saveCompetitions();
    broadcastCompetitionState(comp.id);

    res.json({ success: true, count: 0 });
  });

  // Delete a single participant
  app.delete('/api/competitions/:id/participants/:pId', (req, res) => {
    const { id, pId } = req.params;
    const comp = competitions[id];
    if (!comp) return res.status(404).json({ error: 'Cuộc thi không tồn tại' });

    const idx = comp.participants.findIndex((p) => p.id === pId);
    if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy thí sinh' });

    const removed = comp.participants.splice(idx, 1)[0];
    comp.updatedAt = Date.now();
    comp.logs.unshift({
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      action: `Xóa thí sinh: ${removed.name} (${removed.className})`,
      performedBy: 'Ban Tổ Chức',
    });

    saveCompetitions();
    broadcastCompetitionState(comp.id);

    res.json({ success: true });
  });

  // Update a single participant's information
  app.put('/api/competitions/:id/participants/:pId', (req, res) => {
    const { id, pId } = req.params;
    const { name, className, studentCode, status } = req.body;
    const comp = competitions[id];
    if (!comp) return res.status(404).json({ error: 'Cuộc thi không tồn tại' });

    const p = comp.participants.find((item) => item.id === pId);
    if (!p) return res.status(404).json({ error: 'Không tìm thấy thí sinh' });

    if (name !== undefined) p.name = String(name).trim();
    if (className !== undefined) p.className = String(className).trim().toUpperCase();
    if (studentCode !== undefined) p.studentCode = String(studentCode).trim().toUpperCase();
    if (status !== undefined) {
      p.status = status;
      if (status === 'ACTIVE' || status === 'RESCUED') {
        p.eliminatedAtQuestionIndex = null;
        p.eliminatedAtQuestionOrder = null;
      }
    }

    comp.updatedAt = Date.now();
    comp.logs.unshift({
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      action: `Cập nhật thông tin thí sinh: ${p.name} (${p.className} - ${p.studentCode})`,
      performedBy: 'Ban Tổ Chức',
    });

    saveCompetitions();
    broadcastCompetitionState(comp.id);

    res.json({ success: true, participant: p });
  });

  // Create new competition
  app.post('/api/competitions', (req, res) => {
    const body = req.body;
    const now = Date.now();
    const newComp: Competition = {
      id: `comp-${now}`,
      roomCode: body.roomCode?.toUpperCase() || `RCV${Math.floor(1000 + Math.random() * 9000)}`,
      title: body.title || 'RUNG CHUÔNG VÀNG – TRƯỜNG THPT 25-10',
      schoolName: body.schoolName || 'TRƯỜNG THPT 25-10',
      slogan: body.slogan || 'Chinh phục tri thức – Bứt phá giới hạn',
      organizer: body.organizer || 'TRƯỜNG THPT 25-10',
      grades: body.grades || ['10', '11', '12'],
      date: body.date || new Date().toISOString().split('T')[0],
      time: body.time || '08:00',
      location: body.location || 'Sân trường THPT 25-10',
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
        ...(body.rules || {}),
      },
      questions: body.questions || sampleQuestions,
      participants: [],
      answers: {},
      rescues: [],
      logs: [
        {
          id: `log-${now}`,
          timestamp: now,
          action: `Tạo mới cuộc thi: ${body.title}`,
          performedBy: 'Ban Tổ Chức',
        },
      ],
      winnerId: null,
      createdAt: now,
      updatedAt: now,
    };

    competitions[newComp.id] = newComp;
    saveCompetitions();

    res.json(newComp);
  });

  // Update competition settings / questions / rules
  app.put('/api/competitions/:id', async (req, res) => {
    const { id } = req.params;
    const comp = competitions[id];
    if (!comp) return res.status(404).json({ error: 'Cuộc thi không tồn tại' });

    Object.assign(comp, req.body, { updatedAt: Date.now() });
    
    try {
      await saveCompetitions(comp.id);
      broadcastCompetitionState(comp.id);
      res.json(comp);
    } catch (saveErr: any) {
      console.error('Error saving competition to Firestore:', saveErr);
      res.status(500).json({ error: 'Lỗi lưu dữ liệu lên Cloud Firestore: ' + (saveErr?.message || 'Lỗi hệ thống') });
    }
  });

  // Export Results CSV
  app.get('/api/competitions/:id/export', (req, res) => {
    const comp = competitions[req.params.id];
    if (!comp) return res.status(404).send('Not found');

    const headers = [
      'STT',
      'Số báo danh',
      'Họ và tên',
      'Lớp',
      'Trạng thái cuối',
      'Số câu đúng',
      'Số câu sai',
      'Câu bị loại',
      'Tổng thời gian trả lời (s)',
    ];

    const sortedParticipants = [...comp.participants].sort((a, b) => {
      // Active first, then by totalCorrect desc, then totalResponseTimeMs asc
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (b.status === 'ACTIVE' && a.status !== 'ACTIVE') return 1;
      if (b.totalCorrect !== a.totalCorrect) return b.totalCorrect - a.totalCorrect;
      return a.totalResponseTimeMs - b.totalResponseTimeMs;
    });

    const rows = sortedParticipants.map((p, idx) => [
      idx + 1,
      p.studentCode || '',
      `"${p.name}"`,
      p.className,
      p.status,
      p.totalCorrect,
      p.totalWrong,
      p.eliminatedAtQuestionOrder ? `Câu ${p.eliminatedAtQuestionOrder}` : 'Không',
      (p.totalResponseTimeMs / 1000).toFixed(2),
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Ket-Qua-Rung-Chuong-Vang-THPT-25-10-${comp.roomCode}.csv"`
    );
    res.send(csvContent);
  });

async function startServer() {
  await loadCompetitions();

  // Setup Vite dev server or serve static build
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Only listen on port in standalone/container environments (avoid port binding conflicts on Vercel)
  if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Rung Chuông Vàng THPT 25-10 Server running on port ${PORT}`);
    });
  }
}

// Start server if not running as serverless function
if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  startServer().catch((err) => {
    console.error('Fatal error starting server:', err);
    process.exit(1);
  });
}

export { app };
export default app;
