
const express = require('express');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

const app = express();

app.use(express.json());

const dbPath = path.join(__dirname, 'bookstore.db');

let db = null;

// ======================================
// HOME ROUTE
// ======================================

app.get('/', (req, res) => {
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sai Kumar Bookstore API</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f4f4f4;
          text-align: center;
          padding: 60px 20px;
        }

        .container {
          background: white;
          padding: 35px;
          border-radius: 12px;
          max-width: 650px;
          margin: auto;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        h1 { color: #222; }
        p { color: #555; }
        li { margin: 12px; }
        ul { list-style: none; padding: 0; }
      </style>
    </head>

    <body>
      <div class="container">
        <h1>Welcome to Sai Kumar's Bookstore API</h1>

        <h3>Backend Development Fundamentals - Lab 3</h3>

        <p>Your REST API is running successfully!</p>

        <h3>Available API Endpoints</h3>

        <ul>
          <li>GET - /books</li>
          <li>GET - /books/:id</li>
          <li>POST - /books</li>
          <li>PUT - /books/:id</li>
          <li>DELETE - /books/:id</li>
        </ul>

        <p>Use Postman to test the API endpoints.</p>
      </div>
    </body>
    </html>
  `);
});

// ======================================
// DATABASE INITIALIZATION
// ======================================

const initializeDBAndServer = async () => {
  try {

    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Create Books Table

    await db.exec(`
      CREATE TABLE IF NOT EXISTS book (
        book_id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        price REAL NOT NULL
      );
    `);

    // Insert Sample Books Automatically

    const booksCount = await db.get(
      'SELECT COUNT(*) AS count FROM book;'
    );

    if (booksCount.count === 0) {

      const insertBookQuery = `
        INSERT INTO book (title, author, price)
        VALUES (?, ?, ?);
      `;

      const sampleBooks = [
        ['Python Programming', 'John Smith', 450],
        ['Java Programming', 'James Gosling', 550],
        ['Web Development', 'David Miller', 350],
        ['Database Management', 'Thomas Connolly', 600],
        ['JavaScript Basics', 'Brendan Eich', 400],
        ['Data Structures', 'Mark Allen', 500],
        ['HTML and CSS', 'Jon Duckett', 300],
        ['C Programming', 'Dennis Ritchie', 250],
        ['Machine Learning', 'Tom Mitchell', 750],
        ['Artificial Intelligence', 'Stuart Russell', 850]
      ];

      for (const book of sampleBooks) {
        await db.run(insertBookQuery, book);
      }

      console.log('10 sample books inserted successfully!');
    }

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}/`);
    });

  } catch (error) {
    console.error('Database Error:', error.message);
    process.exit(1);
  }
};

// ======================================
// VALIDATION MIDDLEWARE
// ======================================

const validateBookInput = (req, res, next) => {

  const { title, author, price } = req.body;

  if (
    typeof title !== 'string' ||
    title.trim() === ''
  ) {
    return res.status(400).json({
      message: 'Title is required and must be a string'
    });
  }

  if (
    typeof author !== 'string' ||
    author.trim() === ''
  ) {
    return res.status(400).json({
      message: 'Author is required and must be a string'
    });
  }

  if (
    price === undefined ||
    price === null ||
    typeof price !== 'number' ||
    !Number.isFinite(price) ||
    price < 0
  ) {
    return res.status(400).json({
      message: 'Price must be a valid non-negative number'
    });
  }

  next();
};

// ======================================
// GET ALL BOOKS
// Search, Sorting, Pagination, Price Filter
// ======================================

app.get('/books', async (req, res) => {

  try {

    const {
      search_q = '',
      order_by = 'book_id',
      order = 'ASC',
      limit = '10',
      offset = '0',
      min_price = '0',
      max_price = '1000000'
    } = req.query;

    // Allowed Sorting Columns

    const allowedColumns = [
      'book_id',
      'title',
      'author',
      'price'
    ];

    const allowedOrders = ['ASC', 'DESC'];

    if (!allowedColumns.includes(order_by)) {
      return res.status(400).json({
        message: 'Invalid order_by column'
      });
    }

    if (
      typeof order !== 'string' ||
      !allowedOrders.includes(order.toUpperCase())
    ) {
      return res.status(400).json({
        message: 'Order must be ASC or DESC'
      });
    }

    // Convert Query Parameters

    const parsedLimit = Number(limit);
    const parsedOffset = Number(offset);
    const parsedMinPrice = Number(min_price);
    const parsedMaxPrice = Number(max_price);

    if (
      !Number.isInteger(parsedLimit) ||
      parsedLimit <= 0 ||
      !Number.isInteger(parsedOffset) ||
      parsedOffset < 0 ||
      !Number.isFinite(parsedMinPrice) ||
      !Number.isFinite(parsedMaxPrice) ||
      parsedMinPrice < 0 ||
      parsedMaxPrice < parsedMinPrice
    ) {
      return res.status(400).json({
        message: 'Invalid limit, offset or price range'
      });
    }

    // Parameterised SQL Query

    const getBooksQuery = `
      SELECT *
      FROM book
      WHERE title LIKE ?
      AND price BETWEEN ? AND ?
      ORDER BY ${order_by} ${order.toUpperCase()}
      LIMIT ? OFFSET ?;
    `;

    const books = await db.all(getBooksQuery, [
      `%${search_q}%`,
      parsedMinPrice,
      parsedMaxPrice,
      parsedLimit,
      parsedOffset
    ]);

    return res.status(200).json(books);

  } catch (error) {

    return res.status(500).json({
      message: 'Unable to retrieve books',
      error: error.message
    });

  }
});

// ======================================
// GET SINGLE BOOK
// ======================================

app.get('/books/:id', async (req, res) => {

  try {

    const { id } = req.params;

    const book = await db.get(
      `SELECT * FROM book WHERE book_id = ?;`,
      [id]
    );

    if (!book) {
      return res.status(404).json({
        message: 'Book not found'
      });
    }

    return res.status(200).json(book);

  } catch (error) {

    return res.status(500).json({
      message: 'Unable to retrieve book',
      error: error.message
    });

  }
});

// ======================================
// POST - CREATE BOOK
// ======================================

app.post('/books', validateBookInput, async (req, res) => {

  try {

    const { title, author, price } = req.body;

    const createBookQuery = `
      INSERT INTO book (title, author, price)
      VALUES (?, ?, ?);
    `;

    const result = await db.run(createBookQuery, [
      title.trim(),
      author.trim(),
      price
    ]);

    return res.status(201).json({
      message: 'Book created successfully',
      bookId: result.lastID
    });

  } catch (error) {

    return res.status(500).json({
      message: 'Unable to create book',
      error: error.message
    });

  }
});

// ======================================
// PUT - UPDATE BOOK
// ======================================

app.put('/books/:id', validateBookInput, async (req, res) => {

  try {

    const { id } = req.params;

    const { title, author, price } = req.body;

    const updateBookQuery = `
      UPDATE book
      SET title = ?, author = ?, price = ?
      WHERE book_id = ?;
    `;

    const result = await db.run(updateBookQuery, [
      title.trim(),
      author.trim(),
      price,
      id
    ]);

    if (result.changes === 0) {
      return res.status(404).json({
        message: 'Book not found'
      });
    }

    return res.status(200).json({
      message: 'Book updated successfully'
    });

  } catch (error) {

    return res.status(500).json({
      message: 'Unable to update book',
      error: error.message
    });

  }
});

// ======================================
// DELETE BOOK
// ======================================

app.delete('/books/:id', async (req, res) => {

  try {

    const { id } = req.params;

    const deleteBookQuery = `
      DELETE FROM book
      WHERE book_id = ?;
    `;

    const result = await db.run(deleteBookQuery, [id]);

    if (result.changes === 0) {
      return res.status(404).json({
        message: 'Book not found'
      });
    }

    return res.status(200).json({
      message: 'Book deleted successfully'
    });

  } catch (error) {

    return res.status(500).json({
      message: 'Unable to delete book',
      error: error.message
    });

  }
});

// ======================================
// START SERVER
// ======================================

initializeDBAndServer();

module.exports = app;
