// routes/admin.js - 관리자 전용 페이지
const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

// 관리자 권한 미들웨어
function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.username === 'admin') {
        return next();
    }
    return res.status(403).render('error', { message: '관리자만 접근할 수 있습니다.' });
}

// ===== 관리자 대시보드 (요약) =====
router.get('/', isAdmin, (req, res) => {
    db.get('SELECT COUNT(*) AS cnt FROM orders', (e1, oc) => {
        db.get('SELECT COUNT(*) AS cnt FROM products', (e2, pc) => {
            db.get('SELECT COUNT(*) AS cnt FROM users', (e3, uc) => {
                db.get('SELECT COUNT(*) AS cnt FROM products WHERE is_featured = 1', (e4, fc) => {
                    res.render('admin', {
                        section: 'dashboard',
                        stats: {
                            orderCount: oc ? oc.cnt : 0,
                            productCount: pc ? pc.cnt : 0,
                            userCount: uc ? uc.cnt : 0,
                            featuredCount: fc ? fc.cnt : 0
                        }
                    });
                });
            });
        });
    });
});

// ===== 주문/배송 상태 관리 =====
router.get('/orders', isAdmin, (req, res) => {
    db.all(`SELECT o.*, u.username, u.name AS user_name 
            FROM orders o LEFT JOIN users u ON o.user_id = u.id 
            ORDER BY o.created_at DESC`, (err, orders) => {
        if (err) return res.status(400).render('error', { message: '주문 목록 조회 실패' });
        res.render('admin_orders', { orders: orders || [], section: 'orders' });
    });
});

// 주문 상태 변경
router.post('/orders/status/:id', isAdmin, (req, res) => {
    const { status } = req.body;
    const allowed = ['주문완료', '배송준비', '배송중', '배송완료', '주문취소', '반품요청', '반품완료'];
    if (!allowed.includes(status)) return res.status(400).render('error', { message: '잘못된 상태값' });
    db.run('UPDATE orders SET status = ? WHERE id = ?',
        [status, req.params.id], (err) => {
            if (err) return res.status(400).render('error', { message: '상태 변경 실패' });
            res.redirect(res.locals.baseHref + 'admin/orders');
        });
});

// ===== 상품 관리 (가격 + 추천) =====
router.get('/products', isAdmin, (req, res) => {
    db.all('SELECT * FROM products ORDER BY id ASC', (err, products) => {
        if (err) return res.status(400).render('error', { message: '상품 목록 조회 실패' });
        const featuredCount = products.filter(p => p.is_featured === 1).length;
        res.render('admin_products', { 
            products: products || [], 
            section: 'products',
            featuredCount,
            msg: req.query.msg || null
        });
    });
});

// 상품 가격 변경
router.post('/products/price/:id', isAdmin, (req, res) => {
    const price = parseInt(req.body.price);
    if (isNaN(price) || price < 0) {
        return res.redirect(res.locals.baseHref + 'admin/products?msg=invalid_price');
    }
    db.run('UPDATE products SET price = ? WHERE id = ?',
        [price, req.params.id], (err) => {
            if (err) return res.status(400).render('error', { message: '가격 변경 실패' });
            res.redirect(res.locals.baseHref + 'admin/products?msg=price_ok');
        });
});

// 추천 토글 (최대 4개 제한)
router.post('/products/featured/:id', isAdmin, (req, res) => {
    const productId = req.params.id;
    db.get('SELECT is_featured FROM products WHERE id = ?', [productId], (err, p) => {
        if (err || !p) return res.status(400).render('error', { message: '상품을 찾을 수 없습니다.' });

        if (p.is_featured === 1) {
            // 이미 추천 → 해제
            db.run('UPDATE products SET is_featured = 0 WHERE id = ?',
                [productId], () => res.redirect(res.locals.baseHref + 'admin/products?msg=unfeatured'));
        } else {
            // 추천이 아님 → 추가 시도, 단 4개 제한
            db.get('SELECT COUNT(*) AS cnt FROM products WHERE is_featured = 1', (e, row) => {
                if (row && row.cnt >= 4) {
                    return res.redirect(res.locals.baseHref + 'admin/products?msg=max_featured');
                }
                db.run('UPDATE products SET is_featured = 1 WHERE id = ?',
                    [productId], () => res.redirect(res.locals.baseHref + 'admin/products?msg=featured'));
            });
        }
    });
});

module.exports = router;
