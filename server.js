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
        SELECT f.id AS feedback_id, f.name, f.rating, f.comments, f.created_at,
               r.id AS reply_id, r.reply, r.created_at AS reply_created_at 
        FROM feedback1 f 
        LEFT JOIN replies r ON f.id = r.feedback_id 
        ORDER BY f.created_at DESC
    `;
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching feedbacks:', err);
            return res.status(500).send('Error retrieving feedbacks.');
        }

        const feedbacks = results.reduce((acc, row) => {
            let feedback = acc.find(f => f.id === row.feedback_id);
            if (!feedback) {
                feedback = {
                    id: row.feedback_id,
                    name: row.name,
                    rating: row.rating,
                    comments: row.comments,
                    created_at: row.created_at,
                    replies: []
                };
                acc.push(feedback);
            }
            if (row.reply_id) {
                feedback.replies.push({
                    id: row.reply_id,
                    reply: row.reply,
                    created_at: row.reply_created_at
                });
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

app.post('/delete-reply', (req, res) => {
    console.log('Request body:', req.body); // בדיקה האם הנתונים נשלחים
    const { replyId } = req.body;

    if (!replyId) {
        console.error('Reply ID is missing.');
        return res.status(400).send('Reply ID is required.');
    }

    const query = 'DELETE FROM replies WHERE id = ?';
    connection.query(query, [replyId], (err) => {
        if (err) {
            console.error('Error deleting reply:', err);
            return res.status(500).send('Error deleting reply.');
        }
        console.log(`Reply with ID ${replyId} deleted.`);
        res.redirect('/feedbacks'); // הפניה חזרה לדף הפידבקים
    });
});
app.post('/edit-reply', (req, res) => {
    const { replyId, reply } = req.body;
    const query = "UPDATE replies SET reply = ? WHERE id = ?";
    connection.query(query, [reply, replyId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error updating reply.");
        }
        res.redirect('/feedbacks'); // דף הפידבק
    });
});
app.post('/delete-feedback', (req, res) => {
    const feedbackId = req.body.feedbackId; // מזהה הפידבק למחיקה

    // מחיקת התגובות שקשורות לפידבק
    connection.query('DELETE FROM replies WHERE feedback_id = ?', [feedbackId], (err) => {
        if (err) {
            console.error('Error deleting replies:', err);
            return res.status(500).send('Error deleting replies.');
        }

        // מחיקת הפידבק עצמו
        connection.query('DELETE FROM feedback1 WHERE id = ?', [feedbackId], (err) => {
            if (err) {
                console.error('Error deleting feedback:', err);
                return res.status(500).send('Error deleting feedback.');
            }

            // הפניה חזרה לדף הפידבקים
            res.redirect('/feedbacks');
        });
    });
});

app.post('/edit-feedback', (req, res) => {
    const feedbackId = req.body.feedbackId;
    const updatedComments = req.body.comments;

    // עדכון הפידבק במסד הנתונים
    connection.query('UPDATE feedback1 SET comments = ? WHERE id = ?', [updatedComments, feedbackId], (err) => {
        if (err) {
            console.error('Error updating feedback:', err);
            return res.status(500).send('Error updating feedback.');
        }

        // הפניה חזרה לדף הפידבקים
        res.redirect('/feedbacks');
    });
});



// הצגת דף הפוסטים
app.get('/posts', (req, res) => {
    if (!req.session.username) {
        return res.redirect('/'); // המשתמש לא מחובר, מחזירים אותו לדף ההתחברות
    }

    const query = `
        SELECT p.title, p.content, p.created_at, u.username 
        FROM posts p 
        JOIN project u ON p.user_id = u.id
        ORDER BY p.created_at DESC
    `;
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error retrieving posts:', err);
            return res.send('Error retrieving posts');
        }

        res.render('posts.ejs', { posts: results, username: req.session.username });
    });
});

app.post('/add-post', (req, res) => {
    if (!req.session.username) {
        return res.status(401).send('Unauthorized: Please log in first.');
    }

    const { title, content } = req.body;

    // בדיקת המשתמש המחובר
    const query = 'SELECT id FROM project WHERE username = ?';
    connection.query(query, [req.session.username], (err, results) => {
        if (err) {
            console.error('Error finding user:', err);
            return res.send('Error finding user');
        }

        if (results.length > 0) {
            const userId = results[0].id;

            // הוספת הפוסט
            const insertPostQuery = 'INSERT INTO posts (user_id, username, title, content) VALUES (?, ?, ?, ?)';
            connection.query(insertPostQuery, [userId, req.session.username, title, content], (err, result) => {
                if (err) {
                    console.error('Error adding post:', err);
                    return res.send('Error adding post');
                }

                res.redirect('/posts'); // הפניה לדף הפוסטים
            });
        } else {
            res.send('User not found');
        }
    });
});


app.get('/view-posts', (req, res) => {
    const query = 'SELECT * FROM posts';
  
    connection.query(query, (err, results) => {
      if (err) {
        console.error('Error fetching posts:', err);
        return res.status(500).send('Error fetching posts from the database');
      }
  
      const postsHtml = results.map(post => `
        <div>
          <h3>${post.title}</h3>
          <p><strong>${post.username}</strong></p>
          <p>${post.content}</p>
          <small>Posted on: ${new Date(post.created_at).toLocaleString()}</small>
        </div>
        <hr>
      `).join('');
  
      res.send(`
        <html>
          <head>
            <title>Workout Blog Posts</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              h3 { color: #ff4d4d; }
              hr { margin: 20px 0; }
              .back-button {
                display: inline-block;
                margin-top: 20px;
                padding: 10px 20px;
                font-size: 16px;
                color: white;
                background-color: #4CAF50;
                border: none;
                border-radius: 5px;
                text-decoration: none;
                text-align: center;
                cursor: pointer;
              }
              .back-button:hover {
                background-color: #45a049;
              }
            </style>
          </head>
          <body>
            <h1>All Blog Posts</h1>
            ${postsHtml}
            <a href="/index1.html" class="back-button">Back to Home</a>
          </body>
        </html>
      `);
    });
  });
  
  





app.get('/get-username', (req, res) => {
    if (req.session.username) {
        res.json({ username: req.session.username });
    } else {
        res.json({ username: req.session.username });
    }
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
