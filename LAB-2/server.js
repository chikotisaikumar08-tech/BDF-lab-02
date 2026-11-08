
const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Welcome to the Books API!");
});

const dbPath = path.join(__dirname, "database.db");

let db = null;

app.get("/books/", async (req, res) => {
  const books = await db.all("SELECT * FROM books");
  res.status(200).send(books);
});

app.get("/books/:bookId/", async (req, res) => {
  const { bookId } = req.params;

  const book = await db.get(
    "SELECT * FROM books WHERE id = ?",
    [bookId]
  );

  if (book === undefined) {
    return res.status(404).send({ error: "Book not found" });
  }

  res.status(200).send(book);
});

app.post("/books/", async (req, res) => {
  const { title, author, price, pages } = req.body;

  const result = await db.run(
    `INSERT INTO books (title, author, price, pages)
     VALUES (?, ?, ?, ?)`,
    [title, author, price, pages]
  );

  res.status(201).send({
    message: "Book added successfully",
    bookId: result.lastID,
  });
});

app.put("/books/:bookId/", async (req, res) => {
  const { bookId } = req.params;
  const { title, author, price, pages } = req.body;

  const result = await db.run(
    `UPDATE books
     SET title = ?, author = ?, price = ?, pages = ?
     WHERE id = ?`,
    [title, author, price, pages, bookId]
  );

  if (result.changes === 0) {
    return res.status(404).send({ error: "Book not found" });
  }

  res.status(200).send({ message: "Book updated successfully" });
});

// DELETE a book
app.delete("/books/:bookId/", async (req, res) => {
  const { bookId } = req.params;

  const result = await db.run(
    "DELETE FROM books WHERE id = ?",
    [bookId]
  );

  if (result.changes === 0) {
    return res.status(404).send({ error: "Book not found" });
  }

  res.status(200).send({ message: "Book deleted successfully" });
});

// Database connection and server initialization
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    console.log("Database connected successfully");

    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`Database Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();
