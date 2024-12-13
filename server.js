const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session'); 
const app = express();
app.use(express.json());
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
    const { workout, rating, comments } = req.body;
    const username = req.session.username;

    if (!username) {
        return res.status(401).send('User not logged in.');
    }

    // Insert the new feedback into the database
    const sqlInsert = 'INSERT INTO feedback1 (username, workout, rating, comments) VALUES (?, ?, ?, ?)';
    connection.query(sqlInsert, [username, workout, rating, comments], (err) => {
        if (err) {
            console.error('Error inserting feedback:', err);
            return res.status(500).send('Error saving feedback.');
        }

        // Fetch all feedbacks and their associated replies
        const sqlSelect = `
            SELECT 
                f.id AS feedbackId, f.username AS feedbackUsername, f.workout, f.rating, f.comments, f.created_at AS feedbackCreatedAt,
                r.id AS replyId, r.feedback_id AS replyFeedbackId, r.reply, r.username AS replyUsername, r.created_at AS replyCreatedAt
            FROM feedback1 f
            LEFT JOIN replies r ON f.id = r.feedback_id
            ORDER BY f.created_at DESC, r.created_at ASC
        `;

        connection.query(sqlSelect, (err, results) => {
            if (err) {
                console.error('Error fetching feedbacks and replies:', err);
                return res.status(500).send('Error retrieving feedback.');
            }

            // Group feedbacks and their replies
            const feedbackMap = {};
            results.forEach(row => {
                if (!feedbackMap[row.feedbackId]) {
                    feedbackMap[row.feedbackId] = {
                        id: row.feedbackId,
                        username: row.feedbackUsername,
                        workout: row.workout,
                        rating: row.rating,
                        comments: row.comments,
                        created_at: row.feedbackCreatedAt,
                        replies: []
                    };
                }

                if (row.replyId) {
                    feedbackMap[row.feedbackId].replies.push({
                        id: row.replyId,
                        reply: row.reply,
                        username: row.replyUsername,
                        created_at: row.replyCreatedAt
                    });
                }
            });

            const feedbacks = Object.values(feedbackMap);

            // Render the updated feedback page
            res.render('feedback.ejs', { feedbacks, username });
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

        res.render('feedback.ejs', { feedbacks:results, username: req.session.username});
    });
});


app.post('/reply', (req, res) => {
    const { feedbackId, reply } = req.body;
    const username = req.session.username;

    // Check if the user is logged in
    if (!username) {
        return res.status(401).send('User not logged in.');
    }

    // Insert the reply into the replies table
    const insertReplyQuery = 'INSERT INTO replies (feedback_id, reply, username) VALUES (?, ?, ?)';
    connection.query(insertReplyQuery, [feedbackId, reply, username], (err) => {
        if (err) {
            console.error('Error inserting reply:', err);
            return res.status(500).send('Error saving reply.');
        }

        // Fetch updated feedbacks and their replies
        const feedbackQuery = `
            SELECT f.id AS feedbackId, f.username AS feedbackUsername, f.comments, f.created_at AS feedbackCreatedAt, 
                   r.id AS replyId, r.feedback_id AS replyFeedbackId, r.reply, r.username AS replyUsername, r.created_at AS replyCreatedAt
            FROM feedback1 f
            LEFT JOIN replies r ON f.id = r.feedback_id
            ORDER BY f.created_at DESC, r.created_at ASC
        `;

        connection.query(feedbackQuery, (err, results) => {
            if (err) {
                console.error('Error fetching feedbacks and replies:', err);
                return res.status(500).send('Error fetching data.');
            }

            // Group feedbacks and their replies
            const feedbacks = [];
            const feedbackMap = {};

            results.forEach(row => {
                if (!feedbackMap[row.feedbackId]) {
                    feedbackMap[row.feedbackId] = {
                        id: row.feedbackId,
                        username: row.feedbackUsername,
                        comments: row.comments,
                        created_at: row.feedbackCreatedAt,
                        replies: []
                    };
                    feedbacks.push(feedbackMap[row.feedbackId]);
                }

                if (row.replyId) {
                    feedbackMap[row.feedbackId].replies.push({
                        id: row.replyId,
                        reply: row.reply,
                        username: row.replyUsername,
                        created_at: row.replyCreatedAt
                    });
                }
            });

            // Render the updated feedback page
            res.render('feedback.ejs', { feedbacks, username });
        });
    });
});


app.post('/delete-reply', (req, res) => {
    console.log('Request body:', req.body); // Debugging data
    const { replyId } = req.body;

    if (!replyId) {
        console.error('Reply ID is missing.');
        return res.status(400).send('Reply ID is required.');
    }

    const username = req.session.username;

    if (!username) {
        console.error('User not logged in.');
        return res.status(401).send('Unauthorized.');
    }

    // Check ownership of the reply before deletion
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

        if (replyOwner !== username) {
            console.error('User does not have permission to delete this reply.');
            return res.status(403).send('You do not have permission to delete this reply.');
        }

        // Delete the reply
        const deleteQuery = 'DELETE FROM replies WHERE id = ?';
        connection.query(deleteQuery, [replyId], (err) => {
            if (err) {
                console.error('Error deleting reply:', err);
                return res.status(500).send('Error deleting reply.');
            }

            console.log(`Reply with ID ${replyId} deleted by user ${username}.`);

            // Fetch updated feedbacks and replies
            const feedbackQuery = `
                SELECT f.id AS feedbackId, f.username AS feedbackUsername, f.comments, f.created_at AS feedbackCreatedAt,
                       r.id AS replyId, r.feedback_id AS replyFeedbackId, r.reply, r.username AS replyUsername, r.created_at AS replyCreatedAt
                FROM feedback1 f
                LEFT JOIN replies r ON f.id = r.feedback_id
                ORDER BY f.created_at DESC, r.created_at ASC
            `;

            connection.query(feedbackQuery, (err, results) => {
                if (err) {
                    console.error('Error fetching updated feedbacks:', err);
                    return res.status(500).send('Error fetching updated feedbacks.');
                }

                // Group feedbacks and their replies
                const feedbacks = [];
                const feedbackMap = {};

                results.forEach(row => {
                    if (!feedbackMap[row.feedbackId]) {
                        feedbackMap[row.feedbackId] = {
                            id: row.feedbackId,
                            username: row.feedbackUsername,
                            comments: row.comments,
                            created_at: row.feedbackCreatedAt,
                            replies: []
                        };
                        feedbacks.push(feedbackMap[row.feedbackId]);
                    }

                    if (row.replyId) {
                        feedbackMap[row.feedbackId].replies.push({
                            id: row.replyId,
                            reply: row.reply,
                            username: row.replyUsername,
                            created_at: row.replyCreatedAt
                        });
                    }
                });

                // Render the updated feedback page
                res.render('feedback.ejs', { feedbacks, username });
            });
        });
    });
});


app.post('/edit-reply', (req, res) => {
    const { replyId, reply } = req.body;
    const username = req.session.username;

    // Check if the user is logged in
    if (!username) {
        return res.status(401).send("Unauthorized. Please log in.");
    }

    // Check if the current user owns the reply
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

        if (replyOwner !== username) {
            return res.status(403).send("You are not allowed to edit this reply.");
        }

        // Update the reply
        const updateQuery = "UPDATE replies SET reply = ? WHERE id = ?";
        connection.query(updateQuery, [reply, replyId], (err) => {
            if (err) {
                console.error("Error updating reply:", err);
                return res.status(500).send("Error updating reply.");
            }

            // Fetch updated feedbacks and replies after editing
            const feedbackQuery = `
                SELECT f.id AS feedbackId, f.username AS feedbackUsername, f.comments, f.created_at AS feedbackCreatedAt,
                       r.id AS replyId, r.feedback_id AS replyFeedbackId, r.reply, r.username AS replyUsername, r.created_at AS replyCreatedAt
                FROM feedback1 f
                LEFT JOIN replies r ON f.id = r.feedback_id
                ORDER BY f.created_at DESC, r.created_at ASC
            `;

            connection.query(feedbackQuery, (err, results) => {
                if (err) {
                    console.error("Error fetching feedbacks and replies:", err);
                    return res.status(500).send("Error fetching updated feedbacks.");
                }

                // Group feedbacks and their replies
                const feedbacks = [];
                const feedbackMap = {};

                results.forEach(row => {
                    if (!feedbackMap[row.feedbackId]) {
                        feedbackMap[row.feedbackId] = {
                            id: row.feedbackId,
                            username: row.feedbackUsername,
                            comments: row.comments,
                            created_at: row.feedbackCreatedAt,
                            replies: []
                        };
                        feedbacks.push(feedbackMap[row.feedbackId]);
                    }

                    if (row.replyId) {
                        feedbackMap[row.feedbackId].replies.push({
                            id: row.replyId,
                            reply: row.reply,
                            username: row.replyUsername,
                            created_at: row.replyCreatedAt
                        });
                    }
                });

                // Render the updated feedback page
                res.render('feedback.ejs', { feedbacks, username });
            });
        });
    });
});

app.post('/delete-feedback', (req, res) => {
    const feedbackId = req.body.feedbackId; // ID of the feedback to delete
    const username = req.session.username; // Get username from the session

    if (!username) {
        return res.status(401).send('Unauthorized. Please log in.');
    }

    // Check ownership of the feedback
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

        if (feedbackOwner !== username) {
            return res.status(403).send('You are not allowed to delete this feedback.');
        }

        // Delete associated replies
        connection.query('DELETE FROM replies WHERE feedback_id = ?', [feedbackId], (err) => {
            if (err) {
                console.error('Error deleting replies:', err);
                return res.status(500).send('Error deleting replies.');
            }

            // Delete the feedback itself
            connection.query('DELETE FROM feedback1 WHERE id = ?', [feedbackId], (err) => {
                if (err) {
                    console.error('Error deleting feedback:', err);
                    return res.status(500).send('Error deleting feedback.');
                }

                console.log(`Feedback with ID ${feedbackId} deleted by user ${username}.`);

                // Fetch updated feedbacks and replies
                const feedbackQuery = `
                    SELECT f.id AS feedbackId, f.username AS feedbackUsername, f.comments, f.created_at AS feedbackCreatedAt,
                           r.id AS replyId, r.feedback_id AS replyFeedbackId, r.reply, r.username AS replyUsername, r.created_at AS replyCreatedAt
                    FROM feedback1 f
                    LEFT JOIN replies r ON f.id = r.feedback_id
                    ORDER BY f.created_at DESC, r.created_at ASC
                `;

                connection.query(feedbackQuery, (err, results) => {
                    if (err) {
                        console.error('Error fetching updated feedbacks:', err);
                        return res.status(500).send('Error fetching updated feedbacks.');
                    }

                    // Group feedbacks and their replies
                    const feedbacks = [];
                    const feedbackMap = {};

                    results.forEach(row => {
                        if (!feedbackMap[row.feedbackId]) {
                            feedbackMap[row.feedbackId] = {
                                id: row.feedbackId,
                                username: row.feedbackUsername,
                                comments: row.comments,
                                created_at: row.feedbackCreatedAt,
                                replies: []
                            };
                            feedbacks.push(feedbackMap[row.feedbackId]);
                        }

                        if (row.replyId) {
                            feedbackMap[row.feedbackId].replies.push({
                                id: row.replyId,
                                reply: row.reply,
                                username: row.replyUsername,
                                created_at: row.replyCreatedAt
                            });
                        }
                    });

                    // Render the updated feedback page
                    res.render('feedback.ejs', { feedbacks, username });
                });
            });
        });
    });
});


app.post('/edit-feedback', (req, res) => {
    const feedbackId = req.body.feedbackId;
    const updatedComments = req.body.comments;
    const username = req.session.username; // Get username from session

    if (!username) {
        return res.status(401).send('Unauthorized. Please log in.');
    }

    // Check ownership of the feedback
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

        if (feedbackOwner !== username) {
            return res.status(403).send('You are not allowed to edit this feedback.');
        }

        // Update feedback in the database
        const updateQuery = 'UPDATE feedback1 SET comments = ? WHERE id = ?';
        connection.query(updateQuery, [updatedComments, feedbackId], (err) => {
            if (err) {
                console.error('Error updating feedback:', err);
                return res.status(500).send('Error updating feedback.');
            }

            console.log(`Feedback with ID ${feedbackId} updated by user ${username}.`);

            // Fetch updated feedbacks and replies
            const feedbackQuery = `
                SELECT f.id AS feedbackId, f.username AS feedbackUsername, f.comments, f.created_at AS feedbackCreatedAt,
                       r.id AS replyId, r.feedback_id AS replyFeedbackId, r.reply, r.username AS replyUsername, r.created_at AS replyCreatedAt
                FROM feedback1 f
                LEFT JOIN replies r ON f.id = r.feedback_id
                ORDER BY f.created_at DESC, r.created_at ASC
            `;

            connection.query(feedbackQuery, (err, results) => {
                if (err) {
                    console.error('Error fetching updated feedbacks:', err);
                    return res.status(500).send('Error fetching updated feedbacks.');
                }

                // Group feedbacks and their replies
                const feedbacks = [];
                const feedbackMap = {};

                results.forEach(row => {
                    if (!feedbackMap[row.feedbackId]) {
                        feedbackMap[row.feedbackId] = {
                            id: row.feedbackId,
                            username: row.feedbackUsername,
                            comments: row.comments,
                            created_at: row.feedbackCreatedAt,
                            replies: []
                        };
                        feedbacks.push(feedbackMap[row.feedbackId]);
                    }

                    if (row.replyId) {
                        feedbackMap[row.feedbackId].replies.push({
                            id: row.replyId,
                            reply: row.reply,
                            username: row.replyUsername,
                            created_at: row.replyCreatedAt
                        });
                    }
                });

                // Render the updated feedback page
                res.render('feedback.ejs', { feedbacks, username });
            });
        });
    });
});

app.get('/view-feedback', (req, res) => {
    const query = `
        SELECT 
            f.id AS feedbackId, f.username AS feedbackUsername, f.comments, f.rating, f.created_at AS feedbackCreatedAt,
            r.id AS replyId, r.reply, r.username AS replyUsername, r.created_at AS replyCreatedAt
        FROM feedback1 f
        LEFT JOIN replies r ON f.id = r.feedback_id
        ORDER BY f.created_at DESC, r.created_at ASC
    `;

    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching feedback and replies:', err);
            return res.status(500).send('Error fetching feedback from the database');
        }

        // Group feedbacks with their replies
        const feedbackMap = {};
        results.forEach(row => {
            if (!feedbackMap[row.feedbackId]) {
                feedbackMap[row.feedbackId] = {
                    username: row.feedbackUsername,
                    comments: row.comments,
                    rating: row.rating,
                    createdAt: row.feedbackCreatedAt,
                    replies: []
                };
            }

            if (row.replyId) {
                feedbackMap[row.feedbackId].replies.push({
                    reply: row.reply,
                    username: row.replyUsername,
                    createdAt: row.replyCreatedAt
                });
            }
        });

        const feedbackHtml = Object.values(feedbackMap).map(feedback => `
            <div>
                <h3>${feedback.username}</h3>
                <p>Rating: ${feedback.rating} stars</p>
                <p>${feedback.comments}</p>
                <small>Submitted on: ${new Date(feedback.createdAt).toLocaleString()}</small>
                ${feedback.replies.length > 0 ? `
                    <div style="margin-left: 20px; border-left: 2px solid #ddd; padding-left: 10px;">
                        <h4>Replies:</h4>
                        ${feedback.replies.map(reply => `
                            <div>
                                <strong>${reply.username}</strong> replied:
                                <p>${reply.reply}</p>
                                <small>Submitted on: ${new Date(reply.createdAt).toLocaleString()}</small>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p>No replies yet.</p>'}
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
                        .replies { margin-left: 20px; }
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



  app.get('/posts', (req, res) => {
    if (!req.session.username) {
        return res.redirect('/'); // המשתמש לא מחובר, מחזירים אותו לדף ההתחברות
    }

    const query = `
        SELECT p.id AS post_id, p.title, p.content, p.created_at, u.username,
               r.reply_text, r.created_at AS reply_created_at, r.username AS reply_username
        FROM posts p
        JOIN project u ON p.user_id = u.id
        LEFT JOIN post_replies r ON p.id = r.post_id
        ORDER BY p.created_at DESC, r.created_at ASC
    `;

    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error retrieving posts:', err);
            return res.send('Error retrieving posts');
        }

        const posts = {};

        // ארגון התוצאות בקבוצות לפי פוסטים ותגובות
        results.forEach(row => {
            if (!posts[row.post_id]) {
                posts[row.post_id] = {
                    id: row.post_id,
                    title: row.title,
                    content: row.content,
                    created_at: row.created_at,
                    username: row.username,
                    replies: []
                };
            }

            if (row.reply_text) {
                posts[row.post_id].replies.push({
                    reply_text: row.reply_text,
                    created_at: row.reply_created_at,
                    username: row.reply_username
                });
            }
        });

        res.render('posts.ejs', { posts: Object.values(posts), username: req.session.username });
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
            <a href="/index.html" class="back-button">Back to Home</a>
          </body>
        </html>
      `);
    });
  });

  app.post('/add-reply/:postId', (req, res) => {
    if (!req.session.username) {
        return res.status(401).send('Unauthorized: Please log in first.');
    }

    const postId = req.params.postId;
    const { replyText } = req.body;

    // בדיקת המשתמש המחובר
    const query = 'SELECT id FROM project WHERE username = ?';
    connection.query(query, [req.session.username], (err, results) => {
        if (err) {
            console.error('Error finding user:', err);
            return res.send('Error finding user');
        }

        if (results.length > 0) {
            const userId = results[0].id;

            // הוספת התגובה
            const insertReplyQuery = 'INSERT INTO post_replies (post_id, user_id, username, reply_text) VALUES (?, ?, ?, ?)';
            connection.query(insertReplyQuery, [postId, userId, req.session.username, replyText], (err, result) => {
                if (err) {
                    console.error('Error adding reply:', err);
                    return res.send('Error adding reply');
                }

                res.redirect(`/posts`); // הפניה חזרה לדף הפוסטים
            });
        } else {
            res.send('User not found');
        }
    });
});
app.post('/delete-replys', (req, res) => {
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
    const selectQuery = 'SELECT username FROM post_replies WHERE id = ?';
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
        const deleteQuery = 'DELETE FROM post_replies WHERE id = ?';
        connection.query(deleteQuery, [replyId], (err) => {
            if (err) {
                console.error('Error deleting reply:', err);
                return res.status(500).send('Error deleting reply.');
            }
            console.log(`Reply with ID ${replyId} deleted by user ${username}.`);
            res.redirect('/posts'); // הפניה חזרה לדף הפידבקים
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
