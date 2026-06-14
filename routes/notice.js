// routes/notice.js - 공지사항 게시판 (파일 첨부 기능 포함)
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const router = express.Router();
const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

// multer 설정 - 업로드 폴더 지정 및 파일명 변환
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        // 한글 파일명 인코딩 처리
        const ext = path.extname(file.originalname);
        cb(null, unique + ext);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }  // 10MB 제한
});

// 관리자 권한 체크 미들웨어
function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.username === 'admin') {
        return next();
    }
    return res.status(400).render('error', { message: '관리자만 접근 가능합니다.' });
}

// 공지사항 목록
router.get('/', (req, res) => {
    db.all(
        `SELECT * FROM posts WHERE board_type = 'notice' ORDER BY id DESC`,
        (err, posts) => {
            if (err) {
                console.error(err.message);
                return res.status(400).render('error', { message: '공지사항 목록 불러오기 실패' });
            }
            res.render('notice', { posts });
        }
    );
});

// 공지사항 작성 폼 (admin만)
router.get('/new', isAdmin, (req, res) => {
    res.render('notice_post', { post: null, files: [] });
});

// 공지사항 작성 처리 (파일 첨부)
router.post('/new', isAdmin, upload.array('attachments', 5), (req, res) => {
    const { title, content } = req.body;
    const author = req.session.user.username;

    if (!title || !content) {
        return res.status(400).render('error', { message: '제목과 내용을 입력해 주세요.' });
    }

    db.run(
        'INSERT INTO posts (board_type, title, content, author) VALUES (?, ?, ?, ?)',
        ['notice', title, content, author],
        function (err) {
            if (err) return res.status(400).render('error', { message: '공지사항 작성 실패' });
            const postId = this.lastID;

            // 파일 정보 저장
            if (req.files && req.files.length > 0) {
                const stmt = db.prepare(
                    'INSERT INTO files (post_id, filename, originalname, filepath, filesize) VALUES (?, ?, ?, ?, ?)'
                );
                req.files.forEach(file => {
                    // 한글 파일명 깨짐 방지
                    const original = Buffer.from(file.originalname, 'latin1').toString('utf8');
                    stmt.run([postId, file.filename, original, '/uploads/' + file.filename, file.size]);
                });
                stmt.finalize();
            }
            res.redirect(res.locals.baseHref + 'notice');
        }
    );
});

// 공지사항 상세 보기
router.get('/view/:id', (req, res) => {
    const postId = req.params.id;
    db.run('UPDATE posts SET views = views + 1 WHERE id = ?', [postId]);

    db.get('SELECT * FROM posts WHERE id = ? AND board_type = ?', [postId, 'notice'], (err, post) => {
        if (err || !post) return res.status(400).render('error', { message: '공지사항을 찾을 수 없습니다.' });

        db.all('SELECT * FROM files WHERE post_id = ?', [postId], (err2, files) => {
            if (err2) files = [];

            // 이전글, 다음글 조회
            db.get(
                `SELECT id, title FROM posts WHERE board_type = 'notice' AND id < ? ORDER BY id DESC LIMIT 1`,
                [postId], (e1, prev) => {
                    db.get(
                        `SELECT id, title FROM posts WHERE board_type = 'notice' AND id > ? ORDER BY id ASC LIMIT 1`,
                        [postId], (e2, next) => {
                            res.render('notice_detail', { post, files, prev, next });
                        });
                });
        });
    });
});

// 공지사항 수정 폼 (admin)
router.get('/edit/:id', isAdmin, (req, res) => {
    db.get('SELECT * FROM posts WHERE id = ? AND board_type = ?',
        [req.params.id, 'notice'], (err, post) => {
            if (err || !post) return res.status(400).render('error', { message: '공지사항 없음' });
            db.all('SELECT * FROM files WHERE post_id = ?', [req.params.id], (e, files) => {
                res.render('notice_post', { post, files: files || [] });
            });
        });
});

// 공지사항 수정 처리
router.post('/edit/:id', isAdmin, upload.array('attachments', 5), (req, res) => {
    const { title, content } = req.body;
    const postId = req.params.id;

    db.run(
        'UPDATE posts SET title = ?, content = ? WHERE id = ?',
        [title, content, postId],
        (err) => {
            if (err) return res.status(400).render('error', { message: '수정 실패' });

            // 새로 추가된 파일 저장
            if (req.files && req.files.length > 0) {
                const stmt = db.prepare(
                    'INSERT INTO files (post_id, filename, originalname, filepath, filesize) VALUES (?, ?, ?, ?, ?)'
                );
                req.files.forEach(file => {
                    const original = Buffer.from(file.originalname, 'latin1').toString('utf8');
                    stmt.run([postId, file.filename, original, '/uploads/' + file.filename, file.size]);
                });
                stmt.finalize();
            }
            res.redirect(res.locals.baseHref + 'notice/view/' + postId);
        }
    );
});

// 첨부파일 삭제 (admin)
router.get('/file/delete/:fileId', isAdmin, (req, res) => {
    db.get('SELECT * FROM files WHERE id = ?', [req.params.fileId], (err, file) => {
        if (err || !file) return res.status(400).render('error', { message: '파일 없음' });
        const fullPath = path.join(__dirname, '../public', file.filepath);
        // 실제 파일 삭제
        fs.unlink(fullPath, () => {});
        db.run('DELETE FROM files WHERE id = ?', [req.params.fileId], (e) => {
            if (e) return res.status(400).render('error', { message: '파일 삭제 실패' });
            res.redirect(res.locals.baseHref + 'notice/edit/' + file.post_id);
        });
    });
});

// 공지사항 삭제 (admin)
router.get('/delete/:id', isAdmin, (req, res) => {
    const postId = req.params.id;
    // 첨부파일도 함께 삭제
    db.all('SELECT * FROM files WHERE post_id = ?', [postId], (err, files) => {
        if (files && files.length > 0) {
            files.forEach(f => {
                const fullPath = path.join(__dirname, '../public', f.filepath);
                fs.unlink(fullPath, () => {});
            });
        }
        db.run('DELETE FROM files WHERE post_id = ?', [postId]);
        db.run('DELETE FROM posts WHERE id = ?', [postId], (e) => {
            if (e) return res.status(400).render('error', { message: '삭제 실패' });
            res.redirect(res.locals.baseHref + 'notice');
        });
    });
});

module.exports = router;
