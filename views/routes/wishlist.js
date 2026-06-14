// routes/wishlist.js
const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.render('login_required', {
            message: '위시리스트 기능은 로그인 후 사용할 수 있습니다.',
            redirectUrl: '/user/login'
        });
    }
    next();
}

// 위시리스트 토글 (있으면 삭제, 없으면 추가) - 원래 페이지로 돌아옴
router.post('/toggle', requireLogin, (req, res) => {
    const userId = req.session.user.id;
    const { productId } = req.body;
    const returnTo = req.get('Referer') || '/products';

    db.get(
        'SELECT * FROM wishlist WHERE user_id = ? AND product_id = ?',
        [userId, productId],
        (err, row) => {
            if (err) return res.status(500).render('error', { message: 'DB 오류' });

            if (row) {
                db.run(
                    'DELETE FROM wishlist WHERE user_id = ? AND product_id = ?',
                    [userId, productId],
                    () => res.redirect(returnTo)
                );
            } else {
                db.run(
                    'INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)',
                    [userId, productId],
                    () => res.redirect(returnTo)
                );
            }
        }
    );
});

// 위시리스트 목록
router.get('/', requireLogin, (req, res) => {
    const userId = req.session.user.id;
    const query = `
        SELECT p.*, w.created_at AS added_at
        FROM wishlist w
        JOIN products p ON w.product_id = p.id
        WHERE w.user_id = ?
        ORDER BY w.created_at DESC`;

    db.all(query, [userId], (err, items) => {
        if (err) return res.status(500).render('error', { message: '위시리스트 조회 실패' });
        res.render('wishlist', { items });
    });
});

router.post('/delete', requireLogin, (req, res) => {
    const userId = req.session.user.id;
    const { productId } = req.body;
    db.run(
        'DELETE FROM wishlist WHERE user_id = ? AND product_id = ?',
        [userId, productId],
        (err) => {
            if (err) return res.status(500).render('error', { message: '삭제 실패' });
            res.redirect(res.locals.baseHref + 'wishlist');
        }
    );
});

router.post('/to-cart', requireLogin, (req, res) => {
    const userId = req.session.user.id;
    const { productId } = req.body;
    db.run(
        `INSERT INTO cart_items (user_id, product_id, quantity) 
         VALUES (?, ?, 1) 
         ON CONFLICT(user_id, product_id) DO UPDATE SET quantity = quantity + 1`,
        [userId, productId],
        (err) => {
            if (err) return res.status(500).render('error', { message: '장바구니 추가 실패' });
            db.run(
                'DELETE FROM wishlist WHERE user_id = ? AND product_id = ?',
                [userId, productId],
                () => res.redirect(res.locals.baseHref + 'cart')
            );
        }
    );
});

module.exports = router;
