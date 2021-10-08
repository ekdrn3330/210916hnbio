const express = require('express');
const app = express();
const PORT = 8080;
const conn = require('./config/db');
const methodOverride = require('method-override');
const xss = require('xss');
const fs = require('fs');
var multipart = require('connect-multiparty');
const request = require('request');
var multipartMiddleware = multipart();
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');


app.set('view engine', 'ejs');

app.use(methodOverride('_method'));
app.use('/', express.static('html'));
app.use('/public', express.static('public'));
app.use(express.json({
    limit: '1mb'
  }))
  app.use(express.urlencoded({
    limit: '1mb',
    extended: false
  }))
app.use(cors({
    origin : true,
    credentials : true
}));
app.use(cookieParser());
app.use(
    session({
        key: "loginData",
        secret: "testSecret",
        resave: false,
        saveUninitialized: false,
        cookie: { expires: 1000 * 60 * 60 * 24, },
    })
);

function getUserIP(req) {
    const addr = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    return addr;
}

app.listen(PORT, function() {
    console.log('listening on 8080\nhttp://localhost:8080');
});

app.get('/', function(req, res) {
    res.sendFile('/index.html');
    conn.getConnection(function(err, row) {
        if(!err) console.log('db연결 성공');
        if(err) throw err;
    });
});

app.get('/admin', function(req, res) {
    res.render('index.ejs');
});

app.post('/login', function(req, res) {
    param = [req.body.id, req.body.pw];
    const sql1 = 'SELECT * FROM admin WHERE id = ?';
    conn.query(sql1, param[0], function(err, row) {
        if(err) console.log(err);
        
        if(row.length > 0) {
            if(param[1] == row[0].pw) {
                req.session.loginData = row[0].id;
                req.session.save(err => {if(err) console.log(err);})
                res.send("<script>alert('로그인에 성공했습니다.'); window.location=\"/list/1\";</script>");
            } else {
                res.send("<script>alert('아이디가 존재하지 않거나 비밀번호가 틀렸습니다.'); window.location=\"/admin\";</script>");
            }
        } else {
            res.send("<script>alert('아이디가 존재하지 않거나 비밀번호가 틀렸습니다.'); window.location=\"/admin\";</script>");
        }
    });
});

app.get('/write', function(req, res) {
    if(req.session.loginData) {
        res.render('write.ejs');
    } else {
        res.send("<script>alert('로그인 후 이용해주세요.'); window.location=\"/admin\";</script>");
    }
});
app.get('/Notice/:page', function(req, res) {
    var pageS = req.params.page;
    var page = Number(pageS);
    const sql1 = "SELECT id,title,date_format(date, '%Y-%m-%d') as date,editordata,views FROM posts ORDER BY id DESC;";
    conn.query(sql1, function(err, row) {
        if (err) throw err;
        res.render('Notice.ejs', {
            title : '게시판 리스트',
            posts : row,
            page : page,
            length : row.length-1,
            page_num : 10,
            pass : true
        });
    });
});

app.get('/hnDetail/:id', function(req, res) {
    if (req.cookies["f" + req.params.id] == undefined) {
        res.cookie("f" + req.params.id, getUserIP(req), {
          maxAge: 1200000,
        });
        const sql1 = `UPDATE posts SET views = views + 1 WHERE id = ${req.params.id};`;
        conn.query(sql1, function(err, row) {
            if(err) throw err;
        });
      }

    const sql2 = `SELECT id,title,date_format(date, '%Y-%m-%d') as date,editordata,views FROM posts WHERE id = ${req.params.id};`;
    conn.query(sql2, function(err, row) {
        if(err) throw err;
        res.render('hnDetail.ejs', { data : row[0] });
    });
});

app.post('/add', function(req, res) {
    console.log(req.body);
    req.body.title = xss(req.body.title);
    // req.body.editordata = xss(req.body.editordata);
    console.log(req.body.title, req.body.editordata);
    const sql1 = `INSERT INTO posts (title, editordata) VALUES ('${req.body.title}', '${req.body.editordata}')`;
    conn.query(sql1, function(err, row) {
        if(!err) {
            res.redirect('/list/1');
        } else {
            res.send('전송실패 err:' + err);
            console.log(err);
        }
    });
});

app.get('/list/:page', function(req, res) {
    if(req.session.loginData) {
        var page = req.params.page;
        const sql1 = "SELECT id,title,date_format(date, '%Y-%m-%d') as date,editordata,views FROM posts ORDER BY id DESC;";
        conn.query(sql1, function(err, row) {
            if (err) throw err;
            res.render('list.ejs', {
                title : '게시판 리스트',
                posts : row,
                page : page,
                length : row.length-1,
                page_num : 10,
                pass : true
            });
        });
    } else {
        res.send("<script>alert('로그인 후 이용해주세요.'); window.location=\"/admin\";</script>");
    }
});

app.delete('/delete/:id', function(req, res) {
    const sql1 = `DELETE FROM posts WHERE id = '${req.params.id}'`;
    conn.query(sql1, function(err, row) {
        if(!err) {
            res.status(200).send({ message : 'success' });
        } else {
            res.status(400).send({ message : 'fail' });
        }
    });
});

app.get('/detail/:id', function(req, res) {
    if(req.session.loginData) {
        if (req.cookies["f" + req.params.id] == undefined) {
            res.cookie("f" + req.params.id, getUserIP(req), {
              maxAge: 1200000,
            });
            const sql1 = `UPDATE posts SET views = views + 1 WHERE id = ${req.params.id};`;
            conn.query(sql1, function(err, row) {
                if(err) throw err;
            });
          }
    
        const sql2 = `SELECT id,title,date_format(date, '%Y-%m-%d') as date,editordata,views FROM posts WHERE id = ${req.params.id};`;
        conn.query(sql2, function(err, row) {
            if(err) throw err;
            res.render('detail.ejs', { data : row[0] });
        });
    } else {
        res.send("<script>alert('로그인 후 이용해주세요.'); window.location=\"/admin\";</script>");
    }
});

app.get('/edit/:id', function(req, res) {
    if(req.session.loginData) {
        const sql1 = `SELECT * FROM posts WHERE id = ${req.params.id}`;
        conn.query(sql1, function(err, row) {
            console.log('수정할 글 : ',row);
            if(err) throw err;
            res.render('edit.ejs', { data : row[0] });
        });
    } else {
        res.send("<script>alert('로그인 후 이용해주세요.'); window.location=\"/admin\";</script>");
    }
});

app.put('/add/:id', function(req, res) {
    console.log(req.body);
    req.body.title = xss(req.body.title);
    // req.body.editordata = xss(req.body.editordata);
    console.log(req.body.title, req.body.editordata);
    const sql1 = `UPDATE posts
    SET title = '${req.body.title}', editordata = '${req.body.editordata}'
    WHERE id = ${req.params.id}`;
    conn.query(sql1, function(err, row) {
        if(err) throw err;
        res.redirect('/list/1');
    });
});

// app.post('/imageUpload',multipartMiddleware,function(req,res){
//     f = fs.readFileSync(req.files.file.path);
//     base64 = Buffer.from(f).toString('base64');
    
//     var imgbbAPI = require('./imgbbAPIkey.json'); // API KEY
//     const options = {
//         uri:'https://api.imgbb.com/1/upload?expiration=600&key='+imgbbAPI.key, 
//         method: 'POST',
//         form: {
//           image:base64, // 이미지 첨부
//         },
//         json: true // json 형식으로 응답
//     }
//     request.post(options, function(error,httpResponse,body){
//         if(error){
//             res.send({error: error});
//         } else{
//             res.send({url: body.data.display_url});
//         }
//     });
// });

app.post('/logout', (req,res) =>{
    if(req.session.loginData){
        console.log('로그아웃 됨');
        req.session.destroy(error => {if(error) console.log(error)});
        res.redirect('/admin');
    } else {
        console.log('로그인을 하면 로그아웃이 가능해요.');
        res.send('<script>alert("로그인을 해주세요,")</script>');
    }
})

app.get('/passwordCheck', function(req, res) {
    if(req.session.loginData) {
        res.render('passwordCheck.ejs');
    } else {
        res.send("<script>alert('로그인 후 이용해주세요.'); window.location=\"/admin\";</script>");
    }
});

app.post('/passwordCheck', function(req, res) {
    param = req.body.pw;
    const sql1 = 'SELECT * FROM admin WHERE pw = ?';
    conn.query(sql1, param, function(err, row) {
        if(err) console.log(err);
        
        if(row.length > 0) {
            if(param == row[0].pw) {
                res.send("<script>alert('확인되었습니다.'); window.location=\"/passwordChange\";</script>");
            } else {
                res.send("<script>alert('비밀번호가 틀렸습니다.'); window.location=\"/passwordCheck\";</script>");
            }
        } else {
            res.send("<script>alert('비밀번호가 틀렸습니다.'); window.location=\"/passwordCheck\";</script>");
        }
    });
});

app.get('/passwordChange', function(req, res) {
    if(req.session.loginData) {
        res.render('passwordChange.ejs');
    } else {
        res.send("<script>alert('로그인 후 이용해주세요.'); window.location=\"/admin\";</script>");
    }
});

app.put('/passwordChange', function(req, res) {

    param = [req.body.pw2, req.body.pw];
    
    if(param[0] != param[1]) {
        res.send("<script>alert('비밀번호가 다릅니다.'); window.location=\"/passwordChange\";</script>");
    } else {
        const sql1 = `UPDATE admin
        SET pw = '${param[0]}' WHERE id = 'admin'`;
        conn.query(sql1, function(err, row) {
            if(err) throw err;
            req.session.destroy(error => {if(error) console.log(error)});
            res.send("<script>alert('비밀번호가 변경되었습니다.'); window.location=\"/admin\";</script>");
        });
    }
});




