-- 회원 테이블 (확장)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    gender TEXT,
    birth TEXT,
    address TEXT,
    sms_agree INTEGER DEFAULT 0,
    email_agree INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 게시글 테이블 (공지사항 + 문의글 통합)
CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_type TEXT NOT NULL DEFAULT 'inquiry',
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    parent_id INTEGER,
    author TEXT,
    views INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 파일 업로드 정보
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    originalname TEXT NOT NULL,
    filepath TEXT NOT NULL,
    filesize INTEGER,
    FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- 상품 테이블
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    emoji TEXT,
    image TEXT,
    likes INTEGER DEFAULT 0,
    is_featured INTEGER DEFAULT 0,
    category TEXT DEFAULT 'fruit'
);

-- 장바구니 테이블
CREATE TABLE IF NOT EXISTS cart_items (
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, product_id)
);

-- 위시리스트
CREATE TABLE IF NOT EXISTS wishlist (
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, product_id)
);

-- 주문 테이블 (배송지 정보 포함)
-- status: 주문완료 / 배송준비 / 배송중 / 배송완료 / 주문취소 / 반품요청 / 반품완료
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total_amount INTEGER NOT NULL,
    status TEXT DEFAULT '주문완료',
    receiver_name TEXT,
    receiver_phone TEXT,
    receiver_address TEXT,
    delivery_memo TEXT,
    payment_method TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 주문 상세
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    product_price INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- 반품 신청 테이블 (신규)
CREATE TABLE IF NOT EXISTS returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    reason TEXT NOT NULL,
    detail TEXT,
    status TEXT DEFAULT '접수',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(order_id) REFERENCES orders(id)
);
