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
    const {  workout, rating, comments } = req.body;
    const username = req.session.username;

    if (!username) {
        return res.status(401).send('User not logged in.');
    }

    // הכנסה לטבלה
    const sqlInsert = 'INSERT INTO feedback1 (username, workout, rating, comments) VALUES (?, ?, ?, ?)';
    connection.query(sqlInsert, [username, workout, rating, comments], (err) => {
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
            res.render('feedback.ejs', { feedbacks, username});
        });
    });
});



// נתיב להוספת פידבק
app.post('/feedbacks', (req, res) => {
    const {  workout, rating, comments } = req.body;
    const username = req.session.username;

    // בדיקה אם המשתמש מחובר
    if (!username) {
        return res.status(401).send('User not logged in.');
    }
    const sql = 'INSERT INTO feedback1 (username, workout, rating, comments) VALUES (?, ?, ?, ?)';
    connection.query(sql, [username, workout, rating, comments], (err) => {
        if (err) {
            console.error('Error inserting feedback:', err);
            return res.status(500).send('Error saving feedback.');
        }
        res.redirect('/feedbacks'); // לאחר שמירת הפידבק, מפנה לדף הפידבקים
    });
});
app.get('/feedbacks', (req, res) => {
    const query = `
         SELECT f.id AS feedback_id, f.username AS feedback_username, f.rating, f.comments, f.created_at,
               r.id AS reply_id, r.reply, r.username AS reply_username, r.created_at AS reply_created_at
        FROM feedback1 f
        LEFT JOIN replies r ON f.id = r.feedback_id
        ORDER BY f.created_at DESC, r.created_at ASC
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
                    username: row.username, // שם המשתמש
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

        res.render('feedback.ejs', { feedbacks, username });
    });
});


app.post('/reply', (req, res) => {
    const { feedbackId, reply } = req.body;
    const username = req.session.username;

    // בדיקה אם המשתמש מחובר
    if (!username) {
        return res.status(401).send('User not logged in.');
    }

    // הכנס את התגובה לטבלת תגובות
    const query = 'INSERT INTO replies (feedback_id, reply, username) VALUES (?, ?, ?)';
    connection.query(query, [feedbackId, reply, username], (err) => {
        if (err) {
            console.error('Error inserting reply:', err);
            return res.status(500).send('Error saving reply.');
        }
        res.render('feedback', {
            username: req.session.username,
            feedback: {
                id: feedbackId,
                text: reply, // לדוגמה, טקסט הפידבק (יכול לבוא גם מה-BD)
                replies: results // רשימת התגובות
            }
        });
    });
});

app.post('/delete-reply', (req, res) => {
    console.log('Request body:', req.body); // בדיקה האם הנתונים נשלחים
    const { replyId } = req.body;

    if (!replyId) {
        console.error('Reply ID is missing.');
        return res.status(400).send('Reply ID is required.');
    }

    // קבלת שם המשתמש מה-Session
    const username = req.session.username;

    // בדיקה אם המשתמש מחובר
    if (!username) {
        console.error('User not logged in.');
        return res.status(401).send('Unauthorized.');
    }

    // בדיקת בעלות על התגובה לפני מחיקה
    const selectQuery = 'SELECT username FROM replies WHERE id = ?';
    connection.query(selectQuery, [replyId], (err, results) => {
        if (err) {
            console.error('Error checking reply ownership:', err);
            return res.status(500).send('Error checking reply ownership.');
        }

        if (results.length === 0) {
            console.error('Reply not found.');
            return res.status(404).send('Reply not found.');
        }

        const replyOwner = results[0].username;

        // בדיקה האם המשתמש הנוכחי הוא הבעלים של התגובה
        if (replyOwner !== username) {
            console.error('User does not have permission to delete this reply.');
            return res.status(403).send('You do not have permission to delete this reply.');
        }

        // מחיקת התגובה
        const deleteQuery = 'DELETE FROM replies WHERE id = ?';
        connection.query(deleteQuery, [replyId], (err) => {
            if (err) {
                console.error('Error deleting reply:', err);
                return res.status(500).send('Error deleting reply.');
            }
            console.log(`Reply with ID ${replyId} deleted by user ${username}.`);
            res.redirect('/feedbacks'); // הפניה חזרה לדף הפידבקים
        });
    });
});

app.post('/edit-reply', (req, res) => {
    const { replyId, reply } = req.body;

    // קבלת שם המשתמש מה-Session
    const username = req.session.username;

    // בדיקה אם המשתמש מחובר
    if (!username) {
        return res.status(401).send("Unauthorized. Please log in.");
    }

    // בדיקת בעלות על התגובה
    const checkOwnershipQuery = "SELECT username FROM replies WHERE id = ?";
    connection.query(checkOwnershipQuery, [replyId], (err, results) => {
        if (err) {
            console.error("Error checking reply ownership:", err);
            return res.status(500).send("Error verifying reply ownership.");
        }

        if (results.length === 0) {
            return res.status(404).send("Reply not found.");
        }

        const replyOwner = results[0].username;

        // בדיקה אם המשתמש הנוכחי הוא הבעלים של התגובה
        if (replyOwner !== username) {
            return res.status(403).send("You are not allowed to edit this reply.");
        }

        // עדכון התגובה
        const updateQuery = "UPDATE replies SET reply = ? WHERE id = ?";
        connection.query(updateQuery, [reply, replyId], (err, result) => {
            if (err) {
                console.error("Error updating reply:", err);
                return res.status(500).send("Error updating reply.");
            }
            console.log(`Reply with ID ${replyId} updated by user ${username}.`);
            res.redirect('/feedbacks'); // דף הפידבק
        });
    });
});

app.post('/delete-feedback', (req, res) => {
    const feedbackId = req.body.feedbackId; // מזהה הפידבק למחיקה

    // קבלת שם המשתמש מה-Session
    const username = req.session.username;

    // בדיקה אם המשתמש מחובר
    if (!username) {
        return res.status(401).send('Unauthorized. Please log in.');
    }

    // בדיקת בעלות על הפידבק
    const checkOwnershipQuery = 'SELECT username FROM feedback1 WHERE id = ?';
    connection.query(checkOwnershipQuery, [feedbackId], (err, results) => {
        if (err) {
            console.error('Error checking feedback ownership:', err);
            return res.status(500).send('Error verifying feedback ownership.');
        }

        if (results.length === 0) {
            return res.status(404).send('Feedback not found.');
        }

        const feedbackOwner = results[0].username;

        // בדיקה אם המשתמש הנוכחי הוא הבעלים של הפידבק
        if (feedbackOwner !== username) {
            return res.status(403).send('You are not allowed to delete this feedback.');
        }

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

                console.log(`Feedback with ID ${feedbackId} deleted by user ${username}.`);
                res.redirect('/feedbacks');
            });
        });
    });
});


app.post('/edit-feedback', (req, res) => {
    const feedbackId = req.body.feedbackId;
    const updatedComments = req.body.comments;

    // קבלת שם המשתמש מה-Session
    const username = req.session.username;

    // בדיקה אם המשתמש מחובר
    if (!username) {
        return res.status(401).send('Unauthorized. Please log in.');
    }

    // בדיקת בעלות על הפידבק
    const checkOwnershipQuery = 'SELECT username FROM feedback1 WHERE id = ?';
    connection.query(checkOwnershipQuery, [feedbackId], (err, results) => {
        if (err) {
            console.error('Error checking feedback ownership:', err);
            return res.status(500).send('Error verifying feedback ownership.');
        }

        if (results.length === 0) {
            return res.status(404).send('Feedback not found.');
        }

        const feedbackOwner = results[0].username;

        // בדיקה אם המשתמש הנוכחי הוא הבעלים של הפידבק
        if (feedbackOwner !== username) {
            return res.status(403).send('You are not allowed to edit this feedback.');
        }

        // עדכון הפידבק במסד הנתונים
        const updateQuery = 'UPDATE feedback1 SET comments = ? WHERE id = ?';
        connection.query(updateQuery, [updatedComments, feedbackId], (err) => {
            if (err) {
                console.error('Error updating feedback:', err);
                return res.status(500).send('Error updating feedback.');
            }

            console.log(`Feedback with ID ${feedbackId} updated by user ${username}.`);
            res.redirect('/feedbacks');
        });
    });
});
app.get('/view-feedback', (req, res) => {
    const query = 'SELECT * FROM feedback1';

    connection.query(query, (err, results) => {
      if (err) {
        console.error('Error fetching feedback:', err);
        return res.status(500).send('Error fetching feedback from the database');
      }

      const feedbackHtml = results.map(feedback => `
        <div>
          <h3>${feedback.username}</h3>
          <p>Rating: ${feedback.rating} stars</p>
          <p>${feedback.comments}</p>
          <small>Submitted on: ${new Date(feedback.created_at).toLocaleString()}</small>
        </div>
        <hr>
      `).join('');

      res.send(`
        <html>
          <head>
            <title>User Feedback</title>
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
            <h1>All Feedback</h1>
            ${feedbackHtml}
            <a href="/index.html" class="back-button">Back to Home</a>
          </body>
        </html>
      `);
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

  app.post('/reply1', (req, res) => {
    const { postId, replyContent } = req.body;
    const username = req.session.username;

    const query = `
        INSERT INTO replies1 (post_id, username, content, created_at)
        VALUES (?, ?, ?, NOW()) 
    `;

    connection.query(query, [postId, username, replyContent], (err) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Error saving reply.');
        }

        res.redirect('/posts');
    });
});



app.get('/posts', (req, res) => {
    if (!req.session.username) {
        return res.redirect('/'); // המשתמש לא מחובר, מחזירים אותו לדף ההתחברות
    }

    const query = `
        SELECT 
            posts.id AS post_id, 
            posts.title, 
            posts.content, 
            posts.created_at, 
            posts.user_id, 
            replies1.id AS reply_id, 
            replies1.content AS reply_content, 
            replies1.username AS reply_username, 
            replies1.created_at AS reply_created_at
        FROM posts
        LEFT JOIN replies1 ON posts.id = replies1.post_id
        ORDER BY posts.created_at DESC, replies1.created_at ASC
    `;

    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching posts:', err);
            return res.status(500).send('Error retrieving posts.');
        }

        const posts = results.reduce((acc, row) => {
            let post = acc.find(p => p.id === row.post_id);
            if (!post) {
                post = {
                    id: row.post_id,
                    title: row.title,
                    content: row.content,
                    created_at: row.created_at,
                    user_id: row.user_id,
                    replies: []
                };
                acc.push(post);
            }
            if (row.reply_id) {
                post.replies.push({
                    id: row.reply_id,
                    content: row.reply_content,
                    username: row.reply_username,
                    created_at: row.reply_created_at
                });
            }
            return acc;
        }, []);

        res.render('posts', { 
            username: req.session.username, 
            posts 
        });
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
