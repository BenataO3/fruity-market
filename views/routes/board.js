// routes/board.js - 고객센터(문의글) 게시판
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const router = express.Router();
const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

// 게시글 목록 (검색 + "내 글만" 필터 지원)
router.get('/', (req, res) => {
    const keyword = (req.query.q || '').trim();
    const onlyMine = req.query.mine === '1';

    let where = "WHERE board_type = 'inquiry'";
    const params = [];

    if (keyword) {
        where += ' AND (title LIKE ? OR content LIKE ?)';
        const like = `%${keyword}%`;
        params.push(like, like);
    }
    if (onlyMine && req.session.user) {
        where += ' AND author = ?';
        params.push(req.session.user.username);
    }

    const query = `SELECT * FROM posts ${where} 
                   ORDER BY COALESCE(parent_id, id) ASC, id ASC`;

    db.all(query, params, (err, posts) => {
        if (err) {
            console.error(err.message);
            return res.status(400).render('error', { message: '목록 불러오기 실패' });
        }
        res.render('board', { posts, keyword, onlyMine });
    });
});

router.get('/new', (req, res) => {
    res.render('post', { post: null, parentId: null });
});

router.post('/new', (req, res) => {
    const { title, content } = req.body;
    const author = req.session.user ? req.session.user.username : '익명';
    if (!title || !content) return res.status(400).render('error', { message: '제목과 내용을 입력해 주세요.' });

    db.run(
        'INSERT INTO posts (board_type, title, content, parent_id, author) VALUES (?, ?, ?, ?, ?)',
        ['inquiry', title, content, null, author],
        function (err) {
            if (err) return res.status(400).render('error', { message: '작성 실패' });
            res.redirect(res.locals.baseHref + 'board');
        }
    );
});

router.get('/view/:id', (req, res) => {
    const postId = req.params.id;
    db.run('UPDATE posts SET views = views + 1 WHERE id = ?', [postId]);
    db.get('SELECT * FROM posts WHERE id = ?', [postId], (err, post) => {
        if (err || !post) return res.status(400).render('error', { message: '글 없음' });
        res.render('detail', { post });
    });
});

router.get('/reply/:id', (req, res) => {
    const parentId = req.params.id;
    db.get('SELECT title FROM posts WHERE id = ?', [parentId], (err, row) => {
        if (err || !row) return res.status(400).render('error', { message: '원글 없음' });
        res.render('reply', { parentId, parentTitle: row.title });
    });
});

router.post('/create', (req, res) => {
    const { title, content, parent_id } = req.body;
    const author = req.session.user ? req.session.user.username : '익명';
    if (!title || !content) return res.status(400).render('error', { message: '제목과 내용을 입력해 주세요.' });
    db.run(
        'INSERT INTO posts (board_type, title, content, parent_id, author) VALUES (?, ?, ?, ?, ?)',
        ['inquiry', title, content, parent_id || null, author],
        function (err) {
            if (err) return res.status(400).render('error', { message: '등록 실패' });
            res.redirect(res.locals.baseHref + 'board');
        }
    );
});

router.get('/edit/:id', (req, res) => {
    const currentUser = req.session.user && req.session.user.username;
    db.get('SELECT * FROM posts WHERE id = ?', [req.params.id], (err, post) => {
        if (err || !post) return res.status(400).render('error', { message: '글 없음' });
        if (currentUser !== post.author) return res.status(400).render('error', { message: '본인이 작성한 글만 수정할 수 있습니다.' });
        res.render('post', { post, parentId: post.parent_id });
    });
});

router.post('/edit/:id', (req, res) => {
    const { title, content } = req.body;
    const currentUser = req.session.user && req.session.user.username;
    db.get('SELECT * FROM posts WHERE id = ?', [req.params.id], (err, post) => {
        if (err || !post) return res.status(400).render('error', { message: '글 없음' });
        if (currentUser !== post.author) return res.status(400).render('error', { message: '본인이 작성한 글만 수정할 수 있습니다.' });
        db.run('UPDATE posts SET title = ?, content = ? WHERE id = ?',
            [title, content, req.params.id], (err) => {
                if (err) return res.status(400).render('error', { message: '수정 실패' });
                res.redirect(res.locals.baseHref + 'board/view/' + req.params.id);
            });
    });
});

router.get('/delete/:id', (req, res) => {
    const postId = req.params.id;
    const currentUser = req.session.user && req.session.user.username;
    db.get('SELECT * FROM posts WHERE id = ?', [postId], (err, post) => {
        if (err || !post) return res.status(400).render('error', { message: '글이 존재하지 않습니다.' });
        if (post.author === '익명') {
            if (currentUser !== 'admin') return res.status(400).render('error', { message: '익명 글은 admin만 삭제할 수 있습니다.' });
        } else {
            if (currentUser !== post.author) return res.status(400).render('error', { message: '본인이 작성한 글만 삭제할 수 있습니다.' });
        }
        // 대댓글까지 재귀적으로 모두 삭제
        deleteWithDescendants(postId, (delErr) => {
            if (delErr) return res.status(400).render('error', { message: '삭제 실패' });
            res.redirect(res.locals.baseHref + 'board');
        });
    });
});

/**
 * 게시글과 그 모든 자손(답글/대댓글/대대댓글...)을 BFS로 수집한 뒤 한 번에 삭제
 */
function deleteWithDescendants(rootId, callback) {
    const idsToDelete = [];
    const queue = [parseInt(rootId, 10)];

    function next() {
        if (queue.length === 0) {
            // 모든 ID 수집 완료 → 일괄 삭제
            if (idsToDelete.length === 0) return callback(null);
            const placeholders = idsToDelete.map(() => '?').join(',');
            db.run(`DELETE FROM posts WHERE id IN (${placeholders})`, idsToDelete, callback);
            return;
        }
        const currentId = queue.shift();
        idsToDelete.push(currentId);
        // 이 글의 직속 자식들 찾기
        db.all('SELECT id FROM posts WHERE parent_id = ?', [currentId], (err, rows) => {
            if (err) return callback(err);
            (rows || []).forEach(r => queue.push(r.id));
            next();
        });
    }

    next();
}

module.exports = router;
