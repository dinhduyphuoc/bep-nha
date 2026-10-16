# Ảnh từ Google Drive

Server đồng bộ ảnh và danh sách Drive vào ổ đĩa khi khởi động và mỗi 30 giây. Trang đọc snapshot local; giao diện tự lấy snapshot mới nhất ở nền. Trang đang mở tự kiểm tra snapshot mỗi 30 giây. Không ghi dữ liệu Drive vào JSON, không upload từ website. Bạn upload/xóa ảnh trực tiếp trên Google Drive.

## Cấu trúc folder

Tạo một folder gốc, đặt các folder con trực tiếp bên trong:

```text
bep-nha/
├── hoa-que/
├── hoa-mat-troi/
├── hoa-viet/
├── gan-ket-dong-doi/
├── hat-ngoc-troi/
├── sum-vay/
├── dam-da-tinh-than/
├── tron-vi-yeu-thuong/
├── yaourt-trai-cay/
├── tra-thao-moc-hat-sen/
└── gallery/
```

Mỗi folder món chứa ảnh trực tiếp dùng cho carousel và subfolder `gallery` dành cho mục 04. Tạo subfolder `gallery` cho từng món. Tên liên kết nằm ở `driveFolder` trong `src/data/recipes.json`; không phụ thuộc tên hiển thị món. Folder `gallery` chứa ảnh bổ sung cho tab Ảnh sự kiện. Đọc ảnh trực tiếp trong folder món, subfolder `gallery` của món và folder `gallery` chung ở gốc; không đọc sâu hơn. Không tạo folder trùng tên.

- Carousel và album “Xem tất cả ảnh”: ảnh trực tiếp trong folder món đang chọn.
- Mục 04 “Những góc nhìn ngon lành”: chỉ ảnh trong `<folder-mon>/gallery`. Nếu subfolder này thiếu hoặc trống, mục 04 hiển thị chưa có ảnh.
- Tab “Ảnh sự kiện”: ảnh trực tiếp của các món + ảnh trong subfolder `gallery` từng món + ảnh trong `gallery` chung, giữ tỉ lệ gốc.
- Tên file là caption, thứ tự theo tên tự nhiên. Đặt `01-ten-anh.jpg`, `02-ten-anh.jpg` để sắp xếp.
- Khi đã kết nối, folder món trống/thiếu dùng hình biểu thị trống ở thẻ Menu và outlet (không có bộ đếm hay nút xem album rỗng). Folder gallery trống/thiếu hiển thị đúng “hiện chưa có ảnh”; không trộn ảnh demo vào album Drive.
- Lỗi tải mới giữ bộ ảnh đã tải thành công trước đó. Lần đầu lỗi sẽ có thông báo và hình biểu thị trống.

## Cấu hình

1. Chia sẻ folder gốc với **Anyone with the link / Viewer**. Kiểm tra các ảnh con cũng cho phép xem công khai. Dùng folder dành riêng cho các ảnh bạn muốn hiển thị trên web.
2. Trong Google Cloud Console, bật **Google Drive API** và tạo API key. Giới hạn key chỉ dùng Drive API; nếu server có IP cố định, giới hạn IP server. Đây là key server, không dùng giới hạn HTTP referrer.
3. Tạo `.env.local` ở thư mục `nauan` từ `.env.example`, điền:

```dotenv
DRIVE_ROOT_FOLDER_ID=ID_FOLDER_GOC
DRIVE_API_KEY=API_KEY_CUA_BAN
```

ID folder lấy từ link `https://drive.google.com/drive/folders/ID_FOLDER_GOC`. Không thêm tiền tố `VITE_`, không đưa API key vào JSON hay gửi qua chat. File env được gitignore.

4. Khởi động lại Vite sau khi thay env:

```sh
npm run dev -- --host 0.0.0.0
```

## Chạy production

```sh
npm run build
npm start
```

Server Node phục vụ `dist` và `/api/drive/*` cùng origin, mặc định port 3000 (`PORT` để thay). Đưa hai biến môi trường lên hosting Node khi deploy. Upload riêng thư mục `dist` lên hosting static không đủ cho kết nối Drive; cần backend đi kèm. `npm run preview` cũng hỗ trợ API để kiểm tra local.

Credentials chỉ nằm ở server. Endpoint ảnh chỉ phục vụ ID nằm trong snapshot folder đã tải thành công. Danh sách và ảnh được lưu ở `.cache/drive`, tách theo folder gốc và cấu hình món; ảnh có phiên bản được phép cache trên trình duyệt. Backend đọc file qua Drive API `alt=media`, không dùng link preview Drive làm ảnh.

Google Drive có quota và ảnh gốc lớn có thể tải chậm. Nên dùng JPEG/PNG/WebP tối ưu cho web; HEIC có thể không hiển thị trên mọi trình duyệt. Không có cơ chế cập nhật tức thời khi trang đang mở: tải lại trang hoặc nhấn Tải lại ảnh.

## Kiểm tra

```sh
npm run test:drive
npm run build
```

Tests mô phỏng phân trang, thêm/xóa ảnh, lọc loại file, gộp album, thiếu/trùng folder và lỗi Drive. Chưa kiểm chứng kết nối tài khoản thật nếu chưa điền folder ID và API key.

Tài liệu chính thức: [Tìm file trong folder công khai](https://developers.google.com/workspace/drive/api/guides/search-files), [files.list và phân trang](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list), [Tải file qua alt=media](https://developers.google.com/workspace/drive/api/guides/manage-downloads).

## Tải ảnh theo vùng đang xem

App hiện nội dung ngay với khung skeleton; không chặn giao diện bằng màn hình tải toàn trang. Danh sách Drive cập nhật ở nền. Sau khi có danh sách, ảnh món đang chọn và các ảnh Menu gần màn hình được tải trước. Carousel tải ảnh hiện tại và 2 ảnh tiếp theo. Mục 04 và tab Ảnh sự kiện dùng IntersectionObserver để chỉ tải ảnh khi gần vùng nhìn thấy (200px), giữ đúng khung tỉ lệ và fade ảnh sau khi decode.

Tối đa 4 yêu cầu ảnh đồng thời trong toàn app. Các yêu cầu trùng dùng chung, ảnh đã tải giữ bằng blob URL trong phiên. Danh sách cập nhật tự động ở nền; ảnh không đổi được dùng lại, ảnh có modifiedTime mới sẽ tải lại. Ảnh lỗi/timeout hiện hình trống và nút Thử lại trong outlet/gallery. Khi rời app, blob URL được thu hồi. Không lưu cache qua phiên. Folder trống vẫn giữ các trạng thái trống đã mô tả ở trên.

## Dữ liệu JSON

`recipes.json` chỉ chứa nội dung món và `driveFolder`. Không cần khai báo image/gallery: app tự lấy từ Drive. Ảnh sự kiện lấy trực tiếp từ folder gallery chung và ảnh các món; không có file JSON ảnh sự kiện riêng.

Mỗi folder món ở trên chứa ảnh carousel và subfolder `gallery` cho mục 04. Các tên folder là cấu hình kỹ thuật; đổi `driveFolder` nếu folder thực tế có tên khác.

Nội dung “Sắc Hoa Quân Ngũ” được giữ nguyên văn trong `story`, kể cả định dạng Markdown và HTML entity; giao diện chỉ bỏ ký hiệu định dạng khi hiển thị. Hai món yaourt trái cây và Trà thảo mộc hạt sen chỉ có tên, không bổ sung mô tả. Không có thời gian, giá, dinh dưỡng, khẩu phần hoặc cách nấu trong dữ liệu được cung cấp.

## Cache ảnh trên ổ đĩa và đồng bộ nền

Không cần thêm dịch vụ: Drive vẫn là nguồn upload, Node tải bản sao xuống `.cache/drive/` (gitignore). Dev, preview và `npm start` đều tự đồng bộ khi khởi động, rồi mỗi 30 giây. Kiểm tra thay đổi qua ID + modifiedTime, tải tối đa 3 ảnh song song. Ảnh không đổi không tải lại. Snapshot mới chỉ được công bố sau khi toàn bộ file tải thành công; file tạm được đổi tên nguyên tử. Nếu lỗi, tiếp tục phục vụ snapshot và ảnh cũ, thử lại ở chu kỳ sau.

Có thể đồng bộ trước khi mở server:

```sh
npm run sync:drive
npm run build
npm start
```

Cấu hình tùy chọn trong `.env.local`:

```dotenv
DRIVE_CACHE_DIR=.cache/drive
DRIVE_SYNC_INTERVAL_SECONDS=30
```

Chu kỳ tối thiểu 10 giây. Lần đầu chưa có cache phải chờ đồng bộ xong; lần sau server đọc snapshot local ngay, Drive được kiểm tra ở nền. Trang đang mở kiểm tra snapshot mỗi 30 giây nên thay đổi xuất hiện sau thời gian đồng bộ cộng chu kỳ kiểm tra giao diện. Khởi động lại server sau khi đổi env.

Dùng ổ đĩa bền vững trên hosting để giữ cache qua restart. Ảnh vẫn giữ nguyên dung lượng gốc, chưa chuyển WebP hay resize. Các phiên bản cũ được giữ trên đĩa để hỗ trợ tab đã mở; chưa có tác vụ dọn file cũ nên cần theo dõi dung lượng. File đã xóa trên Drive sẽ không được phục vụ qua backend sau lần đồng bộ thành công, nhưng bản trình duyệt đã cache có thể còn tồn tại. Không chạy nhiều server cùng ghi một thư mục cache đồng thời; công cụ sync thủ công nên chạy trước khi mở server.
