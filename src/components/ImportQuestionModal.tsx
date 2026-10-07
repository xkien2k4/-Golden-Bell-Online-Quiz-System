import React, { useState, useRef } from 'react';
import { parseQuestionCsv } from '../utils/questionParser';
import { Question } from '../types';

interface ImportQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (questions: Partial<Question>[], mode: 'REPLACE' | 'APPEND') => Promise<void>;
  currentQuestionsCount: number;
}

export const ImportQuestionModal: React.FC<ImportQuestionModalProps> = ({
  isOpen,
  onClose,
  onImport,
  currentQuestionsCount,
}) => {
  const [inputText, setInputText] = useState<string>('');
  const [parsedQuestions, setParsedQuestions] = useState<Partial<Question>[]>([]);
  const [importMode, setImportMode] = useState<'REPLACE' | 'APPEND'>('APPEND');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [defaultTimeLimit, setDefaultTimeLimit] = useState<number>(15);
  const [overrideAllTimes, setOverrideAllTimes] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);
    try {
      const text = await file.text();
      const parsed = parseQuestionCsv(text, { defaultTimeLimit, overrideAllTimes });
      setParsedQuestions(parsed);
    } catch (err: any) {
      alert('Lỗi đọc file: ' + (err?.message || 'File không đúng định dạng'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyTimeChange = (newTime: number, override: boolean) => {
    setDefaultTimeLimit(newTime);
    setOverrideAllTimes(override);

    if (parsedQuestions.length > 0) {
      const updated = parsedQuestions.map((q) => ({
        ...q,
        timeLimitSeconds: override ? newTime : (q.timeLimitSeconds || newTime),
      }));
      setParsedQuestions(updated);
    }
  };

  const handleConfirmImport = async () => {
    let finalQuestions = [...parsedQuestions];

    if (finalQuestions.length === 0 && inputText.trim()) {
      finalQuestions = parseQuestionCsv(inputText, { defaultTimeLimit, overrideAllTimes });
    }

    if (finalQuestions.length === 0) {
      alert('Chưa có câu hỏi nào để nhập. Vui lòng chọn file hoặc dán dữ liệu.');
      return;
    }

    if (overrideAllTimes) {
      finalQuestions = finalQuestions.map((q) => ({
        ...q,
        timeLimitSeconds: defaultTimeLimit,
      }));
    }

    setIsProcessing(true);
    try {
      await onImport(finalQuestions, importMode);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadSample = () => {
    const sampleCsv = `﻿STT,NoiDungCauHoi,LoaiCauHoi,DapAnA,DapAnB,DapAnC,DapAnD,DapAnDung,ThoiGianGiay,MonHoc,GiaiThich
1,"Trường THPT 25-10 nằm tại huyện nào thuộc tỉnh Thái Bình?",ABCD,"Huyện Hưng Hà","Huyện Quỳnh Phụ","Huyện Thái Thụy","Huyện Tiền Hải",B,15,"Địa phương","Trường THPT 25-10 toạ lạc tại Quỳnh Phụ, Thái Bình"
2,"Học sinh có quyền tham gia các hoạt động giáo dục toàn diện theo quy định.",TRUE_FALSE,"","","","",TRUE,15,"Giáo dục công dân","Quy chế học sinh THPT"
3,"Trong bảng tuần hoàn, nguyên tố có ký hiệu hóa học là Au là kim loại gì?",SHORT_ANSWER,"","","","",VÀNG,20,"Hóa học","Au là viết tắt của Aurum (Vàng)"
4,"Năm 2024 kỷ niệm bao nhiêu năm chiến thắng Điện Biên Phủ?",NUMERIC,"","","","",70,15,"Lịch sử","1954 - 2024 là tròn 70 năm"`;

    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Mau_De_Thi_Rung_Chuong_Vang_THPT_25_10.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-sky-950/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-200 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-fadeIn">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <span className="text-xs uppercase font-extrabold text-slate-700 font-bold tracking-wider">
              NHẬP NGÂN HÀNG CÂU HỎI
            </span>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mt-0.5">
              TẢI ĐỀ THI TỪ FILE EXCEL / CSV
            </h3>
            <p className="text-xs text-slate-500">
              Nhập hàng loạt câu hỏi kèm đáp án chuẩn và thời gian tùy chỉnh
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-white font-bold text-sm transition cursor-pointer"
          >
            [X]
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-slate-800">
          {/* Section 1: File Upload Box & Sample Download */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-black text-slate-900 uppercase">
                BƯỚC 1: CHỌN FILE EXCEL (.XLSX, .XLS) HOẶC CSV
              </span>
              <button
                type="button"
                onClick={handleDownloadSample}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-sky-50 text-sky-950 text-sky-950 text-slate-700 font-bold border border-slate-200 text-xs font-bold transition cursor-pointer self-start sm:self-auto shadow-sm"
              >
                TẢI FILE MẪU CHUẨN CSV
              </button>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-6 border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-2xl bg-white text-center cursor-pointer transition"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="text-xs font-bold text-slate-700">
                {fileName ? (
                  <span className="text-slate-700 font-bold font-black font-mono">
                    Đã chọn: {fileName}
                  </span>
                ) : (
                  <span>Bấm vào đây để chọn file Excel / CSV từ máy tính</span>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Time Configuration */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div>
              <span className="text-xs font-black text-slate-900 uppercase block mb-1">
                BƯỚC 2: CẤU HÌNH THỜI GIAN SUY NGHĨ CHO CÂU HỎI
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[10, 15, 20, 25, 30, 45, 60].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => handleApplyTimeChange(sec, overrideAllTimes)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      defaultTimeLimit === sec
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-white text-slate-700 hover:bg-sky-50 text-sky-950 text-sky-950 border border-slate-200'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={overrideAllTimes}
                onChange={(e) => handleApplyTimeChange(defaultTimeLimit, e.target.checked)}
                className="mt-0.5 rounded text-sky-600 w-4 h-4 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-extrabold text-slate-800 font-bold block">
                  Áp dụng {defaultTimeLimit} giây cho TẤT CẢ câu hỏi trong file tải lên
                </span>
                <span className="text-slate-500 font-normal">
                  (Đồng bộ toàn bộ đề thi có cùng thời gian, bỏ qua cột thời gian trong file).
                </span>
              </div>
            </label>
          </div>

          {/* Section 3: Import Mode Option */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="block text-xs font-black text-slate-900 uppercase">
              BƯỚC 3: CHẾ ĐỘ THÊM VÀO NGÂN HÀNG ĐỀ:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setImportMode('REPLACE')}
                className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                  importMode === 'REPLACE'
                    ? 'bg-white border-sky-600 text-sky-950 shadow-md ring-2 ring-sky-500/20'
                    : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                }`}
              >
                <div className="text-xs font-black uppercase text-slate-700 font-bold">
                  Ghi đè / Thay thế toàn bộ ({currentQuestionsCount} câu cũ)
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Xóa các câu hỏi cũ và dùng toàn bộ danh sách mới tải lên
                </div>
              </button>

              <button
                type="button"
                onClick={() => setImportMode('APPEND')}
                className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                  importMode === 'APPEND'
                    ? 'bg-white border-sky-600 text-sky-950 shadow-md ring-2 ring-sky-500/20'
                    : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                }`}
              >
                <div className="text-xs font-black uppercase text-slate-700 font-bold">
                  Thêm nối tiếp vào danh sách
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Giữ lại {currentQuestionsCount} câu hiện tại và đánh số tiếp từ câu {currentQuestionsCount + 1}
                </div>
              </button>
            </div>
          </div>

          {/* Section 4: LIVE PREVIEW */}
          {parsedQuestions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 uppercase">
                  Xem trước ({parsedQuestions.length} câu hỏi)
                </span>
                <span className="text-xs text-slate-700 font-bold font-bold">
                  Kiểm tra trước khi lưu
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1 border border-slate-200 rounded-2xl p-2 bg-slate-50">
                {parsedQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="truncate flex-1">
                      <span className="font-extrabold text-slate-800 font-bold mr-2">
                        Câu {idx + 1}:
                      </span>
                      <span className="text-slate-700 font-medium">{q.prompt}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                        ĐA: {q.correctAnswer}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-sky-50 text-sky-950 text-sky-950 text-slate-800 font-bold font-bold font-mono text-[11px] border border-slate-200">
                        {q.timeLimitSeconds}s
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 flex items-center justify-between bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-sky-50 text-sky-950 text-sky-950 text-slate-700 border border-slate-200 font-bold text-xs transition cursor-pointer"
          >
            HỦY BỎ
          </button>
          <button
            type="button"
            disabled={parsedQuestions.length === 0 || isProcessing}
            onClick={handleConfirmImport}
            className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-blue-700 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider shadow-md transition cursor-pointer"
          >
            {isProcessing
              ? 'Đang lưu...'
              : `XÁC NHẬN TẢI LÊN (${parsedQuestions.length} CÂU)`}
          </button>
        </div>
      </div>
    </div>
  );
};
