const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');

const indexRouter = require('./routes/index');
const userRouter = require('./routes/user');
const boardRouter = require('./routes/board');
const noticeRouter = require('./routes/notice');
const productRouter = require('./routes/products');
const cartRouter = require('./routes/cart');
const orderRouter = require('./routes/order');
const wishlistRouter = require('./routes/wishlist');
const adminRouter = require('./routes/admin');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 세션 설정 (라우터 연결보다 위에 위치)
app.use(session({
    secret: 'busan-univ-web-programming-2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 2  // 2시간
    }
}));

// 모든 EJS에서 로그인 사용자 정보 + 현재 URL 경로 사용 가능하도록 설정
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.currentPath = req.path;
    // 서브경로(/studX/) 리버스 프록시 배포 대비:
    // 현재 페이지 깊이에 맞춰 앱 루트까지의 상대 경로를 계산 → <base href> 및 redirect에 사용
    const depth = req.path.split('/').filter(Boolean).length;
    res.locals.baseHref = depth <= 1 ? './' : '../'.repeat(depth - 1);
    next();
});

// 라우터 연결
app.use('/', indexRouter);
app.use('/user', userRouter);
app.use('/board', boardRouter);
app.use('/notice', noticeRouter);
app.use('/products', productRouter);
app.use('/cart', cartRouter);
app.use('/order', orderRouter);
app.use('/wishlist', wishlistRouter);
app.use('/admin', adminRouter);

// 404 처리
app.use((req, res, next) => {
    res.status(404).render('error', {
        message: '페이지를 찾을 수 없습니다.',
        error: { status: 404, stack: '' }
    });
});

// 에러 핸들러
app.use((err, req, res, next) => {
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    res.status(err.status || 500);
    res.render('error', { message: err.message, error: err });
});

module.exports = app;
