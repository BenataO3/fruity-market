// routes/cart.js
const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

// 장바구니에 담기
router.post('/add', (req, res) => {
    const user = req.session.user;
    const productId = req.body.productId;

    if (!user) {
        return res.status(401).render('login_required', {
            message: '장바구니 담기 위해서는 로그인이 필요합니다.',
            redirectUrl: '/user/login'
        });
    }

    const query = `INSERT INTO cart_items (user_id, product_id, quantity) 
                   VALUES (?, ?, 1) 
                   ON CONFLICT(user_id, product_id) DO UPDATE SET quantity = quantity + 1`;

    db.run(query, [user.id, productId], function (err) {
        if (err) {
            console.error('장바구니 추가 실패:', err.message);
            return res.status(500).render('error', { message: '장바구니 추가 실패' });
        }
        res.redirect(res.locals.baseHref + 'cart');
    });
});

// 장바구니 목록 조회
router.get('/', (req, res) => {
    const user = req.session.user;
    if (!user) {
        return res.render('login_required', {
            message: '장바구니를 보려면 로그인이 필요합니다.',
            redirectUrl: '/user/login'
        });
    }

    const query = `
        SELECT p.id, p.name, p.price, p.emoji, p.image, c.quantity
        FROM cart_items c
        JOIN products p ON c.product_id = p.id
        WHERE c.user_id = ?
        ORDER BY c.created_at DESC`;

    db.all(query, [user.id], (err, rows) => {
        if (err) return res.status(500).render('error', { message: '장바구니 조회 실패' });
        // 총액 계산
        const total = rows.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        res.render('cart', { cartItems: rows, total });
    });
});

// 수량 변경 (+/-)
router.post('/update', (req, res) => {
    const user = req.session.user;
    const { productId, action } = req.body;
    if (!user) return res.redirect(res.locals.baseHref + 'user/login');

    if (action === 'increase') {
        db.run(
            'UPDATE cart_items SET quantity = quantity + 1 WHERE user_id = ? AND product_id = ?',
            [user.id, productId],
            (err) => {
                if (err) return res.status(500).render('error', { message: '수량 증가 실패' });
                res.redirect(res.locals.baseHref + 'cart');
            }
        );
    } else if (action === 'decrease') {
        // 수량 1이면 삭제, 아니면 -1
        db.get(
            'SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?',
            [user.id, productId],
            (err, row) => {
                if (err || !row) return res.redirect(res.locals.baseHref + 'cart');
                if (row.quantity > 1) {
                    db.run(
                        'UPDATE cart_items SET quantity = quantity - 1 WHERE user_id = ? AND product_id = ?',
                        [user.id, productId],
                        () => res.redirect(res.locals.baseHref + 'cart')
                    );
                } else {
                    db.run(
                        'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
                        [user.id, productId],
                        () => res.redirect(res.locals.baseHref + 'cart')
                    );
                }
            }
        );
    } else {
        res.redirect(res.locals.baseHref + 'cart');
    }
});

// 항목 완전 삭제
router.post('/delete', (req, res) => {
    const user = req.session.user;
    const { productId } = req.body;
    if (!user) return res.redirect(res.locals.baseHref + 'user/login');

    db.run(
        'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
        [user.id, productId],
        (err) => {
            if (err) return res.status(500).render('error', { message: '삭제 실패' });
            res.redirect(res.locals.baseHref + 'cart');
        }
    );
});

module.exports = router;
