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
            return res.status(403).send(`
                <html>
                    <head>
                        <title>Permission Denied</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                text-align: center;
                                margin: 50px;
                            }
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
                        <h1>Permission Denied</h1>
                        <p>You do not have permission to delete this reply.</p>
                        <button onclick="window.history.back()" class="back-button">Go Back</button>
                    </body>
                </html>
            `);
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
            console.error('User does not have permission to delete this reply.');
            return res.status(403).send(`
                <html>
                    <head>
                        <title>Permission Denied</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                text-align: center;
                                margin: 50px;
                            }
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
                        <h1>Permission Denied</h1>
                        <p>You do not have permission to edit this reply.</p>
                        <button onclick="window.history.back()" class="back-button">Go Back</button>
                    </body>
                </html>
            `);
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
            console.error('User does not have permission to delete this feedback.');
            return res.status(403).send(`
                <html>
                    <head>
                        <title>Permission Denied</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                text-align: center;
                                margin: 50px;
                            }
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
                        <h1>Permission Denied</h1>
                        <p>You are not allowed to delete this feedback.</p>
                        <button onclick="window.history.back()" class="back-button">Go Back</button>
                    </body>
                </html>
            `);
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
            console.error('User does not have permission to edit this feedback.');
            return res.status(403).send(`
                <html>
                    <head>
                        <title>Permission Denied</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                text-align: center;
                                margin: 50px;
                            }
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
                        <h1>Permission Denied</h1>
                        <p>You are not allowed to edit this feedback.</p>
                        <button onclick="window.history.back()" class="back-button">Go Back</button>
                    </body>
                </html>
            `);
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
app.get('/view-feedbacks', (req, res) => {
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
            return res.status(500).send('Error fetching feedbacks.');
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

        res.render('feedback-view.ejs', { feedbacks, username: req.session.username });
    });
});




  app.get('/posts', (req, res) => {
    if (!req.session.username) {
        return res.redirect('/'); // המשתמש לא מחובר, מחזירים אותו לדף ההתחברות
    }

    const query = `
    SELECT 
        p.id AS post_id, p.user_id AS post_user_id, p.username AS post_username, p.title, p.content, p.created_at AS post_created_at,
        r.id AS reply_id, r.post_id AS reply_post_id, r.reply_text, r.user_id AS reply_user_id, r.username AS reply_username, r.created_at AS reply_created_at
    FROM posts p
    LEFT JOIN post_replies r ON p.id = r.post_id
    ORDER BY p.created_at DESC, r.created_at ASC
`;

    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error retrieving posts:', err);
            return res.send('Error retrieving posts');
        }

        const posts = results.reduce((acc, row) => {
            let post = acc.find(p => p.id === row.post_id);
            if (!post) {
                post = {
                    id: row.post_id,
                    user_id: row.post_user_id,
                    username: row.post_username,
                    title: row.title,
                    content: row.content,
                    created_at: row.post_created_at,
                    replies: []
                };
                acc.push(post);
            }
            if (row.reply_id) {
                post.replies.push({
                    id: row.reply_id,
                    post_id: row.reply_post_id,
                    user_id: row.reply_user_id,
                    username: row.reply_username,
                    reply_text: row.reply_text,
                    created_at: row.reply_created_at
                });
            }
            return acc;
        }, []);

        res.render('posts.ejs', { posts, username: req.session.username });
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
    const query = `
        SELECT 
            p.id AS postId, p.username AS postUsername, p.title, p.content, p.created_at AS postCreatedAt,
            r.id AS replyId, r.reply_text, r.username AS replyUsername, r.created_at AS replyCreatedAt
        FROM posts p
        LEFT JOIN post_replies r ON p.id = r.post_id
        ORDER BY p.created_at DESC, r.created_at ASC
    `;

    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching posts and replies:', err);
            return res.status(500).send('Error fetching posts from the database');
        }

        // Group posts with their replies
        const postMap = {};
        results.forEach(row => {
            if (!postMap[row.postId]) {
                postMap[row.postId] = {
                    username: row.postUsername,
                    title: row.title,
                    content: row.content,
                    createdAt: row.postCreatedAt,
                    replies: []
                };
            }

            if (row.replyId) {
                postMap[row.postId].replies.push({
                    replyText: row.reply_text,
                    username: row.replyUsername,
                    createdAt: row.replyCreatedAt
                });
            }
        });

        const postsHtml = Object.values(postMap).map(post => `
            <div>
                <h3>${post.title}</h3>
                <p>By: <strong>${post.username}</strong></p>
                <p>${post.content}</p>
                <small>Posted on: ${new Date(post.createdAt).toLocaleString()}</small>
                ${post.replies.length > 0 ? `
                    <div style="margin-left: 20px; border-left: 2px solid #ddd; padding-left: 10px;">
                        <h4>Replies:</h4>
                        ${post.replies.map(reply => `
                            <div>
                                <strong>${reply.username}</strong> replied:
                                <p>${reply.replyText}</p>
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
                    <title>User Posts</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        h3 { color: #007bff; }
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
                    <h1>All Posts</h1>
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

        if (replyOwner !== username) {
            console.error('User does not have permission to delete this reply.');
            return res.status(403).send(`
                <html>
                    <head>
                        <title>Permission Denied</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                text-align: center;
                                margin: 50px;
                            }
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
                        <h1>Permission Denied</h1>
                        <p>You do not have permission to delete this reply.</p>
                        <button onclick="window.history.back()" class="back-button">Go Back</button>
                    </body>
                </html>
            `);
        }

        // Delete the reply
        const deleteQuery = 'DELETE FROM post_replies WHERE id = ?';
        connection.query(deleteQuery, [replyId], (err) => {
            if (err) {
                console.error('Error deleting reply:', err);
                return res.status(500).send('Error deleting reply.');
            }

            console.log(`Reply with ID ${replyId} deleted by user ${username}.`);

            // Fetch updated posts and replies
            const postsQuery = `
                SELECT 
                    p.id AS postId, p.username AS postUsername, p.title, p.content, p.created_at AS postCreatedAt,
                    r.id AS replyId, r.post_id AS replyPostId, r.reply_text, r.username AS replyUsername, r.created_at AS replyCreatedAt
                FROM posts p
                LEFT JOIN post_replies r ON p.id = r.post_id
                ORDER BY p.created_at DESC, r.created_at ASC
            `;

            connection.query(postsQuery, (err, results) => {
                if (err) {
                    console.error('Error fetching updated posts:', err);
                    return res.status(500).send('Error fetching updated posts.');
                }

                // Group posts and their replies
                const posts = [];
                const postMap = {};

                results.forEach(row => {
                    if (!postMap[row.postId]) {
                        postMap[row.postId] = {
                            id: row.postId,
                            username: row.postUsername,
                            title: row.title,
                            content: row.content,
                            created_at: row.postCreatedAt,
                            replies: []
                        };
                        posts.push(postMap[row.postId]);
                    }

                    if (row.replyId) {
                        postMap[row.postId].replies.push({
                            id: row.replyId,
                            reply_text: row.reply_text,
                            username: row.replyUsername,
                            created_at: row.replyCreatedAt
                        });
                    }
                });

                // Render the updated posts page
                res.render('posts.ejs', { posts, username });
            });
        });
    });
});

app.post('/edit-replys', (req, res) => {
    const { replyId, replyText } = req.body; // קבלת הערכים מהטופס
    const username = req.session.username; // שם המשתמש מה-session

    // בדיקה אם המשתמש מחובר
    if (!username) {
        return res.status(401).send("Unauthorized. Please log in.");
    }

    // בדיקה אם הטקסט של התגובה ריק
   

    // בדיקת בעלות על התגובה
    const checkOwnershipQuery = "SELECT username FROM post_replies WHERE id = ?";
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
            return res.status(403).send(`
                <html>
                    <head>
                        <title>Permission Denied</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                text-align: center;
                                margin: 50px;
                            }
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
                        <h1>Permission Denied</h1>
                        <p>You do not have permission to edit this reply.</p>
                        <button onclick="window.history.back()" class="back-button">Go Back</button>
                    </body>
                </html>
            `);
        }

        // עדכון התגובה בטבלה post_replies
        const updateQuery = "UPDATE post_replies SET reply_text = ? WHERE id = ?";
        connection.query(updateQuery, [replyText, replyId], (err) => {
            if (err) {
                console.error("Error updating reply:", err);
                return res.status(500).send("Error updating reply.");
            }

            // שאילתא לקבלת כל הפוסטים והתגובות המעודכנות
            const postsQuery = `
                SELECT 
                    p.id AS postId, p.username AS postUsername, p.title, p.content, p.created_at AS postCreatedAt,
                    r.id AS replyId, r.post_id AS replyPostId, r.reply_text, r.username AS replyUsername, r.created_at AS replyCreatedAt
                FROM posts p
                LEFT JOIN post_replies r ON p.id = r.post_id
                ORDER BY p.created_at DESC, r.created_at ASC
            `;

            connection.query(postsQuery, (err, results) => {
                if (err) {
                    console.error("Error fetching posts and replies:", err);
                    return res.status(500).send("Error fetching updated posts.");
                }

                // קיבוץ הפוסטים והתגובות
                const posts = [];
                const postMap = {};

                results.forEach(row => {
                    if (!postMap[row.postId]) {
                        postMap[row.postId] = {
                            id: row.postId,
                            username: row.postUsername,
                            title: row.title,
                            content: row.content,
                            created_at: row.postCreatedAt,
                            replies: []
                        };
                        posts.push(postMap[row.postId]);
                    }

                    if (row.replyId) {
                        postMap[row.postId].replies.push({
                            id: row.replyId,
                            reply_text: row.reply_text,
                            username: row.replyUsername,
                            created_at: row.replyCreatedAt
                        });
                    }
                });

                // הצגת העמוד המעודכן
                res.render('posts.ejs', { posts, username });
            });
        });
    });
});

app.post('/delete-post', (req, res) => {
    const postId = req.body.postId; // ID of the post to delete
    const username = req.session.username; // Get username from the session

    if (!username) {
        return res.status(401).send('Unauthorized. Please log in.');
    }

    // Check ownership of the post
    const checkOwnershipQuery = 'SELECT username FROM posts WHERE id = ?';
    connection.query(checkOwnershipQuery, [postId], (err, results) => {
        if (err) {
            console.error('Error checking post ownership:', err);
            return res.status(500).send('Error verifying post ownership.');
        }

        if (results.length === 0) {
            return res.status(404).send('Post not found.');
        }

        const postOwner = results[0].username;

        if (postOwner !== username) {
            console.error('User does not have permission to delete this post.');
            return res.status(403).send(`
                <html>
                    <head>
                        <title>Permission Denied</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                text-align: center;
                                margin: 50px;
                            }
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
                        <h1>Permission Denied</h1>
                        <p>You are not allowed to delete this post.</p>
                        <button onclick="window.history.back()" class="back-button">Go Back</button>
                    </body>
                </html>
            `);
        }

        // Delete associated replies
        connection.query('DELETE FROM post_replies WHERE post_id = ?', [postId], (err) => {
            if (err) {
                console.error('Error deleting replies:', err);
                return res.status(500).send('Error deleting replies.');
            }

            // Delete the post itself
            connection.query('DELETE FROM posts WHERE id = ?', [postId], (err) => {
                if (err) {
                    console.error('Error deleting post:', err);
                    return res.status(500).send('Error deleting post.');
                }

                console.log(`Post with ID ${postId} deleted by user ${username}.`);

                // Fetch updated posts and replies
                const postsQuery = `
                    SELECT 
                        p.id AS postId, p.username AS postUsername, p.title, p.content, p.created_at AS postCreatedAt,
                        r.id AS replyId, r.post_id AS replyPostId, r.reply_text, r.username AS replyUsername, r.created_at AS replyCreatedAt
                    FROM posts p
                    LEFT JOIN post_replies r ON p.id = r.post_id
                    ORDER BY p.created_at DESC, r.created_at ASC
                `;

                connection.query(postsQuery, (err, results) => {
                    if (err) {
                        console.error('Error fetching updated posts:', err);
                        return res.status(500).send('Error fetching updated posts.');
                    }

                    // Group posts and their replies
                    const posts = [];
                    const postMap = {};

                    results.forEach(row => {
                        if (!postMap[row.postId]) {
                            postMap[row.postId] = {
                                id: row.postId,
                                username: row.postUsername,
                                title: row.title,
                                content: row.content,
                                created_at: row.postCreatedAt,
                                replies: []
                            };
                            posts.push(postMap[row.postId]);
                        }

                        if (row.replyId) {
                            postMap[row.postId].replies.push({
                                id: row.replyId,
                                reply_text: row.reply_text,
                                username: row.replyUsername,
                                created_at: row.replyCreatedAt
                            });
                        }
                    });

                    // Render the updated posts page
                    res.render('posts.ejs', { posts, username });
                });
            });
        });
    });
});
app.post('/edit-post', (req, res) => {
    const postId = req.body.postId; // מזהה הפוסט
    const updatedContent = req.body.content; // תוכן מעודכן
    const username = req.session.username; // שם המשתמש מה-session

    if (!username) {
        return res.status(401).send('Unauthorized. Please log in.');
    }

    // בדיקת בעלות על הפוסט
    const checkOwnershipQuery = 'SELECT username FROM posts WHERE id = ?';
    connection.query(checkOwnershipQuery, [postId], (err, results) => {
        if (err) {
            console.error('Error checking post ownership:', err);
            return res.status(500).send('Error verifying post ownership.');
        }

        if (results.length === 0) {
            return res.status(404).send('Post not found.');
        }

        const postOwner = results[0].username;

        if (postOwner !== username) {
            console.error('User does not have permission to edit this post.');
            return res.status(403).send(`
                <html>
                    <head>
                        <title>Permission Denied</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                text-align: center;
                                margin: 50px;
                            }
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
                        <h1>Permission Denied</h1>
                        <p>You are not allowed to edit this post.</p>
                        <button onclick="window.history.back()" class="back-button">Go Back</button>
                    </body>
                </html>
            `);
        }

        // עדכון הפוסט במסד הנתונים
        const updateQuery = 'UPDATE posts SET content = ? WHERE id = ?';
        connection.query(updateQuery, [updatedContent, postId], (err) => {
            if (err) {
                console.error('Error updating post:', err);
                return res.status(500).send('Error updating post.');
            }

            console.log(`Post with ID ${postId} updated by user ${username}.`);

            // שליפת הפוסטים והתגובות המעודכנים
            const postsQuery = `
                SELECT 
                    p.id AS postId, p.username AS postUsername, p.title, p.content, p.created_at AS postCreatedAt,
                    r.id AS replyId, r.post_id AS replyPostId, r.reply_text, r.username AS replyUsername, r.created_at AS replyCreatedAt
                FROM posts p
                LEFT JOIN post_replies r ON p.id = r.post_id
                ORDER BY p.created_at DESC, r.created_at ASC
            `;

            connection.query(postsQuery, (err, results) => {
                if (err) {
                    console.error('Error fetching updated posts:', err);
                    return res.status(500).send('Error fetching updated posts.');
                }

                // קיבוץ הפוסטים והתגובות
                const posts = [];
                const postMap = {};

                results.forEach(row => {
                    if (!postMap[row.postId]) {
                        postMap[row.postId] = {
                            id: row.postId,
                            username: row.postUsername,
                            title: row.title,
                            content: row.content,
                            created_at: row.postCreatedAt,
                            replies: []
                        };
                        posts.push(postMap[row.postId]);
                    }

                    if (row.replyId) {
                        postMap[row.postId].replies.push({
                            id: row.replyId,
                            reply_text: row.reply_text,
                            username: row.replyUsername,
                            created_at: row.replyCreatedAt
                        });
                    }
                });

                // הצגת עמוד הפוסטים המעודכן
                res.render('posts.ejs', { posts, username });
            });
        });
    });
});
app.get('/trainings', (req, res) => {
    if (!req.session.username) {
        return res.redirect('/'); // המשתמש לא מחובר, מחזירים אותו לדף ההתחברות
    }

    const query = `
    SELECT 
        t.id AS training_id, t.username AS training_username, t.training_time, t.workout_type,
        f.feedback_id AS reply_id, f.training_id AS reply_training_id, f.reply AS reply_text, f.username AS reply_username, f.created_at AS reply_created_at
    FROM trainings t
    LEFT JOIN training_feedback f ON t.id = f.training_id
    ORDER BY t.training_time DESC, f.created_at ASC
`;

    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error retrieving trainings:', err);
            return res.send('Error retrieving trainings');
        }

        const trainings = results.reduce((acc, row) => {
            let training = acc.find(t => t.id === row.training_id);
            if (!training) {
                training = {
                    id: row.training_id,
                    username: row.training_username,
                    training_time: row.training_time,
                    workout_type: row.workout_type,
                    replies: []
                };
                acc.push(training);
            }
            if (row.reply_id) {
                training.replies.push({
                    id: row.reply_id,
                    training_id: row.reply_training_id,
                    username: row.reply_username,
                    reply_text: row.reply_text,
                    created_at: row.reply_created_at
                });
            }
            return acc;
        }, []);

        res.render('trainings.ejs', { trainings, username: req.session.username });
    });
});

app.post('/add-training', (req, res) => {
    if (!req.session.username) {
        return res.status(401).send('Unauthorized: Please log in first.');
    }

    const { training_time, workout_type } = req.body;

    // בדיקת המשתמש המחובר
    const query = 'SELECT id FROM project WHERE username = ?';
    connection.query(query, [req.session.username], (err, results) => {
        if (err) {
            console.error('Error finding user:', err);
            return res.send('Error finding user');
        }

        if (results.length > 0) {
            const userId = results[0].id;

            // הוספת אימון
            const insertPostQuery = 'INSERT INTO trainings (username, training_time, workout_type) VALUES (?, ?, ?)';
            connection.query(insertPostQuery, [req.session.username, training_time, workout_type], (err, result) => {
                if (err) {
                    console.error('Error adding training:', err);
                    return res.send('Error adding training');
                }

                res.redirect('/trainings'); // הפניה לדף האימונים
            });
        } else {
            res.send('User not found');
        }
    });
});

app.post('/replyt', (req, res) => { 
    const { trainingId, reply } = req.body; // שימוש ב-trainingId במקום feedbackId
    const username = req.session.username;

    // בדיקת כניסה למערכת
    if (!username) {
        return res.status(401).send('User not logged in.');
    }

    // הוספת תגובה לטבלת training_feedback
    const insertReplyQuery = 'INSERT INTO training_feedback (training_id, reply, username, created_at) VALUES (?, ?, ?, NOW())';
    connection.query(insertReplyQuery, [trainingId, reply, username], (err) => {
        if (err) {
            console.error('Error inserting reply:', err);
            return res.status(500).send('Error saving reply.');
        }

        // שליפת האימונים והתגובות שלהם
        const query = `
        SELECT 
            t.id AS training_id, t.username AS training_username, t.training_time, t.workout_type,
            f.feedback_id AS reply_id, f.training_id AS reply_training_id, f.reply AS reply_text, f.username AS reply_username, f.created_at AS reply_created_at
        FROM trainings t
        LEFT JOIN training_feedback f ON t.id = f.training_id
        ORDER BY t.training_time DESC, f.created_at ASC
    `;
    
        connection.query(query, (err, results) => {
            if (err) {
                console.error('Error retrieving trainings:', err);
                return res.send('Error retrieving trainings');
            }
    
            const trainings = results.reduce((acc, row) => {
                let training = acc.find(t => t.id === row.training_id);
                if (!training) {
                    training = {
                        id: row.training_id,
                        username: row.training_username,
                        training_time: row.training_time,
                        workout_type: row.workout_type,
                        replies: []
                    };
                    acc.push(training);
                }
                if (row.reply_id) {
                    training.replies.push({
                        id: row.reply_id,
                        training_id: row.reply_training_id,
                        username: row.reply_username,
                        reply_text: row.reply_text,
                        created_at: row.reply_created_at
                    });
                }
                return acc;
            }, []);
    
            res.render('trainings.ejs', { trainings, username: req.session.username });
        });
    });
    
});

app.post('/delete-replyt', (req, res) => {
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
    const selectQuery = 'SELECT username FROM training_feedback WHERE feedback_id = ?';
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
            return res.status(403).send(`
                <html>
                    <head>
                        <title>Permission Denied</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                text-align: center;
                                margin: 50px;
                            }
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
                        <h1>Permission Denied</h1>
                        <p>You do not have permission to delete this reply.</p>
                        <button onclick="window.history.back()" class="back-button">Go Back</button>
                    </body>
                </html>
            `);
        }

        // Delete the reply
        const deleteQuery = 'DELETE FROM training_feedback WHERE feedback_id = ?';
        connection.query(deleteQuery, [replyId], (err) => {
            if (err) {
                console.error('Error deleting reply:', err);
                return res.status(500).send('Error deleting reply.');
            }

            console.log(`Reply with ID ${replyId} deleted by user ${username}.`);

            // Fetch updated trainings and replies
            const query = `
            SELECT 
                t.id AS training_id, 
                t.username AS training_username, 
                t.training_time, 
                t.workout_type,
                f.feedback_id AS reply_id, 
                f.training_id AS reply_training_id, 
                f.reply AS reply_text, 
                f.username AS reply_username, 
                f.created_at AS reply_created_at
            FROM trainings t
            LEFT JOIN training_feedback f ON t.id = f.training_id
            ORDER BY t.training_time DESC, f.created_at ASC;
        `;
            connection.query(query, (err, results) => {
                if (err) {
                    console.error('Error fetching updated trainings:', err);
                    return res.status(500).send('Error fetching updated trainings.');
                }

                // Group trainings and their replies
                const trainings = results.reduce((acc, row) => {
                    let training = acc.find(t => t.id === row.training_id);
                    if (!training) {
                        training = {
                            id: row.training_id,
                            username: row.training_username,
                            training_time: row.training_time,
                            workout_type: row.workout_type,
                            replies: []
                        };
                        acc.push(training);
                    }
                    if (row.reply_id) {
                        training.replies.push({
                            id: row.reply_id,
                            username: row.reply_username,
                            reply_text: row.reply_text,
                            created_at: row.reply_created_at
                        });
                    }
                    return acc;
                }, []);

                // Render the updated trainings page
                res.render('trainings.ejs', { trainings, username });
            });
        });
    });
});

app.post('/edit-replyt', (req, res) => {
    const { replyId, reply } = req.body;
    const username = req.session.username;

    // בדיקת כניסה למערכת
    if (!username) {
        return res.status(401).send("Unauthorized. Please log in.");
    }

    // בדיקת בעלות על התגובה
    const checkOwnershipQuery = "SELECT username FROM training_feedback WHERE feedback_id = ?";
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
            return res.status(403).send(`
                <html>
                    <head>
                        <title>Permission Denied</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                text-align: center;
                                margin: 50px;
                            }
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
                        <h1>Permission Denied</h1>
                        <p>You do not have permission to edit this reply.</p>
                        <button onclick="window.history.back()" class="back-button">Go Back</button>
                    </body>
                </html>
            `);
        }

        // עדכון התגובה
        const updateQuery = "UPDATE training_feedback SET reply = ? WHERE feedback_id = ?";
        connection.query(updateQuery, [reply, replyId], (err) => {
            if (err) {
                console.error("Error updating reply:", err);
                return res.status(500).send("Error updating reply.");
            }

            // שליפת האימונים והתגובות המעודכנות
            const query = `
                SELECT 
                    t.id AS training_id, 
                    t.username AS training_username, 
                    t.training_time, 
                    t.workout_type,
                    f.feedback_id AS reply_id, 
                    f.training_id AS reply_training_id, 
                    f.reply AS reply_text, 
                    f.username AS reply_username, 
                    f.created_at AS reply_created_at
                FROM trainings t
                LEFT JOIN training_feedback f ON t.id = f.training_id
                ORDER BY t.training_time DESC, f.created_at ASC;
            `;

            connection.query(query, (err, results) => {
                if (err) {
                    console.error("Error fetching updated trainings:", err);
                    return res.status(500).send("Error fetching updated trainings.");
                }

                // קיבוץ אימונים והתגובות שלהם
                const trainings = results.reduce((acc, row) => {
                    let training = acc.find(t => t.id === row.training_id);
                    if (!training) {
                        training = {
                            id: row.training_id,
                            username: row.training_username,
                            training_time: row.training_time,
                            workout_type: row.workout_type,
                            replies: []
                        };
                        acc.push(training);
                    }
                    if (row.reply_id) {
                        training.replies.push({
                            id: row.reply_id,
                            username: row.reply_username,
                            reply_text: row.reply_text,
                            created_at: row.reply_created_at
                        });
                    }
                    return acc;
                }, []);

                // הצגת העמוד המעודכן
                res.render('trainings.ejs', { trainings, username });
            });
        });
    });
});

app.post('/delete-trainings', (req, res) => {
    const trainingId = req.body.trainingId; // ID of the training to delete
    const username = req.session.username; // Get username from the session

    if (!username) {
        return res.status(401).send('Unauthorized. Please log in.');
    }

    // Check ownership of the training
    const checkOwnershipQuery = 'SELECT username FROM trainings WHERE id = ?';
    connection.query(checkOwnershipQuery, [trainingId], (err, results) => {
        if (err) {
            console.error('Error checking training ownership:', err);
            return res.status(500).send('Error verifying training ownership.');
        }

        if (results.length === 0) {
            return res.status(404).send('Training not found.');
        }

        const trainingOwner = results[0].username;

        if (trainingOwner !== username) {
            return res.status(403).send(`
                <html>
                    <head>
                        <title>Permission Denied</title>
                        <style>
                            body { font-family: Arial, sans-serif; text-align: center; margin: 50px; }
                            .back-button {
                                display: inline-block; margin-top: 20px; padding: 10px 20px;
                                font-size: 16px; color: white; background-color: #4CAF50;
                                border: none; border-radius: 5px; cursor: pointer;
                            }
                            .back-button:hover { background-color: #45a049; }
                        </style>
                    </head>
                    <body>
                        <h1>Permission Denied</h1>
                        <p>You are not allowed to delete this training.</p>
                        <button onclick="window.history.back()" class="back-button">Go Back</button>
                    </body>
                </html>
            `);
        }

        // Delete related feedbacks first
        const deleteFeedbacksQuery = 'DELETE FROM training_feedback WHERE training_id = ?';
        connection.query(deleteFeedbacksQuery, [trainingId], (err) => {
            if (err) {
                console.error('Error deleting feedbacks:', err);
                return res.status(500).send('Error deleting related feedbacks.');
            }

            // Delete the training itself
            const deleteTrainingQuery = 'DELETE FROM trainings WHERE id = ?';
            connection.query(deleteTrainingQuery, [trainingId], (err) => {
                if (err) {
                    console.error('Error deleting training:', err);
                    return res.status(500).send('Error deleting training.');
                }

                console.log(`Training with ID ${trainingId} deleted by user ${username}.`);

                // Fetch updated trainings
                const fetchUpdatedTrainingsQuery = `
                    SELECT 
                        t.id AS training_id, 
                        t.username AS training_username, 
                        t.training_time, 
                        t.workout_type,
                        f.feedback_id AS reply_id, 
                        f.training_id AS reply_training_id, 
                        f.reply AS reply_text, 
                        f.username AS reply_username, 
                        f.created_at AS reply_created_at
                    FROM trainings t
                    LEFT JOIN training_feedback f ON t.id = f.training_id
                    ORDER BY t.training_time DESC, f.created_at ASC;
                `;

                connection.query(fetchUpdatedTrainingsQuery, (err, results) => {
                    if (err) {
                        console.error('Error fetching updated trainings:', err);
                        return res.status(500).send('Error fetching updated trainings.');
                    }

                    // Group trainings and their replies
                    const trainings = results.reduce((acc, row) => {
                        let training = acc.find(t => t.id === row.training_id);
                        if (!training) {
                            training = {
                                id: row.training_id,
                                username: row.training_username,
                                training_time: row.training_time,
                                workout_type: row.workout_type,
                                replies: []
                            };
                            acc.push(training);
                        }
                        if (row.reply_id) {
                            training.replies.push({
                                id: row.reply_id,
                                username: row.reply_username,
                                reply_text: row.reply_text,
                                created_at: row.reply_created_at
                            });
                        }
                        return acc;
                    }, []);

                    // Render the updated trainings page
                    res.render('trainings.ejs', { trainings, username });
                });
            });
        });
    });
});
app.post('/edit-training', (req, res) => {
    const { trainingId, workoutType, trainingTime } = req.body; // קבלת נתונים מהטופס
    const username = req.session.username; // קבלת שם המשתמש מהסשן

    // בדיקת כניסה
    if (!username) {
        return res.status(401).send('Unauthorized. Please log in.');
    }

    // בדיקה האם המשתמש הוא בעל האימון
    const checkOwnershipQuery = 'SELECT username FROM trainings WHERE id = ?';
    connection.query(checkOwnershipQuery, [trainingId], (err, results) => {
        if (err) {
            console.error('Error checking training ownership:', err);
            return res.status(500).send('Error verifying training ownership.');
        }

        if (results.length === 0) {
            return res.status(404).send('Training not found.');
        }

        const trainingOwner = results[0].username;

        if (trainingOwner !== username) {
            return res.status(403).send(`
                <html>
                    <head>
                        <title>Permission Denied</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                text-align: center;
                                margin: 50px;
                            }
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
                        <h1>Permission Denied</h1>
                        <p>You are not allowed to edit this training.</p>
                        <button onclick="window.history.back()" class="back-button">Go Back</button>
                    </body>
                </html>
            `);
        }

        // עדכון פרטי האימון בטבלה
        const updateQuery = `
            UPDATE trainings 
            SET workout_type = ?, training_time = ? 
            WHERE id = ?
        `;
        connection.query(updateQuery, [workoutType, trainingTime, trainingId], (err) => {
            if (err) {
                console.error('Error updating training:', err);
                return res.status(500).send('Error updating training.');
            }

            console.log(`Training with ID ${trainingId} updated by user ${username}.`);

            // חזרה לעמוד האימונים
            const fetchUpdatedTrainingsQuery = `
                SELECT 
                    t.id AS training_id, 
                    t.username AS training_username, 
                    t.training_time, 
                    t.workout_type,
                    tf.feedback_id AS reply_id, 
                    tf.training_id AS reply_training_id, 
                    tf.reply AS reply_text, 
                    tf.username AS reply_username, 
                    tf.created_at AS reply_created_at
                FROM trainings t
                LEFT JOIN training_feedback tf ON t.id = tf.training_id
                ORDER BY t.training_time DESC, tf.created_at ASC;
            `;

            connection.query(fetchUpdatedTrainingsQuery, (err, results) => {
                if (err) {
                    console.error('Error fetching updated trainings:', err);
                    return res.status(500).send('Error fetching updated trainings.');
                }

                // קיבוץ האימונים והתגובות שלהם
                const trainings = [];
                const trainingMap = {};

                results.forEach(row => {
                    if (!trainingMap[row.training_id]) {
                        trainingMap[row.training_id] = {
                            id: row.training_id,
                            username: row.training_username,
                            training_time: row.training_time,
                            workout_type: row.workout_type,
                            replies: []
                        };
                        trainings.push(trainingMap[row.training_id]);
                    }

                    if (row.reply_id) {
                        trainingMap[row.training_id].replies.push({
                            id: row.reply_id,
                            reply: row.reply_text,
                            username: row.reply_username,
                            created_at: row.reply_created_at
                        });
                    }
                });

                // הצגת עמוד האימונים המעודכן
                res.render('trainings.ejs', { trainings, username });
            });
        });
    });
});

app.get('/view-training-feedback', (req, res) => {
    const query = `
        SELECT 
            t.id AS trainingId, 
            t.username AS trainingUsername, 
            t.training_time, 
            t.workout_type,
            tf.feedback_id AS replyId, 
            tf.reply, 
            tf.username AS replyUsername, 
            tf.created_at AS replyCreatedAt
        FROM trainings t
        LEFT JOIN training_feedback tf ON t.id = tf.training_id
        ORDER BY t.training_time DESC, tf.created_at ASC;
    `;

    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching training feedback and replies:', err);
            return res.status(500).send('Error fetching training feedback from the database');
        }

        // קיבוץ האימונים עם התגובות
        const trainingMap = {};
        results.forEach(row => {
            if (!trainingMap[row.trainingId]) {
                trainingMap[row.trainingId] = {
                    username: row.trainingUsername,
                    trainingTime: row.training_time,
                    workoutType: row.workout_type,
                    replies: []
                };
            }

            if (row.replyId) {
                trainingMap[row.trainingId].replies.push({
                    reply: row.reply,
                    username: row.replyUsername,
                    createdAt: row.replyCreatedAt
                });
            }
        });

        const trainingHtml = Object.values(trainingMap).map(training => `
            <div>
                <h3>${training.username}</h3>
                <p><strong>Workout Type:</strong> ${training.workoutType}</p>
                <p><strong>Time:</strong> ${new Date(training.trainingTime).toLocaleString()}</p>
                ${training.replies.length > 0 ? `
                    <div style="margin-left: 20px; border-left: 2px solid #ddd; padding-left: 10px;">
                        <h4>Replies:</h4>
                        ${training.replies.map(reply => `
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
                    <title>Training list </title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        h3 { color: #4CAF50; }
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
                    <h1>Training list</h1>
                    ${trainingHtml}
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
