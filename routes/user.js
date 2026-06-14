const express = require('express');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const router = express.Router();
const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

// ===== 회원가입 흐름 (3단계) =====

// 1단계: 가입여부 확인
router.get('/check', (req, res) => {
    res.render('register_check', { error: null });
});

router.post('/check', (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.render('register_check', { error: '아이디를 입력해 주세요.' });
    }
    db.get('SELECT 1 FROM users WHERE username = ?', [username], (err, row) => {
        if (err) return res.render('register_check', { error: '서버 오류' });
        if (row) {
            return res.render('register_check', { 
                error: `이미 사용 중인 아이디입니다. (${username})` 
            });
        }
        // 2단계로 진입 - 세션에 아이디 임시 저장
        req.session.pendingUsername = username;
        res.redirect(res.locals.baseHref + 'user/terms');
    });
});

// 2단계: 약관 동의
router.get('/terms', (req, res) => {
    if (!req.session.pendingUsername) return res.redirect(res.locals.baseHref + 'user/check');
    res.render('register_terms', { error: null });
});

router.post('/terms', (req, res) => {
    if (!req.session.pendingUsername) return res.redirect(res.locals.baseHref + 'user/check');
    const { agree_service, agree_privacy } = req.body;
    if (!agree_service || !agree_privacy) {
        return res.render('register_terms', { 
            error: '필수 약관에 모두 동의해야 가입할 수 있습니다.' 
        });
    }
    req.session.termsAgreed = true;
    res.redirect(res.locals.baseHref + 'user/register');
});

// 3단계: 회원정보 입력 페이지
router.get('/register', (req, res) => {
    if (!req.session.pendingUsername || !req.session.termsAgreed) {
        return res.redirect(res.locals.baseHref + 'user/check');
    }
    res.render('register', { 
        error: null, 
        username: req.session.pendingUsername 
    });
});

// 회원가입 처리
router.post('/register', async (req, res) => {
    if (!req.session.pendingUsername || !req.session.termsAgreed) {
        return res.redirect(res.locals.baseHref + 'user/check');
    }
    const username = req.session.pendingUsername;
    const {
        password, password_confirm, name,
        email, phone, gender, birth, address,
        sms_agree, email_agree
    } = req.body;

    if (!password || !name) {
        return res.render('register', { error: '필수 항목을 입력해 주세요.', username });
    }
    if (password !== password_confirm) {
        return res.render('register', { error: '비밀번호가 일치하지 않습니다.', username });
    }
    if (password.length < 4) {
        return res.render('register', { error: '비밀번호는 4자 이상이어야 합니다.', username });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(
            `INSERT INTO users 
             (username, password, name, email, phone, gender, birth, address, sms_agree, email_agree) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [username, hashedPassword, name, email || null, phone || null,
             gender || null, birth || null, address || null,
             sms_agree ? 1 : 0, email_agree ? 1 : 0],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.render('register', { error: '이미 사용 중인 아이디입니다.', username });
                    }
                    console.error(err.message);
                    return res.render('register', { error: '회원가입 실패', username });
                }
                // 세션 정리
                delete req.session.pendingUsername;
                delete req.session.termsAgreed;
                res.render('register_complete', { username, name });
            }
        );
    } catch (e) {
        console.error(e);
        res.render('register', { error: '서버 오류', username });
    }
});

// ===== 로그인 / 로그아웃 =====

router.get('/login', (req, res) => {
    res.render('login', { error: null });
});

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) return res.render('login', { error: '서버 오류' });
        if (!user) return res.render('login', { error: '존재하지 않는 사용자입니다.' });

        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.user = { id: user.id, username: user.username, name: user.name };
            res.redirect(res.locals.baseHref);
        } else {
            res.status(401).render('login_failed');
        }
    });
});

router.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect(res.locals.baseHref));
});

// ===== 아이디/비밀번호 찾기 =====

router.get('/find', (req, res) => {
    res.render('find_account', { result: null, error: null, mode: null });
});

// 아이디 찾기 (이름 + 이메일로)
router.post('/find/id', (req, res) => {
    const { name, email } = req.body;
    if (!name || !email) {
        return res.render('find_account', { 
            result: null, error: '이름과 이메일을 입력해 주세요.', mode: 'id' 
        });
    }
    db.get('SELECT username, created_at FROM users WHERE name = ? AND email = ?',
        [name, email], (err, user) => {
            if (err) return res.render('find_account', { 
                result: null, error: '서버 오류', mode: 'id' 
            });
            if (!user) return res.render('find_account', { 
                result: null, 
                error: '입력하신 정보와 일치하는 회원이 없습니다.', 
                mode: 'id' 
            });
            res.render('find_account', { 
                result: { type: 'id', username: user.username, created_at: user.created_at }, 
                error: null, 
                mode: 'id' 
            });
        });
});

// 비밀번호 재설정 (아이디 + 이메일 확인 후 임시 비번 발급)
router.post('/find/pw', async (req, res) => {
    const { username, email } = req.body;
    if (!username || !email) {
        return res.render('find_account', { 
            result: null, error: '아이디와 이메일을 입력해 주세요.', mode: 'pw' 
        });
    }
    db.get('SELECT * FROM users WHERE username = ? AND email = ?',
        [username, email], async (err, user) => {
            if (err) return res.render('find_account', { 
                result: null, error: '서버 오류', mode: 'pw' 
            });
            if (!user) return res.render('find_account', { 
                result: null, 
                error: '입력하신 정보와 일치하는 회원이 없습니다.', 
                mode: 'pw' 
            });
            // 임시 비밀번호 생성 (8자리)
            const tempPw = Math.random().toString(36).slice(2, 10);
            const hashed = await bcrypt.hash(tempPw, 10);
            db.run('UPDATE users SET password = ? WHERE id = ?',
                [hashed, user.id], (e) => {
                    if (e) return res.render('find_account', { 
                        result: null, error: '비밀번호 변경 실패', mode: 'pw' 
                    });
                    res.render('find_account', {
                        result: { type: 'pw', tempPw },
                        error: null,
                        mode: 'pw'
                    });
                });
        });
});

// ===== 마이페이지 / 정보수정 / 탈퇴 =====

router.get('/mypage', (req, res) => {
    if (!req.session.user) return res.redirect(res.locals.baseHref + 'user/login');
    const userId = req.session.user.id;

    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, userInfo) => {
        if (err || !userInfo) return res.status(400).render('error', { message: '사용자 정보 조회 실패' });

        db.get('SELECT COUNT(*) AS cnt FROM orders WHERE user_id = ?', [userId], (e1, orderCount) => {
            db.get('SELECT COALESCE(SUM(total_amount), 0) AS total FROM orders WHERE user_id = ? AND status != ?',
                [userId, '주문취소'], (e2, totalSpent) => {
                db.get('SELECT COUNT(*) AS cnt FROM cart_items WHERE user_id = ?', [userId], (e3, cartCount) => {
                    db.get('SELECT COUNT(*) AS cnt FROM wishlist WHERE user_id = ?', [userId], (e4, wishCount) => {
                        db.get("SELECT COUNT(*) AS cnt FROM posts WHERE author = ?",
                            [userInfo.username], (e5, postCount) => {
                                res.render('mypage', {
                                    userInfo,
                                    stats: {
                                        orderCount: orderCount ? orderCount.cnt : 0,
                                        totalSpent: totalSpent ? totalSpent.total : 0,
                                        cartCount: cartCount ? cartCount.cnt : 0,
                                        wishCount: wishCount ? wishCount.cnt : 0,
                                        postCount: postCount ? postCount.cnt : 0
                                    }
                                });
                            });
                    });
                });
            });
        });
    });
});

// 회원정보 수정 (전체 필드)
router.get('/edit', (req, res) => {
    if (!req.session.user) return res.redirect(res.locals.baseHref + 'user/login');
    db.get('SELECT * FROM users WHERE id = ?',
        [req.session.user.id], (err, user) => {
            if (err || !user) return res.status(400).render('error', { message: '사용자 정보 조회 실패' });
            res.render('user_edit', { userInfo: user, error: null, success: null });
        });
});

router.post('/edit', async (req, res) => {
    if (!req.session.user) return res.redirect(res.locals.baseHref + 'user/login');
    const userId = req.session.user.id;
    const {
        name, email, phone, gender, birth, address,
        sms_agree, email_agree,
        current_password, new_password, new_password_confirm
    } = req.body;

    db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
        if (err || !user) return res.status(400).render('error', { message: '사용자 조회 실패' });

        if (!name) {
            return res.render('user_edit', { 
                userInfo: user, error: '이름을 입력해 주세요.', success: null 
            });
        }

        let newPasswordHashed = null;

        // 비밀번호 변경 시도
        if (new_password || current_password) {
            if (!current_password) {
                return res.render('user_edit', { 
                    userInfo: user, error: '현재 비밀번호를 입력해 주세요.', success: null 
                });
            }
            const match = await bcrypt.compare(current_password, user.password);
            if (!match) {
                return res.render('user_edit', { 
                    userInfo: user, error: '현재 비밀번호가 일치하지 않습니다.', success: null 
                });
            }
            if (new_password !== new_password_confirm) {
                return res.render('user_edit', { 
                    userInfo: user, error: '새 비밀번호가 일치하지 않습니다.', success: null 
                });
            }
            if (new_password.length < 4) {
                return res.render('user_edit', { 
                    userInfo: user, error: '새 비밀번호는 4자 이상이어야 합니다.', success: null 
                });
            }
            newPasswordHashed = await bcrypt.hash(new_password, 10);
        }

        // 업데이트 쿼리 구성
        const updateQuery = newPasswordHashed
            ? `UPDATE users SET name=?, email=?, phone=?, gender=?, birth=?, address=?, 
               sms_agree=?, email_agree=?, password=? WHERE id=?`
            : `UPDATE users SET name=?, email=?, phone=?, gender=?, birth=?, address=?, 
               sms_agree=?, email_agree=? WHERE id=?`;

        const params = newPasswordHashed
            ? [name, email || null, phone || null, gender || null, birth || null, 
               address || null, sms_agree ? 1 : 0, email_agree ? 1 : 0, newPasswordHashed, userId]
            : [name, email || null, phone || null, gender || null, birth || null, 
               address || null, sms_agree ? 1 : 0, email_agree ? 1 : 0, userId];

        db.run(updateQuery, params, (e) => {
            if (e) return res.status(400).render('error', { message: '수정 실패: ' + e.message });
            req.session.user.name = name;
            // 갱신된 정보 다시 조회
            db.get('SELECT * FROM users WHERE id = ?', [userId], (e2, updated) => {
                res.render('user_edit', {
                    userInfo: updated,
                    error: null,
                    success: newPasswordHashed 
                        ? '회원정보와 비밀번호가 변경되었습니다.' 
                        : '회원정보가 변경되었습니다.'
                });
            });
        });
    });
});

// 회원탈퇴
router.get('/withdraw', (req, res) => {
    if (!req.session.user) return res.redirect(res.locals.baseHref + 'user/login');
    res.render('user_withdraw', { error: null });
});

router.post('/withdraw', async (req, res) => {
    if (!req.session.user) return res.redirect(res.locals.baseHref + 'user/login');
    const userId = req.session.user.id;
    const { password, confirm_text } = req.body;

    if (confirm_text !== '탈퇴합니다') {
        return res.render('user_withdraw', { error: '"탈퇴합니다"를 정확히 입력해 주세요.' });
    }

    db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
        if (err || !user) return res.status(400).render('error', { message: '사용자 조회 실패' });
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.render('user_withdraw', { error: '비밀번호가 일치하지 않습니다.' });
        }
        db.serialize(() => {
            db.run('DELETE FROM cart_items WHERE user_id = ?', [userId]);
            db.run('DELETE FROM wishlist WHERE user_id = ?', [userId]);
            db.run('DELETE FROM users WHERE id = ?', [userId], (e) => {
                if (e) return res.status(400).render('error', { message: '탈퇴 실패' });
                req.session.destroy(() => res.render('withdraw_complete'));
            });
        });
    });
});

module.exports = router;
