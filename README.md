# Bếp nhà

Landing page ẩm thực bằng React, Vite và backend Node. Dùng npm và Node.js 22.12 trở lên.

## Chạy local

```sh
npm install
npm run dev
```

## Chạy bản production

```sh
npm run build
npm start
```

Server mặc định ở http://localhost:3000, phục vụ cả frontend và API ảnh. `npm run preview` dùng để kiểm tra bản build local.

## Nội dung và ảnh

- Nội dung món: `src/data/recipes.json`. `story` là bản thuyết minh hiển thị trên trang.
- `driveFolder` liên kết món với folder trên Google Drive; ảnh không khai báo trong JSON.
- Mục 04 dùng subfolder `gallery` của món. Tab Ảnh sự kiện tổng hợp ảnh món và gallery chung.
- Backend đồng bộ ảnh vào `.cache/drive/` mỗi 30 giây, chỉ tải ảnh mới hoặc thay đổi. Cache được giữ qua restart; lỗi Drive tiếp tục dùng snapshot cũ.
- Giao diện dùng skeleton, tải ảnh theo vùng nhìn thấy, dùng lại ảnh trong phiên và cho phép thử lại ảnh lỗi.
- Trải nghiệm dành cho viewport tối đa 440 CSS px. Màn hình lớn hơn hiển thị thông báo dùng điện thoại.

Xem [DRIVE_SETUP.md](./DRIVE_SETUP.md) để cấu hình `.env.local`, cấu trúc folder và cache. Không đưa API key vào source hoặc Git.

## Kiểm tra và đồng bộ thủ công

```sh
npm run test:drive
npm run build
npm run sync:drive
```

Chạy sync thủ công trước khi mở server; server chạy sẽ tự đồng bộ nền. Build xuất ra `dist/`. Giữ `node_modules/` để chạy project và `.cache/drive/` để phục vụ ảnh đã đồng bộ.

Các mục bổ sung trong `recipes.json`: `ingredients` (nguyên liệu), `steps` (các bước làm), `nutrition` (thông tin dinh dưỡng). Mỗi trường là mảng chuỗi; mảng rỗng hiển thị “Chưa có thông tin”.
