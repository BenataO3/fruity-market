# 2026 웹프로그래밍 기말과제 - 간단한 쇼핑몰

부산대학교 웹프로그래밍 수업 기말과제 프로젝트입니다.  
Node.js + Express + SQLite3 + EJS로 구현한 간단한 쇼핑몰입니다.

## 구현된 기능

### 필수 기능
- ✅ **회원가입 / 로그인 / 로그아웃** (bcrypt 비밀번호 암호화, 세션 기반)
- ✅ **고객센터 - 문의 게시판** (CRUD, 계층형 답글)
- ✅ **공지사항 게시판** (파일 첨부 기능, 이전글/다음글)
- ✅ **상품 목록** (추천 상품 + 전체 상품)
- ✅ **장바구니** (담기, 수량 변경 +/-, 삭제)
- ✅ **주문하기** (더미 페이지)

### 권한 관리
- 본인이 작성한 글만 수정/삭제 가능
- 익명 글은 admin만 삭제 가능
- 공지사항은 admin만 작성/수정/삭제
- 권한 없으면 수정/삭제 버튼 비활성화

### 추가 기능
- 메인 페이지 배너 텍스트 3초마다 자동 변경
- 게시글 조회수 카운트
- 답글 삭제 시 원글까지 함께 처리
- 파일 첨부 (10MB, 최대 5개)
- 반응형 디자인

## 실행 방법

### 1. 의존성 설치
```bash
npm install
```

### 2. 데이터베이스 초기화 (최초 1회)
```bash
npm run initdb
```
또는 `node db/initDB.js`

### 3. 샘플 데이터 입력 (최초 1회)
```bash
npm run seed
```
또는 `node db/seedProducts.js`

샘플 데이터:
- admin 계정 (id: `admin` / pw: `admin1234`)
- 과일 상품 8개
- 공지사항 3건, 문의글 1건

### 4. 상품 이미지 추가 (선택)
`public/images/` 폴더에 다음 파일을 넣어 주세요.
- apple.png, banana.png, grape.png, orange.png
- kiwi.png, peach.png, lemon.png, watermelon.png

이미지가 없어도 동작은 합니다.

### 5. 서버 실행
```bash
npm start
```
브라우저에서 http://localhost:3000 접속

##  폴더 구조

```
board-project/
├── app.js                  # Express 앱 메인
├── bin/www                 # 서버 시작 스크립트
├── package.json
├── schema.sql              # DB 스키마
│
├── db/
│   ├── initDB.js           # DB 초기화 스크립트
│   ├── seedProducts.js     # 샘플 데이터 입력
│   └── database.sqlite     # SQLite DB (실행 후 생성)
│
├── routes/
│   ├── index.js            # 메인 페이지
│   ├── user.js             # 회원가입/로그인/마이페이지
│   ├── board.js            # 고객센터(문의글)
│   ├── notice.js           # 공지사항 (파일첨부)
│   ├── products.js         # 상품 목록
│   ├── cart.js             # 장바구니
│   └── order.js            # 주문(더미)
│
├── views/
│   ├── partials/
│   │   ├── header.ejs
│   │   └── footer.ejs
│   ├── index.ejs
│   ├── register.ejs
│   ├── login.ejs
│   ├── login_failed.ejs
│   ├── login_required.ejs
│   ├── mypage.ejs
│   ├── board.ejs           # 문의 목록
│   ├── post.ejs            # 글 작성/수정
│   ├── reply.ejs           # 답글 작성
│   ├── detail.ejs          # 문의 상세
│   ├── notice.ejs          # 공지 목록
│   ├── notice_post.ejs     # 공지 작성/수정
│   ├── notice_detail.ejs   # 공지 상세
│   ├── products.ejs        # 상품 목록(추천)
│   ├── products_all.ejs    # 전체 상품
│   ├── product_detail.ejs  # 상품 상세
│   ├── cart.ejs            # 장바구니
│   ├── order_confirm.ejs   # 주문 완료
│   └── error.ejs
│
└── public/
    ├── stylesheets/style.css
    ├── images/             # 상품 이미지
    └── uploads/            # 공지 첨부파일
```

##  DB 테이블

- **users**: 회원 (id, username, password, name)
- **posts**: 게시글 (board_type으로 공지/문의 구분, parent_id로 계층형 답글)
- **files**: 공지사항 첨부파일
- **products**: 상품
- **cart_items**: 장바구니 (user_id + product_id 복합키)

##  주요 URL

| URL | 설명 |
|---|---|
| `/` | 메인 페이지 |
| `/user/register` | 회원가입 |
| `/user/login` | 로그인 |
| `/user/mypage` | 마이페이지 (로그인 필요) |
| `/products` | 상품 목록 |
| `/products/all` | 전체 상품 |
| `/products/detail/:id` | 상품 상세 |
| `/cart` | 장바구니 (로그인 필요) |
| `/notice` | 공지사항 목록 |
| `/board` | 고객센터(문의) 목록 |
| `/board/new` | 문의 작성 |
| `/board/reply/:id` | 답글 작성 |

##  테스트 시나리오

1. 회원가입 → 로그인
2. 상품 목록에서 장바구니 담기
3. 장바구니에서 수량 +/-, 삭제
4. 주문하기 → 주문완료 페이지
5. 고객센터에서 글쓰기 (로그인 / 비로그인)
6. 본인 글에서 [수정][삭제] 활성화 확인
7. 다른 글에서 [수정][삭제] 비활성화 확인
8. 답글 달기 → 계층형 표시 확인
9. admin 로그인 → 공지사항 작성 (파일 첨부)
10. 공지사항 상세에서 첨부파일 다운로드
