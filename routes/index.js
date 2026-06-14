const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

router.get('/', (req, res) => {
    const userId = req.session.user ? req.session.user.id : null;

    const queries = {
        featured: new Promise((resolve) => {
            db.all(
                'SELECT * FROM products WHERE is_featured = 1 ORDER BY likes DESC, id ASC LIMIT 8',
                (err, rows) => resolve(err ? [] : rows)
            );
        }),
        newProducts: new Promise((resolve) => {
            db.all(
                'SELECT * FROM products ORDER BY id DESC LIMIT 4',
                (err, rows) => resolve(err ? [] : rows)
            );
        }),
        notices: new Promise((resolve) => {
            db.all(
                "SELECT id, title, created_at FROM posts WHERE board_type = 'notice' ORDER BY created_at DESC LIMIT 3",
                (err, rows) => resolve(err ? [] : rows)
            );
        }),
        wishSet: new Promise((resolve) => {
            if (!userId) return resolve(new Set());
            db.all('SELECT product_id FROM wishlist WHERE user_id = ?', [userId], (err, rows) => {
                if (err) return resolve(new Set());
                resolve(new Set(rows.map(r => r.product_id)));
            });
        })
    };

    Promise.all([queries.featured, queries.newProducts, queries.notices, queries.wishSet])
        .then(([featuredProducts, newProducts, notices, wishSet]) => {
            res.render('index', { featuredProducts, newProducts, notices, wishSet });
        })
        .catch(err => {
            console.error('메인 페이지 조회 오류:', err);
            res.render('index', { featuredProducts: [], newProducts: [], notices: [], wishSet: new Set() });
        });
});

module.exports = router;
