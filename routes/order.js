// routes/order.js - 주문/배송지/결제/반품
const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

function requireLogin(req, res, next) {
    if (!req.session.user) return res.redirect(res.locals.baseHref + 'user/login');
    next();
}

// ===== 1단계: 배송지 정보 입력 =====
router.post('/checkout', requireLogin, (req, res) => {
    const userId = req.session.user.id;

    db.all(`
        SELECT p.id, p.name, p.price, p.emoji, p.image, c.quantity
        FROM cart_items c
        JOIN products p ON c.product_id = p.id
        WHERE c.user_id = ?`, [userId], (err, items) => {
        if (err) return res.status(500).render('error', { message: '장바구니 조회 실패' });
        if (items.length === 0) {
            return res.render('order_confirm', {
                error: '장바구니가 비어 있어 주문할 수 없습니다.',
                order: null, items: []
            });
        }
        const total = items.reduce((s, it) => s + it.price * it.quantity, 0);

        // 사용자 정보 조회 (배송지 기본값으로 사용)
        db.get('SELECT * FROM users WHERE id = ?', [userId], (e, userInfo) => {
            res.render('order_checkout', { items, total, userInfo });
        });
    });
});

// ===== 2단계: 결제 페이지 =====
router.post('/payment', requireLogin, (req, res) => {
    const userId = req.session.user.id;
    const { receiver_name, receiver_phone, receiver_address, delivery_memo } = req.body;

    if (!receiver_name || !receiver_phone || !receiver_address) {
        return res.status(400).render('error', { message: '배송 정보를 모두 입력해 주세요.' });
    }

    db.all(`
        SELECT p.id, p.name, p.price, p.emoji, c.quantity
        FROM cart_items c JOIN products p ON c.product_id = p.id
        WHERE c.user_id = ?`, [userId], (err, items) => {
        if (err || items.length === 0) return res.redirect(res.locals.baseHref + 'cart');
        const total = items.reduce((s, it) => s + it.price * it.quantity, 0);

        // 세션에 배송지 임시 저장
        req.session.checkoutInfo = { receiver_name, receiver_phone, receiver_address, delivery_memo };
        res.render('order_payment', { items, total, checkoutInfo: req.session.checkoutInfo });
    });
});

// ===== 3단계: 주문 확정 =====
router.post('/confirm', requireLogin, (req, res) => {
    const userId = req.session.user.id;
    const checkout = req.session.checkoutInfo;
    const { payment_method } = req.body;

    if (!checkout) return res.redirect(res.locals.baseHref + 'cart');

    db.all(`
        SELECT p.id, p.name, p.price, c.quantity
        FROM cart_items c JOIN products p ON c.product_id = p.id
        WHERE c.user_id = ?`, [userId], (err, items) => {
        if (err) return res.status(500).render('error', { message: '장바구니 조회 실패' });
        if (items.length === 0) {
            return res.render('order_confirm', { 
                error: '장바구니가 비어 있어 주문할 수 없습니다.', 
                order: null, items: [] 
            });
        }
        const totalAmount = items.reduce((s, it) => s + it.price * it.quantity, 0);

        db.run(
            `INSERT INTO orders 
             (user_id, total_amount, status, receiver_name, receiver_phone, receiver_address, delivery_memo, payment_method) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, totalAmount, '주문완료',
             checkout.receiver_name, checkout.receiver_phone, 
             checkout.receiver_address, checkout.delivery_memo || null,
             payment_method || '신용카드'],
            function (err) {
                if (err) return res.status(500).render('error', { message: '주문 생성 실패' });
                const orderId = this.lastID;
                const stmt = db.prepare(
                    'INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity) VALUES (?, ?, ?, ?, ?)'
                );
                items.forEach(it => stmt.run([orderId, it.id, it.name, it.price, it.quantity]));
                stmt.finalize(() => {
                    db.run('DELETE FROM cart_items WHERE user_id = ?', [userId], () => {
                        delete req.session.checkoutInfo;
                        db.get('SELECT * FROM orders WHERE id = ?', [orderId], (e1, order) => {
                            db.all('SELECT * FROM order_items WHERE order_id = ?', [orderId], (e2, oitems) => {
                                res.render('order_confirm', { error: null, order, items: oitems || [] });
                            });
                        });
                    });
                });
            }
        );
    });
});

// ===== 주문내역 =====
router.get('/list', requireLogin, (req, res) => {
    const userId = req.session.user.id;
    const query = `
        SELECT o.*,
            (SELECT GROUP_CONCAT(oi.product_name || ' x' || oi.quantity, ', ')
             FROM order_items oi WHERE oi.order_id = o.id) AS item_summary,
            (SELECT COUNT(*) FROM order_items oi2 WHERE oi2.order_id = o.id) AS item_count
        FROM orders o
        WHERE o.user_id = ?
        ORDER BY o.created_at DESC`;
    db.all(query, [userId], (err, orders) => {
        if (err) {
            console.error('주문내역 조회 오류:', err.message);
            return res.status(500).render('error', { message: '주문내역 조회 실패' });
        }
        res.render('order_list', { orders });
    });
});

router.get('/detail/:id', requireLogin, (req, res) => {
    const userId = req.session.user.id;
    const orderId = req.params.id;
    db.get('SELECT * FROM orders WHERE id = ? AND user_id = ?',
        [orderId, userId], (err, order) => {
            if (err || !order) return res.status(400).render('error', { message: '주문을 찾을 수 없습니다.' });
            db.all('SELECT * FROM order_items WHERE order_id = ?', [orderId], (e, items) => {
                db.get('SELECT * FROM returns WHERE order_id = ? ORDER BY id DESC LIMIT 1',
                    [orderId], (e2, returnInfo) => {
                        res.render('order_detail', { 
                            order, items: items || [], 
                            returnInfo: returnInfo || null 
                        });
                    });
            });
        });
});

// 주문 취소 (주문완료/배송준비 상태일 때)
router.post('/cancel/:id', requireLogin, (req, res) => {
    const userId = req.session.user.id;
    const orderId = req.params.id;
    db.get('SELECT * FROM orders WHERE id = ? AND user_id = ?',
        [orderId, userId], (err, order) => {
            if (err || !order) return res.status(400).render('error', { message: '주문을 찾을 수 없습니다.' });
            if (!['주문완료', '배송준비'].includes(order.status)) {
                return res.status(400).render('error', { message: '이미 배송 중이거나 완료된 주문은 취소할 수 없습니다. 반품을 신청해 주세요.' });
            }
            db.run('UPDATE orders SET status = ? WHERE id = ?',
                ['주문취소', orderId], () => res.redirect(res.locals.baseHref + 'order/list'));
        });
});

// ===== 반품 신청 =====
router.get('/return/:id', requireLogin, (req, res) => {
    const userId = req.session.user.id;
    const orderId = req.params.id;
    db.get('SELECT * FROM orders WHERE id = ? AND user_id = ?',
        [orderId, userId], (err, order) => {
            if (err || !order) return res.status(400).render('error', { message: '주문을 찾을 수 없습니다.' });
            if (!['배송완료'].includes(order.status)) {
                return res.status(400).render('error', { message: '배송완료된 상품만 반품 신청이 가능합니다.' });
            }
            // 이미 반품 신청한 건 있는지 확인
            db.get('SELECT * FROM returns WHERE order_id = ?', [orderId], (e, existing) => {
                if (existing) return res.status(400).render('error', { message: '이미 반품 신청된 주문입니다. 주문 상세에서 확인하세요.' });
                db.all('SELECT * FROM order_items WHERE order_id = ?', [orderId], (e2, items) => {
                    res.render('return_form', { order, items: items || [] });
                });
            });
        });
});

router.post('/return/:id', requireLogin, (req, res) => {
    const userId = req.session.user.id;
    const orderId = req.params.id;
    const { reason, detail } = req.body;

    if (!reason) return res.status(400).render('error', { message: '반품 사유를 선택해 주세요.' });

    db.get('SELECT * FROM orders WHERE id = ? AND user_id = ?',
        [orderId, userId], (err, order) => {
            if (err || !order) return res.status(400).render('error', { message: '주문을 찾을 수 없습니다.' });
            db.run(
                'INSERT INTO returns (order_id, user_id, reason, detail, status) VALUES (?, ?, ?, ?, ?)',
                [orderId, userId, reason, detail || null, '접수'],
                (e) => {
                    if (e) return res.status(400).render('error', { message: '반품 신청 실패' });
                    db.run('UPDATE orders SET status = ? WHERE id = ?',
                        ['반품요청', orderId], () => res.redirect(res.locals.baseHref + 'order/detail/' + orderId));
                });
        });
});

// ===== 관리자: 배송 상태 변경 (시뮬레이션용) =====
router.post('/admin/status/:id', requireLogin, (req, res) => {
    // admin만 허용
    if (req.session.user.username !== 'admin') {
        return res.status(400).render('error', { message: '관리자만 접근 가능합니다.' });
    }
    const { status } = req.body;
    const allowed = ['주문완료', '배송준비', '배송중', '배송완료', '주문취소', '반품요청', '반품완료'];
    if (!allowed.includes(status)) return res.status(400).render('error', { message: '잘못된 상태' });
    db.run('UPDATE orders SET status = ? WHERE id = ?',
        [status, req.params.id], () => res.redirect(res.locals.baseHref + 'order/detail/' + req.params.id));
});

module.exports = router;
