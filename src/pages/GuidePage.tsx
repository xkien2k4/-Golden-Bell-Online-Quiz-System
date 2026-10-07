import React, { useState } from 'react';
import { SchoolLogo } from '../components/SchoolLogo';

export const GuidePage: React.FC = () => {
  const [copiedRules, setCopiedRules] = useState(false);

  const sampleRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function xác định admin
    function isAdmin() {
      return request.auth != null && request.auth.token.role == 'admin';
    }

    // 1. Quản lý cuộc thi & phòng thi
    match /competitions/{compId} {
      allow read: if true; // Công khai để học sinh tra cứu mã phòng
      allow write: if isAdmin();

      // 2. Ngân hàng câu hỏi (BẢO VỆ ĐÁP ÁN ĐÚNG)
      match /questions/{qId} {
        // Chỉ admin mới đọc được câu hỏi có chứa đáp án đúng
        // Hoặc client chỉ đọc được trường sanitized khi câu hỏi đang diễn ra
        allow read: if isAdmin() || (resource.data.isRevealed == true);
        allow write: if isAdmin();
      }

      // 3. Danh sách thí sinh
      match /participants/{pId} {
        allow read: if true;
        // Thí sinh chỉ được tạo thông tin tham gia của chính mình
        allow create: if request.resource.data.name != null && request.resource.data.className != null;
        // Không cho phép thí sinh tự sửa trạng thái ACTIVE/ELIMINATED hoặc điểm số
        allow update: if isAdmin();
        allow delete: if isAdmin();
      }

      // 4. Lượt nộp đáp án
      match /answers/{aId} {
        // Thí sinh chỉ nộp câu trả lời trước thời hạn endTime của máy chủ
        allow create: if request.resource.data.submittedAtServer <= request.resource.data.questionEndTime;
        allow read: if isAdmin();
      }

      // 5. Nhật ký và sự kiện cứu trợ
      match /logs/{logId} {
        allow read: if true;
        allow write: if isAdmin();
      }
    }
  }
}`;

  const handleCopyRules = () => {
    navigator.clipboard.writeText(sampleRules);
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 2000);
  };

  const steps = [
    {
      num: 1,
      title: 'Tạo hoặc Chọn Cuộc Thi',
      desc: 'Hệ thống đã tạo sẵn cuộc thi mẫu "RUNG CHUÔNG VÀNG – TRƯỜNG THPT 25-10" với mã phòng mặc định RCV2510, quy tụ 66 thí sinh đại diện cho 33 lớp toàn trường.',
    },
    {
      num: 2,
      title: 'Tải và Soạn Thảo Bộ Câu Hỏi',
      desc: 'Hỗ trợ câu hỏi Trắc nghiệm ABCD, Đúng/Sai, Điền đáp án ngắn, và Câu hỏi số. Với câu điền đáp án, hệ thống tự động chuẩn hóa tiếng Việt không dấu, chữ hoa/thường (VD: "Hà Nội" = "ha noi"). Có thể tải mẫu file CSV để nhập nhanh hàng chục câu.',
    },
    {
      num: 3,
      title: 'Chiếu Mã QR Phòng Thi cho Thí Sinh',
      desc: 'Bấm nút "MÃ QR" trên thanh điều khiển hoặc trang chủ để chiếu mã lên màn hình máy chiếu. Thí sinh chỉ cần bật camera điện thoại quét để vào thẳng phòng mà không cần cài đặt ứng dụng.',
    },
    {
      num: 4,
      title: 'Thí Sinh Nhập Họ Tên & Chọn Lớp',
      desc: 'Học sinh nhập: Họ tên, Lớp (chọn từ 33 lớp của trường) và SBD, sau đó bấm "THAM GIA CUỘC THI". Hệ thống lưu thiết bị (device session) để học sinh refresh trình duyệt không bị mất bài thi.',
    },
    {
      num: 5,
      title: 'Chạy Thử Demo Với 66 Thí Sinh Giả Lập (33 Lớp)',
      desc: 'Trước giờ thi chính thức, Ban tổ chức bấm "KHỞI TẠO 66 THÍ SINH (33 LỚP)" trong Bảng điều khiển để tập dượt thử chu trình: Bắt đầu câu -> Đếm ngược -> Khóa -> Loại thí sinh -> Cứu trợ.',
    },
    {
      num: 6,
      title: 'Mở Màn Hình Trình Chiếu Sân Khấu (16:9)',
      desc: 'Cắm máy tính vào máy chiếu hoặc màn hình LED sân khấu, chọn tab "MÀN HÌNH CHIẾU", bấm "BẬT ÂM THANH SÂN KHẤU" và bật Toàn màn hình. Màn hình này hoàn toàn không có nút điều khiển kỹ thuật.',
    },
    {
      num: 7,
      title: 'Điều Khiển Chu Trình Từng Câu Hỏi',
      desc: 'Quy trình chuẩn 4 bước cho mỗi câu: (1) BẮT ĐẦU CÂU -> Đồng hồ đếm ngược 15s; (2) Hết giờ hệ thống tự KHÓA ĐÁP ÁN; (3) Bấm CÔNG BỐ ĐÁP ÁN -> Chiếu đáp án đúng; (4) Bấm LOẠI THÍ SINH SAI -> Tự động chuyển thí sinh sai sang trạng thái đã dừng thi.',
    },
    {
      num: 8,
      title: 'Tổ Chức Cứu Trợ (Khi Số Lượng Thí Sinh Còn Ít)',
      desc: 'Khi số học sinh còn lại trên sàn ít, Ban tổ chức bấm "TỔ CHỨC CỨU TRỢ". Có thể cứu Toàn bộ, Cứu ngẫu nhiên N bạn, hoặc Cứu theo Lớp. Thí sinh được cứu sẽ lập tức nhận thông báo trên điện thoại và quay lại sàn thi.',
    },
    {
      num: 9,
      title: 'Xử Lý Câu Hỏi Phụ (Tiebreaker)',
      desc: 'Nếu hết câu hỏi chính thức mà vẫn còn nhiều thí sinh chưa bị loại, hệ thống cho phép kích hoạt câu hỏi phụ. Điểm số và thời gian nộp bài chuẩn miligiây theo máy chủ sẽ xác định người thắng cuộc nhanh nhất.',
    },
    {
      num: 10,
      title: 'Vinh Danh Quán Quân Rung Chuông Vàng',
      desc: 'Khi xác định được thí sinh xuất sắc nhất, bấm "RUNG CHUÔNG VÀNG". Màn hình LED sân khấu sẽ bùng nổ hiệu ứng chuông vàng ngân vang, pháo hoa confetti rực rỡ và thông tin quán quân.',
    },
    {
      num: 11,
      title: 'Xuất Kết Quả Toàn Cuộc Thi (CSV / Excel)',
      desc: 'Bấm nút "XUẤT KẾT QUẢ" để tải bảng điểm chuẩn gồm: Họ tên, Lớp, Khối, SBD, Trạng thái cuối, Số câu đúng/sai, Câu bị loại và Tổng thời gian trả lời phục vụ trao thưởng và lưu hồ sơ đoàn trường.',
    },
  ];

  return (
    <div className="min-h-[calc(100vh-65px)] bg-slate-50 text-slate-900 p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <SchoolLogo size={70} className="mx-auto" />
        <span className="text-xs uppercase font-extrabold tracking-widest text-slate-700 font-bold block">
          TRƯỜNG THPT 25-10 – HẢI PHÒNG
        </span>
        <h1 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight">
          CẨM NANG VẬN HÀNH & TRIỂN KHAI RUNG CHUÔNG VÀNG
        </h1>
        <p className="text-sm text-slate-500 max-w-2xl mx-auto">
          Quy trình 11 bước tổ chức cuộc thi trực tuyến quy mô toàn trường, cùng tài liệu cấu hình hạ tầng và quy tắc bảo mật.
        </p>
      </div>

      {/* 11 STEPS GUIDE */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-700 font-bold uppercase flex items-center gap-2 border-b border-slate-200 pb-2">
          
          <span>QUY TRÌNH 11 BƯỚC TỔ CHỨC NGÀY THI</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {steps.map((step) => (
            <div
              key={step.num}
              className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 hover:border-slate-300 transition"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-blue-600 text-black font-black text-sm flex items-center justify-center shrink-0">
                  {step.num}
                </span>
                <h3 className="text-sm font-extrabold text-white">{step.title}</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed pl-10.5">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION XLVII & LVII: FIREBASE & SECURITY RULES */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            
            <div>
              <h3 className="text-base font-black text-white uppercase">
                MẪU FIREBASE SECURITY RULES (CHUẨN BẢO MẬT)
              </h3>
              <p className="text-xs text-slate-500">
                Quy tắc bảo mật đảm bảo học sinh không thể đọc trước đáp án và không thể tự chỉnh sửa điểm/trạng thái.
              </p>
            </div>
          </div>

          <button
            onClick={handleCopyRules}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-200 text-slate-700 font-bold text-xs font-bold flex items-center gap-1.5 transition"
          >
            
            <span>{copiedRules ? 'Đã sao chép' : 'Sao chép Rules'}</span>
          </button>
        </div>

        <pre className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs font-mono text-emerald-300 overflow-x-auto max-h-72">
          {sampleRules}
        </pre>
      </div>

      {/* ARCHITECTURE & SCALING */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
        <h3 className="text-base font-black text-white uppercase flex items-center gap-2">
          
          <span>KIẾN TRÚC MỞ RỘNG 500 – 1.000 HỌC SINH ĐỒNG THỜI</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-700">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
            <strong className="text-slate-700 font-bold block font-bold text-sm">Server-Sent Events (SSE)</strong>
            <p className="text-slate-500">
              Truyền phát 1 chiều siêu nhẹ, tiêu thụ rất ít băng thông so với WebSocket, không tạo xung đột kết nối khi 500 máy cùng nhận hiệu lệnh.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
            <strong className="text-blue-400 block font-bold text-sm">Đồng Bộ Thời Gian Máy Chủ</strong>
            <p className="text-slate-500">
              Thời gian đếm ngược dựa trên timestamp máy chủ, khóa tự động ngay khi hết hạn, tránh gian lận chỉnh giờ máy điện thoại.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
            <strong className="text-emerald-400 block font-bold text-sm">Bảo Vệ Đáp Án Hai Lớp</strong>
            <p className="text-slate-500">
              Đáp án đúng được lưu trên máy chủ và chỉ gửi xuống khi Ban tổ chức bấm "CÔNG BỐ", học sinh inspect code không thể thấy trước đáp án.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
