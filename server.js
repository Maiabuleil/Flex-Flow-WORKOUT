const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session'); 
const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));




app.use(express.static('public')); // קבצים סטטיים (CSS, JS)
app.use(bodyParser.urlencoded({ extended: true }));
// שימוש ב-sessionc   
app.use(session({
    secret: 'your-secret-key',  // מפתח סודי לשימוש ב-session
    resave: false,
    saveUninitialized: true
}));

// משרת קבצים סטטיים מהתיקייה הנוכחית
app.use(express.static(__dirname));


// חיבור למסד נתונים 
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'new_schema'
});

connection.connect((err) => {
    if (err) throw err;
    console.log('Connected to the database.');
});

// נתיב שמטפל בשורש ומציג את דף ה-Login
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// טיפול בבקשות Login
app.post('/db.js', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const email = req.body.email;

    const query = 'SELECT * FROM project WHERE username = ? AND password = ? AND email = ?';
    connection.query(query, [username, password, email], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            // אם ההתחברות מוצלחת, נשמור את שם המשתמש ב-session
            req.session.username = username;
            console.log('Login OK');
            res.redirect('/index1.html'); // הפניה לדף index1.html
        } else {
            console.log('Login failed');
            res.send('Invalid username, password, or email.');
        }
    });
});

app.post('/register', (req, res) => {
    const { firstName, lastName, username, email, password } = req.body;

    // בדיקת קיום שם המשתמש
    const checkUserQuery = 'SELECT * FROM project WHERE username = ?';
    connection.query(checkUserQuery, [username], (err, results) => {
        if (err) {
            console.error('Error checking username:', err);
            return res.send('Error checking username');
        }

        if (results.length > 0) {
            // שם המשתמש כבר קיים
            return res.send('Username already exists');
        } else {
            // אם שם המשתמש לא קיים, מבצעים את הרישום
            const query = 'INSERT INTO project (firstName, lastName, username, email, password) VALUES (?, ?, ?, ?, ?)';
            connection.query(query, [firstName, lastName, username, email, password], (err, result) => {
                if (err) {
                    console.error('Error registering user:', err);
                    return res.send('Error registering user');
                }

                // אם הרישום הצליח, נשמור את שם המשתמש ב-session
                req.session.username = username;
                res.redirect('/index1.html'); // מפנה את המשתמש ל-index1.html
            });
        }
    });
});


app.post('/feedback1', (req, res) => {
    const { name, email, workout, rating, comments } = req.body;

    // הכנסה לטבלה
    const sqlInsert = 'INSERT INTO feedback1 (name, email, workout, rating, comments) VALUES (?, ?, ?, ?, ?)';
    connection.query(sqlInsert, [name, email, workout, rating, comments], (err) => {
        if (err) {
            console.error('Error inserting feedback:', err);
            return res.status(500).send('Error saving feedback.');
        }

        // שליפת כל הפידבקים לאחר ההוספה
        const sqlSelect = 'SELECT * FROM feedback1 ORDER BY created_at DESC';
        connection.query(sqlSelect, (err, results) => {
            if (err) {
                console.error('Error fetching feedback:', err);
                return res.status(500).send('Error retrieving feedback.');
            }
            res.render('feedback.ejs', { feedbacks: results });
        });
    });
});



// נתיב להוספת פידבק
app.post('/feedbacks', (req, res) => {
    const { name, email, workout, rating, comments } = req.body;
    const sql = 'INSERT INTO feedback1 (name, email, workout, rating, comments) VALUES (?, ?, ?, ?, ?)';
    connection.query(sql, [name, email, workout, rating, comments], (err) => {
        if (err) {
            console.error('Error inserting feedback:', err);
            return res.status(500).send('Error saving feedback.');
        }
        res.redirect('/feedbacks'); // לאחר שמירת הפידבק, מפנה לדף הפידבקים
    });
});
app.get('/feedbacks', (req, res) => {
    const query = `
        SELECT f.*, r.reply, r.created_at AS reply_created_at 
        FROM feedback1 f 
        LEFT JOIN replies r ON f.id = r.feedback_id 
        ORDER BY f.created_at DESC
    `;
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching feedbacks:', err);
            return res.status(500).send('Error retrieving feedbacks.');
        }

        // ארגון תוצאות להצגת פידבקים עם תגובות
        const feedbacks = results.reduce((acc, row) => {
            const feedback = acc.find(f => f.id === row.id);
            if (!feedback) {
                acc.push({
                    id: row.id,
                    name: row.name,
                    rating: row.rating,
                    comments: row.comments,
                    created_at: row.created_at,
                    replies: row.reply ? [{ reply: row.reply, created_at: row.reply_created_at }] : []
                });
            } else if (row.reply) {
                feedback.replies.push({ reply: row.reply, created_at: row.reply_created_at });
            }
            return acc;
        }, []);

        res.render('feedback.ejs', { feedbacks });
    });
});

app.post('/reply', (req, res) => {
    const { feedbackId, reply } = req.body;

    // הכנס את התגובה לטבלת תגובות
    const query = 'INSERT INTO replies (feedback_id, reply) VALUES (?, ?)';
    connection.query(query, [feedbackId, reply], (err) => {
        if (err) {
            console.error('Error inserting reply:', err);
            return res.status(500).send('Error saving reply.');
        }
        res.redirect('/feedbacks');  // הפניה חזרה לדף הפידבקים
    });
});




  
  
app.post('/contact1', (req, res) => {
    const { name, email, phone } = req.body;

    // Insert data into the contact table
    const sql = 'INSERT INTO contact (name, email, phone) VALUES (?, ?, ?)';
    connection.query(sql, [name, email, phone], (err, result) => {
        if (err) {
            console.error('Error inserting data:', err);
            return res.status(500).send('Error saving contact.');
        }
        res.send('Contact saved successfully!');
    });
});  
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});     
