import React from 'react';

interface DualScreenGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLedWindow: () => void;
}

export const DualScreenGuideModal: React.FC<DualScreenGuideModalProps> = ({
  isOpen,
  onClose,
  onOpenLedWindow,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-sky-950/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <span className="text-xs uppercase font-extrabold text-slate-700 font-bold tracking-wider">
              HƯỚNG DẪN KỸ THUẬT
            </span>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mt-0.5">
              CHIẾU 2 MÀN HÌNH (ADMIN & MÀN LED)
            </h3>
            <p className="text-xs text-slate-500">
              1 Laptop vừa điều khiển, vừa chiếu toàn màn hình lên Máy chiếu / LED
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-bold text-sm transition cursor-pointer"
          >
            [X]
          </button>
        </div>

        {/* 4 Steps Visual Guide */}
        <div className="space-y-3.5 text-xs sm:text-sm">
          {/* Step 1 */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white font-black flex items-center justify-center shrink-0">
              1
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm">
                Cắm cáp kết nối (HDMI / VGA / Type-C)
              </h4>
              <p className="text-slate-600 mt-1 leading-relaxed">
                Cắm dây từ máy tính Admin vào <strong>Máy chiếu</strong> hoặc <strong>Bộ xử lý màn hình LED sân khấu</strong>.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-xl bg-sky-700 text-white font-black flex items-center justify-center shrink-0">
              2
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm">
                Chọn chế độ "Mở rộng màn hình" (Extend)
              </h4>
              <p className="text-slate-600 mt-1 leading-relaxed">
                Trên bàn phím máy tính Windows, nhấn tổ hợp phím:{' '}
                <kbd className="px-2 py-1 rounded bg-white border border-slate-200 font-mono text-slate-800 font-bold font-bold">
                  Windows + P
                </kbd>{' '}
                rồi bấm chọn <strong className="text-slate-900">"Extend" (Mở rộng)</strong>.
                <br />
                <span className="text-[11px] text-slate-500">
                  (Chế độ này giúp màn hình máy chiếu trở thành màn hình thứ 2, độc lập với màn hình laptop).
                </span>
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-xl bg-sky-800 text-white font-black flex items-center justify-center shrink-0">
              3
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm">
                Bấm nút "Mở cửa sổ LED riêng" & Kéo sang máy chiếu
              </h4>
              <p className="text-slate-600 mt-1 leading-relaxed">
                Bấm nút <strong>"MỞ CỬA SỔ CHIẾU LED"</strong>. Cửa sổ màn hình sân khấu sẽ mở ra. Bạn dùng chuột kéo cửa sổ đó sang màn hình máy chiếu bên cạnh, sau đó nhấn phím{' '}
                <kbd className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono text-slate-800 font-bold font-bold">
                  F11
                </kbd>{' '}
                (hoặc bấm nút "Toàn màn hình") để chiếu tràn màn hình LED.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center shrink-0">
              4
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm">
                Điều khiển & Quan sát đồng thời
              </h4>
              <p className="text-slate-600 mt-1 leading-relaxed">
                Tại màn hình laptop Admin, bạn giữ nguyên giao diện điều khiển. Khung{' '}
                <strong className="text-slate-700 font-bold">"MÀN HÌNH GIÁM SÁT LED"</strong> sẽ phản chiếu 100% chính xác từng giây những gì đang chiếu trên sân khấu để bạn hoàn toàn an tâm làm chủ cuộc thi!
              </p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-slate-50 hover:bg-sky-50 text-sky-950 text-sky-950 text-slate-700 font-bold text-xs transition border border-slate-200"
          >
            ĐÃ HIỂU, ĐÓNG HƯỚNG DẪN
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenLedWindow();
            }}
            className="flex-1 py-3 rounded-2xl bg-sky-600 hover:bg-blue-700 text-white font-black text-xs uppercase flex items-center justify-center shadow-lg transition cursor-pointer"
          >
            MỞ CỬA SỔ CHIẾU LED NGAY
          </button>
        </div>
      </div>
    </div>
  );
};
