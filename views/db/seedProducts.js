// db/seedProducts.js - 상품 20개 (과일 10 + 기타 10) 시드
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// [name, description, price, emoji, image, likes, is_featured, category]
const products = [
    // ===== 🍎 단품 과일 (fruit) 10개 =====
    ['사과', '경북 청송에서 자란 부사 품종. 새콤달콤하고 아삭한 식감에 비타민 C가 풍부합니다. 산지 직송으로 신선함을 그대로 전합니다.', 2000, '🍎', '/images/apple.png', 42, 1, 'fruit'],
    ['바나나', '필리핀 고원지대에서 자연 숙성된 프리미엄 바나나. 진한 단맛과 부드러운 식감, 칼륨이 풍부해 간식으로 좋습니다.', 1500, '🍌', '/images/banana.png', 31, 1, 'fruit'],
    ['포도', '경북 김천산 거봉 포도. 알이 크고 당도 18Brix 이상으로 매우 달콤하며 항산화 성분이 풍부합니다.', 3000, '🍇', '/images/grape.png', 28, 1, 'fruit'],
    ['오렌지', '미국 캘리포니아산 네이블 오렌지. 과즙이 가득한 상큼함과 풍부한 비타민 C가 특징입니다.', 2500, '🍊', '/images/orange.png', 25, 1, 'fruit'],
    ['키위', '뉴질랜드 제스프리 그린키위. 새콤한 맛과 진한 향, 비타민 C 함량이 오렌지의 2배에 달합니다.', 2800, '🥝', '/images/kiwi.png', 14, 0, 'fruit'],
    ['복숭아', '경산산 황도 복숭아. 과즙이 입안 가득 퍼지는 농밀한 단맛으로 한여름 보양 과일입니다.', 3500, '🍑', '/images/peach.png', 19, 0, 'fruit'],
    ['레몬', '미국 캘리포니아산 유기농 레몬. 진한 향과 강한 신맛으로 요리·음료·디저트에 두루 활용됩니다.', 2000, '🍋', '/images/lemon.png', 8, 0, 'fruit'],
    ['수박', '충북 음성산 꿀수박. 당도 12Brix 이상의 진한 단맛과 시원한 수분감으로 무더위를 식혀줍니다.', 8000, '🍉', '/images/watermelon.png', 22, 0, 'fruit'],
    ['딸기', '논산산 설향 딸기. 진한 향과 농밀한 단맛, 부드러운 과육에 비타민 C와 안토시아닌이 풍부합니다.', 6000, '🍓', '/images/strawberry.png', 33, 0, 'fruit'],
    ['망고', '필리핀산 애플망고. 진한 노란 과육과 풍부한 과즙, 부드러운 식감에 비타민 A가 풍부합니다.', 5500, '🥭', '/images/mango.png', 17, 0, 'fruit'],

    // ===== 📦 과일 상자 / 🎁 선물 세트 / 🍰 디저트 / 👤 실속팩 (기타 10개) =====
    ['제철 과일 박스', '그날 가장 좋은 제철 과일 3~4종을 골라 담은 5kg 박스. 가정에서 일주일 즐기기 좋은 구성입니다.', 35000, '📦', '/images/box_seasonal.png', 12, 0, 'box'],
    ['혼합 과일 선물 박스', '사과·배·포도·오렌지 등 인기 과일을 고루 담은 혼합 박스. 가성비 좋은 선물용으로 인기.', 28000, '📦', '/images/box_mix.png', 9, 0, 'box'],
    ['프리미엄 선물 세트', '엄선한 고급 과일 5종을 우드 박스에 담은 시그니처 선물 세트. 품격 있는 선물에 어울립니다.', 75000, '🎁', '/images/gift_premium.png', 15, 0, 'gift'],
    ['명절 종합 선물세트', '사과·배·감 등 명절 대표 과일로 구성한 종합 선물 세트. 정성을 담은 포장으로 배송됩니다.', 90000, '🎁', '/images/gift_holiday.png', 11, 0, 'gift'],
    ['수제 딸기잼 250g', '논산 설향 딸기 100%로 끓여낸 수제 잼. 인공첨가물 없이 과일과 설탕만으로 만든 진한 풍미.', 8500, '🍓', '/images/jam.png', 7, 0, 'dessert'],
    ['생과일 주스 세트', '거봉 포도·오렌지·자몽 주스 3종 세트. 무첨가 천연 주스로 진한 과일 본연의 맛.', 16000, '🧃', '/images/juice.png', 13, 0, 'dessert'],
    ['컷팅 과일 컵 200g', '바로 먹을 수 있게 손질된 모듬 과일 200g 컵. 사무실 간식·다이어트 식단으로 인기.', 6500, '🍱', '/images/fruitcup.png', 6, 0, 'dessert'],
    ['1인 과일 도시락', '하루치 과일 5종을 한 도시락에 담았습니다. 혼밥·다이어트 식단에 딱 맞는 구성.', 7800, '🍱', '/images/lunchbox.png', 10, 0, 'small'],
    ['블루베리 100g 팩', '냉장 블루베리 100g 1인용 팩. 요거트·시리얼 토핑이나 간식으로 좋습니다.', 5500, '🫐', '/images/blueberry.png', 16, 0, 'small'],
    ['미니 과일 모둠', '사과 2·키위 2·귤 3개로 구성된 1인 가구용 미니 박스. 냉장고에 쏙 들어가는 사이즈.', 9800, '🧺', '/images/mini_assort.png', 5, 0, 'small']
];

db.serialize(() => {
    // 상품을 항상 새로 구성 (재실행 시 정확히 20개 유지)
    db.run('DELETE FROM cart_items');
    db.run('DELETE FROM wishlist');
    db.run('DELETE FROM products');
    db.run("DELETE FROM sqlite_sequence WHERE name = 'products'");

    const stmt = db.prepare(`
        INSERT INTO products (name, description, price, emoji, image, likes, is_featured, category)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const product of products) stmt.run(product);
    stmt.finalize(() => console.log(`✅ 상품 ${products.length}개 삽입 완료 (과일 10 + 기타 10)`));

    // admin 계정
    db.get("SELECT * FROM users WHERE username = 'admin'", async (err, user) => {
        if (err) return;
        if (!user) {
            const hashed = await bcrypt.hash('admin1234', 10);
            db.run(
                `INSERT INTO users (username, password, name, email, phone, gender, birth, address, sms_agree, email_agree) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                ['admin', hashed, '관리자', 'admin@fruity.com', '010-0000-0000',
                 '남', '19900101', '부산광역시 금정구 부산대학로 63번길 2', 1, 1],
                (err) => {
                    if (err) console.error('❌ admin 생성 실패:', err.message);
                    else console.log('✅ admin 계정 생성 완료 (id: admin / pw: admin1234)');
                }
            );
        } else {
            console.log('ℹ️  admin 계정이 이미 존재합니다.');
        }
    });

    // 샘플 공지
    db.get("SELECT COUNT(*) AS count FROM posts WHERE board_type = 'notice'", (err, row) => {
        if (err) return;
        if (row.count === 0) {
            const notices = [
                ['notice', 'Fruity Market 오픈 안내', '신선한 과일을 산지에서 식탁까지 전해드리는 Fruity Market이 오픈했습니다. 많은 이용 부탁드립니다.', 'admin'],
                ['notice', '여름 과일 특가 이벤트', '수박, 복숭아 등 여름 과일을 특별가에 만나보세요.', 'admin'],
                ['notice', '배송 정책 안내', '오후 2시 이전 주문은 당일 출고됩니다.', 'admin'],
            ];
            const ns = db.prepare('INSERT INTO posts (board_type, title, content, author) VALUES (?, ?, ?, ?)');
            for (const n of notices) ns.run(n);
            ns.finalize(() => console.log('✅ 샘플 공지사항 3건 삽입 완료'));
        }
    });

    // 샘플 문의
    db.get("SELECT COUNT(*) AS count FROM posts WHERE board_type = 'inquiry'", (err, row) => {
        if (err) return;
        if (row.count === 0) {
            db.run(
                'INSERT INTO posts (board_type, title, content, author) VALUES (?, ?, ?, ?)',
                ['inquiry', '배송 문의드립니다', '주문한 사과는 언제 도착하나요?', '익명'],
                function () {
                    const parentId = this.lastID;
                    db.run(
                        'INSERT INTO posts (board_type, title, content, parent_id, author) VALUES (?, ?, ?, ?, ?)',
                        ['inquiry', 'RE: 배송 문의드립니다', '안녕하세요. 보통 1-2일 내 배송됩니다.', parentId, 'admin'],
                        () => console.log('✅ 샘플 문의/답글 삽입 완료')
                    );
                }
            );
        }
    });
});

setTimeout(() => db.close(), 1500);
