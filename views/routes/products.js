// routes/products.js
const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

// 카테고리 메타 정보
const CATEGORIES = {
    'all': { label: '전체', emoji: '🛒' },
    'fruit': { label: '단품 과일', emoji: '🍎' },
    'box': { label: '과일 상자', emoji: '📦' },
    'gift': { label: '프리미엄 선물 세트', emoji: '🎁' },
    'dessert': { label: '과일 디저트 & 가공품', emoji: '🍰' },
    'small': { label: '1인 가구 / 실속 팩', emoji: '👤' }
};

function getUserWishlistSet(userId, cb) {
    if (!userId) return cb(new Set());
    db.all('SELECT product_id FROM wishlist WHERE user_id = ?', [userId], (err, rows) => {
        if (err) return cb(new Set());
        cb(new Set(rows.map(r => r.product_id)));
    });
}

// 추천 + 일부 상품 (메인용)
router.get('/', (req, res) => {
    db.all('SELECT * FROM products', (err, allProducts) => {
        if (err) return res.status(500).render('error', { message: 'DB 오류' });

        db.all(
            'SELECT * FROM products WHERE is_featured = 1 ORDER BY likes DESC LIMIT 8',
            (err2, featuredProducts) => {
                if (err2) return res.status(500).render('error', { message: 'DB 오류' });

                const userId = req.session.user ? req.session.user.id : null;
                getUserWishlistSet(userId, (wishSet) => {
                    res.render('products', {
                        allProducts,
                        featuredProducts,
                        wishSet,
                        categories: CATEGORIES
                    });
                });
            }
        );
    });
});

// 전체 상품 + 카테고리/검색/정렬 + 페이지네이션
router.get('/all', (req, res) => {
    const keyword = (req.query.q || '').trim();
    const sort = req.query.sort || 'default';
    const category = req.query.category || 'all';
    const PER_PAGE = 12;
    const page = Math.max(1, parseInt(req.query.page) || 1);

    const conditions = [];
    const params = [];

    if (keyword) {
        conditions.push('(name LIKE ? OR description LIKE ?)');
        const like = `%${keyword}%`;
        params.push(like, like);
    }
    if (category && category !== 'all' && CATEGORIES[category]) {
        conditions.push('category = ?');
        params.push(category);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    let orderBy = 'id ASC';
    if (sort === 'price_asc') orderBy = 'price ASC';
    else if (sort === 'price_desc') orderBy = 'price DESC';
    else if (sort === 'name') orderBy = 'name ASC';
    else if (sort === 'popular') orderBy = 'likes DESC';

    // 1) 전체 개수 (페이지 수 계산용)
    const countQuery = `SELECT COUNT(*) AS total FROM products ${where}`;
    db.get(countQuery, params, (cErr, countRow) => {
        if (cErr) return res.status(500).render('error', { message: '개수 조회 실패' });
        const total = countRow ? countRow.total : 0;
        const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
        const currentPage = Math.min(page, totalPages);
        const offset = (currentPage - 1) * PER_PAGE;

        // 2) 페이지 데이터
        const query = `SELECT * FROM products ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
        db.all(query, [...params, PER_PAGE, offset], (err, rows) => {
            if (err) return res.status(500).render('error', { message: '상품 목록 불러오기 실패' });

            const userId = req.session.user ? req.session.user.id : null;
            getUserWishlistSet(userId, (wishSet) => {
                res.render('products_all', {
                    products: rows,
                    keyword,
                    sort,
                    category,
                    count: total,
                    wishSet,
                    categories: CATEGORIES,
                    pagination: {
                        currentPage,
                        totalPages,
                        perPage: PER_PAGE
                    }
                });
            });
        });
    });
});

// 상품 상세
router.get('/detail/:id', (req, res) => {
    const productId = req.params.id;
    db.get('SELECT * FROM products WHERE id = ?', [productId], (err, product) => {
        if (err || !product) return res.status(400).render('error', { message: '상품을 찾을 수 없습니다.' });

        db.get('SELECT COUNT(*) AS cnt FROM wishlist WHERE product_id = ?',
            [productId], (e1, row) => {
                const likeCount = row ? row.cnt : 0;

                let inWishlist = false;
                if (req.session.user) {
                    db.get(
                        'SELECT 1 FROM wishlist WHERE user_id = ? AND product_id = ?',
                        [req.session.user.id, productId],
                        (e2, w) => {
                            inWishlist = !!w;
                            res.render('product_detail', { product, inWishlist, likeCount });
                        }
                    );
                } else {
                    res.render('product_detail', { product, inWishlist, likeCount });
                }
            });
    });
});

module.exports = router;
